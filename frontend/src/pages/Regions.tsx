

// // src/pages/Regions.tsx
// import { useEffect, useMemo, useState } from 'react';
// import { useQuery } from '@tanstack/react-query';
// import { motion, AnimatePresence } from 'framer-motion';
// import { Link, useNavigate } from 'react-router-dom';

// import TopTitle from '../components/TopTitle';
// import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
// import { Badge } from '../components/ui/badge';
// import { Input } from '../components/ui/input';
// import { Button } from '../components/ui/button';
// import { api } from '../lib/api';
// import MapHighlight from '../components/MapHighlight';

// import {
//   Copy,
//   Check,
//   Compass,
//   Grid2X2,
//   Sparkles,
//   Search,
//   X,
//   MapPin,
//   RefreshCw,
//   MapPinned,
// } from 'lucide-react';

// import type { Feature, Polygon, MultiPolygon } from 'geojson';

// type Region = {
//   id: string;
//   name: string;
//   code?: string | null;
// //   spotsCount?: number;
//   // NEW: geometry provided by backend (Polygon Feature or Geometry)
//   geom?: any | null;
//   geometry?: any | null;
// };

// const ACCENTS = [
//   { bar: 'bg-rose-500',    ring: 'from-rose-500/15',   hex: '#f43f5e' },
//   { bar: 'bg-amber-500',   ring: 'from-amber-500/15',  hex: '#f59e0b' },
//   { bar: 'bg-emerald-500', ring: 'from-emerald-500/15',hex: '#10b981' },
//   { bar: 'bg-sky-500',     ring: 'from-sky-500/15',    hex: '#38bdf8' },
//   { bar: 'bg-violet-500',  ring: 'from-violet-500/15', hex: '#8b5cf6' },
//   { bar: 'bg-pink-500',    ring: 'from-pink-500/15',   hex: '#ec4899' },
// ];
// const pickAccent = (seed: string | undefined) => {
//   const n = (seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
//   return ACCENTS[(n % ACCENTS.length + ACCENTS.length) % ACCENTS.length];
// };

// function RegionSkeleton() {
//   return (
//     <Card className="rounded-2xl p-4 overflow-hidden relative">
//       <div className="absolute left-0 top-0 h-full w-1.5 bg-muted" />
//       <div className="animate-pulse">
//         <div className="h-5 w-40 bg-muted rounded mb-3" />
//         <div className="h-4 w-28 bg-muted rounded" />
//         <div className="mt-4 h-8 w-28 bg-muted rounded" />
//       </div>
//     </Card>
//   );
// }

// // tiny helper to highlight search matches
// const highlight = (text: string, q: string) => {
//   if (!q) return text;
//   const idx = text.toLowerCase().indexOf(q.toLowerCase());
//   if (idx < 0) return text;
//   const before = text.slice(0, idx);
//   const match = text.slice(idx, idx + q.length);
//   const after = text.slice(idx + q.length);
//   return (
//     <>
//       {before}
//       <mark className="rounded bg-yellow-200/60 px-0.5">{match}</mark>
//       {after}
//     </>
//   );
// };

// export default function Regions() {
//   const navigate = useNavigate();

//   const { data, isLoading, isFetching, error, refetch } = useQuery({
//     queryKey: ['regions'],
//     queryFn: async () => (await api.get('/api/regions')).data,
//   });

//   const regions: Region[] = (data?.regions ?? []) as Region[];

//   // UI state
//   const [q, setQ] = useState('');
//   const [debouncedQ, setDebouncedQ] = useState('');
//   const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
//   const [copiedId, setCopiedId] = useState<string | null>(null);
//   const [activeIdx, setActiveIdx] = useState<number | null>(null); // ← sync with map

//   // debounce search for smoother typing
//   useEffect(() => {
//     const t = setTimeout(() => setDebouncedQ(q.trim()), 200);
//     return () => clearTimeout(t);
//   }, [q]);

//   const total = regions.length;
//   const filtered = useMemo(() => {
//     const list = regions
//       .filter((r) => {
//         if (!debouncedQ) return true;
//         const hay = `${r.name} ${r.code ?? ''}`.toLowerCase();
//         return hay.includes(debouncedQ.toLowerCase());
//       })
//       .sort((a, b) => {
//         if (sortBy === 'name') return a.name.localeCompare(b.name);
//         return (a.code ?? '').localeCompare(b.code ?? '');
//       });
//     return list;
//   }, [regions, debouncedQ, sortBy]);

//   // Map features (rectangles) for regions
//   const features = useMemo(() => {
//     return filtered
//       .map((r, i) => {
//         const geom = (r as any).geom ?? (r as any).geometry;
//         if (!geom) return null;
//         const accent = pickAccent(r.id || r.code || r.name);
//         return {
//           type: 'Feature',
//           id: r.id,
//           properties: {
//             id: r.id,
//             name: r.name,
//             code: r.code ?? '',
//             color: accent.hex, // ← map fill color matches card accent
//           },
//           geometry: geom, // MapHighlight sanitizes Feature/Geometry, rings, and lat-lon
//         } as Feature<Polygon | MultiPolygon>;
//       })
//       .filter(Boolean) as Feature<Polygon | MultiPolygon>[];
//   }, [filtered]);

//   const onCopy = async (text: string, regionId: string) => {
//     if (!text) return;
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopiedId(regionId);
//       setTimeout(() => setCopiedId(null), 1000);
//     } catch {
//       /* ignore */
//     }
//   };

//   return (
//     <>
//       {/* Page header */}
//       <TopTitle title="地域を選択" subtitle="柏エリア" />

//       {/* Map preview of all regions */}
//       {!isLoading && filtered.length > 0 && (
//         <div className="mb-3">
//           <MapHighlight
//             // give the map a stable but present key so it refreshes on data changes smoothly
//             key={`regions-map-${filtered.length}`}
//             features={features}
//             selectedIndex={activeIdx ?? undefined}
//             onFeatureClick={(idx) => {
//               const r = filtered[idx];
//               if (r) navigate(`/r/${r.id}`);
//             }}
            
            
//           />
//         </div>
//       )}

//       {/* Sticky toolbar */}
//       <div className="sticky top-16 z-10 mb-4">
//         <Card className="rounded-2xl border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
//           <CardContent className="p-3">
//             <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
//               {/* Search */}
//               <div className="relative flex-1">
//                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   value={q}
//                   onChange={(e) => setQ(e.target.value)}
//                   placeholder="地域名またはコードで検索…"
//                   className="rounded-xl pl-9"
//                 />
//                 {q && (
//                   <button
//                     aria-label="検索をクリア"
//                     className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
//                     onClick={() => setQ('')}
//                   >
//                     <X className="h-4 w-4" />
//                   </button>
//                 )}
//               </div>

//               {/* Sort toggle */}
//               <div className="flex gap-2">
//                 <Button
//                   variant={sortBy === 'name' ? 'default' : 'outline'}
//                   className="rounded-full"
//                   onClick={() => setSortBy('name')}
//                 >
//                   <Compass className="h-4 w-4 mr-2" />
//                   名前
//                 </Button>
//                 <Button
//                   variant={sortBy === 'code' ? 'default' : 'outline'}
//                   className="rounded-full"
//                   onClick={() => setSortBy('code')}
//                 >
//                   <Grid2X2 className="h-4 w-4 mr-2" />
//                   コード
//                 </Button>
//                 <Button
//                   variant="ghost"
//                   className="rounded-full"
//                   onClick={() => refetch()}
//                   disabled={isFetching}
//                 >
//                   <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
//                   更新
//                 </Button>
//               </div>
//             </div>

//             {/* Meta row */}
//             <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
//               <Badge variant="secondary" className="rounded-full">
//                 合計: <span className="ml-1 tabular-nums">{total}</span>
//               </Badge>
//               <span>•</span>
//               <span>
//                 表示中: <span className="tabular-nums">{filtered.length}</span>
//                 {debouncedQ ? <> 件 （検索キーワード: “{debouncedQ}”）</> : null}
//               </span>
//             </div>
//           </CardContent>
//         </Card>
//       </div>

//       {/* Error state */}
//       {error ? (
//         <Card className="rounded-2xl p-6 text-sm">
//           <div className="flex items-start gap-3">
//             <MapPin className="h-5 w-5 text-destructive mt-0.5" />
//             <div>
//               <div className="font-medium">地域を読み込めませんでした。</div>
//               <div className="text-muted-foreground mt-1">
//                 もう一度お試しいただくか、ネットワーク接続をご確認ください。
//               </div>
//               <div className="mt-3">
//                 <Button size="sm" onClick={() => refetch()}>再試行</Button>
//               </div>
//             </div>
//           </div>
//         </Card>
//       ) : isLoading ? (
//         <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
//           {Array.from({ length: 9 }).map((_, i) => <RegionSkeleton key={i} />)}
//         </div>
//       ) : filtered.length === 0 ? (
//         <Card className="rounded-2xl p-8">
//           <div className="flex flex-col items-center text-center gap-2">
//             <Sparkles className="h-6 w-6 text-muted-foreground" />
//             <div className="text-sm text-muted-foreground">
//               “{debouncedQ}” に一致する地域はありません。
//             </div>
//             <div className="flex gap-2 mt-2">
//               <Button variant="outline" size="sm" onClick={() => setQ('')} disabled={!debouncedQ}>
//                 現在の検索をクリア
//               </Button>
//               <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
//                 {isFetching ? '更新中…' : 'データを更新'}
//               </Button>
//             </div>
//           </div>
//         </Card>
//       ) : (
//         <div
//           className="
//             grid gap-3
//             grid-cols-1
//             sm:grid-cols-2
//             xl:grid-cols-3
//             [@media(min-width:1800px)]:grid-cols-4
//           "
//         >
//           <AnimatePresence mode="popLayout">
//             {filtered.map((r, idx) => {
//               const accent = pickAccent(r.id || r.code || r.name);
//               const code = r.code || '—';
//               return (
//                 <motion.div
//                   key={r.id}
//                   initial={{ opacity: 0, y: 8, scale: 0.98 }}
//                   animate={{ opacity: 1, y: 0, scale: 1 }}
//                   exit={{ opacity: 0, y: -8, scale: 0.98 }}
//                   transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
//                   whileHover={{ y: -2 }}
//                   layout
//                   onMouseEnter={() => setActiveIdx(idx)}
//                   onMouseLeave={() => setActiveIdx(null)}
//                   onFocus={() => setActiveIdx(idx)}
//                   onBlur={() => setActiveIdx(null)}
//                 >
//                   <Link to={`/r/${r.id}`} className="block group focus:outline-none">
//                     <Card
//                       className={[
//                         'rounded-2xl overflow-hidden relative border',
//                         'bg-gradient-to-br', accent.ring, 'to-transparent',
//                         "before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(var(--tw-gradient-stops))] before:from-white/0 before:via-white/0 before:to-white/10 before:pointer-events-none",
//                         'hover:shadow-md transition',
//                       ].join(' ')}
//                     >
//                       {/* left accent bar */}
//                       <div className={`absolute left-0 top-0 h-full w-1.5 ${accent.bar}`} />

//                       {/* sparkle */}
//                       <Sparkles className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />

//                       <CardHeader className="pb-2 pl-5 pr-5">
//                         <CardTitle className="flex items-center justify-between gap-3">
//                           <span className="truncate text-base">
//                             {highlight(r.name, debouncedQ)}
//                           </span>
//                           <Badge variant="secondary" className="shrink-0">
//                             {highlight(code, debouncedQ)}
//                           </Badge>
//                         </CardTitle>
//                       </CardHeader>

//                       <CardContent className="pl-5 pr-5 pb-4">
//                         <div className="text-xs text-muted-foreground flex items-center gap-1">
//                           <MapPinned className="h-4 w-4" />
//                           マップの矩形をクリックして開くこともできます
//                         </div>

//                         {(typeof r.subareasCount === 'number' || typeof r.spotsCount === 'number') && (
//                           <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
//                             {typeof r.subareasCount === 'number' && (
//                               <span className="px-2 py-0.5 rounded-full bg-background/60 border">
//                                 サブエリア: <span className="tabular-nums">{r.subareasCount}</span>
//                               </span>
//                             )}
//                             {typeof r.spotsCount === 'number' && (
//                               <span className="px-2 py-0.5 rounded-full bg-background/60 border">
//                                 スポット: <span className="tabular-nums">{r.spotsCount}</span>
//                               </span>
//                             )}
//                           </div>
//                         )}

//                         <div className="mt-3 flex gap-2">
//                           <Button size="sm" className="rounded-xl">開く</Button>
//                           <Button
//                             size="sm"
//                             variant="outline"
//                             className="rounded-xl"
//                             type="button"
//                             onClick={(e) => {
//                               e.preventDefault();
//                               onCopy(r.code ?? '', r.id);
//                             }}
//                             disabled={!r.code}
//                             aria-live="polite"
//                           >
//                             {copiedId === r.id ? (
//                               <>
//                                 <Check className="h-4 w-4 mr-1" /> コピーしました
//                               </>
//                             ) : (
//                               <>
//                                 <Copy className="h-4 w-4 mr-1" /> コードをコピー
//                               </>
//                             )}
//                           </Button>
//                         </div>
//                       </CardContent>
//                     </Card>
//                   </Link>
//                 </motion.div>
//               );
//             })}
//           </AnimatePresence>
//         </div>
//       )}
//     </>
//   );
// }



// src/pages/Regions.tsx
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';

import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import MapHighlight from '../components/MapHighlight';

import {
  Copy,
  Check,
  Compass,
  Grid2X2,
  Sparkles,
  Search,
  X,
  MapPin,
  RefreshCw,
  MapPinned,
  Download,
} from 'lucide-react';

import type { Feature, Polygon, MultiPolygon } from 'geojson';

type Region = {
  id: string;
  name: string;
  code?: string | null;
  spotsCount?: number;
  geom?: any | null;
  geometry?: any | null;
};

// NEW: API stats shape
type RegionStats = { regionId: string; total: number; busy: number; free: number };

const ACCENTS = [
  { bar: 'bg-rose-500',    ring: 'from-rose-500/15',    hex: '#f43f5e' },
  { bar: 'bg-amber-500',   ring: 'from-amber-500/15',   hex: '#f59e0b' },
  { bar: 'bg-emerald-500', ring: 'from-emerald-500/15', hex: '#10b981' },
  { bar: 'bg-sky-500',     ring: 'from-sky-500/15',     hex: '#38bdf8' },
  { bar: 'bg-violet-500',  ring: 'from-violet-500/15',  hex: '#8b5cf6' },
  { bar: 'bg-pink-500',    ring: 'from-pink-500/15',    hex: '#ec4899' },
];
const pickAccent = (seed: string | undefined) => {
  const n = (seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ACCENTS[(n % ACCENTS.length + ACCENTS.length) % ACCENTS.length];
};

function RegionSkeleton() {
  return (
    <Card className="rounded-2xl p-4 overflow-hidden relative">
      <div className="absolute left-0 top-0 h-full w-1.5 bg-muted" />
      <div className="animate-pulse">
        <div className="h-5 w-40 bg-muted rounded mb-3" />
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="mt-4 h-8 w-28 bg-muted rounded" />
      </div>
    </Card>
  );
}

const highlight = (text: string, q: string) => {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="rounded bg-yellow-200/60 px-0.5">{match}</mark>
      {after}
    </>
  );
};

export default function Regions() {
  const navigate = useNavigate();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => (await api.get('/api/regions')).data,
  });

  const regions: Region[] = (data?.regions ?? []) as Region[];

  // NEW: fetch region availability (total/free/busy)
  const { data: statsData } = useQuery({
    queryKey: ['region-stats'],
    queryFn: async () => (await api.get('/api/stats/regions')).data,
    refetchInterval: 10000,
  });
  const statsMap = useMemo(() => {
    const m = new Map<string, RegionStats>();
    (statsData?.regionStats ?? []).forEach((s: RegionStats) => m.set(s.regionId, s));
    return m;
  }, [statsData]);

  // UI state
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const total = regions.length;
  const filtered = useMemo(() => {
    const list = regions
      .filter((r) => {
        if (!debouncedQ) return true;
        const hay = `${r.name} ${r.code ?? ''}`.toLowerCase();
        return hay.includes(debouncedQ.toLowerCase());
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        return (a.code ?? '').localeCompare(b.code ?? '');
      });
    return list;
  }, [regions, debouncedQ, sortBy]);

  // Map features (keep card color; just add stats for badges)
  const features = useMemo(() => {
    return filtered
      .map((r) => {
        const geom = (r as any).geom ?? (r as any).geometry;
        if (!geom) return null;

        const accent = pickAccent(r.id || r.code || r.name);
        const st = statsMap.get(r.id);

        return {
          type: 'Feature',
          id: r.id,
          properties: {
            id: r.id,
            name: r.name,
            code: r.code ?? '',
            color: accent.hex,            // ← always keep rectangle same color as card
            total: st?.total ?? 0,        // for map badge
            free: st?.free ?? 0,          // for map badge
            busy: st?.busy ?? 0,          // not used by map, used in card
          },
          geometry: geom,
        } as Feature<Polygon | MultiPolygon>;
      })
      .filter(Boolean) as Feature<Polygon | MultiPolygon>[];
  }, [filtered, statsMap]);

  const onCopy = async (text: string, regionId: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(regionId);
      setTimeout(() => setCopiedId(null), 1000);
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Page header */}
      <TopTitle title="地域を選択" subtitle="柏エリア" />

      {/* Map preview of all regions */}
      {!isLoading && filtered.length > 0 && (
        <div className="mb-3">
          <MapHighlight
            key={`regions-map-${filtered.length}`}
            features={features}
            selectedIndex={activeIdx ?? undefined}
            onFeatureClick={(idx) => {
              const r = filtered[idx];
              if (r) navigate(`/r/${r.id}`);
            }}
            // MapHighlight will keep the accent color because `color` is present,
            // and still shows "free/total" badges using the stats above.
            showAvailabilityBadges
          />
        </div>
      )}

      {/* Sticky toolbar */}
      <div className="sticky top-16 z-10 mb-4">
        <Card className="rounded-2xl border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="地域名またはコードで検索…"
                  className="rounded-xl pl-9"
                />
                {q && (
                  <button
                    aria-label="検索をクリア"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setQ('')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sort toggle */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={sortBy === 'name' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSortBy('name')}
                >
                  <Compass className="h-4 w-4 mr-2" />
                  名前
                </Button>
                <Button
                  variant={sortBy === 'code' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSortBy('code')}
                >
                  <Grid2X2 className="h-4 w-4 mr-2" />
                  コード
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  更新
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => navigate('/exports')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  データ出力
                </Button>
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                合計: <span className="ml-1 tabular-nums">{total}</span>
              </Badge>
              <span>•</span>
              <span>
                表示中: <span className="tabular-nums">{filtered.length}</span>
                {debouncedQ ? <> 件 （検索キーワード: “{debouncedQ}”）</> : null}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error / loading / empty states unchanged */}
      {error ? (
        <Card className="rounded-2xl p-6 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <div className="font-medium">地域を読み込めませんでした。</div>
              <div className="text-muted-foreground mt-1">
                もう一度お試しいただくか、ネットワーク接続をご確認ください。
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={() => refetch()}>再試行</Button>
              </div>
            </div>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <RegionSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl p-8">
          <div className="flex flex-col items-center text中心 gap-2">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              “{debouncedQ}” に一致する地域はありません。
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setQ('')} disabled={!debouncedQ}>
                現在の検索をクリア
              </Button>
              <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? '更新中…' : 'データを更新'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <div
          className="
            grid gap-3
            grid-cols-1
            sm:grid-cols-2
            xl:grid-cols-3
            [@media(min-width:1800px)]:grid-cols-4
          "
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((r, idx) => {
              const accent = pickAccent(r.id || r.code || r.name);
              const code = r.code || '—';
              const st = statsMap.get(r.id); // NEW

              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
                  whileHover={{ y: -2 }}
                  layout
                  onMouseEnter={() => setActiveIdx(idx)}
                  onMouseLeave={() => setActiveIdx(null)}
                  onFocus={() => setActiveIdx(idx)}
                  onBlur={() => setActiveIdx(null)}
                >
                  <Link to={`/r/${r.id}`} className="block group focus:outline-none">
                    <Card
                      className={[
                        'rounded-2xl overflow-hidden relative border',
                        'bg-gradient-to-br', accent.ring, 'to-transparent',
                        "before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(var(--tw-gradient-stops))] before:from-white/0 before:via-white/0 before:to-white/10 before:pointer-events-none",
                        'hover:shadow-md transition',
                      ].join(' ')}
                    >
                      {/* left accent bar */}
                      <div className={`absolute left-0 top-0 h-full w-1.5 ${accent.bar}`} />

                      {/* sparkle */}
                      <Sparkles className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />

                      <CardHeader className="pb-2 pl-5 pr-5">
                        <CardTitle className="flex items-center justify-between gap-3">
                          <span className="truncate text-base">
                            {highlight(r.name, debouncedQ)}
                          </span>
                          <Badge variant="secondary" className="shrink-0">
                            {highlight(code, debouncedQ)}
                          </Badge>
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="pl-5 pr-5 pb-4">
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPinned className="h-4 w-4" />
                          マップの矩形をクリックして開くこともできます
                        </div>

                        {/* NEW: availability chips */}
                        {st && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                              空き / 合計: <span className="tabular-nums">{st.free}/{st.total}</span>
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                              予約済: <span className="tabular-nums">{st.busy}</span>
                            </span>
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <Button size="sm" className="rounded-xl">開く</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl"
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              onCopy(r.code ?? '', r.id);
                            }}
                            disabled={!r.code}
                            aria-live="polite"
                          >
                            {copiedId === r.id ? (
                              <>
                                <Check className="h-4 w-4 mr-1" /> コピーしました
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" /> コードをコピー
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
