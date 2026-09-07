import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeDollarSign, CheckCircle2, FileText, PackageCheck, PackageSearch, RotateCcw, Search, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '../ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { getApiErrorMessage } from '../../services/api';
import {
  logisticsService,
  type BillingAvailableResult,
  type BillingAlertsResult,
  type BillingPreviewResult,
  type BillingConfirmResult,
  type BillingReversalPreview,
  type BillingCancelResult,
  type ReceivedPackage,
} from '../../services/logistics.service';

const formatDate = (value?: string | Date) => (value ? format(new Date(value), 'dd/MM/yyyy', { locale: es }) : '');
const today = () => format(new Date(), 'yyyy-MM-dd');

type SubView = 'available' | 'delivery' | 'traceability';

export function Billing() {
  const [sub, setSub] = useState<SubView>('available');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<BillingAvailableResult | null>(null);
  const [alerts, setAlerts] = useState<BillingAlertsResult | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rates, setRates] = useState<Record<string, number>>({});
  const [defaultRate, setDefaultRate] = useState('0');
  const [customerName, setCustomerName] = useState('');
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState('');
  const [preview, setPreview] = useState<BillingPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<BillingConfirmResult | null>(null);

  const [deliverable, setDeliverable] = useState<ReceivedPackage[]>([]);
  const [deliverSel, setDeliverSel] = useState<Set<string>>(new Set());
  const [deliverNote, setDeliverNote] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [trace, setTrace] = useState<{ available: ReceivedPackage[]; billed: ReceivedPackage[]; delivered: ReceivedPackage[] } | null>(null);
  const [traceName, setTraceName] = useState('');

  // Reversión / nota de crédito (Bloque 6)
  const [reversalOpen, setReversalOpen] = useState(false);
  const [reversalPreview, setReversalPreview] = useState<BillingReversalPreview | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalBusy, setReversalBusy] = useState(false);
  const [reversalResult, setReversalResult] = useState<BillingCancelResult | null>(null);
  const [replacementCtx, setReplacementCtx] = useState<{ invoiceId: string; customerName: string; packageIds: string[]; rates: Record<string, number> } | null>(null);
  const [creditNoteBusy, setCreditNoteBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [avail, al] = await Promise.all([
        logisticsService.billingAvailable({ page, pageSize, search: search || undefined }),
        logisticsService.billingAlerts(),
      ]);
      setData(avail);
      setAlerts(al);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los paquetes disponibles'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (sub !== 'delivery') return;
    (async () => {
      try {
        const res = await logisticsService.listReceivedPackages({ page: 1, pageSize: 200 });
        setDeliverable(res.items.filter((p) => p.saleStatus === 'BILLED'));
      } catch {
        setDeliverable([]);
      }
    })();
  }, [sub]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleDeliver = useCallback((id: string) => {
    setDeliverSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedPackages = useMemo(() => data?.items.filter((p) => selected.has(p.id)) ?? [], [data, selected]);
  const selectedWeight = useMemo(() => selectedPackages.reduce((s, p) => s + p.billableWeight, 0), [selectedPackages]);
  const selectedAmount = useMemo(
    () => selectedPackages.reduce((s, p) => s + Number(rates[p.id] ?? (defaultRate || 0)) * p.billableWeight, 0),
    [selectedPackages, rates, defaultRate],
  );

  const applyDefaultRate = useCallback(() => {
    const r = Number(defaultRate) || 0;
    setRates((prev) => {
      const next = { ...prev };
      for (const p of selectedPackages) next[p.id] = r;
      return next;
    });
  }, [defaultRate, selectedPackages]);

  const runPreview = useCallback(async () => {
    if (selected.size === 0) { toast.error('Selecciona al menos un paquete'); return; }
    setBusy(true);
    try {
      setPreview(await logisticsService.billingPreview({
        customerName: customerName || undefined,
        date,
        dueDate: dueDate || undefined,
        packageIds: [...selected],
        rates,
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar la factura'));
    } finally {
      setBusy(false);
    }
  }, [selected, customerName, date, dueDate, rates]);

  const confirm = useCallback(async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const res = await logisticsService.billingConfirm({
        customerName: preview.customer.name,
        date,
        dueDate: dueDate || undefined,
        packageIds: preview.lines.map((l) => l.packageId),
        rates,
        replacesInvoiceId: replacementCtx?.invoiceId,
      });
      setResult(res);
      setReplacementCtx(null);
      toast.success(`Factura ${res.invoice.number} emitida por ${res.billedPackages} paquete(s)`);
      void load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo confirmar la factura'));
    } finally {
      setConfirming(false);
    }
  }, [preview, date, dueDate, rates, replacementCtx, load]);

  const reset = useCallback(() => {
    setResult(null);
    setPreview(null);
    setSelected(new Set());
    setRates({});
    setCustomerName('');
    setDate(today());
    setDueDate('');
  }, []);

  const deliver = useCallback(async () => {
    if (deliverSel.size === 0) { toast.error('Selecciona al menos un paquete facturado'); return; }
    setDelivering(true);
    try {
      const res = await logisticsService.deliverPackages({ packageIds: [...deliverSel], note: deliverNote || undefined });
      toast.success(`${res.delivered} paquete(s) entregado(s)`);
      setDeliverSel(new Set());
      setDeliverNote('');
      setDeliverable((prev) => prev.filter((p) => !deliverSel.has(p.id)));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo registrar la entrega'));
    } finally {
      setDelivering(false);
    }
  }, [deliverSel, deliverNote]);

  const runTrace = useCallback(async (name?: string) => {
    const target = (name ?? traceName).trim();
    if (!target) { toast.error('Ingresa el nombre del cliente'); return; }
    try {
      const res = await logisticsService.billingByCustomer(target);
      setTrace(res);
      setTraceName(target);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo consultar el cliente'));
    }
  }, [traceName]);

  const openReversal = useCallback(async (invoiceId: string) => {
    setReversalOpen(true);
    setReversalPreview(null);
    setReversalResult(null);
    setReversalReason('');
    try {
      setReversalPreview(await logisticsService.billingReversalPreview(invoiceId));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar la reversión'));
      setReversalOpen(false);
    }
  }, []);

  const confirmCancel = useCallback(async () => {
    if (!reversalPreview) return;
    if (reversalReason.trim().length < 3) { toast.error('Indica una razón de al menos 3 caracteres'); return; }
    setReversalBusy(true);
    try {
      const res = await logisticsService.billingCancel({ invoiceId: reversalPreview.invoice.id, reason: reversalReason.trim() });
      setReversalResult(res);
      toast.success(`Venta ${res.reversal.invoiceNumber} anulada; ${res.restoredPackages} paquete(s) disponibles`);
      void load();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo anular la venta'));
    } finally {
      setReversalBusy(false);
    }
  }, [reversalPreview, reversalReason, load]);

  const rebillAfterReversal = useCallback(async () => {
    if (!reversalResult) return;
    try {
      const replacement = await logisticsService.billingReplacement(reversalResult.reversal.invoiceId);
      const pkgIds = replacement.packages.map((p) => p.id);
      const preRates = Object.fromEntries(replacement.packages.map((p) => [p.id, p.rate]));
      setReplacementCtx({ invoiceId: replacement.originalInvoice.id, customerName: replacement.customer?.name || '', packageIds: pkgIds, rates: preRates });
      setSelected(new Set(pkgIds));
      setRates(preRates);
      setCustomerName(replacement.customer?.name || '');
      setDate(replacement.date ? format(new Date(replacement.date), 'yyyy-MM-dd') : today());
      setDueDate(replacement.dueDate ? format(new Date(replacement.dueDate), 'yyyy-MM-dd') : '');
      setReversalOpen(false);
      setSub('available');
      toast.success('Paquetes precargados: corrige únicamente la tarifa y emite la factura');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar la refacturación'));
    }
  }, [reversalResult]);

  const runCreditNote = useCallback(async () => {
    if (!reversalPreview) return;
    setCreditNoteBusy(true);
    try {
      const res = await logisticsService.billingCreditNote({ invoiceId: reversalPreview.invoice.id, reason: reversalReason.trim() || undefined });
      toast.success(`Nota de crédito ${res.creditNote.number} emitida (${res.packages.length} paquete(s))`);
      setReversalOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'La nota de crédito requiere el flujo del módulo de Ventas'));
    } finally {
      setCreditNoteBusy(false);
    }
  }, [reversalPreview, reversalReason]);

  const summary = data?.summary;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BadgeDollarSign className="size-5" /></div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Disponibles para facturar y venta</h1>
            <p className="text-xs text-muted-foreground">Factura al cliente con el módulo de Ventas y registra la entrega.</p>
          </div>
        </div>
        <div className="flex overflow-hidden rounded-xl border border-border/60">
          {([
            { id: 'available', label: 'Por facturar' },
            { id: 'delivery', label: 'Entrega' },
            { id: 'traceability', label: 'Trazabilidad' },
          ] as Array<{ id: SubView; label: string }>).map((t) => (
            <button
              key={t.id}
              onClick={() => setSub(t.id)}
              className={`px-3 py-2 text-xs font-black uppercase tracking-widest ${sub === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {alerts && alerts.alerts.length > 0 && (
        <Card className="rounded-2xl border-amber-300 bg-amber-50 p-4 shadow-sm dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <div className="text-xs">
              <p className="font-black text-amber-700 dark:text-amber-400">
                {alerts.alerts.length} paquete(s) sin facturar hace más de {alerts.notifyUnbilledAfterDays} días
              </p>
              <p className="mt-1 text-amber-700/80 dark:text-amber-400/80">
                {alerts.alerts.slice(0, 4).map((a) => `${a.trackingCode} (${a.customerName || 'sin cliente'}, ${a.daysPending}d)`).join(' · ')}
                {alerts.alerts.length > 4 ? ' · …' : ''}
              </p>
            </div>
          </div>
        </Card>
      )}

      {sub === 'available' && (
        <>
          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-sm">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative min-w-56 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por cliente, tracking, bodega…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="rounded-xl pl-9" />
              </div>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
                {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} por página</option>)}
              </select>
              <Badge variant="outline" className="rounded-lg text-[11px]">
                {summary ? `${summary.packages} paquetes · ${summary.billableWeight.toFixed(2)} lb` : ''}
              </Badge>
            </div>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Tracking</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">SKU</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
                  <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Peso cobrable</TableHead>
                  <TableHead className="text-[10px] font-black uppercase tracking-widest">Tarifa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando…</TableCell></TableRow>
                ) : (data?.items.length ?? 0) === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center">
                    <PackageSearch className="mx-auto size-8 text-muted-foreground/40" />
                    <p className="mt-2 text-sm font-bold">Sin paquetes por facturar</p>
                    <p className="text-xs text-muted-foreground">Los paquetes que pasaron compra y no fueron facturados aparecen aquí.</p>
                  </TableCell></TableRow>
                ) : data!.items.map((p) => (
                  <TableRow key={p.id} className={selected.has(p.id) ? 'bg-primary/5' : ''}>
                    <TableCell>
                      <input type="checkbox" aria-label={`Seleccionar ${p.trackingCode}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-primary" />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-primary">{p.trackingCode}</TableCell>
                    <TableCell className="text-xs font-semibold">{p.customerName || p.subagencyName || '—'}</TableCell>
                    <TableCell className="text-xs">{p.sku}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.warehouseValue || p.warehouseName || '—'}</TableCell>
                    <TableCell className="text-right text-xs font-black">{p.billableWeight} {p.weightUnit}</TableCell>
                    <TableCell>
                      <Input
                        type="number" min={0} step="0.01"
                        value={rates[p.id] ?? (p.salePrice ?? 0)}
                        onChange={(e) => setRates((prev) => ({ ...prev, [p.id]: Number(e.target.value) }))}
                        className="h-8 w-24 rounded-lg text-right text-xs"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {data && data.total > pageSize && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" disabled={data.page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
                <Button variant="outline" size="sm" className="rounded-lg" disabled={data.page * data.pageSize >= data.total} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
              </div>
            </div>
          )}

          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
              <FileText className="size-4 text-primary" /> Nueva factura · {selectedPackages.length} paquete(s) · {selectedWeight.toFixed(2)} lb · ${selectedAmount.toFixed(2)}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ej. Andrea Rosales" className="rounded-xl text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vence</label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tarifa por libra</label>
                <div className="flex gap-1">
                  <Input type="number" min={0} step="0.01" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} className="rounded-xl text-xs" />
                  <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={applyDefaultRate} disabled={selectedPackages.length === 0}>Aplicar</Button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button className="rounded-xl text-xs" onClick={runPreview} disabled={busy || selected.size === 0}>
                <FileText className="size-4" /> {busy ? 'Preparando…' : 'Preparar factura'}
              </Button>
              <Button variant="outline" className="rounded-xl text-xs" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Limpiar selección</Button>
            </div>
          </Card>

          {preview && (
            <Card className="rounded-2xl border-primary/30 bg-primary/5 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary"><CheckCircle2 className="size-4" /> Resumen de factura</h3>
                <Badge variant="outline" className="rounded-lg text-[11px]">Cliente: {preview.customer.name}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-xs">
                {preview.lines.map((l) => (
                  <div key={l.packageId} className="flex items-center justify-between gap-2 rounded-lg bg-background/60 px-2 py-1">
                    <span className="font-mono font-bold text-primary">{l.trackingCode}</span>
                    <span className="text-muted-foreground">{l.billableWeight} lb × ${l.rate.toFixed(2)}</span>
                    <span className="font-black">${l.amount.toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-border/50 pt-2 font-black">
                  <span>Total</span>
                  <span className="text-primary">${preview.totalAmount.toFixed(2)}</span>
                </div>
              </div>
              <Button className="mt-3 rounded-xl text-xs" onClick={confirm} disabled={confirming}>
                {confirming ? 'Confirmando…' : `Emitir factura (${preview.packageCount})`}
              </Button>
            </Card>
          )}

          {result && (
            <Card className="rounded-2xl border-emerald-300 bg-emerald-50 p-4 shadow-sm dark:bg-emerald-950/20">
              <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="size-4" /> Factura emitida</h3>
              <p className="mt-2 text-sm">
                Factura <b>{result.invoice.number}</b> por <b>${Number(result.invoice.total || 0).toFixed(2)}</b> con <b>{result.billedPackages}</b> paquete(s). Usa la pestaña <b>Entrega</b> para registrar la salida.
              </p>
              <Button variant="outline" className="mt-3 rounded-xl text-xs" onClick={reset}>Nueva factura</Button>
            </Card>
          )}
        </>
      )}

      {sub === 'delivery' && (
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <Truck className="size-4 text-primary" /> Paquetes facturados por entregar · {deliverable.length}
          </h3>
          {deliverable.length === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No hay paquetes facturados pendientes de entrega.</p>
          ) : (
            <>
              <div className="mt-3 max-h-96 overflow-y-auto rounded-xl border border-border/50">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Tracking</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                      <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Importe</TableHead>
                      <TableHead className="text-[10px] font-black uppercase tracking-widest">Factura</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliverable.map((p) => (
                      <TableRow key={p.id} className={deliverSel.has(p.id) ? 'bg-primary/5' : ''}>
                        <TableCell>
                          <input type="checkbox" aria-label={`Entregar ${p.trackingCode}`} checked={deliverSel.has(p.id)} onChange={() => toggleDeliver(p.id)} className="size-4 accent-primary" />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-bold text-primary">{p.trackingCode}</TableCell>
                        <TableCell className="text-xs font-semibold">{p.customerName || '—'}</TableCell>
                        <TableCell className="text-right text-xs font-black">${(p.saleAmount ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.saleInvoiceNumber || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Input value={deliverNote} onChange={(e) => setDeliverNote(e.target.value)} placeholder="Observación de entrega (opcional)" className="max-w-sm rounded-xl text-xs" />
                <Button className="rounded-xl text-xs" onClick={deliver} disabled={delivering || deliverSel.size === 0}>
                  <PackageCheck className="size-4" /> {delivering ? 'Entregando…' : `Entregar (${deliverSel.size})`}
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {sub === 'traceability' && (
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <PackageSearch className="size-4 text-primary" /> Trazabilidad por cliente
          </h3>
          <div className="mt-3 flex max-w-md gap-2">
            <Input value={traceName} onChange={(e) => setTraceName(e.target.value)} placeholder="Nombre del cliente, ej. Andrea Rosales" className="rounded-xl text-xs" onKeyDown={(e) => { if (e.key === 'Enter') runTrace(); }} />
            <Button className="rounded-xl text-xs" onClick={() => runTrace()}><Search className="size-4" /> Consultar</Button>
          </div>
          {trace && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {([
                { key: 'available', label: 'Disponibles', tone: 'text-sky-500' },
                { key: 'billed', label: 'Facturados', tone: 'text-violet-500' },
                { key: 'delivered', label: 'Entregados', tone: 'text-emerald-500' },
              ] as const).map((g) => (
                <div key={g.key} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${g.tone}`}>{g.label} · {trace[g.key].length}</p>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {trace[g.key].length === 0 && <p className="text-xs text-muted-foreground">Sin registros.</p>}
                    {trace[g.key].map((p) => (
                      <div key={p.id} className="rounded-lg bg-background/70 px-2 py-1 text-[11px]">
                        <span className="font-mono font-bold text-primary">{p.trackingCode}</span>
                        <span className="text-muted-foreground"> · {p.saleInvoiceNumber || '—'}</span>
                        <div className="text-[10px] text-muted-foreground">
                          {p.billableWeight} lb{p.saleAmount != null ? ` · $${p.saleAmount.toFixed(2)}` : ''}{p.deliveredAt ? ` · ${formatDate(p.deliveredAt)}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {trace && trace.billed.length > 0 && (
            <div className="mt-4 rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Facturas facturadas — reversión / nota de crédito
              </p>
              <div className="mt-2 space-y-1.5">
                {[...new Set(trace.billed.map((p) => p.saleInvoiceId).filter(Boolean))].map((invoiceId) => {
                  const pkgs = trace.billed.filter((p) => p.saleInvoiceId === invoiceId);
                  return (
                    <div key={invoiceId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background/70 px-2 py-1.5 text-[11px]">
                      <span className="font-black text-primary">{pkgs[0]?.saleInvoiceNumber || invoiceId}</span>
                      <span className="text-muted-foreground">{pkgs.length} paquete(s) · ${pkgs.reduce((s, p) => s + (p.saleAmount ?? 0), 0).toFixed(2)}</span>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" className="h-7 rounded-lg text-[10px]" onClick={() => openReversal(invoiceId)}>
                          <RotateCcw className="size-3" /> Anular / Reversar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 rounded-lg text-[10px]" onClick={() => openReversal(invoiceId)}>
                          <FileText className="size-3" /> Nota de crédito
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {reversalOpen && (
        <Sheet open={reversalOpen} onOpenChange={setReversalOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><RotateCcw className="size-5 text-primary" /> Reversión de venta</SheetTitle>
              <SheetDescription>Reutiliza el proceso existente del ERP (anulación + reversión contable). El historial es inmutable.</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4 py-4">
              {reversalResult ? (
                <Card className="rounded-2xl border-emerald-300 bg-emerald-50 p-4 shadow-sm dark:bg-emerald-950/20">
                  <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="size-4" /> Venta anulada</h3>
                  <p className="mt-2 text-sm">
                    Factura <b>{reversalResult.reversal.invoiceNumber}</b> anulada por <b>{reversalResult.reversal.reversedBy || 'usuario'}</b>.
                    {reversalResult.restoredPackages} paquete(s) vuelven a <b>Disponibles para facturar</b>. El historial de la factura original se conserva.
                  </p>
                  <Button className="mt-3 rounded-xl text-xs" onClick={rebillAfterReversal}>
                    <PackageCheck className="size-4" /> Corregir y volver a facturar
                  </Button>
                </Card>
              ) : reversalPreview ? (
                <>
                  {reversalPreview.requiresAuthorizedFlow && (
                    <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0" /> Hay paquetes entregados: la reversión simple no está permitida; se requiere un flujo administrativo autorizado.
                    </p>
                  )}
                  <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black">{reversalPreview.invoice.number}</p>
                      <Badge variant="outline" className="rounded-lg text-[10px]">{reversalPreview.invoice.status}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div><p className="text-[10px] font-black uppercase text-muted-foreground">Total</p><p className="font-black">${reversalPreview.invoice.total.toFixed(2)}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-muted-foreground">Pagado</p><p className="font-black">${reversalPreview.invoice.amountPaid.toFixed(2)}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-muted-foreground">Saldo CxC</p><p className="font-black">${reversalPreview.invoice.balance.toFixed(2)}</p></div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {reversalPreview.packages.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-background/60 px-2 py-1 text-[11px]">
                          <span className="font-mono font-bold text-primary">{p.trackingCode}</span>
                          <span className="text-muted-foreground">{p.billableWeight} lb · ${(p.saleAmount ?? 0).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Razón de la anulación *</label>
                    <textarea
                      value={reversalReason}
                      onChange={(e) => setReversalReason(e.target.value)}
                      rows={3}
                      placeholder="Ej. Tarifa incorrecta en la factura"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">Cargando…</p>
              )}
            </div>
            {!reversalResult && reversalPreview && (
              <SheetFooter className="flex-row justify-end gap-2 border-t border-border/50 px-5 py-3">
                <Button type="button" variant="outline" className="rounded-xl text-xs" onClick={runCreditNote} disabled={creditNoteBusy || !reversalPreview.invoice}>
                  <FileText className="size-4" /> {creditNoteBusy ? 'Generando…' : 'Nota de crédito'}
                </Button>
                <Button type="button" className="rounded-xl text-xs" onClick={confirmCancel} disabled={reversalBusy || !reversalPreview.reversable}>
                  {reversalBusy ? 'Anulando…' : 'Anular y reversar'}
                </Button>
              </SheetFooter>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}