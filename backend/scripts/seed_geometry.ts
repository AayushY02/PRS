

/* eslint-disable no-console */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { db, schema } from '../src/db';
import { asc, eq } from 'drizzle-orm';

// Turf funcs
import { lineString, point, polygon } from '@turf/helpers';
import along from '@turf/along';
import destination from '@turf/destination';
import bearing from '@turf/bearing';
import length from '@turf/length';

// Types from geojson
import type { Feature, FeatureCollection, LineString, MultiLineString, Polygon, Position } from 'geojson';

// ------------------------------
// Config
// ------------------------------
const REGION_CODES = ['kukan-01', 'kukan-02', 'kukan-06', 'kukan-07'] as const;
type RegionCode = (typeof REGION_CODES)[number];

const REGION_SPOT_COUNTS: Record<RegionCode, number> = {
  'kukan-01': 6,
  'kukan-02': 6,
  'kukan-06': 3,
  'kukan-07': 5,
};

const SUBSPOTS_PER_SPOT = 4;


const KASHIWA: [number, number] = [139.9698, 35.8617];

// sizes (meters)
const SUBAREA_WIDTH_M = 14; // roadside band width for subareas
const SPOT_WIDTH_M    = 8;
const SUBSPOT_WIDTH_M = 5;
const REGION_WIDTH_M  = 20; // ← width used for regions.geom band

// subdivision gaps (km) – optional breathing space
const GAP_SUBAREA_KM  = 0.0;
const GAP_SPOT_KM     = 0.0;
const GAP_SUBSPOT_KM  = 0.0;

// ------------------------------
// Optional: load centerlines from a local GeoJSON file automatically.
// If not found / invalid -> fallback to syntheticLineFor(code)
// ------------------------------
type LSByCode = Map<string, Feature<LineString>>;

function findCenterlinesFile(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'data/kashiwa_centerlines.geojson'),
    path.resolve(process.cwd(), 'backend/data/kashiwa_centerlines.geojson'),
    path.resolve(process.cwd(), 'kashiwa_centerlines.geojson'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function normalizeToLineString(f: any): Feature<LineString> | null {
  if (f?.type === 'Feature' && f.geometry?.type === 'LineString') return f as Feature<LineString>;
  if (f?.type === 'Feature' && f.geometry?.type === 'MultiLineString') {
    const coords: Position[][] = f.geometry.coordinates || [];
    let best: Position[] | null = null;
    let bestKm = -Infinity;
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const ls = lineString(c);
      const km = length(ls, { units: 'kilometers' });
      if (km > bestKm) { bestKm = km; best = c; }
    }
    return best ? lineString(best) : null;
  }
  if (f?.type === 'LineString') return { type: 'Feature', geometry: f, properties: {} } as Feature<LineString>;
  if (f?.type === 'MultiLineString') {
    const coords: Position[][] = f.coordinates || [];
    let best: Position[] | null = null;
    let bestKm = -Infinity;
    for (const c of coords) {
      if (!Array.isArray(c) || c.length < 2) continue;
      const ls = lineString(c);
      const km = length(ls, { units: 'kilometers' });
      if (km > bestKm) { bestKm = km; best = c; }
    }
    return best ? lineString(best) : null;
  }
  return null;
}

function getFeatureCode(props: any): string | null {
  if (!props) return null;
  return (
    props.code ??
    props.region_code ??
    props.RegionCode ??
    props.CODE ??
    props.name ??
    props.Name ??
    null
  );
}

function loadLinesFromFile(): LSByCode | null {
  const file = findCenterlinesFile();
  if (!file) {
    console.log('  (no regions_centerlines.geojson found — using synthetic lines)');
    return null;
  }

  try {
    const raw = fs.readFileSync(file, 'utf-8');
    const fc = JSON.parse(raw) as FeatureCollection;
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
      console.warn('  ⚠️ Invalid FeatureCollection in file:', path.basename(file));
      return null;
    }

    const map: LSByCode = new Map();
    for (const feat of fc.features) {
      const code = getFeatureCode((feat as any).properties);
      const norm = normalizeToLineString(feat);
      if (!code || !norm) continue;
      map.set(String(code), norm);
    }
    console.log(`  Loaded ${map.size} region centerlines from: ${path.basename(file)}`);
    return map.size ? map : null;
  } catch (e) {
    console.warn('  ⚠️ Failed to read/parse regions_centerlines.geojson:', (e as Error).message);
    return null;
  }
}

// If you have a file of real LineStrings, you can load it.
// For now we generate deterministic fake lines in Kashiwa:
function syntheticLineFor(code: RegionCode): Feature<LineString> {
  const seeds: Record<RegionCode, { bearing: number; dlon: number; dlat: number }> = {
    'kukan-01': { bearing: 15,  dlon:  0.010, dlat:  0.010 },
    'kukan-02': { bearing: 70,  dlon: -0.008, dlat:  0.006 },
    'kukan-06': { bearing: 125, dlon:  0.004, dlat: -0.010 },
    'kukan-07': { bearing: 200, dlon: -0.010, dlat: -0.006 },
  };

  const s = seeds[code];
  const start: Position = [KASHIWA[0] + s.dlon, KASHIWA[1] + s.dlat];

  const km = 1.2;
  // ✅ Use point(start) so the type is Feature<Point>
  const p1 = destination(point(start), km, s.bearing, { units: 'kilometers' });

  return lineString([start, p1.geometry.coordinates]);
}

// ------------------------------
// Geometry helpers
// ------------------------------
const mToKm = (m: number) => m / 1000;

/**
 * Build an oriented rectangle around the segment of a line between startKm..endKm,
 * with total width = 2 * halfWidthKm (perpendicular to the line).
 */
function rectAroundLineSegment(
  line: Feature<LineString>,
  startKm: number,
  endKm: number,
  halfWidthKm: number,
  properties: Record<string, any> = {}
): Feature<Polygon> {
  const a = along(line, startKm, { units: 'kilometers' });
  const b = along(line, endKm,   { units: 'kilometers' });

  // direction of the line on this segment
  const dir = bearing(a, b); // degrees

  // perpendicular bearings
  const left  = dir + 90;
  const right = dir - 90;

  // corners around A
  const aL = destination(a, halfWidthKm, left,  { units: 'kilometers' });
  const aR = destination(a, halfWidthKm, right, { units: 'kilometers' });

  // corners around B
  const bL = destination(b, halfWidthKm, left,  { units: 'kilometers' });
  const bR = destination(b, halfWidthKm, right, { units: 'kilometers' });

  const ring: Position[] = [
    aR.geometry.coordinates,
    aL.geometry.coordinates,
    bL.geometry.coordinates,
    bR.geometry.coordinates,
    aR.geometry.coordinates,
  ];

  return polygon([ring], properties);
}

/** Rectangle covering the full line length — for regions.geom */
function rectAroundWholeLine(line: Feature<LineString>, halfWidthKm: number, properties: Record<string, any> = {}): Feature<Polygon> {
  const totalKm = length(line, { units: 'kilometers' });
  return rectAroundLineSegment(line, 0, totalKm, halfWidthKm, properties);
}

/**
 * Split a line length into N equal ranges [startKm,endKm], optionally with gaps between ranges.
 */
function splitRanges(totalKm: number, parts: number, gapKm = 0): Array<[number, number]> {
  if (parts <= 0) return [];
  const usable = Math.max(0, totalKm - gapKm * Math.max(0, parts - 1));
  const seg = usable / parts;
  const out: Array<[number, number]> = [];
  let cursor = 0;
  for (let i = 0; i < parts; i++) {
    const start = cursor;
    const end = start + seg;
    out.push([start, end]);
    cursor = end + gapKm;
  }
  return out;
}

// ------------------------------
// Main seeding
// ------------------------------
async function main() {
  console.log('→ Seeding geometry (JSONB)…');

  // 0) Try to load centerlines from a local file (optional)
  const fileLines = loadLinesFromFile();

  // 1) Regions present in DB, limited to our 4 codes
  const allRegions = await db
    .select({
      id:         schema.regions.id,
      code:       schema.regions.code,
      name:       schema.regions.name,
      centerline: schema.regions.centerline, // ← we’ll keep/update this
    })
    .from(schema.regions)
    .orderBy(asc(schema.regions.code));

  const allowed = new Set<string>(REGION_CODES as readonly string[]);
  const regions = allRegions.filter(r => r.code && allowed.has(r.code));

  if (regions.length === 0) {
    console.error('No target regions found. Make sure your DB has the 4 codes:', REGION_CODES.join(', '));
    process.exit(1);
  }

  const halfWRegionKm  = mToKm(REGION_WIDTH_M)  / 2;
  const halfWSub       = mToKm(SUBAREA_WIDTH_M) / 2;
  const halfWSpot      = mToKm(SPOT_WIDTH_M)    / 2;
  const halfWSubSpot   = mToKm(SUBSPOT_WIDTH_M) / 2;

  for (const r of regions) {
    const code = r.code as RegionCode;
    console.log(`
Region ${code}:`);

    const expectedSpotCount = REGION_SPOT_COUNTS[code];
    let spotsSeenInRegion = 0;
    let subSpotsSeenInRegion = 0;

    // 2) Choose centerline: file → existing DB → synthetic fallback
    const fromFile = fileLines?.get(code);
    const line: Feature<LineString> =
      fromFile ??
      (r.centerline as any /* already a Feature<LineString>? */) ??
      syntheticLineFor(code);

    const totalKm = length(line, { units: 'kilometers' });

    // ✅ Upsert centerline AND set region rectangle geom (changed part)
    const regionRect = rectAroundWholeLine(line, halfWRegionKm, {
      type: 'region',
      regionId: r.id,
      regionCode: code,
      regionName: r.name ?? null,
    });
    await db
      .update(schema.regions)
      .set({
        centerline: line,   // store GeoJSON Feature<LineString> in jsonb
        geom: regionRect,   // ← now we actually store a polygon Feature for region
      })
      .where(eq(schema.regions.id, r.id));

    // 3) Subareas under region (UNCHANGED)
    const subareas = await db
      .select({
        id: schema.subareas.id,
        code: schema.subareas.code,
      })
      .from(schema.subareas)
      .where(eq(schema.subareas.regionId, r.id))
      .orderBy(asc(schema.subareas.code));

    if (subareas.length === 0) {
      console.log('  (no subareas)'); 
      continue;
    }

    const subRanges = splitRanges(totalKm, subareas.length, GAP_SUBAREA_KM);

    for (let i = 0; i < subareas.length; i++) {
      const sa = subareas[i];
      const [sKm, eKm] = subRanges[i];
      const saPoly = rectAroundLineSegment(line, sKm, eKm, halfWSub, {
        type: 'subarea',
        regionCode: code,
        subareaId: sa.id,
        subareaCode: sa.code,
      });

      await db
        .update(schema.subareas)
        .set({ geom: saPoly })
        .where(eq(schema.subareas.id, sa.id));

      // 4) Spots inside subarea
      const spots = await db
        .select({ id: schema.spots.id, code: schema.spots.code })
        .from(schema.spots)
        .where(eq(schema.spots.subareaId, sa.id))
        .orderBy(asc(schema.spots.code));

      spotsSeenInRegion += spots.length;

      if (spots.length === 0) continue;

      const spotRanges = splitRanges(eKm - sKm, spots.length, GAP_SPOT_KM);

      for (let j = 0; j < spots.length; j++) {
        const sp = spots[j];
        const [spotStart, spotEnd] = spotRanges[j] ?? spotRanges[spotRanges.length - 1];
        const spStart = sKm + spotStart;
        const spEnd   = sKm + spotEnd;
        const spotIndex = j + 1;
        const spPoly = rectAroundLineSegment(line, spStart, spEnd, halfWSpot, {
          type: 'spot',
          regionCode: code,
          subareaId: sa.id,
          spotId: sp.id,
          spotCode: sp.code,
          spotIndex,
          expectedSubSpots: SUBSPOTS_PER_SPOT,
        });

        await db
          .update(schema.spots)
          .set({ geom: spPoly })
          .where(eq(schema.spots.id, sp.id));

        // 5) Sub-spots inside spot (by idx 1..N)
        const subSpots = await db
          .select({ id: schema.subSpots.id, code: schema.subSpots.code, idx: schema.subSpots.idx })
          .from(schema.subSpots)
          .where(eq(schema.subSpots.spotId, sp.id))
          .orderBy(asc(schema.subSpots.idx));

        subSpotsSeenInRegion += subSpots.length;

        if (subSpots.length !== SUBSPOTS_PER_SPOT) {
          console.warn(
            `    Warning: sub-spot count for spot ${sp.code} in ${code} is ${subSpots.length} (expected ${SUBSPOTS_PER_SPOT})`,
          );
        }

        if (subSpots.length === 0) continue;

        const subSpotRanges = splitRanges(spEnd - spStart, subSpots.length, GAP_SUBSPOT_KM);

        for (let k = 0; k < subSpots.length; k++) {
          const ss = subSpots[k];
          const [subStart, subEnd] = subSpotRanges[k] ?? subSpotRanges[subSpotRanges.length - 1];
          const ssStart = spStart + subStart;
          const ssEnd   = spStart + subEnd;
          const ssPoly = rectAroundLineSegment(line, ssStart, ssEnd, halfWSubSpot, {
            type: 'sub_spot',
            regionCode: code,
            subareaId: sa.id,
            spotId: sp.id,
            spotCode: sp.code,
            subSpotId: ss.id,
            subSpotCode: ss.code,
            subSpotIndex: ss.idx,
          });

          await db
            .update(schema.subSpots)
            .set({ geom: ssPoly })
            .where(eq(schema.subSpots.id, ss.id));
        }
      }
    }

    if (expectedSpotCount !== undefined && spotsSeenInRegion !== expectedSpotCount) {
      console.warn(`  Warning: expected ${expectedSpotCount} spots in ${code} but found ${spotsSeenInRegion}`);
    }

    const expectedMessage = expectedSpotCount !== undefined ? ` (expected ${expectedSpotCount})` : '';
    console.log(`  Geometry updated for ${spotsSeenInRegion} spots${expectedMessage} and ${subSpotsSeenInRegion} sub-spots across ${subareas.length} subareas.`);
  }

  console.log('\nDone.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
