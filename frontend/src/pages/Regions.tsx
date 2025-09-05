import { useQuery } from '@tanstack/react-query';

import { motion } from 'framer-motion';
import TopTitle from '../components/TopTitle';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';

export default function Regions() {
    const { data, isLoading } = useQuery({
        queryKey: ['regions'],
        queryFn: async () => (await api.get('/api/regions')).data
    });

    return (
        <>
            <TopTitle title="Select region" subtitle="Kashiwa areas" />
            <div className="grid gap-3">
                {(isLoading ? Array.from({ length: 2 }) : data?.regions ?? []).map((r: any, idx: number) => (
                    <motion.div
                        key={r?.id || idx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                    >
                        <Link to={r?.id ? `/r/${r.id}` : '#'} className="block">
                            <Card className="rounded-2xl hover:border-gray-300 transition">
                                <CardHeader className="pb-2">
                                    <CardTitle className="flex items-center justify-between">
                                        <span>{r?.name || '—'}</span>
                                        <Badge variant="secondary">{r?.code || 'loading'}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-xs text-gray-500">Tap to view sub-areas</p>
                                </CardContent>
                            </Card>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </>
    );
}
