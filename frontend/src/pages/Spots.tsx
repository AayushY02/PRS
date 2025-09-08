
// // import { useParams } from 'react-router-dom';
// // import { useQuery, useQueryClient } from '@tanstack/react-query';
// // import { api } from '../lib/api';
// // import TopTitle from '../components/TopTitle';
// // import { Badge } from '../components/ui/badge';
// // import { Button } from '../components/ui/button';
// // import { motion } from 'framer-motion';
// // import { useEffect, useMemo, useRef, useState } from 'react';
// // import SpotBookingSheet from '../components/SpotBookingSheet';
// // import { Card, CardContent } from '../components/ui/card';
// // import { Skeleton } from '../components/ui/skeleton';
// // import { Clock, CheckCircle2, MinusCircle, Car } from 'lucide-react';
// // import maplibregl, { Map as MLMap } from 'maplibre-gl';

// // // --- Turf (typed + tree-shaken) ---
// // import { point, lineString, polygon, featureCollection } from '@turf/helpers';
// // import destination from '@turf/destination';
// // import along from '@turf/along';
// // import bbox from '@turf/bbox';
// // import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';

// // type SpotRow = {
// //   id: string;
// //   code: string;
// //   subareaId: string;
// //   isBusyNow: boolean;
// //   isMineNow: boolean;
// //   myStartTime: string | null;
// // };

// // function SpotSkeleton() {
// //   return (
// //     <Card className="rounded-2xl px-4 py-4">
// //       <div className="flex items-center justify-between gap-3">
// //         <div className="h-5 w-28"><Skeleton className="h-5 w-full rounded" /></div>
// //         <div className="h-8 w-20"><Skeleton className="h-8 w-full rounded" /></div>
// //       </div>
// //       <div className="h-3 w-40 mt-3"><Skeleton className="h-3 w-full rounded" /></div>
// //     </Card>
// //   );
// // }

// // // format elapsed from an ISO start time (HH:MM:SS)
// // function formatElapsed(startISO: string | null) {
// //   if (!startISO) return null;
// //   const ms = Date.now() - new Date(startISO).getTime();
// //   if (ms < 0 || Number.isNaN(ms)) return null;
// //   const s = Math.floor(ms / 1000);
// //   const hh = Math.floor(s / 3600).toString().padStart(2, '0');
// //   const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
// //   const ss = Math.floor(s % 60).toString().padStart(2, '0');
// //   return `${hh}:${mm}:${ss}`;
// // }

// // type FilterMode = 'all' | 'available' | 'mine';

// // // ---- Map + env helpers ----
// // const ENV_STYLE = import.meta.env.VITE_MAP_STYLE as string | undefined;
// // const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';
// // const MAP_STYLE = ENV_STYLE && ENV_STYLE.trim() ? ENV_STYLE : DEMO_STYLE;
// // const KASHIWA: [number, number] = [139.9698, 35.8617];

// // const SRC_ID = 'spots-preview-src'; // used for setFeatureState/removeFeatureState

// // const COLOR_MINE = '#10b981';
// // const COLOR_BUSY = '#9ca3af';
// // const COLOR_AVAIL = '#38bdf8';

// // const isStyleLoadedSafe = (m?: MLMap | null): boolean =>
// //   !!(m && typeof m.isStyleLoaded === 'function' && m.isStyleLoaded());

// // function runWhenStyleReady(map: MLMap, cb: () => void) {
// //   if (isStyleLoadedSafe(map)) { cb(); return; }
// //   const handler = () => {
// //     if (isStyleLoadedSafe(map)) { map.off('styledata', handler); cb(); }
// //   };
// //   map.on('styledata', handler);
// // }

// // // --- seed helpers (stable, per-spot wiggle/side) ---
// // function seededRng(seedStr: string) {
// //   let s = 0;
// //   for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
// //   return () => (s = (s * 1664525 + 1013904223) >>> 0, s / 2 ** 32);
// // }
// // const hash01 = (str: string) => {
// //   let h = 2166136261 >>> 0;
// //   for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
// //   return (h >>> 0) / 2 ** 32;
// // };

// // // Build a deterministic “random road” + 6 parking slots using Turf
// // function buildPreviewFeatures(
// //   seed: string,
// //   filtered: SpotRow[]
// // ): FeatureCollection<LineString | Polygon> {
// //   const rand = seededRng(seed);

// //   const bearingDeg = Math.floor(rand() * 180); // 0..179
// //   const offsetLon = (rand() - 0.5) * 0.003;    // ~±3000m lon
// //   const offsetLat = (rand() - 0.5) * 0.002;    // ~±2000m lat
// //   const center = point([KASHIWA[0] + offsetLon, KASHIWA[1] + offsetLat]);

// //   // Road length ~ 300 m
// //   const lenKm = 0.3 / 1000;
// //   const start = destination(center, lenKm / 2, bearingDeg, { units: 'kilometers' });
// //   const end = destination(center, lenKm / 2, bearingDeg + 180, { units: 'kilometers' });
// //   const road = lineString(
// //     [start.geometry.coordinates, end.geometry.coordinates],
// //     { type: 'road', color: '#64748b' } // zinc-500
// //   ) as Feature<LineString>;

// //   // Place up to 6 slots along the road
// //   const n = 6;
// //   const spacingKm = lenKm / (n + 1);

// //   // Slot size (slightly larger for visibility)
// //   const widthKm = 2.7 / 1000;  // 2.7 m (across road)
// //   const depthKm = 5.4 / 1000;  // 5.4 m (away from road)

// //   const pick = [...filtered].sort((a, b) => a.code.localeCompare(b.code)).slice(0, n);
// //   const slots: Feature<Polygon>[] = [];

// //   for (let i = 0; i < pick.length; i++) {
// //     const s = pick[i];

// //     // unique jitter per spot (avoid overlaps when state changes)
// //     const h = hash01(s.id);
// //     const jitter = (h - 0.5) * spacingKm * 0.6; // up to ±30% of spacing
// //     const dKm = spacingKm * (i + 1) + jitter;

// //     // side: -1 (left) or +1 (right) relative to road bearing
// //     const sideSign = h < 0.5 ? -1 : 1;

// //     const mid = along(road, dKm, { units: 'kilometers' }); // point on road
// //     const pA = destination(mid, widthKm / 2, bearingDeg, { units: 'kilometers' });
// //     const pB = destination(mid, widthKm / 2, bearingDeg + 180, { units: 'kilometers' });

// //     // push outward perpendicular
// //     const outward = bearingDeg + (90 * sideSign);
// //     const pA2 = destination(pA, depthKm, outward, { units: 'kilometers' });
// //     const pB2 = destination(pB, depthKm, outward, { units: 'kilometers' });

// //     const ring: Position[] = [
// //       pB.geometry.coordinates,
// //       pA.geometry.coordinates,
// //       pA2.geometry.coordinates,
// //       pB2.geometry.coordinates,
// //       pB.geometry.coordinates,
// //     ];

// //     const state = s.isMineNow ? 'mine' : s.isBusyNow ? 'busy' : 'available';
// //     const fill = state === 'mine' ? COLOR_MINE : state === 'busy' ? COLOR_BUSY : COLOR_AVAIL;
// //     const poly = polygon([ring], {
// //       type: 'slot',
// //       code: s.code,
// //       spotId: s.id, // promoteId target
// //       state,
// //       color: fill,
// //     }) as Feature<Polygon>;

// //     poly.id = s.id; // stable feature id
// //     slots.push(poly);
// //   }

// //   const fc = featureCollection<LineString | Polygon>([road, ...slots]);
// //   return fc as FeatureCollection<LineString | Polygon>;
// // }

// // export default function Spots() {
// //   const { subareaId } = useParams();
// //   const qc = useQueryClient();

// //   // global 1s ticker so all cards can render elapsed time cheaply
// //   const [, setTick] = useState(0);
// //   useEffect(() => {
// //     const t = setInterval(() => setTick((n) => (n + 1) % 1_000_000), 1000);
// //     return () => clearInterval(t);
// //   }, []);

// //   const { data, isLoading } = useQuery({
// //     queryKey: ['spots', subareaId],
// //     queryFn: async () => (await api.get(`/api/spots/by-subarea/${subareaId}`)).data,
// //     enabled: !!subareaId,
// //   });

// //   const spots: SpotRow[] = (data?.spots ?? []) as SpotRow[];

// //   const [open, setOpen] = useState(false);
// //   const [chosen, setChosen] = useState<SpotRow | null>(null);
// //   const [filter, setFilter] = useState<FilterMode>('all');

// //   const openSheet = (s: SpotRow) => { setChosen(s); setOpen(true); };
// //   const closeSheet = () => setOpen(false);

// //   const counts = useMemo(() => ({
// //     total: spots.length,
// //     busy: spots.filter(s => s.isBusyNow).length,
// //     mine: spots.filter(s => s.isMineNow).length,
// //     available: spots.filter(s => !s.isBusyNow).length,
// //   }), [spots]);

// //   const filtered = useMemo(() => {
// //     switch (filter) {
// //       case 'available': return spots.filter(s => !s.isBusyNow);
// //       case 'mine': return spots.filter(s => s.isMineNow);
// //       default: return spots;
// //     }
// //   }, [spots, filter]);

// //   // ---------- MAP PREVIEW (random road + 6 de-overlapped slots via Turf) ----------
// //   const mapRef = useRef<MLMap | null>(null);
// //   const mapElRef = useRef<HTMLDivElement | null>(null);
// //   const [styleReady, setStyleReady] = useState(false);

// //   const previewFC = useMemo<FeatureCollection<LineString | Polygon>>(
// //     // seed only by subareaId so layout is stable for this subarea;
// //     // polygons still move individually because each spot uses its own id hash.
// //     () => buildPreviewFeatures(subareaId ?? 'kashiwa', filtered),
// //     [subareaId, filtered]
// //   );

// //   // visibility/size helpers
// //   const ensureContainerReady = (el: HTMLElement | null) => {
// //     if (!el) return false;
// //     const r = el.getBoundingClientRect();
// //     return r.width > 0 && r.height > 0;
// //   };
// //   const kickResize = (map: MLMap) => {
// //     map.resize();
// //     requestAnimationFrame(() => {
// //       map.resize();
// //       requestAnimationFrame(() => map.resize());
// //     });
// //     setTimeout(() => map.resize(), 50);
// //     setTimeout(() => map.resize(), 250);
// //   };

// //   // init map once (visibility-aware)
// //   useEffect(() => {
// //     if (mapRef.current) return;

// //     let cancelled = false;
// //     const waitAndInit = () => {
// //       if (cancelled) return;
// //       const el = mapElRef.current;
// //       if (!el || !ensureContainerReady(el) || document.visibilityState !== 'visible') {
// //         requestAnimationFrame(waitAndInit);
// //         return;
// //       }

// //       const map = new maplibregl.Map({
// //         container: el,
// //         style: MAP_STYLE,
// //         center: KASHIWA,
// //         zoom: 15,
// //         attributionControl: false,
// //         interactive: true,
// //       });
// //       mapRef.current = map;

// //       // Style lifecycle
// //       const onLoad = () => { setStyleReady(true); kickResize(map); };
// //       const onStyleData = () => { setStyleReady(isStyleLoadedSafe(map)); if (isStyleLoadedSafe(map)) kickResize(map); };
// //       map.on('load', onLoad);
// //       map.on('styledata', onStyleData);

// //       map.on('error', (e) => {
// //         const msg = (e as any)?.error?.message || '';
// //         // eslint-disable-next-line no-console
// //         console.error('[MapLibre error]', e);
// //         if (MAP_STYLE !== DEMO_STYLE && /style|fetch|network|json/i.test(msg)) {
// //           map.setStyle(DEMO_STYLE);
// //         }
// //       });

// //       map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

// //       // Resize observers
// //       const ro = new ResizeObserver(() => kickResize(map));
// //       ro.observe(el);

// //       const onWinResize = () => kickResize(map);
// //       window.addEventListener('resize', onWinResize);

// //       const io = new IntersectionObserver((entries) => {
// //         if (entries.some(en => en.isIntersecting)) kickResize(map);
// //       }, { threshold: [0, 0.1, 0.5, 1] });
// //       io.observe(el);

// //       const onVis = () => { if (document.visibilityState === 'visible') kickResize(map); };
// //       document.addEventListener('visibilitychange', onVis);

// //       // Cleanup
// //       return () => {
// //         io.disconnect();
// //         ro.disconnect();
// //         window.removeEventListener('resize', onWinResize);
// //         document.removeEventListener('visibilitychange', onVis);
// //         map.off('load', onLoad);
// //         map.off('styledata', onStyleData);
// //         map.remove();
// //         mapRef.current = null;
// //       };
// //     };

// //     waitAndInit();
// //     return () => { cancelled = true; };
// //     // eslint-disable-next-line react-hooks/exhaustive-deps
// //   }, []); // init once

// //   // add/update preview layers (replace data, never append)
// //   useEffect(() => {
// //     const map = mapRef.current;
// //     if (!map || !styleReady) return;

// //     runWhenStyleReady(map, () => {
// //       const ROAD = 'spots-road';
// //       const SLOTS_FILL = 'spots-slots-fill';
// //       const SLOTS_LINE = 'spots-slots-line';
// //       const SLOTS_LABEL = 'spots-slots-label';

// //       const data = previewFC as unknown as GeoJSON.FeatureCollection;

// //       if (map.getSource(SRC_ID)) {
// //         (map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(data);
// //       } else {
// //         map.addSource(SRC_ID, {
// //           type: 'geojson',
// //           data,
// //           promoteId: 'spotId', // enable setFeatureState({ id: spotId })
// //         } as any);
// //       }

// //       const ensure = (id: string, layer: any) => {
// //         if (map.getLayer(id)) map.removeLayer(id);
// //         map.addLayer(layer as any);
// //       };

// //       // road line
// //       ensure(ROAD, {
// //         id: ROAD,
// //         type: 'line',
// //         source: SRC_ID,
// //         filter: ['==', ['get', 'type'], 'road'],
// //         paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.8 },
// //       });

// //       // SLOT COLORS use feature-state when present, else fallback to property
// //       const colorExpr = [
// //         'case',
// //         ['==', ['feature-state', 'state'], 'mine'], COLOR_MINE,
// //         ['==', ['feature-state', 'state'], 'busy'], COLOR_BUSY,
// //         ['==', ['feature-state', 'state'], 'available'], COLOR_AVAIL,
// //         ['get', 'color'],
// //       ] as any;

// //       ensure(SLOTS_FILL, {
// //         id: SLOTS_FILL,
// //         type: 'fill',
// //         source: SRC_ID,
// //         filter: ['==', ['get', 'type'], 'slot'],
// //         paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
// //       });

// //       ensure(SLOTS_LINE, {
// //         id: SLOTS_LINE,
// //         type: 'line',
// //         source: SRC_ID,
// //         filter: ['==', ['get', 'type'], 'slot'],
// //         paint: { 'line-color': colorExpr, 'line-width': 2, 'line-opacity': 0.9 },
// //       });

// //       ensure(SLOTS_LABEL, {
// //         id: SLOTS_LABEL,
// //         type: 'symbol',
// //         source: SRC_ID,
// //         filter: ['==', ['get', 'type'], 'slot'],
// //         layout: { 'text-field': ['get', 'code'], 'text-size': 10, 'text-allow-overlap': true },
// //         paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
// //       });

// //       // Fit to preview bounds
// //       const [minX, minY, maxX, maxY] = bbox(data);
// //       const bounds = new maplibregl.LngLatBounds([minX, minY], [maxX, maxY]);
// //       map.fitBounds(bounds, { padding: 24, duration: 300 });

// //       // IMPORTANT: clear any previous optimistic overrides after new data arrives
// //       map.removeFeatureState?.({ source: SRC_ID } as any);
// //     });
// //   }, [styleReady, previewFC]);

// //   return (
// //     // <>
// //     //   <TopTitle title="Spots" subtitle={`${counts.mine} mine · ${counts.busy}/${counts.total} in use`} />

// //     //   {/* Map preview — fixed height so it always renders */}
// //     //   <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border mb-4 z-0">
// //     //     <div ref={mapElRef} className="absolute inset-0 z-0 h-64 w-full" />
// //     //     {/* Legend */}
// //     //     <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-background/80 border rounded-xl px-3 py-2 text-xs">
// //     //       <span className="inline-flex items-center gap-1">
// //     //         <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> Mine
// //     //       </span>
// //     //       <span className="inline-flex items-center gap-1">
// //     //         <span className="inline-block h-2 w-2 rounded bg-zinc-400" /> Booked
// //     //       </span>
// //     //       <span className="inline-flex items-center gap-1">
// //     //         <span className="inline-block h-2 w-2 rounded bg-sky-400" /> Available
// //     //       </span>
// //     //     </div>
// //     //   </div>

// //     //   {/* Compact stat pills */}

// //     //   <div className="mb-4 grid grid-cols-3 gap-2">
// //     //     {/* Total */}
// //     //     <Card className="rounded-xl shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800">
// //     //       <CardContent className="flex flex-col items-center justify-center py-2 px-2">
// //     //         <div className="h-7 w-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
// //     //           <Car className="h-4 w-4" />
// //     //         </div>
// //     //         <div className="text-base font-semibold tabular-nums leading-none">{counts.total}</div>
// //     //         <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">Total</div>
// //     //       </CardContent>
// //     //     </Card>

// //     //     {/* Mine */}
// //     //     <Card className="rounded-xl shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border border-emerald-200 dark:border-emerald-800">
// //     //       <CardContent className="flex flex-col items-center justify-center py-2 px-2">
// //     //         <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
// //     //           <CheckCircle2 className="h-4 w-4" />
// //     //         </div>
// //     //         <div className="text-base font-semibold tabular-nums leading-none">{counts.mine}</div>
// //     //         <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">Mine</div>
// //     //       </CardContent>
// //     //     </Card>

// //     //     {/* Available */}
// //     //     <Card className="rounded-xl shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border border-amber-200 dark:border-amber-800">
// //     //       <CardContent className="flex flex-col items-center justify-center py-2 px-2">
// //     //         <div className="h-7 w-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
// //     //           <MinusCircle className="h-4 w-4" />
// //     //         </div>
// //     //         <div className="text-base font-semibold tabular-nums leading-none">{counts.available}</div>
// //     //         <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">Available</div>
// //     //       </CardContent>
// //     //     </Card>
// //     //   </div>

// //     //   {/* Filters */}
// //     //   <div className="mb-4 flex items-center gap-2">
// //     //     <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('all')}>All</Button>
// //     //     <Button size="sm" variant={filter === 'available' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('available')}>Available</Button>
// //     //     <Button size="sm" variant={filter === 'mine' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('mine')}>Mine</Button>
// //     //   </div>

// //     //   {/* Two-column grid */}
// //     //   {isLoading ? (
// //     //     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //     //       {Array.from({ length: 6 }).map((_, i) => <SpotSkeleton key={i} />)}
// //     //     </div>
// //     //   ) : filtered.length === 0 ? (
// //     //     <Card className="rounded-2xl p-6 text-sm text-muted-foreground">No spots found for this filter.</Card>
// //     //   ) : (
// //     //     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //     //       {filtered.map((s, idx) => {
// //     //         const isMine = s.isMineNow;
// //     //         const isBusy = s.isBusyNow;
// //     //         const accent =
// //     //           isMine ? 'from-emerald-500/15 to-emerald-500/0 border-emerald-500/30'
// //     //             : isBusy ? 'from-zinc-500/10 to-zinc-500/0 border-zinc-500/20'
// //     //               : 'from-sky-500/15 to-sky-500/0 border-sky-500/30';

// //     //         const elapsed = isMine ? formatElapsed(s.myStartTime) : null;

// //     //         return (
// //     //           <motion.div key={s.id} layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, delay: idx * 0.015 }}>
// //     //             <Card className={['relative rounded-2xl px-4 py-3 border', 'hover:shadow-md transition', 'bg-gradient-to-br', accent, 'group'].join(' ')}>
// //     //               <div className={['absolute left-0 top-0 h-full w-1.5 rounded-l-2xl', isMine ? 'bg-emerald-500' : isBusy ? 'bg-zinc-400' : 'bg-sky-500'].join(' ')} />
// //     //               <div className="flex items-start justify-between gap-3 pl-2">
// //     //                 <div className="min-w-0">
// //     //                   <div className="text-base font-semibold truncate">{s.code}</div>
// //     //                   <div className="mt-1 flex items-center gap-2">
// //     //                     {isMine ? (
// //     //                       <>
// //     //                         <Badge className="gap-1" variant="default">
// //     //                           <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
// //     //                           My booking
// //     //                         </Badge>
// //     //                         {elapsed && (
// //     //                           <span className="inline-flex items-center text-xs text-muted-foreground gap-1 font-mono">
// //     //                             <Clock className="h-3 w-3" /> {elapsed}
// //     //                           </span>
// //     //                         )}
// //     //                       </>
// //     //                     ) : isBusy ? (
// //     //                       <Badge variant="secondary">Booked</Badge>
// //     //                     ) : (
// //     //                       <Badge variant="outline">Available</Badge>
// //     //                     )}
// //     //                   </div>
// //     //                 </div>
// //     //                 <Button
// //     //                   variant={isMine ? 'default' : isBusy ? 'outline' : 'default'}
// //     //                   className="rounded-xl"
// //     //                   onClick={() => openSheet(s)}
// //     //                 >
// //     //                   {isMine ? 'Manage' : isBusy ? 'Details' : 'Book'}
// //     //                 </Button>
// //     //               </div>
// //     //               <button onClick={() => openSheet(s)} className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40" aria-label={`Open ${s.code}`} style={{ pointerEvents: 'none' }} />
// //     //             </Card>
// //     //           </motion.div>
// //     //         );
// //     //       })}
// //     //     </div>
// //     //   )}

// //     //   {chosen && (
// //     //     <SpotBookingSheet
// //     //       open={open}
// //     //       onOpenChange={(v) => { if (!v) closeSheet(); else setOpen(true); }}
// //     //       spotId={chosen.id}
// //     //       spotCode={chosen.code}
// //     //       myStartTime={chosen.myStartTime ?? undefined}
// //     //       onSuccess={async () => {
// //     //         // 1) Optimistic map tint (instant feedback)
// //     //         const map = mapRef.current;
// //     //         if (map && chosen) {
// //     //           const nextState =
// //     //             chosen.isMineNow ? 'available' // you ended your booking
// //     //               : chosen.isBusyNow ? 'busy'     // details viewed — likely unchanged
// //     //                 : 'mine';                        // you just booked
// //     //           map.setFeatureState?.({ source: SRC_ID, id: chosen.id } as any, { state: nextState });
// //     //         }

// //     //         // 2) Close sheet & refresh queries immediately
// //     //         setChosen(null);
// //     //         closeSheet();

// //     //         // Mark cache stale AND force an active refetch now
// //     //         qc.invalidateQueries({ queryKey: ['spots', subareaId] });
// //     //         qc.refetchQueries({ queryKey: ['spots', subareaId], type: 'active' });

// //     //         // Also refresh my bookings
// //     //         qc.invalidateQueries({ queryKey: ['my-bookings'] });
// //     //       }}
// //     //     />
// //     //   )}
// //     // </>

// //     <>
// //       <TopTitle
// //         title="駐車スペース"
// //         subtitle={`自分: ${counts.mine}件 · 使用中: ${counts.busy}/${counts.total}`}
// //       />

// //       {/* マッププレビュー */}
// //       <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border mb-4 z-0">
// //         <div ref={mapElRef} className="absolute inset-0 z-0 h-64 w-full" />
// //         {/* 凡例 */}
// //         <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-background/80 border rounded-xl px-3 py-2 text-xs">
// //           <span className="inline-flex items-center gap-1">
// //             <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> 自分
// //           </span>
// //           <span className="inline-flex items-center gap-1">
// //             <span className="inline-block h-2 w-2 rounded bg-zinc-400" /> 使用中
// //           </span>
// //           <span className="inline-flex items-center gap-1">
// //             <span className="inline-block h-2 w-2 rounded bg-sky-400" /> 空き
// //           </span>
// //         </div>
// //       </div>

// //       {/* ステータスカード */}
// //       <div className="mb-4 grid grid-cols-3 gap-2">
// //         {/* 合計 */}
// //         <Card className="rounded-xl shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800">
// //           <CardContent className="flex flex-col items-center justify-center py-2 px-2">
// //             <div className="h-7 w-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
// //               <Car className="h-4 w-4" />
// //             </div>
// //             <div className="text-base font-semibold tabular-nums leading-none">{counts.total}</div>
// //             <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">合計</div>
// //           </CardContent>
// //         </Card>

// //         {/* 自分 */}
// //         <Card className="rounded-xl shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border border-emerald-200 dark:border-emerald-800">
// //           <CardContent className="flex flex-col items-center justify-center py-2 px-2">
// //             <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
// //               <CheckCircle2 className="h-4 w-4" />
// //             </div>
// //             <div className="text-base font-semibold tabular-nums leading-none">{counts.mine}</div>
// //             <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">自分</div>
// //           </CardContent>
// //         </Card>

// //         {/* 空き */}
// //         <Card className="rounded-xl shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border border-amber-200 dark:border-amber-800">
// //           <CardContent className="flex flex-col items-center justify-center py-2 px-2">
// //             <div className="h-7 w-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
// //               <MinusCircle className="h-4 w-4" />
// //             </div>
// //             <div className="text-base font-semibold tabular-nums leading-none">{counts.available}</div>
// //             <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">空き</div>
// //           </CardContent>
// //         </Card>
// //       </div>

// //       {/* フィルター */}
// //       <div className="mb-4 flex items-center gap-2">
// //         <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('all')}>
// //           すべて
// //         </Button>
// //         <Button size="sm" variant={filter === 'available' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('available')}>
// //           空き
// //         </Button>
// //         <Button size="sm" variant={filter === 'mine' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('mine')}>
// //           自分
// //         </Button>
// //       </div>

// //       {/* 駐車スペースリスト */}
// //       {isLoading ? (
// //         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //           {Array.from({ length: 6 }).map((_, i) => <SpotSkeleton key={i} />)}
// //         </div>
// //       ) : filtered.length === 0 ? (
// //         <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
// //           この条件に一致する駐車スペースはありません。
// //         </Card>
// //       ) : (
// //         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
// //           {filtered.map((s, idx) => {
// //             const isMine = s.isMineNow;
// //             const isBusy = s.isBusyNow;
// //             const accent =
// //               isMine ? 'from-emerald-500/15 to-emerald-500/0 border-emerald-500/30'
// //                 : isBusy ? 'from-zinc-500/10 to-zinc-500/0 border-zinc-500/20'
// //                   : 'from-sky-500/15 to-sky-500/0 border-sky-500/30';

// //             const elapsed = isMine ? formatElapsed(s.myStartTime) : null;

// //             return (
// //               <motion.div key={s.id} layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, delay: idx * 0.015 }}>
// //                 <Card className={['relative rounded-2xl px-4 py-3 border', 'hover:shadow-md transition', 'bg-gradient-to-br', accent, 'group'].join(' ')}>
// //                   <div className={['absolute left-0 top-0 h-full w-1.5 rounded-l-2xl', isMine ? 'bg-emerald-500' : isBusy ? 'bg-zinc-400' : 'bg-sky-500'].join(' ')} />
// //                   <div className="flex items-start justify-between gap-3 pl-2">
// //                     <div className="min-w-0">
// //                       <div className="text-base font-semibold truncate">{s.code}</div>
// //                       <div className="mt-1 flex items-center gap-2">
// //                         {isMine ? (
// //                           <>
// //                             <Badge className="gap-1" variant="default">
// //                               <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
// //                               自分の予約
// //                             </Badge>
// //                             {elapsed && (
// //                               <span className="inline-flex items-center text-xs text-muted-foreground gap-1 font-mono">
// //                                 <Clock className="h-3 w-3" /> {elapsed}
// //                               </span>
// //                             )}
// //                           </>
// //                         ) : isBusy ? (
// //                           <Badge variant="secondary">使用中</Badge>
// //                         ) : (
// //                           <Badge variant="outline">空き</Badge>
// //                         )}
// //                       </div>
// //                     </div>
// //                     <Button
// //                       variant={isMine ? 'default' : isBusy ? 'outline' : 'default'}
// //                       className="rounded-xl"
// //                       onClick={() => openSheet(s)}
// //                     >
// //                       {isMine ? '管理' : isBusy ? '詳細' : '予約'}
// //                     </Button>
// //                   </div>
// //                   <button
// //                     onClick={() => openSheet(s)}
// //                     className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40"
// //                     aria-label={`「${s.code}」を開く`}
// //                     style={{ pointerEvents: 'none' }}
// //                   />
// //                 </Card>
// //               </motion.div>
// //             );
// //           })}
// //         </div>
// //       )}

// //       {chosen && (
// //         <SpotBookingSheet
// //           open={open}
// //           onOpenChange={(v) => { if (!v) closeSheet(); else setOpen(true); }}
// //           spotId={chosen.id}
// //           spotCode={chosen.code}
// //           myStartTime={chosen.myStartTime ?? undefined}
// //           onSuccess={async () => {
// //             // マップ表示を即時更新
// //             const map = mapRef.current;
// //             if (map && chosen) {
// //               const nextState =
// //                 chosen.isMineNow ? 'available'
// //                   : chosen.isBusyNow ? 'busy'
// //                     : 'mine';
// //               map.setFeatureState?.({ source: SRC_ID, id: chosen.id } as any, { state: nextState });
// //             }

// //             // 閉じる & データ再取得
// //             setChosen(null);
// //             closeSheet();
// //             qc.invalidateQueries({ queryKey: ['spots', subareaId] });
// //             qc.refetchQueries({ queryKey: ['spots', subareaId], type: 'active' });
// //             qc.invalidateQueries({ queryKey: ['my-bookings'] });
// //           }}
// //         />
// //       )}
// //     </>
// //   );
// // }


// // src/pages/Spots.tsx
// import { useParams } from 'react-router-dom';
// import { useQuery, useQueryClient } from '@tanstack/react-query';
// import { api } from '../lib/api';
// import TopTitle from '../components/TopTitle';
// import { Badge } from '../components/ui/badge';
// import { Button } from '../components/ui/button';
// import { motion } from 'framer-motion';
// import { useEffect, useMemo, useRef, useState } from 'react';
// import SpotBookingSheet from '../components/SpotBookingSheet';
// import { Card } from '../components/ui/card';
// import { Skeleton } from '../components/ui/skeleton';
// import { Clock, CheckCircle2, MinusCircle, Car } from 'lucide-react';
// import maplibregl, { Map as MLMap } from 'maplibre-gl';

// // --- Turf (typed + tree-shaken) ---
// import { point, lineString, polygon, featureCollection } from '@turf/helpers';
// import destination from '@turf/destination';
// import along from '@turf/along';
// import bbox from '@turf/bbox';
// import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';

// // ===== Types =====
// type SubSpotRow = {
//   id: string;
//   code: string;
//   isBusyNow: boolean;
//   isMineNow: boolean;
//   myStartTime: string | null;
// };
// type ParentSpotRow = {
//   id: string;
//   code: string;
//   subSpots: SubSpotRow[];
// };

// // ===== Small bits =====
// function SubSpotSkeleton() {
//   return (
//     <div className="rounded-xl border p-3">
//       <div className="h-4 w-16 bg-muted rounded" />
//       <div className="mt-2 h-7 w-20 bg-muted rounded" />
//     </div>
//   );
// }
// function formatElapsed(startISO: string | null) {
//   if (!startISO) return null;
//   const ms = Date.now() - new Date(startISO).getTime();
//   if (ms < 0 || Number.isNaN(ms)) return null;
//   const s = Math.floor(ms / 1000);
//   const hh = Math.floor(s / 3600).toString().padStart(2, '0');
//   const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
//   const ss = Math.floor(s % 60).toString().padStart(2, '0');
//   return `${hh}:${mm}:${ss}`;
// }
// type FilterMode = 'all' | 'available' | 'mine';

// // ===== Map helpers =====
// const ENV_STYLE = import.meta.env.VITE_MAP_STYLE as string | undefined;
// const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';
// const MAP_STYLE = ENV_STYLE && ENV_STYLE.trim() ? ENV_STYLE : DEMO_STYLE;
// const KASHIWA: [number, number] = [139.9698, 35.8617];

// const SRC_ID = 'subspots-preview-src'; // for feature-state

// const COLOR_MINE = '#10b981';
// const COLOR_BUSY = '#9ca3af';
// const COLOR_AVAIL = '#38bdf8';

// const isStyleLoadedSafe = (m?: MLMap | null): boolean =>
//   !!(m && typeof m.isStyleLoaded === 'function' && m.isStyleLoaded());

// function runWhenStyleReady(map: MLMap, cb: () => void) {
//   if (isStyleLoadedSafe(map)) { cb(); return; }
//   const handler = () => {
//     if (isStyleLoadedSafe(map)) { map.off('styledata', handler); cb(); }
//   };
//   map.on('styledata', handler);
// }

// // seeded jitter so symbols don’t overlap when state changes
// function seededRng(seedStr: string) {
//   let s = 0;
//   for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
//   return () => (s = (s * 1664525 + 1013904223) >>> 0, s / 2 ** 32);
// }
// const hash01 = (str: string) => {
//   let h = 2166136261 >>> 0;
//   for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
//   return (h >>> 0) / 2 ** 32;
// };

// // Build a deterministic “random road” and place sub-spots (as slots) along it.
// // We’ll show up to N=30 sub-spots to keep it readable.
// function buildPreviewFeatures(
//   seed: string,
//   flatSubSpots: SubSpotRow[]
// ): FeatureCollection<LineString | Polygon> {
//   const rand = seededRng(seed);

//   const bearingDeg = Math.floor(rand() * 180); // 0..179
//   const offsetLon = (rand() - 0.5) * 0.003;    // ~±3000m lon
//   const offsetLat = (rand() - 0.5) * 0.002;    // ~±2000m lat
//   const center = point([KASHIWA[0] + offsetLon, KASHIWA[1] + offsetLat]);

//   // Road length ~ 300 m
//   const lenKm = 0.3 / 1000;
//   const start = destination(center, lenKm / 2, bearingDeg, { units: 'kilometers' });
//   const end = destination(center, lenKm / 2, bearingDeg + 180, { units: 'kilometers' });
//   const road = lineString(
//     [start.geometry.coordinates, end.geometry.coordinates],
//     { type: 'road', color: '#64748b' } // zinc-500
//   ) as Feature<LineString>;

//   // Show up to N sub-spots
//   const pick = [...flatSubSpots]
//     .sort((a, b) => a.code.localeCompare(b.code))
//     .slice(0, 30);

//   const n = Math.max(1, pick.length);
//   const spacingKm = lenKm / (n + 1);

//   // Slot size (slightly larger than reality for visibility)
//   const widthKm = 2.7 / 1000;  // 2.7 m across
//   const depthKm = 5.4 / 1000;  // 5.4 m away from road

//   const slots: Feature<Polygon>[] = [];

//   for (let i = 0; i < pick.length; i++) {
//     const s = pick[i];

//     // unique jitter per sub-spot
//     const h = hash01(s.id);
//     const jitter = (h - 0.5) * spacingKm * 0.6; // up to ±30% of spacing
//     const dKm = spacingKm * (i + 1) + jitter;

//     // side: -1 (left) or +1 (right)
//     const sideSign = h < 0.5 ? -1 : 1;

//     const mid = along(road, dKm, { units: 'kilometers' }); // point on road
//     const pA = destination(mid, widthKm / 2, bearingDeg, { units: 'kilometers' });
//     const pB = destination(mid, widthKm / 2, bearingDeg + 180, { units: 'kilometers' });

//     // push outward perpendicular
//     const outward = bearingDeg + (90 * sideSign);
//     const pA2 = destination(pA, depthKm, outward, { units: 'kilometers' });
//     const pB2 = destination(pB, depthKm, outward, { units: 'kilometers' });

//     const ring: Position[] = [
//       pB.geometry.coordinates,
//       pA.geometry.coordinates,
//       pA2.geometry.coordinates,
//       pB2.geometry.coordinates,
//       pB.geometry.coordinates,
//     ];

//     const state = s.isMineNow ? 'mine' : s.isBusyNow ? 'busy' : 'available';
//     const fill = state === 'mine' ? COLOR_MINE : state === 'busy' ? COLOR_BUSY : COLOR_AVAIL;
//     const poly = polygon([ring], {
//       type: 'slot',
//       code: s.code,
//       subSpotId: s.id, // (optional) promoteId target – we also set feature.id
//       state,
//       color: fill,
//     }) as Feature<Polygon>;

//     poly.id = s.id; // stable feature id so setFeatureState({ id }) works
//     slots.push(poly);
//   }

//   const fc = featureCollection<LineString | Polygon>([road, ...slots]);
//   return fc as FeatureCollection<LineString | Polygon>;
// }

// export default function Spots() {
//   const { subareaId } = useParams();
//   const qc = useQueryClient();

//   const { data, isLoading } = useQuery({
//     queryKey: ['spots', subareaId],
//     queryFn: async () => (await api.get(`/api/spots/by-subarea/${subareaId}`)).data,
//     enabled: !!subareaId,
//   });

//   const parents: ParentSpotRow[] = (data?.spots ?? []) as ParentSpotRow[];
//   const flatAll = useMemo(() => parents.flatMap(p => p.subSpots), [parents]);

//   const [open, setOpen] = useState(false);
//   const [chosen, setChosen] = useState<SubSpotRow | null>(null);
//   const [filter, setFilter] = useState<FilterMode>('all');

//   const counts = useMemo(() => ({
//     total: flatAll.length,
//     busy: flatAll.filter(s => s.isBusyNow).length,
//     mine: flatAll.filter(s => s.isMineNow).length,
//     available: flatAll.filter(s => !s.isBusyNow).length,
//   }), [flatAll]);

//   // filter predicate for both grid and map preview
//   const filterFn = (s: SubSpotRow) =>
//     filter === 'available' ? !s.isBusyNow :
//     filter === 'mine' ? s.isMineNow : true;

//   const filteredParents = useMemo(() => {
//     return parents.map(p => ({
//       ...p,
//       subSpots: p.subSpots.filter(filterFn),
//     })).filter(p => p.subSpots.length > 0 || filter === 'all');
//   }, [parents, filter]);

//   const filteredFlat = useMemo(
//     () => flatAll.filter(filterFn),
//     [flatAll, filter]
//   );

//   const openSheet = (s: SubSpotRow) => { setChosen(s); setOpen(true); };
//   const closeSheet = () => setOpen(false);

//   // ========== Map preview ==========
//   const mapRef = useRef<MLMap | null>(null);
//   const mapElRef = useRef<HTMLDivElement | null>(null);
//   const [styleReady, setStyleReady] = useState(false);

//   const previewFC = useMemo<FeatureCollection<LineString | Polygon>>(
//     () => buildPreviewFeatures(subareaId ?? 'seed', filteredFlat),
//     [subareaId, filteredFlat]
//   );

//   // visibility/size helpers
//   const ensureContainerReady = (el: HTMLElement | null) => {
//     if (!el) return false;
//     const r = el.getBoundingClientRect();
//     return r.width > 0 && r.height > 0;
//   };
//   const kickResize = (map: MLMap) => {
//     map.resize();
//     requestAnimationFrame(() => {
//       map.resize();
//       requestAnimationFrame(() => map.resize());
//     });
//     setTimeout(() => map.resize(), 50);
//     setTimeout(() => map.resize(), 250);
//   };

//   // init map once
//   useEffect(() => {
//     if (mapRef.current) return;

//     let cancelled = false;
//     const waitAndInit = () => {
//       if (cancelled) return;
//       const el = mapElRef.current;
//       if (!el || !ensureContainerReady(el) || document.visibilityState !== 'visible') {
//         requestAnimationFrame(waitAndInit);
//         return;
//       }

//       const map = new maplibregl.Map({
//         container: el,
//         style: MAP_STYLE,
//         center: KASHIWA,
//         zoom: 15,
//         attributionControl: false,
//         interactive: true,
//       });
//       mapRef.current = map;

//       // Style lifecycle
//       const onLoad = () => { setStyleReady(true); kickResize(map); };
//       const onStyleData = () => { setStyleReady(isStyleLoadedSafe(map)); if (isStyleLoadedSafe(map)) kickResize(map); };
//       map.on('load', onLoad);
//       map.on('styledata', onStyleData);

//       map.on('error', (e) => {
//         const msg = (e as any)?.error?.message || '';
//         // eslint-disable-next-line no-console
//         console.error('[MapLibre error]', e);
//         if (MAP_STYLE !== DEMO_STYLE && /style|fetch|network|json/i.test(msg)) {
//           map.setStyle(DEMO_STYLE);
//         }
//       });

//       map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

//       // Resize observers
//       const ro = new ResizeObserver(() => kickResize(map));
//       ro.observe(el);

//       const onWinResize = () => kickResize(map);
//       window.addEventListener('resize', onWinResize);

//       const io = new IntersectionObserver((entries) => {
//         if (entries.some(en => en.isIntersecting)) kickResize(map);
//       }, { threshold: [0, 0.1, 0.5, 1] });
//       io.observe(el);

//       const onVis = () => { if (document.visibilityState === 'visible') kickResize(map); };
//       document.addEventListener('visibilitychange', onVis);

//       // Cleanup
//       return () => {
//         io.disconnect();
//         ro.disconnect();
//         window.removeEventListener('resize', onWinResize);
//         document.removeEventListener('visibilitychange', onVis);
//         map.off('load', onLoad);
//         map.off('styledata', onStyleData);
//         map.remove();
//         mapRef.current = null;
//       };
//     };

//     waitAndInit();
//     return () => { cancelled = true; };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // add/update preview layers (replace data; never append)
//   useEffect(() => {
//     const map = mapRef.current;
//     if (!map || !styleReady) return;

//     runWhenStyleReady(map, () => {
//       const ROAD = 'subspots-road';
//       const SLOTS_FILL = 'subspots-slots-fill';
//       const SLOTS_LINE = 'subspots-slots-line';
//       const SLOTS_LABEL = 'subspots-slots-label';

//       const data = previewFC as unknown as GeoJSON.FeatureCollection;

//       if (map.getSource(SRC_ID)) {
//         (map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(data);
//       } else {
//         map.addSource(SRC_ID, {
//           type: 'geojson',
//           data,
//           // we set feature.id above, so promoteId is optional
//         } as any);
//       }

//       const ensure = (id: string, layer: any) => {
//         if (map.getLayer(id)) map.removeLayer(id);
//         map.addLayer(layer as any);
//       };

//       ensure(ROAD, {
//         id: ROAD,
//         type: 'line',
//         source: SRC_ID,
//         filter: ['==', ['get', 'type'], 'road'],
//         paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.8 },
//       });

//       const colorExpr = [
//         'case',
//         ['==', ['feature-state', 'state'], 'mine'], COLOR_MINE,
//         ['==', ['feature-state', 'state'], 'busy'], COLOR_BUSY,
//         ['==', ['feature-state', 'state'], 'available'], COLOR_AVAIL,
//         ['get', 'color'],
//       ] as any;

//       ensure(SLOTS_FILL, {
//         id: SLOTS_FILL,
//         type: 'fill',
//         source: SRC_ID,
//         filter: ['==', ['get', 'type'], 'slot'],
//         paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
//       });

//       ensure(SLOTS_LINE, {
//         id: SLOTS_LINE,
//         type: 'line',
//         source: SRC_ID,
//         filter: ['==', ['get', 'type'], 'slot'],
//         paint: { 'line-color': colorExpr, 'line-width': 2, 'line-opacity': 0.9 },
//       });

//       ensure(SLOTS_LABEL, {
//         id: SLOTS_LABEL,
//         type: 'symbol',
//         source: SRC_ID,
//         filter: ['==', ['get', 'type'], 'slot'],
//         layout: { 'text-field': ['get', 'code'], 'text-size': 10, 'text-allow-overlap': true },
//         paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
//       });

//       // Fit to preview bounds
//       const [minX, minY, maxX, maxY] = bbox(data);
//       const bounds = new maplibregl.LngLatBounds([minX, minY], [maxX, maxY]);
//       map.fitBounds(bounds, { padding: 24, duration: 300 });

//       // IMPORTANT: clear previous optimistic overrides after new data arrives
//       map.removeFeatureState?.({ source: SRC_ID } as any);
//     });
//   }, [styleReady, previewFC]);

//   return (
//     <>
//       <TopTitle title="駐車スペース" subtitle={`自分: ${counts.mine}件 · 使用中: ${counts.busy}/${counts.total}`} />

//       {/* Map preview (kept) */}
//       <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border mb-4 z-0">
//         <div ref={mapElRef} className="absolute inset-0 z-0 h-64 w-full" />
//         <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-background/80 border rounded-xl px-3 py-2 text-xs">
//           <span className="inline-flex items-center gap-1">
//             <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> 自分
//           </span>
//           <span className="inline-flex items-center gap-1">
//             <span className="inline-block h-2 w-2 rounded bg-zinc-400" /> 使用中
//           </span>
//           <span className="inline-flex items-center gap-1">
//             <span className="inline-block h-2 w-2 rounded bg-sky-400" /> 空き
//           </span>
//         </div>
//       </div>

//       {/* Compact stat pills */}
//       <div className="mb-3 grid grid-cols-3 gap-2">
//         <Card className="rounded-2xl px-3 py-2 flex items-center gap-2">
//           <Car className="h-4 w-4" />
//           <div className="text-sm font-medium">合計</div>
//           <div className="ml-auto text-sm tabular-nums">{counts.total}</div>
//         </Card>
//         <Card className="rounded-2xl px-3 py-2 flex items-center gap-2">
//           <CheckCircle2 className="h-4 w-4" />
//           <div className="text-sm font-medium">自分</div>
//           <div className="ml-auto text-sm tabular-nums">{counts.mine}</div>
//         </Card>
//         <Card className="rounded-2xl px-3 py-2 flex items-center gap-2">
//           <MinusCircle className="h-4 w-4" />
//           <div className="text-sm font-medium">空き</div>
//           <div className="ml-auto text-sm tabular-nums">{counts.available}</div>
//         </Card>
//       </div>

//       {/* Filters */}
//       <div className="mb-4 flex items-center gap-2">
//         <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('all')}>すべて</Button>
//         <Button size="sm" variant={filter === 'available' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('available')}>空き</Button>
//         <Button size="sm" variant={filter === 'mine' ? 'default' : 'outline'} className="rounded-full" onClick={() => setFilter('mine')}>自分</Button>
//       </div>

//       {/* Parent → Sub-spot grid */}
//       {isLoading ? (
//         <div className="space-y-3">
//           {Array.from({ length: 3 }).map((_, i) => (
//             <Card key={i} className="rounded-2xl p-4">
//               <div className="h-5 w-28"><Skeleton className="h-5 w-full rounded" /></div>
//               <div className="mt-3 grid grid-cols-3 gap-2">
//                 {Array.from({ length: 6 }).map((_, j) => <SubSpotSkeleton key={j} />)}
//               </div>
//             </Card>
//           ))}
//         </div>
//       ) : filteredParents.length === 0 ? (
//         <Card className="rounded-2xl p-6 text-sm text-muted-foreground">この条件に一致するサブスポットはありません。</Card>
//       ) : (
//         <div className="space-y-3">
//           {filteredParents.map((p) => (
//             <Card key={p.id} className="rounded-2xl p-4 border">
//               <div className="flex items-center justify-between">
//                 <div className="text-base font-semibold">スポット {p.code}</div>
//                 <Badge variant="secondary">{p.subSpots.length} / {parents.find(x => x.id === p.id)?.subSpots.length ?? 0} 表示</Badge>
//               </div>

//               <div className="mt-3 grid grid-cols-3 gap-2">
//                 {p.subSpots.map((s, idx) => {
//                   const isMine = s.isMineNow;
//                   const isBusy = s.isBusyNow;
//                   const elapsed = isMine ? formatElapsed(s.myStartTime) : null;
//                   const accent =
//                     isMine ? 'from-emerald-500/15 to-emerald-500/0 border-emerald-500/30'
//                     : isBusy ? 'from-zinc-500/10 to-zinc-500/0 border-zinc-500/20'
//                     : 'from-sky-500/15 to-sky-500/0 border-sky-500/30';

//                   return (
//                     <motion.div key={s.id} layout initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, delay: idx * 0.02 }}>
//                       <div className={['rounded-xl p-3 border bg-gradient-to-br', accent].join(' ')}>
//                         <div className="text-sm font-medium truncate">{s.code}</div>
//                         <div className="mt-1 flex items-center gap-2">
//                           {isMine ? (
//                             <>
//                               <Badge className="gap-1" variant="default">
//                                 <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
//                                 自分の予約
//                               </Badge>
//                               {elapsed && (
//                                 <span className="inline-flex items-center text-[11px] text-muted-foreground gap-1 font-mono">
//                                   <Clock className="h-3 w-3" /> {elapsed}
//                                 </span>
//                               )}
//                             </>
//                           ) : isBusy ? (
//                             <Badge variant="secondary">使用中</Badge>
//                           ) : (
//                             <Badge variant="outline">空き</Badge>
//                           )}
//                         </div>
//                         <Button
//                           size="sm"
//                           className="rounded-xl w-full mt-2"
//                           variant={isMine ? 'default' : isBusy ? 'outline' : 'default'}
//                           onClick={() => openSheet(s)}
//                         >
//                           {isMine ? '管理' : isBusy ? '詳細' : '予約'}
//                         </Button>
//                       </div>
//                     </motion.div>
//                   );
//                 })}
//               </div>
//             </Card>
//           ))}
//         </div>
//       )}

//       {chosen && (
//         <SpotBookingSheet
//           open={open}
//           onOpenChange={(v) => { if (!v) closeSheet(); else setOpen(true); }}
//           subSpotId={chosen.id}
//           subSpotCode={chosen.code}
//           myStartTime={chosen.myStartTime ?? undefined}
//           onSuccess={async () => {
//             // Optimistic tint on map for this sub-spot
//             const map = mapRef.current;
//             if (map && chosen) {
//               const nextState =
//                 chosen.isMineNow ? 'available' // you ended your booking
//                 : chosen.isBusyNow ? 'busy'     // someone else had it; safe no-op tint
//                 : 'mine';                        // you just booked
//               map.setFeatureState?.({ source: SRC_ID, id: chosen.id } as any, { state: nextState });
//             }

//             setChosen(null);
//             closeSheet();

//             // refresh data
//             qc.invalidateQueries({ queryKey: ['spots', subareaId] });
//             qc.refetchQueries({ queryKey: ['spots', subareaId], type: 'active' });
//             qc.invalidateQueries({ queryKey: ['my-bookings'] });
//           }}
//         />
//       )}
//     </>
//   );
// }


import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import SpotBookingSheet from '../components/SpotBookingSheet';
import { Card, CardContent } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Clock, CheckCircle2, MinusCircle, Car } from 'lucide-react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';

// --- Turf ---
import { point, lineString, polygon, featureCollection } from '@turf/helpers';
import destination from '@turf/destination';
import along from '@turf/along';
import bbox from '@turf/bbox';
import type { Feature, FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// ===== Types =====
type SubSpotRow = {
  id: string;
  code: string;
  isBusyNow: boolean;
  isMineNow: boolean;
  myStartTime: string | null;
};
type ParentSpotRow = {
  id: string;
  code: string;
  subSpots: SubSpotRow[];
};

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
type FilterMode = 'all' | 'available' | 'mine';

// ===== Map helpers =====
const ENV_STYLE = import.meta.env.VITE_MAP_STYLE as string | undefined;
const DEMO_STYLE = 'https://demotiles.maplibre.org/style.json';
const MAP_STYLE = ENV_STYLE && ENV_STYLE.trim() ? ENV_STYLE : DEMO_STYLE;
const KASHIWA: [number, number] = [139.9698, 35.8617];

const SRC_ID = 'subspots-preview-src'; // for feature-state

const COLOR_MINE = '#10b981';
const COLOR_BUSY = '#9ca3af';
const COLOR_AVAIL = '#38bdf8';

const isStyleLoadedSafe = (m?: MLMap | null): boolean =>
  !!(m && typeof m.isStyleLoaded === 'function' && m.isStyleLoaded());

function runWhenStyleReady(map: MLMap, cb: () => void) {
  if (isStyleLoadedSafe(map)) { cb(); return; }
  const handler = () => {
    if (isStyleLoadedSafe(map)) { map.off('styledata', handler); cb(); }
  };
  map.on('styledata', handler);
}

// seeded jitter so symbols don’t overlap when state changes
function seededRng(seedStr: string) {
  let s = 0;
  for (let i = 0; i < seedStr.length; i++) s = (s * 31 + seedStr.charCodeAt(i)) >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0, s / 2 ** 32);
}
const hash01 = (str: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0) / 2 ** 32;
};

// Build a deterministic “random road” and place sub-spots (as slots) along it.
// We’ll show up to N=30 sub-spots to keep it readable.
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
  const road = lineString(
    [start.geometry.coordinates, end.geometry.coordinates],
    { type: 'road', color: '#64748b' } // zinc-500
  ) as Feature<LineString>;

  const pick = [...flatSubSpots].sort((a, b) => a.code.localeCompare(b.code)).slice(0, 30);
  const n = Math.max(1, pick.length);
  const spacingKm = lenKm / (n + 1);

  const widthKm = 2.7 / 1000;  // 2.7 m across
  const depthKm = 5.4 / 1000;  // 5.4 m away from road

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

    const outward = bearingDeg + (90 * sideSign);
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
    const poly = polygon([ring], {
      type: 'slot',
      code: s.code,
      subSpotId: s.id,
      state,
      color: fill,
    }) as Feature<Polygon>;

    poly.id = s.id;
    slots.push(poly);
  }

  const fc = featureCollection<LineString | Polygon>([road, ...slots]);
  return fc as FeatureCollection<LineString | Polygon>;
}

export default function Spots() {
  const { subareaId } = useParams();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['spots', subareaId],
    queryFn: async () => (await api.get(`/api/spots/by-subarea/${subareaId}`)).data,
    enabled: !!subareaId,
  });

  const parents: ParentSpotRow[] = (data?.spots ?? []) as ParentSpotRow[];
  const flatAll = useMemo(() => parents.flatMap(p => p.subSpots), [parents]);

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<SubSpotRow | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  const counts = useMemo(() => ({
    total: flatAll.length,
    busy: flatAll.filter(s => s.isBusyNow).length,
    mine: flatAll.filter(s => s.isMineNow).length,
    available: flatAll.filter(s => !s.isBusyNow).length,
  }), [flatAll]);

  const filterFn = (s: SubSpotRow) =>
    filter === 'available' ? !s.isBusyNow :
      filter === 'mine' ? s.isMineNow : true;

  const filteredParents = useMemo(() => {
    return parents.map(p => ({
      ...p,
      subSpots: p.subSpots.filter(filterFn),
    })).filter(p => p.subSpots.length > 0 || filter === 'all');
  }, [parents, filter]);

  const origParentMap = useMemo(() => {
    const m = new Map<string, ParentSpotRow>();
    parents.forEach(p => m.set(p.id, p));
    return m;
  }, [parents]);

  const filteredFlat = useMemo(() => flatAll.filter(filterFn), [flatAll, filter]);

  const openSheet = (s: SubSpotRow) => { setChosen(s); setOpen(true); };
  const closeSheet = () => setOpen(false);

  // ========== Map preview ==========
  const mapRef = useRef<MLMap | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  const previewFC = useMemo<FeatureCollection<LineString | Polygon>>(
    () => buildPreviewFeatures(subareaId ?? 'seed', filteredFlat),
    [subareaId, filteredFlat]
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

  useEffect(() => {
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
    const map = mapRef.current;
    if (!map || !styleReady) return;

    runWhenStyleReady(map, () => {
      const ROAD = 'subspots-road';
      const SLOTS_FILL = 'subspots-slots-fill';
      const SLOTS_LINE = 'subspots-slots-line';
      const SLOTS_LABEL = 'subspots-slots-label';

      const data = previewFC as unknown as GeoJSON.FeatureCollection;

      if (map.getSource(SRC_ID)) {
        (map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(data);
      } else {
        map.addSource(SRC_ID, { type: 'geojson', data } as any);
      }

      const ensure = (id: string, layer: any) => {
        if (map.getLayer(id)) map.removeLayer(id);
        map.addLayer(layer as any);
      };

      ensure(ROAD, {
        id: ROAD,
        type: 'line',
        source: SRC_ID,
        filter: ['==', ['get', 'type'], 'road'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.8 },
      });

      const colorExpr = [
        'case',
        ['==', ['feature-state', 'state'], 'mine'], COLOR_MINE,
        ['==', ['feature-state', 'state'], 'busy'], COLOR_BUSY,
        ['==', ['feature-state', 'state'], 'available'], COLOR_AVAIL,
        ['get', 'color'],
      ] as any;

      ensure(SLOTS_FILL, {
        id: SLOTS_FILL,
        type: 'fill',
        source: SRC_ID,
        filter: ['==', ['get', 'type'], 'slot'],
        paint: { 'fill-color': colorExpr, 'fill-opacity': 0.7 },
      });

      ensure(SLOTS_LINE, {
        id: SLOTS_LINE,
        type: 'line',
        source: SRC_ID,
        filter: ['==', ['get', 'type'], 'slot'],
        paint: { 'line-color': colorExpr, 'line-width': 2, 'line-opacity': 0.9 },
      });

      ensure(SLOTS_LABEL, {
        id: SLOTS_LABEL,
        type: 'symbol',
        source: SRC_ID,
        filter: ['==', ['get', 'type'], 'slot'],
        layout: { 'text-field': ['get', 'code'], 'text-size': 10, 'text-allow-overlap': true },
        paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
      });

      const [minX, minY, maxX, maxY] = bbox(data);
      const bounds = new maplibregl.LngLatBounds([minX, minY], [maxX, maxY]);
      map.fitBounds(bounds, { padding: 24, duration: 300 });

      map.removeFeatureState?.({ source: SRC_ID } as any);
    });
  }, [styleReady, previewFC]);

  // ===========================
  // ===== UI BELOW THE MAP ====
  // ===========================
  return (
    <>
      <TopTitle title="駐車スペース" subtitle={`自分: ${counts.mine}件 · 使用中: ${counts.busy}/${counts.total}`} />

      {/* Map preview */}
      <div className="relative w-full h-64 sm:h-80 rounded-2xl overflow-hidden border mb-3 z-0">
        <div ref={mapElRef} className="absolute inset-0 z-0 h-64 w-full" />
        <div className="absolute left-3 bottom-3 flex items-center gap-2 bg-background/80 border rounded-xl px-3 py-2 text-xs">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded bg-emerald-500" /> 自分
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded bg-zinc-400" /> 使用中
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded bg-sky-400" /> 空き
          </span>
        </div>
      </div>

      {/* Compact metric chips (scrollable on mobile) */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {/* Total */}
        <Card className="rounded-xl shadow-sm bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border border-blue-200 dark:border-blue-800">
          <CardContent className="flex flex-col items-center justify-center py-2 px-2">
            <div className="h-7 w-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-1">
              <Car className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold tabular-nums leading-none">{counts.total}</div>
            <div className="text-[10px] text-blue-700 dark:text-blue-300 mt-0.5">Total</div>
          </CardContent>
        </Card>

        {/* Mine */}
        <Card className="rounded-xl shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border border-emerald-200 dark:border-emerald-800">
          <CardContent className="flex flex-col items-center justify-center py-2 px-2">
            <div className="h-7 w-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold tabular-nums leading-none">{counts.mine}</div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-300 mt-0.5">Mine</div>
          </CardContent>
        </Card>

        {/* Available */}
        <Card className="rounded-xl shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border border-amber-200 dark:border-amber-800">
          <CardContent className="flex flex-col items-center justify-center py-2 px-2">
            <div className="h-7 w-7 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1">
              <MinusCircle className="h-4 w-4" />
            </div>
            <div className="text-base font-semibold tabular-nums leading-none">{counts.available}</div>
            <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">Available</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter bar (full-width buttons on mobile) */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} className="rounded-full h-9" onClick={() => setFilter('all')}>すべて</Button>
        <Button size="sm" variant={filter === 'available' ? 'default' : 'outline'} className="rounded-full h-9" onClick={() => setFilter('available')}>空き</Button>
        <Button size="sm" variant={filter === 'mine' ? 'default' : 'outline'} className="rounded-full h-9" onClick={() => setFilter('mine')}>自分</Button>
      </div>

      {/* Parent → Sub-spot groups (Accordion for space efficiency) */}
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
                    <div className="text-base font-semibold">スポット {p.code}</div>
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
                        >
                          <div className={['rounded-xl p-3 border bg-gradient-to-br', accent].join(' ')}>
                            <div className="text-sm font-medium truncate">{s.code}</div>
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
                              aria-label={`${s.code} を${isMine ? '管理' : isBusy ? '詳細' : '予約'}`}
                            >
                              {isMine ? '管理' : isBusy ? '詳細' : '予約'}
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
          subSpotCode={chosen.code}
          myStartTime={chosen.myStartTime ?? undefined}
          onSuccess={async () => {
            const map = mapRef.current;
            if (map && chosen) {
              const nextState =
                chosen.isMineNow ? 'available'
                  : chosen.isBusyNow ? 'busy'
                    : 'mine';
              map.setFeatureState?.({ source: SRC_ID, id: chosen.id } as any, { state: nextState });
            }

            setChosen(null);
            closeSheet();
            qc.invalidateQueries({ queryKey: ['spots', subareaId] });
            qc.refetchQueries({ queryKey: ['spots', subareaId], type: 'active' });
            qc.invalidateQueries({ queryKey: ['my-bookings'] });
          }}
        />
      )}
    </>
  );
}
