import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Loader2, PackageCheck, Search, SearchX, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface PublicEvent {
  status: string;
  label: string | null;
  location: string | null;
  occurredAt: string | null;
  description: string | null;
}

interface PublicTrackingResult {
  found: boolean;
  source: 'transit' | 'received';
  trackingCode: string;
  ticketNumber: string | null;
  carrier: string | null;
  clientName: string | null;
  origin: string | null;
  destination: string | null;
  status: string;
  estimatedAt: string | null;
  deliveredAt: string | null;
  events: PublicEvent[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente de recepción',
  RECEIVED: 'Recibido en agencia',
  IN_TRANSIT: 'En tránsito',
  CUSTOMS: 'En aduana',
  OUT_FOR_DELIVERY: 'En reparto',
  DELIVERED: 'Entregado',
  RETURNED: 'Devuelto',
  ON_HOLD: 'En retención',
  LOST: 'Extraviado',
  CANCELLED: 'Cancelado',
  AVAILABLE: 'Disponible',
  BILLED: 'Facturado',
};

export function PublicTrackingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlCode = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const [code, setCode] = useState(urlCode);
  const [query, setQuery] = useState(urlCode);
  const [data, setData] = useState<PublicTrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(urlCode));

  const lookup = async (raw: string) => {
    const clean = raw.trim();
    if (!clean) { setError('Escribe el código de tracking de tu paquete.'); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${API}/public-access/tracking/${encodeURIComponent(clean)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const rawMsg = body?.message;
        throw new Error(typeof rawMsg === 'string' ? rawMsg : (rawMsg?.message || 'No se encontró el envío.'));
      }
      setData(body);
      setCode(clean);
      navigate(`/public/tracking/${encodeURIComponent(clean)}`, { replace: true });
    } catch (err) {
      setError((err as Error).message || 'No se pudo consultar el envío.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlCode) { setCode(urlCode); setQuery(urlCode); void lookup(urlCode); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="size-5" /></div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Seguimiento de envío</h1>
            <p className="text-xs text-muted-foreground">Escribe el código de tracking de tu paquete para ver su estado</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5 shadow-sm">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void lookup(query); }}
                placeholder="Ej. GFUS01065222301697"
                className="rounded-xl pl-9"
              />
            </div>
            <Button className="rounded-xl" onClick={() => void lookup(query)} disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">El código lo encuentras en la etiqueta de tu paquete o en el mensaje que te envió tu agencia.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground"><Loader2 className="size-8 animate-spin" /><p className="text-sm">Consultando…</p></div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
            <SearchX className="mx-auto size-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-bold">No pudimos encontrar el envío</p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
            {code && <p className="mt-4 font-mono text-xs text-primary">{code}</p>}
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-bold text-primary">{data.trackingCode}</p>
                  <p className="text-xs text-muted-foreground">{data.clientName || 'Cliente'} · {data.carrier || 'Transportista'}</p>
                </div>
                <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">{STATUS_LABELS[data.status] || data.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                {data.origin && <div><p className="text-[10px] font-black uppercase text-muted-foreground">Origen</p><p className="font-semibold">{data.origin}</p></div>}
                {data.destination && <div><p className="text-[10px] font-black uppercase text-muted-foreground">Destino</p><p className="font-semibold">{data.destination}</p></div>}
                {data.estimatedAt && <div><p className="text-[10px] font-black uppercase text-muted-foreground">Fecha estimada</p><p className="font-semibold">{format(new Date(data.estimatedAt), 'dd MMM yyyy', { locale: es })}</p></div>}
                {data.deliveredAt && <div><p className="text-[10px] font-black uppercase text-muted-foreground">Entregado</p><p className="font-semibold">{format(new Date(data.deliveredAt), 'dd MMM yyyy, HH:mm', { locale: es })}</p></div>}
                {data.source === 'received' && <div><p className="text-[10px] font-black uppercase text-muted-foreground">Registro</p><p className="font-semibold">Paquete recibido en agencia</p></div>}
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><PackageCheck className="size-4 text-primary" /> Historial de estados</h2>
              {data.events.length === 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">Sin eventos registrados todavía.</p>
              ) : (
                <div className="mt-4 space-y-0">
                  {data.events.map((event, index) => (
                    <div key={index} className="relative flex gap-3 pb-5 last:pb-0">
                      {index < data.events.length - 1 && <span className="absolute left-[11px] top-6 h-full w-px bg-border" />}
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-primary/20" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-black">{event.label || STATUS_LABELS[event.status] || event.status}</p>
                          <p className="text-[10px] text-muted-foreground">{event.occurredAt ? format(new Date(event.occurredAt), 'dd MMM yyyy, HH:mm', { locale: es }) : ''}</p>
                        </div>
                        {event.location && <p className="mt-0.5 text-[11px] text-muted-foreground">{event.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center">
            <Truck className="mx-auto size-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">Escribe tu código de tracking arriba y pulsa Consultar.</p>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-4 text-center text-[11px] text-muted-foreground">
        NovaHub ERP · Seguimiento de importaciones
      </footer>
    </div>
  );
}