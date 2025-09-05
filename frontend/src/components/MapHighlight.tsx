// src/components/MapHighlight.tsx
import { useEffect, useRef } from 'react';
import maplibregl, { Map as MLMap } from 'maplibre-gl';

// Make sure you import the MapLibre CSS once in your app, e.g. in src/main.tsx:
// import 'maplibre-gl/dist/maplibre-gl.css';

type Props = {
  /** Optional override; defaults to Kashiwa (139.9698, 35.8617) */
  center?: [number, number];
  /** Optional override; defaults to 12.5 */
  zoom?: number;
  /** Optional style URL; defaults to MapLibre demo style */
  styleUrl?: string;
  /** Set to false to hide the top-right nav control (defaults to true) */
  navControl?: boolean;
  /** Extra class names for the container */
  className?: string;
};

const DEFAULT_CENTER: [number, number] = [139.9698, 35.8617]; // Kashiwa
const DEFAULT_ZOOM = 12.5;
const DEFAULT_STYLE = 'https://api.maptiler.com/maps/0198c5ad-6f66-73ba-9ee3-d35051ed4097/style.json?key=HCoMhdrImqEq1BdoYmms';

export default function MapHighlight({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  styleUrl = DEFAULT_STYLE,
  navControl = true,
  className = 'relative w-full aspect-video rounded-2xl overflow-hidden border',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MLMap | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center,
      zoom,
      attributionControl: false,
      interactive: true,
    });
    mapRef.current = map;

    if (navControl) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    }

    // Keep map sized to container
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    // If center/zoom props change later, update the view
    const onLoad = () => {
      map.setCenter(center);
      map.setZoom(zoom);
    };
    map.on('load', onLoad);

    return () => {
      ro.disconnect();
      map.off('load', onLoad);
      map.remove();
      mapRef.current = null;
    };
    // We intentionally don't include center/zoom/styleUrl in deps
    // to avoid re-creating the map instance; we update view on 'load' above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className={className} />;
}
