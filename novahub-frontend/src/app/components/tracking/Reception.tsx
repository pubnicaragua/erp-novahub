import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, FileUp, Loader2, Plus, Save, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Combobox } from '../ui/Combobox';
import { getApiErrorMessage } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
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
type ReceptionColumn = 'select' | 'number' | 'type' | 'item' | 'physicalWeight' | 'quantity' | 'unitPrice' | 'discount' | 'subtotal' | 'tracking' | 'warehouse' | 'actions';

const RECEPTION_COLUMN_WIDTHS: Record<ReceptionColumn, number> = {
  select: 42,
  number: 42,
  type: 132,
  item: 260,
  physicalWeight: 132,
  quantity: 78,
  unitPrice: 96,
  discount: 88,
  subtotal: 102,
  tracking: 290,
  warehouse: 190,
  actions: 48,
};

const RECEPTION_COLUMN_MIN_WIDTHS: Record<ReceptionColumn, number> = {
  select: 36,
  number: 38,
  type: 108,
  item: 180,
  physicalWeight: 110,
  quantity: 64,
  unitPrice: 82,
  discount: 72,
  subtotal: 86,
  tracking: 180,
  warehouse: 156,
  actions: 42,
};

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
  const { canPerform } = useAuth();
  const canCreateReception = canPerform('TRACKING_RECEPTION', 'create');
  const [view, setView] = useState<ReceptionView>('reception');
  const [ctx, setCtx] = useState<{ settings: LogisticsSettings; warehouses: LogisticsWarehouse[]; shipmentModes: ShipmentMode[] } | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [customers, setCustomers] = useState<OwnerOption[]>([]);
  const [rows, setRows] = useState<ReceptionRow[]>([emptyRow(0)]);
  const [form, setForm] = useState({ sourceTicket: '', supplierId: '', supplierName: '', warehouseId: '', agencyId: '', agencyName: '', subagencyId: '', subagencyName: '', customerId: '', customerName: '' });
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reference, setReference] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkWarehouseId, setBulkWarehouseId] = useState('');
  const [columnWidths, setColumnWidths] = useState<Record<ReceptionColumn, number>>(RECEPTION_COLUMN_WIDTHS);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<{ key: ReceptionColumn; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const resize = resizeRef.current;
      if (!resize) return;
      setColumnWidths((current) => ({
        ...current,
        [resize.key]: Math.max(RECEPTION_COLUMN_MIN_WIDTHS[resize.key], resize.startWidth + event.clientX - resize.startX),
      }));
    };
    const onUp = () => {
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startColumnResize = useCallback((key: ReceptionColumn, event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { key, startX: event.clientX, startWidth: columnWidths[key] };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [columnWidths]);

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
        const supplierData: any = supplierPayload?.data ?? supplierPayload;
        const supplierList: any[] = Array.isArray(supplierData) ? supplierData : supplierData?.items || supplierData?.rows || [];
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
  const supplierOptions = useMemo(() => [
    { label: 'Sin proveedor', value: '' },
    ...suppliers.map((supplier) => ({
      label: supplier.name,
      value: supplier.id,
      description: supplier.code ? supplier.code : undefined,
    })),
  ], [suppliers]);
  const agencyOptions = useMemo(() => customers.map((owner) => ({
    label: owner.name,
    value: owner.name,
    description: owner.type === 'SUBAGENCY' ? 'Subagencia' : 'Cliente / agencia',
  })), [customers]);
  const finalCustomerOptions = useMemo(() => customerOptions.map((customer) => ({
    label: customer.name,
    value: customer.name,
  })), [customerOptions]);
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
    if (!canCreateReception || files.length === 0) return;
    setImporting(true);
    try {
      const results = await Promise.all(files.map(async (file) => logisticsService.pdfPreview(file.name, await readPdf(file))));
      const incoming = results.flatMap((result) => result.rows.map((row, index) => ({
        ...row,
        id: `${Date.now()}-${index}-${Math.random()}`,
        shipmentModeCode: row.shipmentModeCode || inferMode(result.format, row.productDescription || row.item),
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
  }, [canCreateReception, form.warehouseId, readPdf]);

  const addRow = useCallback(() => {
    if (!canCreateReception) return;
    setRows((previous) => [...previous, { ...emptyRow(previous.length), warehouseId: form.warehouseId || undefined }]);
  }, [canCreateReception, form.warehouseId]);

  const changeDefaultWarehouse = useCallback((warehouseId: string) => {
    const previousDefault = form.warehouseId;
    setForm((current) => ({ ...current, warehouseId }));
    setRows((previous) => previous.map((row) => (
      row.warehouseId === undefined || row.warehouseId === previousDefault
        ? { ...row, warehouseId, warehouseValue: '' }
        : row
    )));
  }, [form.warehouseId]);

  const allRowsSelected = rows.length > 0 && rows.every((row) => selectedRowIds.includes(row.id));
  const toggleAllRows = useCallback(() => {
    setSelectedRowIds((current) => current.length === rows.length ? [] : rows.map((row) => row.id));
  }, [rows]);
  const applyBulkWarehouse = useCallback(() => {
    if (!bulkWarehouseId || selectedRowIds.length === 0) return;
    const warehouseId = bulkWarehouseId === '__default__' ? undefined : bulkWarehouseId === '__none__' ? '' : bulkWarehouseId;
    setRows((previous) => previous.map((row) => selectedRowIds.includes(row.id) ? { ...row, warehouseId, warehouseValue: '' } : row));
    setSelectedRowIds([]);
    setBulkWarehouseId('');
    toast.success('Bodega aplicada a los paquetes seleccionados');
  }, [bulkWarehouseId, selectedRowIds]);

  const renderHeader = useCallback((key: ReceptionColumn, label: string) => (
    <th style={{ width: columnWidths[key] }} className="relative px-3 py-2 text-[10px] font-black uppercase tracking-widest">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span className="truncate">{label}</span>
        {key !== 'select' && <button type="button" aria-label={`Ajustar ancho de ${label}`} onMouseDown={(event) => startColumnResize(key, event)} className="-mr-2 h-6 w-2 shrink-0 cursor-col-resize rounded-full bg-border/70 hover:bg-primary" />}
      </div>
    </th>
  ), [columnWidths, startColumnResize]);

  const reset = useCallback(() => {
    setRows([emptyRow(0)]);
    setSelectedRowIds([]);
    setBulkWarehouseId('');
    setReference('');
    setForm({ sourceTicket: '', supplierId: '', supplierName: '', warehouseId: '', agencyId: '', agencyName: '', subagencyId: '', subagencyName: '', customerId: '', customerName: '' });
  }, []);

  const saveReception = useCallback(async () => {
    if (!canCreateReception || !ctx || !canSave) return;
    setSaving(true);
    try {
      const batch = await logisticsService.createBatch({
        sourceTicket: form.sourceTicket.trim() || undefined,
        supplierId: form.supplierId || undefined,
        provider: form.supplierName || undefined,
        warehouseId: form.warehouseId || undefined,
      });
      await logisticsService.addBatchPackages(batch.id, rows.map((row) => ({
        warehouseId: row.warehouseId === undefined ? (form.warehouseId || undefined) : (row.warehouseId || null),
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
        customer: row.customer?.name ? row.customer : (form.customerName ? { id: form.customerId || undefined, name: form.customerName } : undefined),
      })));
      await logisticsService.confirmBatch(batch.id, { date: new Date().toISOString().slice(0, 10) });
      setReference(batch.number);
      toast.success(`Recepción ${batch.number} registrada y agrupada correctamente`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo registrar la recepción'));
    } finally {
      setSaving(false);
    }
  }, [canCreateReception, canSave, ctx, form, rows, warehouse]);

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
        <fieldset disabled={!canCreateReception} className="contents">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black tracking-tight" data-tour="log-reception-title">Nueva recepción</h1>
            <p className="text-xs text-muted-foreground">Aquí haces todo: eliges proveedor, cargas PDF o agregas paquetes manualmente y los agrupas en una referencia.</p>
          </div>
          <input ref={pdfInputRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(event) => { void onPickPdfs(Array.from(event.target.files || [])); event.target.value = ''; }} />
          {canCreateReception && <Button type="button" variant="outline" className="rounded-xl text-xs" disabled={importing} onClick={() => pdfInputRef.current?.click()}><FileUp className="size-4" /> {importing ? 'Procesando PDF…' : 'Cargar PDF AWBOX / OGLOBAL'}</Button>}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ticket / referencia del proveedor</label>
            <Input value={form.sourceTicket} onChange={(event) => setForm((current) => ({ ...current, sourceTicket: event.target.value }))} placeholder="Ej. TK32842 o 147413" className="rounded-xl font-mono" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Proveedor de compra</label>
            <Combobox value={form.supplierId} onChange={(value) => { const supplier = suppliers.find((item) => item.id === value); setForm((current) => ({ ...current, supplierId: value, supplierName: supplier?.name || '' })); }} options={supplierOptions} placeholder="Sin proveedor" searchPlaceholder="Buscar proveedor…" emptyMessage="No se encontró ese proveedor." className="h-10 rounded-xl text-sm" contentClassName="min-w-[300px]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agencia / subagencia (cliente) *</label>
            <Combobox value={form.agencyName} onChange={(value) => { const owner = customers.find((item) => item.name.toLowerCase() === value.toLowerCase()); setForm((current) => ({ ...current, agencyName: value, agencyId: owner?.type === 'CUSTOMER' ? owner.id : '', subagencyId: owner?.type === 'SUBAGENCY' ? owner.id : '', subagencyName: owner?.type === 'SUBAGENCY' ? value : '' })); }} options={agencyOptions} placeholder="Buscar agencia o subagencia…" searchPlaceholder="Buscar agencia o subagencia…" emptyMessage="No se encontró; puedes escribirlo manualmente." allowCustomValue className="h-10 rounded-xl text-sm" contentClassName="min-w-[300px]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente (opcional)</label>
            <Combobox value={form.customerName} onChange={(value) => { const customer = customerOptions.find((item) => item.name.toLowerCase() === value.toLowerCase()); setForm((current) => ({ ...current, customerName: value, customerId: customer?.id || '' })); }} options={finalCustomerOptions} placeholder="Buscar cliente…" searchPlaceholder="Buscar cliente…" emptyMessage="No se encontró; puedes escribirlo manualmente." allowCustomValue className="h-10 rounded-xl text-sm" contentClassName="min-w-[300px]" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega predeterminada</label>
            <select value={form.warehouseId} onChange={(event) => changeDefaultWarehouse(event.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="">Sin bodega</option>
              {ctx.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.country}{item.code ? ` · ${item.code}` : ''} ({WAREHOUSE_STRATEGY_LABELS[item.strategy] || item.strategy})</option>)}
            </select>
          </div>
        </div>

        {warehouse && <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">Esta bodega se aplica como predeterminada. Cada paquete puede enviarse a otra bodega y el número se completa por fila según su configuración.</p>}

        <div className="mt-5 overflow-x-auto rounded-xl border border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/20 px-3 py-2"><div><p className="text-xs font-black uppercase tracking-widest">Paquetes de esta referencia</p><p className="text-[11px] text-muted-foreground">Puedes mezclar aéreo y marítimo y enviar cada fila a una bodega distinta.</p></div><Button type="button" variant="outline" className="rounded-xl text-xs" onClick={addRow}><Plus className="size-4" /> Agregar paquete</Button></div>
          {selectedRowIds.length > 0 && <div className="flex flex-wrap items-center gap-2 border-b border-border/50 bg-primary/5 px-3 py-2"><span className="text-xs font-bold text-primary">{selectedRowIds.length} paquete(s) seleccionado(s)</span><select value={bulkWarehouseId} onChange={(event) => setBulkWarehouseId(event.target.value)} className="h-8 rounded-lg border border-input bg-background px-2 text-xs"><option value="">Asignar bodega…</option><option value="__default__">Usar bodega predeterminada</option><option value="__none__">Sin bodega</option>{ctx.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.country}{item.code ? ` · ${item.code}` : ''}</option>)}</select><Button type="button" size="sm" className="h-8 rounded-lg text-xs" onClick={applyBulkWarehouse} disabled={!bulkWarehouseId}>Aplicar a seleccionados</Button></div>}
          <table className="w-full min-w-[1460px] table-fixed text-sm"><colgroup>{(Object.keys(RECEPTION_COLUMN_WIDTHS) as ReceptionColumn[]).map((key) => <col key={key} style={{ width: columnWidths[key] }} />)}</colgroup><thead className="bg-muted/40 text-left"><tr>
            <th style={{ width: columnWidths.select }} className="px-3 py-2 text-center"><input type="checkbox" aria-label="Seleccionar todos los paquetes" checked={allRowsSelected} onChange={toggleAllRows} /></th>{renderHeader('number', '#')}{renderHeader('type', 'Tipo')}{renderHeader('item', 'Cliente / producto')}{renderHeader('physicalWeight', 'Peso físico (lb)')}{renderHeader('quantity', 'Cant.')}{renderHeader('unitPrice', 'P.Unt')}{renderHeader('discount', 'Desc.')}{renderHeader('subtotal', 'S.Total')}{renderHeader('tracking', 'Tracking')}{renderHeader('warehouse', 'Bodega')}{renderHeader('actions', '')}
          </tr></thead><tbody>
            {rows.map((row, index) => {
              const selectedWarehouseId = row.warehouseId === undefined ? form.warehouseId : row.warehouseId;
              const rowWarehouse = ctx.warehouses.find((item) => item.id === selectedWarehouseId);
              const warehouseNumber = rowWarehouse?.strategy === 'TRACKING_LAST_N' && row.trackingCode
                ? row.trackingCode.slice(-(rowWarehouse.trackingLastN || 6))
                : '';
              const rowSelected = selectedRowIds.includes(row.id);
              return <tr key={row.id} className="border-t border-border/40 align-middle">
              <td className="px-3 py-2 text-center"><input type="checkbox" aria-label={`Seleccionar paquete ${index + 1}`} checked={rowSelected} onChange={() => setSelectedRowIds((current) => rowSelected ? current.filter((id) => id !== row.id) : [...current, row.id])} /></td>
              <td className="px-3 py-2 text-xs font-black text-muted-foreground">{index + 1}</td>
              <td className="px-3 py-2"><select value={row.shipmentModeCode || ''} onChange={(event) => updateRow(row.id, { shipmentModeCode: event.target.value })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"><option value="">Selecciona…</option>{ctx.shipmentModes.map((mode) => <option key={mode.id} value={mode.code}>{mode.name}</option>)}</select></td>
              <td className="px-3 py-2"><Input value={row.item || ''} onChange={(event) => updateRow(row.id, { item: event.target.value })} placeholder="Nombre del cliente / producto" className="h-9 rounded-lg text-xs" />{row.productDescription && <p className="mt-1 truncate text-[10px] text-muted-foreground" title={row.productDescription}>Servicio detectado: {row.productDescription}</p>}</td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.physicalWeight ?? ''} onChange={(event) => updateRow(row.id, { physicalWeight: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="1" step="1" value={row.quantity ?? 1} onChange={(event) => updateRow(row.id, { quantity: event.target.value === '' ? 1 : Number(event.target.value) })} className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.unitPrice ?? ''} onChange={(event) => updateRow(row.id, { unitPrice: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.discount ?? ''} onChange={(event) => updateRow(row.id, { discount: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.subtotal ?? ''} onChange={(event) => updateRow(row.id, { subtotal: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
              <td className="px-3 py-2"><Input value={row.trackingCode || ''} onChange={(event) => updateRow(row.id, { trackingCode: event.target.value })} placeholder="Tracking" className="h-9 rounded-lg font-mono text-xs" /></td>
              <td className="px-3 py-2 align-top"><select value={row.warehouseId === undefined ? '__default__' : row.warehouseId} onChange={(event) => updateRow(row.id, { warehouseId: event.target.value === '__default__' ? undefined : event.target.value, warehouseValue: '' })} className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"><option value="__default__">Predeterminada</option><option value="">Sin bodega</option>{ctx.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.country}{item.code ? ` · ${item.code}` : ''}</option>)}</select>{rowWarehouse?.strategy === 'TRACKING_LAST_N' ? <p className="mt-1 text-[10px] font-mono text-muted-foreground">{warehouseNumber || `Últimos ${rowWarehouse.trackingLastN || 6}`}</p> : rowWarehouse?.strategy === 'MANUAL' || rowWarehouse?.strategy === 'PROVIDER_ASSIGNED' ? <Input value={row.warehouseValue || rowWarehouse.code || ''} onChange={(event) => updateRow(row.id, { warehouseValue: event.target.value })} placeholder={rowWarehouse.code ? 'Código configurado' : 'Número de bodega'} className="mt-1 h-8 rounded-lg font-mono text-xs" /> : <p className="mt-1 text-[10px] text-muted-foreground">{rowWarehouse ? 'Se asigna al guardar' : 'Sin bodega'}</p>}</td>
              <td className="px-3 py-2"><Button variant="ghost" size="sm" className="rounded-lg" disabled={rows.length === 1} onClick={() => { setRows((previous) => previous.filter((item) => item.id !== row.id)); setSelectedRowIds((current) => current.filter((id) => id !== row.id)); }}><Trash2 className="size-4 text-destructive" /></Button></td>
              </tr>;
            })}
          </tbody></table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">{canCreateReception && <Button className="rounded-xl" onClick={saveReception} disabled={saving || !canSave} data-tour="log-reception-save">{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Registrar recepción ({rows.length})</Button>}{reference && <><Badge variant="outline" className="gap-1 rounded-lg text-[11px] text-emerald-600 ring-emerald-300"><CheckCircle2 className="size-3.5" /> {reference}</Badge><Button variant="outline" className="rounded-xl text-xs" onClick={reset}>Nueva recepción</Button></>}</div>
        </fieldset>
      </Card>
    </div>
  );
}
