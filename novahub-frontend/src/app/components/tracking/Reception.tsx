import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, PackagePlus, Plus, Save, Trash2, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import { customersService } from '../../services/ventas.service';
import {
  logisticsService,
  calculateBillableWeight,
  WAREHOUSE_STRATEGY_LABELS,
  type LogisticsSettings,
  type LogisticsSubagency,
  type LogisticsWarehouse,
  type ShipmentMode,
} from '../../services/logistics.service';
import { BatchReception } from './BatchReception';

type Mode = 'single' | 'batch';

interface ReceptionRow {
  id: string;
  trackingCode: string;
  physicalWeight: string;
}

const newRow = (index: number): ReceptionRow => ({
  id: `${Date.now()}-${index}`,
  trackingCode: '',
  physicalWeight: '',
});

const EMPTY_FORM = {
  shipmentModeCode: '',
  warehouseId: '',
  warehouseValue: '',
  subagencyId: '',
  subagencyName: '',
  customerId: '',
  customerName: '',
};

export function Reception() {
  const [mode, setMode] = useState<Mode>('single');
  const [ctx, setCtx] = useState<{
    settings: LogisticsSettings;
    warehouses: LogisticsWarehouse[];
    shipmentModes: ShipmentMode[];
    subagencies: LogisticsSubagency[];
  } | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [rows, setRows] = useState<ReceptionRow[]>([newRow(0)]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [context, customerResponse] = await Promise.all([
          logisticsService.getContext(),
          customersService.getAll({ page: 1, pageSize: 200 } as any),
        ]);
        setCtx({
          settings: context.settings,
          warehouses: context.warehouses.filter((w) => w.isActive),
          shipmentModes: context.shipmentModes.filter((m) => m.isActive),
          subagencies: context.subagencies.filter((s) => s.isActive),
        });
        const customerPayload: any = (customerResponse as any)?.data ?? customerResponse;
        const list: any[] = Array.isArray(customerPayload) ? customerPayload : customerPayload?.items || [];
        setCustomers(list.map((customer) => ({ id: customer.id, name: customer.name })).filter((customer) => customer.name));
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuración logística'));
      }
    })();
  }, []);

  const warehouse = useMemo(
    () => (ctx?.warehouses || []).find((w) => w.id === form.warehouseId),
    [ctx, form.warehouseId],
  );

  const validRows = rows.filter((row) => row.trackingCode.trim().length >= 4 && Number(row.physicalWeight) > 0);
  const canSave = Boolean(
    form.shipmentModeCode && form.subagencyName && rows.length > 0 && validRows.length === rows.length,
  );

  const reset = useCallback(() => {
    setForm(EMPTY_FORM);
    setRows([newRow(0)]);
    setCreatedCount(0);
  }, []);

  const updateRow = useCallback((id: string, patch: Partial<ReceptionRow>) => {
    setRows((previous) => previous.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }, []);

  const submit = useCallback(async () => {
    if (!ctx?.settings || !canSave) return;
    setSubmitting(true);
    try {
      const warehouseStrategy = warehouse?.strategy || 'NONE';
      const ownerType: 'CUSTOMER' | 'SUBAGENCY' = form.customerName ? 'CUSTOMER' : 'SUBAGENCY';
      const base = {
        shipmentModeCode: form.shipmentModeCode,
        sku: '',
        weightUnit: 'lb',
        warehouseStrategy,
        warehouseValue: warehouseStrategy === 'TRACKING_LAST_N' ? undefined : form.warehouseValue.trim() || undefined,
        warehouseId: warehouse?.id,
        warehouseName: warehouse?.name,
        ownerType,
        subagency: { id: form.subagencyId || undefined, name: form.subagencyName },
        customer: form.customerName ? { id: form.customerId || undefined, name: form.customerName } : undefined,
        provider: warehouse?.provider,
      };
      const results = await Promise.allSettled(rows.map((row) => logisticsService.createReception({
        ...base,
        trackingCode: row.trackingCode.trim(),
        physicalWeight: Number(row.physicalWeight),
      })));
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      const failed = results.length - succeeded;
      if (succeeded > 0) {
        setCreatedCount(succeeded);
        setRows((previous) => previous.filter((_, index) => results[index]?.status !== 'fulfilled'));
        toast.success(`${succeeded} paquete(s) registrado(s)${failed ? ` · ${failed} requiere(n) revisión` : ''}`);
      }
      if (failed > 0 && succeeded === 0) {
        toast.error('No se pudo registrar ningún paquete. Revisa los trackings y vuelve a intentar.');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron registrar los paquetes'));
    } finally {
      setSubmitting(false);
    }
  }, [ctx, canSave, form, rows, warehouse]);

  if (!ctx) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Cargando configuración logística…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMode('single')}
          className={`rounded-t-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${mode === 'single' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <PackagePlus className="mr-1 inline size-3.5" /> Registrar paquetes
        </button>
        <button
          onClick={() => setMode('batch')}
          data-tour="log-wizard-open-batch"
          className={`rounded-t-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${mode === 'batch' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <FileUp className="mr-1 inline size-3.5" /> Lote / PDF del proveedor
        </button>
      </div>

      {mode === 'single' ? (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm" data-tour="log-reception-wizard">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-black tracking-tight">Registrar recepción</h1>
              <p className="text-xs text-muted-foreground">Completa los datos comunes una sola vez y registra 1, 4, 10 o los paquetes que necesites.</p>
            </div>
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setMode('batch')}>
              <FileUp className="size-4" /> Importar PDF AWBOX / OGLOBAL
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de envío *</label>
              <select value={form.shipmentModeCode} onChange={(e) => setForm((f) => ({ ...f, shipmentModeCode: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecciona…</option>
                {ctx.shipmentModes.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agencia / subagencia *</label>
              <select value={form.subagencyId} onChange={(e) => { const sa = ctx.subagencies.find((s) => s.id === e.target.value); setForm((f) => ({ ...f, subagencyId: e.target.value, subagencyName: sa?.name || '' })); }} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecciona…</option>
                {ctx.subagencies.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
              </select>
              {ctx.subagencies.length === 0 && <p className="mt-1 text-[11px] text-amber-600">No hay agencias configuradas todavía. Agrégalas en Configuración → Subagencias.</p>}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente (opcional, una sola vez)</label>
              <Input list="reception-customers" value={form.customerName} onChange={(e) => { const customer = customers.find((item) => item.name === e.target.value); setForm((f) => ({ ...f, customerName: e.target.value, customerId: customer?.id || '' })); }} placeholder="Cliente final (opcional)" className="rounded-xl" />
              <datalist id="reception-customers">{customers.map((customer) => <option key={customer.id} value={customer.name} />)}</datalist>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega / país</label>
              <select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value, warehouseValue: '' }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sin bodega</option>
                {ctx.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.country} ({WAREHOUSE_STRATEGY_LABELS[w.strategy] || w.strategy})</option>)}
              </select>
            </div>
            {warehouse && warehouse.strategy !== 'TRACKING_LAST_N' && (
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Número de bodega</label>
                <Input value={form.warehouseValue} onChange={(e) => setForm((f) => ({ ...f, warehouseValue: e.target.value }))} placeholder="Solo si la bodega lo requiere" className="rounded-xl font-mono" />
              </div>
            )}
            {warehouse?.strategy === 'TRACKING_LAST_N' && (
              <div className="flex items-end">
                <p className="w-full rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">El número de bodega se toma automáticamente de los últimos {warehouse.trackingLastN} caracteres del tracking.</p>
              </div>
            )}
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-border/60">
            <div className="flex items-center justify-between border-b border-border/50 bg-muted/20 px-3 py-2">
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Paquetes por registrar</p>
                <p className="text-[11px] text-muted-foreground">El peso físico se captura por paquete y es el dato usado para la recepción.</p>
              </div>
              <Button type="button" variant="outline" className="rounded-xl text-xs" onClick={() => setRows((previous) => [...previous, newRow(previous.length)])}>
                <Plus className="size-4" /> Agregar paquete
              </Button>
            </div>
            <table className="w-full min-w-[38rem] text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="w-12 px-3 py-2 text-[10px] font-black uppercase tracking-widest">#</th>
                  <th className="px-3 py-2 text-[10px] font-black uppercase tracking-widest">Tracking *</th>
                  <th className="w-48 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Peso físico (lb) *</th>
                  <th className="w-52 px-3 py-2 text-[10px] font-black uppercase tracking-widest">Bodega asignada</th>
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border/40 align-middle">
                    <td className="px-3 py-2 text-xs font-black text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2"><Input value={row.trackingCode} onChange={(e) => updateRow(row.id, { trackingCode: e.target.value })} placeholder="Código del paquete" className="h-9 rounded-lg font-mono text-xs" autoFocus={index === 0} /></td>
                    <td className="px-3 py-2"><Input type="number" min="0" step="0.01" value={row.physicalWeight} onChange={(e) => updateRow(row.id, { physicalWeight: e.target.value })} placeholder="0.00" className="h-9 rounded-lg text-xs" /></td>
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{warehouse?.strategy === 'TRACKING_LAST_N' && row.trackingCode ? row.trackingCode.slice(-(warehouse.trackingLastN || 6)) : form.warehouseValue || 'Automática al guardar'}</td>
                    <td className="px-3 py-2"><Button variant="ghost" size="sm" className="rounded-lg" disabled={rows.length === 1} onClick={() => setRows((previous) => previous.filter((item) => item.id !== row.id))}><Trash2 className="size-4 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.some((row) => Number(row.physicalWeight) > 0) && (
            <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {rows.length} paquete(s) · {rows.reduce((total, row) => total + (Number(row.physicalWeight) || 0), 0).toFixed(2)} lb físicas
              {rows[0] && Number(rows[0].physicalWeight) > 0 && ctx.settings ? <> · facturable desde {calculateBillableWeight(Number(rows[0].physicalWeight), ctx.settings)} lb</> : null}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button className="rounded-xl" onClick={submit} disabled={submitting || !canSave} data-tour="log-reception-save">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Registrar {rows.length} paquete(s)
            </Button>
            {createdCount > 0 && (
              <>
                <Badge variant="outline" className="gap-1 rounded-lg text-[11px] text-emerald-600 ring-emerald-300"><CheckCircle2 className="size-3.5" /> {createdCount} registrado(s)</Badge>
                <Button variant="outline" className="rounded-xl text-xs" onClick={reset}><PackagePlus className="size-4" /> Nueva recepción</Button>
              </>
            )}
          </div>
        </Card>
      ) : (
        <BatchReception />
      )}
    </div>
  );
}
