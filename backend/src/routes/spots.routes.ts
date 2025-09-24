import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { eq, asc, sql, inArray } from 'drizzle-orm';
import z from 'zod';
import { verifyJWT } from '../auth';
import { ENV } from '../env';

export const spotsRouter = Router();

type DbParentSpot = {
  id: string;
  subareaId: string;
  code: string;
  geom: any | null;
};

async function buildSpotsPayload(
  parentSpots: DbParentSpot[],
  userId: string | null,
) {
  if (parentSpots.length === 0) return [];

  const parentIds = parentSpots.map((p) => p.id);
  const parentIdList = sql.join(parentIds.map((id) => sql`${id}::uuid`), sql`, `);

  const subSpotsRows = await db.execute(sql`
    SELECT ss.id, ss.spot_id, ss.code, ss.idx, ss.geom AS geometry
    FROM sub_spots ss
    WHERE ss.spot_id IN (${parentIdList})
    ORDER BY ss.idx ASC, ss.code ASC
  `);

  const subSpotsByParent = new Map<string, Array<{ id: string; code: string; idx: number; geometry: any | null }>>();
  const subSpotIds: string[] = [];
  for (const r of (subSpotsRows as any).rows ?? []) {
    subSpotIds.push(r.id);
    const arr = subSpotsByParent.get(r.spot_id) ?? [];
    arr.push({ id: r.id, code: r.code, idx: r.idx, geometry: r.geometry ?? null });
    subSpotsByParent.set(r.spot_id, arr);
  }

  if (subSpotIds.length === 0) {
    return parentSpots.map((p) => ({ ...p, subSpots: [] }));
  }

  const subSpotIdList = sql.join(subSpotIds.map((id) => sql`${id}::uuid`), sql`, `);
  const activeRows = await db.execute(sql`
    SELECT b.sub_spot_id, b.user_id, lower(b.time_range) AS start_time
    FROM bookings b
    WHERE b.sub_spot_id IN (${subSpotIdList})
      AND b.status = 'active'
      AND NOW() <@ b.time_range
  `);

  const activeBySub = new Map<string, { user_id: string; start_time: string }>();
  for (const r of (activeRows as any).rows ?? []) {
    activeBySub.set(r.sub_spot_id, { user_id: r.user_id, start_time: r.start_time });
  }

  return parentSpots.map((p) => {
    const subs = subSpotsByParent.get(p.id) ?? [];
    const withState = subs.map((s) => {
      const a = activeBySub.get(s.id);
      const isBusyNow = !!a;
      const isMineNow = !!(a && userId && a.user_id === userId);
      return {
        id: s.id,
        code: s.code,
        idx: s.idx,
        geometry: s.geometry,
        isBusyNow,
        isMineNow,
        myStartTime: isMineNow && a ? a.start_time : null,
      };
    });
    return {
      id: p.id,
      subareaId: p.subareaId,
      code: p.code,
      geom: p.geom,
      subSpots: withState,
    };
  });
}

/**
 * GET /api/spots/by-subarea/:subareaId
 * Returns:
 * [
 *   {
 *     id,
 *     subareaId,
 *     code,
 *     geom, // GeoJSON polygon of the parent spot (dim background on map)
 *     subSpots: [
 *       { id, code, idx, geom, isBusyNow, isMineNow, myStartTime }
 *     ]
 *   }
 * ]
 */
spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
  const Params = z.object({ subareaId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subareaId } = parsed.data;

  // optional viewer id from cookie (not required)
  let userId: string | null = null;
  try {
    const token = (req as any).cookies?.[ENV.COOKIE_NAME];
    if (token) userId = verifyJWT(token).sub ?? null;
  } catch { /* unauthenticated is fine */ }

  // 1) ensure subarea exists
  const [sa] = await db
    .select({ id: schema.subareas.id })
    .from(schema.subareas)
    .where(eq(schema.subareas.id, subareaId))
    .limit(1);

  if (!sa) return res.status(404).json({ error: 'Subarea not found' });

  // 2) fetch parent spots under subarea (include geom for map)
  const parentSpots = await db
    .select({
      id: schema.spots.id,
      subareaId: schema.spots.subareaId,
      code: schema.spots.code,
      geom: schema.spots.geom, // ?? parent spot polygon (dim layer)
    })
    .from(schema.spots)
    .where(eq(schema.spots.subareaId, subareaId))
    .orderBy(asc(schema.spots.code));

  const spots = await buildSpotsPayload(parentSpots, userId);

  res.json({ spots });
});

/**
 * GET /api/spots/by-region/:regionId
 * Aggregates all spots under a region (across subareas) so the mobile flow can skip subareas.
 */
spotsRouter.get('/by-region/:regionId', async (req: Request, res: Response) => {
  const Params = z.object({ regionId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { regionId } = parsed.data;

  let userId: string | null = null;
  try {
    const token = (req as any).cookies?.[ENV.COOKIE_NAME];
    if (token) userId = verifyJWT(token).sub ?? null;
  } catch { /* unauthenticated is fine */ }

  const [region] = await db
    .select({
      id: schema.regions.id,
      code: schema.regions.code,
      name: schema.regions.name,
      geom: schema.regions.geom,
      centerline: schema.regions.centerline,
    })
    .from(schema.regions)
    .where(eq(schema.regions.id, regionId))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });

  const subareas = await db
    .select({ id: schema.subareas.id })
    .from(schema.subareas)
    .where(eq(schema.subareas.regionId, regionId));

  if (subareas.length === 0) {
    return res.json({ region, spots: [] });
  }

  const subareaIds = subareas.map((sa) => sa.id);

  const parentSpots = await db
    .select({
      id: schema.spots.id,
      subareaId: schema.spots.subareaId,
      code: schema.spots.code,
      geom: schema.spots.geom,
    })
    .from(schema.spots)
    .where(inArray(schema.spots.subareaId, subareaIds))
    .orderBy(asc(schema.spots.code));

  const spots = await buildSpotsPayload(parentSpots, userId);

  res.json({ region, spots });
});

spotsRouter.get('/subspots/with-geoms/by-subarea/:subareaId', async (req, res) => {
  const Params = z.object({ subareaId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { subareaId } = parsed.data;

  // parent spots in subarea
  const parents = await db
    .select({ id: schema.spots.id, code: schema.spots.code })
    .from(schema.spots)
    .where(eq(schema.spots.subareaId, subareaId));

  if (parents.length === 0) return res.json({ type: 'FeatureCollection', features: [] });

  const parentIds = parents.map(p => p.id);
  const parentIdList = sql.join(parentIds.map((id) => sql`${id}::uuid`), sql`, `);

  const rows = await db.execute(sql`
    SELECT ss.id, ss.spot_id, ss.code, ss.idx, ss.geom
    FROM sub_spots ss
    WHERE ss.spot_id IN (${parentIdList})
    ORDER BY ss.spot_id, ss.idx
  `);

  const title = new Map(parents.map(p => [p.id, p.code]));
  const features = ((rows as any).rows ?? [])
    .filter((r: any) => !!r.geom)
    .map((r: any) => ({
      type: 'Feature',
      id: r.id,
      properties: {
        type: 'sub_spot',
        code: r.code,
        idx: r.idx,
        spotCode: title.get(r.spot_id) ?? '',
      },
      geometry: r.geom,
    }));

  res.json({ type: 'FeatureCollection', features });
});
