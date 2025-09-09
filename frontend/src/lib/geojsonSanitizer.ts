import type { Feature, Polygon, MultiPolygon, Position } from 'geojson';

type AnyPoly = Polygon | MultiPolygon;

const isFiniteNum = (n: any) => Number.isFinite(n);
const isValidLon = (x: number) => isFiniteNum(x) && x >= -180 && x <= 180;
const isValidLat = (y: number) => isFiniteNum(y) && y >= -90 && y <= 90;

function closeRingIfNeeded(ring: Position[]): Position[] {
  if (ring.length < 4) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx === lx && fy === ly) return ring;
  return [...ring, ring[0]];
}

function coordsAreLonLat(ring: Position[]): boolean {
  // If any coord looks like [lat, lon] (lat>90), assume swapped
  for (const [a, b] of ring) {
    if (!isValidLon(a) || !isValidLat(b)) {
      if (isValidLat(a) && isValidLon(b)) return false; // swapped
      return true; // outright invalid
    }
  }
  return true;
}

function swapLatLon(ring: Position[]): Position[] {
  return ring.map(([x, y]) => [y, x]);
}

function sanitizeLinearRing(ring: Position[]): Position[] | null {
  let r = ring.filter(([x, y]) => isFiniteNum(x) && isFiniteNum(y));
  if (r.length < 4) return null;

  if (!coordsAreLonLat(r)) {
    // Looks swapped
    r = swapLatLon(r);
  }
  // Validate ranges now
  for (const [x, y] of r) {
    if (!isValidLon(x) || !isValidLat(y)) return null;
  }
  r = closeRingIfNeeded(r);
  // Ensure ring still has 4+ positions after closing
  return r.length >= 4 ? r : null;
}

function sanitizePolygon(geom: any): Polygon | null {
  if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
  const rings = geom.coordinates.map((ring: any) => sanitizeLinearRing(ring as Position[])).filter(Boolean) as Position[][];
  if (rings.length === 0) return null;
  return { type: 'Polygon', coordinates: rings };
}

function sanitizeMultiPolygon(geom: any): MultiPolygon | null {
  if (!geom || geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates)) return null;
  const polys: Position[][][] = [];
  for (const poly of geom.coordinates) {
    if (!Array.isArray(poly)) continue;
    const rings = poly.map((ring: any) => sanitizeLinearRing(ring as Position[])).filter(Boolean) as Position[][];
    if (rings.length > 0) polys.push(rings);
  }
  if (polys.length === 0) return null;
  return { type: 'MultiPolygon', coordinates: polys };
}

export function sanitizeGeometry(geom: any): AnyPoly | null {
  // If a full Feature sneaks in, unwrap it
  if (geom && geom.type === 'Feature' && geom.geometry) geom = geom.geometry;

  if (geom?.type === 'Polygon') return sanitizePolygon(geom);
  if (geom?.type === 'MultiPolygon') return sanitizeMultiPolygon(geom);
  return null; // we only render polygons here
}

export function sanitizeFeatures(
  raw: Array<Feature<any>>
): Array<Feature<AnyPoly>> {
  const out: Array<Feature<AnyPoly>> = [];
  for (const f of raw) {
    const g = sanitizeGeometry(f.geometry ?? f);
    if (!g) {
      console.warn('[geojson] dropping invalid polygon feature id=', (f as any).id ?? '(none)');
      continue;
    }
    out.push({
      type: 'Feature',
      id: (f as any).id,
      properties: { ...(f.properties ?? {}) },
      geometry: g,
    });
  }
  return out;
}