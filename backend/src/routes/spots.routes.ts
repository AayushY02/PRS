import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { eq, asc, sql } from 'drizzle-orm';
import { sql as raw } from 'drizzle-orm';
import z from 'zod';

export const spotsRouter = Router();

spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
  const Params = z.object({ subareaId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { subareaId } = parsed.data;

  // Ensure subarea exists
  const [sa] = await db
    .select({ id: schema.subareas.id })
    .from(schema.subareas)
    .where(eq(schema.subareas.id, subareaId))
    .limit(1);

  if (!sa) return res.status(404).json({ error: 'Subarea not found' });

  // Fetch spots
  const spots = await db
    .select({
      id: schema.spots.id,
      subareaId: schema.spots.subareaId,
      code: schema.spots.code,
      description: schema.spots.description,
    })
    .from(schema.spots)
    .where(eq(schema.spots.subareaId, subareaId))
    .orderBy(asc(schema.spots.code));

  // Busy now: now() <@ time_range
  // (Using raw SQL; keep if your schema uses tstzrange)
  const busyRows = await db.execute(
    sql`SELECT spot_id FROM ${schema.bookings} WHERE ${schema.bookings.status} = 'active' AND now() <@ ${schema.bookings.timeRange}`
  );
  const busySet = new Set((busyRows as any).rows.map((r: any) => r.spot_id as string));

  res.json({
    spots: spots.map(s => ({ ...s, isBusyNow: busySet.has(s.id) })),
  });
});
