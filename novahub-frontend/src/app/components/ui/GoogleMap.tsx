import { useState } from 'react';
import { MapPin, ExternalLink, Loader2 } from 'lucide-react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export function buildMapQuery(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).map((p) => p!.trim()).filter(Boolean).join(', ');
}

interface GoogleMapProps {
  query?: string;
  label?: string;
  height?: number;
  className?: string;
  zoom?: number;
}

export function GoogleMap({ query, label, height = 220, className = '', zoom = 15 }: GoogleMapProps) {
  const [loaded, setLoaded] = useState(false);

  if (!query?.trim()) {
    return (
      <div className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 ${className}`} style={{ minHeight: height }}>
        <MapPin className="size-6 text-muted-foreground/40" />
        <p className="text-xs font-bold text-muted-foreground/60">{label || 'Sin ubicación registrada'}</p>
        <p className="text-[10px] text-muted-foreground/50">Agrega una dirección para ver el mapa</p>
      </div>
    );
  }

  const encoded = encodeURIComponent(query);
  const embedUrl = MAPS_API_KEY
    ? `https://www.google.com/maps/embed/v1/place?key=${MAPS_API_KEY}&q=${encoded}&zoom=${zoom}`
    : `https://maps.google.com/maps?q=${encoded}&z=${zoom}&output=embed`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <div className={`group relative w-full overflow-hidden rounded-2xl border border-border/60 bg-muted/10 ${className}`} style={{ height }}>
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-muted/20">
          <Loader2 className="size-5 animate-spin text-primary" />
          <span className="text-xs font-bold text-muted-foreground">Cargando mapa…</span>
        </div>
      )}
      <iframe
        title={label || 'Mapa de ubicación'}
        src={embedUrl}
        className="h-full w-full border-0"
        style={{ filter: 'grayscale(0.15) contrast(1.02)' }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        onLoad={() => setLoaded(true)}
      />
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-2 right-2 z-10 flex items-center gap-1.5 rounded-lg bg-background/95 px-2.5 py-1.5 text-[10px] font-black text-primary shadow-md ring-1 ring-border/60 transition hover:bg-background"
      >
        <ExternalLink className="size-3" /> Abrir en Google Maps
      </a>
    </div>
  );
}