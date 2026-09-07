import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileUp, Loader2, PackagePlus, Save, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
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

const EMPTY_FORM = {
  shipmentModeCode: '',
  trackingCode: '',
  physicalWeight: '',
  warehouseId: '',
  warehouseValue: '',
  subagencyId: '',
  subagencyName: '',
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
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const context = await logisticsService.getContext();
        setCtx({
          settings: context.settings,
          warehouses: context.warehouses.filter((w) => w.isActive),
          shipmentModes: context.shipmentModes.filter((m) => m.isActive),
          subagencies: context.subagencies.filter((s) => s.isActive),
        });
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuración logística'));
      }
    })();
  }, []);

  const warehouse = useMemo(
    () => (ctx?.warehouses || []).find((w) => w.id === form.warehouseId),
    [ctx, form.warehouseId],
  );
  const autoWarehouseValue = warehouse?.strategy === 'TRACKING_LAST_N' && form.trackingCode
    ? form.trackingCode.slice(-(warehouse.trackingLastN || 6))
    : '';
  const effectiveWarehouseValue = form.warehouseValue || autoWarehouseValue;

  const billablePreview = useMemo(() => {
    const w = Number(form.physicalWeight);
    if (!ctx?.settings || !Number.isFinite(w) || w <= 0) return undefined;
    return calculateBillableWeight(w, ctx.settings);
  }, [form.physicalWeight, ctx]);

  const canSave = Boolean(
    form.shipmentModeCode && form.trackingCode.trim().length >= 4 && Number(form.physicalWeight) > 0 && form.subagencyName,
  );

  const reset = useCallback(() => {
    setForm(EMPTY_FORM);
    setCreated(null);
  }, []);

  const submit = useCallback(async () => {
    if (!ctx?.settings || !canSave) return;
    setSubmitting(true);
    try {
      const payload = {
        trackingCode: form.trackingCode.trim(),
        shipmentModeCode: form.shipmentModeCode,
        sku: '',
        physicalWeight: Number(form.physicalWeight),
        weightUnit: 'lb',
        warehouseStrategy: warehouse?.strategy || 'NONE',
        warehouseValue: effectiveWarehouseValue || undefined,
        warehouseId: warehouse?.id,
        warehouseName: warehouse?.name,
        ownerType: 'SUBAGENCY' as const,
        subagency: { id: form.subagencyId || undefined, name: form.subagencyName },
        customer: form.customerName ? { name: form.customerName } : undefined,
        provider: warehouse?.provider,
      };
      const createdPkg = await logisticsService.createReception(payload);
      setCreated(createdPkg.trackingCode);
      toast.success('Paquete registrado');
      setForm((f) => ({ ...EMPTY_FORM, shipmentModeCode: f.shipmentModeCode }));
    } catch (error: any) {
      const body = error?.response?.data;
      toast.error(
        body?.code === 'TRACKING_ALREADY_RECEIVED'
          ? 'Este tracking ya está registrado'
          : getApiErrorMessage(error, 'No se pudo registrar el paquete'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [ctx, canSave, form, warehouse, effectiveWarehouseValue]);

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
          <PackagePlus className="mr-1 inline size-3.5" /> Registrar uno
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="size-5" /></div>
            <div>
              <h1 className="text-lg font-black tracking-tight">Registrar paquete</h1>
              <p className="text-xs text-muted-foreground">Todo en una sola vista: tipo, peso, tracking, subagencia y bodega.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de envío *</label>
              <select value={form.shipmentModeCode} onChange={(e) => setForm((f) => ({ ...f, shipmentModeCode: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecciona…</option>
                {ctx.shipmentModes.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tracking *</label>
              <Input value={form.trackingCode} onChange={(e) => { setForm((f) => ({ ...f, trackingCode: e.target.value, warehouseValue: '' })); }} placeholder="Código del paquete" className="rounded-xl font-mono" autoFocus />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Peso físico (lb) *</label>
              <Input type="number" step="0.01" min="0" value={form.physicalWeight} onChange={(e) => setForm((f) => ({ ...f, physicalWeight: e.target.value }))} placeholder="0.00" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subagencia *</label>
              <select value={form.subagencyId} onChange={(e) => { const sa = ctx.subagencies.find((s) => s.id === e.target.value); setForm((f) => ({ ...f, subagencyId: e.target.value, subagencyName: sa?.name || '' })); }} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Selecciona…</option>
                {ctx.subagencies.map((s) => <option key={s.id} value={s.id}>{s.name}{s.code ? ` (${s.code})` : ''}</option>)}
              </select>
              {ctx.subagencies.length === 0 && <p className="mt-1 text-[11px] text-muted-foreground">Crea subagencias en Configuración → Subagencias.</p>}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente (opcional)</label>
              <Input value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="Cliente final (opcional)" className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega / País</label>
              <select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value, warehouseValue: '' }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sin bodega</option>
                {ctx.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.country} ({WAREHOUSE_STRATEGY_LABELS[w.strategy] || w.strategy})</option>)}
              </select>
            </div>
            {warehouse && (
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {warehouse.strategy === 'TRACKING_LAST_N' ? 'Bodega automática (editable)' : 'Bodega'}
                </label>
                <Input value={effectiveWarehouseValue} onChange={(e) => setForm((f) => ({ ...f, warehouseValue: e.target.value }))} placeholder={warehouse.strategy === 'TRACKING_LAST_N' ? `Últimos ${warehouse.trackingLastN} del tracking` : 'Número de bodega'} className="rounded-xl font-mono" />
              </div>
            )}
          </div>

          {billablePreview !== undefined && (
            <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Peso facturable: <b className="text-foreground">{billablePreview} lb</b> · mínimo {ctx.settings.minimumBillableWeight} lb, incremento {ctx.settings.weightRoundingIncrement} lb
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button className="rounded-xl" onClick={submit} disabled={submitting || !canSave} data-tour="log-reception-save">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Registrar paquete
            </Button>
            {created && (
              <>
                <Badge variant="outline" className="gap-1 rounded-lg text-[11px] text-emerald-600 ring-emerald-300"><CheckCircle2 className="size-3.5" /> {created}</Badge>
                <Button variant="outline" className="rounded-xl text-xs" onClick={reset}><PackagePlus className="size-4" /> Registrar otro</Button>
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