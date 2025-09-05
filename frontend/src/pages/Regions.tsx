import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { api } from '../lib/api';
import { Copy, Check, Compass, Grid2X2, Sparkles } from 'lucide-react';

type Region = {
  id: string;
  name: string;
  code?: string | null;
  // Optional fields are OK; component won’t break if absent:
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
    <Card className="rounded-2xl p-4">
      <div className="h-5 w-40 bg-muted rounded mb-3" />
      <div className="h-4 w-24 bg-muted rounded" />
      <div className="mt-4 h-8 w-24 bg-muted rounded" />
    </Card>
  );
}

export default function Regions() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['regions'],
    queryFn: async () => (await api.get('/api/regions')).data,
  });

  const regions: Region[] = (data?.regions ?? []) as Region[];

  // UI state
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const list = regions.filter(r => {
      const hay = `${r.name} ${r.code ?? ''}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return (a.code ?? '').localeCompare(b.code ?? '');
    });
    return list;
  }, [regions, q, sortBy]);

  const onCopy = async (text: string, regionId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(regionId);
      setTimeout(() => setCopiedId(null), 1200);
    } catch { /* ignore */ }
  };

  return (
    <>
      <TopTitle title="Select region" subtitle="Kashiwa areas" />

      {/* Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search regions by name or code…"
            className="rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={sortBy === 'name' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setSortBy('name')}
          >
            <Compass className="h-4 w-4 mr-2" />
            Sort by name
          </Button>
          <Button
            variant={sortBy === 'code' ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => setSortBy('code')}
          >
            <Grid2X2 className="h-4 w-4 mr-2" />
            Sort by code
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <RegionSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          No regions match “{q}”.{' '}
          <button
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => { setQ(''); refetch(); }}
          >
            Clear search{isFetching ? '…' : ''}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r, idx) => {
            const accent = pickAccent(r.id || r.code || r.name);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, delay: idx * 0.03, ease: 'easeOut' }}
                whileHover={{ y: -2 }}
              >
                <Link to={`/r/${r.id}`} className="block group focus:outline-none">
                  <Card
                    className={[
                      'rounded-2xl overflow-hidden relative border',
                      'bg-gradient-to-br', accent.ring, 'to-transparent',
                      'hover:shadow-md transition',
                    ].join(' ')}
                  >
                    {/* left accent bar */}
                    <div className={`absolute left-0 top-0 h-full w-1.5 ${accent.bar}`} />

                    {/* sparkle */}
                    <Sparkles className="absolute right-3 top-3 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />

                    <CardHeader className="pb-2 pl-5">
                      <CardTitle className="flex items-center justify-between gap-3">
                        <span className="truncate">{r.name}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {r.code || '—'}
                        </Badge>
                      </CardTitle>
                    </CardHeader>

                    <CardContent className="pl-5 pb-4">
                      <div className="text-xs text-muted-foreground">
                        Tap to view sub-areas
                      </div>

                      {/* tiny stats row (if backend provides counts) */}
                      {(r.subareasCount || r.spotsCount) && (
                        <div className="mt-2 flex gap-2 text-[11px] text-muted-foreground">
                          {typeof r.subareasCount === 'number' && (
                            <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                              Subareas: <span className="tabular-nums">{r.subareasCount}</span>
                            </span>
                          )}
                          {typeof r.spotsCount === 'number' && (
                            <span className="px-2 py-0.5 rounded-full bg-background/60 border">
                              Spots: <span className="tabular-nums">{r.spotsCount}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {/* actions */}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="rounded-xl">
                          Open
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          type="button"
                          onClick={(e) => { e.preventDefault(); onCopy(r.code ?? '', r.id); }}
                          disabled={!r.code}
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
        </div>
      )}
    </>
  );
}
