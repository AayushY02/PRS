


// import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// import { api } from '../lib/api';
// import TopTitle from '../components/TopTitle';
// import { Card } from '../components/ui/card';
// import { Badge } from '../components/ui/badge';
// import { Button } from '../components/ui/button';

// type RawBooking = {
//   id: string;
//   spot_id: string;
//   time_range: string; // '[2025-09-05 00:00:00+00,2025-09-05 01:00:00+00)' or '[2025-09-05 00:00:00+00,)'
//   comment: string | null;
//   status: 'active' | 'completed' | 'cancelled';
//   created_at: string;
// };

// function parseRange(r: string): { start: Date; end: Date | null } {
//   // very forgiving parser for tstzrange textual output
//   // examples: [2025-09-05 00:00:00+00,2025-09-05 02:00:00+00)
//   //           [2025-09-05 00:00:00+00,)
//   const m = r.match(/^\[([^,]+),(.*)\)\s*$/);
//   if (!m) return { start: new Date(NaN), end: null };
//   const start = new Date(m[1]);
//   const end = m[2] && m[2] !== '' && m[2] !== ')' ? new Date(m[2]) : null;
//   return { start, end: isNaN(end?.getTime() ?? NaN) ? null : end };
// }

// export default function MyBookings() {
//   const qc = useQueryClient();
//   const { data, isLoading } = useQuery({
//     queryKey: ['my-bookings'],
//     queryFn: async () => (await api.get('/api/bookings/mine')).data,
//   });

//   const list: RawBooking[] = (data?.bookings ?? []) as RawBooking[];

//   const endMut = useMutation({
//     mutationFn: async (spotId: string) => {
//       await api.post('/api/bookings/end', { spotId });
//     },
//     onSuccess: () => {
//       qc.invalidateQueries({ queryKey: ['my-bookings'] });
//       qc.invalidateQueries({ queryKey: ['spots'] });
//     },
//   });

//   return (
//     <>
//       <TopTitle title="My bookings" subtitle="Active and past reservations" />

//       {isLoading ? (
//         <div className="text-sm text-gray-500 px-1">Loading…</div>
//       ) : list.length === 0 ? (
//         <div className="text-sm text-gray-500 px-1">No bookings yet.</div>
//       ) : (
//         <div className="grid grid-cols-1 gap-3">
//           {list.map((b) => {
//             const { start, end } = parseRange(b.time_range);
//             const isActive = b.status === 'active' && !end;
//             return (
//               <Card key={b.id} className="rounded-2xl px-4 py-3">
//                 <div className="flex items-center justify-between">
//                   <div className="font-medium">Spot {b.spot_id.slice(0, 8)}…</div>
//                   <Badge variant={isActive ? 'default' : b.status === 'completed' ? 'secondary' : 'outline'}>
//                     {isActive ? 'active' : b.status}
//                   </Badge>
//                 </div>
//                 <div className="text-xs text-gray-600 mt-1">Start: {isNaN(start.getTime()) ? '—' : start.toLocaleString()}</div>
//                 <div className="text-xs text-gray-600">End: {end ? end.toLocaleString() : '—'}</div>
//                 {b.comment && <div className="text-xs mt-1">📝 {b.comment}</div>}

//                 <div className="mt-2 flex justify-end">
//                   <Button
//                     size="sm"
//                     variant="destructive"
//                     className="rounded-xl"
//                     onClick={() => endMut.mutate(b.spot_id)}
//                     disabled={!isActive || endMut.isPending}
//                   >
//                     {endMut.isPending ? 'Ending…' : 'End now'}
//                   </Button>
//                 </div>
//               </Card>
//             );
//           })}
//         </div>
//       )}
//     </>
//   );
// }



import { useMemo, useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import {
  Clock,
  Timer,
  StopCircle,
  CheckCircle2,
  XCircle,
  History as HistoryIcon,
} from 'lucide-react';

type RawBooking = {
  id: string;
  spot_id: string;
  time_range: string; // e.g. '[2025-09-05 00:00:00+00,2025-09-05 01:00:00+00)' or '[2025-09-05 00:00:00+00,)'
  comment: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
};

type ParsedBooking = RawBooking & {
  start: Date;
  end: Date | null;
  derivedStatus: 'active' | 'completed' | 'cancelled' | 'scheduled';
  durationSecNow: number;        // elapsed from start until now (or end if completed)
  remainingSec?: number | null;  // only when end exists and is in future
  totalPlannedSec?: number | null;
};

function parseRange(r: string): { start: Date; end: Date | null } {
  // Handles Postgres tstzrange textual output, including unbounded end: '[start,)'.
  // Accepts any whitespace, timezone, etc.
  const m = r.match(/^\s*\[([^,]+)\s*,\s*(.*?)\)\s*$/);
  if (!m) return { start: new Date(NaN), end: null };
  const start = new Date(m[1]);
  const endStr = m[2];
  const end = endStr ? new Date(endStr) : null;
  return { start, end: end && !isNaN(end.getTime()) ? end : null };
}

function hhmmss(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const hh = Math.floor(s / 3600).toString().padStart(2, '0');
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function fmtDate(d: Date | null) {
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function computeDerived(b: RawBooking): ParsedBooking {
  const { start, end } = parseRange(b.time_range);
  const now = new Date();

  let derived: ParsedBooking['derivedStatus'] = b.status;
  if (b.status === 'cancelled') {
    derived = 'cancelled';
  } else if (isNaN(start.getTime())) {
    derived = b.status; // unknown start; trust backend
  } else if (end && now >= end) {
    derived = 'completed';
  } else if (now < start) {
    derived = 'scheduled';
  } else if (!end || now < end) {
    // open-ended or still within [start, end)
    derived = 'active';
  }

  const durationSecNow =
    derived === 'completed' && end ? (end.getTime() - start.getTime()) / 1000
    : (now.getTime() - start.getTime()) / 1000;

  const remainingSec =
    end && derived !== 'completed' ? (end.getTime() - now.getTime()) / 1000 : null;

  const totalPlannedSec = end ? (end.getTime() - start.getTime()) / 1000 : null;

  return { ...b, start, end, derivedStatus: derived, durationSecNow, remainingSec, totalPlannedSec };
}

function BookingSkeleton() {
  return (
    <Card className="rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-2 w-full rounded" />
      </div>
      <div className="mt-3 flex justify-end">
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    </Card>
  );
}

export default function MyBookings() {
  const qc = useQueryClient();

  // 1s ticker for live timers/progress
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(x => (x + 1) % 1_000_000), 1000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get('/api/bookings/mine')).data,
  });

  const raw: RawBooking[] = (data?.bookings ?? []) as RawBooking[];

  const bookings = useMemo(() => raw.map(computeDerived), [raw]);

  // Group/sort
  const active = useMemo(
    () => bookings.filter(b => b.derivedStatus === 'active').sort((a, z) => a.start.getTime() - z.start.getTime()),
    [bookings]
  );
  const upcoming = useMemo(
    () => bookings.filter(b => b.derivedStatus === 'scheduled').sort((a, z) => a.start.getTime() - z.start.getTime()),
    [bookings]
  );
  const history = useMemo(
    () =>
      bookings
        .filter(b => b.derivedStatus === 'completed' || b.derivedStatus === 'cancelled')
        .sort((a, z) => z.start.getTime() - a.start.getTime()),
    [bookings]
  );

  // Mutations
  const endOne = useMutation({
    mutationFn: async (spotId: string) => api.post('/api/bookings/end', { spotId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['spots'] });
    },
  });

  const endAll = useMutation({
    mutationFn: async (spotIds: string[]) =>
      Promise.all(spotIds.map(id => api.post('/api/bookings/end', { spotId: id }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['spots'] });
    },
  });

  const hasActive = active.length > 0;

  return (
    <>
      <TopTitle
        title="My bookings"
        subtitle={[
          hasActive ? `${active.length} active` : 'No active bookings',
          history.length ? `· ${history.length} past` : null,
        ].filter(Boolean).join(' ')}
      />

      {/* Top actions / stats */}
      <div className="mb-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => qc.invalidateQueries({ queryKey: ['my-bookings'] })}
        >
          Refresh
        </Button>
        <Button
          size="sm"
          variant="destructive"
          className="rounded-xl"
          onClick={() => {
            if (!hasActive) return;
            const ids = active.map(b => b.spot_id);
            const ok = window.confirm(`End ${ids.length} active booking(s) now?`);
            if (ok) endAll.mutate(ids);
          }}
          disabled={!hasActive || endAll.isPending}
        >
          {endAll.isPending ? 'Ending…' : `End all active (${active.length})`}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <BookingSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && bookings.length === 0 && (
        <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          You have no bookings yet.
        </Card>
      )}

      {/* Active section */}
      {active.length > 0 && (
        <>
          <div className="mb-1 flex items-center gap-2">
            <Timer className="h-4 w-4" />
            <div className="text-sm font-semibold">Active</div>
            <Badge variant="secondary">{active.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {active.map(b => {
              const elapsed = hhmmss(b.durationSecNow);
              const hasPlannedEnd = typeof b.totalPlannedSec === 'number' && b.totalPlannedSec! > 0;
              const remaining = hasPlannedEnd ? Math.max(0, b.remainingSec ?? 0) : null;
              const pct = hasPlannedEnd
                ? Math.min(100, Math.max(0, (b.durationSecNow / (b.totalPlannedSec as number)) * 100))
                : null;

              return (
                <Card key={b.id} className="rounded-2xl p-4 border bg-gradient-to-br from-emerald-500/10 to-emerald-500/0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold">
                        Spot {b.spot_id.slice(0, 8)}…
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Start: {fmtDate(b.start)}</span>
                      </div>
                    </div>
                    <Badge className="gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Timer className="h-3.5 w-3.5" /> {elapsed}
                    </span>
                    {hasPlannedEnd ? (
                      <span className="inline-flex items-center gap-1">
                        Ends in <span className="font-mono">{hhmmss(remaining!)}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Open-ended</span>
                    )}
                  </div>

                  {/* Progress bar when end is planned */}
                  {hasPlannedEnd && (
                    <div className="mt-2 h-2 w-full rounded-full bg-emerald-500/15 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-[width]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}

                  {b.comment && <div className="mt-2 text-xs">📝 {b.comment}</div>}

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="rounded-xl"
                      onClick={() => {
                        const ok = window.confirm('End this booking now?');
                        if (ok) endOne.mutate(b.spot_id);
                      }}
                      disabled={endOne.isPending}
                    >
                      {endOne.isPending ? 'Ending…' : (
                        <span className="inline-flex items-center gap-1">
                          <StopCircle className="h-4 w-4" /> End now
                        </span>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Upcoming section */}
      {upcoming.length > 0 && (
        <>
          <div className="mb-1 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <div className="text-sm font-semibold">Scheduled</div>
            <Badge variant="secondary">{upcoming.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {upcoming.map(b => (
              <Card key={b.id} className="rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div className="text-base font-semibold">Spot {b.spot_id.slice(0, 8)}…</div>
                  <Badge variant="outline">Scheduled</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Starts: {fmtDate(b.start)}</div>
                {b.comment && <div className="mt-2 text-xs">📝 {b.comment}</div>}
              </Card>
            ))}
          </div>
        </>
      )}

      {/* History section */}
      {history.length > 0 && (
        <>
          <div className="mb-1 flex items-center gap-2">
            <HistoryIcon className="h-4 w-4" />
            <div className="text-sm font-semibold">History</div>
            <Badge variant="secondary">{history.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.map(b => {
              const totalSec =
                b.end ? (b.end.getTime() - b.start.getTime()) / 1000 : b.durationSecNow;
              const isCancelled = b.derivedStatus === 'cancelled';
              return (
                <Card
                  key={b.id}
                  className={[
                    'rounded-2xl p-4',
                    isCancelled ? 'bg-gradient-to-br from-red-500/10 to-red-500/0' : 'bg-gradient-to-br from-zinc-500/10 to-zinc-500/0',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-base font-semibold">Spot {b.spot_id.slice(0, 8)}…</div>
                    <Badge variant={isCancelled ? 'destructive' : 'secondary'} className="gap-1">
                      {isCancelled ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {isCancelled ? 'Cancelled' : 'Completed'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Start: {fmtDate(b.start)}</div>
                  <div className="text-xs text-muted-foreground">End: {fmtDate(b.end)}</div>
                  <div className="mt-2 text-xs">
                    ⏱️ Duration: <span className="font-mono">{hhmmss(totalSec)}</span>
                  </div>
                  {b.comment && <div className="mt-2 text-xs">📝 {b.comment}</div>}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
