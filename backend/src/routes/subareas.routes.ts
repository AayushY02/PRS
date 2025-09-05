import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { eq, asc } from 'drizzle-orm';
import z from 'zod';

export const subareasRouter = Router();

subareasRouter.get('/by-region/:regionId', async (req: Request, res: Response) => {
  const Params = z.object({ regionId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { regionId } = parsed.data;

  const [region] = await db
    .select({ id: schema.regions.id })
    .from(schema.regions)
    .where(eq(schema.regions.id, regionId))
    .limit(1);

  if (!region) return res.status(404).json({ error: 'Region not found' });

  const subareas = await db
    .select({
      id: schema.subareas.id,
      regionId: schema.subareas.regionId,
      code: schema.subareas.code,
      name: schema.subareas.name,
      highlightImageUrl: schema.subareas.highlightImageUrl,
    })
    .from(schema.subareas)
    .where(eq(schema.subareas.regionId, regionId))
    .orderBy(asc(schema.subareas.code));

  res.json({ subareas });
});
