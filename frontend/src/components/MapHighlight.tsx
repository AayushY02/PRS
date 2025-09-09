// // src/components/MapHighlight.tsx
// import { useEffect, useMemo, useRef } from 'react';
// import maplibregl, { Map as MLMap } from 'maplibre-gl';
// import type { Feature, FeatureCollection, Polygon, MultiPolygon, GeoJsonProperties } from 'geojson';
// import { sanitizeFeatures } from '@/lib/geojsonSanitizer';

// type AnyPoly = Polygon | MultiPolygon;

// type Props = {
//   center?: [number, number];
//   zoom?: number;
//   styleUrl?: string;
//   navControl?: boolean;
//   className?: string;

//   /** Polygons to draw */
//   features?: Feature<AnyPoly, GeoJsonProperties>[];

//   /** Index of the item to highlight (hover/focus from list) */
//   selectedIndex?: number;

//   /** Click on polygon -> report its index back */
//   onFeatureClick?: (index: number) => void;
// };

// const DEFAULT_CENTER: [number, number] = [139.9698, 35.8617];
// const DEFAULT_ZOOM = 12.5;
// const DEFAULT_STYLE = import.meta.env.VITE_MAP_STYLE || 'https://demotiles.maplibre.org/style.json';
// const SRC_ID = 'mh-src';
// const L_FILL = 'mh-fill';
// const L_LINE = 'mh-line';

// export default function MapHighlight({
//   center = DEFAULT_CENTER,
//   zoom = DEFAULT_ZOOM,
//   styleUrl = DEFAULT_STYLE,
//   navControl = true,
//   className = 'relative w-full aspect-video rounded-2xl overflow-hidden border',
//   features = [],
//   selectedIndex,
//   onFeatureClick,
// }: Props) {
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const mapRef = useRef<MLMap | null>(null);


//   const fc: FeatureCollection<AnyPoly, GeoJsonProperties> = useMemo(() => {
//     const safe = sanitizeFeatures((features ?? []).map((f, i) => ({ ...f, id: f.id ?? i })));
//     return { type: 'FeatureCollection', features: safe };
//   }, [features]);

//   useEffect(() => {
//     if (!containerRef.current || mapRef.current) return;

//     const map = new maplibregl.Map({
//       container: containerRef.current,
//       style: styleUrl,
//       center,
//       zoom,
//       attributionControl: false,
//       interactive: true,
//     });
//     mapRef.current = map;

//     if (navControl) map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

//     const ro = new ResizeObserver(() => map.resize());
//     ro.observe(containerRef.current);

//     const onLoad = () => {
//       // source
//       map.addSource(SRC_ID, { type: 'geojson', data: fc } as any);

//       // layers
//       map.addLayer({
//         id: L_FILL,
//         type: 'fill',
//         source: SRC_ID,
//         paint: {
//           'fill-color': [
//             'case',
//             ['boolean', ['feature-state', 'selected'], false], '#22c55e',
//             ['coalesce', ['get', 'color'], '#38bdf8'],
//           ],
//           'fill-opacity': [
//             'case',
//             ['to-boolean', ['feature-state', 'selected']], 0.6,
//             0.35,
//           ],
//         },
//       });

//       map.addLayer({
//         id: L_LINE,
//         type: 'line',
//         source: SRC_ID,
//         paint: {
//           'line-color': [
//             'case',
//             ['boolean', ['feature-state', 'selected'], false], '#16a34a',
//             ['coalesce', ['get', 'color'], '#38bdf8'],
//           ],
//           'line-width': 2,
//           'line-opacity': 0.9,
//         },
//       });

//       // click -> callback with index
//       if (onFeatureClick) {
//         map.on('click', L_FILL, (e) => {
//           const f = e.features?.[0];
//           if (!f) return;
//           const idx = typeof f.id === 'number' ? f.id : Number(f.properties?.__idx ?? -1);
//           if (idx >= 0) onFeatureClick(idx);
//         });
//       }

//       // fit bounds to all features (if any)
//       if (fc.features.length > 0) {
//         const b = new maplibregl.LngLatBounds();
//         for (const f of fc.features) {
//           const g = f.geometry;
//           const coords = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
//           for (const ring of coords as any) {
//             for (const [x, y] of ring as any) b.extend([x, y]);
//           }
//         }
//         if (b.isEmpty()) map.setCenter(center);
//         else map.fitBounds(b, { padding: 32, duration: 300 });
//       }
//     };

//     map.on('load', onLoad);
//     return () => {
//       ro.disconnect();
//       map.off('load', onLoad);
//       map.remove();
//       mapRef.current = null;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // update data when features change
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !map.getSource(SRC_ID)) return;
//     (map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(fc as any);
//     // clear previous states
//     map.removeFeatureState?.({ source: SRC_ID } as any);
//     if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < fc.features.length) {
//       const sel = fc.features[selectedIndex];
//       if (sel?.id != null) map.setFeatureState({ source: SRC_ID, id: sel.id as any }, { selected: true });
//     }
//   }, [fc, selectedIndex]);

//   return <div ref={containerRef} className={className} />;
// }


import { useEffect, useMemo, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';

type AnyPoly = Polygon | MultiPolygon;

type Props = {
  center?: [number, number];
  zoom?: number;
  styleUrl?: string;
  navControl?: boolean;
  className?: string;

  /** Polygons to draw (must be Polygon/MultiPolygon or Feature<Polygon/MultiPolygon>) */
  features?: Feature<AnyPoly, GeoJsonProperties>[];

  /** Fit to passed features after load and when they change */
  fitToFeatures?: boolean;

  /** Index of the item to highlight */
  selectedIndex?: number;

  /** Click on polygon -> report its index back */
  onFeatureClick?: (index: number) => void;
};

const DEFAULT_CENTER: [number, number] = [139.9698, 35.8617];
const DEFAULT_ZOOM = 12.5;
const DEFAULT_STYLE =
  (import.meta.env.VITE_MAP_STYLE as string | undefined)?.trim() ||
  'https://demotiles.maplibre.org/style.json';

const SRC_ID = 'mh-src';
const L_FILL = 'mh-fill';
const L_LINE = 'mh-line';
const L_LABEL = 'mh-label';

const isStyleLoadedSafe = (m?: MLMap | null): boolean =>
  !!(m && typeof m.isStyleLoaded === 'function' && m.isStyleLoaded());

/* -------------------------
   Geometry sanitizers
-------------------------- */
const isFiniteNum = (n: any) => Number.isFinite(n);
const isValidLon = (x: number) => isFiniteNum(x) && x >= -180 && x <= 180;
const isValidLat = (y: number) => isFiniteNum(y) && y >= -90 && y <= 90;

function unwrapFeature(g: any): any {
  if (g && g.type === 'Feature' && g.geometry) return g.geometry;
  return g;
}
function closeRingIfNeeded(ring: Position[]): Position[] {
  if (ring.length < 4) return ring;
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx === lx && fy === ly) return ring;
  return [...ring, ring[0]];
}
function looksSwapped(ring: Position[]): boolean {
  // any coordinate looks like [lat, lon]?
  return ring.some(([x, y]) => !isValidLon(x) && isValidLat(x) && isValidLon(y));
}
function swapLatLon(r: Position[]) {
  return r.map(([x, y]) => [y, x]) as Position[];
}
function sanitizeRing(ring: any): Position[] | null {
  if (!Array.isArray(ring)) return null;
  let r = ring.filter(
    (p: any) => Array.isArray(p) && p.length >= 2 && isFiniteNum(p[0]) && isFiniteNum(p[1]),
  ) as Position[];
  if (r.length < 4) return null;
  if (looksSwapped(r)) r = swapLatLon(r);
  if (r.some(([x, y]) => !isValidLon(x) || !isValidLat(y))) return null;
  r = closeRingIfNeeded(r);
  return r.length >= 4 ? r : null;
}
function sanitizePolygon(geom: any): Polygon | null {
  if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
  const rings = geom.coordinates.map(sanitizeRing).filter(Boolean) as Position[][];
  if (!rings.length) return null;
  return { type: 'Polygon', coordinates: rings };
}
function sanitizeMultiPolygon(geom: any): MultiPolygon | null {
  if (!geom || geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates)) return null;
  const polys: Position[][][] = [];
  for (const poly of geom.coordinates) {
    if (!Array.isArray(poly)) continue;
    const rings = poly.map(sanitizeRing).filter(Boolean) as Position[][];
    if (rings.length) polys.push(rings);
  }
  if (!polys.length) return null;
  return { type: 'MultiPolygon', coordinates: polys };
}
function sanitizeAnyPoly(geom: any): AnyPoly | null {
  const g = unwrapFeature(geom);
  if (!g) return null;
  if (g.type === 'Polygon') return sanitizePolygon(g);
  if (g.type === 'MultiPolygon') return sanitizeMultiPolygon(g);
  return null;
}

/* -------------------------
   Component
-------------------------- */
export default function MapHighlight({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  styleUrl = DEFAULT_STYLE,
  navControl = true,
  className = 'relative w-full aspect-video rounded-2xl overflow-hidden border',
  features = [],
  fitToFeatures = true,
  selectedIndex,
  onFeatureClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);

  // normalize, sanitize + stable string ids
  const { fc, ids } = useMemo(() => {
    const normalized: Feature<AnyPoly, GeoJsonProperties>[] = [];
    for (let i = 0; i < (features?.length ?? 0); i++) {
      const f = features[i] as any;
      if (!f) continue;
      const geom = sanitizeAnyPoly(f.geometry ?? f);
      if (!geom) continue;
      const id = String((f.id ?? f.properties?.id ?? i));
      normalized.push({
        type: 'Feature',
        id,
        geometry: geom,
        properties: {
          ...(f.properties || {}),
          id,
        },
      } as Feature<AnyPoly, GeoJsonProperties>);
    }
    return {
      fc: { type: 'FeatureCollection', features: normalized } as FeatureCollection<
        AnyPoly,
        GeoJsonProperties
      >,
      ids: normalized.map((f) => String(f.id)),
    };
  }, [features]);

  // compute bbox
  const bbox = useMemo(() => {
    if (!fc.features.length) return null as [number, number, number, number] | null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const visit = (coords: any) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number') {
        const [x, y] = coords as Position;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      } else {
        for (const c of coords) visit(c);
      }
    };
    for (const f of fc.features) visit((f.geometry as any).coordinates);
    if (!Number.isFinite(minX)) return null;
    return [minX, minY, maxX, maxY] as [number, number, number, number];
  }, [fc]);

  // init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: false,
      interactive: true,
    });
    mapRef.current = map;

    if (navControl) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    }

    const ensureSourceAndLayers = () => {
      if (!map.getSource(SRC_ID)) {
        map.addSource(SRC_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          promoteId: 'id',
        } as any);
      }

      // fill
      if (map.getLayer(L_FILL)) map.removeLayer(L_FILL);
      map.addLayer({
        id: L_FILL,
        type: 'fill',
        source: SRC_ID,
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#38bdf8'],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.8,
            0.5,
          ],
        },
      } as any);

      // outline
      if (map.getLayer(L_LINE)) map.removeLayer(L_LINE);
      map.addLayer({
        id: L_LINE,
        type: 'line',
        source: SRC_ID,
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#38bdf8'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            3,
            1.5,
          ],
          'line-opacity': 0.95,
        },
      } as any);

      // labels
      if (map.getLayer(L_LABEL)) map.removeLayer(L_LABEL);
      map.addLayer({
        id: L_LABEL,
        type: 'symbol',
        source: SRC_ID,
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 12,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': ['coalesce', ['get', 'color'], '#111827'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
        },
      } as any);
    };

    const setDataAndFit = () => {
      const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(fc as any);

      if (fitToFeatures && bbox) {
        map.fitBounds(
          new maplibregl.LngLatBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]),
          { padding: 24, duration: 300 },
        );
      } else {
        map.setCenter(center);
        map.setZoom(zoom);
      }
    };

    const onLoad = () => {
      ensureSourceAndLayers();
      setDataAndFit();
      bindClick();
    };

    // in case the style changes (custom style URLs), re-add layers
    const onStyleData = () => {
      if (!map.getSource(SRC_ID)) {
        ensureSourceAndLayers();
        setDataAndFit();
        bindClick();
      }
    };

    const bindClick = () => {
      if (!onFeatureClick) return;
      // remove previous if any (idempotent)
      map.off('click', L_FILL, clickHandler as any);
      map.on('click', L_FILL, clickHandler as any);
    };
    const clickHandler = (e: any) => {
      const f = e?.features?.[0];
      if (!f) return;
      const id = String(f.id ?? f.properties?.id ?? '');
      const idx = ids.indexOf(id);
      if (idx >= 0) onFeatureClick?.(idx);
    };

    map.on('load', onLoad);
    map.on('styledata', onStyleData);

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.off('load', onLoad);
      map.off('styledata', onStyleData);
      map.off('click', L_FILL, clickHandler as any);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update data when features change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      src.setData(fc as any);

      if (fitToFeatures && bbox) {
        map.fitBounds(
          new maplibregl.LngLatBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]),
          { padding: 24, duration: 300 },
        );
      }
    };
    if (isStyleLoadedSafe(map)) apply();
    else map.once('load', apply);
  }, [fc, bbox, fitToFeatures]);

  // update active feature-state when selectedIndex changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoadedSafe(map)) return;
    // clear all actives then set one
    for (const id of ids) {
      map.setFeatureState({ source: SRC_ID, id }, { selected: false });
    }
    if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < ids.length) {
      map.setFeatureState({ source: SRC_ID, id: ids[selectedIndex] }, { selected: true });
    }
  }, [selectedIndex, ids]);

  return <div ref={containerRef} className={className} />;
}
