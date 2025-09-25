


import { useEffect, useMemo, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { Textarea } from '../components/ui/textarea';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Separator } from '../components/ui/separator';
import { Label } from '../components/ui/label';

import { api } from '../lib/api';
import {
  Clock,
  Play,
  StopCircle,
  NotebookPen,
  Info,
  Car,
  Copy,
  Loader2,
  Dot,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

type Vehicle = 'normal' | 'large' | 'other';
type ActiveBooking = {
  vehicleType: Vehicle;
  comment: string | null;
  direction: 'north' | 'south';
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subSpotId: string;
  subSpotCode: string;
  onSuccess: () => void;
  myStartTime?: string | null;
};

function useActiveTimer(activeSince?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!activeSince) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSince]);
  return useMemo(() => {
    if (!activeSince) {
      return { elapsed: null as string | null, current: null as Date | null };
    }
    const start = new Date(activeSince);
    if (Number.isNaN(start.getTime())) {
      return { elapsed: null, current: null };
    }
    const current = new Date(now);
    const diffMs = Math.max(0, current.getTime() - start.getTime());
    const totalSeconds = Math.floor(diffMs / 1000);
    const hh = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const mm = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return { elapsed: `${hh}:${mm}:${ss}`, current };
  }, [now, activeSince]);
}

function formatClockTime(input: string | Date | null, fallback = '--:--:--') {
  if (!input) return fallback;
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString('ja-JP', { hour12: false });
}

const NOTE_LIMIT = 140;
// const QUICK_NOTES = ['Guest parking', 'Near elevator', 'Charging EV', 'Short stay'];
const QUICK_NOTES = ['来客用駐車', 'エレベーター付近', 'EV充電中', '短時間利用'];

export default function SpotBookingSheet({
  open,
  onOpenChange,
  subSpotId,
  subSpotCode,
  onSuccess,
  myStartTime,
}: Props) {
  // Error message to display via shadcn Alert
  const [error, setError] = useState<string | null>(null);
  // End confirmation dialog state
  const [endDialogOpen, setEndDialogOpen] = useState(false);

  const [comment, setComment] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('normal');
  const [submitting, setSubmitting] = useState<null | 'start' | 'end' | 'update'>(null);
  const [copied, setCopied] = useState(false);

  const { elapsed: elapsedDuration, current: currentMoment } = useActiveTimer(myStartTime ?? null);
  const remaining = Math.max(0, NOTE_LIMIT - comment.length);
  const charPct = ((NOTE_LIMIT - remaining) / NOTE_LIMIT) * 100;
  const isActive = !!myStartTime;
  const startTimeDisplay = formatClockTime(myStartTime ?? null);
  const endTimeDisplay = formatClockTime(currentMoment ?? null);
  const elapsedDisplay = elapsedDuration ?? '00:00:00';
  const [direction, setDirection] = useState<'north' | 'south'>('north');
  const [initial, setInitial] = useState<ActiveBooking | null>(null); // for dirty check



  useEffect(() => {
    let abort = false;
    async function loadActive() {
      if (!open) return;
      if (!isActive) { setInitial(null); return; }
      try {
        const r = await api.get('/api/bookings/active', { params: { subSpotId } });
        if (abort) return;
        const b = r.data as ActiveBooking;
        setDirection(b.direction ?? 'north');
        setVehicle((b.vehicleType ?? 'normal') as Vehicle);
        setComment(b.comment ?? '');
        setInitial({
          direction: b.direction ?? 'north',
          vehicleType: (b.vehicleType ?? 'normal') as Vehicle,
          comment: b.comment ?? '',
        });
      } catch {
        // if fetch fails, keep whatever we had
      }
    }
    loadActive();
    return () => { abort = true; };
  }, [open, isActive, subSpotId]);

  // Only clear fields on close if there is no active booking
  useEffect(() => {
    if (!open && !isActive) {
      setComment('');
      setVehicle('normal');
      setSubmitting(null);
      setCopied(false);
      setError(null);
      setEndDialogOpen(false);
      setDirection('north');
      setInitial(null);
    }
  }, [open, isActive]);

  const dirty =
    initial !== null &&
    (initial.direction !== direction ||
      initial.vehicleType !== vehicle ||
      (initial.comment ?? '') !== comment);

  async function startBooking() {
    setSubmitting('start');
    setError(null);
    try {
      await api.post('/api/bookings/start', {
        subSpotId,
        vehicleType: vehicle,
        comment: comment.trim() || null,
        direction,
      });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      // Show error via Alert instead of native alert
      setError(e?.response?.data?.error ?? 'Failed to start booking');
    } finally {
      setSubmitting(null);
    }
  }

  async function updateBooking() {
    setSubmitting('update');  // reuse spinner slot; or add 'update'
    setError(null);
    try {
      await api.post('/api/bookings/update', {
        subSpotId,
        vehicleType: vehicle,
        comment: comment.trim() || null,
        direction,
      });
      // refresh counters/map
      onSuccess();
      // refresh "initial" to current so dirty becomes false
      setInitial({ vehicleType: vehicle, comment, direction });
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to update booking');
    } finally {
      setSubmitting(null);
    }
  }

  // Actual end action (invoked from AlertDialog)
  async function endBooking() {
    setSubmitting('end');
    setError(null);
    try {
      await api.post('/api/bookings/end', { subSpotId });
      onSuccess();
      setEndDialogOpen(false);
      onOpenChange(false);
    } catch (e: any) {
      // Show error via Alert instead of native alert
      setError(e?.response?.data?.error ?? 'Failed to end booking');
    } finally {
      setSubmitting(null);
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(subSpotCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Failed to copy the code');
    }
  };

  return (

    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[95vh] overflow-y-auto p-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 sticky top-0 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b rounded-t-2xl">
          <SheetHeader className="mb-1">
            <SheetTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              <span className="font-mono">{subSpotCode}</span>
              <Badge className="ml-1" variant={isActive ? 'default' : 'secondary'}>
                {isActive ? '使用中' : '空き'}
              </Badge>
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              {isActive ? (
                <>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Dot className="h-5 w-5 -mx-2" />
                    あなたの予約は進行中です
                  </span>
                </>
              ) : (
                '路上駐車の状況を記録してください'
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Error banner */}
          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertDescription className="text-xs">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Live status / timer card */}
          <Card
            className={[
              'rounded-2xl border overflow-hidden',
              isActive
                ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/0'
                : 'bg-gradient-to-br from-sky-500/10 to-sky-500/0',
            ].join(' ')}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={[
                    'inline-block h-2.5 w-2.5 rounded-full',
                    isActive ? 'bg-emerald-500' : 'bg-sky-500',
                  ].join(' ')}
                />
                <div className="text-sm font-medium">
                  {isActive ? '予約中' : '開始可能'}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-4 w-4" />
                {isActive ? '現在時刻' : '待機中'}
              </div>
            </div>
            <Separator />
            <div className="px-4 py-4 space-y-3">
              <div>
                <div className="text-xs text-muted-foreground">開始時刻</div>
                <div className="font-mono text-2xl tracking-tight">
                  {isActive && myStartTime ? `${startTimeDisplay}〜` : '--:--:--'}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">終了時刻</div>
                <div className="font-mono text-2xl tracking-tight">
                  {isActive && myStartTime ? endTimeDisplay : '--:--:--'}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">経過時間</span>
                <span className="font-mono text-3xl tracking-wide">
                  {isActive && myStartTime ? elapsedDisplay : '00:00:00'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? '開始時刻と現在時刻、その間の経過時間を表示しています。'
                  : '開始すると開始時刻・終了時刻・経過時間が表示されます。'}
              </p>
            </div>
          </Card>

          {/* Info alert */}
          <Alert className="rounded-xl">
            <AlertDescription className="text-xs flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              予約を終了すると、他の人がすぐにこのスポットを利用できます。メモはあなただけが見られます。
            </AlertDescription>
          </Alert>

          {/* Vehicle select */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">車種を選択</Label>
            <Select
              value={vehicle}
              onValueChange={(v) => setVehicle(v as Vehicle)}
            >
              <SelectTrigger id="vehicle" className="w-full rounded-xl h-10">
                <SelectValue placeholder="車種を選んでください…" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="normal">普通車</SelectItem>
                <SelectItem value="large">大型車</SelectItem>
                <SelectItem value="other">その他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="memo" className="flex items-center gap-2">
                <NotebookPen className="h-4 w-4" />
                メモ（任意）
              </Label>
              <span
                className={[
                  'text-xs font-mono',
                  remaining < 10 ? 'text-red-600' : 'text-muted-foreground',
                ].join(' ')}
              >
                {remaining}
              </span>
            </div>
            <Textarea
              id="memo"
              placeholder="例:「集配で駐車」"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, NOTE_LIMIT))}
              className="rounded-xl"
              rows={3}
            />
            <Progress value={charPct} className="h-1.5" />

            <div className="space-y-2">
              <Label className="text-sm">駐車方向 <Badge variant="secondary">必須</Badge></Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={direction === 'north' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setDirection('north')}
                >
                  北側方向
                </Button>
                <Button
                  type="button"
                  variant={direction === 'south' ? 'default' : 'outline'}
                  className="rounded-full"
                  onClick={() => setDirection('south')}
                >
                  南側方向
                </Button>
              </div>
              {!direction && (
                <p className="text-xs text-muted-foreground">開始前にいずれかを選択してください。</p>
              )}
            </div>
            {/* <div className="flex flex-wrap gap-2 pt-1">
              {QUICK_NOTES.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full h-7"
                  onClick={() =>
                    setComment((prev) => {
                      if (!prev) return q;
                      if (prev.includes(q)) return prev;
                      const sep = prev.trim().endsWith('.') ? ' ' : prev.endsWith(' ') ? '' : ' ';
                      return (prev + sep + q).slice(0, NOTE_LIMIT);
                    })
                  }
                  disabled={isActive}
                >
                  + {q}
                </Button>
              ))}
            </div> */}
          </div>

          {/* Actions */}
          <div className={`grid ${isActive ? 'grid-cols-3' : 'grid-cols-2'} gap-2 pt-1`}>
            <Button
              variant={isActive ? 'secondary' : 'default'}
              onClick={startBooking}
              disabled={isActive || submitting !== null}
              className="rounded-xl h-11"
            >
              {submitting === 'start' ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  開始中…
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Play className="h-4 w-4" />
                  開始
                </span>
              )}
            </Button>

            {/* End booking */}
            <AlertDialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  disabled={!isActive || submitting !== null}
                  className="rounded-xl h-11"
                >
                  {submitting === 'end' ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      終了中…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2">
                      <StopCircle className="h-4 w-4" />
                      終了
                    </span>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>この予約を終了しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    終了すると、このサブスポットはすぐに他の人が利用可能になります。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={submitting !== null}>キャンセル</AlertDialogCancel>
                  <AlertDialogAction onClick={endBooking} disabled={submitting !== null}>
                    {submitting === 'end' ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        終了中…
                      </span>
                    ) : (
                      '終了を確認'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isActive && (
              <Button
                variant="default"
                onClick={updateBooking}
                disabled={!dirty || submitting !== null}
                className="rounded-xl h-11"
                title={dirty ? '変更を保存' : '変更はありません'}
              >
                {submitting === 'update' ? (  // <-- tighten condition
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    更新中…
                  </span>
                ) : '更新'}
              </Button>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2">
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={copyCode}>
                    <Copy className="h-4 w-4 mr-2" />
                    {copied ? 'コピーしました' : 'サブスポットコードをコピー'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-lg">
                  <span className="font-mono">{subSpotCode}</span> をコピーします
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              閉じる
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
