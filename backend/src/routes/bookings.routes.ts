

// import { Router, type Request, type Response } from 'express';
// import { z } from 'zod';
// import { db, schema } from '../db';
// import { and, eq } from 'drizzle-orm';
// import { sql as raw } from 'drizzle-orm';
// import { authRequired } from '../middleware/authRequired'; // keeps req.userId

// export const bookingsRouter = Router();

// /**
//  * Create a fixed booking (start/end). Kept for “manual” reservations if you still need it.
//  */
// const CreateBooking = z.object({
//   spotId: z.string().uuid(),
//   startTime: z.string().datetime(),
//   endTime: z.string().datetime(),
//   comment: z.string().max(1000).optional().nullable(),
// }).refine(v => new Date(v.endTime) > new Date(v.startTime), {
//   message: 'End must be after start',
// });

// bookingsRouter.post('/', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = CreateBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { spotId, startTime, endTime, comment } = parsed.data;

//   // Use tstzrange text format and EXCLUDE constraint (status='active') to avoid overlaps.
//   try {
//     await db.execute(raw`
//       INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
//       VALUES (${userId}::uuid, ${spotId}::uuid, tstzrange(${startTime}::timestamptz, ${endTime}::timestamptz, '[)'), ${comment ?? null}, 'active')
//     `);
//     res.json({ ok: true });
//   } catch (e: any) {
//     // 23P01 = EXCLUDE constraint violation (overlap)
//     if (String(e?.code) === '23P01') return res.status(409).json({ error: 'Spot already booked in this interval' });
//     console.error(e);
//     res.status(500).json({ error: 'Failed to create booking' });
//   }
// });

// /**
//  * START an open-ended booking now (meter starts running).
//  */
// const StartBooking = z.object({
//   spotId: z.string().uuid(),
//   comment: z.string().max(1000).optional().nullable(),
// });

// bookingsRouter.post('/start', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = StartBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { spotId, comment } = parsed.data;

//   try {
//     const r = await db.execute(raw`
//       INSERT INTO bookings (user_id, spot_id, time_range, comment, status)
//       VALUES (${userId}::uuid, ${spotId}::uuid, tstzrange(NOW(), NULL, '[)'), ${comment ?? null}, 'active')
//       RETURNING id
//     `);
//     const bookingId = (r as any)?.rows?.[0]?.id ?? null;
//     res.json({ ok: true, bookingId });
//   } catch (e: any) {
//     if (String(e?.code) === '23P01') return res.status(409).json({ error: 'Spot is already booked' });
//     console.error(e);
//     res.status(500).json({ error: 'Failed to start booking' });
//   }
// });

// /**
//  * END the current user’s active booking for a spot (upper-bound the range to now).
//  */
// const EndBooking = z.object({
//   spotId: z.string().uuid(),
// });

// bookingsRouter.post('/end', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = EndBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { spotId } = parsed.data;

//   const r = await db.execute(raw`
//     UPDATE bookings
//     SET time_range = tstzrange(lower(time_range), NOW(), '[)'),
//         status = 'completed'
//     WHERE user_id = ${userId}::uuid
//       AND spot_id = ${spotId}::uuid
//       AND status = 'active'
//       AND NOW() <@ time_range
//     RETURNING id
//   `);

//   if ((r as any).rows?.length === 0) {
//     return res.status(404).json({ error: 'No active booking to end' });
//   }
//   res.json({ ok: true });
// });

// /**
//  * List your bookings (active + past).
//  * Note: returns raw `time_range` text; frontend parses it.
//  */
// bookingsRouter.get('/mine', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;

//   const r = await db.execute(raw`
//     SELECT id, spot_id, time_range, comment, status, created_at
//     FROM bookings
//     WHERE user_id = ${userId}::uuid
//     ORDER BY created_at DESC
//   `);

//   res.json({ bookings: (r as any).rows ?? [] });
// });

// /**
//  * Soft-cancel an active booking (optional, keeps history).
//  */
// bookingsRouter.delete('/:id', authRequired, async (req, res) => {
//   // These narrows ensure we never pass undefined into eq(...)
//   const userId = (req as any).userId as string | undefined;
//   const idParam = req.params?.id;

//   if (!userId || !idParam) {
//     return res.status(400).json({ error: 'Missing user or booking id' });
//   }

//   const r = await db
//     .update(schema.bookings)
//     .set({ status: 'cancelled' as const })
//     .where(
//       and(
//         eq(schema.bookings.id, idParam),            // idParam is now a string
//         eq(schema.bookings.userId, userId),         // userId is now a string
//         eq(schema.bookings.status, 'active' as const) // preserve literal type for enum
//       )
//     )
//     .returning({ id: schema.bookings.id });

//   if (!r[0]) {
//     return res.status(404).json({ error: 'Booking not found or already cancelled' });
//   }
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
 * Uses sub-spot and (optionally) vehicleType.
 */
const CreateBooking = z.object({
  subSpotId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  vehicleType: z.enum(['normal', 'large', 'other']).optional(),
  comment: z.string().max(1000).optional().nullable(),
}).refine(v => new Date(v.endTime) > new Date(v.startTime), {
  message: 'End must be after start',
});

bookingsRouter.post('/', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = CreateBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subSpotId, startTime, endTime, comment, vehicleType } = parsed.data;

  try {
    await db.execute(raw`
      INSERT INTO bookings (user_id, sub_spot_id, time_range, comment, vehicle_type, status)
      VALUES (
        ${userId}::uuid,
        ${subSpotId}::uuid,
        tstzrange(${startTime}::timestamptz, ${endTime}::timestamptz, '[)'),
        ${comment ?? null},
        ${vehicleType ?? 'normal'},
        'active'
      )
    `);
    res.json({ ok: true });
  } catch (e: any) {
    // 23P01 = EXCLUDE constraint violation (overlap)
    if (String(e?.code) === '23P01') return res.status(409).json({ error: 'Sub-spot already booked in this interval' });
    console.error(e);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * START an open-ended booking now (meter starts running).
 * Accepts vehicleType (普通/大型/その他).
 */
const StartBooking = z.object({
  subSpotId: z.string().uuid(),
  vehicleType: z.enum(['normal', 'large', 'other']).optional(),
  comment: z.string().max(1000).optional().nullable(),
});

bookingsRouter.post('/start', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = StartBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subSpotId, comment, vehicleType } = parsed.data;

  try {
    const r = await db.execute(raw`
      INSERT INTO bookings (user_id, sub_spot_id, time_range, comment, vehicle_type, status)
      VALUES (
        ${userId}::uuid,
        ${subSpotId}::uuid,
        tstzrange(NOW(), NULL, '[)'),
        ${comment ?? null},
        ${vehicleType ?? 'normal'},
        'active'
      )
      RETURNING id
    `);
    const bookingId = (r as any)?.rows?.[0]?.id ?? null;
    res.json({ ok: true, bookingId });
  } catch (e: any) {
    if (String(e?.code) === '23P01') return res.status(409).json({ error: 'This sub-spot is already booked' });
    console.error(e);
    res.status(500).json({ error: 'Failed to start booking' });
  }
});

/**
 * END the current user’s active booking for a sub-spot (upper-bound the range to now).
 */
const EndBooking = z.object({
  subSpotId: z.string().uuid(),
});

bookingsRouter.post('/end', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = EndBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subSpotId } = parsed.data;

  const r = await db.execute(raw`
    UPDATE bookings
    SET time_range = tstzrange(lower(time_range), NOW(), '[)'),
        status = 'completed'
    WHERE user_id = ${userId}::uuid
      AND sub_spot_id = ${subSpotId}::uuid
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
 * Joins sub_spots to return sub_spot_code; frontend parses time_range.
 */
bookingsRouter.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  const r = await db.execute(raw`
    SELECT
      b.id,
      b.sub_spot_id,
      ss.code AS sub_spot_code,
      b.time_range,
      b.comment,
      b.vehicle_type,
      b.status,
      b.created_at
    FROM bookings b
    JOIN sub_spots ss ON ss.id = b.sub_spot_id
    WHERE b.user_id = ${userId}::uuid
    ORDER BY lower(b.time_range) DESC, b.created_at DESC
  `);

  res.json({ bookings: (r as any).rows ?? [] });
});

/**
 * Soft-cancel an active booking (optional, keeps history).
 */
bookingsRouter.delete('/:id', authRequired, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const idParam = req.params?.id;

  if (!userId || !idParam) {
    return res.status(400).json({ error: 'Missing user or booking id' });
    }

  const r = await db
    .update(schema.bookings)
    .set({ status: 'cancelled' as const })
    .where(
      and(
        eq(schema.bookings.id, idParam),
        eq(schema.bookings.userId, userId),
        eq(schema.bookings.status, 'active' as const)
      )
    )
    .returning({ id: schema.bookings.id });

  if (!r[0]) {
    return res.status(404).json({ error: 'Booking not found or already cancelled' });
  }
  res.json({ ok: true });
});
