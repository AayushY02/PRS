// /* eslint-disable no-console */
// import 'dotenv/config';
// import fs from 'node:fs';
// import path from 'node:path';

// import { db, schema } from '../src/db';
// import { asc, eq, sql } from 'drizzle-orm';

// // Turf funcs
// import { lineString, point, polygon } from '@turf/helpers';
// import along from '@turf/along';
// import destination from '@turf/destination';
// import bearing from '@turf/bearing';
// import length from '@turf/length';

// // Types from geojson
// import type { Feature, FeatureCollection, LineString, MultiLineString, Polygon, Position } from 'geojson';

// /* ------------------------------------------------
//    Config
// ------------------------------------------------- */
// const REGION_CODES = ['kukan-01', 'kukan-02', 'kukan-06', 'kukan-07'] as const;
// type RegionCode = (typeof REGION_CODES)[number];

// const KASHIWA: [number, number] = [139.9698, 35.8617];

// // sizes (meters)
// const SPOT_SIZE_M = 50;               // ← exact 50 m (square)
// const SUBSPOT_GRID = { cols: 2, rows: 2 }; // 2×2 = 4 sub-spots
// const REGION_BAND_WIDTH_M = 20;       // optional: region "corridor" band

// // spacing margin so 50m boxes don’t hang off the ends
// const END_MARGIN_M = SPOT_SIZE_M / 2;

// // When computing local direction, sample ±delta along the line (km)
// const BEARING_SAMPLE_DELTA_KM = 0.010; // 10 m

// /* ------------------------------------------------
//    Optional: load centerlines from a local GeoJSON
//    (falls back to DB centerline or synthetic)
// ------------------------------------------------- */
// type LSByCode = Map<string, Feature<LineString>>;

// function findCenterlinesFile(): string | null {
//   const candidates = [
//     path.resolve(process.cwd(), 'data/regions_centerlines.geojson'),
//     path.resolve(process.cwd(), 'backend/data/regions_centerlines.geojson'),
//     path.resolve(process.cwd(), 'kashiwa_centerlines.geojson'),
//   ];
//   for (const p of candidates) {
//     if (fs.existsSync(p)) return p;
//   }
//   return null;
// }

// function normalizeToLineString(f: any): Feature<LineString> | null {
//   if (f?.type === 'Feature' && f.geometry?.type === 'LineString') return f as Feature<LineString>;
//   if (f?.type === 'Feature' && f.geometry?.type === 'MultiLineString') {
//     const coords: Position[][] = f.geometry.coordinates || [];
//     let best: Position[] | null = null;
//     let bestKm = -Infinity;
//     for (const c of coords) {
//       if (!Array.isArray(c) || c.length < 2) continue;
//       const ls = lineString(c);
//       const km = length(ls, { units: 'kilometers' });
//       if (km > bestKm) { bestKm = km; best = c; }
//     }
//     return best ? lineString(best) : null;
//   }
//   if (f?.type === 'LineString') return { type: 'Feature', geometry: f, properties: {} } as Feature<LineString>;
//   if (f?.type === 'MultiLineString') {
//     const coords: Position[][] = f.coordinates || [];
//     let best: Position[] | null = null;
//     let bestKm = -Infinity;
//     for (const c of coords) {
//       if (!Array.isArray(c) || c.length < 2) continue;
//       const ls = lineString(c);
//       const km = length(ls, { units: 'kilometers' });
//       if (km > bestKm) { bestKm = km; best = c; }
//     }
//     return best ? lineString(best) : null;
//   }
//   return null;
// }

// function getFeatureCode(props: any): string | null {
//   if (!props) return null;
//   return (
//     props.code ??
//     props.region_code ??
//     props.RegionCode ??
//     props.CODE ??
//     props.name ??
//     props.Name ??
//     null
//   );
// }

// function loadLinesFromFile(): LSByCode | null {
//   const file = findCenterlinesFile();
//   if (!file) {
//     console.log('  (no regions_centerlines.geojson found — using DB/synthetic)');
//     return null;
//   }

//   try {
//     const raw = fs.readFileSync(file, 'utf-8');
//     const fc = JSON.parse(raw) as FeatureCollection;
//     if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
//       console.warn('  ⚠️ Invalid FeatureCollection in file:', path.basename(file));
//       return null;
//     }

//     const map: LSByCode = new Map();
//     for (const feat of fc.features) {
//       const code = getFeatureCode((feat as any).properties);
//       const norm = normalizeToLineString(feat);
//       if (!code || !norm) continue;
//       map.set(String(code), norm);
//     }
//     console.log(`  Loaded ${map.size} region centerlines from: ${path.basename(file)}`);
//     return map.size ? map : null;
//   } catch (e) {
//     console.warn('  ⚠️ Failed to read/parse centerlines:', (e as Error).message);
//     return null;
//   }
// }

// // Synthetic fallback for demos
// function syntheticLineFor(code: RegionCode): Feature<LineString> {
//   const seeds: Record<RegionCode, { bearing: number; dlon: number; dlat: number }> = {
//     'kukan-01': { bearing:  15, dlon:  0.010, dlat:  0.010 },
//     'kukan-02': { bearing:  70, dlon: -0.008, dlat:  0.006 },
//     'kukan-06': { bearing: 125, dlon:  0.004, dlat: -0.010 },
//     'kukan-07': { bearing: 200, dlon: -0.010, dlat: -0.006 },
//   };

//   const s = seeds[code];
//   const start: Position = [KASHIWA[0] + s.dlon, KASHIWA[1] + s.dlat];
//   const km = 1.2;
//   const p1 = destination(point(start), km, s.bearing, { units: 'kilometers' });
//   return lineString([start, p1.geometry.coordinates]);
// }

// /* ------------------------------------------------
//    Geometry helpers
// ------------------------------------------------- */
// const mToKm = (m: number) => m / 1000;

// function lineLenM(line: Feature<LineString>): number {
//   return length(line, { units: 'kilometers' }) * 1000;
// }

// function clamp(n: number, lo: number, hi: number): number {
//   return Math.max(lo, Math.min(hi, n));
// }

// function bearingAt(line: Feature<LineString>, dKm: number): number {
//   const totalKm = length(line, { units: 'kilometers' });
//   if (totalKm === 0) return 0;
//   const delta = Math.min(BEARING_SAMPLE_DELTA_KM, totalKm / 2);
//   const a = along(line, clamp(dKm - delta, 0, totalKm), { units: 'kilometers' });
//   const b = along(line, clamp(dKm + delta, 0, totalKm), { units: 'kilometers' });
//   return bearing(a, b);
// }

// /**
//  * Build an oriented rectangle centered at distance `dM` along `line`,
//  * with length (along line) = `lenM` and width (perpendicular) = `widM`.
//  * Optional lateralOffsetM shifts the center left/right of the line.
//  */
// function rectCenteredAlong(
//   line: Feature<LineString>,
//   dM: number,
//   lenM: number,
//   widM: number,
//   lateralOffsetM = 0
// ): Feature<Polygon> {
//   const dKm = mToKm(dM);
//   const halfLenKm = mToKm(lenM / 2);
//   const halfWidKm = mToKm(widM / 2);

//   const center = along(line, dKm, { units: 'kilometers' });
//   const dir = bearingAt(line, dKm);

//   const leftB  = dir + 90;
//   const rightB = dir - 90;

//   const centerOffset = lateralOffsetM !== 0
//     ? destination(center, mToKm(Math.abs(lateralOffsetM)), lateralOffsetM >= 0 ? leftB : rightB, { units: 'kilometers' })
//     : center;

//   const pBack = destination(centerOffset, halfLenKm, dir + 180, { units: 'kilometers' });
//   const pFwd  = destination(centerOffset, halfLenKm, dir,       { units: 'kilometers' });

//   const pBackL = destination(pBack, halfWidKm, leftB,  { units: 'kilometers' });
//   const pFwdL  = destination(pFwd,  halfWidKm, leftB,  { units: 'kilometers' });
//   const pFwdR  = destination(pFwd,  halfWidKm, rightB, { units: 'kilometers' });
//   const pBackR = destination(pBack, halfWidKm, rightB, { units: 'kilometers' });

//   const ring: Position[] = [
//     pBackR.geometry.coordinates,
//     pBackL.geometry.coordinates,
//     pFwdL.geometry.coordinates,
//     pFwdR.geometry.coordinates,
//     pBackR.geometry.coordinates,
//   ];

//   return polygon([ring], {});
// }

// /** Evenly-spaced center distances (meters) within [margin, L-margin] */
// function positionsEvenlyM(totalLenM: number, n: number, marginM: number): number[] {
//   if (n <= 0) return [];
//   const usable = Math.max(0, totalLenM - 2 * marginM);
//   if (usable <= 0) return Array.from({ length: n }, () => totalLenM / 2);
//   return Array.from({ length: n }, (_v, i) => marginM + (usable * (i + 1)) / (n + 1));
// }

// /** 2×2 split of a parent 50×50 rect by re-centering 4 half-size rects */
// function splitRect2x2(
//   line: Feature<LineString>,
//   centerM: number,
//   parentLenM: number,
//   parentWidM: number,
//   lateralOffsetM = 0
// ): Feature<Polygon>[] {
//   const len2 = parentLenM / 2; // 25
//   const wid2 = parentWidM / 2; // 25
//   const deltas = [
//     { d: -parentLenM / 4, o: +parentWidM / 4 }, // back + left
//     { d: +parentLenM / 4, o: +parentWidM / 4 }, // fwd + left
//     { d: +parentLenM / 4, o: -parentWidM / 4 }, // fwd + right
//     { d: -parentLenM / 4, o: -parentWidM / 4 }, // back + right
//   ];
//   return deltas.map(({ d, o }) => rectCenteredAlong(line, centerM + d, len2, wid2, lateralOffsetM + o));
// }

// /** Rectangle around whole line (optional region band) */
// function rectAroundWholeLine(line: Feature<LineString>, halfWidthKm: number): Feature<Polygon> {
//   const totalKm = length(line, { units: 'kilometers' });
//   // reuse rectCenteredAlong via two ends
//   const start = 0;
//   const end = totalKm;
//   // use the segment wrapper like your previous script did:
//   const a = along(line, start, { units: 'kilometers' });
//   const b = along(line, end,   { units: 'kilometers' });
//   const dir = bearing(a, b);
//   // Build by expanding the segment to a band
//   const leftB  = dir + 90;
//   const rightB = dir - 90;
//   const aL = destination(a, halfWidthKm, leftB,  { units: 'kilometers' });
//   const aR = destination(a, halfWidthKm, rightB, { units: 'kilometers' });
//   const bL = destination(b, halfWidthKm, leftB,  { units: 'kilometers' });
//   const bR = destination(b, halfWidthKm, rightB, { units: 'kilometers' });
//   const ring: Position[] = [
//     aR.geometry.coordinates,
//     aL.geometry.coordinates,
//     bL.geometry.coordinates,
//     bR.geometry.coordinates,
//     aR.geometry.coordinates,
//   ];
//   return polygon([ring], {});
// }

// /* ------------------------------------------------
//    Naming helpers
// ------------------------------------------------- */
// function circled(n: number): string {
//   const map = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
//   return map[n] ?? `(${n})`;
// }
// function circleFromRegionCode(code: string): string {
//   const m = /(\d+)$/.exec(code);
//   if (!m) return '';
//   const n = parseInt(m[1], 10);
//   return circled(Number.isFinite(n) ? n : 0);
// }

// /* ------------------------------------------------
//    Main
// ------------------------------------------------- */
// async function main() {
//   console.log('→ Generating 50m spot & sub-spot polygons (ignoring subareas for layout)…');

//   // Optionally load centerlines from file
//   const fileLines = loadLinesFromFile();

//   // Get the 4 target regions (present in DB)
//   const allRegions = await db
//     .select({
//       id: schema.regions.id,
//       code: schema.regions.code,
//       name: schema.regions.name,
//       centerline: schema.regions.centerline,
//     })
//     .from(schema.regions)
//     .orderBy(asc(schema.regions.code));

//   const allowed = new Set<string>(REGION_CODES as readonly string[]);
//   const regions = allRegions.filter(r => r.code && allowed.has(r.code));
//   if (!regions.length) {
//     console.error('No target regions found. Expecting codes:', REGION_CODES.join(', '));
//     process.exit(1);
//   }

//   for (const region of regions) {
//     const regionCode = region.code as RegionCode;
//     console.log(`\nRegion ${regionCode}:`);

//     const fromFile = fileLines?.get(regionCode);
//     const line: Feature<LineString> =
//       fromFile ??
//       (region.centerline as any /* Feature<LineString> in jsonb? */) ??
//       syntheticLineFor(regionCode);

//     const Lm = lineLenM(line);
//     const circle = circleFromRegionCode(regionCode);

//     // (Optional) also set a slim band polygon for region.geom to help map display
//     try {
//       const regionBand = rectAroundWholeLine(line, mToKm(REGION_BAND_WIDTH_M / 2));
//       await db.update(schema.regions)
//         .set({ centerline: line, geom: regionBand })
//         .where(eq(schema.regions.id, region.id));
//       console.log('  · centerline saved; region band updated');
//     } catch (e) {
//       console.warn('  ⚠️ could not update region geom:', (e as Error).message);
//     }

//     // Find all spots under this region (via subareas), but DO NOT use subareas for geometry.
//     const subareas = await db
//       .select({ id: schema.subareas.id })
//       .from(schema.subareas)
//       .where(eq(schema.subareas.regionId, region.id));

//     if (subareas.length === 0) {
//       console.log('  (no subareas under region — skipping)');
//       continue;
//     }

//     const subareaIds = subareas.map(s => s.id);
//     const spots = await db
//       .select({ id: schema.spots.id, code: schema.spots.code })
//       .from(schema.spots)
//       .where(sql`${schema.spots.subareaId} = ANY(${sql.array(subareaIds, 'uuid')})`)
//       .orderBy(asc(schema.spots.code));

//     const n = spots.length;
//     if (n === 0) {
//       console.log('  (no spots found in DB — skipping)');
//       continue;
//     }

//     // Place N centers evenly along the whole line
//     const centersM = positionsEvenlyM(Lm, n, END_MARGIN_M);

//     // Generate & persist 50×50 m spot polygons + names
//     for (let i = 0; i < n; i++) {
//       const center = centersM[i];
//       const spotPoly = rectCenteredAlong(line, center, SPOT_SIZE_M, SPOT_SIZE_M, /* lateralOffsetM */ 0);

//       const displayName = `スポット${circle}-${i + 1}`;

//       await db.update(schema.spots)
//         .set({
//           geom: spotPoly,
//           // your seed created a description – we’ll use it for the JP label
//           description: displayName,
//         })
//         .where(eq(schema.spots.id, spots[i].id));
//     }
//     console.log(`  · ${n} spot polygons (50m) updated`);

//     // For each spot, split into 4 sub-spots (25m) and persist to sub_spots.geom (idx 1..4)
//     const subSpots = await db
//       .select({ id: schema.subSpots.id, spotId: schema.subSpots.spotId, idx: schema.subSpots.idx })
//       .from(schema.subSpots)
//       .where(sql`${schema.subSpots.spotId} = ANY(${sql.array(spots.map(s => s.id), 'uuid')})`)
//       .orderBy(asc(schema.subSpots.spotId), asc(schema.subSpots.idx));

//     // Create a lookup of (spotId -> its center index)
//     const indexBySpotId = new Map<string, number>();
//     spots.forEach((s, i) => indexBySpotId.set(s.id, i));

//     let updatedSS = 0;
//     for (const row of subSpots) {
//       const i = indexBySpotId.get(row.spotId);
//       if (i === undefined) continue;
//       const center = centersM[i];

//       const quads = splitRect2x2(line, center, SPOT_SIZE_M, SPOT_SIZE_M, /* lateralOffsetM */ 0);
//       const q = quads[(row.idx - 1) % quads.length];

//       await db.update(schema.subSpots)
//         .set({ geom: q })
//         .where(eq(schema.subSpots.id, row.id));

//       updatedSS++;
//       // If your schema has a description/label column for sub_spots, you could also set:
//       // const name = `スポット${circle}-${i + 1}（${row.idx}台目）`;
//       // .set({ geom: q, description: name })
//     }
//     console.log(`  · ${updatedSS} sub-spot polygons (25m) updated`);
//   }

//   console.log('\nDone.');
// }

// main()
//   .then(() => process.exit(0))
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   });
