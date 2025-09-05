import { Router } from 'express';
import { db, schema } from '../db';
import { eq, asc } from 'drizzle-orm';
import { sql as raw } from 'drizzle-orm';

export const spotsRouter = Router();

spotsRouter.get('/by-subarea/:subareaId', async (req, res) => {
  const { subareaId } = req.params;

  const [sa] = await db.select({ id: schema.subareas.id }).from(schema.subareas).where(eq(schema.subareas.id, subareaId)).limit(1);
  if (!sa) return res.status(404).json({ error: 'Subarea not found' });

  const spots = await db
    .select({
      id: schema.spots.id,
      subareaId: schema.spots.subareaId,
      code: schema.spots.code,
      description: schema.spots.description
    })
    .from(schema.spots)
    .where(eq(schema.spots.subareaId, subareaId))
    .orderBy(asc(schema.spots.code));

  // busy now: now() is inside the tstzrange
  const busyRows = await db.execute(
    raw`SELECT spot_id FROM bookings WHERE status = 'active' AND now() <@ time_range`
  );
  const busySet = new Set((busyRows as any).rows.map((r: any) => r.spot_id));

  res.json({
    spots: spots.map(s => ({ ...s, isBusyNow: busySet.has(s.id) }))
  });
});
