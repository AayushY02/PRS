import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import MapHighlight from '../components/MapHighlight';

import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Copy, Check, Sparkles, MapPinned, Filter, Grid2X2 } from 'lucide-react';

type Subarea = {
  id: string;
  name: string;
  code?: string | null;
  highlightImageUrl?: string | null;
  // optional counts (safe if absent)
  spotsCount?: number;
};

type Region = {
  id: string;
  name: string;
  code?: string | null;
  colorHex?: string | null; // optional, if your API exposes it
};

const ACCENTS = [
  { bar: 'bg-rose-500', ring: 'from-rose-500/15', dot: 'bg-rose-500' },
  { bar: 'bg-amber-500', ring: 'from-amber-500/15', dot: 'bg-amber-500' },
  { bar: 'bg-emerald-500', ring: 'from-emerald-500/15', dot: 'bg-emerald-500' },
  { bar: 'bg-sky-500', ring: 'from-sky-500/15', dot: 'bg-sky-500' },
  { bar: 'bg-violet-500', ring: 'from-violet-500/15', dot: 'bg-violet-500' },
  { bar: 'bg-pink-500', ring: 'from-pink-500/15', dot: 'bg-pink-500' },
];
const pickAccent = (seed: string | undefined) => {
  const n = (seed ?? '').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ACCENTS[(n % ACCENTS.length + ACCENTS.length) % ACCENTS.length];
};

function SubareaSkeleton({ accentBar = 'bg-muted' }: { accentBar?: string }) {
  return (
    <Card className="rounded-2xl p-4 relative overflow-hidden">
      <div className={`absolute left-0 top-0 h-full w-1.5 ${accentBar}`} />
      <div className="h-5 w-48 bg-muted rounded mb-3" />
      <div className="h-4 w-24 bg-muted rounded" />
      <div className="mt-4 h-8 w-24 bg-muted rounded" />
    </Card>
  );
}

export default function Subareas() {
  const { regionId } = useParams();

  // Region details (optional; graceful if your API doesn’t expose this endpoint)
  const { data: regionData } = useQuery({
    queryKey: ['region', regionId],
    queryFn: async () => (await api.get(`/api/regions/${regionId}`)).data,
    enabled: !!regionId,
    retry: 0,
  });
  const region = regionData?.region;

  // Subareas under region
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['subareas', regionId],
    queryFn: async () => (await api.get(`/api/subareas/by-region/${regionId}`)).data,
    enabled: !!regionId,
  });

  const subareas: Subarea[] = (data?.subareas ?? []) as Subarea[];

  // Accent seeded by region (consistent look across this page)
  const regionSeed = region?.id || region?.code || region?.name || String(regionId);
  const regionAccent = pickAccent(regionSeed);

  // UI state
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = subareas.filter(sa => {
      const hay = `${sa.name} ${sa.code ?? ''}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (a.code ?? '').localeCompare(b.code ?? '');
    });
    return list;
  }, [subareas, q, sortBy]);

  // keep MapHighlight images aligned with the *filtered* list + activeIdx
  const images = useMemo(
    () => filtered.map(sa => sa.highlightImageUrl).filter(Boolean) as string[],
    [filtered]
  );

  const onCopy = async (text: string, id: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1200);
    } catch { /* ignore */ }
  };

  const features = useMemo(() => {
    // Assuming each subarea has { id, name, colorHex?, geometry? } in GeoJSON
    return subareas
      .filter((sa: any) => !!sa.geometry) // polygon/multipolygon is best
      .map((sa: any, i: number) => ({
        id: sa.id,
        geometry: sa.geometry,                 // GeoJSON geometry (EPSG:4326)
        properties: {
          name: sa.name,
          color: sa.colorHex ?? ['#f43f5e', '#f59e0b', '#10b981', '#38bdf8', '#8b5cf6', '#ec4899'][i % 6],
        },
      }));
  }, [subareas]);


  return (
    // <>
    //   <TopTitle
    //     title={region?.name ?? 'Choose sub-area'}
    //     subtitle={[
    //       'Hover or focus to preview highlight',
    //       region?.code ? `· Region code: ${region.code}` : null,
    //       typeof region?.subareasCount === 'number' ? `· ${region.subareasCount} subareas` : null,
    //     ].filter(Boolean).join(' ')}
    //   />
    //   {/* Map preview ring */}
    //   <div className="mb-3">
    //     <MapHighlight
    //     />
    //   </div>

    //   {/* Controls */}
    //   <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
    //     <div className="flex-1">
    //       <Input
    //         value={q}
    //         onChange={(e) => setQ(e.target.value)}
    //         placeholder="Search sub-areas by name or code…"
    //         className="rounded-xl"
    //       />
    //     </div>
    //     <div className="flex gap-2">
    //       <Button
    //         size="sm"
    //         variant={sortBy === 'name' ? 'default' : 'outline'}
    //         className="rounded-full"
    //         onClick={() => setSortBy('name')}
    //       >
    //         <Filter className="h-4 w-4 mr-2" />
    //         Sort by name
    //       </Button>
    //       <Button
    //         size="sm"
    //         variant={sortBy === 'code' ? 'default' : 'outline'}
    //         className="rounded-full"
    //         onClick={() => setSortBy('code')}
    //       >
    //         <Grid2X2 className="h-4 w-4 mr-2" />
    //         Sort by code
    //       </Button>
    //     </div>
    //   </div>

    //   {/* Grid (2 columns ≥ sm) */}
    //   {isLoading ? (
    //     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    //       {Array.from({ length: 6 }).map((_, i) => (
    //         <SubareaSkeleton key={i} accentBar={regionAccent.bar} />
    //       ))}
    //     </div>
    //   ) : filtered.length === 0 ? (
    //     <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
    //       No sub-areas match “{q}”.{' '}
    //       <button
    //         className="underline underline-offset-2 hover:text-foreground"
    //         onClick={() => { setQ(''); refetch(); }}
    //       >
    //         Clear search{isFetching ? '…' : ''}
    //       </button>
    //     </Card>
    //   ) : (
    //     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    //       {filtered.map((sa, idx) => (
    //         <motion.div
    //           key={sa.id}
    //           initial={{ opacity: 0, y: 8, scale: 0.98 }}
    //           animate={{ opacity: 1, y: 0, scale: 1 }}
    //           transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
    //           whileHover={{ y: -2 }}
    //         >
    //           <Link
    //             to={`/s/${sa.id}`}
    //             onMouseEnter={() => setActiveIdx(idx)}
    //             onMouseLeave={() => setActiveIdx(null)}
    //             onFocus={() => setActiveIdx(idx)}
    //             onBlur={() => setActiveIdx(null)}
    //             className="block group focus:outline-none"
    //           >
    //             <Card
    //               className={[
    //                 'rounded-2xl overflow-hidden relative border hover:shadow-md transition',
    //                 'bg-gradient-to-br', regionAccent.ring, 'to-transparent',
    //               ].join(' ')}
    //             >
    //               {/* Region-colored accent bar */}
    //               <div className={`absolute left-0 top-0 h-full w-1.5 ${regionAccent.bar}`} />

    //               {/* Delight sparkle */}
    //               <Sparkles className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />

    //               <CardHeader className="pb-2 pl-5">
    //                 <CardTitle className="flex items-center justify-between gap-3">
    //                   <span className="truncate">{sa.name}</span>
    //                   <Badge variant="secondary" className="shrink-0">
    //                     {sa.code || '—'}
    //                   </Badge>
    //                 </CardTitle>
    //               </CardHeader>

    //               <CardContent className="pl-5 pb-4">
    //                 <div className="text-xs text-muted-foreground flex items-center gap-1">
    //                   <span className={`inline-block h-1.5 w-1.5 rounded-full ${regionAccent.dot}`} />
    //                   Hover to preview area highlight
    //                 </div>

    //                 {/* optional stats row */}
    //                 {typeof sa.spotsCount === 'number' && (
    //                   <div className="mt-2 flex gap-2 text-[11px] text-muted-foreground">
    //                     <span className="px-2 py-0.5 rounded-full bg-background/60 border">
    //                       Spots: <span className="tabular-nums">{sa.spotsCount}</span>
    //                     </span>
    //                   </div>
    //                 )}

    //                 {/* actions */}
    //                 <div className="mt-3 flex gap-2">
    //                   <Button size="sm" className="rounded-xl">
    //                     <MapPinned className="h-4 w-4 mr-1" />
    //                     Open
    //                   </Button>
    //                   <Button
    //                     size="sm"
    //                     variant="outline"
    //                     className="rounded-xl"
    //                     type="button"
    //                     onClick={(e) => { e.preventDefault(); onCopy(sa.code ?? '', sa.id); }}
    //                     disabled={!sa.code}
    //                   >
    //                     {copiedId === sa.id ? (
    //                       <>
    //                         <Check className="h-4 w-4 mr-1" /> Copied
    //                       </>
    //                     ) : (
    //                       <>
    //                         <Copy className="h-4 w-4 mr-1" /> Copy code
    //                       </>
    //                     )}
    //                   </Button>
    //                 </div>
    //               </CardContent>
    //             </Card>
    //           </Link>
    //         </motion.div>
    //       ))}
    //     </div>
    //   )}
    // </>

    <>
      <TopTitle
        title={region?.name ?? 'サブエリアを選択'}
        subtitle={[
          'ホバーまたはフォーカスでエリアをハイライト表示',
          region?.code ? `· 地域コード: ${region.code}` : null,
          typeof region?.subareasCount === 'number' ? `· サブエリア数: ${region.subareasCount}` : null,
        ]
          .filter(Boolean)
          .join(' ')}
      />

      {/* マッププレビューリング */}
      <div className="mb-3">
        <MapHighlight />
      </div>

      {/* コントロール */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="サブエリア名またはコードで検索…"
            className="rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={sortBy === 'name' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setSortBy('name')}
          >
            <Filter className="h-4 w-4 mr-2" />
            名前で並べ替え
          </Button>
          <Button
            size="sm"
            variant={sortBy === 'code' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setSortBy('code')}
          >
            <Grid2X2 className="h-4 w-4 mr-2" />
            コードで並べ替え
          </Button>
        </div>
      </div>

      {/* グリッド (sm以上で2カラム) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SubareaSkeleton key={i} accentBar={regionAccent.bar} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          “{q}” に一致するサブエリアはありません。{' '}
          <button
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setQ('');
              refetch();
            }}
          >
            検索をクリア{isFetching ? '中…' : ''}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((sa, idx) => (
            <motion.div
              key={sa.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
              whileHover={{ y: -2 }}
            >
              <Link
                to={`/s/${sa.id}`}
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onFocus={() => setActiveIdx(idx)}
                onBlur={() => setActiveIdx(null)}
                className="block group focus:outline-none"
              >
                <Card
                  className={[
                    'rounded-2xl overflow-hidden relative border hover:shadow-md transition',
                    'bg-gradient-to-br',
                    regionAccent.ring,
                    'to-transparent',
                  ].join(' ')}
                >
                  {/* 地域カラーのアクセントバー */}
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${regionAccent.bar}`} />

                  {/* 装飾スパークル */}
                  <Sparkles className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />

                  <CardHeader className="pb-2 pl-5">
                    <CardTitle className="flex items-center justify-between gap-3">
                      <span className="truncate">{sa.name}</span>
                      <Badge variant="secondary" className="shrink-0">
                        {sa.code || '—'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="pl-5 pb-4">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${regionAccent.dot}`}
                      />
                      ホバーでエリアをハイライト表示
                    </div>

                    {/* オプションの統計 */}
                    {typeof sa.spotsCount === 'number' && (
                      <div className="mt-2 flex gap-2 text-[11px] text-muted-foreground">
                        <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                          駐車スペース: <span className="tabular-nums">{sa.spotsCount}</span>
                        </span>
                      </div>
                    )}

                    {/* アクションボタン */}
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" className="rounded-xl">
                        <MapPinned className="h-4 w-4 mr-1" />
                        開く
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onCopy(sa.code ?? '', sa.id);
                        }}
                        disabled={!sa.code}
                      >
                        {copiedId === sa.id ? (
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
          ))}
        </div>
      )}
    </>


  );
}
