import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileCheck2, FileText, PackageSearch, ReceiptText, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table';
import { getApiErrorMessage } from '../../services/api';
import { suppliersService, purchaseOrdersService } from '../../services/compras.service';
import {
  logisticsService,
  type PaginatedSimple,
  type ReceivedPackage,
  type ReconciliationPreviewResult,
  type ReconciliationConfirmResult,
} from '../../services/logistics.service';

interface SupplierOption { id: string; name: string; code: string; }
interface OrderOption { id: string; number: string; status: string; }

const formatDate = (value?: string | Date) => (value ? format(new Date(value), 'dd/MM/yyyy', { locale: es }) : '');

export function Reconciliation() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [data, setData] = useState<PaginatedSimple<ReceivedPackage> | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<ReconciliationPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ReconciliationConfirmResult | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await logisticsService.reconciliationAvailable({ page, pageSize, search: search || undefined }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los paquetes por conciliar'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const [sup, ord] = await Promise.all([
          suppliersService.getAll({ page: 1, pageSize: 200 } as any),
          purchaseOrdersService.getAll({ page: 1, pageSize: 200, status: 'APPROVED' } as any),
        ]);
        setSuppliers((sup?.items || []).map((s) => ({ id: s.id, name: s.name, code: s.code })));
        setOrders((ord?.items || []).map((o) => ({ id: o.id, number: o.number, status: o.status })));
      } catch {
        /* catálogos opcionales */
      }
    })();
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectedPackages = useMemo(() => data?.items.filter((p) => selected.has(p.id)) ?? [], [data, selected]);

  const runPreview = useCallback(async () => {
    if (selected.size === 0) { toast.error('Selecciona al menos un paquete'); return; }
    if (!supplierId || !orderId) { toast.error('Selecciona proveedor y orden de compra'); return; }
    setBusy(true);
    try {
      setPreview(await logisticsService.reconciliationPreview({
        supplierId,
        purchaseOrderId: orderId,
        number: invoiceNumber || undefined,
        date,
        dueDate: dueDate || undefined,
        packageIds: [...selected],
        notes: notes || undefined,
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo preparar la conciliación'));
    } finally {
      setBusy(false);
    }
  }, [selected, supplierId, orderId, invoiceNumber, date, dueDate, notes]);

  const confirm = useCallback(async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const res = await logisticsService.reconciliationConfirm({
        supplierId,
        purchaseOrderId: orderId,
        number: invoiceNumber || undefined,
        date,
        dueDate: dueDate || undefined,
        packageIds: preview.packages.map((p) => p.id),
        costPrices: Object.fromEntries(preview.packages.map((p) => [p.id, p.costPrice])),
        notes: notes || undefined,
      });
      setResult(res);
      toast.success(`Conciliación confirmada: ${res.linkedPackages} paquete(s), factura ${res.invoice.number}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo confirmar la conciliación'));
    } finally {
      setConfirming(false);
    }
  }, [preview, supplierId, orderId, invoiceNumber, date, dueDate, notes]);

  const reset = useCallback(() => {
    setResult(null);
    setPreview(null);
    setSelected(new Set());
    setInvoiceNumber('');
    setDate(formatDate(new Date()));
    setDueDate('');
    setNotes('');
    void load();
  }, [load]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileCheck2 className="size-5" /></div>
        <div>
          <h1 className="text-lg font-black tracking-tight">Conciliación de compras</h1>
          <p className="text-xs text-muted-foreground">Asocia paquetes recibidos a una OC y factura de proveedor (módulo Compras).</p>
        </div>
      </div>

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por tracking, cliente, SKU, bodega…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="rounded-xl pl-9" />
          </div>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
            {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <Badge variant="outline" className="rounded-lg text-[11px]">{data?.total ?? 0} disponibles</Badge>
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
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Recibido</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-xs text-muted-foreground">Cargando…</TableCell></TableRow>
            ) : (data?.items.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center">
                <PackageSearch className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-bold">Sin paquetes por conciliar</p>
                <p className="text-xs text-muted-foreground">Los paquetes recibidos sin compra aparecen aquí.</p>
              </TableCell></TableRow>
            ) : data!.items.map((p) => (
              <TableRow key={p.id} className={selected.has(p.id) ? 'bg-primary/5' : ''}>
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${p.trackingCode}`}
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="size-4 accent-primary"
                  />
                </TableCell>
                <TableCell className="font-mono text-xs font-bold text-primary">{p.trackingCode}</TableCell>
                <TableCell className="text-xs font-semibold">{p.customerName || p.subagencyName || '—'}</TableCell>
                <TableCell className="text-xs">{p.sku}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.warehouseValue || p.warehouseName || '—'}</TableCell>
                <TableCell className="text-right text-xs font-black">{p.billableWeight} {p.weightUnit}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(p.receivedAt)}</TableCell>
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
          <ReceiptText className="size-4 text-primary" /> Nueva conciliación · {selectedPackages.length} paquete(s) seleccionado(s)
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor *</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
              <option value="">Selecciona proveedor…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Orden de compra aprobada *</label>
            <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
              <option value="">Selecciona OC aprobada…</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Factura / referencia del proveedor</label>
            <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Ej. F-001 (opcional)" className="rounded-xl text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vence</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl text-xs" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" className="rounded-xl text-xs" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button className="rounded-xl text-xs" onClick={runPreview} disabled={busy || selected.size === 0 || !supplierId || !orderId}>
            <FileText className="size-4" /> {busy ? 'Preparando…' : 'Preparar conciliación'}
          </Button>
          <Button variant="outline" className="rounded-xl text-xs" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>Limpiar selección</Button>
        </div>
      </Card>

      {preview && (
        <Card className="rounded-2xl border-primary/30 bg-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary"><CheckCircle2 className="size-4" /> Resumen</h3>
            <Badge variant="outline" className="rounded-lg text-[11px]">{preview.packageCount} paquetes · {preview.invoiceNumber}</Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Peso proveedor</p><p className="font-black">{preview.weights.supplierWeight.toFixed(2)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Peso físico</p><p className="font-black">{preview.weights.physicalWeight.toFixed(2)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Peso cobrable</p><p className="font-black">{preview.weights.billableWeight.toFixed(2)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Costo total</p><p className="font-black text-primary">${preview.totalAmount.toFixed(2)}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Factura</p><p className="font-black">{preview.invoiceNumber}</p></div>
          </div>
          <Button className="mt-3 rounded-xl text-xs" onClick={confirm} disabled={confirming}>
            {confirming ? 'Confirmando…' : `Confirmar conciliación (${preview.packageCount})`}
          </Button>
        </Card>
      )}

      {result && (
        <Card className="rounded-2xl border-emerald-300 bg-emerald-50 p-4 shadow-sm dark:bg-emerald-950/20">
          <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="size-4" /> Conciliación registrada</h3>
          <p className="mt-2 text-sm">
            Factura de proveedor <b>{result.invoice.number}</b> (${Number(result.invoice.total || 0).toFixed(2)}) con <b>{result.linkedPackages}</b> paquete(s). Los paquetes ya no aparecen en el listado de conciliación.
          </p>
          <Button variant="outline" className="mt-3 rounded-xl text-xs" onClick={reset}>Nueva conciliación</Button>
        </Card>
      )}
    </div>
  );
}