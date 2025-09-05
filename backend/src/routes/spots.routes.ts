// import { Router, type Request, type Response } from 'express';
// import { db, schema } from '../db';
// import { eq, asc, sql } from 'drizzle-orm';
// import { sql as raw } from 'drizzle-orm';
// import z from 'zod';

// export const spotsRouter = Router();

// // spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
// //   const Params = z.object({ subareaId: z.string().uuid() });
// //   const parsed = Params.safeParse(req.params);
// //   if (!parsed.success) {
// //     return res.status(400).json({ error: parsed.error.flatten() });
// //   }
// //   const { subareaId } = parsed.data;

// //   // Ensure subarea exists
// //   const [sa] = await db
// //     .select({ id: schema.subareas.id })
// //     .from(schema.subareas)
// //     .where(eq(schema.subareas.id, subareaId))
// //     .limit(1);

// //   if (!sa) return res.status(404).json({ error: 'Subarea not found' });

// //   // Fetch spots
// //   const spots = await db
// //     .select({
// //       id: schema.spots.id,
// //       subareaId: schema.spots.subareaId,
// //       code: schema.spots.code,
// //       description: schema.spots.description,
// //     })
// //     .from(schema.spots)
// //     .where(eq(schema.spots.subareaId, subareaId))
// //     .orderBy(asc(schema.spots.code));

// //   // Busy now: now() <@ time_range
// //   // (Using raw SQL; keep if your schema uses tstzrange)
// //   const busyRows = await db.execute(
// //     sql`SELECT spot_id FROM ${schema.bookings} WHERE ${schema.bookings.status} = 'active' AND now() <@ ${schema.bookings.timeRange}`
// //   );
// //   const busySet = new Set((busyRows as any).rows.map((r: any) => r.spot_id as string));

// //   res.json({
// //     spots: spots.map(s => ({ ...s, isBusyNow: busySet.has(s.id) })),
// //   });
// // });


// spotsRouter.get('/by-subarea/:subareaId', async (req, res) => {
//   const { subareaId } = req.params;
//   const userId = (req as any).userId as string | undefined; // may be undefined if you didn’t gate this route

//   const [sa] = await db.select({ id: schema.subareas.id }).from(schema.subareas).where(eq(schema.subareas.id, subareaId)).limit(1);
//   if (!sa) return res.status(404).json({ error: 'Subarea not found' });

//   const spots = await db
//     .select({
//       id: schema.spots.id,
//       subareaId: schema.spots.subareaId,
//       code: schema.spots.code,
//       description: schema.spots.description
//     })
//     .from(schema.spots)
//     .where(eq(schema.spots.subareaId, subareaId))
//     .orderBy(asc(schema.spots.code));

//   // Who’s busy now
//   const busyRows = await db.execute(
//     raw`SELECT spot_id, user_id, lower(time_range) AS start_time
//          FROM bookings
//          WHERE status = 'active' AND now() <@ time_range`
//   );

//   const busyBySpot = new Map<string, { user_id: string; start_time: string }>();
//   for (const r of (busyRows as any).rows) {
//     busyBySpot.set(r.spot_id, { user_id: r.user_id, start_time: r.start_time });
//   }

//   res.json({
//     spots: spots.map(s => {
//       const b = busyBySpot.get(s.id);
//       const isBusyNow = Boolean(b);
//       const isMineNow = Boolean(b && userId && b.user_id === userId);
//       return {
//         ...s,
//         isBusyNow,
//         isMineNow,
//         myStartTime: isMineNow ? b!.start_time : null
//       };
//     })
//   });
// });


import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { eq, asc, sql } from 'drizzle-orm';
import { sql as raw } from 'drizzle-orm';
import z from 'zod';
import { verifyJWT } from '../auth';
import { ENV } from '../env';

export const spotsRouter = Router();

/**
 * Return all spots in a subarea + current occupancy and viewer ownership.
 * - isBusyNow: the spot currently has an active booking
 * - isMineNow: the viewer is the one who booked it
 * - myStartTime: lower bound of the active range, only if viewer owns it
 */
spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
  const Params = z.object({ subareaId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // derive viewer id (optional)
  let userId: string | null = null;
  try {
    const token = (req as any).cookies?.[ENV.COOKIE_NAME];
    if (token) userId = verifyJWT(token).sub ?? null;
  } catch { /* not logged in is fine */ }

  const { subareaId } = parsed.data;

  const spots = await db
    .select({
      id: schema.spots.id,
      subareaId: schema.spots.subareaId,
      code: schema.spots.code,
    })
    .from(schema.spots)
    .where(eq(schema.spots.subareaId, subareaId))
    .orderBy(asc(schema.spots.code));

  if (spots.length === 0) return res.json({ spots: [] });

  // Active bookings for these spots right now
  const ids = spots.map(s => s.id);
  const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  const arrayUuid = sql`ARRAY[${idList}]::uuid[]`;

  const active = await db.execute(sql`
  SELECT spot_id, user_id, lower(time_range) AS start_time
  FROM bookings
  WHERE spot_id = ANY(${arrayUuid})
    AND status = 'active'
    AND NOW() <@ time_range
`);
  const busyBySpot = new Map<string, { user_id: string; start_time: string }>();
  for (const row of (active as any).rows ?? []) {
    busyBySpot.set(row.spot_id, { user_id: row.user_id, start_time: row.start_time });
  }

  res.json({
    spots: spots.map(s => {
      const b = busyBySpot.get(s.id);
      const isBusyNow = !!b;
      const isMineNow = !!(b && userId && b.user_id === userId);
      return {
        ...s,
        isBusyNow,
        isMineNow,
        myStartTime: isMineNow ? b!.start_time : null,
      };
    }),
  });
});
