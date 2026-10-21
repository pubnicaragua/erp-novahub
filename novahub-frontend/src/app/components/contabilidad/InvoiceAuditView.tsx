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
import { toast } from '@/app/services/toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { contabilidadService } from '../../services/contabilidad.service';
import { invoicesService } from '../../services/ventas.service';
import { DateField } from '../ui/DateField';
import { useAuth } from '../../contexts/AuthContext';
import { beginNotificationAction, completeNotificationAction, failNotificationAction } from '../../services/notification-action-coordinator';

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
  const { canPerform } = useAuth();
  const canViewInvoiceAudit = canPerform('ACCOUNTING_INVOICE_AUDIT', 'view');
  const canAuditInvoices = canPerform('ACCOUNTING_INVOICE_AUDIT', 'audit');
  const canSendToCorrect = canPerform('ACCOUNTING_INVOICE_AUDIT', 'sendToCorrect');
  const canCancelAuditedInvoice = canPerform('ACCOUNTING_INVOICE_AUDIT', 'cancelInvoice');
  const canReissueInvoice = canPerform('ACCOUNTING_INVOICE_AUDIT', 'reissueInvoice');
  const canApproveCancellation = canPerform('ACCOUNTING_INVOICE_AUDIT', 'approveCancellation');
  const canRejectCancellation = canPerform('ACCOUNTING_INVOICE_AUDIT', 'rejectCancellation');
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
  const [cancelTarget, setCancelTarget] = useState<{ invoiceId: string; number: string; reason: string; saving: boolean } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<{ id: string; number: string; decision: 'APPROVE' | 'REJECT'; reason: string; saving: boolean } | null>(null);
  const [reissueTarget, setReissueTarget] = useState<{ invoiceId: string; number: string; kind: AuditKind; replacementSearch: string; newInvoiceId: string; observations: string; saving: boolean } | null>(null);

  const listQuery = useQuery({
    queryKey: ['invoice-audit', kind, search, auditStatus, dateFrom, dateTo, page],
    queryFn: ({ signal }) => contabilidadService.getInvoiceAuditList({
      kind, search: search || undefined,
      auditStatus: auditStatus === 'ALL' ? undefined : auditStatus,
      dateFrom: dateFrom || undefined, dateTo: dateTo || undefined,
      page, pageSize: 20,
    }, signal),
    staleTime: 30_000, gcTime: 5 * 60_000, retry: 1,
    enabled: canViewInvoiceAudit,
  });

  const [histAction, setHistAction] = useState('ALL');
  const [histPage, setHistPage] = useState(1);
  const historyQuery = useQuery({
    queryKey: ['invoice-audit-history', kind, histAction, histPage],
    queryFn: ({ signal }) => contabilidadService.getInvoiceAuditHistory({
      kind, action: histAction === 'ALL' ? undefined : histAction, page: histPage, pageSize: 20,
    }, signal),
    staleTime: 30_000, gcTime: 5 * 60_000, retry: 1,
    enabled: canViewInvoiceAudit,
  });

  const cancellationRequestsQuery = useQuery({
    queryKey: ['invoice-cancellation-requests'],
    queryFn: ({ signal }) => invoicesService.getCancellationRequests('PENDING', signal),
    staleTime: 10_000, gcTime: 5 * 60_000, retry: 1,
    enabled: canViewInvoiceAudit && kind === 'SALE',
  });

  const reissueCandidatesQuery = useQuery({
    queryKey: ['invoice-audit-reissue-candidates', reissueTarget?.kind, reissueTarget?.replacementSearch || ''],
    queryFn: ({ signal }) => contabilidadService.getInvoiceAuditList({
      kind: reissueTarget!.kind,
      search: reissueTarget!.replacementSearch.trim() || undefined,
      page: 1,
      pageSize: 50,
    }, signal),
    staleTime: 15_000,
    enabled: Boolean(reissueTarget && canReissueInvoice),
  });

  const data = listQuery.data as any;
  const items: any[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  const total = Number(data?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const histData = historyQuery.data as any;
  const histItems: any[] = Array.isArray(histData) ? histData : Array.isArray(histData?.items) ? histData.items : [];
  const histTotal = Number(histData?.total || 0);
  const histTotalPages = Math.max(1, Math.ceil(histTotal / 20));
  const reissueCandidateData = reissueCandidatesQuery.data as any;
  const reissueCandidates: any[] = (Array.isArray(reissueCandidateData) ? reissueCandidateData : Array.isArray(reissueCandidateData?.items) ? reissueCandidateData.items : [])
    .filter((item: any) => item.id !== reissueTarget?.invoiceId && String(item.status || '').toUpperCase() !== 'CANCELLED');

  const allSelectedOnPage = items.length > 0 && items.every((item) => selected.has(item.id));

  const toggleAll = () => {
    if (!canAuditInvoices) return;
    setSelected((current) => {
      const next = new Set(current);
      if (allSelectedOnPage) items.forEach((item) => next.delete(item.id));
      else items.forEach((item) => next.add(item.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    if (!canAuditInvoices) return;
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
    queryClient.invalidateQueries({ queryKey: ['invoice-audit'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-audit-history'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-cancellation-requests'] });
  };

  const openAuditModal = () => {
    if (!canAuditInvoices || selected.size === 0) return;
    setAuditModal({ invoiceIds: [...selected], observations: '', results: null, saving: false });
  };

  const runAudit = async () => {
    if (!auditModal || !canAuditInvoices) return;
    const actionToken = beginNotificationAction();
    try {
      setAuditModal((m) => (m ? { ...m, saving: true } : m));
      const results = await contabilidadService.auditInvoices({ kind, invoiceIds: auditModal.invoiceIds, observations: auditModal.observations.trim() || undefined });
      const list = Array.isArray(results) ? results : Array.isArray((results as any)?.results) ? (results as any).results : [];
      setAuditModal((m) => (m ? { ...m, results: list, saving: false } : m));
      const issues = list.filter((r: any) => r.result === 'ISSUES').length;
      if (issues > 0) toast.warning(`${issues} factura(s) con anomalías. Puedes enviarlas a corregir o anularlas directamente.`);
      else toast.success(`${list.length} factura(s) auditadas correctamente`);
      completeNotificationAction(actionToken);
      setSelected(new Set());
      refreshAll();
    } catch (e: any) {
      setAuditModal((m) => (m ? { ...m, saving: false } : m));
      toast.error(e?.message || 'No se pudo registrar la auditoría');
      failNotificationAction(actionToken);
    }
  };

  const handleSendToCorrect = async (item: any) => {
    if (!canSendToCorrect) return;
    const actionToken = beginNotificationAction();
    try {
      setBusyId(item.id);
      await contabilidadService.sendToCorrect({ kind, invoiceIds: [item.id], observations: 'Enviada a corregir desde auditoría' });
      toast.success(`Factura ${item.number} enviada a corrección`);
      completeNotificationAction(actionToken);
      refreshAll();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo enviar a corregir');
      failNotificationAction(actionToken);
    } finally {
      setBusyId(null);
    }
  };

  const openCancelDialog = (item: { invoiceId?: string; id?: string; number?: string }) => {
    if (!canCancelAuditedInvoice) return;
    const invoiceId = item.invoiceId || item.id;
    if (!invoiceId) return;
    setCancelTarget({ invoiceId, number: item.number || 'Factura', reason: '', saving: false });
  };

  const cancelAuditedInvoice = async () => {
    if (!cancelTarget || !canCancelAuditedInvoice) return;
    const actionToken = beginNotificationAction();
    try {
      setCancelTarget((target) => (target ? { ...target, saving: true } : target));
      const result = await contabilidadService.cancelAuditedInvoice({
        kind,
        invoiceId: cancelTarget.invoiceId,
        reason: cancelTarget.reason.trim() || undefined,
      });
      const journalReversed = Boolean((result as any)?.journalReversed);
      toast.success(journalReversed
        ? 'Factura anulada, saldo actualizado y asiento revertido'
        : 'Factura anulada y saldo actualizado');
      completeNotificationAction(actionToken);
      setCancelTarget(null);
      setAuditModal(null);
      setSelected(new Set());
      refreshAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo anular la factura');
      failNotificationAction(actionToken);
      setCancelTarget((target) => (target ? { ...target, saving: false } : target));
    }
  };

  const openReissueDialog = (item: { id?: string; number?: string }) => {
    if (!canReissueInvoice || !item.id) return;
    setReissueTarget({ invoiceId: item.id, number: item.number || 'Factura', kind, replacementSearch: '', newInvoiceId: '', observations: '', saving: false });
  };

  const registerReissue = async () => {
    if (!reissueTarget || !canReissueInvoice) return;
    if (!reissueTarget.newInvoiceId) {
      toast.error('Selecciona la factura corregida que reemplaza a la factura anulada.');
      return;
    }
    const actionToken = beginNotificationAction();
    try {
      setReissueTarget((target) => (target ? { ...target, saving: true } : target));
      await contabilidadService.registerReissue({
        kind: reissueTarget.kind,
        invoiceId: reissueTarget.invoiceId,
        newInvoiceId: reissueTarget.newInvoiceId,
        observations: reissueTarget.observations.trim() || undefined,
      });
      toast.success(`Reemisión de ${reissueTarget.number} registrada`);
      completeNotificationAction(actionToken);
      setReissueTarget(null);
      refreshAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo registrar la reemisión');
      failNotificationAction(actionToken);
      setReissueTarget((target) => (target ? { ...target, saving: false } : target));
    }
  };

  const reviewCancellationRequest = async () => {
    if (!reviewTarget) return;
    if (reviewTarget.decision === 'APPROVE' ? !canApproveCancellation : !canRejectCancellation) return;
    if (reviewTarget.decision === 'REJECT' && !reviewTarget.reason.trim()) {
      toast.error('Escribe el motivo del rechazo');
      return;
    }
    const actionToken = beginNotificationAction();
    try {
      setReviewTarget((t) => (t ? { ...t, saving: true } : t));
      const result = await invoicesService.reviewCancellationRequest(reviewTarget.id, reviewTarget.decision, reviewTarget.reason.trim() || undefined);
      if (reviewTarget.decision === 'APPROVE') {
        const journalReversed = Boolean((result as any)?.reversal?.journalReversed);
        toast.success(journalReversed ? 'Solicitud aprobada: factura anulada y asiento revertido' : 'Solicitud aprobada: factura anulada');
      } else {
        toast.success('Solicitud de anulación rechazada');
      }
      completeNotificationAction(actionToken);
      setReviewTarget(null);
      refreshAll();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || 'No se pudo procesar la solicitud');
      failNotificationAction(actionToken);
      setReviewTarget((t) => (t ? { ...t, saving: false } : t));
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
              Valida líneas, IVA, retenciones, totales y saldos; permite corregir o anular directamente las facturas con anomalías.
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
            <DateField
              value={dateFrom}
              onChange={(v) => {
                if (dateTo && v && v > dateTo) {
                  toast.error('No se puede filtrar a una fecha anterior a la fecha inicial');
                  setDateTo(v);
                }
                setDateFrom(v);
                setPage(1);
              }}
              maxDate={dateTo || undefined}
              placeholder="Desde"
              className="w-36"
            />
            <DateField
              value={dateTo}
              onChange={(v) => {
                if (dateFrom && v && v < dateFrom) {
                  toast.error('No se puede filtrar a una fecha anterior a la fecha inicial');
                  return;
                }
                setDateTo(v);
                setPage(1);
              }}
              minDate={dateFrom || undefined}
              placeholder="Hasta"
              className="w-36"
            />
            <Button variant="outline" size="icon" className="size-9 rounded-xl" onClick={() => { refreshAll(); listQuery.refetch(); }} title="Actualizar">
              <RefreshCw className={cn('size-4', listQuery.isFetching && 'animate-spin')} />
            </Button>
            {canAuditInvoices && <Button onClick={openAuditModal} disabled={selected.size === 0} className="gap-2 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[10px] tracking-widest h-9 hover:bg-primary/90">
              <ShieldCheck className="size-4" /> Auditar seleccionadas ({selected.size})
            </Button>}
          </div>

          {kind === 'SALE' && (
            <Card className="rounded-2xl border-amber-500/30 bg-amber-500/[0.04]">
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-foreground">Solicitudes de anulación</h4>
                    <p className="mt-1 text-[11px] text-muted-foreground">La factura permanece activa hasta que Contabilidad apruebe la solicitud.</p>
                  </div>
                  <Badge variant="outline" className="rounded-lg border-amber-500/30 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    {cancellationRequestsQuery.data?.length || 0} pendientes
                  </Badge>
                </div>
                {cancellationRequestsQuery.isLoading ? (
                  <div className="rounded-xl border border-dashed border-border/60 py-5 text-center text-xs text-muted-foreground">Cargando solicitudes…</div>
                ) : cancellationRequestsQuery.isError ? (
                  <div className="rounded-xl border border-dashed border-destructive/30 py-5 text-center text-xs text-destructive">No se pudieron cargar las solicitudes.</div>
                ) : !cancellationRequestsQuery.data?.length ? (
                  <div className="rounded-xl border border-dashed border-border/60 py-5 text-center text-xs text-muted-foreground">No hay solicitudes pendientes.</div>
                ) : (
                  <div className="space-y-2">
                    {cancellationRequestsQuery.data.map((request: any) => (
                      <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/70 p-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-black">{request.invoice?.number || 'Factura'}</span>
                            <Badge variant="outline" className="rounded-md text-[9px]">{request.requestedBy?.name || 'Usuario'}</Badge>
                            <span className="text-[10px] text-muted-foreground">{request.createdAt ? new Date(request.createdAt).toLocaleString('es-NI') : ''}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground" title={request.reason}>{request.reason}</p>
                        </div>
                        {(canApproveCancellation || canRejectCancellation) && (
                          <div className="flex shrink-0 gap-2">
                            {canApproveCancellation && <Button size="sm" className="h-8 rounded-lg bg-destructive px-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-destructive/90" onClick={() => setReviewTarget({ id: request.id, number: request.invoice?.number || '', decision: 'APPROVE', reason: '', saving: false })}>
                              <CheckCircle2 className="mr-1.5 size-3.5" /> Aprobar y anular
                            </Button>}
                            {canRejectCancellation && <Button size="sm" variant="outline" className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest" onClick={() => setReviewTarget({ id: request.id, number: request.invoice?.number || '', decision: 'REJECT', reason: '', saving: false })}>
                              <X className="mr-1.5 size-3.5" /> Rechazar
                            </Button>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      {canAuditInvoices && <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={allSelectedOnPage} onChange={toggleAll} aria-label="Seleccionar todas las facturas de la página para auditar" />}
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Número</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">{kind === 'SALE' ? 'Cliente' : 'Proveedor'}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Total</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Auditoría</TableHead>
                    <TableHead className="w-[84px] text-right text-[10px] font-black uppercase tracking-widest">Acciones</TableHead>
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
                        {canAuditInvoices && <input type="checkbox" className="size-4 cursor-pointer rounded border-border accent-primary" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} aria-label={`Seleccionar factura ${item.number} para auditar`} />}
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
                        <div className="flex items-center justify-end gap-0.5 whitespace-nowrap">
                          {hasIssues && (
                            <>
                              {canSendToCorrect && <Button variant="ghost" size="icon" className="size-8 rounded-lg text-sky-600 hover:bg-sky-500/10 hover:text-sky-600" disabled={busyId === item.id} onClick={() => handleSendToCorrect(item)} title="Enviar a corregir" aria-label={`Enviar factura ${item.number} a corregir`}>
                                {busyId === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                              </Button>}
                              {canCancelAuditedInvoice && (
                                <Button variant="ghost" size="icon" className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => openCancelDialog(item)} title="Anular y revertir" aria-label={`Anular factura ${item.number} y revertir`}>
                                  <Ban className="size-3.5" />
                                </Button>
                              )}
                            </>
                          )}
                          {canReissueInvoice && String(item.status || '').toUpperCase() === 'CANCELLED' && item.audit?.action !== 'REISSUED' && (
                            <Button variant="ghost" size="icon" className="size-8 rounded-lg text-violet-600 hover:bg-violet-500/10 hover:text-violet-600" onClick={() => openReissueDialog(item)} title="Registrar reemisión" aria-label={`Registrar reemisión de factura ${item.number}`}>
                              <FilePlus2 className="size-3.5" />
                            </Button>
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
                        <div className="flex items-center gap-2">
                          <Badge className={cn('gap-1 rounded-lg text-[9px] font-black uppercase tracking-widest', approved ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20')}>
                            {approved ? <CheckCircle2 className="size-3" /> : <FileWarning className="size-3" />}
                            {approved ? 'Sin anomalías' : 'Con anomalías'}
                          </Badge>
                          {!approved && canCancelAuditedInvoice && (
                            <Button size="sm" className="h-7 rounded-lg bg-destructive px-2.5 text-[9px] font-black uppercase tracking-widest text-destructive-foreground hover:bg-destructive/90" onClick={() => openCancelDialog(result)}>
                              <Ban className="mr-1 size-3" /> Anular y revertir
                            </Button>
                          )}
                        </div>
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
              <Button type="button" variant="outline" className="rounded-xl text-muted-foreground hover:text-foreground" onClick={() => setAuditModal(null)}><X className="size-4" /> Cerrar</Button>
            ) : (
              <>
                <Button variant="outline" className="rounded-xl" disabled={auditModal?.saving} onClick={() => setAuditModal(null)}>Cancelar</Button>
                <Button className="gap-2 rounded-xl" disabled={!canAuditInvoices || auditModal?.saving} onClick={runAudit}>
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
            <DialogTitle className="text-lg font-black uppercase tracking-tight">¿Anular factura {cancelTarget?.number}?</DialogTitle>
            <DialogDescription className="text-xs">
              La factura se marcará como anulada desde el flujo contable. También se actualizará el saldo, se revertirá inventario/caja cuando corresponda y se intentará revertir su asiento contable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Motivo de anulación (opcional)</Label>
            <textarea
              value={cancelTarget?.reason || ''}
              onChange={(e) => setCancelTarget((target) => (target ? { ...target, reason: e.target.value } : target))}
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/50"
              placeholder="Ej: Diferencia en IVA detectada durante auditoría…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" disabled={cancelTarget?.saving} onClick={() => setCancelTarget(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={!canCancelAuditedInvoice || cancelTarget?.saving} onClick={cancelAuditedInvoice}>
              {cancelTarget?.saving ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              Anular y revertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewTarget} onOpenChange={(open) => { if (!open && !reviewTarget?.saving) setReviewTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">
              {reviewTarget?.decision === 'APPROVE' ? '¿Aprobar anulación?' : '¿Rechazar solicitud?'} {reviewTarget?.number}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {reviewTarget?.decision === 'APPROVE'
                ? 'La factura se anulará y se revertirá su asiento contable si existe. Esta acción requiere autorización de Contabilidad.'
                : 'La factura seguirá activa y el solicitante recibirá el motivo del rechazo.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{reviewTarget?.decision === 'REJECT' ? 'Motivo del rechazo *' : 'Observación de aprobación (opcional)'}</Label>
            <textarea value={reviewTarget?.reason || ''} onChange={(e) => setReviewTarget((t) => (t ? { ...t, reason: e.target.value } : t))} rows={3}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/50"
              placeholder={reviewTarget?.decision === 'REJECT' ? 'Ej: La factura debe corregirse antes de solicitar la anulación…' : 'Observación interna…'} />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" disabled={reviewTarget?.saving} onClick={() => setReviewTarget(null)}>Cancelar</Button>
            <Button className={cn('gap-2 rounded-xl', reviewTarget?.decision === 'APPROVE' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-primary text-primary-foreground hover:bg-primary/90')} disabled={reviewTarget?.saving || (reviewTarget?.decision === 'APPROVE' ? !canApproveCancellation : !canRejectCancellation) || (reviewTarget?.decision === 'REJECT' && !reviewTarget.reason.trim())} onClick={reviewCancellationRequest}>
              {reviewTarget?.saving ? <Loader2 className="size-4 animate-spin" /> : reviewTarget?.decision === 'APPROVE' ? <Ban className="size-4" /> : <X className="size-4" />}
              {reviewTarget?.decision === 'APPROVE' ? 'Aprobar y anular' : 'Rechazar solicitud'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reissueTarget} onOpenChange={(open) => { if (!open && !reissueTarget?.saving) setReissueTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tight">Registrar reemisión · {reissueTarget?.number}</DialogTitle>
            <DialogDescription className="text-xs">Vincula la factura anulada con la factura corregida para conservar la trazabilidad de auditoría.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reissue-invoice-search" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Buscar factura corregida</Label>
              <Input id="reissue-invoice-search" value={reissueTarget?.replacementSearch || ''} onChange={(event) => setReissueTarget((target) => target ? { ...target, replacementSearch: event.target.value, newInvoiceId: '' } : target)} placeholder="Número, cliente o proveedor…" className="h-9 rounded-xl text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Factura que reemplaza a {reissueTarget?.number}</Label>
              <Select value={reissueTarget?.newInvoiceId || ''} onValueChange={(value) => setReissueTarget((target) => target ? { ...target, newInvoiceId: value } : target)}>
                <SelectTrigger className="h-10 rounded-xl text-xs"><SelectValue placeholder={reissueCandidatesQuery.isFetching ? 'Buscando facturas…' : 'Seleccionar factura corregida'} /></SelectTrigger>
                <SelectContent>
                  {reissueCandidates.map((candidate) => <SelectItem key={candidate.id} value={candidate.id} className="text-xs">{candidate.number} · {candidate.partyName || 'Sin tercero'} · {STATUS_LABELS[String(candidate.status || '').toUpperCase()] || candidate.status}</SelectItem>)}
                </SelectContent>
              </Select>
              {!reissueCandidatesQuery.isFetching && reissueCandidates.length === 0 && <p className="text-[10px] text-muted-foreground">No hay facturas activas con esta búsqueda. Ajusta el texto para localizar la factura corregida.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reissue-observations" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Observaciones (opcional)</Label>
              <textarea id="reissue-observations" value={reissueTarget?.observations || ''} onChange={(event) => setReissueTarget((target) => target ? { ...target, observations: event.target.value } : target)} rows={3} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary/50" placeholder="Motivo o referencia de la corrección…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" disabled={reissueTarget?.saving} onClick={() => setReissueTarget(null)}>Cancelar</Button>
            <Button className="gap-2 rounded-xl" disabled={!canReissueInvoice || !reissueTarget?.newInvoiceId || reissueTarget?.saving} onClick={registerReissue}>
              {reissueTarget?.saving ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />} Registrar reemisión
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InvoiceAuditView;
