// import { useQuery } from '@tanstack/react-query';
// import { api } from '../lib/api';
// import TopTitle from '../components/TopTitle';
// import { Card } from '../components/ui/card';
// import { Badge } from '../components/ui/badge';

// type B = { id:string; spot_id:string; time_range:string; comment:string|null; status:string; created_at:string };

// export default function MyBookings() {
//   const { data } = useQuery({
//     queryKey: ['my-bookings'],
//     queryFn: async () => (await api.get('/api/bookings/mine')).data,
//   });

//   const list = (data?.bookings ?? []) as B[];

//   return (
//     <>
//       <TopTitle title="My bookings" subtitle="Your recent reservations" />
//       {list.length === 0 ? (
//         <div className="text-sm text-gray-500 pt-4">No bookings yet.</div>
//       ) : (
//         <div className="grid gap-2">
//           {list.map((b) => {
//             const [start, end] = b.time_range.replace('[','').replace(')','').split(',');
//             return (
//               <Card key={b.id} className="rounded-2xl px-4 py-3">
//                 <div className="flex items-center justify-between">
//                   <div className="font-medium">Spot {b.spot_id.slice(0,8)}…</div>
//                   <Badge variant={b.status === 'active' ? 'default' : 'secondary'}>{b.status}</Badge>
//                 </div>
//                 <div className="text-xs text-gray-600 mt-1">Start: {new Date(start).toLocaleString()}</div>
//                 <div className="text-xs text-gray-600">End: {new Date(end).toLocaleString()}</div>
//                 {b.comment && <div className="text-xs mt-1">📝 {b.comment}</div>}
//               </Card>
//             );
//           })}
//         </div>
//       )}
//     </>
//   );
// }


import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

type RawBooking = {
  id: string;
  spot_id: string;
  time_range: string; // '[2025-09-05 00:00:00+00,2025-09-05 01:00:00+00)' or '[2025-09-05 00:00:00+00,)'
  comment: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
};

function parseRange(r: string): { start: Date; end: Date | null } {
  // very forgiving parser for tstzrange textual output
  // examples: [2025-09-05 00:00:00+00,2025-09-05 02:00:00+00)
  //           [2025-09-05 00:00:00+00,)
  const m = r.match(/^\[([^,]+),(.*)\)\s*$/);
  if (!m) return { start: new Date(NaN), end: null };
  const start = new Date(m[1]);
  const end = m[2] && m[2] !== '' && m[2] !== ')' ? new Date(m[2]) : null;
  return { start, end: isNaN(end?.getTime() ?? NaN) ? null : end };
}

export default function MyBookings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['my-bookings'],
    queryFn: async () => (await api.get('/api/bookings/mine')).data,
  });

  const list: RawBooking[] = (data?.bookings ?? []) as RawBooking[];

  const endMut = useMutation({
    mutationFn: async (spotId: string) => {
      await api.post('/api/bookings/end', { spotId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      qc.invalidateQueries({ queryKey: ['spots'] });
    },
  });

  return (
    <>
      <TopTitle title="My bookings" subtitle="Active and past reservations" />

      {isLoading ? (
        <div className="text-sm text-gray-500 px-1">Loading…</div>
      ) : list.length === 0 ? (
        <div className="text-sm text-gray-500 px-1">No bookings yet.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {list.map((b) => {
            const { start, end } = parseRange(b.time_range);
            const isActive = b.status === 'active' && !end;
            return (
              <Card key={b.id} className="rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Spot {b.spot_id.slice(0, 8)}…</div>
                  <Badge variant={isActive ? 'default' : b.status === 'completed' ? 'secondary' : 'outline'}>
                    {isActive ? 'active' : b.status}
                  </Badge>
                </div>
                <div className="text-xs text-gray-600 mt-1">Start: {isNaN(start.getTime()) ? '—' : start.toLocaleString()}</div>
                <div className="text-xs text-gray-600">End: {end ? end.toLocaleString() : '—'}</div>
                {b.comment && <div className="text-xs mt-1">📝 {b.comment}</div>}

                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    onClick={() => endMut.mutate(b.spot_id)}
                    disabled={!isActive || endMut.isPending}
                  >
                    {endMut.isPending ? 'Ending…' : 'End now'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
