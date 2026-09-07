import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, FileUp, PackageSearch, Plus, ReceiptText, Search, Trash2, X } from 'lucide-react';
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
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '../ui/sheet';
import { getApiErrorMessage } from '../../services/api';
import { suppliersService } from '../../services/compras.service';
import {
  logisticsService,
  type BatchDetail,
  type BatchPackageRow,
  type ConfirmBatchResult,
  type LogisticsSubagency,
  type LogisticsWarehouse,
  type PaginatedSimple,
  type ReceptionBatch,
} from '../../services/logistics.service';

interface GridRow extends BatchPackageRow {
  id: string;
  subagencyId?: string;
  subagencyName?: string;
  customerName?: string;
}

interface SupplierOption { id: string; name: string; code: string; }

const formatDate = (value?: string | Date) => (value ? format(new Date(value), 'dd/MM/yyyy', { locale: es }) : '—');
const toInputDate = (value?: string | Date) => (value ? format(new Date(value), 'yyyy-MM-dd') : '');

const emptyRow = (index: number): GridRow => ({
  id: `${Date.now()}-${index}`,
  line: index + 1,
  item: '',
  quantity: 1,
  unitPrice: undefined,
  physicalWeight: undefined,
  warehouseValue: '',
  trackingCode: '',
});

export function BatchReception() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [data, setData] = useState<PaginatedSimple<ReceptionBatch> | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ provider: '', warehouseId: '', date: toInputDate(new Date()), notes: '' });

  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [rows, setRows] = useState<GridRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmForm, setConfirmForm] = useState({ invoiceNumber: '', date: toInputDate(new Date()), dueDate: '', notes: '' });
  const [confirmResult, setConfirmResult] = useState<ConfirmBatchResult | null>(null);

  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [subagencies, setSubagencies] = useState<LogisticsSubagency[]>([]);
  const [warehouses, setWarehouses] = useState<LogisticsWarehouse[]>([]);
  const autoOpenedCreate = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [sup, sub, wh] = await Promise.all([
          suppliersService.getAll({ page: 1, pageSize: 200 } as any),
          logisticsService.listSubagencies(),
          logisticsService.listWarehouses(),
        ]);
        const supplierList: any[] = sup?.data || (sup as any)?.items || [];
        setSuppliers(supplierList.map((s) => ({ id: s.id, name: s.name, code: s.code })));
        setSubagencies(sub.filter((s) => s.isActive));
        setWarehouses(wh.filter((w) => w.isActive));
      } catch {
        /* catálogos opcionales */
      }
    })();
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setData(await logisticsService.listBatches({
        page, pageSize, search: search || undefined, status: statusFilter || undefined,
      }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar las referencias'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (data && data.total === 0 && !autoOpenedCreate.current) {
      autoOpenedCreate.current = true;
      setCreateOpen(true);
    }
  }, [data]);

  const openDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setConfirmResult(null);
    try {
      setDetail(await logisticsService.getBatch(id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo abrir la referencia'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshDetail = useCallback(async () => {
    if (!detail) return;
    try {
      setDetail(await logisticsService.getBatch(detail.batch.id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo refrescar la referencia'));
    }
  }, [detail]);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setRows([]);
    setConfirmResult(null);
    void load();
  }, [load]);

  const createBatch = useCallback(async () => {
    setCreating(true);
    try {
      const batch = await logisticsService.createBatch({
        provider: createForm.provider || undefined,
        warehouseId: createForm.warehouseId || undefined,
        date: createForm.date || undefined,
        notes: createForm.notes || undefined,
      });
      toast.success(`Referencia ${batch.number} creada`);
      setCreateOpen(false);
      setCreateForm({ provider: '', warehouseId: '', date: toInputDate(new Date()), notes: '' });
      setPage(1);
      await openDetail(batch.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear la referencia'));
    } finally {
      setCreating(false);
    }
  }, [createForm, openDetail]);

  const onPickPdf = useCallback(async (file?: File | null) => {
    if (!file || !detail) return;
    setImporting(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
        reader.readAsDataURL(file);
      });
      const result = await logisticsService.pdfPreview(file.name, base64);
      const incoming = result.rows.map((r, i) => ({ ...r, id: `${Date.now()}-${i}` }));
      setRows((prev) => {
        const base = prev.length > 0 ? prev : [];
        return [...base, ...incoming];
      });
      toast.success(
        result.format
          ? `PDF ${result.format} procesado: ${result.rows.length} fila(s)`
          : `PDF procesado: ${result.rows.length} fila(s) (formato no reconocido)`,
      );
      result.warnings.forEach((w) => toast.info(w));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo importar el PDF'));
    } finally {
      setImporting(false);
    }
  }, [detail]);

  const updateRow = useCallback((id: string, patch: Partial<GridRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const saveRows = useCallback(async () => {
    if (!detail || rows.length === 0) return;
    const payload: BatchPackageRow[] = rows.map((r) => ({
      line: r.line,
      trackingCode: r.trackingCode?.trim() || undefined,
      item: r.item?.trim() || undefined,
      quantity: Number(r.quantity) || 1,
      unitPrice: r.unitPrice !== undefined && r.unitPrice !== null && !Number.isNaN(r.unitPrice) ? Number(r.unitPrice) : undefined,
      subtotal: undefined,
      physicalWeight: r.physicalWeight !== undefined && r.physicalWeight !== null && !Number.isNaN(r.physicalWeight) ? Number(r.physicalWeight) : undefined,
      warehouseValue: r.warehouseValue?.trim() || undefined,
      subagency: r.subagencyName ? { id: r.subagencyId, name: r.subagencyName } : undefined,
      customer: r.customerName ? { name: r.customerName } : undefined,
    }));
    setSaving(true);
    try {
      const result = await logisticsService.addBatchPackages(detail.batch.id, payload);
      const skipped = result.rows.filter((r) => r.result === 'SKIPPED').length;
      toast.success(`${result.inserted} paquete(s) guardados en ${result.batch}${skipped > 0 ? ` · ${skipped} omitido(s) por tracking duplicado` : ''}`);
      setRows([]);
      await refreshDetail();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron guardar los paquetes'));
    } finally {
      setSaving(false);
    }
  }, [detail, rows, refreshDetail]);

  const confirmBatch = useCallback(async () => {
    if (!detail) return;
    setConfirming(true);
    try {
      const result = await logisticsService.confirmBatch(detail.batch.id, {
        invoiceNumber: confirmForm.invoiceNumber || undefined,
        date: confirmForm.date || undefined,
        dueDate: confirmForm.dueDate || undefined,
        notes: confirmForm.notes || undefined,
      });
      setConfirmResult(result);
      setConfirmOpen(false);
      await refreshDetail();
      toast.success(
        result.invoiceSkipped
          ? `Referencia confirmada sin factura (la referencia no tiene proveedor): ${result.linkedPackages} paquete(s)`
          : `Referencia confirmada: factura ${result.invoice?.number} con ${result.linkedPackages} paquete(s)`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo confirmar la referencia'));
    } finally {
      setConfirming(false);
    }
  }, [detail, confirmForm, refreshDetail]);

  const totals = useMemo(() => {
    const weight = rows.reduce((s, r) => s + (Number(r.physicalWeight) || 0), 0);
    const amount = rows.reduce((s, r) => s + (Number(r.unitPrice) || 0), 0);
    return { weight, amount };
  }, [rows]);

  if (detail) {
    const batch = detail.batch;
    const open = batch.status === 'OPEN';
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={closeDetail}><ArrowLeft className="size-4" /> Referencias</Button>
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ReceiptText className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-black tracking-tight">{batch.number}</h1>
              <Badge variant="outline" className={`rounded-lg text-[10px] ring-1 ${open ? 'ring-amber-300 text-amber-600' : 'ring-emerald-300 text-emerald-600'}`}>
                {open ? 'Abierta' : 'Confirmada'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {batch.provider || 'Sin proveedor'} · {batch.warehouseName || 'Sin bodega'} · {formatDate(batch.date)}
            </p>
          </div>
          {open && (
            <Button className="rounded-xl text-xs" onClick={() => setConfirmOpen(true)} disabled={detail.packages.length === 0} data-tour="log-batch-confirm">
              <CheckCircle2 className="size-4" /> Confirmar referencia
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Paquetes</p>
            <p className="mt-1 text-2xl font-black">{detail.packages.length}</p>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total compra</p>
            <p className="mt-1 text-2xl font-black text-primary">${Number(batch.totalAmount || 0).toFixed(2)}</p>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Factura de compra</p>
            <p className="mt-1 text-2xl font-black">{batch.invoiceNumber || (open ? 'Pendiente' : 'Sin proveedor')}</p>
          </Card>
          <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Creada por</p>
            <p className="mt-1 truncate text-sm font-black">{batch.createdByName || '—'}</p>
          </Card>
        </div>

        {confirmResult && (
          <Card className="rounded-2xl border-emerald-300 bg-emerald-50 p-4 shadow-sm dark:bg-emerald-950/20">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-600"><CheckCircle2 className="size-4" /> Referencia confirmada</h3>
            <p className="mt-2 text-sm">
              {confirmResult.invoiceSkipped
                ? `Se omitió la factura de compra (la referencia no tiene proveedor). ${confirmResult.linkedPackages} paquete(s) marcados como comprados.`
                : `Factura de proveedor <b>${confirmResult.invoice?.number}</b> (${Number(confirmResult.invoice?.total || 0).toFixed(2)}) con <b>${confirmResult.linkedPackages}</b> paquete(s).`}
            </p>
          </Card>
        )}

        {open && (
<Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-sm" data-tour="log-batch-import">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground">
                  <FileUp className="size-4 text-primary" /> Agregar paquetes en lote
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Importa el PDF del ticket (AWBOX u OGLOBAL) o escribe las filas. El tracking puede quedar vacío y completarse después. Se pueden agregar varias tandas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer">
                  <input type="file" accept="application/pdf" className="hidden" onChange={(e) => { void onPickPdf(e.target.files?.[0]); e.target.value = ''; }} />
                  <Button type="button" variant="outline" className="rounded-xl text-xs" disabled={importing}>
                    <FileText className="size-4" /> {importing ? 'Procesando…' : 'Importar PDF'}
                  </Button>
                </label>
                <Button type="button" variant="outline" className="rounded-xl text-xs" onClick={() => setRows((prev) => [...prev, emptyRow(prev.length)])}>
                  <Plus className="size-4" /> Agregar fila
                </Button>
              </div>
            </div>

            {rows.length > 0 && (
              <>
                <div className="mt-4 overflow-x-auto rounded-xl border border-border/60" data-tour="log-batch-grid">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="w-10 text-[10px] font-black uppercase tracking-widest">#</TableHead>
                        <TableHead className="min-w-44 text-[10px] font-black uppercase tracking-widest">Item / descripción</TableHead>
                        <TableHead className="w-20 text-[10px] font-black uppercase tracking-widest">P.Unt</TableHead>
                        <TableHead className="w-24 text-[10px] font-black uppercase tracking-widest">Peso (lb)</TableHead>
                        <TableHead className="w-28 text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
                        <TableHead className="min-w-44 text-[10px] font-black uppercase tracking-widest">Tracking</TableHead>
                        <TableHead className="w-36 text-[10px] font-black uppercase tracking-widest">Subagencia</TableHead>
                        <TableHead className="w-36 text-[10px] font-black uppercase tracking-widest">Cliente</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={r.id} className="align-top">
                          <TableCell className="text-[11px] font-black text-muted-foreground">{i + 1}</TableCell>
                          <TableCell><Input value={r.item || ''} onChange={(e) => updateRow(r.id, { item: e.target.value })} placeholder="Ej. PAQUETERIA AEREA" className="h-8 rounded-lg text-xs" /></TableCell>
                          <TableCell><Input type="number" min={0} step="0.01" value={r.unitPrice ?? ''} onChange={(e) => updateRow(r.id, { unitPrice: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="0.00" className="h-8 rounded-lg text-xs" /></TableCell>
                          <TableCell><Input type="number" min={0} step="0.01" value={r.physicalWeight ?? ''} onChange={(e) => updateRow(r.id, { physicalWeight: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="0.00" className="h-8 rounded-lg text-xs" /></TableCell>
                          <TableCell><Input value={r.warehouseValue || ''} onChange={(e) => updateRow(r.id, { warehouseValue: e.target.value })} placeholder={detail.batch.warehouseName || 'Bodega'} className="h-8 rounded-lg text-xs" /></TableCell>
                          <TableCell><Input value={r.trackingCode || ''} onChange={(e) => updateRow(r.id, { trackingCode: e.target.value })} placeholder="Código (puede ir vacío)" className="h-8 rounded-lg font-mono text-xs" /></TableCell>
                          <TableCell>
                            <select value={r.subagencyId || ''} onChange={(e) => { const sa = subagencies.find((s) => s.id === e.target.value); updateRow(r.id, { subagencyId: sa?.id, subagencyName: sa?.name || undefined }); }} className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs font-semibold">
                              <option value="">—</option>
                              {subagencies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </TableCell>
                          <TableCell><Input value={r.customerName || ''} onChange={(e) => updateRow(r.id, { customerName: e.target.value })} placeholder="Cliente (opcional)" className="h-8 rounded-lg text-xs" /></TableCell>
                          <TableCell><Button variant="ghost" size="sm" className="rounded-lg" onClick={() => removeRow(r.id)}><Trash2 className="size-4 text-destructive" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-muted-foreground">
                    {rows.length} fila(s) · {totals.weight.toFixed(2)} lb · ${totals.amount.toFixed(2)}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl text-xs" onClick={() => setRows([])}>Limpiar</Button>
                    <Button className="rounded-xl text-xs" onClick={saveRows} disabled={saving || rows.length === 0}>
                      {saving ? 'Guardando…' : `Guardar paquetes (${rows.length})`}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        <Card className="flex-1 overflow-auto rounded-2xl border-border/60 shadow-sm" style={{ minHeight: '14rem' }}>
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Paquetes de la referencia ({detail.packages.length})</h3>
            {detailLoading && <span className="text-[11px] text-muted-foreground">Cargando…</span>}
          </div>
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Tracking</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Item</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Costo</TableHead>
                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Peso cobrable</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Propietario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.packages.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center">
                  <PackageSearch className="mx-auto size-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm font-bold">Sin paquetes todavía</p>
                  <p className="text-xs text-muted-foreground">Importa un PDF o agrega filas para cargar paquetes.</p>
                </TableCell></TableRow>
              ) : detail.packages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-bold text-primary">{p.trackingCode || '—'}</TableCell>
                  <TableCell className="text-xs">{p.skuName || '—'}</TableCell>
                  <TableCell className="text-right text-xs font-black">${Number(p.costPrice ?? p.purchasePrice ?? 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-xs font-black">{p.billableWeight} {p.weightUnit}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.warehouseValue || p.warehouseName || '—'}</TableCell>
                  <TableCell className="text-xs">{p.customerName || p.subagencyName || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-primary" /> Confirmar {batch.number}</SheetTitle>
              <SheetDescription>
                {batch.supplierId
                  ? `Se generará la factura de compra en Contabilidad con el proveedor ${batch.provider || 'de la referencia'}.`
                  : 'La referencia no tiene proveedor: se omitirá la factura de compra y solo se vincularán los paquetes como comprados.'}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4 py-4">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-xs">
                <p><b>{detail.packages.length}</b> paquete(s) · total <b>${Number(batch.totalAmount || 0).toFixed(2)}</b></p>
                <p className="mt-1 text-muted-foreground">Proveedor: {batch.provider || 'Sin proveedor (se omite la factura)'}</p>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Factura / referencia del proveedor</label>
                <Input value={confirmForm.invoiceNumber} onChange={(e) => setConfirmForm((f) => ({ ...f, invoiceNumber: e.target.value }))} placeholder="Ej. F-001 (opcional, auto)" className="rounded-xl text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</label>
                  <Input type="date" value={confirmForm.date} onChange={(e) => setConfirmForm((f) => ({ ...f, date: e.target.value }))} className="rounded-xl text-xs" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vence</label>
                  <Input type="date" value={confirmForm.dueDate} onChange={(e) => setConfirmForm((f) => ({ ...f, dueDate: e.target.value }))} className="rounded-xl text-xs" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</label>
                <Input value={confirmForm.notes} onChange={(e) => setConfirmForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opcional" className="rounded-xl text-xs" />
              </div>
            </div>
            <SheetFooter className="flex-row justify-end gap-2 border-t border-border/50 px-5 py-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button type="button" className="rounded-xl" onClick={confirmBatch} disabled={confirming}>
                {confirming ? 'Confirmando…' : `Confirmar (${detail.packages.length})`}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ReceiptText className="size-5" /></div>
          <div>
            <h1 className="text-lg font-black tracking-tight">Recepción en lote</h1>
            <p className="text-xs text-muted-foreground">Referencias de compra al proveedor (AWBOX / OGLOBAL): importa el PDF y registra los paquetes.</p>
          </div>
        </div>
        <Button className="rounded-xl text-xs" onClick={() => setCreateOpen(true)} data-tour="log-batch-new"><Plus className="size-4" /> Nueva referencia</Button>
      </div>

      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por número, proveedor o factura…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="rounded-xl pl-9" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
            <option value="">Todas</option>
            <option value="OPEN">Abiertas</option>
            <option value="CONFIRMED">Confirmadas</option>
          </select>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
            {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <Badge variant="outline" className="rounded-lg text-[11px]">{data?.total ?? 0} referencias</Badge>
        </div>
      </Card>

      <Card className="flex-1 overflow-auto rounded-2xl border-border/60 shadow-sm" style={{ minHeight: '18rem' }} data-tour="log-batch-list">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Referencia</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Proveedor</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Bodega</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Fecha</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Paquetes</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Total</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Factura</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-muted-foreground">Cargando referencias…</TableCell></TableRow>
            ) : (data?.items.length ?? 0) === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-10 text-center">
                <ReceiptText className="mx-auto size-8 text-muted-foreground/40" />
                <p className="mt-2 text-sm font-bold">Sin referencias</p>
                <p className="text-xs text-muted-foreground">Crea una referencia e importa el PDF del proveedor para registrar los paquetes en lote.</p>
              </TableCell></TableRow>
            ) : data!.items.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => void openDetail(b.id)}>
                <TableCell className="py-3 text-xs font-black text-primary">{b.number}</TableCell>
                <TableCell className="py-3 text-xs font-semibold">{b.provider || '—'}</TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">{b.warehouseName || '—'}</TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">{formatDate(b.date)}</TableCell>
                <TableCell className="py-3 text-right text-xs font-black">{b.packageCount}</TableCell>
                <TableCell className="py-3 text-right text-xs font-black">${Number(b.totalAmount || 0).toFixed(2)}</TableCell>
                <TableCell className="py-3 text-xs">{b.invoiceNumber || '—'}</TableCell>
                <TableCell className="py-3">
                  <Badge variant="outline" className={`rounded-lg text-[10px] ring-1 ${b.status === 'OPEN' ? 'ring-amber-300 text-amber-600' : 'ring-emerald-300 text-emerald-600'}`}>
                    {b.status === 'OPEN' ? 'Abierta' : 'Confirmada'}
                  </Badge>
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><ReceiptText className="size-5 text-primary" /> Nueva referencia de recepción</SheetTitle>
            <SheetDescription>Compra al proveedor (bodega AWBOX u OGLOBAL). Si tiene proveedor, al confirmar se genera la factura de compra en Contabilidad.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 py-4">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor (bodega)</label>
              <select value={createForm.provider} onChange={(e) => setCreateForm((f) => ({ ...f, provider: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
                <option value="">Sin proveedor (no genera factura de compra)</option>
                {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega (warehouse por defecto)</label>
              <select value={createForm.warehouseId} onChange={(e) => setCreateForm((f) => ({ ...f, warehouseId: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold">
                <option value="">Sin bodega por defecto</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.country})</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha</label>
              <Input type="date" value={createForm.date} onChange={(e) => setCreateForm((f) => ({ ...f, date: e.target.value }))} className="rounded-xl text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notas</label>
              <Input value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Opcional" className="rounded-xl text-xs" />
            </div>
            <p className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
              Número automático <b>REF-######</b>. Al confirmar, los paquetes pasan a <b>Conciliación de compras</b> como comprados.
            </p>
          </div>
          <SheetFooter className="flex-row justify-end gap-2 border-t border-border/50 px-5 py-3">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateOpen(false)}><X className="size-4" /> Cancelar</Button>
            <Button type="button" className="rounded-xl" onClick={createBatch} disabled={creating}>{creating ? 'Creando…' : 'Crear referencia'}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}