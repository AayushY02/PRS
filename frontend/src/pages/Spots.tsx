



import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import SpotBookingSheet from '../components/SpotBookingSheet';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Clock, CheckCircle2, MinusCircle, Car } from 'lucide-react';

type SpotRow = {
  id: string;
  code: string;
  subareaId: string;
  isBusyNow: boolean;
  isMineNow: boolean;
  myStartTime: string | null;
};

function SpotSkeleton() {
  return (
    <Card className="rounded-2xl px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="h-5 w-28"><Skeleton className="h-5 w-full rounded" /></div>
        <div className="h-8 w-20"><Skeleton className="h-8 w-full rounded" /></div>
      </div>
      <div className="h-3 w-40 mt-3"><Skeleton className="h-3 w-full rounded" /></div>
    </Card>
  );
}

// format elapsed from an ISO start time (HH:MM:SS)
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

export default function Spots() {
  const { subareaId } = useParams();
  const qc = useQueryClient();

  // global 1s ticker so all cards can render elapsed time cheaply
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % 1_000_000), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['spots', subareaId],
    queryFn: async () => (await api.get(`/api/spots/by-subarea/${subareaId}`)).data,
    enabled: !!subareaId,
  });

  const spots: SpotRow[] = (data?.spots ?? []) as SpotRow[];

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<SpotRow | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');

  const openSheet = (s: SpotRow) => { setChosen(s); setOpen(true); };
  const closeSheet = () => setOpen(false);

  const counts = useMemo(() => ({
    total: spots.length,
    busy: spots.filter(s => s.isBusyNow).length,
    mine: spots.filter(s => s.isMineNow).length,
    available: spots.filter(s => !s.isBusyNow).length,
  }), [spots]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'available': return spots.filter(s => !s.isBusyNow);
      case 'mine': return spots.filter(s => s.isMineNow);
      default: return spots;
    }
  }, [spots, filter]);

  return (
    <>
      <TopTitle
        title="Spots"
        subtitle={`${counts.mine} mine · ${counts.busy}/${counts.total} in use`}
      />

      {/* Compact stat pills */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Card className="rounded-2xl px-3 py-2 flex items-center gap-2">
          <Car className="h-4 w-4" />
          <div className="text-sm font-medium">Total</div>
          <div className="ml-auto text-sm tabular-nums">{counts.total}</div>
        </Card>
        <Card className="rounded-2xl px-3 py-2 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <div className="text-sm font-medium">Mine</div>
          <div className="ml-auto text-sm tabular-nums">{counts.mine}</div>
        </Card>
        <Card className="rounded-2xl px-3 py-2 flex items-center gap-2">
          <MinusCircle className="h-4 w-4" />
          <div className="text-sm font-medium">Available</div>
          <div className="ml-auto text-sm tabular-nums">{counts.available}</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <Button
          size="sm"
          variant={filter === 'all' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={filter === 'available' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFilter('available')}
        >
          Available
        </Button>
        <Button
          size="sm"
          variant={filter === 'mine' ? 'default' : 'outline'}
          className="rounded-full"
          onClick={() => setFilter('mine')}
        >
          Mine
        </Button>
      </div>

      {/* Two-column grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <SpotSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          No spots found for this filter.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((s, idx) => {
            const isMine = s.isMineNow;
            const isBusy = s.isBusyNow;
            const accent =
              isMine ? 'from-emerald-500/15 to-emerald-500/0 border-emerald-500/30'
              : isBusy ? 'from-zinc-500/10 to-zinc-500/0 border-zinc-500/20'
              : 'from-sky-500/15 to-sky-500/0 border-sky-500/30';

            const elapsed = isMine ? formatElapsed(s.myStartTime) : null;

            return (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, delay: idx * 0.015 }}
              >
                <Card
                  className={[
                    'relative rounded-2xl px-4 py-3 border',
                    'hover:shadow-md transition',
                    'bg-gradient-to-br', accent,
                    'group',
                  ].join(' ')}
                >
                  {/* Left accent bar */}
                  <div
                    className={[
                      'absolute left-0 top-0 h-full w-1.5 rounded-l-2xl',
                      isMine ? 'bg-emerald-500' : isBusy ? 'bg-zinc-400' : 'bg-sky-500',
                    ].join(' ')}
                  />

                  <div className="flex items-start justify-between gap-3 pl-2">
                    <div className="min-w-0">
                      <div className="text-base font-semibold truncate">{s.code}</div>

                      <div className="mt-1 flex items-center gap-2">
                        {isMine ? (
                          <>
                            <Badge className="gap-1" variant="default">
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              My booking
                            </Badge>
                            {elapsed && (
                              <span className="inline-flex items-center text-xs text-muted-foreground gap-1 font-mono">
                                <Clock className="h-3 w-3" />
                                {elapsed}
                              </span>
                            )}
                          </>
                        ) : isBusy ? (
                          <Badge variant="secondary">Booked</Badge>
                        ) : (
                          <Badge variant="outline">Available</Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      variant={isMine ? 'default' : isBusy ? 'outline' : 'default'}
                      className="rounded-xl"
                      onClick={() => openSheet(s)}
                    >
                      {isMine ? 'Manage' : isBusy ? 'Details' : 'Book'}
                    </Button>
                  </div>

                  {/* Clickable overlay for easier UX on mobile */}
                  <button
                    onClick={() => openSheet(s)}
                    className="absolute inset-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40"
                    aria-label={`Open ${s.code}`}
                    // let the explicit button above take clicks first
                    style={{ pointerEvents: 'none' }}
                  />

                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {chosen && (
        <SpotBookingSheet
          open={open}
          onOpenChange={(v) => { if (!v) closeSheet(); else setOpen(true); }}
          spotId={chosen.id}
          spotCode={chosen.code}
          myStartTime={chosen.myStartTime ?? undefined}
          onSuccess={() => {
            setChosen(null);
            closeSheet();
            qc.invalidateQueries({ queryKey: ['spots', subareaId] });
            qc.invalidateQueries({ queryKey: ['my-bookings'] });
          }}
        />
      )}
    </>
  );
}