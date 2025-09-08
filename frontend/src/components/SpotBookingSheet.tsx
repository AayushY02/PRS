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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

type Vehicle = 'normal' | 'large' | 'other';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subSpotId: string;
  subSpotCode: string;
  onSuccess: () => void;
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
    if (ms < 0 || Number.isNaN(ms)) return null;
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [now, activeSince]);
}

const NOTE_LIMIT = 140;
const QUICK_NOTES = ['来客用駐車', 'エレベーター付近', 'EV充電中', '短時間駐車'];

export default function SpotBookingSheet({
  open,
  onOpenChange,
  subSpotId,
  subSpotCode,
  onSuccess,
  myStartTime,
}: Props) {
  const [comment, setComment] = useState('');
  const [vehicle, setVehicle] = useState<Vehicle>('normal');
  const [submitting, setSubmitting] = useState<null | 'start' | 'end'>(null);
  const [copied, setCopied] = useState(false);

  const elapsed = useTicker(myStartTime ?? null);
  const remaining = Math.max(0, NOTE_LIMIT - comment.length);
  const charPct = ((NOTE_LIMIT - remaining) / NOTE_LIMIT) * 100;
  const isActive = !!myStartTime;

  useEffect(() => {
    if (!open) {
      setComment('');
      setVehicle('normal');
      setSubmitting(null);
      setCopied(false);
    }
  }, [open]);

  async function startBooking() {
    setSubmitting('start');
    try {
      await api.post('/api/bookings/start', {
        subSpotId,
        vehicleType: vehicle,
        comment: comment.trim() || null,
      });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to start booking');
    } finally {
      setSubmitting(null);
    }
  }

  async function endBooking() {
    const ok = window.confirm('この予約を終了しますか？');
    if (!ok) return;
    setSubmitting('end');
    try {
      await api.post('/api/bookings/end', { subSpotId });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to end booking');
    } finally {
      setSubmitting(null);
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(subSpotCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
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
              サブスポット <span className="font-mono">{subSpotCode}</span>
              <Badge className="ml-1" variant={isActive ? 'default' : 'secondary'}>
                {isActive ? '利用中' : '待機中'}
              </Badge>
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2">
              {isActive ? (
                <>
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Dot className="h-5 w-5 -mx-2" />
                    あなたの予約は利用中です
                  </span>
                </>
              ) : (
                '新しい予約を開始し、車種を選択してメモを残せます。'
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-5 py-4 space-y-5">
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
                {isActive ? '経過時間' : '—'}
              </div>
            </div>
            <Separator />
            <div className="px-4 py-4">
              <div className="font-mono text-3xl tracking-wide">
                {isActive ? elapsed ?? '00:00:00' : '00:00:00'}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {isActive
                  ? 'この予約を開始してからの経過時間です。'
                  : '予約はいつでも開始・終了できます。'}
              </p>
            </div>
          </Card>

          {/* Info alert */}
          <Alert className="rounded-xl">
            <AlertDescription className="text-xs flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              予約を終了すると、すぐに他の人が利用できます。メモは自分だけが見られます。
            </AlertDescription>
          </Alert>

          {/* Vehicle select */}
          <div className="space-y-2">
            <Label htmlFor="vehicle">車種を選択</Label>
            <Select
              value={vehicle}
              onValueChange={(v) => setVehicle(v as Vehicle)}
              disabled={isActive}
            >
              <SelectTrigger id="vehicle" className="w-full rounded-xl h-10">
                <SelectValue placeholder="車種を選択…" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="normal">普通自動車</SelectItem>
                <SelectItem value="large">大型自動車</SelectItem>
                <SelectItem value="other">その他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes with counter & quick chips */}
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
              placeholder="例: EV充電中・30分で戻ります"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, NOTE_LIMIT))}
              className="rounded-xl"
              rows={3}
              disabled={isActive}
            />
            <Progress value={charPct} className="h-1.5" />
            <div className="flex flex-wrap gap-2 pt-1">
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
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
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
            <Button
              variant="destructive"
              onClick={endBooking}
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
                  クリックして <span className="font-mono">{subSpotCode}</span> をコピー
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
