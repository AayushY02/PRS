import { Router } from 'express';
import { db, schema } from '../db';
import { asc } from 'drizzle-orm';

export const regionsRouter = Router();

regionsRouter.get('/', async (_req, res) => {
  const regions = await db
    .select({ id: schema.regions.id, code: schema.regions.code, name: schema.regions.name })
    .from(schema.regions)
    .orderBy(asc(schema.regions.code));
  res.json({ regions });
});
