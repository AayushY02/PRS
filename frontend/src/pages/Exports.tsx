import { useMemo, useState } from 'react';
import { AxiosError } from 'axios';
import TopTitle from '../components/TopTitle';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { api } from '../lib/api';

const BOOKING_SCOPE_OPTIONS = [
  { value: 'all', label: '全予約（すべて）' },
  { value: 'active', label: '進行中の予約' },
  { value: 'completed', label: '完了した予約' },
  { value: 'user-all', label: '利用者別（すべて）' },
  { value: 'user-active', label: '利用者別（進行中）' },
  { value: 'spot', label: 'スポット別（全履歴）' },
] as const;

type BookingScope = (typeof BOOKING_SCOPE_OPTIONS)[number]['value'];

type DownloadFormat = 'csv' | 'xlsx';

function extractFilename(contentDisposition: string | undefined, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (match?.[1]) return decodeURIComponent(match[1]);
  const regular = /filename="?([^;"]+)"?/i.exec(contentDisposition);
  if (regular?.[1]) return regular[1];
  return fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Exports() {
  const [scope, setScope] = useState<BookingScope>('all');
  const [userId, setUserId] = useState('');
  const [spotId, setSpotId] = useState('');
  const [bookingDownload, setBookingDownload] = useState<DownloadFormat | null>(null);
  const [userDownload, setUserDownload] = useState<DownloadFormat | null>(null);

  const requiresUser = useMemo(
    () => scope === 'user-all' || scope === 'user-active',
    [scope],
  );
  const requiresSpot = useMemo(() => scope === 'spot', [scope]);

  const validateBookingInputs = (): boolean => {
    if (requiresUser && userId.trim().length === 0) {
      window.alert('利用者別の出力にはユーザーIDが必要です。');
      return false;
    }
    if (requiresSpot && spotId.trim().length === 0) {
      window.alert('スポット別の出力にはスポットIDが必要です。');
      return false;
    }
    return true;
  };

  const handleDownloadBookings = async (format: DownloadFormat) => {
    if (!validateBookingInputs()) return;
    setBookingDownload(format);
    try {
      const params: Record<string, string> = {
        scope,
        format,
      };
      if (userId.trim()) params.userId = userId.trim();
      if (spotId.trim()) params.spotId = spotId.trim();

      const response = await api.get('/api/bookings/export', {
        params,
        responseType: 'blob',
      });
      const filename = extractFilename(
        response.headers['content-disposition'],
        `bookings_${scope}.${format}`,
      );
      saveBlob(response.data, filename);
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      const message = axiosError.response?.data?.error || '予約データの出力に失敗しました。';
      window.alert(message);
    } finally {
      setBookingDownload(null);
    }
  };

  const handleDownloadUsers = async (format: DownloadFormat) => {
    setUserDownload(format);
    try {
      const response = await api.get('/api/users/export', {
        params: { format },
        responseType: 'blob',
      });
      const filename = extractFilename(
        response.headers['content-disposition'],
        `users.${format}`,
      );
      saveBlob(response.data, filename);
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      const message = axiosError.response?.data?.error || '利用者一覧の出力に失敗しました。';
      window.alert(message);
    } finally {
      setUserDownload(null);
    }
  };

  return (
    <>
      <TopTitle
        title="データ出力"
        subtitle="予約・利用者データをCSV / Excel形式でダウンロードできます"
      />

      <section className="space-y-4 mb-6">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">予約データ</h2>
          <p className="text-xs text-muted-foreground">
            生成されるファイルには「ID / スポット番号 / 開始時刻 / 終了時刻 / 車種 / メモ」の6列が含まれます。
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border bg-background p-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">対象</label>
            <Select value={scope} onValueChange={(value: BookingScope) => setScope(value)}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="対象を選択" />
              </SelectTrigger>
              <SelectContent>
                {BOOKING_SCOPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresUser && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">ユーザーID</label>
              <Input
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="例: 123e4567-e89b-12d3-a456-426614174000"
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">利用者の予約履歴を抽出する際に必須です。</p>
            </div>
          )}

          {requiresSpot && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">スポットID</label>
              <Input
                value={spotId}
                onChange={(event) => setSpotId(event.target.value)}
                placeholder="例: 123e4567-e89b-12d3-a456-426614174000"
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">特定スポットの全予約履歴を取得する際に入力してください。</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-xl"
              disabled={bookingDownload !== null}
              onClick={() => handleDownloadBookings('csv')}
            >
              {bookingDownload === 'csv' ? '生成中…' : 'CSVで出力'}
            </Button>
            <Button
              className="flex-1 rounded-xl"
              variant="outline"
              disabled={bookingDownload !== null}
              onClick={() => handleDownloadBookings('xlsx')}
            >
              {bookingDownload === 'xlsx' ? '生成中…' : 'Excelで出力'}
            </Button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-base font-semibold">利用者一覧</h2>
          <p className="text-xs text-muted-foreground">
            すべてのユーザーのID・メールアドレス・登録日時を含むファイルを出力します。
          </p>
        </div>

        <div className="rounded-2xl border bg-background p-4 space-y-3">
          <div className="flex gap-2">
            <Button
              className="flex-1 rounded-xl"
              disabled={userDownload !== null}
              onClick={() => handleDownloadUsers('csv')}
            >
              {userDownload === 'csv' ? '生成中…' : 'CSVで出力'}
            </Button>
            <Button
              className="flex-1 rounded-xl"
              variant="outline"
              disabled={userDownload !== null}
              onClick={() => handleDownloadUsers('xlsx')}
            >
              {userDownload === 'xlsx' ? '生成中…' : 'Excelで出力'}
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
