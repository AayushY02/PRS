import { useState } from 'react';
import { formatISO, addHours } from 'date-fns';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { api } from '../lib/api';




type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  spotId: string;
  spotCode: string;
  onSuccess: () => void;
};

export default function SpotBookingSheet({ open, onOpenChange, spotId, spotCode, onSuccess }: Props) {
  const now = new Date();
  const [start, setStart] = useState(formatISO(now).slice(0,16));
  const [end, setEnd] = useState(formatISO(addHours(now, 1)).slice(0,16));
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    setBusy(true); setError(null);
    try {
      await api.post('/api/bookings', {
        spotId,
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
        comment
      });
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to book');
    } finally { setBusy(false); }
  };

  const clearComment = () => setComment('');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-w-md mx-auto p-4">
        <SheetHeader>
          <SheetTitle>Reserve spot {spotCode}</SheetTitle>
          <SheetDescription>Choose timeframe and optional comment.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="grid gap-2">
            <Label>Start</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>End</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Comment</Label>
            <Textarea placeholder="Optional…" value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={busy} onClick={handleComplete}>Complete</Button>
            <Button variant="secondary" onClick={clearComment} disabled={busy}>Delete</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
