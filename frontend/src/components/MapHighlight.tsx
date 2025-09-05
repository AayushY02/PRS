import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from './ui/skeleton';

type Props = { images: string[]; activeIndex?: number | null; };
export default function MapHighlight({ images, activeIndex = null }: Props) {
    const [index, setIndex] = useState(0);
    const timer = useRef<number | null>(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (activeIndex !== null && activeIndex !== undefined) {
            setIndex(activeIndex);
            return;
        }
        timer.current && window.clearInterval(timer.current);
        timer.current = window.setInterval(() => {
            setIndex(i => (i + 1) % Math.max(images.length || 1, 1));
        }, 2000);
        return () => { if (timer.current) window.clearInterval(timer.current); };
    }, [images, activeIndex]);

    const src = images[index];

    return (
        <div className="w-full aspect-video rounded-2xl overflow-hidden border relative">
            {!loaded && <Skeleton className="absolute inset-0" />}
            <AnimatePresence mode="wait">
                {src ? (
                    <motion.img
                        key={src}
                        src={src}
                        alt="subarea"
                        onLoad={() => setLoaded(true)}
                        className="w-full h-full object-cover"
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        transition={{ duration: 0.35 }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/640/360?blur=2'; setLoaded(true); }}
                    />
                ) : (
                    <div className="w-full h-full grid place-items-center text-gray-400 text-xs">No image</div>
                )}
            </AnimatePresence>
        </div>
    );
}
