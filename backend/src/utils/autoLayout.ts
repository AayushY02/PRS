// backend/src/lib/autoLayout.ts
import * as turf from '@turf/turf';
import type { Feature, LineString, Polygon } from 'geojson';

export type Side = 'left' | 'right';

// ✅ helper: always return Feature<LineString>
function asLineFeature(line: Feature<LineString> | LineString): Feature<LineString> {
  // If it's a raw geometry (no `.geometry`), wrap it
  if ((line as any).type === 'LineString' && !(line as any).geometry) {
    return turf.feature(line as any) as Feature<LineString>;
  }
  // Already a Feature<LineString>
  return line as Feature<LineString>;
}

export function rectAtAlong(
  line: Feature<LineString> | LineString,
  atMeters: number,
  lengthMeters: number,
  widthMeters: number,
  side: Side,
  lateralOffsetMeters = 0
): Feature<Polygon> {
  const L = asLineFeature(line); // ⬅️ use narrowed feature

  const Lm  = turf.length(L, { units: 'kilometers' }) * 1000;
  const eps = Math.min(1, Math.max(0.2, lengthMeters * 0.05));
  const clamp = (x: number) => Math.max(0, Math.min(Lm, x));
  const m0 = clamp(atMeters);

  const p0 = turf.along(L,  m0 / 1000, { units: 'kilometers' });
  const p1 = turf.along(L, (m0 + eps) / 1000, { units: 'kilometers' });

  const brg  = turf.bearing(p0, p1);
  const perp = brg + (side === 'right' ? 90 : -90);

  const shift  = lateralOffsetMeters + widthMeters / 2;
  const center = turf.destination(p0, shift / 1000, perp, { units: 'kilometers' });

  const halfL = lengthMeters / 2;
  const A  = turf.destination(center,  halfL / 1000, brg, { units: 'kilometers' });
  const B  = turf.destination(center, -halfL / 1000, brg, { units: 'kilometers' });

  const Aout = turf.destination(A,  widthMeters / 1000, perp, { units: 'kilometers' });
  const Bout = turf.destination(B,  widthMeters / 1000, perp, { units: 'kilometers' });
  const Ain  = turf.destination(A, -widthMeters / 1000, perp, { units: 'kilometers' });
  const Bin  = turf.destination(B, -widthMeters / 1000, perp, { units: 'kilometers' });

  const ring = [
    Bout.geometry.coordinates,
    Aout.geometry.coordinates,
    Ain.geometry.coordinates,
    Bin.geometry.coordinates,
    Bout.geometry.coordinates,
  ];

  return turf.polygon([ring]);
}

export function meters(line: Feature<LineString> | LineString) {
  const L = asLineFeature(line); // ⬅️ narrow first
  return turf.length(L, { units: 'kilometers' }) * 1000;
}

export function positionsEvenly(totalMeters: number, count: number, marginMeters = 0): number[] {
  if (count <= 0) return [];
  const usable = Math.max(0, totalMeters - 2 * marginMeters);
  const step = usable / count;
  const arr: number[] = [];
  for (let i = 0; i < count; i++) arr.push(marginMeters + (i + 0.5) * step);
  return arr;
}
