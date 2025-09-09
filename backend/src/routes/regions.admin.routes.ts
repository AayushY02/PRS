import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon } from 'geojson';
import { db, schema } from '../db';
import { asc, eq, inArray } from 'drizzle-orm';
import { rectAtAlong, meters, positionsEvenly } from '../utils/autoLayout';

const adminRegionsRouter = Router();

/* ------------------------------- Zod Schemas ------------------------------- */
const LineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(z.tuple([z.number(), z.number()])),
}).passthrough();

const SaveCenterlineBody = z.object({
  centerline: LineStringSchema,
});

const AutoLayoutBody = z.object({
  side: z.enum(['left', 'right']).default('right'),
  subareaWidth: z.number().default(12),
  spotWidth: z.number().default(6),
  carDepth: z.number().default(2.5),
  lateralOffset: z.number().default(3),
});

/* ------------------------------- TS Utilities ------------------------------ */
function asLineFeature(line: Feature<LineString> | LineString): Feature<LineString> {
  if ((line as any)?.type === 'LineString' && !(line as any)?.geometry) {
    return turf.feature(line as any) as Feature<LineString>;
  }
  return line as Feature<LineString>;
}

/**
 * POST /api/admin/regions/:code/centerline
 * Save/replace a region centerline by **region code**.
 */
adminRegionsRouter.post('/:code/centerline', async (req: Request, res: Response) => {
  const Params = z.object({ code: z.string() }).safeParse(req.params);
  const Body = SaveCenterlineBody.safeParse(req.body);
  if (!Params.success) return res.status(400).json({ error: Params.error.flatten() });
  if (!Body.success)   return res.status(400).json({ error: Body.error.flatten() });

  const [region] = await db
    .select({ id: schema.regions.id })
    .from(schema.regions)
    .where(eq(schema.regions.code, Params.data.code))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });

  await db
    .update(schema.regions)
    .set({ centerline: Body.data.centerline as any })
    .where(eq(schema.regions.id, region.id));

  res.json({ ok: true, regionId: region.id });
});

/**
 * POST /api/admin/regions/:code/auto-layout
 * Generate rectangles for subareas → spots → sub_spots and persist them.
 */
adminRegionsRouter.post('/:code/auto-layout', async (req: Request, res: Response) => {
  const Params = z.object({ code: z.string() }).safeParse(req.params);
  const Body = AutoLayoutBody.safeParse(req.body ?? {});
  if (!Params.success) return res.status(400).json({ error: Params.error.flatten() });
  if (!Body.success)   return res.status(400).json({ error: Body.error.flatten() });

  const { side, subareaWidth, spotWidth, carDepth, lateralOffset } = Body.data;

  // 1) region + centerline
  const [region] = await db
    .select({ id: schema.regions.id, centerline: schema.regions.centerline })
    .from(schema.regions)
    .where(eq(schema.regions.code, Params.data.code))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });
  if (!region.centerline) return res.status(400).json({ error: 'Centerline not set' });

  const line = asLineFeature(region.centerline as any);

  // 2) subareas → spots → sub_spots
  const subareas = await db
    .select({ id: schema.subareas.id, code: schema.subareas.code })
    .from(schema.subareas)
    .where(eq(schema.subareas.regionId, region.id))
    .orderBy(asc(schema.subareas.code));

  const subareaIds = subareas.map(s => s.id);
  const spots = subareaIds.length
    ? await db
        .select({ id: schema.spots.id, subareaId: schema.spots.subareaId, code: schema.spots.code })
        .from(schema.spots)
        .where(inArray(schema.spots.subareaId, subareaIds))
        .orderBy(asc(schema.spots.code))
    : [];

  const spotIds = spots.map(s => s.id);
  const subSpots = spotIds.length
    ? await db
        .select({ id: schema.subSpots.id, spotId: schema.subSpots.spotId, idx: schema.subSpots.idx, code: schema.subSpots.code })
        .from(schema.subSpots)
        .where(inArray(schema.subSpots.spotId, spotIds))
        .orderBy(asc(schema.subSpots.idx))
    : [];

  // 3) rectangles
  const totalM = meters(line);
  const subCenters = positionsEvenly(totalM, subareas.length, 10);
  const subLen = subareas.length ? (totalM / Math.max(1, subareas.length)) * 0.75 : 60;

  const subareaPolys: { id: string; geom: any }[] = [];
  const spotPolys: { id: string; geom: any }[] = [];
  const subSpotPolys: { id: string; geom: any }[] = [];

  for (let i = 0; i < subareas.length; i++) {
    const sa = subareas[i];
    if (!sa) continue;
    const center = subCenters[i];
    if (center === undefined) continue;

    const poly = rectAtAlong(line, center, subLen, subareaWidth, side, lateralOffset);
    subareaPolys.push({ id: sa.id, geom: poly.geometry });

    const saLen = subLen;
    const spotsInSa = spots.filter(s => s.subareaId === sa.id);
    if (!spotsInSa.length) continue;

    const centers = positionsEvenly(saLen, spotsInSa.length, 2);
    const start = center - saLen / 2;

    for (let j = 0; j < spotsInSa.length; j++) {
      const sp = spotsInSa[j];
      if (!sp) continue;

      const ctr = centers[j];
      if (ctr === undefined) continue;

      const at = start + ctr;
      const spLen = (saLen / Math.max(1, spotsInSa.length)) * 0.8;

      const spPoly = rectAtAlong(line, at, spLen, spotWidth, side, lateralOffset);
      spotPolys.push({ id: sp.id, geom: spPoly.geometry });

      const ssRows = subSpots.filter(ss => ss.spotId === sp.id).sort((a, b) => a.idx - b.idx);
      if (!ssRows.length) continue;

      const perLen = (spLen / Math.max(1, ssRows.length)) * 0.9;
      const first = at - spLen / 2 + perLen / 2;

      for (let k = 0; k < ssRows.length; k++) {
        const stallAt = first + k * (spLen / Math.max(1, ssRows.length));
        const ssPoly = rectAtAlong(line, stallAt, perLen, carDepth, side, lateralOffset);
        const row = ssRows[k];
        if (!row) continue;
        subSpotPolys.push({ id: row.id, geom: ssPoly.geometry });
      }
    }
  }

  // 4) persist
  for (const r of subareaPolys) await db.update(schema.subareas).set({ geom: r.geom as any }).where(eq(schema.subareas.id, r.id));
  for (const r of spotPolys)    await db.update(schema.spots).set({ geom: r.geom as any }).where(eq(schema.spots.id, r.id));
  for (const r of subSpotPolys) await db.update(schema.subSpots).set({ geom: r.geom as any }).where(eq(schema.subSpots.id, r.id));

  // 5) optional region hull
  try {
    const polyFC = turf.featureCollection(
      subareaPolys.map(p => turf.polygon((p.geom as Polygon).coordinates))
    );
    const pts = turf.explode(polyFC);
    const hull = pts.features.length ? turf.convex(pts) : null;
    if (hull) {
      await db.update(schema.regions).set({ geom: hull.geometry as any }).where(eq(schema.regions.id, region.id));
    }
  } catch {}

  res.json({
    ok: true,
    counts: { subareas: subareaPolys.length, spots: spotPolys.length, subSpots: subSpotPolys.length },
    params: { side, subareaWidth, spotWidth, carDepth, lateralOffset },
  });
});

export default adminRegionsRouter;
