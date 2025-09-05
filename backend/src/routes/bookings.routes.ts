import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authRequired } from '../middleware/authRequired';
import { db, schema } from '../db';
import { and, eq } from 'drizzle-orm';
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

bookingsRouter.get('/mine', async (req: Request, res: Response) => {
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

bookingsRouter.post('/', async (req: Request, res: Response) => {
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

bookingsRouter.patch('/:id', async (req: Request, res: Response) => {
  // userId injected by your auth middleware
  const userId = (req as any).userId as string | undefined;

  // 1) Validate route params (id must be a UUID string)
  const Params = z.object({ id: z.string().uuid() });
  const Body = z.object({ comment: z.string().max(1000).nullable() });

  const paramsParse = Params.safeParse(req.params);
  if (!paramsParse.success) {
    return res.status(400).json({ error: paramsParse.error.flatten() });
  }
  const { id } = paramsParse.data;

  // Optional: ensure userId exists and is a uuid as well
  const UserId = z.string().uuid();
  const userIdParse = UserId.safeParse(userId);
  if (!userIdParse.success) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const bodyParse = Body.safeParse(req.body);
  if (!bodyParse.success) {
    return res.status(400).json({ error: bodyParse.error.flatten() });
  }

  // 2) Build the update with a single where + and(...)
  const r = await db
    .update(schema.bookings)
    .set({ comment: bodyParse.data.comment ?? null })
    .where(
      and(
        eq(schema.bookings.id, id),
        eq(schema.bookings.userId, userIdParse.data)
      )
    )
    .returning({ id: schema.bookings.id });

  if (!r[0]) return res.status(404).json({ error: 'Booking not found' });

  res.json({ ok: true });
});
bookingsRouter.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string | undefined;

  // Validate params/body
  const Params = z.object({ id: z.string().uuid() });
  const params = Params.safeParse(req.params);
  if (!params.success) {
    return res.status(400).json({ error: params.error.flatten() });
  }
  const { id } = params.data;

  // Ensure userId is present and looks like a UUID (adjust if your user id is not UUID)
  const userIdSchema = z.string().uuid();
  const parsedUser = userIdSchema.safeParse(userId);
  if (!parsedUser.success) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Perform soft cancel only if it belongs to user and is active
  const r = await db
    .update(schema.bookings)
    .set({ status: 'cancelled' as const })
    .where(
      and(
        eq(schema.bookings.id, id),
        eq(schema.bookings.userId, parsedUser.data),
        eq(schema.bookings.status, 'active' as const),
      )
    )
    .returning({ id: schema.bookings.id });

  if (!r[0]) {
    return res
      .status(404)
      .json({ error: 'Booking not found or already cancelled' });
  }

  res.json({ ok: true });
});