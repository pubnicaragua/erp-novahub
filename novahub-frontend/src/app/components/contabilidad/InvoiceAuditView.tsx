import { useState } from 'react';
import {
  ClipboardCheck, Search, RefreshCw, CheckCircle2, AlertTriangle, ShieldQuestion,
  ShieldCheck, FileWarning, X, Loader2, Send, Ban, FilePlus2, History,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { cn } from '../ui/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { contabilidadService } from '../../services/contabilidad.service';
import { invoicesService } from '../../services/ventas.service';
import { supplierInvoicesService } from '../../services/compras.service';

type AuditKind = 'SALE' | 'PURCHASE';
type AuditStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'ISSUES';
type TabKey = 'invoices' | 'history';

interface AuditResult {
  invoiceId: string;
  number: string;
  result: 'APPROVED' | 'ISSUES';
  checks: { key: string; label: string; ok: boolean; detail: string }[];
}

const fmtMoney = (n: number) => Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente', PAID: 'Pagada', PARTIAL: 'Parcial', OVERDUE: 'Vencida', DRAFT: 'Borrador', CANCELLED: 'Anulada',
};

const ACTION_META: Record<string, { label: string; cls: string }> = {
  AUDIT: { label: 'Auditada', cls: 'bg-primary/10 text-primary border-primary/20' },
  SENT_TO_CORRECT: { label: 'En corrección', cls: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
  CANCELLED: { label: 'Anulada', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  REISSUED: { label: 'Reemitida', cls: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
};

const HISTORY_ACTIONS = [
  { value: 'AUDIT', label: 'Auditorías' },
  { value: 'SENT_TO_CORRECT', label: 'Enviadas a corregir' },
  { value: 'CANCELLED', label: 'Anuladas' },
  { value: 'REISSUED', label: 'Reemitidas' },
];

export function InvoiceAuditView() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('invoices');
  const [kind, setKind] = useState<AuditKind>('SALE');
  const [search, setSearch] = useState('');
  const [auditStatus, setAuditStatus] = useState<AuditStatus>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [auditModal, setAuditModal] = useState<{ invoiceIds: string[]; observations: string; results: AuditResult[] | null; saving: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; number: string; reason: string; saving: boolean } | null>(null);

  const listQuery = useQuery({
    queryKey: ['invoice-audit', kind, search, auditStatus, dateFrom, dateTo, page],
    queryFn: ({ signal }) => contabilidadService.getInvoiceAuditList({
      kind, search: search || undefined,
      auditStatus: auditStatus === 'ALL' ? undefined : auditStatus,
      dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      page, pageSize: 20,
    }, signal),
    staleTime: 30_000, gcTime: 5 * 60_000, retry: 1,
  });

  const [histAction, setHistAction] = useState('ALL');
  const [histPage, setHistPage] = useState(1);
  const historyQuery = useQuery({
    queryKey: ['invoice-audit-history', kind, histAction, histPage],
    queryFn: ({ signal }) => contabilidadService.getInvoiceAuditHistory({
      kind, action: histAction === 'ALL' ? undefined : histAction, page: histPage, pageSize: 20,
    }, signal),
    staleTime: 30_000, gcTime: 5 * 60_000, retry: 1,
  });

  const data = listQuery.data as any;
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  const total = Number(data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const histData = historyQuery.data as any;
  const histItems: any[] = Array.isArray(histData) ? histData : Array.isArray(histData?.items) ? histData.items : [];
  const histTotal = Number(histData?.total || 0);
  const histTotalPages = Math.max(1, Math.ceil(histTotal / 20));

  const allSelectedOnPage = items.length > 0 && items.every((item) => selected.has(item.id));

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelectedOnPage) items.forEach((item) => next.delete(item.id));
      else items.forEach((item) => next.add(item.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const changeKind = (value: string) => {
    setKind(value === 'PURCHASE' ? 'PURCHASE' : 'SALE');
    setSelected(new Set());
    setPage(1);
    setHistPage(1);
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['accounting'] });
  };

  const openAuditModal = () => setAuditModal({ invoiceIds: [...selected], observations: '', results: null, saving: false });

  const runAudit = async () => {
    if (!auditModal) return;
    try {
      setAuditModal((m) => (m ? { ...m, saving: true } : m));
      const results = await contabilidadService.auditInvoices({ kind, invoiceIds: auditModal.invoiceIds, observations: auditModal.observations.trim() || undefined });
      const list = Array.isArray(results) ? results : Array.isArray((results as any)?.results) ? (results as any).results : [];
      setAuditModal((m) => (m ? { ...m, results: list, saving: false } : m));
      const issues = list.filter((r: any) => r.result === 'ISSUES').length;
      if (issues > 0) toast.warning(`${issues} factura(s) con anomalías. Puedes enviarlas a corregir o anularlas.`);
      else toast.success(`${list.length} factura(s) auditadas correctamente`);
      setSelected(new Set());
      refreshAll();
    } catch (e: any) {
      setAuditModal((m) => (m ? { ...m, saving: false } : m));
      toast.error(e?.message || 'No se pudo registrar la auditoría');
    }
  };

  const handleSendToCorrect = async (item: any) => {
    try {
      setBusyId(item.id);
      await contabilidadService.sendToCorrect({ kind, invoiceIds: [item.id], observations: 'Enviada a corregir desde auditoría' });
      toast.success(`Factura ${item.number} enviada a corrección`);
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo enviar a corregir');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      setCancelTarget((t) => (t ? { ...t, saving: true } : t));
      const reason = cancelTarget.reason.trim() || 'Anulada desde auditoría de facturas';
      if (kind === 'SALE') {
        await invoicesService.cancel(cancelTarget.id, reason);
      } else {
        await supplierInvoicesService.cancel(cancelTarget.id, reason);
      }
      const result = await contabilidadService.cancelAuditedInvoice({ kind, invoiceId: cancelTarget.id, reason });
      const journalReversed = Boolean((result as any)?.journalReversed);
      toast.success(journalReversed ? 'Factura anulada y asiento contable revertido' : 'Factura anulada (no tenía asiento contable pendiente)');
      setCancelTarget(null);
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo anular la factura');
      setCancelTarget((t) => (t ? { ...t, saving: false } : t));
    }
  };

  const auditBadge = (item: any) => {
    if (!item.audit) {
      return <Badge variant="outline" className="gap-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-muted-foreground"><ShieldQuestion className="size-3" /> Pendiente</Badge>;
    }
    const action = item.audit.action === 'SENT_TO_CORRECT' ? 'SENT_TO_CORRECT'
      : item.audit.action === 'CANCELLED' ? 'CANCELLED'
      : item.audit.action === 'REISSUED' ? 'REISSUED'
      : 'AUDIT';
    const meta = ACTION_META[action];
    const when = item.audit.auditedAt ? ` · ${new Date(item.audit.auditedAt).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : '';
    const who = item.audit.auditedByName ? ` por ${item.audit.auditedByName}` : '';
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge className={cn('gap-1 rounded-lg text-[9px] font-black uppercase tracking-widest', meta.cls)}>
          {action === 'AUDIT' && (item.audit.result === 'APPROVED' ? <ShieldCheck className="size-3" /> : <FileWarning className="size-3" />)}
          {action === 'SENT_TO_CORRECT' && <Send className="size-3" />}
          {action === 'CANCELLED' && <Ban className="size-3" />}
          {action === 'REISSUED' && <FilePlus2 className="size-3" />}
          {action === 'AUDIT' ? (item.audit.result === 'APPROVED' ? 'Aprobada' : 'Con anomalías') : meta.label}
        </Badge>
        <span className="text-[9px] text-muted-foreground">{`${when}${who}`}</span>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardCheck className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Auditoría de Facturas</h3>
            <p className="text-[10px] text-muted-foreground">
              Selecciona facturas de venta o compra, valida su proceso, envía a corregir o anula (revirtiendo el asiento contable). La factura corregida se crea nuevamente en su módulo; no se reemite sobre la misma.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-border/60 bg-muted/30 p-0.5">
            <button onClick={() => setTab('invoices')} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors', tab === 'invoices' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>
              <span className="flex items-center gap-1"><ClipboardCheck className="size-3.5" /> Facturas</span>
            </button>
            <button onClick={() => setTab('history')} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors', tab === 'history' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>
              <span className="flex items-center gap-1"><History className="size-3.5" /> Historial</span>
            </button>
          </div>
        </div>
      </div>

      {tab === 'invoices' && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex rounded-xl border border-border/60 bg-muted/30 p-0.5">
              <button onClick={() => changeKind('SALE')} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors', kind === 'SALE' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>Facturas de venta</button>
              <button onClick={() => changeKind('PURCHASE')} className={cn('rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors', kind === 'PURCHASE' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>Facturas de compra</button>
            </div>
            <div className="relative min-w-44 flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={kind === 'SALE' ? 'Número o cliente…' : 'Número o proveedor…'} className="h-9 rounded-xl pl-9 text-xs" />
            </div>
            <Select value={auditStatus} onValueChange={(v) => { setAuditStatus(v as AuditStatus); setPage(1); }}>
              <SelectTrigger className="h-9 w-40 rounded-xl text-xs font-bold"><SelectValue placeholder="Estado auditoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Todos</SelectItem>
                <SelectItem value="PENDING" className="text-xs">Pendientes</SelectItem>
                <SelectItem value="APPROVED" className="text-xs">Aprobadas</SelectItem>
                <SelectItem value="ISSUES" className="text-xs">Con anomalías</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-9 w-36 rounded-xl text-xs" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-9 w-36 rounded-xl text-xs" />
            <Button variant="outline" size="icon" className="size-9 rounded-xl" onClick={() => { refreshAll(); listQuery.refetch(); }} title="Actualizar">
              <RefreshCw className={cn('size-4', listQuery.isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={openAuditModal} disabled={selected.size === 0} className="gap-2 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-9 hover:bg-primary/90">
              <ShieldCheck className="size-4" /> Auditar seleccionadas ({selected.size})
            </Button>
          </div>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={allSelectedOnPage} onChange={toggleAll} />
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Número</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">{kind === 'SALE' ? 'Cliente' : 'Proveedor'}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Auditoría</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listQuery.isLoading ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">Cargando facturas…</TableCell></TableRow>
                  ) : items.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">No hay facturas que coincidan con los filtros.</TableCell></TableRow>
                  ) : items.map((item) => {
                    const hasIssues = item.audit?.action === 'AUDIT' && item.audit?.result === 'ISSUES';
                    return (
                    <TableRow key={item.id} className={cn(selected.has(item.id) && 'bg-primary/5')}>
                      <TableCell>
                        <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} />
                      </TableCell>
                      <TableCell><span className="font-mono text-xs font-bold">{item.number}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.date ? new Date(item.date).toLocaleDateString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs">{item.partyName}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums font-bold">{fmtMoney(item.total)} {item.currency || ''}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-lg text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          {STATUS_LABELS[String(item.status || '').toUpperCase()] || item.status || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>{auditBadge(item)}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {hasIssues && (
                            <>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg text-sky-600" disabled={busyId === item.id} onClick={() => handleSendToCorrect(item)} title="Enviar a corregir">
                                {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Corregir
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-lg text-destructive" disabled={busyId === item.id} onClick={() => setCancelTarget({ id: item.id, number: item.number, reason: '', saving: false })} title="Anular factura y revertir asiento">
                                <Ban className="size-3.5" /> Anular
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Página {page} de {totalPages}</span><span>·</span><span>{total} factura(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" className="h-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}

      {tab === 'history' && (
        <>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={histAction} onValueChange={(v) => { setHistAction(v); setHistPage(1); }}>
              <SelectTrigger className="h-9 w-48 rounded-xl text-xs font-bold"><SelectValue placeholder="Tipo de evento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Todos los eventos</SelectItem>
                {HISTORY_ACTIONS.map((a) => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="size-9 rounded-xl" onClick={() => historyQuery.refetch()} title="Actualizar">
              <RefreshCw className={cn('size-4', historyQuery.isFetching && 'animate-spin')} />
            </Button>
          </div>

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Factura</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">{kind === 'SALE' ? 'Cliente' : 'Proveedor'}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Evento</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Resultado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Observaciones</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Auditor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyQuery.isLoading ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando historial…</TableCell></TableRow>
                  ) : histItems.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">No hay eventos de auditoría registrados.</TableCell></TableRow>
                  ) : histItems.map((event) => {
                    const meta = ACTION_META[String(event.action).toUpperCase()] || ACTION_META.AUDIT;
                    return (
                      <TableRow key={event.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {event.auditedAt ? new Date(event.auditedAt).toLocaleString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </TableCell>
                        <TableCell><span className="font-mono text-xs font-bold">{event.invoiceNumber}</span></TableCell>
                        <TableCell className="text-xs">{event.partyName}</TableCell>
                        <TableCell>
                          <Badge className={cn('gap-1 rounded-lg text-[9px] font-black uppercase tracking-widest', meta.cls)}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {event.action === 'AUDIT' ? (
                            <Badge className={cn('gap-1 rounded-lg text-[9px] font-black uppercase tracking-widest', event.result === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
                              {event.result === 'APPROVED' ? <CheckCircle2 className="size-3" /> : <AlertTriangle className="size-3" />}
                              {event.result === 'APPROVED' ? 'Aprobada' : 'Con anomalías'}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="max-w-56 text-xs text-muted-foreground">
                          {event.newInvoiceNumber ? `Reemisión → ${event.newInvoiceNumber}` : (event.observations || '—')}
                        </TableCell>
                        <TableCell className="text-xs">{event.auditedByName || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span>Página {histPage} de {histTotalPages}</span><span>·</span><span>{histTotal} evento(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-8" disabled={histPage <= 1} onClick={() => setHistPage(histPage - 1)}>Anterior</Button>
              <Button variant="outline" size="sm" className="h-8" disabled={histPage >= histTotalPages} onClick={() => setHistPage(histPage + 1)}>Siguiente</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!auditModal} onOpenChange={(open) => { if (!open && !auditModal?.saving) setAuditModal(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Auditoría de Facturas · {kind === 'SALE' ? 'Venta' : 'Compra'}</DialogTitle>
            <DialogDescription className="text-xs">
              Se validará el proceso de {auditModal?.invoiceIds.length || 0} factura(s): líneas vs subtotal, IVA, total, saldo y cliente/proveedor. El resultado queda registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!auditModal?.results && (
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observaciones (opcional)</Label>
                <textarea value={auditModal?.observations || ''} onChange={(e) => setAuditModal((m) => (m ? { ...m, observations: e.target.value } : m))} rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/50"
                  placeholder="Comentarios sobre el proceso auditado…" />
              </div>
            )}
            {auditModal?.results ? (
              <div className="space-y-3">
                {auditModal.results.map((result) => {
                  const approved = result.result === 'APPROVED';
                  return (
                    <div key={result.invoiceId} className="rounded-xl border border-border/50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold">{result.number}</span>
                        <Badge className={cn('gap-1 rounded-lg text-[9px] font-black uppercase tracking-widest', approved ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
                          {approved ? <CheckCircle2 className="size-3" /> : <FileWarning className="size-3" />}
                          {approved ? 'Sin anomalías' : 'Con anomalías'}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        {result.checks.map((check) => (
                          <div key={check.key} className="flex items-start gap-2">
                            {check.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />}
                            <div className="min-w-0">
                              <p className={cn('text-xs font-bold', check.ok ? 'text-foreground' : 'text-amber-600')}>{check.label}</p>
                              {check.detail && <p className="text-[10px] text-muted-foreground">{check.detail}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 py-8 text-xs text-muted-foreground">
                {auditModal?.saving ? <><Loader2 className="size-4 animate-spin" /> Validando y registrando auditoría…</> : <>Listo para auditar {auditModal?.invoiceIds.length || 0} factura(s).</>}
              </div>
            )}
          </div>
          <DialogFooter>
            {auditModal?.results ? (
              <Button className="rounded-xl" onClick={() => setAuditModal(null)}><X className="size-4" /> Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" className="rounded-xl" disabled={auditModal?.saving} onClick={() => setAuditModal(null)}>Cancelar</Button>
                <Button className="gap-2 rounded-xl" disabled={auditModal?.saving} onClick={runAudit}>
                  {auditModal?.saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Registrar auditoría
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open && !cancelTarget?.saving) setCancelTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Anular factura {cancelTarget?.number}</DialogTitle>
            <DialogDescription className="text-xs">
              La factura se anulará en {kind === 'SALE' ? 'Ventas' : 'Compras'} y su asiento contable se revertirá automáticamente (si existe).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Motivo de anulación</Label>
            <textarea value={cancelTarget?.reason || ''} onChange={(e) => setCancelTarget((t) => (t ? { ...t, reason: e.target.value } : t))} rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/50"
              placeholder="Ej: Factura mal emitida, se creará la corregida en Ventas…" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" disabled={cancelTarget?.saving} onClick={() => setCancelTarget(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-xl bg-destructive text-white hover:bg-destructive/90" disabled={cancelTarget?.saving} onClick={handleCancel}>
              {cancelTarget?.saving ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              Anular y revertir asiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InvoiceAuditView;
