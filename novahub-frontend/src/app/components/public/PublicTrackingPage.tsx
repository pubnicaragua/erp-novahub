import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Check, Clock3, Loader2, MapPin, PackageCheck, Search, SearchX, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { NovaHubLogoFull } from '../NovaHubLogo';
import { getApiUrl } from '../../services/api';

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
  const pathParts = location.pathname.split('/').filter(Boolean);
  const urlCode = pathParts[0] === 'public' && pathParts[1] === 'tracking' ? decodeURIComponent(pathParts[2] || '') : '';
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
      const res = await fetch(getApiUrl(`/public-access/tracking/${encodeURIComponent(clean)}`));
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <div className="pointer-events-none absolute -left-32 -top-32 size-96 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 size-[28rem] rounded-full bg-sky-300/15 blur-3xl dark:bg-sky-500/10" />
      <header className="relative border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <NovaHubLogoFull size={36} />
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Seguimiento público</span>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <section className="grid items-end gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-400">Tracking en tiempo real</p>
            <h1 className="mt-3 max-w-xl text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">El estado de tu envío, en un solo lugar.</h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">Consulta el recorrido de tu paquete con el código que aparece en tu etiqueta o en el mensaje de tu agencia.</p>
          </div>
          <div className="rounded-[1.75rem] border border-emerald-500/20 bg-white/90 p-4 shadow-xl shadow-emerald-950/5 dark:bg-slate-900/90 sm:p-5">
            <label htmlFor="public-tracking-code" className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Código de tracking</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input id="public-tracking-code" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void lookup(query); }} placeholder="Ej. GFUS01065222301697" className="h-11 rounded-xl border-slate-200 bg-slate-50 pl-9 font-mono text-xs dark:border-slate-700 dark:bg-slate-950" />
              </div>
              <Button className="h-11 rounded-xl px-5" onClick={() => void lookup(query)} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Consultar</Button>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">No necesitas iniciar sesión para consultar tu envío.</p>
          </div>
        </section>

        <div className="mt-8">
          {loading ? (
            <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-slate-200 bg-white/70 py-20 text-slate-500 dark:border-slate-800 dark:bg-slate-900/70"><Loader2 className="size-8 animate-spin text-emerald-500" /><p className="text-sm">Consultando tu envío…</p></div>
          ) : error ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white/70 p-10 text-center dark:border-slate-700 dark:bg-slate-900/70"><SearchX className="mx-auto size-10 text-slate-400" /><p className="mt-4 text-sm font-black">No pudimos encontrar el envío</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{error}</p>{code && <p className="mt-4 font-mono text-xs text-emerald-600 dark:text-emerald-400">{code}</p>}</div>
          ) : data ? (
            <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900">
                <div className="bg-slate-950 p-5 text-white sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Código de envío</p><p className="mt-2 break-all font-mono text-lg font-bold sm:text-xl">{data.trackingCode}</p></div>
                    <span className="shrink-0 rounded-full bg-emerald-400/15 px-3 py-1.5 text-[11px] font-black text-emerald-300">{STATUS_LABELS[data.status] || data.status}</span>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
                    <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente</p><p className="mt-1 font-semibold text-white">{data.clientName || 'No indicado'}</p></div>
                    <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Transportista</p><p className="mt-1 font-semibold text-white">{data.carrier || 'No indicado'}</p></div>
                    {data.ticketNumber && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Ticket</p><p className="mt-1 font-mono font-semibold text-white">{data.ticketNumber}</p></div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 p-5 text-xs sm:grid-cols-3 sm:p-7">
                  {data.origin && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Origen</p><p className="mt-1 font-semibold">{data.origin}</p></div>}
                  {data.destination && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Destino</p><p className="mt-1 font-semibold">{data.destination}</p></div>}
                  {data.estimatedAt && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Entrega estimada</p><p className="mt-1 font-semibold">{format(new Date(data.estimatedAt), 'dd MMM yyyy', { locale: es })}</p></div>}
                  {data.deliveredAt && <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Entregado</p><p className="mt-1 font-semibold">{format(new Date(data.deliveredAt), 'dd MMM yyyy, HH:mm', { locale: es })}</p></div>}
                  <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Origen del registro</p><p className="mt-1 font-semibold">{data.source === 'received' ? 'Recepción de agencia' : 'Transportista'}</p></div>
                </div>
              </article>

              <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 dark:border-slate-800 dark:bg-slate-900 sm:p-7">
                <h2 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400"><PackageCheck className="size-4 text-emerald-500" /> Historial del envío</h2>
                <div className="mt-6">
                  {data.events.length === 0 ? <div className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600"><Check className="size-4" /></span><div><p className="text-sm font-black">{STATUS_LABELS[data.status] || data.status}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">El paquete ya fue registrado por la agencia.</p></div></div> : data.events.map((event, index) => (
                    <div key={`${event.status}-${event.occurredAt || index}`} className="relative flex gap-3 pb-6 last:pb-0">
                      {index < data.events.length - 1 && <span className="absolute left-4 top-8 h-full w-px bg-slate-200 dark:bg-slate-700" />}
                      <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-4 ring-white dark:text-emerald-400 dark:ring-slate-900"><Check className="size-4" /></span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-black">{event.label || STATUS_LABELS[event.status] || event.status}</p>{event.occurredAt && <p className="flex items-center gap-1 text-[10px] text-slate-500"><Clock3 className="size-3" /> {format(new Date(event.occurredAt), 'dd MMM, HH:mm', { locale: es })}</p>}</div>{event.location && <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400"><MapPin className="size-3" /> {event.location}</p>}{event.description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.description}</p>}</div>
                    </div>
                  ))}
                </div>
              </article>
            </section>
          ) : (
            <div className="py-16 text-center"><Truck className="mx-auto size-10 text-emerald-500/30" /><p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Escribe tu código arriba para ver el seguimiento.</p></div>
          )}
        </div>
      </main>

      <footer className="relative border-t border-slate-200/80 py-5 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">Seguimiento público · NovaHub ERP</footer>
    </div>
  );
}
