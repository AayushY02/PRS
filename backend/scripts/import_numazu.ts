import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db';

const REGION_CODE = 'numazu';
const REGION_NAME = 'Numazu Corridor';
const GEOJSON_PATH = path.resolve(process.cwd(), 'data/kashiwa_centerlines_2.geojson');
const BUFFER_METERS = 10;   // adjust if you want wider/narrower bands
const SPOT_WIDTH_METERS = 6; // narrower rectangles for spots

type SubareaInput = {
  code: string;
  name: string;
  line: Feature<LineString>;
};

function loadLines(): SubareaInput[] {
  const raw = fs.readFileSync(GEOJSON_PATH, 'utf-8');
  const fc = JSON.parse(raw) as FeatureCollection;
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    throw new Error('Invalid FeatureCollection');
  }
  const rows: SubareaInput[] = [];
  for (const f of fc.features) {
    const ls = turf.getType(f) === 'LineString' ? (f as Feature<LineString>)
      : turf.getType((f as any).geometry) === 'LineString' ? turf.feature((f as any).geometry) as Feature<LineString>
      : null;
    if (!ls) continue;
    const props = (f as any).properties || {};
    const code = String(props.region_code || f.id || props.name || rows.length + 1);
    const name = String(props.name || code);
    rows.push({ code, name, line: ls });
  }
  return rows;
}

function bufferLine(ls: Feature<LineString>, widthMeters: number): Feature<Polygon> {
  const buf = turf.buffer(ls, widthMeters, { units: 'meters' });
  if (buf.geometry.type === 'Polygon') return buf as Feature<Polygon>;
  // fallback: make a thin rectangle around the line
  const coords = (ls.geometry.coordinates || []) as Position[];
  if (coords.length < 2) throw new Error('Line has <2 coords');
  const rect = turf.lineOffset(ls, widthMeters / 2, { units: 'meters' });
  const rect2 = turf.lineOffset(ls, -widthMeters / 2, { units: 'meters' });
  const ring = [...rect.geometry.coordinates, ...rect2.geometry.coordinates.reverse(), rect.geometry.coordinates[0]];
  return turf.polygon([ring]);
}

function splitEvenly(total: number, n: number) {
  const step = total / n;
  const arr: [number, number][] = [];
  for (let i = 0; i < n; i++) arr.push([i * step, (i + 1) * step]);
  return arr;
}

function rectFromLine(line: Feature<LineString>, widthMeters: number): Feature<Polygon> {
  const coords = (line.geometry.coordinates || []) as Position[];
  if (coords.length < 2) {
    return bufferLine(line, widthMeters); // fallback
  }
  const start = turf.point(coords[0]);
  const end = turf.point(coords[coords.length - 1]);
  const brg = turf.bearing(start, end);
  const perp = brg + 90;
  const halfWkm = (widthMeters / 1000) / 2;
  const A = turf.destination(start, halfWkm, perp, { units: 'kilometers' });
  const B = turf.destination(end,   halfWkm, perp, { units: 'kilometers' });
  const C = turf.destination(end,   halfWkm, perp + 180, { units: 'kilometers' });
  const D = turf.destination(start, halfWkm, perp + 180, { units: 'kilometers' });
  const ring = [
    A.geometry.coordinates,
    B.geometry.coordinates,
    C.geometry.coordinates,
    D.geometry.coordinates,
    A.geometry.coordinates,
  ];
  return turf.polygon([ring]);
}

async function main() {
  const subareas = loadLines();
  if (!subareas.length) throw new Error('No lines loaded');

  // buffer to polygons
  const saPolys = subareas.map(sa => ({
    ...sa,
    poly: bufferLine(sa.line, BUFFER_METERS),
  }));

  // region hull
  const hull = (() => {
    const fc = turf.featureCollection(saPolys.map(p => p.poly));
    const h = turf.convex(fc);
    if (h) return h.geometry as any;
    const bbox = turf.bbox(fc);
    return turf.bboxPolygon(bbox).geometry as any;
  })();

  // hard reset old data (sub_spots -> spots -> subareas -> regions)
  await db.delete(schema.subSpots);
  await db.delete(schema.spots);
  await db.delete(schema.subareas);
  await db.delete(schema.regions);

  // upsert region
  const regionRows = await db.insert(schema.regions).values({
    code: REGION_CODE,
    name: REGION_NAME,
    geom: hull as any,
  }).returning({ id: schema.regions.id });
  const regionId = regionRows[0].id;

  // upsert subareas
  const saIdMap = new Map<string, string>();
  for (const sa of saPolys) {
    const rows = await db.insert(schema.subareas).values({
      regionId,
      code: sa.code,
      name: sa.name,
      geom: sa.poly.geometry as any,
    }).returning({ id: schema.subareas.id });
    saIdMap.set(sa.code, rows[0].id);
  }

  // create 1 spot per subarea using the subarea polygon
  const spotIds: { spotCode: string; id: string }[] = [];
  for (const sa of saPolys) {
    const subareaId = saIdMap.get(sa.code);
    if (!subareaId) continue;
    const spotCode = `${sa.code}-1`;
    const spotGeom = rectFromLine(sa.line, SPOT_WIDTH_METERS);
    const rows = await db.insert(schema.spots).values({
      subareaId,
      code: spotCode,
      geom: spotGeom.geometry as any,
    }).returning({ id: schema.spots.id });
    spotIds.push({ spotCode, id: rows[0].id });
  }

  // create 8 sub_spots per spot (no geom) so totals show 8
  for (const sp of spotIds) {
    for (let i = 0; i < 8; i++) {
      await db.insert(schema.subSpots).values({
        spotId: sp.id,
        code: `${sp.spotCode}-${i + 1}`,
        idx: i + 1,
        geom: null,
      });
    }
  }

  console.log('Done. Region:', regionId, 'Subareas:', saPolys.length, 'Spots:', spotIds.length);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
