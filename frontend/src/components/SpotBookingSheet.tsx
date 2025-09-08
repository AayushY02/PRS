import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui/sheet';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { api } from '../lib/api';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { Separator } from './ui/separator';
import {
  Clock,
  Play,
  StopCircle,
  NotebookPen,
  Info,
  Car,
  Copy,
} from 'lucide-react';

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
    if (ms < 0 || Number.isNaN(ms)) return null;
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600).toString().padStart(2, '0');
    const mm = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [now, activeSince]);
}

const NOTE_LIMIT = 140;
const QUICK_NOTES = [
  '来客用駐車',
  'エレベーター付近',
  'EV充電中',
  '短時間駐車',
];


export default function SpotBookingSheet({
  open,
  onOpenChange,
  spotId,
  spotCode,
  onSuccess,
  myStartTime,
}: Props) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<null | 'start' | 'end'>(null);
  const elapsed = useTicker(myStartTime ?? null);

  const remaining = Math.max(0, NOTE_LIMIT - comment.length);
  const isActive = !!myStartTime;

  useEffect(() => {
    if (!open) {
      setComment('');
      setSubmitting(null);
    }
  }, [open]);

  async function startBooking() {
    setSubmitting('start');
    try {
      await api.post('/api/bookings/start', { spotId, comment: comment.trim() || null });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      alert(e?.response?.data?.error ?? 'Failed to start booking');
    } finally {
      setSubmitting(null);
    }
  }

  async function endBooking() {
    const ok = window.confirm('End this booking now? The spot will become available for others.');
    if (!ok) return;
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

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(spotCode);
    } catch {
      // no-op
    }
  };

  return (
    // <Sheet open={open} onOpenChange={onOpenChange}>
    //   <SheetContent
    //     side="bottom"
    //     className="rounded-t-2xl max-h-[95vh] overflow-y-auto p-0"
    //     style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    //   >
    //     {/* Header */}
    //     <div className="px-5 pt-4 pb-3 sticky top-0 bg-white border-b rounded-t-2xl">
    //       <SheetHeader className="mb-1">
    //         <SheetTitle className="text-lg flex items-center gap-2">
    //           <Car className="h-5 w-5" />
    //           Spot {spotCode}
    //           <Badge
    //             className="ml-1"
    //             variant={isActive ? 'default' : 'secondary'}
    //           >
    //             {isActive ? 'Active' : 'Idle'}
    //           </Badge>
    //         </SheetTitle>
    //         <SheetDescription>
    //           {isActive ? (
    //             <span className="inline-flex items-center gap-2">
    //               <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
    //               Your booking is active
    //             </span>
    //           ) : (
    //             'Start a new booking and (optionally) leave a note for yourself.'
    //           )}
    //         </SheetDescription>
    //       </SheetHeader>
    //     </div>

    //     {/* Body */}
    //     <div className="px-5 py-4 space-y-4">
    //       {/* Status card */}
    //       <Card
    //         className={[
    //           'rounded-2xl border',
    //           isActive
    //             ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/0'
    //             : 'bg-gradient-to-br from-sky-500/10 to-sky-500/0',
    //         ].join(' ')}
    //       >
    //         <div className="px-4 py-3 flex items-center justify-between">
    //           <div className="flex items-center gap-2">
    //             <div
    //               className={[
    //                 'h-2.5 w-2.5 rounded-full',
    //                 isActive ? 'bg-emerald-500' : 'bg-sky-500',
    //               ].join(' ')}
    //             />
    //             <div className="text-sm font-medium">
    //               {isActive ? 'Booking in progress' : 'Ready to start'}
    //             </div>
    //           </div>
    //           <div className="flex items-center gap-2 text-xs text-muted-foreground">
    //             <Clock className="h-4 w-4" />
    //             {isActive ? 'Elapsed' : '—'}
    //           </div>
    //         </div>

    //         <Separator />

    //         <div className="px-4 py-3">
    //           <div className="font-mono text-2xl tracking-wide">
    //             {isActive ? (elapsed ?? '00:00:00') : '00:00:00'}
    //           </div>
    //           <div className="mt-2 text-xs text-muted-foreground">
    //             {isActive
    //               ? 'Time since you started this booking.'
    //               : 'You can start and end the booking any time.'}
    //           </div>
    //         </div>
    //       </Card>

    //       {/* Quick info */}
    //       <div className="flex items-start gap-2 text-xs text-muted-foreground">
    //         <Info className="h-4 w-4 mt-0.5" />
    //         <div>
    //           Ending a booking immediately frees the spot for others. Notes are private to you.
    //         </div>
    //       </div>

    //       {/* Note input */}
    //       <div className="space-y-2">
    //         <div className="flex items-center justify-between">
    //           <div className="text-sm font-medium flex items-center gap-2">
    //             <NotebookPen className="h-4 w-4" />
    //             Note (optional)
    //           </div>
    //           <div
    //             className={[
    //               'text-xs font-mono',
    //               remaining < 10 ? 'text-red-600' : 'text-muted-foreground',
    //             ].join(' ')}
    //           >
    //             {remaining}
    //           </div>
    //         </div>
    //         <Textarea
    //           placeholder="e.g., EV charging; back in 30m…"
    //           value={comment}
    //           onChange={(e) => {
    //             const v = e.target.value.slice(0, NOTE_LIMIT);
    //             setComment(v);
    //           }}
    //           className="rounded-xl"
    //           rows={3}
    //         />

    //         {/* Quick note chips */}
    //         <div className="flex flex-wrap gap-2">
    //           {QUICK_NOTES.map((q) => (
    //             <Button
    //               key={q}
    //               type="button"
    //               variant="outline"
    //               size="sm"
    //               className="rounded-full h-7"
    //               onClick={() => setComment((prev) => {
    //                 if (!prev) return q;
    //                 if (prev.includes(q)) return prev;
    //                 const sep = prev.trim().endsWith('.') ? ' ' : (prev.endsWith(' ') ? '' : ' ');
    //                 return (prev + sep + q).slice(0, NOTE_LIMIT);
    //               })}
    //             >
    //               + {q}
    //             </Button>
    //           ))}
    //         </div>
    //       </div>

    //       {/* Actions */}
    //       <div className="grid grid-cols-2 gap-2 pt-1">
    //         <Button
    //           variant={isActive ? 'secondary' : 'default'}
    //           onClick={startBooking}
    //           disabled={isActive || submitting !== null}
    //           className="rounded-xl h-11"
    //         >
    //           {submitting === 'start' ? 'Starting…' : (
    //             <span className="inline-flex items-center gap-2">
    //               <Play className="h-4 w-4" /> Start
    //             </span>
    //           )}
    //         </Button>

    //         <Button
    //           variant="destructive"
    //           onClick={endBooking}
    //           disabled={!isActive || submitting !== null}
    //           className="rounded-xl h-11"
    //         >
    //           {submitting === 'end' ? 'Ending…' : (
    //             <span className="inline-flex items-center gap-2">
    //               <StopCircle className="h-4 w-4" /> End
    //             </span>
    //           )}
    //         </Button>
    //       </div>

    //       {/* Utilities */}
    //       <div className="flex items-center justify-between pt-1">
    //         <Button
    //           variant="outline"
    //           size="sm"
    //           className="rounded-xl"
    //           onClick={copyCode}
    //         >
    //           <Copy className="h-4 w-4 mr-2" />
    //           Copy spot code
    //         </Button>

    //         <Button
    //           variant="ghost"
    //           size="sm"
    //           className="rounded-xl"
    //           onClick={() => onOpenChange(false)}
    //         >
    //           Close
    //         </Button>
    //       </div>
    //     </div>
    //   </SheetContent>
    // </Sheet>

    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[95vh] overflow-y-auto p-0"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* ヘッダー */}
        <div className="px-5 pt-4 pb-3 sticky top-0 bg-white border-b rounded-t-2xl">
          <SheetHeader className="mb-1">
            <SheetTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              スポット {spotCode}
              <Badge
                className="ml-1"
                variant={isActive ? 'default' : 'secondary'}
              >
                {isActive ? '利用中' : '待機中'}
              </Badge>
            </SheetTitle>
            <SheetDescription>
              {isActive ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  あなたの予約は利用中です
                </span>
              ) : (
                '新しい予約を開始し、必要なら自分用のメモを残せます。'
              )}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* 本文 */}
        <div className="px-5 py-4 space-y-4">
          {/* ステータスカード */}
          <Card
            className={[
              'rounded-2xl border',
              isActive
                ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/0'
                : 'bg-gradient-to-br from-sky-500/10 to-sky-500/0',
            ].join(' ')}
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={[
                    'h-2.5 w-2.5 rounded-full',
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

            <div className="px-4 py-3">
              <div className="font-mono text-2xl tracking-wide">
                {isActive ? (elapsed ?? '00:00:00') : '00:00:00'}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {isActive
                  ? 'この予約を開始してからの経過時間です。'
                  : '予約はいつでも開始・終了できます。'}
              </div>
            </div>
          </Card>

          {/* 補足情報 */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 mt-0.5" />
            <div>
              予約を終了すると、すぐに他の人が利用できるようになります。メモは自分だけが見られます。
            </div>
          </div>

          {/* メモ入力 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium flex items-center gap-2">
                <NotebookPen className="h-4 w-4" />
                メモ（任意）
              </div>
              <div
                className={[
                  'text-xs font-mono',
                  remaining < 10 ? 'text-red-600' : 'text-muted-foreground',
                ].join(' ')}
              >
                {remaining}
              </div>
            </div>
            <Textarea
              placeholder="例: EV充電中・30分で戻ります"
              value={comment}
              onChange={(e) => {
                const v = e.target.value.slice(0, NOTE_LIMIT);
                setComment(v);
              }}
              className="rounded-xl"
              rows={3}
            />

            {/* クイックメモ候補 */}
            <div className="flex flex-wrap gap-2">
              {QUICK_NOTES.map((q) => (
                <Button
                  key={q}
                  type="button"
                  variant="outline"
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
                >
                  + {q}
                </Button>
              ))}
            </div>
          </div>

          {/* アクション */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button
              variant={isActive ? 'secondary' : 'default'}
              onClick={startBooking}
              disabled={isActive || submitting !== null}
              className="rounded-xl h-11"
            >
              {submitting === 'start' ? '開始中…' : (
                <span className="inline-flex items-center gap-2">
                  <Play className="h-4 w-4" /> 開始
                </span>
              )}
            </Button>

            <Button
              variant="destructive"
              onClick={endBooking}
              disabled={!isActive || submitting !== null}
              className="rounded-xl h-11"
            >
              {submitting === 'end' ? '終了中…' : (
                <span className="inline-flex items-center gap-2">
                  <StopCircle className="h-4 w-4" /> 終了
                </span>
              )}
            </Button>
          </div>

          {/* ユーティリティ */}
          <div className="flex items-center justify-between pt-1">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={copyCode}
            >
              <Copy className="h-4 w-4 mr-2" />
              スポットコードをコピー
            </Button>

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
