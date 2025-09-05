import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import MapHighlight from '../components/MapHighlight';
import { useState } from 'react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { motion } from 'framer-motion';

export default function Subareas() {
  const { regionId } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['subareas', regionId],
    queryFn: async () => (await api.get(`/api/subareas/by-region/${regionId}`)).data,
    enabled: !!regionId
  });

  const subareas = (data?.subareas ?? []) as any[];
  const images = subareas.map(sa => sa.highlightImageUrl).filter(Boolean);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  return (
    <>
      <TopTitle title="Choose sub-area" subtitle="Hover or focus to preview highlight" />
      <MapHighlight images={images} activeIndex={activeIdx} />

      <div className="grid gap-2 mt-4">
        {(isLoading ? Array.from({length:4}) : subareas).map((sa:any, i:number) => (
          <motion.div key={sa?.id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Link
              to={sa?.id ? `/s/${sa.id}` : '#'}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseLeave={() => setActiveIdx(null)}
              onFocus={() => setActiveIdx(i)}
              onBlur={() => setActiveIdx(null)}
              className="block"
            >
              <Card className="rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-base font-medium">{sa?.name || '—'}</div>
                  <div className="text-xs text-gray-500">{sa?.code || ''}</div>
                </div>
                <Badge variant="outline">View</Badge>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </>
  );
}
