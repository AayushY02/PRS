import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { motion } from 'framer-motion';
import { useState } from 'react';
import SpotBookingSheet from '../components/SpotBookingSheet';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

function SpotSkeleton() {
  return (
    <Card className="rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-xl" />
      </div>
    </Card>
  );
}

export default function Spots() {
  const qc = useQueryClient();
  const { subareaId } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['spots', subareaId],
    queryFn: async () => (await api.get(`/api/spots/by-subarea/${subareaId}`)).data,
    enabled: !!subareaId
  });

  // Normalize payload safely
  const spotsRaw = Array.isArray(data?.spots) ? (data!.spots as any[]) : [];
  const spots = spotsRaw.filter(Boolean); // remove undefined/null entries

  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<{ id: string; code: string } | null>(null);

  const openFor = (spot: any) => {
    if (!spot?.id) return;
    setChosen({ id: spot.id, code: String(spot.code ?? '') });
    setOpen(true);
  };

  return (
    <>
      <TopTitle title="Pick a spot" subtitle="Live status: Free / Booked" />

      {isLoading ? (
        <div className="grid gap-2">
          <SpotSkeleton />
          <SpotSkeleton />
          <SpotSkeleton />
          <SpotSkeleton />
        </div>
      ) : isError ? (
        <div className="text-sm text-red-600 pt-2">Failed to load spots.</div>
      ) : spots.length === 0 ? (
        <div className="text-sm text-gray-500 pt-2">No spots found for this sub-area.</div>
      ) : (
        <div className="grid gap-2">
          {spots.map((s: any, i: number) => {
            // Extra guard in case any entry is malformed
            if (!s || typeof s !== 'object') return null;
            const isFree = !Boolean(s.isBusyNow);
            const code = s.code ?? '—';

            return (
              <motion.div key={s.id ?? i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card
                  className={`rounded-2xl px-4 py-3 flex items-center justify-between border ${
                    isFree ? 'bg-emerald-50/60 border-emerald-200' : 'bg-gray-100 border-gray-200'
                  }`}
                >
                  <div>
                    <div className="font-medium">Spot {code}</div>
                    <div className="text-xs">
                      Status:&nbsp;
                      {isFree ? (
                        <Badge className="bg-emerald-600">Free now</Badge>
                      ) : (
                        <Badge variant="secondary">Booked</Badge>
                      )}
                    </div>
                  </div>
                  <Button size="sm" disabled={!isFree} onClick={() => openFor(s)} className="rounded-xl">
                    Reserve
                  </Button>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {chosen && (
        <SpotBookingSheet
          open={open}
          onOpenChange={setOpen}
          spotId={chosen.id}
          spotCode={chosen.code}
          onSuccess={() => {
            setChosen(null);
            qc.invalidateQueries({ queryKey: ['spots', subareaId] });
          }}
        />
      )}
    </>
  );
}
