import { Router } from 'express';
import { z } from 'zod';
import { authRequired } from '../middleware/authRequired';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import { sql as raw } from 'drizzle-orm';

export const bookingsRouter = Router();

const CreateBooking = z.object({
  spotId: z.string().uuid(),
  startTime: z.string().datetime(), // ISO
  endTime: z.string().datetime(),
  comment: z.string().max(1000).optional().nullable()
}).refine(v => new Date(v.endTime) > new Date(v.startTime), {
  message: 'End must be after start'
});

bookingsRouter.use(authRequired);

bookingsRouter.get('/mine', async (req, res) => {
  const userId = (req as any).userId as string;
  // We need time_range text; cast to text in query
  const rows = await db.execute(
    raw`SELECT id, spot_id, user_id, time_range::text AS time_range, comment, status, created_at
        FROM bookings
        WHERE user_id = ${userId}
        ORDER BY created_at DESC`
  );
  res.json({ bookings: (rows as any).rows });
});

bookingsRouter.post('/', async (req, res) => {
  const userId = (req as any).userId as string;
  const parsed = CreateBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { spotId, startTime, endTime, comment } = parsed.data;

  try {
    // Use raw to create tstzrange('[)') and let EXCLUDE handle overlaps
    await db.execute(
      raw`INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
          VALUES (${userId}, ${spotId}, tstzrange(${startTime}, ${endTime}, '[)'), ${comment ?? null}, 'active')`
    );
    res.json({ ok: true });
  } catch (e: any) {
    // Exclusion violation (no-overlap)
    // Postgres code is 23P01 for exclusion constraint
    if (e?.code === '23P01') {
      return res.status(409).json({ error: 'Slot already booked for part/all of that period' });
    }
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

bookingsRouter.patch('/:id', async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const Body = z.object({ comment: z.string().max(1000).nullable() });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const r = await db
    .update(schema.bookings)
    .set({ comment: parsed.data.comment ?? null })
    .where(eq(schema.bookings.id, id))
    .where(eq(schema.bookings.userId, userId))
    .returning({ id: schema.bookings.id });

  if (!r[0]) return res.status(404).json({ error: 'Booking not found' });
  res.json({ ok: true });
});

bookingsRouter.delete('/:id', async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  const r = await db
    .update(schema.bookings)
    .set({ status: 'cancelled' })
    .where(eq(schema.bookings.id, id))
    .where(eq(schema.bookings.userId, userId))
    .where(eq(schema.bookings.status, 'active'))
    .returning({ id: schema.bookings.id });

  if (!r[0]) return res.status(404).json({ error: 'Booking not found or already cancelled' });
  res.json({ ok: true });
});
