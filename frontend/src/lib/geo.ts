// src/lib/geo.ts
import type { Feature, FeatureCollection, Polygon, GeoJsonProperties } from 'geojson';
import maplibregl from 'maplibre-gl';

export function polyFeature(
  geom: any,
  props: GeoJsonProperties = {},
  id?: string
): Feature<Polygon, GeoJsonProperties> {
  // Trust backend to send valid Polygon geometry (JSONB -> GeoJSON)
  const f: Feature<Polygon, GeoJsonProperties> = {
    type: 'Feature',
    geometry: geom as Polygon,
    properties: props,
  };
  if (id) (f as any).id = id;
  return f;
}

export function featureCollection<T extends Feature<any, GeoJsonProperties>>(
  features: T[]
): FeatureCollection {
  return { type: 'FeatureCollection', features } as FeatureCollection;
}

export function fitToFeatureCollection(map: maplibregl.Map, fc: FeatureCollection, pad = 24) {
  const coords: number[][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates) coords.push(...ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates) for (const ring of poly) coords.push(...ring);
    }
  }
  if (coords.length === 0) return;
  let minX = +Infinity, minY = +Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const bounds = new maplibregl.LngLatBounds([minX, minY], [maxX, maxY]);
  map.fitBounds(bounds, { padding: pad, duration: 350 });
}