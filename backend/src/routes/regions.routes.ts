

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon } from 'geojson';
import { db, schema } from '../db';
import { asc, eq } from 'drizzle-orm';

const regionsRouter = Router();

/** GET /api/regions */
regionsRouter.get('/', async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: schema.regions.id,
      code: schema.regions.code,
      name: schema.regions.name,
      hasCenterline: schema.regions.centerline,
      centerline: schema.regions.centerline,
      hasGeom: schema.regions.geom,
      geom: schema.regions.geom,
      createdAt: schema.regions.createdAt,
    })
    .from(schema.regions)
    .orderBy(asc(schema.regions.code));

  res.json({
    regions: rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      hasCenterline: !!r.hasCenterline,
      centerline: r.centerline,
      hasGeom: !!r.hasGeom,
      geom: r.geom,
      createdAt: r.createdAt,
    })),
  });
});

/** GET /api/regions/:regionId  (by ID to match frontend) */
regionsRouter.get('/:regionId', async (req: Request, res: Response) => {
  const Params = z.object({ regionId: z.string().uuid() }).safeParse(req.params);
  if (!Params.success) return res.status(400).json({ error: Params.error.flatten() });

  const [region] = await db
    .select({
      id: schema.regions.id,
      code: schema.regions.code,
      name: schema.regions.name,
      centerline: schema.regions.centerline,
      geom: schema.regions.geom,
      createdAt: schema.regions.createdAt,
    })
    .from(schema.regions)
    .where(eq(schema.regions.id, Params.data.regionId))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });
  res.json({ region });
});

/** (Optional helper if you want to fetch by code) GET /api/regions/by-code/:code */
regionsRouter.get('/by-code/:code', async (req: Request, res: Response) => {
  const Params = z.object({ code: z.string() }).safeParse(req.params);
  if (!Params.success) return res.status(400).json({ error: Params.error.flatten() });

  const [region] = await db
    .select({
      id: schema.regions.id,
      code: schema.regions.code,
      name: schema.regions.name,
      centerline: schema.regions.centerline,
      geom: schema.regions.geom,
      createdAt: schema.regions.createdAt,
    })
    .from(schema.regions)
    .where(eq(schema.regions.code, Params.data.code))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });
  res.json({ region });
});

export default regionsRouter;
