import { Router } from 'express';
import { db, schema } from '../db';
import { eq, asc } from 'drizzle-orm';

export const subareasRouter = Router();

subareasRouter.get('/by-region/:regionId', async (req, res) => {
  const { regionId } = req.params;
  const [region] = await db.select({ id: schema.regions.id }).from(schema.regions).where(eq(schema.regions.id, regionId)).limit(1);
  if (!region) return res.status(404).json({ error: 'Region not found' });

  const subareas = await db
    .select({
      id: schema.subareas.id,
      regionId: schema.subareas.regionId,
      code: schema.subareas.code,
      name: schema.subareas.name,
      highlightImageUrl: schema.subareas.highlightImageUrl
    })
    .from(schema.subareas)
    .where(eq(schema.subareas.regionId, regionId))
    .orderBy(asc(schema.subareas.code));

  res.json({ subareas });
});
