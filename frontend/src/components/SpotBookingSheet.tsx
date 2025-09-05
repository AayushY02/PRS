// import { useState } from 'react';
// import { formatISO, addHours } from 'date-fns';
// import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
// import { Label } from './ui/label';
// import { Input } from './ui/input';
// import { Textarea } from './ui/textarea';
// import { Button } from './ui/button';
// import { api } from '../lib/api';




// type Props = {
//   open: boolean;
//   onOpenChange: (v: boolean) => void;
//   spotId: string;
//   spotCode: string;
//   onSuccess: () => void;
// };

// export default function SpotBookingSheet({ open, onOpenChange, spotId, spotCode, onSuccess }: Props) {
//   const now = new Date();
//   const [start, setStart] = useState(formatISO(now).slice(0,16));
//   const [end, setEnd] = useState(formatISO(addHours(now, 1)).slice(0,16));
//   const [comment, setComment] = useState('');
//   const [busy, setBusy] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const handleComplete = async () => {
//     setBusy(true); setError(null);
//     try {
//       await api.post('/api/bookings', {
//         spotId,
//         startTime: new Date(start).toISOString(),
//         endTime: new Date(end).toISOString(),
//         comment
//       });
//       onOpenChange(false);
//       onSuccess();
//     } catch (e: any) {
//       setError(e?.response?.data?.error || 'Failed to book');
//     } finally { setBusy(false); }
//   };

//   const clearComment = () => setComment('');

//   return (
//     <Sheet open={open} onOpenChange={onOpenChange}>
//       <SheetContent side="bottom" className="max-w-md mx-auto p-4">
//         <SheetHeader>
//           <SheetTitle>Reserve spot {spotCode}</SheetTitle>
//           <SheetDescription>Choose timeframe and optional comment.</SheetDescription>
//         </SheetHeader>

//         <div className="mt-4 space-y-3">
//           <div className="grid gap-2">
//             <Label>Start</Label>
//             <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
//           </div>
//           <div className="grid gap-2">
//             <Label>End</Label>
//             <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
//           </div>
//           <div className="grid gap-2">
//             <Label>Comment</Label>
//             <Textarea placeholder="Optional…" value={comment} onChange={(e) => setComment(e.target.value)} />
//           </div>
//           {error && <div className="text-red-600 text-sm">{error}</div>}

//           <div className="flex gap-2 pt-2">
//             <Button className="flex-1" disabled={busy} onClick={handleComplete}>Complete</Button>
//             <Button variant="secondary" onClick={clearComment} disabled={busy}>Delete</Button>
//           </div>
//         </div>
//       </SheetContent>
//     </Sheet>
//   );
// }

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { api } from '../lib/api';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spotId: string;
  spotCode: string;
  onSuccess: () => void;
  // when the viewer owns an active booking, backend returns myStartTime (ISO)
  myStartTime?: string | null;
};

function useTicker(activeSince?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSince) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeSince]);
  return useMemo(() => {
    if (!activeSince) return null;
    const ms = Date.now() - new Date(activeSince).getTime();
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [now, activeSince]);
}

export default function SpotBookingSheet({ open, onOpenChange, spotId, spotCode, onSuccess, myStartTime }: Props) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<null | 'start' | 'end'>(null);
  const elapsed = useTicker(myStartTime ?? null);

  useEffect(() => {
    if (!open) {
      setComment('');
      setSubmitting(null);
    }
  }, [open]);

  async function startBooking() {
    setSubmitting('start');
    try {
      await api.post('/api/bookings/start', { spotId, comment: comment || null });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to start booking');
    } finally {
      setSubmitting(null);
    }
  }

  async function endBooking() {
    setSubmitting('end');
    try {
      await api.post('/api/bookings/end', { spotId });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to end booking');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[95vh] overflow-y-auto p-5 ">
        <SheetHeader className="mb-2">
          <SheetTitle className="text-lg">Spot {spotCode}</SheetTitle>
          <SheetDescription>
            {myStartTime ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Your booking is active · <span className="font-mono">{elapsed ?? '—:—:—'}</span>
              </span>
            ) : (
              'Start a new booking or leave a note.'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3">
          <Textarea
            placeholder="Note (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="rounded-xl"
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={myStartTime ? 'secondary' : 'default'}
              onClick={startBooking}
              disabled={!!myStartTime || submitting !== null}
              className="rounded-xl"
            >
              {submitting === 'start' ? 'Starting…' : 'Start'}
            </Button>
            <Button
              variant="destructive"
              onClick={endBooking}
              disabled={!myStartTime || submitting !== null}
              className="rounded-xl"
            >
              {submitting === 'end' ? 'Ending…' : 'End'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
