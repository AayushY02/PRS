// // import { Router, type Request, type Response } from 'express';
// // import { db, schema } from '../db';
// // import { eq, asc, sql } from 'drizzle-orm';
// // import { sql as raw } from 'drizzle-orm';
// // import z from 'zod';

// // export const spotsRouter = Router();

// // // spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
// // //   const Params = z.object({ subareaId: z.string().uuid() });
// // //   const parsed = Params.safeParse(req.params);
// // //   if (!parsed.success) {
// // //     return res.status(400).json({ error: parsed.error.flatten() });
// // //   }
// // //   const { subareaId } = parsed.data;

// // //   // Ensure subarea exists
// // //   const [sa] = await db
// // //     .select({ id: schema.subareas.id })
// // //     .from(schema.subareas)
// // //     .where(eq(schema.subareas.id, subareaId))
// // //     .limit(1);

// // //   if (!sa) return res.status(404).json({ error: 'Subarea not found' });

// // //   // Fetch spots
// // //   const spots = await db
// // //     .select({
// // //       id: schema.spots.id,
// // //       subareaId: schema.spots.subareaId,
// // //       code: schema.spots.code,
// // //       description: schema.spots.description,
// // //     })
// // //     .from(schema.spots)
// // //     .where(eq(schema.spots.subareaId, subareaId))
// // //     .orderBy(asc(schema.spots.code));

// // //   // Busy now: now() <@ time_range
// // //   // (Using raw SQL; keep if your schema uses tstzrange)
// // //   const busyRows = await db.execute(
// // //     sql`SELECT spot_id FROM ${schema.bookings} WHERE ${schema.bookings.status} = 'active' AND now() <@ ${schema.bookings.timeRange}`
// // //   );
// // //   const busySet = new Set((busyRows as any).rows.map((r: any) => r.spot_id as string));

// // //   res.json({
// // //     spots: spots.map(s => ({ ...s, isBusyNow: busySet.has(s.id) })),
// // //   });
// // // });


// // spotsRouter.get('/by-subarea/:subareaId', async (req, res) => {
// //   const { subareaId } = req.params;
// //   const userId = (req as any).userId as string | undefined; // may be undefined if you didn’t gate this route

// //   const [sa] = await db.select({ id: schema.subareas.id }).from(schema.subareas).where(eq(schema.subareas.id, subareaId)).limit(1);
// //   if (!sa) return res.status(404).json({ error: 'Subarea not found' });

// //   const spots = await db
// //     .select({
// //       id: schema.spots.id,
// //       subareaId: schema.spots.subareaId,
// //       code: schema.spots.code,
// //       description: schema.spots.description
// //     })
// //     .from(schema.spots)
// //     .where(eq(schema.spots.subareaId, subareaId))
// //     .orderBy(asc(schema.spots.code));

// //   // Who’s busy now
// //   const busyRows = await db.execute(
// //     raw`SELECT spot_id, user_id, lower(time_range) AS start_time
// //          FROM bookings
// //          WHERE status = 'active' AND now() <@ time_range`
// //   );

// //   const busyBySpot = new Map<string, { user_id: string; start_time: string }>();
// //   for (const r of (busyRows as any).rows) {
// //     busyBySpot.set(r.spot_id, { user_id: r.user_id, start_time: r.start_time });
// //   }

// //   res.json({
// //     spots: spots.map(s => {
// //       const b = busyBySpot.get(s.id);
// //       const isBusyNow = Boolean(b);
// //       const isMineNow = Boolean(b && userId && b.user_id === userId);
// //       return {
// //         ...s,
// //         isBusyNow,
// //         isMineNow,
// //         myStartTime: isMineNow ? b!.start_time : null
// //       };
// //     })
// //   });
// // });


// import { Router, type Request, type Response } from 'express';
// import { db, schema } from '../db';
// import { eq, asc, sql } from 'drizzle-orm';
// import { sql as raw } from 'drizzle-orm';
// import z from 'zod';
// import { verifyJWT } from '../auth';
// import { ENV } from '../env';

// export const spotsRouter = Router();

// /**
//  * Return all spots in a subarea + current occupancy and viewer ownership.
//  * - isBusyNow: the spot currently has an active booking
//  * - isMineNow: the viewer is the one who booked it
//  * - myStartTime: lower bound of the active range, only if viewer owns it
//  */
// spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
//   const Params = z.object({ subareaId: z.string().uuid() });
//   const parsed = Params.safeParse(req.params);
//   if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

//   // derive viewer id (optional)
//   let userId: string | null = null;
//   try {
//     const token = (req as any).cookies?.[ENV.COOKIE_NAME];
//     if (token) userId = verifyJWT(token).sub ?? null;
//   } catch { /* not logged in is fine */ }

//   const { subareaId } = parsed.data;

//   const spots = await db
//     .select({
//       id: schema.spots.id,
//       subareaId: schema.spots.subareaId,
//       code: schema.spots.code,
//     })
//     .from(schema.spots)
//     .where(eq(schema.spots.subareaId, subareaId))
//     .orderBy(asc(schema.spots.code));

//   if (spots.length === 0) return res.json({ spots: [] });

//   // Active bookings for these spots right now
//   const ids = spots.map(s => s.id);
//   const idList = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
//   const arrayUuid = sql`ARRAY[${idList}]::uuid[]`;

//   const active = await db.execute(sql`
//   SELECT spot_id, user_id, lower(time_range) AS start_time
//   FROM bookings
//   WHERE spot_id = ANY(${arrayUuid})
//     AND status = 'active'
//     AND NOW() <@ time_range
// `);
//   const busyBySpot = new Map<string, { user_id: string; start_time: string }>();
//   for (const row of (active as any).rows ?? []) {
//     busyBySpot.set(row.spot_id, { user_id: row.user_id, start_time: row.start_time });
//   }

//   res.json({
//     spots: spots.map(s => {
//       const b = busyBySpot.get(s.id);
//       const isBusyNow = !!b;
//       const isMineNow = !!(b && userId && b.user_id === userId);
//       return {
//         ...s,
//         isBusyNow,
//         isMineNow,
//         myStartTime: isMineNow ? b!.start_time : null,
//       };
//     }),
//   });
// });

import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { eq, asc, sql } from 'drizzle-orm';
import z from 'zod';
import { verifyJWT } from '../auth';
import { ENV } from '../env';

export const spotsRouter = Router();

/**
 * GET /api/spots/by-subarea/:subareaId
 * Returns: [{ id, subareaId, code, subSpots: [{ id, code, idx, isBusyNow, isMineNow, myStartTime }] }]
 */
spotsRouter.get('/by-subarea/:subareaId', async (req: Request, res: Response) => {
  const Params = z.object({ subareaId: z.string().uuid() });
  const parsed = Params.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { subareaId } = parsed.data;

  // optional viewer id from cookie (not required)
  let userId: string | null = null;
  try {
    const token = (req as any).cookies?.[ENV.COOKIE_NAME];
    if (token) userId = verifyJWT(token).sub ?? null;
  } catch { /* unauthenticated is fine */ }

  // 1) ensure subarea exists
  const [sa] = await db
    .select({ id: schema.subareas.id })
    .from(schema.subareas)
    .where(eq(schema.subareas.id, subareaId))
    .limit(1);

  if (!sa) return res.status(404).json({ error: 'Subarea not found' });

  // 2) fetch parent spots under subarea
  const parentSpots = await db
    .select({
      id: schema.spots.id,
      subareaId: schema.spots.subareaId,
      code: schema.spots.code,
    })
    .from(schema.spots)
    .where(eq(schema.spots.subareaId, subareaId))
    .orderBy(asc(schema.spots.code));

  if (parentSpots.length === 0) return res.json({ spots: [] });

  const parentIds = parentSpots.map((p) => p.id);

  // 3) fetch all sub-spots for these parents (build IN (...) via sql.join)
  const parentIdList = sql.join(parentIds.map((id) => sql`${id}::uuid`), sql`, `);
  const subSpotsRows = await db.execute(sql`
    SELECT ss.id, ss.spot_id, ss.code, ss.idx
    FROM sub_spots ss
    WHERE ss.spot_id IN (${parentIdList})
    ORDER BY ss.idx ASC, ss.code ASC
  `);

  const subSpotsByParent = new Map<string, Array<{ id: string; code: string; idx: number }>>();
  const subSpotIds: string[] = [];
  for (const r of (subSpotsRows as any).rows ?? []) {
    subSpotIds.push(r.id);
    const arr = subSpotsByParent.get(r.spot_id) ?? [];
    arr.push({ id: r.id, code: r.code, idx: r.idx });
    subSpotsByParent.set(r.spot_id, arr);
  }

  if (subSpotIds.length === 0) {
    return res.json({
      spots: parentSpots.map((p) => ({ ...p, subSpots: [] })),
    });
  }

  // 4) active bookings per sub-spot right now (also with IN (...) via sql.join)
  const subSpotIdList = sql.join(subSpotIds.map((id) => sql`${id}::uuid`), sql`, `);
  const activeRows = await db.execute(sql`
    SELECT b.sub_spot_id, b.user_id, lower(b.time_range) AS start_time
    FROM bookings b
    WHERE b.sub_spot_id IN (${subSpotIdList})
      AND b.status = 'active'
      AND NOW() <@ b.time_range
  `);

  const activeBySub = new Map<string, { user_id: string; start_time: string }>();
  for (const r of (activeRows as any).rows ?? []) {
    activeBySub.set(r.sub_spot_id, { user_id: r.user_id, start_time: r.start_time });
  }

  // 5) shape response: parent -> [subSpots with live state]
  const result = parentSpots.map((p) => {
    const subs = subSpotsByParent.get(p.id) ?? [];
    const withState = subs.map((s) => {
      const a = activeBySub.get(s.id);
      const isBusyNow = !!a;
      const isMineNow = !!(a && userId && a.user_id === userId);
      return {
        id: s.id,
        code: s.code,
        idx: s.idx,
        isBusyNow,
        isMineNow,
        myStartTime: isMineNow ? a!.start_time : null,
      };
    });
    return {
      id: p.id,
      subareaId: p.subareaId,
      code: p.code,
      subSpots: withState,
    };
  });

  res.json({ spots: result });
});
