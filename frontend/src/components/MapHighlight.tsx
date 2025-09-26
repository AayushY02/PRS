


// import { useEffect, useMemo, useRef } from 'react';
// import maplibregl, { Map as MLMap } from 'maplibre-gl';
// import type {
//   Feature,
//   FeatureCollection,
//   GeoJsonProperties,
//   MultiPolygon,
//   Polygon,
//   Position,
// } from 'geojson';

// type AnyPoly = Polygon | MultiPolygon;

// type Props = {
//   center?: [number, number];
//   zoom?: number;
//   styleUrl?: string;
//   navControl?: boolean;
//   className?: string;

//   /** Polygons to draw (must be Polygon/MultiPolygon or Feature<Polygon/MultiPolygon>) */
//   features?: Feature<AnyPoly, GeoJsonProperties>[];

//   /** Fit to passed features after load and when they change */
//   fitToFeatures?: boolean;

//   /** Index of the item to highlight */
//   selectedIndex?: number;

//   /** Click on polygon -> report its index back */
//   onFeatureClick?: (index: number) => void;
// };

// const DEFAULT_CENTER: [number, number] = [139.9698, 35.8617];
// const DEFAULT_ZOOM = 12.5;
// const DEFAULT_STYLE =
//   (import.meta.env.VITE_MAP_STYLE as string | undefined)?.trim() ||
//   'https://demotiles.maplibre.org/style.json';

// const SRC_ID = 'mh-src';
// const L_FILL = 'mh-fill';
// const L_LINE = 'mh-line';
// const L_LABEL = 'mh-label';

// const isStyleLoadedSafe = (m?: MLMap | null): boolean =>
//   !!(m && typeof m.isStyleLoaded === 'function' && m.isStyleLoaded());

// /* -------------------------
//    Geometry sanitizers
// -------------------------- */
// const isFiniteNum = (n: any) => Number.isFinite(n);
// const isValidLon = (x: number) => isFiniteNum(x) && x >= -180 && x <= 180;
// const isValidLat = (y: number) => isFiniteNum(y) && y >= -90 && y <= 90;

// function unwrapFeature(g: any): any {
//   if (g && g.type === 'Feature' && g.geometry) return g.geometry;
//   return g;
// }
// function closeRingIfNeeded(ring: Position[]): Position[] {
//   if (ring.length < 4) return ring;
//   const [fx, fy] = ring[0];
//   const [lx, ly] = ring[ring.length - 1];
//   if (fx === lx && fy === ly) return ring;
//   return [...ring, ring[0]];
// }
// function looksSwapped(ring: Position[]): boolean {
//   // any coordinate looks like [lat, lon]?
//   return ring.some(([x, y]) => !isValidLon(x) && isValidLat(x) && isValidLon(y));
// }
// function swapLatLon(r: Position[]) {
//   return r.map(([x, y]) => [y, x]) as Position[];
// }
// function sanitizeRing(ring: any): Position[] | null {
//   if (!Array.isArray(ring)) return null;
//   let r = ring.filter(
//     (p: any) => Array.isArray(p) && p.length >= 2 && isFiniteNum(p[0]) && isFiniteNum(p[1]),
//   ) as Position[];
//   if (r.length < 4) return null;
//   if (looksSwapped(r)) r = swapLatLon(r);
//   if (r.some(([x, y]) => !isValidLon(x) || !isValidLat(y))) return null;
//   r = closeRingIfNeeded(r);
//   return r.length >= 4 ? r : null;
// }
// function sanitizePolygon(geom: any): Polygon | null {
//   if (!geom || geom.type !== 'Polygon' || !Array.isArray(geom.coordinates)) return null;
//   const rings = geom.coordinates.map(sanitizeRing).filter(Boolean) as Position[][];
//   if (!rings.length) return null;
//   return { type: 'Polygon', coordinates: rings };
// }
// function sanitizeMultiPolygon(geom: any): MultiPolygon | null {
//   if (!geom || geom.type !== 'MultiPolygon' || !Array.isArray(geom.coordinates)) return null;
//   const polys: Position[][][] = [];
//   for (const poly of geom.coordinates) {
//     if (!Array.isArray(poly)) continue;
//     const rings = poly.map(sanitizeRing).filter(Boolean) as Position[][];
//     if (rings.length) polys.push(rings);
//   }
//   if (!polys.length) return null;
//   return { type: 'MultiPolygon', coordinates: polys };
// }
// function sanitizeAnyPoly(geom: any): AnyPoly | null {
//   const g = unwrapFeature(geom);
//   if (!g) return null;
//   if (g.type === 'Polygon') return sanitizePolygon(g);
//   if (g.type === 'MultiPolygon') return sanitizeMultiPolygon(g);
//   return null;
// }

// /* -------------------------
//    Component
// -------------------------- */
// export default function MapHighlight({
//   center = DEFAULT_CENTER,
//   zoom = DEFAULT_ZOOM,
//   styleUrl = DEFAULT_STYLE,
//   navControl = true,
//   className = 'relative w-full aspect-video rounded-2xl overflow-hidden border',
//   features = [],
//   fitToFeatures = true,
//   selectedIndex,
//   onFeatureClick,
// }: Props) {
//   const containerRef = useRef<HTMLDivElement | null>(null);
//   const mapRef = useRef<MLMap | null>(null);

//   // normalize, sanitize + stable string ids
//   const { fc, ids } = useMemo(() => {
//     const normalized: Feature<AnyPoly, GeoJsonProperties>[] = [];
//     for (let i = 0; i < (features?.length ?? 0); i++) {
//       const f = features[i] as any;
//       if (!f) continue;
//       const geom = sanitizeAnyPoly(f.geometry ?? f);
//       if (!geom) continue;
//       const id = String((f.id ?? f.properties?.id ?? i));
//       normalized.push({
//         type: 'Feature',
//         id,
//         geometry: geom,
//         properties: {
//           ...(f.properties || {}),
//           id,
//         },
//       } as Feature<AnyPoly, GeoJsonProperties>);
//     }
//     return {
//       fc: { type: 'FeatureCollection', features: normalized } as FeatureCollection<
//         AnyPoly,
//         GeoJsonProperties
//       >,
//       ids: normalized.map((f) => String(f.id)),
//     };
//   }, [features]);

//   // compute bbox
//   const bbox = useMemo(() => {
//     if (!fc.features.length) return null as [number, number, number, number] | null;
//     let minX = Infinity,
//       minY = Infinity,
//       maxX = -Infinity,
//       maxY = -Infinity;
//     const visit = (coords: any) => {
//       if (!Array.isArray(coords)) return;
//       if (typeof coords[0] === 'number') {
//         const [x, y] = coords as Position;
//         if (x < minX) minX = x;
//         if (y < minY) minY = y;
//         if (x > maxX) maxX = x;
//         if (y > maxY) maxY = y;
//       } else {
//         for (const c of coords) visit(c);
//       }
//     };
//     for (const f of fc.features) visit((f.geometry as any).coordinates);
//     if (!Number.isFinite(minX)) return null;
//     return [minX, minY, maxX, maxY] as [number, number, number, number];
//   }, [fc]);

//   // init map once
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

//     if (navControl) {
//       map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
//     }

//     const ensureSourceAndLayers = () => {
//       if (!map.getSource(SRC_ID)) {
//         map.addSource(SRC_ID, {
//           type: 'geojson',
//           data: { type: 'FeatureCollection', features: [] },
//           promoteId: 'id',
//         } as any);
//       }

//       // fill
//       if (map.getLayer(L_FILL)) map.removeLayer(L_FILL);
//       map.addLayer({
//         id: L_FILL,
//         type: 'fill',
//         source: SRC_ID,
//         filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
//         paint: {
//           'fill-color': ['coalesce', ['get', 'color'], '#38bdf8'],
//           'fill-opacity': [
//             'case',
//             ['boolean', ['feature-state', 'selected'], false],
//             0.8,
//             0.5,
//           ],
//         },
//       } as any);

//       // outline
//       if (map.getLayer(L_LINE)) map.removeLayer(L_LINE);
//       map.addLayer({
//         id: L_LINE,
//         type: 'line',
//         source: SRC_ID,
//         filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
//         paint: {
//           'line-color': ['coalesce', ['get', 'color'], '#38bdf8'],
//           'line-width': [
//             'case',
//             ['boolean', ['feature-state', 'selected'], false],
//             3,
//             1.5,
//           ],
//           'line-opacity': 0.95,
//         },
//       } as any);

//       // labels
//       if (map.getLayer(L_LABEL)) map.removeLayer(L_LABEL);
//       map.addLayer({
//         id: L_LABEL,
//         type: 'symbol',
//         source: SRC_ID,
//         filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
//         layout: {
//           'text-field': ['get', 'name'],
//           'text-size': 12,
//           'text-allow-overlap': true,
//         },
//         paint: {
//           'text-color': ['coalesce', ['get', 'color'], '#111827'],
//           'text-halo-color': '#ffffff',
//           'text-halo-width': 1.2,
//         },
//       } as any);
//     };

//     const setDataAndFit = () => {
//       const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
//       if (src) src.setData(fc as any);

//       if (fitToFeatures && bbox) {
//         map.fitBounds(
//           new maplibregl.LngLatBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]),
//           { padding: 24, duration: 300 },
//         );
//       } else {
//         map.setCenter(center);
//         map.setZoom(zoom);
//       }
//     };

//     const onLoad = () => {
//       ensureSourceAndLayers();
//       setDataAndFit();
//       bindClick();
//     };

//     // in case the style changes (custom style URLs), re-add layers
//     const onStyleData = () => {
//       if (!map.getSource(SRC_ID)) {
//         ensureSourceAndLayers();
//         setDataAndFit();
//         bindClick();
//       }
//     };

//     const bindClick = () => {
//       if (!onFeatureClick) return;
//       // remove previous if any (idempotent)
//       map.off('click', L_FILL, clickHandler as any);
//       map.on('click', L_FILL, clickHandler as any);
//     };
//     const clickHandler = (e: any) => {
//       const f = e?.features?.[0];
//       if (!f) return;
//       const id = String(f.id ?? f.properties?.id ?? '');
//       const idx = ids.indexOf(id);
//       if (idx >= 0) onFeatureClick?.(idx);
//     };

//     map.on('load', onLoad);
//     map.on('styledata', onStyleData);

//     const ro = new ResizeObserver(() => map.resize());
//     ro.observe(containerRef.current);

//     return () => {
//       ro.disconnect();
//       map.off('load', onLoad);
//       map.off('styledata', onStyleData);
//       map.off('click', L_FILL, clickHandler as any);
//       map.remove();
//       mapRef.current = null;
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // update data when features change
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map) return;
//     const apply = () => {
//       const src = map.getSource(SRC_ID) as maplibregl.GeoJSONSource | undefined;
//       if (!src) return;
//       src.setData(fc as any);

//       if (fitToFeatures && bbox) {
//         map.fitBounds(
//           new maplibregl.LngLatBounds([bbox[0], bbox[1]], [bbox[2], bbox[3]]),
//           { padding: 24, duration: 300 },
//         );
//       }
//     };
//     if (isStyleLoadedSafe(map)) apply();
//     else map.once('load', apply);
//   }, [fc, bbox, fitToFeatures]);

//   // update active feature-state when selectedIndex changes
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !isStyleLoadedSafe(map)) return;
//     // clear all actives then set one
//     for (const id of ids) {
//       map.setFeatureState({ source: SRC_ID, id }, { selected: false });
//     }
//     if (typeof selectedIndex === 'number' && selectedIndex >= 0 && selectedIndex < ids.length) {
//       map.setFeatureState({ source: SRC_ID, id: ids[selectedIndex] }, { selected: true });
//     }
//   }, [selectedIndex, ids]);

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

  /** Polygons to draw (must be Polygon/MultiPolygon or Feature<Polygon/MultiPolygon>)
   *  properties may include:
   *  - name?: string
   *  - color?: string (hex)    // fallback color if you don't want the ramp
   *  - total?: number          // total sub-spots in the area
   *  - free?: number           // currently free sub-spots in the area
   */
  features?: Feature<AnyPoly, GeoJsonProperties>[];

  /** Fit to passed features after load and when they change */
  fitToFeatures?: boolean;

  /** Index of the item to highlight */
  selectedIndex?: number;

  /** Click on polygon -> report its index back */
  onFeatureClick?: (index: number) => void;

  /** Show "free/total" text badges on polygons */
  showAvailabilityBadges?: boolean; // NEW
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
const L_BADGE = 'mh-badge'; // NEW

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
  showAvailabilityBadges = true, // NEW
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
      const id = String(f.id ?? f.properties?.id ?? i);

      // NEW: compute availability numbers & ratio once here
      const props = (f.properties || {}) as Record<string, any>; // CHANGED
      const total = Number(props.total ?? 0); // NEW
      const free = Number(props.free ?? 0);   // NEW
      const freeRatio = total > 0 ? Math.max(0, Math.min(1, free / total)) : 0; // NEW

      normalized.push({
        type: 'Feature',
        id,
        geometry: geom,
        properties: {
          ...props,            // keep user’s props
          id,
          total,               // NEW: sanitized numeric
          free,                // NEW
          freeRatio,           // NEW (0..1)
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
          // Prefer per-feature uniqueColor, then explicit color, else availability ramp
          'fill-color': [
            'coalesce',
            ['get', 'uniqueColor'],
            ['get', 'color'],
            ['interpolate', ['linear'], ['get', 'freeRatio'],
              0.0, '#ef4444',   // 0% free -> red
              0.5, '#f59e0b',   // 50%     -> amber
              1.0, '#10b981'    // 100%    -> green
            ],
          ],
          'fill-opacity': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            0.8,
            0.55, // CHANGED (slightly lower default opacity)
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
          'line-color': ['coalesce', ['get', 'uniqueColor'], ['get', 'color'], '#111827'],
          'line-width': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            3,
            1.5,
          ],
          'line-opacity': 0.95,
        },
      } as any);

      // labels (name)
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
          'text-offset': [0, showAvailabilityBadges ? -1.0 : 0], // NEW
        },
        paint: {
          'text-color': '#111827',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
        },
      } as any);

      // NEW: availability badge "free/total"
      if (showAvailabilityBadges) {
        if (map.getLayer(L_BADGE)) map.removeLayer(L_BADGE);
        map.addLayer({
          id: L_BADGE,
          type: 'symbol',
          source: SRC_ID,
          filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
          layout: {
            'text-field': [
              'concat',
              ['to-string', ['get', 'free']], '/',
              ['to-string', ['get', 'total']],
            ],
            'text-size': 12,
            'text-allow-overlap': true,
            'text-offset': [0, 0.8],
          },
          paint: {
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        } as any);
      } else if (map.getLayer(L_BADGE)) {
        map.removeLayer(L_BADGE);
      }
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
    ro.observe(containerRef.current!);

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

  // NEW: react to showAvailabilityBadges toggles at runtime
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isStyleLoadedSafe(map)) return;

    // adjust label offset
    map.setLayoutProperty(L_LABEL, 'text-offset', [0, showAvailabilityBadges ? -1.0 : 0]);

    if (showAvailabilityBadges) {
      if (!map.getLayer(L_BADGE)) {
        map.addLayer({
          id: L_BADGE,
          type: 'symbol',
          source: SRC_ID,
          filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
          layout: {
            'text-field': [
              'concat',
              ['to-string', ['get', 'free']], '/',
              ['to-string', ['get', 'total']],
            ],
            'text-size': 12,
            'text-allow-overlap': true,
            'text-offset': [0, 0.8],
          },
          paint: {
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        } as any);
      }
    } else if (map.getLayer(L_BADGE)) {
      map.removeLayer(L_BADGE);
    }
  }, [showAvailabilityBadges]);

  return <div ref={containerRef} className={className} />;
}
