// import { useMemo, useState } from 'react';
// import { useQuery } from '@tanstack/react-query';
// import { motion } from 'framer-motion';
// import { Link } from 'react-router-dom';
// import TopTitle from '../components/TopTitle';
// import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
// import { Badge } from '../components/ui/badge';
// import { Input } from '../components/ui/input';
// import { Button } from '../components/ui/button';
// import { api } from '../lib/api';
// import { Copy, Check, Compass, Grid2X2, Sparkles } from 'lucide-react';

// type Region = {
//   id: string;
//   name: string;
//   code?: string | null;
//   // Optional fields are OK; component won’t break if absent:
//   subareasCount?: number;
//   spotsCount?: number;
// };

// const ACCENTS = [
//   { bar: 'bg-rose-500',     ring: 'from-rose-500/15' },
//   { bar: 'bg-amber-500',    ring: 'from-amber-500/15' },
//   { bar: 'bg-emerald-500',  ring: 'from-emerald-500/15' },
//   { bar: 'bg-sky-500',      ring: 'from-sky-500/15' },
//   { bar: 'bg-violet-500',   ring: 'from-violet-500/15' },
//   { bar: 'bg-pink-500',     ring: 'from-pink-500/15' },
// ];
// const pickAccent = (seed: string | undefined) => {
//   const n = (seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
//   return ACCENTS[n % ACCENTS.length];
// };

// function RegionSkeleton() {
//   return (
//     <Card className="rounded-2xl p-4">
//       <div className="h-5 w-40 bg-muted rounded mb-3" />
//       <div className="h-4 w-24 bg-muted rounded" />
//       <div className="mt-4 h-8 w-24 bg-muted rounded" />
//     </Card>
//   );
// }

// export default function Regions() {
//   const { data, isLoading, refetch, isFetching } = useQuery({
//     queryKey: ['regions'],
//     queryFn: async () => (await api.get('/api/regions')).data,
//   });

//   const regions: Region[] = (data?.regions ?? []) as Region[];

//   // UI state
//   const [q, setQ] = useState('');
//   const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
//   const [copiedId, setCopiedId] = useState<string | null>(null);

//   const filtered = useMemo(() => {
//     const list = regions.filter(r => {
//       const hay = `${r.name} ${r.code ?? ''}`.toLowerCase();
//       return hay.includes(q.trim().toLowerCase());
//     });
//     list.sort((a, b) => {
//       if (sortBy === 'name') return a.name.localeCompare(b.name);
//       return (a.code ?? '').localeCompare(b.code ?? '');
//     });
//     return list;
//   }, [regions, q, sortBy]);

//   const onCopy = async (text: string, regionId: string) => {
//     try {
//       await navigator.clipboard.writeText(text);
//       setCopiedId(regionId);
//       setTimeout(() => setCopiedId(null), 1200);
//     } catch { /* ignore */ }
//   };

//   return (
//     <>
//       <TopTitle title="Select region" subtitle="Kashiwa areas" />

//       {/* Controls */}
//       <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
//         <div className="flex-1">
//           <Input
//             value={q}
//             onChange={(e) => setQ(e.target.value)}
//             placeholder="Search regions by name or code…"
//             className="rounded-xl"
//           />
//         </div>
//         <div className="flex gap-2">
//           <Button
//             variant={sortBy === 'name' ? 'default' : 'outline'}
//             className="rounded-full"
//             onClick={() => setSortBy('name')}
//           >
//             <Compass className="h-4 w-4 mr-2" />
//             Sort by name
//           </Button>
//           <Button
//             variant={sortBy === 'code' ? 'default' : 'outline'}
//             className="rounded-full"
//             onClick={() => setSortBy('code')}
//           >
//             <Grid2X2 className="h-4 w-4 mr-2" />
//             Sort by code
//           </Button>
//         </div>
//       </div>

//       {/* Grid */}
//       {isLoading ? (
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//           {Array.from({ length: 6 }).map((_, i) => <RegionSkeleton key={i} />)}
//         </div>
//       ) : filtered.length === 0 ? (
//         <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
//           No regions match “{q}”.{' '}
//           <button
//             className="underline underline-offset-2 hover:text-foreground"
//             onClick={() => { setQ(''); refetch(); }}
//           >
//             Clear search{isFetching ? '…' : ''}
//           </button>
//         </Card>
//       ) : (
//         <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//           {filtered.map((r, idx) => {
//             const accent = pickAccent(r.id || r.code || r.name);
//             return (
//               <motion.div
//                 key={r.id}
//                 initial={{ opacity: 0, y: 8, scale: 0.98 }}
//                 animate={{ opacity: 1, y: 0, scale: 1 }}
//                 transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
//                 whileHover={{ y: -2 }}
//               >
//                 <Link to={`/r/${r.id}`} className="block group focus:outline-none">
//                   <Card
//                     className={[
//                       'rounded-2xl overflow-hidden relative border',
//                       'bg-gradient-to-br', accent.ring, 'to-transparent',
//                       'hover:shadow-md transition',
//                     ].join(' ')}
//                   >
//                     {/* left accent bar */}
//                     <div className={`absolute left-0 top-0 h-full w-1.5 ${accent.bar}`} />

//                     {/* sparkle */}
//                     <Sparkles className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />

//                     <CardHeader className="pb-2 pl-5">
//                       <CardTitle className="flex items-center justify-between gap-3">
//                         <span className="truncate">{r.name}</span>
//                         <Badge variant="secondary" className="shrink-0">
//                           {r.code || '—'}
//                         </Badge>
//                       </CardTitle>
//                     </CardHeader>

//                     <CardContent className="pl-5 pb-4">
//                       <div className="text-xs text-muted-foreground">
//                         Tap to view sub-areas
//                       </div>

//                       {/* tiny stats row (if backend provides counts) */}
//                       {(r.subareasCount || r.spotsCount) && (
//                         <div className="mt-2 flex gap-2 text-[11px] text-muted-foreground">
//                           {typeof r.subareasCount === 'number' && (
//                             <span className="px-2 py-0.5 rounded-full bg-background/60 border">
//                               Subareas: <span className="tabular-nums">{r.subareasCount}</span>
//                             </span>
//                           )}
//                           {typeof r.spotsCount === 'number' && (
//                             <span className="px-2 py-0.5 rounded-full bg-background/60 border">
//                               Spots: <span className="tabular-nums">{r.spotsCount}</span>
//                             </span>
//                           )}
//                         </div>
//                       )}

//                       {/* actions */}
//                       <div className="mt-3 flex gap-2">
//                         <Button size="sm" className="rounded-xl">
//                           Open
//                         </Button>
//                         <Button
//                           size="sm"
//                           variant="outline"
//                           className="rounded-xl"
//                           type="button"
//                           onClick={(e) => { e.preventDefault(); onCopy(r.code ?? '', r.id); }}
//                           disabled={!r.code}
//                         >
//                           {copiedId === r.id ? (
//                             <>
//                               <Check className="h-4 w-4 mr-1" /> Copied
//                             </>
//                           ) : (
//                             <>
//                               <Copy className="h-4 w-4 mr-1" /> Copy code
//                             </>
//                           )}
//                         </Button>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 </Link>
//               </motion.div>
//             );
//           })}
//         </div>
//       )}
//     </>
//   );
// }


// src/pages/Regions.tsx
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';

import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';

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
} from 'lucide-react';

type Region = {
  id: string;
  name: string;
  code?: string | null;
  subareasCount?: number;
  spotsCount?: number;
};

const ACCENTS = [
  { bar: 'bg-rose-500',     ring: 'from-rose-500/15' },
  { bar: 'bg-amber-500',    ring: 'from-amber-500/15' },
  { bar: 'bg-emerald-500',  ring: 'from-emerald-500/15' },
  { bar: 'bg-sky-500',      ring: 'from-sky-500/15' },
  { bar: 'bg-violet-500',   ring: 'from-violet-500/15' },
  { bar: 'bg-pink-500',     ring: 'from-pink-500/15' },
];
const pickAccent = (seed: string | undefined) => {
  const n = (seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ACCENTS[n % ACCENTS.length];
};

function RegionSkeleton() {
  return (
    <Card className="rounded-2xl p-4 overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1.5 bg-muted" />
      <div className="animate-pulse">
        <div className="h-5 w-40 bg-muted rounded mb-3" />
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="mt-4 h-8 w-28 bg-muted rounded" />
      </div>
    </Card>
  );
}

// ——— tiny helpers ———
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
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => (await api.get('/api/regions')).data,
  });

  const regions: Region[] = (data?.regions ?? []) as Region[];

  // UI state
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // debounce search for smoother typing on large lists
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

  const onCopy = async (text: string, regionId: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(regionId);
      setTimeout(() => setCopiedId(null), 1000);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Page header */}
      <TopTitle title="Select region" subtitle="Kashiwa areas" />

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
                  placeholder="Search regions by name or code…"
                  className="rounded-xl pl-9"
                />
                {q && (
                  <button
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setQ('')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sort toggle */}
              <div className="flex gap-2">
                <Button
                  variant={sortBy === 'name' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSortBy('name')}
                >
                  <Compass className="h-4 w-4 mr-2" />
                  Name
                </Button>
                <Button
                  variant={sortBy === 'code' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setSortBy('code')}
                >
                  <Grid2X2 className="h-4 w-4 mr-2" />
                  Code
                </Button>
                <Button
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Meta row */}
            <div className="mt-2 text-xs text-muted-foreground flex items-center gap-2">
              <Badge variant="secondary" className="rounded-full">
                Total: <span className="ml-1 tabular-nums">{total}</span>
              </Badge>
              <span>•</span>
              <span>
                Showing <span className="tabular-nums">{filtered.length}</span>
                {debouncedQ ? (
                  <>
                    {' '}result{filtered.length === 1 ? '' : 's'} for “{debouncedQ}”
                  </>
                ) : null}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error state */}
      {error ? (
        <Card className="rounded-2xl p-6 text-sm">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <div className="font-medium">Couldn’t load regions.</div>
              <div className="text-muted-foreground mt-1">
                Please try again, or check your network connection.
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <RegionSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl p-8">
          <div className="flex flex-col items-center text-center gap-2">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              No regions match “{debouncedQ}”.
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQ('')}
                disabled={!debouncedQ}
              >
                Clear search
              </Button>
              <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? 'Refreshing…' : 'Refresh data'}
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
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
                  whileHover={{ y: -2 }}
                  layout
                >
                  <Link to={`/r/${r.id}`} className="block group focus:outline-none">
                    <Card
                      className={[
                        'rounded-2xl overflow-hidden relative border',
                        'bg-gradient-to-br', accent.ring, 'to-transparent',
                        // subtle pattern
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
                        <div className="text-xs text-muted-foreground">
                          Tap to view sub-areas
                        </div>

                        {(typeof r.subareasCount === 'number' ||
                          typeof r.spotsCount === 'number') && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                            {typeof r.subareasCount === 'number' && (
                              <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                                Subareas:{' '}
                                <span className="tabular-nums">{r.subareasCount}</span>
                              </span>
                            )}
                            {typeof r.spotsCount === 'number' && (
                              <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                                Spots:{' '}
                                <span className="tabular-nums">{r.spotsCount}</span>
                              </span>
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex gap-2">
                          <Button size="sm" className="rounded-xl">
                            Open
                          </Button>
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
                                <Check className="h-4 w-4 mr-1" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" /> Copy code
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
