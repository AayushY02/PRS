

// src/pages/Spots.tsx
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SpotBookingSheet from '../components/SpotBookingSheet';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Clock, CheckCircle2 } from 'lucide-react';
import maplibregl, { MapLayerMouseEvent, Map as MLMap } from 'maplibre-gl';

// --- Turf ---
import { point, lineString, polygon, featureCollection } from '@turf/helpers';
import destination from '@turf/destination';
import along from '@turf/along';
import bbox from '@turf/bbox';

import type {
  Feature,
  FeatureCollection,
  Geometry,
  LineString,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// ===== Types (extended with geometry) =====
type SubSpotRow = {
  id: string;
  code: string;
  isBusyNow: boolean;
  isMineNow: boolean;
  myStartTime: string | null;
  geometry?: any | null; // Polygon | MultiPolygon | Feature
  displayLabel?: string;
  slotOrder?: number;
  spotId?: string;
};

type ParentSpotRow = {
  id: string;
  code: string;
  geom?: any | null; // optional parent polygon for future use
  subSpots: SubSpotRow[];
  activeCount?: number;
  completedCount?: number;
  displayLabel?: string;
  order?: number;
};

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  'http://localhost:8080/api'; // dev fallback

// ===== Small bits =====
function SubSpotSkeleton() {
  return (
    <div className="rounded-xl border p-3">
      <div className="h-4 w-16 bg-muted rounded" />
      <div className="mt-2 h-7 w-20 bg-muted rounded" />
    </div>
  );
}
function formatElapsed(startISO: string | null) {
  if (!startISO) return null;
  const ms = Date.now() - new Date(startISO).getTime();
  if (ms < 0 || Number.isNaN(ms)) return null;
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// ===== Map helpers =====
const ENV_STYLE = import.meta.env.VITE_MAP_STYLE as string | undefined;
const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';
const MAP_STYLE = ENV_STYLE && ENV_STYLE.trim() ? ENV_STYLE : DEMO_STYLE;
const KASHIWA: [number, number] = [139.9698, 35.8617];

const SRC_ID = 'subspots-preview-src'; // for feature-state

const COLOR_MINE = '#10b981';
const CIRCLED_DIGITS = [
  '\u2460', '\u2461', '\u2462', '\u2463', '\u2464',
  '\u2465', '\u2466', '\u2467', '\u2468', '\u2469',
  '\u246A', '\u246B', '\u246C', '\u246D', '\u246E',
  '\u246F', '\u2470', '\u2471', '\u2472', '\u2473'
];

const toCircledNumber = (n: number): string => {
  const value = n >= 1 && n <= CIRCLED_DIGITS.length ? CIRCLED_DIGITS[n - 1] : undefined;
  return value ?? `(${n})`;
};

const parseRegionOrdinal = (region: { code?: string | null } | undefined): number => {
  const code = region?.code ?? '';
  const matches = code.match(/\d+/g);
  if (matches && matches.length > 0) {
    const last = matches[matches.length - 1];
    const parsed = parseInt(last, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1;
};

const formatParentLabel = (circle: string, order: number) => `スポット${circle}-${order}`;

const COLOR_BUSY = '#9ca3af';
const COLOR_AVAIL = '#38bdf8';

const isStyleLoadedSafe = (m?: MLMap | null): boolean =>
  !!(m && typeof m.isStyleLoaded === 'function' && m.isStyleLoaded());

function runWhenStyleReady(map: MLMap, cb: () => void) {
  if (isStyleLoadedSafe(map)) {
    cb();
    return;
  }
  const handler = () => {
    if (isStyleLoadedSafe(map)) {
      map.off('styledata', handler);
      cb();
    }
  };
  map.on('styledata', handler);
}

// seeded jitter so symbols don’t overlap when state changes
function seededRng(seedStr: string) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
}
const hash01 = (str: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
};

/* =========================
   SANITIZERS (server → map)
   ========================= */
const isFiniteNum = (n: any) => Number.isFinite(n);
const isValidLon = (x: number) => isFiniteNum(x) && x >= -180 && x <= 180;
const isValidLat = (y: number) => isFiniteNum(y) && y >= -90 && y <= 90;

function unwrapFeature(g: any): any {
  // Accept a full Feature in DB and unwrap to Geometry
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
  // If any looks like [lat, lon], we’ll swap the whole ring
  return ring.some(([x, y]) => !isValidLon(x) && isValidLat(x) && isValidLon(y));
}
function swapLatLon(r: Position[]) {
  return r.map(([x, y]) => [y, x]) as Position[];
}
function sanitizeRing(ring: any): Position[] | null {
  if (!Array.isArray(ring)) return null;
  let r = ring.filter((p: any) => Array.isArray(p) && p.length >= 2 && isFiniteNum(p[0]) && isFiniteNum(p[1])) as Position[];
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
function sanitizeAnyPoly(geom: any): Polygon | MultiPolygon | null {
  const g = unwrapFeature(geom);
  if (!g) return null;
  if (g.type === 'Polygon') return sanitizePolygon(g);
  if (g.type === 'MultiPolygon') return sanitizeMultiPolygon(g);
  return null; // only polygons supported here
}

type SpotState = 'mine' | 'busy' | 'available';

function deriveSpotState(subs: SubSpotRow[]): SpotState {
  if (!Array.isArray(subs) || subs.length === 0) return 'available';
  if (subs.some(s => s.isMineNow)) return 'mine';
  if (subs.some(s => s.isBusyNow)) return 'busy';
  return 'available';
}

function buildSpotFeatureCollection(parents: ParentSpotRow[]): {
  fc: FeatureCollection<Polygon | MultiPolygon> | null;
  stateById: Map<string, SpotState>;
} {
  const features: Feature<Polygon | MultiPolygon>[] = [];
  const stateById = new Map<string, SpotState>();

  for (const spot of parents ?? []) {
    const geom = sanitizeAnyPoly((spot as any)?.geom);
    if (!geom) continue;

    const subSpots = Array.isArray(spot.subSpots)
      ? spot.subSpots
      : [];
    const busyCount = subSpots.filter(s => s.isBusyNow).length;
    const freeCount = Math.max(0, subSpots.length - busyCount);
    const mineCount = subSpots.filter(s => s.isMineNow).length;
    const state = deriveSpotState(subSpots);
    stateById.set(spot.id, state);
    const fallbackColor = state === 'mine' ? COLOR_MINE : state === 'busy' ? COLOR_BUSY : COLOR_AVAIL;

    features.push({
      type: 'Feature',
      id: spot.id,
      geometry: geom,
      properties: {
        type: 'spot',
        spotId: spot.id,
        code: spot.code,
        name: spot.displayLabel ?? spot.code,
        // subareaId: spot.subareaId,
        total: subSpots.length,
        busy: busyCount,
        free: freeCount,
        mine: mineCount,
        completedCount: spot.completedCount ?? 0,
        color: fallbackColor,
      },
    });
  }

  if (features.length === 0) {
    return { fc: null, stateById };
  }

  return { fc: { type: 'FeatureCollection', features }, stateById };
}

/* ==========================================
   PREVIEW (only if server has no valid polys)
   ========================================== */
function buildPreviewFeatures(
  seed: string,
  flatSubSpots: SubSpotRow[]
): FeatureCollection<LineString | Polygon> {
  const rand = seededRng(seed);
  const bearingDeg = Math.floor(rand() * 180); // 0..179
  const offsetLon = (rand() - 0.5) * 0.003;    // ~±3000m lon
  const offsetLat = (rand() - 0.5) * 0.002;    // ~±2000m lat
  const center = point([KASHIWA[0] + offsetLon, KASHIWA[1] + offsetLat]);

  // Road length ~ 300 m
  const lenKm = 0.3 / 1000;
  const start = destination(center, lenKm / 2, bearingDeg, { units: 'kilometers' });
  const end = destination(center, lenKm / 2, bearingDeg + 180, { units: 'kilometers' });
  const road = lineString([start.geometry.coordinates, end.geometry.coordinates], {
    type: 'road',
    color: '#64748b',
  }) as Feature<LineString>;

  const pick = [...flatSubSpots].sort((a, b) => a.code.localeCompare(b.code)).slice(0, 30);
  const n = Math.max(1, pick.length);
  const spacingKm = lenKm / (n + 1);

  const widthKm = 2.7 / 1000;  // ~2.7 m
  const depthKm = 5.4 / 1000;  // ~5.4 m

  const slots: Feature<Polygon>[] = [];
  for (let i = 0; i < pick.length; i++) {
    const s = pick[i];
    const h = hash01(s.id);
    const jitter = (h - 0.5) * spacingKm * 0.6;
    const dKm = spacingKm * (i + 1) + jitter;

    const sideSign = h < 0.5 ? -1 : 1;

    const mid = along(road, dKm, { units: 'kilometers' });
    const pA = destination(mid, widthKm / 2, bearingDeg, { units: 'kilometers' });
    const pB = destination(mid, widthKm / 2, bearingDeg + 180, { units: 'kilometers' });

    const outward = bearingDeg + 90 * sideSign;
    const pA2 = destination(pA, depthKm, outward, { units: 'kilometers' });
    const pB2 = destination(pB, depthKm, outward, { units: 'kilometers' });

    const ring: Position[] = [
      pB.geometry.coordinates,
      pA.geometry.coordinates,
      pA2.geometry.coordinates,
      pB2.geometry.coordinates,
      pB.geometry.coordinates,
    ];

    const state = s.isMineNow ? 'mine' : s.isBusyNow ? 'busy' : 'available';
    const fill = state === 'mine' ? COLOR_MINE : state === 'busy' ? COLOR_BUSY : COLOR_AVAIL;
    const busyValue = state === 'mine' || state === 'busy' ? 1 : 0;
    const poly = polygon([ring], {
      type: 'slot',
      code: s.code,
      subSpotId: s.id,
      spotId: s.spotId ?? s.id,
      state,
      color: fill,
      busy: busyValue,
      total: 1,
    }) as Feature<Polygon>;
    poly.id = s.spotId ?? s.id;
    slots.push(poly);
  }

  return featureCollection<LineString | Polygon>([road, ...slots]) as FeatureCollection<LineString | Polygon>;
}

export default function Spots() {
  const { regionId } = useParams<{ regionId: string }>();
  const qc = useQueryClient();
  const liveStatesRef = useRef(new Map<string, SpotState>());

  // store map event handlers so we can .off() them correctly
  const clickHandlerRef = useRef<((e: MapLayerMouseEvent) => void) | null>(null);
  const moveHandlerRef = useRef<((e: MapLayerMouseEvent) => void) | null>(null);
  const leaveHandlerRef = useRef<(() => void) | null>(null);
  const prevHoverIdRef = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['spots', regionId],
    queryFn: async () => (await api.get(`/api/spots/by-region/${regionId}`)).data,
    enabled: !!regionId,
  });

  const region = data?.region as { id?: string; name?: string | null; code?: string | null } | undefined;

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const r = await api.get('/api/auth/whoami');
        return r.data;
      } catch {
        return { userId: null }; // treat as anonymous
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const myUserId: string | null = me?.userId ?? null;

  const regionOrdinal = parseRegionOrdinal(region);
  const regionCircle = toCircledNumber(regionOrdinal);
  const regionImageMap: Record<number, string> = {
    // 1: '/images/image-1-new.png',
    // 2: '/images/image-2-new.png',
    // 3: '/images/region-3.png',
    // 4: '/images/region-4.png',
    // 6: '/images/region-3.png',
    // 7: '/images/region-4.png',
  };
  const regionImage = regionImageMap[regionOrdinal] ?? null;
  const regionImageAlt = region?.name ? `${region.name} レイアウト` : `地域${regionCircle} レイアウト`;
  const enableMapPreview = !regionImage;

  const parents = (data?.spots ?? []) as ParentSpotRow[];
  const flatAll = useMemo(() =>
    parents.flatMap(p => p.subSpots.map((s) => ({ ...s, spotId: p.id }))),
    [parents]
  );

  const { fc: spotFC, stateById: spotStateById } = useMemo(() => buildSpotFeatureCollection(parents), [parents]);

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<SubSpotRow | null>(null);
  const subSpotById = useMemo(() => {
    const m = new Map<string, SubSpotRow>();
    flatAll.forEach(s => m.set(s.id, s));
    return m;
  }, [flatAll]);

  const subSpotToSpotRef = useRef(subSpotById);
  useEffect(() => { subSpotToSpotRef.current = subSpotById; }, [subSpotById]);

  const counts = useMemo(() => ({
    total: flatAll.length,
    busy: flatAll.filter(s => s.isBusyNow).length,
    mine: flatAll.filter(s => s.isMineNow).length,
    available: flatAll.filter(s => !s.isBusyNow).length,
  }), [flatAll]);
  const completedTotal = useMemo(() => parents.reduce((sum, spot) => sum + (spot.completedCount ?? 0), 0), [parents]);
  const activeCount = counts.busy;
  const regionLabel = region?.name ?? region?.code ?? null;
  const subtitleText = regionLabel
    ? `${regionLabel} · 自刁E ${counts.mine}件 · 使用中: ${counts.busy}/${counts.total}`
    : `自刁E ${counts.mine}件 · 使用中: ${counts.busy}/${counts.total}`;

  const filteredParents = useMemo(() => {
    return parents.map((p, parentIdx) => {
      const parentLabel = formatParentLabel(regionCircle, parentIdx + 1);
      const mappedSubSpots = p.subSpots.map((s, subIdx) => ({
        ...s,
        spotId: p.id,
        displayLabel: `${parentLabel}・${subIdx + 1}台目`,
        slotOrder: subIdx + 1,
      }));
      return {
        ...p,
        displayLabel: parentLabel,
        order: parentIdx + 1,
        subSpots: mappedSubSpots,
      };
    });
  }, [parents, regionCircle]);

  const origParentMap = useMemo(() => {
    const m = new Map<string, ParentSpotRow>();
    parents.forEach(p => m.set(p.id, p));
    return m;
  }, [parents]);

  const openSheet = (s: SubSpotRow) => { setChosen(s); setOpen(true); };
  const closeSheet = () => setOpen(false);

  // ========== Map preview ==========
  const mapRef = useRef<MLMap | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const previewFC = useMemo<FeatureCollection<LineString | Polygon>>(
    () => buildPreviewFeatures(regionId ?? 'seed', flatAll),
    [regionId, flatAll]
  );

  const ensureContainerReady = (el: HTMLElement | null) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const kickResize = (map: MLMap) => {
    map.resize();
    requestAnimationFrame(() => {
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
    setTimeout(() => map.resize(), 50);
    setTimeout(() => map.resize(), 250);
  };

  // keep a single hover feature on map in sync with card hover
  const setMapHover = useCallback((id: string | null) => {
    const map = mapRef.current;
    if (!map || !isStyleLoadedSafe(map)) return;
    if (prevHoverIdRef.current) {
      map.setFeatureState({ source: SRC_ID, id: prevHoverIdRef.current } as any, { hover: false });
    }
    if (id) {
      map.setFeatureState({ source: SRC_ID, id } as any, { hover: true });
    }
    prevHoverIdRef.current = id;
  }, []);

  function fitToDataOrFallback(map: MLMap, data: GeoJSON.FeatureCollection, fallbackCenter = KASHIWA) {
    try {
      const safe = Array.isArray(data?.features) ? data : { type: 'FeatureCollection', features: [] };
      if (safe.features.length === 0) {
        map.setCenter(fallbackCenter);
        map.setZoom(15);
        return;
      }
      const [minX, minY, maxX, maxY] = bbox(safe as any);
      if ([minX, minY, maxX, maxY].some(v => !isFinite(v))) {
        map.setCenter(fallbackCenter);
        map.setZoom(15);
        return;
      }
      const bounds = new maplibregl.LngLatBounds([minX, minY], [maxX, maxY]);
      map.fitBounds(bounds, { padding: 24, duration: 300 });
    } catch {
      map.setCenter(fallbackCenter);
      map.setZoom(15);
    }
  }

  useEffect(() => {
    if (!enableMapPreview) return;
    if (mapRef.current) return;

    let cancelled = false;
    const waitAndInit = () => {
      if (cancelled) return;
      const el = mapElRef.current;
      if (!el || !ensureContainerReady(el) || document.visibilityState !== 'visible') {
        requestAnimationFrame(waitAndInit);
        return;
      }

      const map = new maplibregl.Map({
        container: el,
        style: MAP_STYLE,
        center: KASHIWA,
        zoom: 15,
        attributionControl: false,
        interactive: true,
      });
      mapRef.current = map;

      const onLoad = () => { setStyleReady(true); kickResize(map); };
      const onStyleData = () => { setStyleReady(isStyleLoadedSafe(map)); if (isStyleLoadedSafe(map)) kickResize(map); };
      map.on('load', onLoad);
      map.on('styledata', onStyleData);

      map.on('error', (e) => {
        const msg = (e as any)?.error?.message || '';
        // eslint-disable-next-line no-console
        console.error('[MapLibre error]', e);
        if (MAP_STYLE !== DEMO_STYLE && /style|fetch|network|json/i.test(msg)) {
          map.setStyle(DEMO_STYLE);
        }
      });

      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

      const ro = new ResizeObserver(() => kickResize(map));
      ro.observe(el);

      const onWinResize = () => kickResize(map);
      window.addEventListener('resize', onWinResize);

      const io = new IntersectionObserver((entries) => {
        if (entries.some(en => en.isIntersecting)) kickResize(map);
      }, { threshold: [0, 0.1, 0.5, 1] });
      io.observe(el);

      const onVis = () => { if (document.visibilityState === 'visible') kickResize(map); };
      document.addEventListener('visibilitychange', onVis);

      return () => {
        io.disconnect();
        ro.disconnect();
        window.removeEventListener('resize', onWinResize);
        document.removeEventListener('visibilitychange', onVis);
        map.off('load', onLoad);
        map.off('styledata', onStyleData);
        map.remove();
        mapRef.current = null;
      };
    };

    waitAndInit();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enableMapPreview) return;
    const map = mapRef.current;
    if (!map || !styleReady) return;

    runWhenStyleReady(map, () => {
      const ROAD = 'subspots-road';
      const SLOTS_FILL = 'subspots-slots-fill';
      const SLOTS_LINE = 'subspots-slots-line';
      const SLOTS_LABEL = 'subspots-slots-label';

      // Prefer server rectangles if any exist, otherwise fallback to fake preview road+slots
      const fcHasServer = (spotFC?.features?.length ?? 0) > 0;
      const useFC = (fcHasServer ? spotFC : previewFC) as any;

      if (!fcHasServer) {
        console.warn('[Spots] No valid spot polygons from server; showing preview rectangles.');
      }

      if (map.getSource(SRC_ID)) {
        (map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(useFC);
      } else {
        map.addSource(SRC_ID, {
          type: 'geojson',
          data: useFC,
          // ✅ ensures feature-state ids are stable across reloads
          promoteId: 'spotId',
        } as any);
      }

      const ensure = (id: string, layer: any) => {
        if (map.getLayer(id)) map.removeLayer(id);
        map.addLayer(layer as any);
      };

      // Only draw the ROAD layer if we’re using preview (server rectangles won’t have a road line)
      if (!fcHasServer) {
        ensure(ROAD, {
          id: ROAD,
          type: 'line',
          source: SRC_ID,
          filter: ['==', ['get', 'type'], 'road'],
          paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.8 },
        });
      } else if (map.getLayer(ROAD)) {
        map.removeLayer(ROAD);
      }

      const colorExpr = [
        'case',
        ['==', ['feature-state', 'state'], 'mine'], '#10b981',    // green
        ['==', ['feature-state', 'state'], 'busy'], '#9ca3af',    // gray
        ['==', ['feature-state', 'state'], 'available'], '#38bdf8', // sky
        ['coalesce', ['get', 'color'], '#38bdf8'],               // fallback
      ];

      ensure(SLOTS_FILL, {
        id: SLOTS_FILL,
        type: 'fill',
        source: SRC_ID,
        filter: ['any',
          ['==', ['get', 'type'], 'spot'],
          ['==', ['get', 'type'], 'slot'],               // preview slots
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
      });

      ensure(SLOTS_LINE, {
        id: SLOTS_LINE,
        type: 'line',
        source: SRC_ID,
        filter: ['any',
          ['==', ['get', 'type'], 'spot'],
          ['==', ['get', 'type'], 'slot'],
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        paint: { 'line-color': colorExpr, 'line-width': 2, 'line-opacity': 0.9 },
      });

      ensure(SLOTS_LABEL, {
        id: SLOTS_LABEL,
        type: 'symbol',
        source: SRC_ID,
        filter: ['any',
          ['==', ['get', 'type'], 'spot'],
          ['==', ['get', 'type'], 'slot'],
          ['==', ['geometry-type'], 'Polygon'],
          ['==', ['geometry-type'], 'MultiPolygon'],
        ],
        layout: {
          'text-field': [
            'concat',
            ['coalesce', ['get', 'name'], ['get', 'code']],
            ' ',
            ['to-string', ['coalesce', ['get', 'busy'], 0]],
            '/',
            ['to-string', ['coalesce', ['get', 'total'], 0]],
          ],
          'text-size': 10,
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
      });

      // SAFE FIT
      fitToDataOrFallback(map, useFC, KASHIWA);

      // Clear any stale feature-state after we replaced data
      // map.removeFeatureState?.({ source: SRC_ID } as any);
      map.removeFeatureState?.({ source: SRC_ID } as any);
      if (fcHasServer) {
        liveStatesRef.current = new Map(spotStateById);
        for (const [id, st] of spotStateById) {
          map.setFeatureState({ source: SRC_ID, id } as any, { state: st });
        }
      } else {
        liveStatesRef.current.clear();
      }
    });
  }, [enableMapPreview, styleReady, previewFC, spotFC, spotStateById]);



  useEffect(() => {
    // ✅ match server mount (app.get('/api/live', ...))
    const LIVE_URL = API_BASE + '/api/live';
    const es = new EventSource(LIVE_URL, { withCredentials: true });

    const onBooking = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(ev.data) as { event: 'start' | 'end'; subSpotId: string; userId: string };
        const spot = subSpotToSpotRef.current.get(msg.subSpotId);
        const spotId = spot?.spotId;
        if (!spotId) return;

        const map = mapRef.current;
        const state: SpotState =
          msg.event === 'start'
            ? (myUserId && msg.userId === myUserId ? 'mine' : 'busy')
            : 'available';

        // ✅ cache the live state
        liveStatesRef.current.set(spotId, state);

        // ✅ apply immediately if source is ready
        if (map && isStyleLoadedSafe(map) && map.getSource(SRC_ID)) {
          map.setFeatureState({ source: SRC_ID, id: spotId } as any, { state });
        }

        // refresh list/counters in background
        qc.invalidateQueries({ queryKey: ['spots', regionId] });
      } catch { }
    };

    es.addEventListener('booking', onBooking as any);
    return () => { es.removeEventListener('booking', onBooking as any); es.close(); };
  }, [myUserId, qc, regionId]);

  // ===========================
  // ===== UI BELOW THE MAP ====
  // ===========================
  return (
    <>
      <TopTitle title="駐車スペース" subtitle={subtitleText} />

      {/* Visual preview */}
      <div className=" w-full  rounded-2xl overflow-hidden border mb-3 z-0">
        {regionImage ? (
          <div className="w-full">
            <img
              src={regionImage}
              alt={regionImageAlt}
              className="w-full"
              loading="lazy"
            />
          </div>
        ) : (
          <>
            <div ref={mapElRef} className="absolute inset-0 z-0 h-64 w-full" />
            {/* <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-background/80 border rounded-xl px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> 自分
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-zinc-400" /> 使用中
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded bg-sky-400" /> 空き
              </span>
            </div> */}
          </>
        )}
      </div>

      {/* Compact metric chips */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Card className="rounded-xl shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800">
          <CardContent className="flex flex-col items-center justify-center py-2 px-2">
            <div className="h-7 w-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold tabular-nums leading-none">{completedTotal}</div>
            <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">路駐完了</div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border border-amber-200 dark:border-amber-800">
          <CardContent className="flex flex-col items-center justify-center py-2 px-2">
            <div className="h-7 w-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <Clock className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold tabular-nums leading-none">{activeCount}</div>
            <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">路駐中</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar */}
      <div className="mb-3 grid grid-cols-1 gap-2">
        <Button
          size="sm"
          variant="default"
          className="rounded-full h-9"
          disabled
        >
          すべて
        </Button>
      </div>

      {/* Parent → Sub-spot groups (Accordion) */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="rounded-2xl p-4">
              <div className="h-5 w-28"><Skeleton className="h-5 w-full rounded" /></div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, j) => <SubSpotSkeleton key={j} />)}
              </div>
            </Card>
          ))}
        </div>
      ) : filteredParents.length === 0 ? (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          この条件に一致するサブスポットはありません。
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filteredParents.map((p) => {
            const original = origParentMap.get(p.id);
            const totalAll = original?.subSpots.length ?? 0;
            const busyAll = original ? original.subSpots.filter(s => s.isBusyNow).length : 0;
            const availAll = totalAll - busyAll;

            return (
              <AccordionItem key={p.id} value={p.id} className="border rounded-xl px-2">
                <AccordionTrigger className="py-2">
                  <div className="w-full flex items-center justify-between pr-2">
                    <div className="text-base font-semibold">{p.displayLabel ?? formatParentLabel(regionCircle, (p.order ?? 0) || 1)}</div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">{p.subSpots.length}/{totalAll}</Badge>
                      <Badge variant="outline" className="hidden xs:inline-flex">空き {availAll}</Badge>
                      <Badge variant="outline" className="hidden xs:inline-flex">使用 {busyAll}</Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {p.subSpots.map((s, idx) => {
                      const isMine = s.isMineNow;
                      const isBusy = s.isBusyNow;
                      const elapsed = isMine ? formatElapsed(s.myStartTime) : null;
                      const accent =
                        isMine ? 'from-emerald-500/15 to-emerald-500/0 border-emerald-500/30'
                          : isBusy ? 'from-zinc-500/10 to-zinc-500/0 border-zinc-500/20'
                            : 'from-sky-500/15 to-sky-500/0 border-sky-500/30';

                      return (
                        <motion.div
                          key={s.id}
                          layout
                          initial={{ opacity: 0, y: 8, scale: 0.98 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.2, delay: Math.min(idx, 10) * 0.015 }}
                          onMouseEnter={() => setMapHover(s.spotId ?? s.id)}
                          onMouseLeave={() => setMapHover(null)}
                          onFocus={() => setMapHover(s.spotId ?? s.id)}
                          onBlur={() => setMapHover(null)}
                        >
                          <div className={['rounded-xl p-3 border bg-gradient-to-br', accent].join(' ')}>
                            <div className="text-sm font-medium truncate">{s.displayLabel ?? (p.displayLabel ?? s.code)}</div>
                            <div className="text-[11px] text-muted-foreground">{isBusy ? (isMine ? "路上駐車中（自分） / Street Parking (Mine)" : "路上駐車中 / Street Parking") : "空き / Vacant"}</div>
                            <div className="mt-1 flex items-center gap-2">
                              {isMine ? (
                                <>
                                  <Badge className="gap-1" variant="default">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    自分
                                  </Badge>
                                  {elapsed && (
                                    <span className="inline-flex items-center text-[11px] text-muted-foreground gap-1 font-mono">
                                      <Clock className="h-3 w-3" /> {elapsed}
                                    </span>
                                  )}
                                </>
                              ) : isBusy ? (
                                <Badge variant="secondary">使用中</Badge>
                              ) : (
                                <Badge variant="outline">空き</Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="rounded-xl w-full mt-2 h-8"
                              variant={isMine ? 'default' : isBusy ? 'outline' : 'default'}
                              onClick={() => openSheet(s)}
                              aria-label={`${s.displayLabel ?? s.code} を${isMine ? '管理' : isBusy ? '詳細' : '路駐状況記入'}`}
                            >
                              {isMine ? '管理' : isBusy ? '詳細' : '路駐状況記入'}
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {chosen && (
        <SpotBookingSheet
          open={open}
          onOpenChange={(v) => { if (!v) closeSheet(); else setOpen(true); }}
          subSpotId={chosen.id}
          subSpotCode={chosen.displayLabel ?? chosen.code}
          myStartTime={chosen.myStartTime ?? undefined}
          onSuccess={async () => {
            const map = mapRef.current;
            const spotId = chosen.spotId;
            if (map && spotId) {
              const nextState = chosen.isMineNow ? 'available' : 'mine';
              map.setFeatureState?.({ source: SRC_ID, id: spotId } as any, { state: nextState });
              liveStatesRef.current.set(spotId, nextState);
            }

            setChosen(null);
            closeSheet();
            qc.invalidateQueries({ queryKey: ['spots', regionId] });
            qc.refetchQueries({ queryKey: ['spots', regionId], type: 'active' });
            qc.invalidateQueries({ queryKey: ['my-bookings'] });
          }}
        />
      )}
    </>
  );
}
