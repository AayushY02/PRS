// backend/src/routes/regions.routes.ts
import { Router } from 'express';
import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import z from 'zod';

export const regionsRouter = Router();

/**
 * GET /api/regions
 * Simple list of regions (id, name, code). Add fields as your schema allows.
 */
regionsRouter.get('/', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id:        schema.regions.id,
        name:      schema.regions.name,
        code:      schema.regions.code,      // if your schema lacks `code`, remove this line
      })
      .from(schema.regions);
    res.json({ regions: rows });
  } catch (e) {
    console.error('GET /api/regions failed:', e);
    res.status(500).json({ error: 'Failed to fetch regions' });
  }
});

/**
 * GET /api/regions/:id
 * Returns a single region plus counts:
 *   - subareasCount: number of subareas under this region
 *   - spotsCount: total number of spots across those subareas
 */
regionsRouter.get('/:id', async (req, res) => {
  const Params = z.object({ id: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid region id' });
  }

  const { id } = parsed.data;

  try {
    // 1) Fetch the region
    const regionRows = await db
      .select({
        id:   schema.regions.id,
        name: schema.regions.name,
        code: schema.regions.code, // remove if not present in your schema
      })
      .from(schema.regions)
      .where(eq(schema.regions.id, id))
      .limit(1);

    const region = regionRows[0];
    if (!region) return res.status(404).json({ error: 'Region not found' });

    // 2) Fetch counts (done as two small queries; keep them simple to avoid array-cast pitfalls)
    const subareasCountRes = await db.execute(sql`
      SELECT COUNT(*)::int AS c
      FROM subareas
      WHERE region_id = ${id}::uuid
    `);
    const subareasCount: number = (subareasCountRes as any).rows?.[0]?.c ?? 0;

    const spotsCountRes = await db.execute(sql`
      SELECT COUNT(*)::int AS c
      FROM spots s
      WHERE s.subarea_id IN (
        SELECT sa.id FROM subareas sa WHERE sa.region_id = ${id}::uuid
      )
    `);
    const spotsCount: number = (spotsCountRes as any).rows?.[0]?.c ?? 0;

    // 3) Return region with counts
    res.json({
      region: {
        ...region,
        subareasCount,
        spotsCount,
      },
    });
  } catch (e) {
    console.error('GET /api/regions/:id failed:', e);
    res.status(500).json({ error: 'Failed to fetch region' });
  }
});

export default regionsRouter;
