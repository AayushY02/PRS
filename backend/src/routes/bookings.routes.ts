



// import { Router, type Request, type Response } from 'express';
// import { z } from 'zod';
// import { db, schema } from '../db';
// import { and, eq } from 'drizzle-orm';
// import { sql as raw } from 'drizzle-orm';
// import { authRequired } from '../middleware/authRequired'; // keeps req.userId
// import { broadcastBooking } from '@/live';

// export const bookingsRouter = Router();

// /**
//  * Create a fixed booking (start/end). Kept for 窶徇anual窶・reservations if you still need it.
//  * Uses sub-spot and (optionally) vehicleType.
//  */
// const CreateBooking = z.object({
//   subSpotId: z.string().uuid(),
//   startTime: z.string().datetime(),
//   endTime: z.string().datetime(),
//   vehicleType: z.enum(['normal', 'large', 'other']).optional(),
//   comment: z.string().max(1000).optional().nullable(),
// }).refine(v => new Date(v.endTime) > new Date(v.startTime), {
//   message: 'End must be after start',
// });

// bookingsRouter.post('/', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = CreateBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { subSpotId, startTime, endTime, comment, vehicleType } = parsed.data;

//   try {
//     await db.execute(raw`
//       INSERT INTO bookings (user_id, sub_spot_id, time_range, comment, vehicle_type, status)
//       VALUES (
//         ${userId}::uuid,
//         ${subSpotId}::uuid,
//         tstzrange(${startTime}::timestamptz, ${endTime}::timestamptz, '[)'),
//         ${comment ?? null},
//         ${vehicleType ?? 'normal'},
//         'active'
//       )
//     `);
//     res.json({ ok: true });
//   } catch (e: any) {
//     // 23P01 = EXCLUDE constraint violation (overlap)
//     if (String(e?.code) === '23P01') return res.status(409).json({ error: 'Sub-spot already booked in this interval' });
//     console.error(e);
//     res.status(500).json({ error: 'Failed to create booking' });
//   }
// });

// /**
//  * START an open-ended booking now (meter starts running).
//  * Accepts vehicleType (譎ｮ騾・螟ｧ蝙・縺昴・莉・.
//  */
// const StartBooking = z.object({
//   subSpotId: z.string().uuid(),
//   vehicleType: z.enum(['normal', 'large', 'other']).optional(),
//   comment: z.string().max(1000).optional().nullable(),
// });

// bookingsRouter.post('/start', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = StartBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { subSpotId, comment, vehicleType } = parsed.data;

//   try {
//     const r = await db.execute(raw`
//       INSERT INTO bookings (user_id, sub_spot_id, time_range, comment, vehicle_type, status)
//       VALUES (
//         ${userId}::uuid,
//         ${subSpotId}::uuid,
//         tstzrange(NOW(), NULL, '[)'),
//         ${comment ?? null},
//         ${vehicleType ?? 'normal'},
//         'active'
//       )
//       RETURNING id
//     `);
//     const bookingId = (r as any)?.rows?.[0]?.id ?? null;
//     res.json({ ok: true, bookingId });

//     broadcastBooking('start', { subSpotId, userId, startTime: new Date().toISOString() });
//     res.json({ ok: true, bookingId });

//   } catch (e: any) {
//     if (String(e?.code) === '23P01') return res.status(409).json({ error: 'This sub-spot is already booked' });
//     console.error(e);
//     res.status(500).json({ error: 'Failed to start booking' });
//   }
// });

// /**
//  * END the current user窶冱 active booking for a sub-spot (upper-bound the range to now).
//  */
// const EndBooking = z.object({
//   subSpotId: z.string().uuid(),
// });

// bookingsRouter.post('/end', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;
//   const parsed = EndBooking.safeParse(req.body);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   const { subSpotId } = parsed.data;

//   const r = await db.execute(raw`
//     UPDATE bookings
//     SET time_range = tstzrange(lower(time_range), NOW(), '[)'),
//         status = 'completed'
//     WHERE user_id = ${userId}::uuid
//       AND sub_spot_id = ${subSpotId}::uuid
//       AND status = 'active'
//       AND NOW() <@ time_range
//     RETURNING id
//   `);

//   if ((r as any).rows?.length === 0) {
//     return res.status(404).json({ error: 'No active booking to end' });
//   }

//   broadcastBooking('end', { subSpotId, userId });
//   res.json({ ok: true });
// });

// /**
//  * List your bookings (active + past).
//  * Joins sub_spots to return sub_spot_code; frontend parses time_range.
//  */
// bookingsRouter.get('/mine', authRequired, async (req: Request, res: Response) => {
//   const userId = (req as any).userId as string;

//   const r = await db.execute(raw`
//     SELECT
//       b.id,
//       b.sub_spot_id,
//       ss.code AS sub_spot_code,
//       b.time_range,
//       b.comment,
//       b.vehicle_type,
//       b.status,
//       b.created_at
//     FROM bookings b
//     JOIN sub_spots ss ON ss.id = b.sub_spot_id
//     WHERE b.user_id = ${userId}::uuid
//     ORDER BY lower(b.time_range) DESC, b.created_at DESC
//   `);

//   res.json({ bookings: (r as any).rows ?? [] });
// });

// /**
//  * Soft-cancel an active booking (optional, keeps history).
//  */
// bookingsRouter.delete('/:id', authRequired, async (req, res) => {
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
//         eq(schema.bookings.id, idParam),
//         eq(schema.bookings.userId, userId),
//         eq(schema.bookings.status, 'active' as const)
//       )
//     )
//     .returning({ id: schema.bookings.id });

//   if (!r[0]) {
//     return res.status(404).json({ error: 'Booking not found or already cancelled' });
//   }
//   res.json({ ok: true });
// });


// backend/src/routes/bookings.ts
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db, schema } from '../db';
import { and, eq, sql } from 'drizzle-orm';
import { sql as raw } from 'drizzle-orm';
import { authRequired } from '../middleware/authRequired'; // keeps req.userId
import { broadcastBooking } from '../live';
import { currentTokyoTimestamp, formatBookingEnd, formatDateTimeISO, japaneseVehicleType, sanitizeForFilename, toCsvBuffer, toXlsxBuffer } from '../utils/exporters';

export const bookingsRouter = Router();

/**
 * Create a fixed booking (start/end). Kept for 窶徇anual窶・reservations if you still need it.
 * Uses sub-spot and (optionally) vehicleType.
 */
const CreateBooking = z.object({
  subSpotId: z.string().uuid(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  vehicleType: z.enum(['normal', 'large', 'other']).optional(),
  comment: z.string().max(1000).optional().nullable(),
  direction: z.enum(['north', 'south']),
}).refine(v => new Date(v.endTime) > new Date(v.startTime), {
  message: 'End must be after start',
});

bookingsRouter.post('/', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = CreateBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subSpotId, startTime, endTime, comment, vehicleType, direction } = parsed.data;

  try {
    const r = await db.execute(raw`
      INSERT INTO bookings (user_id, sub_spot_id, time_range, comment ,vehicle_type, direction, status)
      VALUES (
        ${userId}::uuid,
        ${subSpotId}::uuid,
        tstzrange(${startTime}::timestamptz, ${endTime}::timestamptz, '[)'),
        ${comment ?? null},
        ${vehicleType ?? 'normal'},
         ${direction}::direction,
        'active'
      )
      RETURNING id, (NOW() <@ time_range) AS active_now, lower(time_range) AS start_time
    `);

    const row = (r as any)?.rows?.[0];
    // Broadcast only if this fixed booking is active right now
    if (row?.active_now) {
      broadcastBooking('start', {
        subSpotId,
        userId,
        startTime: row.start_time ?? new Date().toISOString(),
      });
    }

    res.json({ ok: true, bookingId: row?.id ?? null });
  } catch (e: any) {
    // 23P01 = EXCLUDE constraint violation (overlap)
    if (String(e?.code) === '23P01') {
      return res.status(409).json({ error: 'Sub-spot already booked in this interval' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

/**
 * START an open-ended booking now (meter starts running).
 * Accepts vehicleType (譎ｮ騾・螟ｧ蝙・縺昴・莉・.
 */
const StartBooking = z.object({
  subSpotId: z.string().uuid(),
  vehicleType: z.enum(['normal', 'large', 'other']).optional(),
  comment: z.string().max(1000).optional().nullable(),
  direction: z.enum(['north', 'south']),

});

bookingsRouter.post('/start', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = StartBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subSpotId, comment, vehicleType, direction } = parsed.data;

  try {
    const r = await db.execute(raw`
      INSERT INTO bookings (user_id, sub_spot_id, time_range, comment, vehicle_type, direction, status)
      VALUES (
        ${userId}::uuid,
        ${subSpotId}::uuid,
        tstzrange(NOW(), NULL, '[)'),
        ${comment ?? null},
        ${vehicleType ?? 'normal'},
        ${direction}::direction,
        'active'
      )
      RETURNING id, lower(time_range) AS start_time
    `);
    const row = (r as any)?.rows?.[0];
    const bookingId = row?.id ?? null;

    // Notify all listeners immediately
    broadcastBooking('start', {
      subSpotId,
      userId,
      startTime: row?.start_time ?? new Date().toISOString(),
    });

    res.json({ ok: true, bookingId });
  } catch (e: any) {
    if (String(e?.code) === '23P01') {
      return res.status(409).json({ error: 'This sub-spot is already booked' });
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to start booking' });
  }
});

/**
 * END the current user窶冱 active booking for a sub-spot (upper-bound the range to now).
 */
const EndBooking = z.object({
  subSpotId: z.string().uuid(),
});

bookingsRouter.post('/end', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const parsed = EndBooking.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subSpotId } = parsed.data;

  try {
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

    // Notify all listeners immediately
    broadcastBooking('end', { subSpotId, userId });

    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Failed to end booking' });
  }
});

/**
 * List your bookings (active + past).
 * Joins sub_spots to return sub_spot_code; frontend parses time_range.
 */
bookingsRouter.get('/mine', authRequired, async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;

  try {
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
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * Soft-cancel an active booking (optional, keeps history).
 * Treat this like an "end" for live updates.
 */
bookingsRouter.delete('/:id', authRequired, async (req, res) => {
  const userId = (req as any).userId as string | undefined;
  const idParam = req.params?.id;

  if (!userId || !idParam) {
    return res.status(400).json({ error: 'Missing user or booking id' });
  }

  try {
    // Only cancel active bookings owned by the user; return sub_spot_id for broadcast
    const r = await db
      .update(schema.bookings)
      .set({ status: 'cancelled' as const, timeRange: raw`tstzrange(lower(time_range), NOW(), '[)')` as any })
      .where(
        and(
          eq(schema.bookings.id, idParam),
          eq(schema.bookings.userId, userId),
          eq(schema.bookings.status, 'active' as const)
        )
      )
      .returning({
        id: schema.bookings.id,
        subSpotId: schema.bookings.subSpotId,
      });

    const row = r[0];
    if (!row) {
      return res.status(404).json({ error: 'Booking not found or already cancelled' });
    }

    // Notify all listeners immediately
    broadcastBooking('end', { subSpotId: row.subSpotId, userId: userId! });

    res.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});
const CIRCLED_DIGITS = [
  '\u2460', '\u2461', '\u2462', '\u2463', '\u2464',
  '\u2465', '\u2466', '\u2467', '\u2468', '\u2469',
  '\u246A', '\u246B', '\u246C', '\u246D', '\u246E',
  '\u246F', '\u2470', '\u2471', '\u2472', '\u2473'
];

const toCircledNumber = (n: number): string => {
  const value = n >= 1 && n <= CIRCLED_DIGITS.length ? CIRCLED_DIGITS[n - 1] : undefined;
  return value ?? `(${n})`;
};

const parseRegionOrdinalFromCode = (code: string | null): number => {
  if (!code) return 1;
  const matches = code.match(/\d+/g);
  if (matches && matches.length > 0) {
    const last = matches[matches.length - 1];
    if (typeof last === 'string' && last.length > 0) {
      const parsed = parseInt(last, 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return 1;
};

const japaneseDirection = (d: string | null | undefined): string => {
  if (d === 'north') return '北側方向';
  if (d === 'south') return '南側方向';
  return '';
};

const formatSpotLabel = (regionCode: string | null, spotOrder: number | null): string => {
  const regionOrdinal = parseRegionOrdinalFromCode(regionCode);
  const circle = toCircledNumber(regionOrdinal);
  const spotNumber = spotOrder && spotOrder > 0 ? spotOrder : 1;
  return `スポット${circle}-${spotNumber}`;
};

const formatSubSpotLabel = (regionCode: string | null, spotOrder: number | null, subspotOrder: number | null): string => {
  const spotLabel = formatSpotLabel(regionCode, spotOrder);
  const order = subspotOrder && subspotOrder > 0 ? subspotOrder : 1;
  return `${spotLabel}（${order}台目）`;
};

// const BOOKING_EXPORT_HEADERS = ['ID', '\u30b9\u30dd\u30c3\u30c8\u756a\u53f7', '\u958b\u59cb\u6642\u523b', '\u7d42\u4e86\u6642\u523b', '\u8eca\u7a2e', '\u30e1\u30e2'];
const BOOKING_EXPORT_HEADERS = [
  'ID',
  '\u30b9\u30dd\u30c3\u30c8\u756a\u53f7', // スポット番号
  '\u958b\u59cb\u6642\u523b',             // 開始時刻
  '\u7d42\u4e86\u6642\u523b',             // 終了時刻
  '\u8eca\u7a2e',                         // 車種
  '\u99d0\u8eca\u65b9\u5411',             // 駐車方向  ← NEW
  '\u30e1\u30e2',                         // メモ
];

type BookingExportScope = 'all' | 'active' | 'completed' | 'user-all' | 'user-active' | 'spot';

const BookingExportQuery = z.object({
  scope: z.enum(['all', 'active', 'completed', 'user-all', 'user-active', 'spot']).default('all'),
  format: z.enum(['csv', 'xlsx']).default('csv'),
  userId: z.string().uuid().optional(),
  spotId: z.string().uuid().optional(),
});

const BOOKING_FILENAME_BASE: Record<BookingExportScope, string> = {
  all: '\u4e88\u7d04_\u5168\u4ef6',
  active: '\u4e88\u7d04_\u9032\u884c\u4e2d',
  completed: '\u4e88\u7d04_\u5b8c\u4e86',
  'user-all': '\u4e88\u7d04_\u5229\u7528\u8005\u5225',
  'user-active': '\u4e88\u7d04_\u5229\u7528\u8005\u5225_\u9032\u884c\u4e2d',
  spot: '\u4e88\u7d04_\u30b9\u30dd\u30c3\u30c8\u5225',
};

async function fetchBookingExportRows(scope: BookingExportScope, userId?: string, spotId?: string) {
  const filters: Array<ReturnType<typeof sql>> = [];

  if (scope === 'active' || scope === 'user-active') {
    filters.push(sql`b.status = 'active'`);
    filters.push(sql`NOW() <@ b.time_range`);
  }

  if (scope === 'completed') {
    filters.push(sql`b.status = 'completed'`);
  }

  if (scope === 'user-all' || scope === 'user-active') {
    filters.push(sql`b.user_id = ${userId}`);
  }

  if (scope === 'spot') {
    filters.push(sql`s.id = ${spotId}`);
  }

  if (scope === 'all' || scope === 'spot' || scope === 'user-all') {
    filters.push(sql`b.status != 'cancelled'`);
  }

  const whereSql = filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``;

  const query = sql`
    SELECT
      b.id,
      ss.code AS sub_spot_code,
      s.code AS spot_code,
      LOWER(b.time_range) AS start_time,
      UPPER(b.time_range) AS end_time,
      b.vehicle_type,
      b.direction,   
      COALESCE(b.comment, '') AS memo,
      u.email AS user_email,
      r.code AS region_code,
      ROW_NUMBER() OVER (PARTITION BY sa.region_id ORDER BY s.code) AS spot_order,
      ROW_NUMBER() OVER (PARTITION BY ss.spot_id ORDER BY ss.idx, ss.code) AS subspot_order
    FROM bookings b
    INNER JOIN sub_spots ss ON ss.id = b.sub_spot_id
    INNER JOIN spots s ON s.id = ss.spot_id
    INNER JOIN subareas sa ON sa.id = s.subarea_id
    INNER JOIN regions r ON r.id = sa.region_id
    INNER JOIN users u ON u.id = b.user_id
    ${whereSql}
    ORDER BY LOWER(b.time_range) DESC NULLS LAST, b.created_at DESC;
  `;

  const result = await db.execute(query);
  return (result as any).rows as Array<{
    id: string;
    sub_spot_code: string;
    spot_code: string | null;
    start_time: string | null;
    end_time: string | null;
    vehicle_type: string | null;
    direction: 'north' | 'south';
    memo: string | null;
    user_email: string | null;
    region_code: string | null;
    spot_order: number | string | null;
    subspot_order: number | string | null;
  }>;
}

bookingsRouter.get('/export', authRequired, async (req: Request, res: Response) => {
  const parsed = BookingExportQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { scope, format, userId, spotId } = parsed.data;

  if ((scope === 'user-all' || scope === 'user-active') && !userId) {
    return res.status(400).json({ error: '\u30e6\u30fc\u30b6\u30fcID\u304c\u5fc5\u8981\u3067\u3059\u3002' });
  }

  if (scope === 'spot' && !spotId) {
    return res.status(400).json({ error: '\u30b9\u30dd\u30c3\u30c8ID\u304c\u5fc5\u8981\u3067\u3059\u3002' });
  }

  let userLabel: string | null = null;
  let spotLabel: string | null = null;

  if (userId) {
    const userRows = await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    const userRecord = userRows[0];
    if (!userRecord) {
      return res.status(404).json({ error: '\u6307\u5b9a\u3055\u308c\u305f\u30e6\u30fc\u30b6\u30fc\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002' });
    }
    const userValue = userRecord.email ?? userId ?? null;
    userLabel = userValue === null || userValue === '' ? null : userValue;
  }

  if (spotId) {
    const spotRows = await db
      .select({ code: schema.spots.code })
      .from(schema.spots)
      .where(eq(schema.spots.id, spotId))
      .limit(1);
    const spotRecord = spotRows[0];
    if (!spotRecord) {
      return res.status(404).json({ error: '\u6307\u5b9a\u3055\u308c\u305f\u30b9\u30dd\u30c3\u30c8\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002' });
    }
    const spotValue = spotRecord.code ?? spotId ?? null;
    spotLabel = spotValue === null || spotValue === '' ? null : spotValue;
  }

  const bookings = await fetchBookingExportRows(scope, userId, spotId);

  const tableRows = bookings.map((row) => {
    const spotOrder = typeof row.spot_order === 'number' ? row.spot_order : Number(row.spot_order ?? 0);
    const subspotOrder = typeof row.subspot_order === 'number' ? row.subspot_order : Number(row.subspot_order ?? 0);
    const subSpotDisplay = formatSubSpotLabel(row.region_code ?? null, spotOrder, subspotOrder);
    return [
      row.id,
      subSpotDisplay,
      formatDateTimeISO(row.start_time, ''),
      formatBookingEnd(row.end_time),
      japaneseVehicleType(row.vehicle_type),
      japaneseDirection(row.direction),
      row.memo ?? '',

    ];
  });

  let fileBase = BOOKING_FILENAME_BASE[scope];
  if (typeof userLabel === 'string') {
    const leadingBase = userLabel.includes('@') ? userLabel.split('@')[0] : userLabel;
    const leading = leadingBase ?? '';
    fileBase += `_${sanitizeForFilename(leading)}`;
  }
  if (typeof spotLabel === 'string') {
    const spotSafe = spotLabel ?? '';
    fileBase += `_${sanitizeForFilename(spotSafe)}`;
  }

  const timestamp = currentTokyoTimestamp();
  const extension = format === 'xlsx' ? 'xlsx' : 'csv';
  const filename = `${fileBase}_${timestamp}.${extension}`;

  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  );

  if (format === 'xlsx') {
    const buffer = await toXlsxBuffer('\u4e88\u7d04\u4e00\u89a7', BOOKING_EXPORT_HEADERS, tableRows);
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } else {
    const buffer = toCsvBuffer(BOOKING_EXPORT_HEADERS, tableRows);
    res.type('text/csv; charset=utf-8');
    res.send(buffer);
  }
});



