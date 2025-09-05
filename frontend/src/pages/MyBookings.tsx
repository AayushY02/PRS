import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

type B = { id:string; spot_id:string; time_range:string; comment:string|null; status:string; created_at:string };

export default function MyBookings() {
  const { data } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get('/api/bookings/mine')).data,
  });

  const list = (data?.bookings ?? []) as B[];

  return (
    <>
      <TopTitle title="My bookings" subtitle="Your recent reservations" />
      {list.length === 0 ? (
        <div className="text-sm text-gray-500 pt-4">No bookings yet.</div>
      ) : (
        <div className="grid gap-2">
          {list.map((b) => {
            const [start, end] = b.time_range.replace('[','').replace(')','').split(',');
            return (
              <Card key={b.id} className="rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Spot {b.spot_id.slice(0,8)}…</div>
                  <Badge variant={b.status === 'active' ? 'default' : 'secondary'}>{b.status}</Badge>
                </div>
                <div className="text-xs text-gray-600 mt-1">Start: {new Date(start).toLocaleString()}</div>
                <div className="text-xs text-gray-600">End: {new Date(end).toLocaleString()}</div>
                {b.comment && <div className="text-xs mt-1">📝 {b.comment}</div>}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
