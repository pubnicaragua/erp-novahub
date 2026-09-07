import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, Save, Search, Truck, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import { authService } from '../../services/auth.service';
import { inventoryService } from '../../services/inventario.service';
import { customersService } from '../../services/ventas.service';
import { logisticsService, calculateBillableWeight } from '../../services/logistics.service';

type Step = 1 | 2 | 3 | 4 | 'confirm' | 'done';

const EMPTY_FORM = {
  shipmentModeCode: '',
  branchId: '',
  branchName: '',
  sku: '',
  skuName: '',
  physicalWeight: '',
  supplierWeight: '',
  weightUnit: 'lb',
  prefixCode: '',
  trackingCode: '',
  warehouseId: '',
  warehouseValue: '',
  ownerType: 'CUSTOMER' as 'CUSTOMER' | 'AGENCY' | 'SUBAGENCY',
  customerName: '',
  agencyName: '',
  subagencyName: '',
  provider: '',
};

interface LogisticsContextData {
  settings: NonNullable<Awaited<ReturnType<typeof logisticsService.getContext>>>['settings'];
  warehouses: NonNullable<Awaited<ReturnType<typeof logisticsService.getContext>>>['warehouses'];
  shipmentModes: NonNullable<Awaited<ReturnType<typeof logisticsService.getContext>>>['shipmentModes'];
  trackingPrefixes: NonNullable<Awaited<ReturnType<typeof logisticsService.getContext>>>['trackingPrefixes'];
  customFieldDefinitions: NonNullable<Awaited<ReturnType<typeof logisticsService.getContext>>>['customFieldDefinitions'];
}

export function ReceptionWizard({ onDone }: { onDone?: (trackingCode: string) => void }) {
  const [ctx, setCtx] = useState<LogisticsContextData | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [products, setProducts] = useState<Array<{ code: string; name: string }>>([]);
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState(EMPTY_FORM);
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [checkState, setCheckState] = useState<{ status: 'idle' | 'checking' | 'clean' | 'duplicate' | 'preload'; message?: string }>({ status: 'idle' });
  const [created, setCreated] = useState<{ id: string; trackingCode: string } | null>(null);
  const trackingRef = useRef<HTMLInputElement>(null);

  const receptionCustomFields = useMemo(
    () => (ctx?.customFieldDefinitions || []).filter((d) => d.context === 'RECEPTION'),
    [ctx],
  );

  useEffect(() => {
    (async () => {
      try {
        const [context, branchList, productsData] = await Promise.all([
          logisticsService.getContext(),
          authService.getMyBranches(),
          inventoryService.getProducts({ page: 1, pageSize: 200 } as any).catch(() => ({ items: [], total: 0 }) as any),
        ]);
        setCtx(context);
        setBranches(branchList.map((b) => ({ id: b.id, name: b.name })));
        const list = Array.isArray(productsData) ? productsData : productsData?.items || [];
        setProducts(list.map((p: any) => ({ code: p.code, name: p.name })));
      } catch (error) {
        toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuraciÃ³n logÃ­stica'));
      }
    })();
  }, []);

  const settings = ctx?.settings;

  const billablePreview = useMemo(() => {
    const w = Number(form.physicalWeight);
    if (!settings || !Number.isFinite(w) || w <= 0) return undefined;
    return calculateBillableWeight(w, settings);
  }, [form.physicalWeight, settings]);

  const checkTracking = useCallback(async (rawCode?: string) => {
    const code = (rawCode ?? form.trackingCode).trim();
    if (!code) return;
    setCheckState({ status: 'checking' });
    try {
      const check = await logisticsService.receptionCheck(code);
      if (check.alreadyReceived) {
        setCheckState({ status: 'duplicate', message: 'Este tracking ya estÃ¡ registrado' });
      } else {
        setCheckState({ status: 'preload' });
        if (check.inTransit?.providerWeight && !form.physicalWeight) {
          setForm((f) => ({ ...f, physicalWeight: String(check.inTransit?.providerWeight ?? '') }));
        }
        if (check.inTransit?.shipmentType && !form.shipmentModeCode) {
          const matchMode = (ctx?.shipmentModes || []).find(
            (m) => m.name.toLowerCase().includes(check.inTransit!.shipmentType!.toLowerCase()) || check.inTransit!.shipmentType!.toLowerCase().includes(m.name.toLowerCase()),
          );
          if (matchMode) setForm((f) => ({ ...f, shipmentModeCode: matchMode.code }));
        }
      }
    } catch {
      setCheckState({ status: 'clean' });
    }
  }, [form.trackingCode, form.physicalWeight, form.shipmentModeCode, ctx]);

  const handleTrackingKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkTracking();
      document.getElementById('reception-weight')?.focus();
    }
  };

  const canNext = () => {
    if (step === 1) return form.shipmentModeCode && form.sku.trim();
    if (step === 2) return Number(form.physicalWeight) > 0;
    if (step === 3) return form.trackingCode.trim().length >= 4 && checkState.status !== 'duplicate';
    return true;
  };

  const submit = async () => {
    if (!settings) return;
    setSubmitting(true);
    try {
      const warehouse = (ctx?.warehouses || []).find((w) => w.id === form.warehouseId);
      const payload = {
        trackingCode: form.trackingCode.trim(),
        prefixCode: form.prefixCode || undefined,
        shipmentModeCode: form.shipmentModeCode,
        branchId: form.branchId || undefined,
        branchName: form.branchName || undefined,
        sku: form.sku.trim(),
        skuName: form.skuName || undefined,
        physicalWeight: Number(form.physicalWeight),
        supplierWeight: form.supplierWeight ? Number(form.supplierWeight) : undefined,
        weightUnit: form.weightUnit,
        warehouseStrategy: warehouse?.strategy || 'MANUAL',
        warehouseValue: form.warehouseValue || undefined,
        warehouseId: warehouse?.id,
        warehouseName: warehouse?.name,
        ownerType: form.ownerType,
        customer: form.ownerType === 'CUSTOMER' && form.customerName ? { name: form.customerName } : undefined,
        agency: form.ownerType === 'AGENCY' && form.agencyName ? { name: form.agencyName } : undefined,
        subagency: form.ownerType === 'SUBAGENCY' && form.subagencyName ? { name: form.subagencyName } : undefined,
        provider: form.provider || warehouse?.provider || undefined,
        customFields: Object.keys(customValues).length > 0 ? customValues : undefined,
      };
      const createdPkg = await logisticsService.createReception(payload);
      setCreated({ id: createdPkg.id, trackingCode: createdPkg.trackingCode });
      setStep('done');
      toast.success('Paquete registrado');
      onDone?.(createdPkg.trackingCode);
    } catch (error: any) {
      const body = error?.response?.data;
      if (body?.code === 'TRACKING_ALREADY_RECEIVED') {
        setCheckState({ status: 'duplicate', message: 'Este tracking ya estÃ¡ registrado' });
        setStep(3);
      }
      toast.error(getApiErrorMessage(error, 'No se pudo registrar el paquete'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForAnother = () => {
    setForm(EMPTY_FORM);
    setCustomValues({});
    setCheckState({ status: 'idle' });
    setCreated(null);
    setStep(1);
    setTimeout(() => trackingRef.current?.focus(), 50);
  };

  if (!ctx || !settings) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Cargando configuraciÃ³n logÃ­sticaâ€¦</div>;
  }

  const warehouse = (ctx.warehouses || []).find((w) => w.id === form.warehouseId);
  const needsManualWarehouse = warehouse?.strategy === 'MANUAL' || warehouse?.strategy === 'PROVIDER_ASSIGNED';
  const lastNWarehouse = warehouse?.strategy === 'TRACKING_LAST_N';

  const stepsMeta = [
    { n: 1, label: 'Tipo y sucursal' },
    { n: 2, label: 'Peso' },
    { n: 3, label: 'IdentificaciÃ³n' },
    { n: 4, label: 'Propietario y bodega' },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      {step !== 'done' && (
        <div className="flex flex-wrap items-center gap-2">
          {stepsMeta.map((s) => (
            <Badge key={s.n} variant="outline" className={`gap-1 rounded-lg text-[10px] ${step === s.n ? 'bg-primary text-primary-foreground ring-primary' : 'text-muted-foreground'}`}>
              <span>{s.n}</span> {s.label}
            </Badge>
          ))}
        </div>
      )}

      {step === 1 && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Truck className="size-4 text-primary" /> Paso 1 Â· Tipo y sucursal</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tipo de envÃ­o *</label>
              <select value={form.shipmentModeCode} onChange={(e) => setForm((f) => ({ ...f, shipmentModeCode: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Seleccionaâ€¦</option>
                {ctx.shipmentModes.map((m) => <option key={m.id} value={m.code}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sucursal</label>
              <select value={form.branchId} onChange={(e) => { const b = branches.find((x) => x.id === e.target.value); setForm((f) => ({ ...f, branchId: e.target.value, branchName: b?.name || '' })); }} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sin sucursal</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">SKU *</label>
              <Input list="reception-skus" placeholder="Busca o escribe el SKU" value={form.sku} onChange={(e) => { const p = products.find((x) => x.code === e.target.value); setForm((f) => ({ ...f, sku: e.target.value, skuName: p?.name || f.skuName })); }} className="rounded-xl" />
              <datalist id="reception-skus">
                {products.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </datalist>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button className="rounded-xl" onClick={() => setStep(2)} disabled={!canNext()}>Siguiente</Button>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Warehouse className="size-4 text-primary" /> Paso 2 Â· Peso</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Peso fÃ­sico (lb) *</label>
              <Input id="reception-weight" type="number" step="0.01" min="0" value={form.physicalWeight} onChange={(e) => setForm((f) => ({ ...f, physicalWeight: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Peso proveedor (opcional)</label>
              <Input type="number" step="0.01" min="0" value={form.supplierWeight} onChange={(e) => setForm((f) => ({ ...f, supplierWeight: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidad</label>
              <select value={form.weightUnit} onChange={(e) => setForm((f) => ({ ...f, weightUnit: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {['lb', 'kg', 'oz', 'unidades'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          {billablePreview !== undefined && (
            <p className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              Peso facturable: <b className="text-foreground">{billablePreview} {form.weightUnit}</b> Â· mÃ­nimo {settings.minimumBillableWeight} {settings.defaultUnitOfMeasure}, incremento {settings.weightRoundingIncrement} {settings.defaultUnitOfMeasure}
            </p>
          )}
          <div className="mt-5 flex justify-between">
            <Button variant="outline" className="rounded-xl" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> AtrÃ¡s</Button>
            <Button className="rounded-xl" onClick={() => setStep(3)} disabled={!canNext()}>Siguiente</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Search className="size-4 text-primary" /> Paso 3 Â· IdentificaciÃ³n</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ctx.trackingPrefixes.length > 0 && (
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Prefijo</label>
                <select value={form.prefixCode} onChange={(e) => setForm((f) => ({ ...f, prefixCode: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Sin prefijo</option>
                  {ctx.trackingPrefixes.map((p) => <option key={p.id} value={p.code}>{p.code} Â· {p.name}</option>)}
                </select>
              </div>
            )}
            <div className={ctx.trackingPrefixes.length > 0 ? 'sm:col-span-1' : 'sm:col-span-2'}>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tracking * (escÃ¡ner USB â†’ ENTER)</label>
              <Input ref={trackingRef} value={form.trackingCode} onChange={(e) => { setForm((f) => ({ ...f, trackingCode: e.target.value })); setCheckState({ status: 'idle' }); }} onKeyDown={handleTrackingKey} placeholder="Escanea o escribe el cÃ³digoâ€¦" className="rounded-xl font-mono" autoFocus />
            </div>
          </div>
          {checkState.status === 'duplicate' && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2">
              <p className="text-xs font-bold text-destructive">{checkState.message}</p>
              {checkState.message && (
                <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => form.trackingCode && onDone?.(form.trackingCode)}>Ver paquete</Button>
              )}
            </div>
          )}
          {checkState.status === 'checking' && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Verificando trackingâ€¦</p>}
          {checkState.status === 'preload' && <p className="mt-3 text-xs text-emerald-600">Tracking nuevo Â· se precargÃ³ informaciÃ³n del trÃ¡nsito si existÃ­a.</p>}
          {checkState.status === 'clean' && <p className="mt-3 text-xs text-muted-foreground">Tracking nuevo Â· puede recibirse directamente.</p>}
          <div className="mt-5 flex justify-between">
            <Button variant="outline" className="rounded-xl" onClick={() => setStep(2)}><ArrowLeft className="size-4" /> AtrÃ¡s</Button>
            <Button className="rounded-xl" onClick={() => { checkTracking(); setStep(4); }} disabled={!canNext()}>Siguiente</Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Warehouse className="size-4 text-primary" /> Paso 4 Â· Propietario y bodega</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Propietario *</label>
              <select value={form.ownerType} onChange={(e) => setForm((f) => ({ ...f, ownerType: e.target.value as any }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="CUSTOMER">Cliente</option>
                <option value="AGENCY">Agencia</option>
                <option value="SUBAGENCY">Subagencia</option>
              </select>
            </div>
            {form.ownerType === 'CUSTOMER' && (
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente</label>
                <Input list="reception-customers" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="Busca o escribe el cliente" className="rounded-xl" />
              </div>
            )}
            {form.ownerType === 'AGENCY' && (
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agencia</label>
                <Input value={form.agencyName} onChange={(e) => setForm((f) => ({ ...f, agencyName: e.target.value }))} placeholder="Nombre de la agencia" className="rounded-xl" />
              </div>
            )}
            {form.ownerType === 'SUBAGENCY' && (
              <>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Agencia</label>
                  <Input value={form.agencyName} onChange={(e) => setForm((f) => ({ ...f, agencyName: e.target.value }))} placeholder="Agencia a la que pertenece" className="rounded-xl" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subagencia</label>
                  <Input value={form.subagencyName} onChange={(e) => setForm((f) => ({ ...f, subagencyName: e.target.value }))} placeholder="Nombre de la subagencia" className="rounded-xl" />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bodega / PaÃ­s</label>
              <select value={form.warehouseId} onChange={(e) => setForm((f) => ({ ...f, warehouseId: e.target.value, warehouseValue: '' }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                <option value="">Sin bodega</option>
                {ctx.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name} Â· {w.country} ({w.strategy})</option>)}
              </select>
            </div>
            {warehouse && needsManualWarehouse && (
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Warehouse (manual)</label>
                <Input value={form.warehouseValue} onChange={(e) => setForm((f) => ({ ...f, warehouseValue: e.target.value }))} placeholder="Ingresa el warehouse" className="rounded-xl" />
              </div>
            )}
            {warehouse && lastNWarehouse && (
              <p className="text-xs text-muted-foreground">Warehouse automÃ¡tico: Ãºltimos {warehouse.trackingLastN} del tracking â†’ <b>{form.trackingCode.slice(-warehouse.trackingLastN) || 'â€”'}</b></p>
            )}
          </div>

          {receptionCustomFields.length > 0 && (
            <div className="mt-4 border-t border-border/50 pt-4">
              <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campos personalizados</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                {receptionCustomFields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {field.label}{field.required ? ' *' : ''}
                    </label>
                    {field.inputType === 'SELECT' ? (
                      <select value={(customValues[field.key] as string) || ''} onChange={(e) => setCustomValues((v) => ({ ...v, [field.key]: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                        <option value="">â€”</option>
                        {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : field.inputType === 'BOOLEAN' ? (
                      <select value={String(customValues[field.key] ?? '')} onChange={(e) => setCustomValues((v) => ({ ...v, [field.key]: e.target.value === 'true' }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                        <option value="">â€”</option>
                        <option value="true">SÃ­</option>
                        <option value="false">No</option>
                      </select>
                    ) : field.inputType === 'TEXTAREA' ? (
                      <textarea value={(customValues[field.key] as string) || ''} onChange={(e) => setCustomValues((v) => ({ ...v, [field.key]: e.target.value }))} rows={2} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                    ) : (
                      <Input type={field.inputType === 'NUMBER' ? 'number' : field.inputType === 'DATE' ? 'date' : 'text'} value={(customValues[field.key] as string) || ''} onChange={(e) => setCustomValues((v) => ({ ...v, [field.key]: e.target.value }))} className="rounded-xl" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-between">
            <Button variant="outline" className="rounded-xl" onClick={() => setStep(3)}><ArrowLeft className="size-4" /> AtrÃ¡s</Button>
            <Button className="rounded-xl" onClick={() => setStep('confirm')}>Revisar y confirmar</Button>
          </div>
        </Card>
      )}

      {step === 'confirm' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><PackageCheck className="size-4 text-primary" /> ConfirmaciÃ³n</h3>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Tipo</p><p className="font-semibold">{ctx.shipmentModes.find((m) => m.code === form.shipmentModeCode)?.name || form.shipmentModeCode}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Sucursal</p><p className="font-semibold">{form.branchName || 'No disponible'}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">SKU</p><p className="font-semibold">{form.sku}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Tracking</p><p className="font-mono font-semibold">{form.prefixCode}{form.trackingCode}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Warehouse</p><p className="font-semibold">{form.warehouseValue || warehouse?.name || 'No disponible'}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Peso fÃ­sico</p><p className="font-semibold">{form.physicalWeight} {form.weightUnit}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Peso facturable</p><p className="font-semibold">{billablePreview ?? 'â€”'} {form.weightUnit}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Propietario</p><p className="font-semibold">{form.ownerType === 'CUSTOMER' ? form.customerName : form.ownerType === 'AGENCY' ? form.agencyName : `${form.agencyName} / ${form.subagencyName}` || 'No disponible'}</p></div>
            <div><p className="text-[10px] font-black uppercase text-muted-foreground">Bodega/PaÃ­s</p><p className="font-semibold">{warehouse ? `${warehouse.name} Â· ${warehouse.country}` : 'No disponible'}</p></div>
          </div>
          <div className="mt-5 flex justify-between">
            <Button variant="outline" className="rounded-xl" onClick={() => setStep(4)}><ArrowLeft className="size-4" /> AtrÃ¡s</Button>
            <Button className="rounded-xl" onClick={submit} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Registrar paquete
            </Button>
          </div>
        </Card>
      )}

      {step === 'done' && created && (
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-10 text-emerald-500" />
          <h3 className="mt-3 text-lg font-black">Paquete registrado</h3>
          <p className="mt-1 font-mono text-sm text-primary">{created.trackingCode}</p>
          <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2">
            <Button className="rounded-xl" onClick={resetForAnother}><PackageCheck className="size-4" /> Registrar otro</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => onDone?.(created.trackingCode)}>Ver paquete</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => { onDone?.(created.trackingCode); }}>Ir a Compras</Button>
            <Button variant="ghost" className="rounded-xl" onClick={() => { setCreated(null); setStep(1); }}>Cerrar</Button>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">"Ir a Compras" no crea automÃ¡ticamente una compra.</p>
        </Card>
      )}

      <CustomerDatalist />
    </div>
  );
}

function CustomerDatalist() {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    customersService.getAll({ page: 1, pageSize: 200 } as any)
      .then((res: any) => {
        const list = Array.isArray(res) ? res : res?.items || [];
        setCustomers(list.map((c: any) => ({ id: c.id, name: c.name })));
      })
      .catch(() => undefined);
  }, []);
  return (
    <datalist id="reception-customers">
      {customers.map((c) => <option key={c.id} value={c.name} />)}
    </datalist>
  );
}