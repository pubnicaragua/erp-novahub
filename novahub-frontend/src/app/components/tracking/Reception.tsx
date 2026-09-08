import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, FileUp, Loader2, Plus, Save, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import { suppliersService } from '../../services/compras.service';
import { customersService } from '../../services/ventas.service';
import {
  logisticsService,
  WAREHOUSE_STRATEGY_LABELS,
  type BatchPackageRow,
  type LogisticsSettings,
  type LogisticsWarehouse,
  type ShipmentMode,
} from '../../services/logistics.service';
import { BatchReception } from './BatchReception';

type ReceptionView = 'reception' | 'history';

interface ReceptionRow extends BatchPackageRow {
  id: string;
}

interface SupplierOption { id: string; name: string; code: string; }
interface OwnerOption { id: string; name: string; type: 'CUSTOMER' | 'SUBAGENCY'; }

const emptyRow = (index: number): ReceptionRow => ({
  id: `${Date.now()}-${index}`,
  line: index + 1,
  warehouseId: undefined,
  shipmentModeCode: '',
  item: '',
  quantity: 1,
  unitPrice: undefined,
  subtotal: undefined,
  discount: undefined,
  physicalWeight: undefined,
  weightUnit: 'lb',
  trackingCode: '',
  warehouseValue: '',
});

const inferMode = (format: 'AWBOX' | 'OGLOBAL' | null, item?: string) => {
  if (/MAR[IÍ]TIM|OCE[AÁ]N|SEA/i.test(item || '')) return 'MARITIMO';
  return format === 'OGLOBAL' ? 'MARITIMO' : 'AEREO';
};

export function Reception() {
  const [view, setView] = useState<ReceptionView>('reception');
  const [ctx, setCtx] = useState<{ settings: LogisticsSettings; warehouses: LogisticsWarehouse[]; shipmentModes: ShipmentMode[] } | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [customers, setCustomers] = useState<OwnerOption[]>([]);
  const [rows, setRows] = useState<ReceptionRow[]>([emptyRow(0)]);
  const [form, setForm] = useState({ sourceTicket: '', supplierId: '', supplierName: '', warehouseId: '', agencyId: '', agencyName: '', subagencyId: '', subagencyName: '', customerId: '', customerName: '' });
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [context, supplierResponse, customerResponse, subagencyResponse] = await Promise.all([
          logisticsService.getContext(),
          suppliersService.getAll({ page: 1, pageSize: 200 } as any),
          customersService.getAll({ page: 1, pageSize: 200 } as any),
          logisticsService.listSubagencies().catch(() => []),
        ]);
        setCtx({
          settings: context.settings,
          warehouses: context.warehouses.filter((warehouse) => warehouse.isActive),
          shipmentModes: context.shipmentModes.filter((mode) => mode.isActive),
        });
        const supplierPayload: any = (supplierResponse as any)?.data ?? supplierResponse;
        const supplierList: any[] = Array.isArray(supplierPayload) ? supplierPayload : supplierPayload?.items || [];
        setSuppliers(supplierList.map((supplier) => ({ id: supplier.id, name: supplier.name, code: supplier.code })));
        const customerPayload: any = (customerResponse as any)?.data ?? customerResponse;
        const customerData: any = customerPayload?.data ?? customerPayload;
        const customerList: any[] = Array.isArray(customerData) ? customerData : customerData?.items || customerData?.rows || [];
        const subagencyPayload: any = (subagencyResponse as any)?.data ?? subagencyResponse;
        const subagencyData: any = subagencyPayload?.data ?? subagencyPayload;
        const subagencyList: any[] = Array.isArray(subagencyData) ? subagencyData : subagencyData?.items || subagencyData?.rows || [];
        const ownerOptions: OwnerOption[] = [
          ...customerList.map((owner) => ({ id: owner.id, name: owner.name, type: 'CUSTOMER' as const })),
          ...subagencyList.map((owner) => ({ id: owner.id, name: owner.name, type: 'SUBAGENCY' as const })),
        ]
          .filter((owner) => owner.id && owner.name)
          .filter((owner, index, list) => list.findIndex((candidate) => candidate.name.toLowerCase() === owner.name.toLowerCase()) === index);
        setCustomers(ownerOptions);
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuración de recepción'));
      }
    })();
  }, []);

  const warehouse = useMemo(() => ctx?.warehouses.find((item) => item.id === form.warehouseId), [ctx, form.warehouseId]);
  const customerOptions = useMemo(() => customers.filter((owner) => owner.type === 'CUSTOMER'), [customers]);
  const canSave = Boolean(
    form.agencyName && rows.length > 0 && rows.every((row) => {
      const selectedWarehouse = ctx?.warehouses.find((item) => item.id === (row.warehouseId === undefined ? form.warehouseId : row.warehouseId));
      const needsWarehouseValue = selectedWarehouse?.strategy === 'MANUAL' || selectedWarehouse?.strategy === 'PROVIDER_ASSIGNED';
      const configuredWarehouseValue = selectedWarehouse?.code?.trim();
      return row.shipmentModeCode && row.trackingCode?.trim().length >= 4 && Number(row.physicalWeight) > 0 && (!needsWarehouseValue || row.warehouseValue?.trim() || configuredWarehouseValue);
    }),
  );

  const updateRow = useCallback((id: string, patch: Partial<ReceptionRow>) => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const readPdf = useCallback(async (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
    reader.readAsDataURL(file);
  }), []);

  const onPickPdfs = useCallback(async (files: File[] = []) => {
    if (files.length === 0) return;
    setImporting(true);
    try {
      const results = await Promise.all(files.map(async (file) => logisticsService.pdfPreview(file.name, await readPdf(file))));
      const incoming = results.flatMap((result) => result.rows.map((row, index) => ({
        ...row,
        id: `${Date.now()}-${index}-${Math.random()}`,
        shipmentModeCode: row.shipmentModeCode || inferMode(result.format, row.item),
        warehouseId: form.warehouseId || undefined,
      })));
      const detectedTickets = [...new Set(results.map((result) => result.ticketNumber).filter(Boolean))];
      if (detectedTickets.length > 0) setForm((current) => ({ ...current, sourceTicket: current.sourceTicket || detectedTickets.join(', ') }));
      setRows((previous) => {
        const current = previous.length === 1 && !previous[0].trackingCode && !previous[0].item && !previous[0].physicalWeight ? [] : previous;
        return [...current, ...incoming];
      });
      toast.success(`${files.length} PDF(s) cargado(s): ${incoming.length} paquete(s) listos para revisar`);
      results.flatMap((result) => result.warnings).forEach((warning) => toast.info(warning));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo procesar el PDF'));
    } finally {
      setImporting(false);
    }
  }, [form.warehouseId, readPdf]);

  const addRow = useCallback(() => {
    setRows((previous) => [...previous, { ...emptyRow(previous.length), warehouseId: form.warehouseId || undefined }]);
  }, [form.warehouseId]);

  const changeDefaultWarehouse = useCallback((warehouseId: string) => {
    const previousDefault = form.warehouseId;
    setForm((current) => ({ ...current, warehouseId }));
    setRows((previous) => previous.map((row) => (
      row.warehouseId === undefined || row.warehouseId === previousDefault
        ? { ...row, warehouseId, warehouseValue: '' }
        : row
    )));
  }, [form.warehouseId]);

  const reset = useCallback(() => {
    setRows([emptyRow(0)]);
    setReference('');
    setForm({ sourceTicket: '', supplierId: '', supplierName: '', warehouseId: '', agencyId: '', agencyName: '', subagencyId: '', subagencyName: '', customerId: '', customerName: '' });
  }, []);

  const saveReception = useCallback(async () => {
    if (!ctx || !canSave) return;
    setSaving(true);
    try {
      const batch = await logisticsService.createBatch({
        sourceTicket: form.sourceTicket.trim() || undefined,
        supplierId: form.supplierId || undefined,
        provider: form.supplierName || undefined,
        warehouseId: form.warehouseId || undefined,
      });
      await logisticsService.addBatchPackages(batch.id, rows.map((row) => ({
        warehouseId: (row.warehouseId === undefined ? form.warehouseId : row.warehouseId) || undefined,
        line: row.line,
        shipmentModeCode: row.shipmentModeCode,
        trackingCode: row.trackingCode?.trim() || undefined,
        item: row.item?.trim() || undefined,
        quantity: Math.max(1, Math.trunc(Number(row.quantity) || 1)),
        unitPrice: row.unitPrice !== undefined ? Number(row.unitPrice) : undefined,
        subtotal: row.subtotal !== undefined ? Number(row.subtotal) : undefined,
        discount: row.discount !== undefined ? Number(row.discount) : undefined,
        physicalWeight: Number(row.physicalWeight),
        weightUnit: row.weightUnit || 'lb',
        warehouseValue: row.warehouseValue?.trim() || ((ctx.warehouses.find((item) => item.id === (row.warehouseId === undefined ? form.warehouseId : row.warehouseId))?.strategy === 'MANUAL' || ctx.warehouses.find((item) => item.id === (row.warehouseId === undefined ? form.warehouseId : row.warehouseId))?.strategy === 'PROVIDER_ASSIGNED') ? ctx.warehouses.find((item) => item.id === (row.warehouseId === undefined ? form.warehouseId : row.warehouseId))?.code?.trim() || undefined : undefined),
        agency: form.agencyName && !form.subagencyName ? { id: form.agencyId || undefined, name: form.agencyName } : undefined,
        subagency: form.subagencyName ? { id: form.subagencyId || undefined, name: form.subagencyName } : undefined,
        customer: form.customerName ? { id: form.customerId || undefined, name: form.customerName } : undefined,
      })));
      await logisticsService.confirmBatch(batch.id, { date: new Date().toISOString().slice(0, 10) });
      setReference(batch.number);
      toast.success(`Recepción ${batch.number} registrada y agrupada correctamente`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo registrar la recepción'));
    } finally {
      setSaving(false);
    }
  }, [canSave, ctx, form, rows, warehouse]);

  if (!ctx) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando configuración logística…</div>;

  if (view === 'history') return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="border-b border-border/50 px-4 py-3 sm:px-6"><p className="text-xs text-muted-foreground">Historial de referencias creadas desde Recepción.</p></div>
      <BatchReception />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setView('reception')} className="rounded-t-xl border-b-2 border-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-primary"><Truck className="mr-1 inline size-3.5" /> Recepción</button>
        <button onClick={() => setView('history')} data-tour="log-reception-history" className="rounded-t-xl px-4 py-2 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"><FileText className="mr-1 inline size-3.5" /> Historial de referencias</button>
      </div>

      <Card className="rounded-2xl border-border/60 p-5 shadow-sm" data-tour="log-reception-wizard">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-tight" data-tour="log-reception-title">Nueva recepción</h1>
            <p className="text-xs text-muted-foreground">Aquí haces todo: eliges proveedor, cargas PDF o agregas paquetes manualmente y los agrupas en una referencia.</p>
          </div>
          <input ref={pdfInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => { void onPickPdfs(Array.from(event.target.files || [])); event.target.value = ''; }} />
          <Button type="button" variant="outline" className="rounded-xl text-xs" disabled={importing} onClick={() => pdfInputRef.current?.click()}><FileUp className="size-4" /> {importing ? 'Procesando PDF…' : 'Cargar PDF AWBOX / OGLOBAL'}</Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket / referencia del proveedor</label>
            <Input value={form.sourceTicket} onChange={(event) => setForm((current) => ({ ...current, sourceTicket: event.target.value }))} placeholder="Ej. TK32842 o 147413" className="rounded-xl font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor de compra</label>
            <select value={form.supplierId} onChange={(event) => { const supplier = suppliers.find((item) => item.id === event.target.value); setForm((current) => ({ ...current, supplierId: event.target.value, supplierName: supplier?.name || '' })); }} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="">Sin proveedor</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.code ? ` (${supplier.code})` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agencia / subagencia (cliente) *</label>
            <Input list="reception-agencies" value={form.agencyName} onChange={(event) => { const owner = customers.find((item) => item.name === event.target.value); setForm((current) => ({ ...current, agencyName: event.target.value, agencyId: owner?.type === 'CUSTOMER' ? owner.id : '', subagencyId: owner?.type === 'SUBAGENCY' ? owner.id : '', subagencyName: owner?.type === 'SUBAGENCY' ? event.target.value : '' })); }} placeholder="Buscar agencia o subagencia…" className="rounded-xl" />
            <datalist id="reception-agencies">{customers.map((customer) => <option key={customer.id} value={customer.name} />)}</datalist>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente (opcional)</label>
            <Input list="reception-customers" value={form.customerName} onChange={(event) => { const customer = customerOptions.find((item) => item.name === event.target.value); setForm((current) => ({ ...current, customerName: event.target.value, customerId: customer?.id || '' })); }} placeholder="Buscar cliente…" className="rounded-xl" />
            <datalist id="reception-customers">{customerOptions.map((customer) => <option key={customer.id} value={customer.name} />)}</datalist>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega predeterminada</label>
            <select value={form.warehouseId} onChange={(event) => changeDefaultWarehouse(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="">Sin bodega</option>
              {ctx.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.country} ({WAREHOUSE_STRATEGY_LABELS[item.strategy] || item.strategy})</option>)}
            </select>
          </div>
        </div>

        {warehouse && <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">Esta bodega se aplica como predeterminada. Cada paquete puede enviarse a otra bodega y el número se completa por fila según su configuración.</p>}

        <div className="mt-5 overflow-x-auto rounded-xl border border-border/60">
          <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-3 py-2"><div><p className="text-xs font-black uppercase tracking-widest">Paquetes de esta referencia</p><p className="text-[11px] text-muted-foreground">Puedes mezclar aéreo y marítimo y enviar cada fila a una bodega distinta.</p></div><Button type="button" variant="outline" className="rounded-xl text-xs" onClick={addRow}><Plus className="size-4" /> Agregar paquete</Button></div>
          <table className="w-full min-w-[78rem] text-sm"><thead className="bg-muted/40 text-left"><tr>
            <th className="w-10 px-3 py-2 text-[10px] font-black uppercase tracking-widest">#</th><th className="w-32 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Tipo</th><th className="min-w-52 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Item / producto</th><th className="w-28 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Peso físico (lb)</th><th className="w-20 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Cant.</th><th className="w-24 px-3 py-2 text-[10px] font-black uppercase tracking-widest">P.Unt</th><th className="w-20 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Desc.</th><th className="w-24 px-3 py-2 text-[10px] font-black uppercase tracking-widest">S.Total</th><th className="min-w-48 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Tracking</th><th className="w-40 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Bodega</th><th className="w-10 px-3 py-2" />
          </tr></thead><tbody>
            {rows.map((row, index) => {
              const selectedWarehouseId = row.warehouseId === undefined ? form.warehouseId : row.warehouseId;
              const rowWarehouse = ctx.warehouses.find((item) => item.id === selectedWarehouseId);
              const warehouseNumber = rowWarehouse?.strategy === 'TRACKING_LAST_N' && row.trackingCode
                ? row.trackingCode.slice(-(rowWarehouse.trackingLastN || 6))
                : '';
              return <tr key={row.id} className="border-t border-border/40 align-middle">
              <td className="px-3 py-2 text-xs font-black text-muted-foreground">{index + 1}</td>
              <td className="px-3 py-2"><select value={row.shipmentModeCode || ''} onChange={(event) => updateRow(row.id, { shipmentModeCode: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"><option value="">Selecciona…</option>{ctx.shipmentModes.map((mode) => <option key={mode.id} value={mode.code}>{mode.name}</option>)}</select></td>
              <td className="px-3 py-2"><Input value={row.item || ''} onChange={(event) => updateRow(row.id, { item: event.target.value })} placeholder="Producto" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.physicalWeight ?? ''} onChange={(event) => updateRow(row.id, { physicalWeight: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="1" step="1" value={row.quantity ?? 1} onChange={(event) => updateRow(row.id, { quantity: event.target.value === '' ? 1 : Number(event.target.value) })} className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.unitPrice ?? ''} onChange={(event) => updateRow(row.id, { unitPrice: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.discount ?? ''} onChange={(event) => updateRow(row.id, { discount: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.subtotal ?? ''} onChange={(event) => updateRow(row.id, { subtotal: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input value={row.trackingCode || ''} onChange={(event) => updateRow(row.id, { trackingCode: event.target.value })} placeholder="Tracking" className="h-9 rounded-lg font-mono text-xs" /></td>
              <td className="px-3 py-2 align-top"><select value={selectedWarehouseId} onChange={(event) => updateRow(row.id, { warehouseId: event.target.value, warehouseValue: '' })} className="h-9 w-full min-w-36 rounded-lg border border-input bg-background px-2 text-xs"><option value="">Sin bodega</option>{ctx.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.country}</option>)}</select>{rowWarehouse?.strategy === 'TRACKING_LAST_N' ? <p className="mt-1 text-[10px] font-mono text-muted-foreground">{warehouseNumber || `Últimos ${rowWarehouse.trackingLastN || 6}`}</p> : rowWarehouse?.strategy === 'MANUAL' || rowWarehouse?.strategy === 'PROVIDER_ASSIGNED' ? <Input value={row.warehouseValue || rowWarehouse.code || ''} onChange={(event) => updateRow(row.id, { warehouseValue: event.target.value })} placeholder={rowWarehouse.code ? 'Código configurado' : 'Número de bodega'} className="mt-1 h-8 rounded-lg font-mono text-xs" /> : <p className="mt-1 text-[10px] text-muted-foreground">{rowWarehouse ? 'Se asigna al guardar' : 'Sin bodega'}</p>}</td>
              <td className="px-3 py-2"><Button variant="ghost" size="sm" className="rounded-lg" disabled={rows.length === 1} onClick={() => setRows((previous) => previous.filter((item) => item.id !== row.id))}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>;
            })}
          </tbody></table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2"><Button className="rounded-xl" onClick={saveReception} disabled={saving || !canSave} data-tour="log-reception-save">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Registrar recepción ({rows.length})</Button>{reference && <><Badge variant="outline" className="gap-1 rounded-lg text-[11px] text-emerald-600 ring-emerald-300"><CheckCircle2 className="size-3.5" /> {reference}</Badge><Button variant="outline" className="rounded-xl text-xs" onClick={reset}>Nueva recepción</Button></>}</div>
      </Card>
    </div>
  );
}
