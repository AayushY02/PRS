// import { Router, type Request, type Response } from 'express';
// import { z } from 'zod';
// import { authRequired } from '../middleware/authRequired';
// import { db, schema } from '../db';
// import { and, eq } from 'drizzle-orm';
// import { sql as raw } from 'drizzle-orm';

// export const bookingsRouter = Router();

// const CreateBooking = z.object({
//   spotId: z.string().uuid(),
//   startTime: z.string().datetime(), // ISO
//   endTime: z.string().datetime(),
//   comment: z.string().max(1000).optional().nullable()
// }).refine(v => new Date(v.endTime) > new Date(v.startTime), {
//   message: 'End must be after start'
// });

// bookingsRouter.use(authRequired);

// bookingsRouter.get('/mine', async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   // We need time_range text; cast to text in query
//   const rows = await db.execute(
//     raw`SELECT id, spot_id, user_id, time_range::text AS time_range, comment, status, created_at
//         FROM bookings
//         WHERE user_id = ${userId}
//         ORDER BY created_at DESC`
//   );
//   res.json({ bookings: (rows as any).rows });
// });

// bookingsRouter.post('/', async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = CreateBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { spotId, startTime, endTime, comment } = parsed.data;

//   try {
//     // Use raw to create tstzrange('[)') and let EXCLUDE handle overlaps
//     await db.execute(
//       raw`INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
//           VALUES (${userId}, ${spotId}, tstzrange(${startTime}, ${endTime}, '[)'), ${comment ?? null}, 'active')`
//     );
//     res.json({ ok: true });
//   } catch (e: any) {
//     // Exclusion violation (no-overlap)
//     // Postgres code is 23P01 for exclusion constraint
//     if (e?.code === '23P01') {
//       return res.status(409).json({ error: 'Slot already booked for part/all of that period' });
//     }
//     res.status(500).json({ error: 'Failed to create booking' });
//   }
// });

// bookingsRouter.patch('/:id', async (req: Request, res: Response) => {
//   // userId injected by your auth middleware
//   const userId = (req as any).userId as string | undefined;

//   // 1) Validate route params (id must be a UUID string)
//   const Params = z.object({ id: z.string().uuid() });
//   const Body = z.object({ comment: z.string().max(1000).nullable() });

//   const paramsParse = Params.safeParse(req.params);
//   if (!paramsParse.success) {
//     return res.status(400).json({ error: paramsParse.error.flatten() });
//   }
//   const { id } = paramsParse.data;

//   // Optional: ensure userId exists and is a uuid as well
//   const UserId = z.string().uuid();
//   const userIdParse = UserId.safeParse(userId);
//   if (!userIdParse.success) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }

//   const bodyParse = Body.safeParse(req.body);
//   if (!bodyParse.success) {
//     return res.status(400).json({ error: bodyParse.error.flatten() });
//   }

//   // 2) Build the update with a single where + and(...)
//   const r = await db
//     .update(schema.bookings)
//     .set({ comment: bodyParse.data.comment ?? null })
//     .where(
//       and(
//         eq(schema.bookings.id, id),
//         eq(schema.bookings.userId, userIdParse.data)
//       )
//     )
//     .returning({ id: schema.bookings.id });

//   if (!r[0]) return res.status(404).json({ error: 'Booking not found' });

//   res.json({ ok: true });
// });
// bookingsRouter.delete('/:id', async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string | undefined;

//   // Validate params/body
//   const Params = z.object({ id: z.string().uuid() });
//   const params = Params.safeParse(req.params);
//   if (!params.success) {
//     return res.status(400).json({ error: params.error.flatten() });
//   }
//   const { id } = params.data;

//   // Ensure userId is present and looks like a UUID (adjust if your user id is not UUID)
//   const userIdSchema = z.string().uuid();
//   const parsedUser = userIdSchema.safeParse(userId);
//   if (!parsedUser.success) {
//     return res.status(401).json({ error: 'Unauthorized' });
//   }

//   // Perform soft cancel only if it belongs to user and is active
//   const r = await db
//     .update(schema.bookings)
//     .set({ status: 'cancelled' as const })
//     .where(
//       and(
//         eq(schema.bookings.id, id),
//         eq(schema.bookings.userId, parsedUser.data),
//         eq(schema.bookings.status, 'active' as const),
//       )
//     )
//     .returning({ id: schema.bookings.id });

//   if (!r[0]) {
//     return res
//       .status(404)
//       .json({ error: 'Booking not found or already cancelled' });
//   }

//   res.json({ ok: true });
// });

// // --- NEW: start a metered booking now, open-ended upper bound
// bookingsRouter.post('/start', async (req, res) => {
//   const userId = (req as any).userId as string;
//   const Body = z.object({
//     spotId: z.string().uuid(),
//     comment: z.string().max(1000).optional().nullable()
//   });
//   const parsed = Body.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { spotId, comment } = parsed.data;

//   try {
//     // Create [now, ) booking (open-ended); EXCLUDE prevents overlap
//     await db.execute(
//       raw`INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
//           VALUES (${userId}, ${spotId}, tstzrange(now(), NULL, '[)'), ${comment ?? null}, 'active')`
//     );
//     res.json({ ok: true });
//   } catch (e: any) {
//     if (e?.code === '23P01') {
//       // overlap -> someone already holds this spot
//       return res.status(409).json({ error: 'Spot is currently booked' });
//     }
//     res.status(500).json({ error: 'Failed to start booking' });
//   }
// });

// // --- NEW: end the current user's active booking for a spot by fixing the upper bound to now
// bookingsRouter.post('/end', async (req, res) => {
//   const userId = (req as any).userId as string;
//   const Body = z.object({ spotId: z.string().uuid() });
//   const parsed = Body.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { spotId } = parsed.data;

//   // Only touch your own active open-ended booking
//   const result = await db.execute(
//     raw`UPDATE bookings
//          SET time_range = tstzrange(lower(time_range), now(), '[)') -- close it at now
//          WHERE user_id = ${userId}
//            AND spot_id = ${spotId}
//            AND status = 'active'
//            AND now() <@ time_range      -- currently running
//            AND upper_inf(time_range)    -- open-ended
//          RETURNING id`
//   );

//   const updated = (result as any).rowCount || (result as any).rows?.length;
//   if (!updated) return res.status(404).json({ error: 'No active booking to end for this spot' });

//   res.json({ ok: true });
// });

// // --- Optional: comment & cancel remain (unchanged examples)
// bookingsRouter.patch('/:id', async (req, res) => {
//   const userId = (req as any).userId as string;
//   const { id } = req.params;
//   const Body = z.object({ comment: z.string().max(1000).nullable() });
//   const parsed = Body.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const r = await db
//     .update(schema.bookings)
//     .set({ comment: parsed.data.comment ?? null })
//     .where(and(eq(schema.bookings.id, id), eq(schema.bookings.userId, userId)))
//     .returning({ id: schema.bookings.id });

//   if (!r[0]) return res.status(404).json({ error: 'Booking not found' });
//   res.json({ ok: true });
// });

// bookingsRouter.delete('/:id', async (req, res) => {
//   const userId = (req as any).userId as string;
//   const { id } = req.params;

//   const r = await db
//     .update(schema.bookings)
//     .set({ status: 'cancelled' })
//     .where(and(eq(schema.bookings.id, id), eq(schema.bookings.userId, userId), eq(schema.bookings.status, 'active')))
//     .returning({ id: schema.bookings.id });

//   if (!r[0]) return res.status(404).json({ error: 'Booking not found or already cancelled' });
//   res.json({ ok: true });
// });

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db';
import { and, eq } from 'drizzle-orm';
import { sql as raw } from 'drizzle-orm';
import { authRequired } from '../middleware/authRequired'; // keeps req.userId

export const bookingsRouter = Router();

/**
 * Create a fixed booking (start/end). Kept for “manual” reservations if you still need it.
 */
const CreateBooking = z.object({
  spotId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  comment: z.string().max(1000).optional().nullable(),
}).refine(v => new Date(v.endTime) > new Date(v.startTime), {
  message: 'End must be after start',
});

bookingsRouter.post('/', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = CreateBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { spotId, startTime, endTime, comment } = parsed.data;

  // Use tstzrange text format and EXCLUDE constraint (status='active') to avoid overlaps.
  try {
    await db.execute(raw`
      INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
      VALUES (${userId}::uuid, ${spotId}::uuid, tstzrange(${startTime}::timestamptz, ${endTime}::timestamptz, '[)'), ${comment ?? null}, 'active')
    `);
    res.json({ ok: true });
  } catch (e: any) {
    // 23P01 = EXCLUDE constraint violation (overlap)
    if (String(e?.code) === '23P01') return res.status(409).json({ error: 'Spot already booked in this interval' });
    console.error(e);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * START an open-ended booking now (meter starts running).
 */
const StartBooking = z.object({
  spotId: z.string().uuid(),
  comment: z.string().max(1000).optional().nullable(),
});

bookingsRouter.post('/start', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = StartBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { spotId, comment } = parsed.data;

  try {
    const r = await db.execute(raw`
      INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
      VALUES (${userId}::uuid, ${spotId}::uuid, tstzrange(NOW(), NULL, '[)'), ${comment ?? null}, 'active')
      RETURNING id
    `);
    const bookingId = (r as any)?.rows?.[0]?.id ?? null;
    res.json({ ok: true, bookingId });
  } catch (e: any) {
    if (String(e?.code) === '23P01') return res.status(409).json({ error: 'Spot is already booked' });
    console.error(e);
    res.status(500).json({ error: 'Failed to start booking' });
  }
});

/**
 * END the current user’s active booking for a spot (upper-bound the range to now).
 */
const EndBooking = z.object({
  spotId: z.string().uuid(),
});

bookingsRouter.post('/end', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = EndBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { spotId } = parsed.data;

  const r = await db.execute(raw`
    UPDATE bookings
    SET time_range = tstzrange(lower(time_range), NOW(), '[)'),
        status = 'completed'
    WHERE user_id = ${userId}::uuid
      AND spot_id = ${spotId}::uuid
      AND status = 'active'
      AND NOW() <@ time_range
    RETURNING id
  `);

  if ((r as any).rows?.length === 0) {
    return res.status(404).json({ error: 'No active booking to end' });
  }
  res.json({ ok: true });
});

/**
 * List your bookings (active + past).
 * Note: returns raw `time_range` text; frontend parses it.
 */
bookingsRouter.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  const r = await db.execute(raw`
    SELECT id, spot_id, time_range, comment, status, created_at
    FROM bookings
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
  `);

  res.json({ bookings: (r as any).rows ?? [] });
});

/**
 * Soft-cancel an active booking (optional, keeps history).
 */
bookingsRouter.delete('/:id', authRequired, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  const r = await db
    .update(schema.bookings)
    .set({ status: 'cancelled' })
    .where(and(eq(schema.bookings.id, id), eq(schema.bookings.userId, userId), eq(schema.bookings.status, 'active')))
    .returning({ id: schema.bookings.id });

  if (!r[0]) return res.status(404).json({ error: 'Booking not found or already cancelled' });
  res.json({ ok: true });
});
