import { Router, type Request, type Response } from 'express';
import { db, schema } from '../db';
import { and, eq, sql } from 'drizzle-orm';
import z from 'zod';

const statsRouter = Router();

/**
 * A booking is "active now" if:
 *   - status = 'active'
 *   - `timeRange @> now()`  (contains current timestamp)
 */
const activeNowCond = and(
    eq(schema.bookings.status, 'active'),
    sql<boolean>`(${schema.bookings.timeRange}) @> now()`
);

/**
 * GET /api/stats/subareas/by-region/:regionId
 * -> { subareaStats: [{ subareaId, total, busy, free }] }
 */
// statsRouter.get('/subareas/by-region/:regionId', async (req: Request, res: Response) => {
//   const { regionId } = req.params;

//   const rows = await db
//     .select({
//       subareaId: schema.subareas.id,
//       total: sql<number>`COUNT(DISTINCT ${schema.subSpots.id})`,
//       busy: sql<number>`COUNT(DISTINCT CASE WHEN ${schema.bookings.id} IS NOT NULL THEN ${schema.subSpots.id} END)`,
//     })
//     .from(schema.subareas)
//     .leftJoin(schema.spots, eq(schema.spots.subareaId, schema.subareas.id))
//     .leftJoin(schema.subSpots, eq(schema.subSpots.spotId, schema.spots.id))
//     .leftJoin(
//       schema.bookings,
//       and(
//         eq(schema.bookings.subSpotId, schema.subSpots.id),
//         activeNowCond
//       )
//     )
//     .where(eq(schema.subareas.regionId, regionId))
//     .groupBy(schema.subareas.id);

//   const subareaStats = rows.map(r => {
//     const total = r.total ?? 0;
//     const busy = r.busy ?? 0;
//     return { subareaId: r.subareaId, total, busy, free: Math.max(0, total - busy) };
//   });

//   res.json({ subareaStats });
// });

const paramsSchema = z.object({
    regionId: z.string().uuid(), // adjust to .string() if your ids aren’t UUIDs
});

statsRouter.get(
    '/subareas/by-region/:regionId',
    async (req: Request, res: Response) => {
        const parsed = paramsSchema.safeParse(req.params);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Invalid regionId' });
        }
        const { regionId } = parsed.data; // <- now a plain string

        const rows = await db
            .select({
                subareaId: schema.subareas.id,
                total: sql<number>`COUNT(DISTINCT ${schema.subSpots.id})`,
                busy: sql<number>`COUNT(DISTINCT CASE WHEN ${schema.bookings.id} IS NOT NULL THEN ${schema.subSpots.id} END)`,
            })
            .from(schema.subareas)
            .leftJoin(schema.spots, eq(schema.spots.subareaId, schema.subareas.id))
            .leftJoin(schema.subSpots, eq(schema.subSpots.spotId, schema.spots.id))
            .leftJoin(
                schema.bookings,
                and(
                    eq(schema.bookings.subSpotId, schema.subSpots.id),
                    // your existing "active now" condition:
                    sql<boolean>`(${schema.bookings.timeRange}) @> now() AND ${schema.bookings.status} = 'active'`
                )
            )
            .where(eq(schema.subareas.regionId, regionId)) // <-- regionId is string
            .groupBy(schema.subareas.id);

        const subareaStats = rows.map(r => {
            const total = r.total ?? 0;
            const busy = r.busy ?? 0;
            return { subareaId: r.subareaId, total, busy, free: Math.max(0, total - busy) };
        });

        res.json({ subareaStats });
    }
);
/**
 * GET /api/stats/regions
 * -> { regionStats: [{ regionId, total, busy, free }] }
 */
statsRouter.get('/regions', async (_req: Request, res: Response) => {
    const rows = await db
        .select({
            regionId: schema.regions.id,
            total: sql<number>`COUNT(DISTINCT ${schema.subSpots.id})`,
            busy: sql<number>`COUNT(DISTINCT CASE WHEN ${schema.bookings.id} IS NOT NULL THEN ${schema.subSpots.id} END)`,
        })
        .from(schema.regions)
        .leftJoin(schema.subareas, eq(schema.subareas.regionId, schema.regions.id))
        .leftJoin(schema.spots, eq(schema.spots.subareaId, schema.subareas.id))
        .leftJoin(schema.subSpots, eq(schema.subSpots.spotId, schema.spots.id))
        .leftJoin(
            schema.bookings,
            and(
                eq(schema.bookings.subSpotId, schema.subSpots.id),
                activeNowCond
            )
        )
        .groupBy(schema.regions.id);

    const regionStats = rows.map(r => {
        const total = r.total ?? 0;
        const busy = r.busy ?? 0;
        return { regionId: r.regionId, total, busy, free: Math.max(0, total - busy) };
    });

    res.json({ regionStats });
});

export default statsRouter;
