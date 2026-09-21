import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, RefreshCw, Search, XCircle } from 'lucide-react';
import { toast } from '@/app/services/toast';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { subscriptionsService, type ModuleQuoteRequest, type ModuleQuoteRequestStatus } from '../../services/subscriptions.service';

const STATUS_LABELS: Record<ModuleQuoteRequestStatus, string> = {
  PENDING: 'Pendiente', IN_REVIEW: 'En revisión', QUOTED: 'Cotizada', ATTENDED: 'Atendida', REJECTED: 'Rechazada',
};

export function ModuleQuoteRequestsPanel({ onOpenQuotes, onPendingCount }: { onOpenQuotes?: () => void; onPendingCount?: (count: number) => void }) {
  const [status, setStatus] = useState<ModuleQuoteRequestStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const query = useTenantQuery(
    ['platform-module-quote-requests', status],
    (signal) => subscriptionsService.getModuleQuoteRequests(status === 'ALL' ? undefined : { status } as any, signal),
    { refetchInterval: 15000 },
  );
  const requests = asList(query.data) as ModuleQuoteRequest[];
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return requests;
    return requests.filter((request) => [request.clientTenant?.name, request.targetLabel, request.parentModuleLabel, request.requestedBy?.name, request.requestedBy?.email].some((value) => String(value || '').toLocaleLowerCase().includes(term)));
  }, [requests, search]);
  const pendingCount = requests.filter((request) => request.status === 'PENDING' || request.status === 'IN_REVIEW').length;
  useEffect(() => onPendingCount?.(pendingCount), [onPendingCount, pendingCount]);

  const refresh = () => { void query.refetch(); };
  const updateStatus = async (request: ModuleQuoteRequest, nextStatus: ModuleQuoteRequestStatus) => {
    try {
      await subscriptionsService.updateModuleQuoteRequestStatus(request.id, { status: nextStatus, reviewNote: reviewNote[request.id] || undefined });
      toast.success(`Solicitud marcada como ${STATUS_LABELS[nextStatus].toLowerCase()}`);
      refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo actualizar la solicitud');
    }
  };
  const convert = async (request: ModuleQuoteRequest) => {
    try {
      await subscriptionsService.convertModuleQuoteRequest(request.id);
      toast.success('Borrador creado en Cotizaciones de plataforma');
      onOpenQuotes?.();
      refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo crear la cotización');
    }
  };

  return (
    <Card className="rounded-3xl border-border/60 shadow-sm">
      <CardHeader className="gap-4 p-6 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div><CardTitle className="flex items-center gap-2 text-lg font-black uppercase"><FileText className="size-5 text-primary" /> Solicitudes de cotización de módulos</CardTitle><CardDescription className="mt-2 max-w-2xl">Revisa solicitudes de sucursales, agrega una nota interna y crea manualmente el borrador formal. Cotizar no activa módulos.</CardDescription></div>
        <Button variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={refresh} disabled={query.isFetching}><RefreshCw className="mr-2 size-4" /> Actualizar</Button>
      </CardHeader>
      <CardContent className="space-y-5 p-6 pt-2">
        <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar sucursal, módulo o solicitante…" aria-label="Buscar solicitudes de cotización" className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary" /></div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="border-primary/25 text-primary">{pendingCount} pendientes</Badge><select value={status} onChange={(event) => setStatus(event.target.value as ModuleQuoteRequestStatus | 'ALL')} aria-label="Filtrar solicitudes por estado" className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold"><option value="ALL">Todos los estados</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        {query.isPending && !query.data ? <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-5 animate-spin text-primary" /> Cargando solicitudes…</div> : query.isError ? <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">No se pudieron cargar las solicitudes. {query.error?.message || 'Intenta nuevamente.'}</div> : !filtered.length ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No hay solicitudes con este filtro.</div> : <div className="space-y-3">{filtered.map((request) => <RequestCard key={request.id} request={request} reviewNote={reviewNote[request.id] || ''} onReviewNote={(value) => setReviewNote((current) => ({ ...current, [request.id]: value }))} onStatus={(nextStatus) => void updateStatus(request, nextStatus)} onConvert={() => void convert(request)} />)}</div>}
      </CardContent>
    </Card>
  );
}

function RequestCard({ request, reviewNote, onReviewNote, onStatus, onConvert }: { request: ModuleQuoteRequest; reviewNote: string; onReviewNote: (value: string) => void; onStatus: (status: ModuleQuoteRequestStatus) => void; onConvert: () => void }) {
  const active = request.status === 'PENDING' || request.status === 'IN_REVIEW';
  return <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/[0.08] p-4 sm:p-5"><div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-black">{request.clientTenant?.name || 'Sucursal'} · {request.targetLabel}</p><Badge variant="outline" className="gap-1 text-[10px] font-black uppercase"><Clock3 className="size-3" /> {STATUS_LABELS[request.status]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{request.parentModuleLabel} · {request.targetType === 'MODULE' ? 'Módulo completo' : 'Vista'} · {request.requestedBy?.name || 'Solicitante'} · {new Date(request.createdAt).toLocaleString('es-NI')}</p>{request.comment && <p className="mt-3 break-words rounded-xl border border-border/50 bg-background/70 p-3 text-sm text-muted-foreground">{request.comment}</p>}</div><div className="flex shrink-0 flex-wrap gap-2">{request.platformQuote ? <Badge className="bg-primary/10 text-primary">{request.platformQuote.number}</Badge> : null}{active && <><Button size="sm" variant="outline" className="rounded-lg" onClick={() => onStatus('IN_REVIEW')} disabled={request.status === 'IN_REVIEW'}>En revisión</Button><Button size="sm" className="rounded-lg" onClick={onConvert}><FileText className="mr-1.5 size-4" /> Crear cotización</Button></>}{request.status === 'QUOTED' && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => onStatus('ATTENDED')}>Marcar atendida</Button>}{active && <Button size="sm" variant="ghost" className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => onStatus('REJECTED')}><XCircle className="mr-1.5 size-4" /> Rechazar</Button>}</div></div>{active && <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><input value={reviewNote} onChange={(event) => onReviewNote(event.target.value)} placeholder="Nota interna opcional para la revisión…" aria-label={`Nota interna para ${request.targetLabel}`} className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary" />{request.status === 'IN_REVIEW' && <Badge variant="outline" className="w-fit text-[10px] text-primary"><CheckCircle2 className="mr-1 size-3" /> En seguimiento</Badge>}</div>}</div>;
}
