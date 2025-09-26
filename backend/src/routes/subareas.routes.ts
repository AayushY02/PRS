
import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { eq, asc } from 'drizzle-orm';
import z from 'zod';

export const subareasRouter = Router();

/**
 * GET /api/subareas/by-region/:regionId
 * Returns subareas for a region, including their GeoJSON polygon (`geom`)
 * so the frontend can render them as rectangles on the map.
 */
subareasRouter.get('/by-region/:regionId', async (req: Request, res: Response) => {
  const Params = z.object({ regionId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { regionId } = parsed.data;

  // ensure region exists
  const [region] = await db
    .select({ id: schema.regions.id })
    .from(schema.regions)
    .where(eq(schema.regions.id, regionId))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });

  // include geom so UI can draw rectangles
  const subareas = await db
    .select({
      id: schema.subareas.id,
      regionId: schema.subareas.regionId,
      code: schema.subareas.code,
      name: schema.subareas.name,
      highlightImageUrl: schema.subareas.highlightImageUrl,
      geom: schema.subareas.geom, // 👈 GeoJSON polygon for map rendering
    })
    .from(schema.subareas)
    .where(eq(schema.subareas.regionId, regionId))
    .orderBy(asc(schema.subareas.code));

  res.json({ subareas });
});