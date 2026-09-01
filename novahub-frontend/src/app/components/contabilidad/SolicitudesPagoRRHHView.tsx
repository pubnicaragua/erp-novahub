import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Banknote,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileCheck2,
  Gift,
  GraduationCap,
  Inbox,
  Loader2,
  Plus,
  ReceiptText,
  Search,
  ShieldAlert,
  Split,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BankAccountSelect } from '../ui/BankAccountSelect';
import { CurrencySelector } from '../ui/CurrencySelector';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { hrService } from '../../services/hr.service';
import { hasPaymentReferenceField, isBankPaymentMethod, requiresPaymentReference } from '../../utils/paymentMethods';

type PaymentRequest = {
  id: string;
  requestType: 'PAYROLL' | 'TRAINING' | 'BENEFIT' | string;
  sourceId: string;
  amount: number | string;
  currency?: string;
  exchangeRate?: number | string;
  baseAmount?: number | string;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  rejectionReason?: string | null;
  source?: any;
  payments?: any[];
};

type PaymentLine = { method: string; amount: string; currency: 'NIO' | 'USD'; exchangeRate: number; bankAccountId?: string; reference?: string };

const statusMeta: Record<string, { label: string; className: string; icon: typeof Clock3 }> = {
  PENDING: { label: 'Pendiente de aprobación', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock3 },
  APPROVED: { label: 'Aprobada · por pagar', className: 'bg-sky-500/10 text-sky-600 border-sky-500/20', icon: BadgeCheck },
  PAID: { label: 'Pagada', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazada', className: 'bg-rose-500/10 text-rose-600 border-rose-500/20', icon: XCircle },
};

const typeMeta: Record<string, { label: string; icon: typeof ReceiptText; tint: string }> = {
  PAYROLL: { label: 'Nómina', icon: ReceiptText, tint: 'text-blue-500 bg-blue-500/10' },
  TRAINING: { label: 'Capacitación', icon: GraduationCap, tint: 'text-violet-500 bg-violet-500/10' },
  BENEFIT: { label: 'Beneficio', icon: Gift, tint: 'text-rose-500 bg-rose-500/10' },
};

const methods = [
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'CHECK', label: 'Cheque' },
];

const isBankMethod = (method: string) => isBankPaymentMethod(method, true);

function unwrap<T = any>(value: any): T {
  return value?.data && !Array.isArray(value.data) ? value.data : value;
}

function sourceLabel(request: PaymentRequest) {
  const source = request.source;
  if (request.requestType === 'PAYROLL') {
    const employee = source?.employee ? `${source.employee.firstName || ''} ${source.employee.lastName || ''}`.trim() : 'Empleado';
    return `${employee} · ${source?.periodStart ? new Date(source.periodStart).toLocaleDateString('es-NI', { month: 'short', year: 'numeric' }) : 'Período'}`;
  }
  return request.requestType === 'TRAINING' ? source?.title || 'Capacitación' : source?.name || 'Beneficio';
}

function parsePaymentAmount(value: string | number) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPaymentInput(value: string | number) {
  const raw = String(value ?? '').replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!raw) return '';
  const [wholePart = '', decimalPart] = raw.split('.');
  const whole = Number(wholePart || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return decimalPart === undefined ? whole : `${whole}.${decimalPart.slice(0, 2)}`;
}

export function SolicitudesPagoRRHHView() {
  const { canPerform } = useAuth();
  const { formatConvertedAmount, displayCurrency, baseCurrency, exchangeRate, toBaseAmount, convertBetweenCurrencies } = useCurrency();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newRequestCount, setNewRequestCount] = useState(0);
  const knownRequestIdsRef = useRef<Set<string> | null>(null);
  const canApproveRequests = canPerform('ACCOUNTING_HR_PAYMENT_REQUESTS', 'approve') || canPerform('ACCOUNTING_JOURNAL', 'approve');
  const canRejectRequests = canPerform('ACCOUNTING_HR_PAYMENT_REQUESTS', 'reject') || canPerform('ACCOUNTING_JOURNAL', 'reject');
  const canPayRequests = canPerform('ACCOUNTING_HR_PAYMENT_REQUESTS', 'pay') || canPerform('ACCOUNTING_JOURNAL', 'pay');
  const canReadPaymentRequests = canPerform('ACCOUNTING_HR_PAYMENT_REQUESTS', 'view') || canPerform('ACCOUNTING', 'view');
  const paymentCurrency = paymentLines[0]?.currency || displayCurrency;
  const paymentLineRate = (currency: 'NIO' | 'USD') => currency === baseCurrency ? 1 : Number(exchangeRate || 1);
  const paymentLine = (method: string, amount = '0', currency: 'NIO' | 'USD' = displayCurrency): PaymentLine => ({
    method,
    amount,
    currency,
    exchangeRate: paymentLineRate(currency),
    reference: '',
  });

  const query = useQuery({
    queryKey: ['hr-payment-requests', statusFilter, typeFilter],
    queryFn: async ({ signal }) => {
      const response: any = await hrService.getPaymentRequests({ page: 1, pageSize: 200, status: statusFilter, requestType: typeFilter }, signal);
      const body = unwrap<any>(response);
      return Array.isArray(body) ? body : body?.data || [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: canReadPaymentRequests,
  });

  const requests = (query.data || []) as PaymentRequest[];
  useEffect(() => {
    if (query.isLoading) return;
    const currentIds = new Set(requests.map((request) => request.id));
    if (!knownRequestIdsRef.current) {
      knownRequestIdsRef.current = currentIds;
      return;
    }
    const added = requests.filter((request) => !knownRequestIdsRef.current?.has(request.id));
    knownRequestIdsRef.current = currentIds;
    if (added.length > 0) {
      setNewRequestCount((current) => current + added.length);
      toast.info(added.length === 1 ? 'Nueva solicitud de pago de RR. HH.' : `${added.length} nuevas solicitudes de pago de RR. HH.`, {
        description: sourceLabel(added[0]),
        duration: 6000,
      });
    }
  }, [query.isLoading, requests]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;
    return requests.filter((request) => `${sourceLabel(request)} ${request.requestType} ${request.id}`.toLowerCase().includes(term));
  }, [requests, search]);

  const totals = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'PENDING').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    paid: requests.filter((r) => r.status === 'PAID').length,
    amount: requests.filter((r) => r.status !== 'PAID' && r.status !== 'REJECTED').reduce((sum, r) => sum + Number(r.baseAmount || 0), 0),
  }), [requests]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['hr-payment-requests'] });

  const runAction = async (id: string, action: () => Promise<any>, success: string) => {
    setBusyId(id);
    try {
      await action();
      toast.success(success);
      refresh();
      setPaymentRequest(null);
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'No se pudo completar la operación.';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setBusyId(null);
    }
  };

  const openPayment = (request: PaymentRequest) => {
    const nextCurrency = displayCurrency;
    const sourceCurrency = request.currency === 'USD' ? 'USD' : 'NIO';
    const sourceRate = Number(request.exchangeRate || 1);
    const requestBase = Number(request.baseAmount || toBaseAmount(Number(request.amount || 0), sourceCurrency, sourceRate));
    const nextRate = paymentLineRate(nextCurrency);
    const initialAmount = convertBetweenCurrencies(requestBase, baseCurrency, nextCurrency, 1, nextRate);

    setPaymentRequest(request);
    setPaymentLines([{ ...paymentLine('TRANSFER', formatPaymentInput(initialAmount.toFixed(2)), nextCurrency), bankAccountId: '' }]);
  };

  const paymentTotalBase = paymentLines.reduce((sum, line) => sum + toBaseAmount(
    parsePaymentAmount(line.amount),
    line.currency,
    line.currency === baseCurrency ? 1 : Number(line.exchangeRate || exchangeRate),
  ), 0);
  const requestAmount = Number(paymentRequest?.amount || 0);
  const requestCurrency = paymentRequest?.currency === 'USD' ? 'USD' : 'NIO';
  const requestRate = Number(paymentRequest?.exchangeRate || 1);
  const requestTotalBase = Number(paymentRequest?.baseAmount || toBaseAmount(requestAmount, requestCurrency, requestRate));
  const balanced = Math.abs(paymentTotalBase - requestTotalBase) <= 0.01;
  const remainingBase = Math.max(requestTotalBase - paymentTotalBase, 0);
  const excessBase = Math.max(paymentTotalBase - requestTotalBase, 0);
  const formatNativeAmount = (amount: number, currency: string) => `${currency === 'USD' ? '$' : 'C$'} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const submitPayment = () => {
    if (!paymentRequest || !balanced) {
      toast.error(`Distribuye exactamente el total convertido de la solicitud (${requestTotalBase.toFixed(2)} ${baseCurrency}). No se permiten pagos parciales.`);
      return;
    }
    if (paymentLines.some((line) => isBankMethod(line.method) && !line.bankAccountId)) {
      toast.error('Selecciona la cuenta bancaria global para cada transferencia, tarjeta o cheque.');
      return;
    }
    if (paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim())) {
      toast.error('La referencia es obligatoria para tarjeta, transferencia o cheque.');
      return;
    }
    runAction(
      paymentRequest.id,
      () => hrService.payPaymentRequest(paymentRequest.id, paymentLines.map((line) => ({ ...line, amount: parsePaymentAmount(line.amount) })), paymentCurrency),
      'Pago registrado y asiento contable generado.',
    );
  };

  const metaForStatus = (status: string) => statusMeta[status] || statusMeta.PENDING;

  return (
    <div className="min-w-0 space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.13] via-card to-card p-4 shadow-sm sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-16 size-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary">
              <Inbox className="size-4" /> Cola de autorización · RR. HH.
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Solicitudes de pago</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-background/60 px-3 py-2 text-xs font-bold text-muted-foreground backdrop-blur">
              <ShieldAlert className="size-4 text-primary" />
              {displayCurrency} · pagos completos
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="relative size-10 rounded-xl"
              aria-label={newRequestCount > 0 ? `${newRequestCount} nuevas solicitudes de pago` : 'Nuevas solicitudes de pago'}
              title="Nuevas solicitudes de pago"
              onClick={() => { setNewRequestCount(0); void query.refetch(); }}
            >
              <Bell className="size-4" />
              {newRequestCount > 0 && <Badge variant="destructive" className="absolute -right-1.5 -top-1.5 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]">{newRequestCount > 9 ? '9+' : newRequestCount}</Badge>}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Por aprobar', value: totals.pending, icon: Clock3, tone: 'text-amber-500 bg-amber-500/10' },
          { label: 'Aprobadas por pagar', value: totals.approved, icon: BadgeCheck, tone: 'text-sky-500 bg-sky-500/10' },
          { label: 'Pagadas', value: totals.paid, icon: CheckCircle2, tone: 'text-emerald-500 bg-emerald-500/10' },
          { label: 'Compromiso pendiente', value: formatConvertedAmount(totals.amount, baseCurrency as any), icon: Banknote, tone: 'text-primary bg-primary/10' },
        ].map((item) => (
          <Card key={item.label} className="rounded-2xl border-border/60 shadow-sm">
            <CardContent className="flex items-center gap-3 p-3">
              <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', item.tone)}><item.icon className="size-4.5" /></div>
              <div className="min-w-0"><p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p><p className="mt-0.5 text-lg font-black">{item.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empleado, beneficio..." className="h-10 rounded-xl pl-9" /></div>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="h-10 w-[160px] rounded-xl text-xs"><SelectValue placeholder="Todos los tipos" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los tipos</SelectItem><SelectItem value="PAYROLL">Nóminas</SelectItem><SelectItem value="BENEFIT">Beneficios</SelectItem><SelectItem value="TRAINING">Capacitaciones</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-10 w-[180px] rounded-xl text-xs"><SelectValue placeholder="Todos los estados" /></SelectTrigger><SelectContent><SelectItem value="ALL">Todos los estados</SelectItem><SelectItem value="PENDING">Por aprobar</SelectItem><SelectItem value="APPROVED">Por pagar</SelectItem><SelectItem value="PAID">Pagadas</SelectItem><SelectItem value="REJECTED">Rechazadas</SelectItem></SelectContent></Select>
        </div>
      </div>

      <div className="space-y-3">
        {query.isLoading && <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-12 text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Cargando solicitudes...</div>}
        {!query.isLoading && query.isError && <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-8 text-center text-sm text-rose-600">No se pudieron cargar las solicitudes. Revisa tu acceso a Contabilidad.</div>}
        {!query.isLoading && !query.isError && filtered.length === 0 && <div className="rounded-2xl border border-dashed border-border p-12 text-center"><Inbox className="mx-auto size-10 text-muted-foreground/30" /><p className="mt-3 text-sm font-bold">No hay solicitudes en esta bandeja</p><p className="mt-1 text-xs text-muted-foreground">Las solicitudes con costo aparecerán cuando RR. HH. las envíe a Contabilidad.</p></div>}
        {filtered.map((request) => {
          const type = typeMeta[request.requestType] || typeMeta.BENEFIT;
          const status = metaForStatus(request.status);
          const TypeIcon = type.icon;
          const StatusIcon = status.icon;
          return (
            <Card key={request.id} className="group rounded-2xl border-border/60 shadow-sm transition-all hover:border-primary/25 hover:shadow-md">
              <CardContent className="p-3 sm:p-4">
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
                  <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', type.tint)}><TypeIcon className="size-4" /></div>
                  <div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><Badge variant="outline" className="border-none px-2 text-[10px] font-black uppercase">{type.label}</Badge><span className="truncate text-xs text-muted-foreground">#{request.id.slice(0, 8)}</span></div><p className="mt-1 truncate text-base font-black">{sourceLabel(request)}</p><p className="mt-1 text-xs text-muted-foreground">Solicitada {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString('es-NI') : '—'}</p></div>
                  <div className="min-w-[150px] lg:text-right"><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto solicitado</p><p className="mt-1 text-lg font-black text-primary">{formatConvertedAmount(Number(request.amount || 0), request.currency as any, Number(request.exchangeRate || 1))}</p><p className="text-[10px] text-muted-foreground">{Number(request.payments?.length || 0) > 1 ? 'Pago mixto configurado' : 'Un medio de pago'}</p></div>
                  <Badge variant="outline" className={cn('w-fit shrink-0 gap-1 rounded-full px-3 py-1 text-[10px] font-black', status.className)}><StatusIcon className="size-3.5" /> {status.label}</Badge>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                    {request.status === 'PENDING' && canApproveRequests && <Button size="sm" className="rounded-xl" disabled={busyId === request.id} onClick={() => runAction(request.id, () => hrService.approvePaymentRequest(request.id), 'Solicitud aprobada.') }><Check className="mr-1.5 size-4" /> Aprobar</Button>}
                    {(request.status === 'PENDING' || request.status === 'APPROVED') && canRejectRequests && <Button size="sm" variant="outline" className="rounded-xl text-rose-600 hover:bg-rose-500/10" disabled={busyId === request.id} onClick={() => { const reason = window.prompt('Motivo del rechazo (opcional):') || 'Rechazada por Contabilidad'; runAction(request.id, () => hrService.rejectPaymentRequest(request.id, reason), 'Solicitud rechazada.'); }}><X className="mr-1.5 size-4" /> Rechazar</Button>}
                    {request.status === 'APPROVED' && canPayRequests && <Button size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" disabled={busyId === request.id} onClick={() => openPayment(request)}><Banknote className="mr-1.5 size-4" /> Registrar pago</Button>}
                    {request.status === 'PAID' && <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600"><FileCheck2 className="size-4" /> Contabilizada</span>}
                    <ChevronRight className="hidden size-4 text-muted-foreground/40 lg:block" />
                  </div>
                </div>
                {request.rejectionReason && <div className="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/5 px-3 py-2 text-xs text-rose-600"><span className="font-black">Motivo:</span> {request.rejectionReason}</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={Boolean(paymentRequest)} onOpenChange={(open) => !open && setPaymentRequest(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Split className="size-5 text-primary" /> Registrar pago mixto</DialogTitle><DialogDescription>{paymentRequest ? `${sourceLabel(paymentRequest)} · Total ${formatConvertedAmount(requestAmount, paymentRequest.currency as any, Number(paymentRequest.exchangeRate || 1))}` : ''}</DialogDescription></DialogHeader>
          <div className="space-y-3 py-2">
               <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">Distribuye el total entre efectivo, transferencia, tarjeta o cheque. Los montos se registran en la moneda elegida y se convierten con la tasa global; la suma contable debe cerrar exactamente.</div>
             {paymentLines.map((line, index) => <div key={`${index}-${line.method}`} className="rounded-xl border border-border/60 p-3"><div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,10rem)_minmax(7rem,10rem)_auto] sm:items-end"><div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Método</p><Select value={line.method} onValueChange={(value) => setPaymentLines((current) => current.map((item, i) => i === index ? { ...item, method: value, bankAccountId: '', reference: '' } : item))}><SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger><SelectContent>{methods.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent></Select></div><CurrencySelector value={line.currency} baseCurrency={baseCurrency} exchangeRate={exchangeRate} label="Moneda" onChange={(nextCurrency) => setPaymentLines((current) => current.map((item, i) => { if (i !== index) return item; const previousRate = item.currency === baseCurrency ? 1 : Number(item.exchangeRate || exchangeRate); const nextRate = paymentLineRate(nextCurrency); return { ...item, amount: formatPaymentInput(convertBetweenCurrencies(parsePaymentAmount(item.amount), item.currency, nextCurrency, previousRate, nextRate).toFixed(2)), currency: nextCurrency, exchangeRate: nextRate }; }))} /><div><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto ({line.currency})</p><Input type="text" inputMode="decimal" min="0" step="0.01" value={line.amount} onChange={(event) => { const raw = event.target.value.replace(/,/g, ''); if (!/^\d*(\.\d{0,2})?$/.test(raw)) return; setPaymentLines((current) => current.map((item, i) => i === index ? { ...item, amount: formatPaymentInput(raw) } : item)); }} onBlur={(event) => setPaymentLines((current) => current.map((item, i) => i === index ? { ...item, amount: parsePaymentAmount(event.target.value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') } : item))} className="h-9 rounded-lg text-xs tabular-nums" /></div><Button variant="ghost" size="icon" className="size-9 text-rose-500" disabled={paymentLines.length === 1} onClick={() => setPaymentLines((current) => current.filter((_, i) => i !== index))} aria-label="Eliminar medio de pago"><Trash2 className="size-4" /></Button></div>{isBankMethod(line.method) && <BankAccountSelect value={line.bankAccountId} onChange={(value) => setPaymentLines((current) => current.map((item, i) => i === index ? { ...item, bankAccountId: value } : item))} label="Cuenta bancaria global" className="mt-3" />}{hasPaymentReferenceField(line.method) && <div className="mt-3"><p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Referencia *</p><Input value={line.reference || ''} onChange={(event) => setPaymentLines((current) => current.map((item, i) => i === index ? { ...item, reference: event.target.value } : item))} placeholder="Transferencia, voucher o cheque..." required={requiresPaymentReference(line.method)} className="h-9 text-xs" /></div>}</div>)}
            <Button variant="outline" className="w-full rounded-xl border-dashed" onClick={() => setPaymentLines((current) => [...current, paymentLine('CASH')])}><Plus className="mr-2 size-4" /> Agregar otro medio</Button>
            <div className={cn('rounded-xl border px-4 py-3', balanced ? 'border-primary/20 bg-primary/5' : 'border-amber-500/20 bg-amber-500/5')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monto aplicado (base)</p><p className="mt-1 text-base font-black tabular-nums">{formatNativeAmount(paymentTotalBase, baseCurrency)}</p></div>
                <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{excessBase > 0.01 ? 'Vuelto por dar' : remainingBase > 0.01 ? 'Pendiente' : 'Saldo cubierto'}</p><p className={cn('mt-1 text-base font-black tabular-nums', balanced ? 'text-primary' : excessBase > 0.01 ? 'text-emerald-600' : 'text-amber-600')}>{formatNativeAmount(excessBase > 0.01 ? excessBase : remainingBase, baseCurrency)}</p></div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">Total contable requerido: <span className="font-bold text-foreground">{formatNativeAmount(requestTotalBase, baseCurrency)}</span></p>
            </div>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-xl" onClick={() => setPaymentRequest(null)} disabled={busyId === paymentRequest?.id}>Cancelar</Button><Button className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" disabled={!balanced || busyId === paymentRequest?.id || paymentLines.some((line) => requiresPaymentReference(line.method) && !line.reference?.trim()) || paymentLines.some((line) => isBankMethod(line.method) && !line.bankAccountId)} onClick={submitPayment}>{busyId === paymentRequest?.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Banknote className="mr-2 size-4" />} Confirmar y contabilizar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
