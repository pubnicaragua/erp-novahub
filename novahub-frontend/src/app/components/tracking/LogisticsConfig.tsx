import { useCallback, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Save, Settings2, Trash2, UserRound, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import { suppliersService } from '../../services/compras.service';
import {
  logisticsService,
  WAREHOUSE_STRATEGY_LABELS,
  CUSTOM_FIELD_INPUT_LABELS,
  type CustomFieldDefinition,
  type CustomFieldInputType,
  type LogisticsSettings,
  type LogisticsSubagency,
  type LogisticsWarehouse,
  type ShipmentMode,
  type TrackingPrefix,
  type WarehouseStrategy,
} from '../../services/logistics.service';

type Tab = 'settings' | 'warehouses' | 'subagencies' | 'modes' | 'prefixes' | 'fields';

export function LogisticsConfig() {
  const [tab, setTab] = useState<Tab>('settings');
  const [settings, setSettings] = useState<LogisticsSettings | null>(null);
  const [warehouses, setWarehouses] = useState<LogisticsWarehouse[]>([]);
  const [subagencies, setSubagencies] = useState<LogisticsSubagency[]>([]);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [modes, setModes] = useState<ShipmentMode[]>([]);
  const [prefixes, setPrefixes] = useState<TrackingPrefix[]>([]);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, w, sa, m, p, f] = await Promise.all([
        logisticsService.getSettings(),
        logisticsService.listWarehouses(),
        logisticsService.listSubagencies(),
        logisticsService.listShipmentModes(),
        logisticsService.listTrackingPrefixes(),
        logisticsService.listCustomFieldDefinitions(),
      ]);
      setSettings(s);
      setWarehouses(w);
      setSubagencies(sa);
      setModes(m);
      setPrefixes(p);
      setFields(f);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuración'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    suppliersService.getAll({ page: 1, pageSize: 200 } as any)
      .then((sup: any) => {
        const list = sup?.data || sup?.items || [];
        setSuppliers(list.map((s: any) => ({ id: s.id, name: s.name })));
      })
      .catch(() => { /* opcional */ });
  }, []);

  const [settingsForm, setSettingsForm] = useState<Partial<LogisticsSettings>>({});

  const saveSettings = async () => {
    if (!settings) return;
    setBusy(true);
    try {
      const updated = await logisticsService.updateSettings({
        minimumBillableWeight: Number(settingsForm.minimumBillableWeight ?? settings.minimumBillableWeight),
        weightRoundingIncrement: Number(settingsForm.weightRoundingIncrement ?? settings.weightRoundingIncrement),
        defaultUnitOfMeasure: settingsForm.defaultUnitOfMeasure || settings.defaultUnitOfMeasure,
        defaultCountry: settingsForm.defaultCountry,
      });
      setSettings(updated);
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar'));
    } finally { setBusy(false); }
  };

  const [whForm, setWhForm] = useState<Partial<LogisticsWarehouse>>({});
  const addWarehouse = async () => {
    if (!whForm.country || !whForm.name) { toast.error('País y nombre de bodega son obligatorios'); return; }
    setBusy(true);
    try {
      await logisticsService.createWarehouse({ ...whForm, strategy: (whForm.strategy || 'NONE') as WarehouseStrategy, trackingLastN: whForm.trackingLastN || 6 });
      setWhForm({});
      toast.success('Bodega creada');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo crear la bodega')); } finally { setBusy(false); }
  };

  const [subForm, setSubForm] = useState<Partial<LogisticsSubagency>>({});
  const [subEditId, setSubEditId] = useState<string | null>(null);
  const saveSubagency = async () => {
    if (!subForm.name?.trim()) { toast.error('El nombre es obligatorio'); return; }
    setBusy(true);
    try {
      if (subEditId) {
        await logisticsService.updateSubagency(subEditId, subForm);
        toast.success('Subagencia actualizada');
      } else {
        await logisticsService.createSubagency(subForm);
        toast.success('Subagencia creada');
      }
      setSubForm({});
      setSubEditId(null);
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo guardar')); } finally { setBusy(false); }
  };
  const removeSubagency = async (id: string) => {
    if (!window.confirm('¿Eliminar esta subagencia?')) return;
    try {
      await logisticsService.deleteSubagency(id);
      toast.success('Subagencia eliminada');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo eliminar')); }
  };

  const [whEditId, setWhEditId] = useState<string | null>(null);
  const saveWarehouseEdit = async () => {
    if (!whEditId) return;
    setBusy(true);
    try {
      await logisticsService.updateWarehouse(whEditId, whForm);
      setWhEditId(null);
      setWhForm({});
      toast.success('Bodega actualizada');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo actualizar')); } finally { setBusy(false); }
  };

  const [modeForm, setModeForm] = useState<Partial<ShipmentMode>>({});
  const addMode = async () => {
    if (!modeForm.code || !modeForm.name) { toast.error('Código y nombre son obligatorios'); return; }
    setBusy(true);
    try {
      await logisticsService.createShipmentMode(modeForm);
      setModeForm({});
      toast.success('Tipo de envío creado');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo crear')); } finally { setBusy(false); }
  };

  const [prefixForm, setPrefixForm] = useState<Partial<TrackingPrefix>>({});
  const addPrefix = async () => {
    if (!prefixForm.code || !prefixForm.name) { toast.error('Código y nombre son obligatorios'); return; }
    setBusy(true);
    try {
      await logisticsService.createTrackingPrefix(prefixForm);
      setPrefixForm({});
      toast.success('Prefijo creado');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo crear')); } finally { setBusy(false); }
  };

  const [fieldForm, setFieldForm] = useState<Partial<CustomFieldDefinition>>({ inputType: 'TEXT', context: 'RECEPTION' });
  const addField = async () => {
    if (!fieldForm.label || !fieldForm.key) { toast.error('Etiqueta y clave son obligatorias'); return; }
    setBusy(true);
    try {
      await logisticsService.createCustomFieldDefinition({
        context: fieldForm.context || 'RECEPTION',
        label: fieldForm.label,
        key: fieldForm.key,
        inputType: fieldForm.inputType as CustomFieldInputType,
        required: fieldForm.required,
        options: fieldForm.options || [],
        order: fieldForm.order || 0,
      });
      setFieldForm({ inputType: 'TEXT', context: 'RECEPTION' });
      toast.success('Campo personalizado creado');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo crear')); } finally { setBusy(false); }
  };

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'settings', label: 'Reglas de peso' },
    { id: 'warehouses', label: 'Bodegas / País' },
    { id: 'subagencies', label: 'Subagencias' },
    { id: 'modes', label: 'Tipos de envío' },
    { id: 'prefixes', label: 'Prefijos' },
    { id: 'fields', label: 'Campos personalizados' },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2" data-tour="log-config-tabs">
        {tabs.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? 'default' : 'outline'} className="rounded-xl text-xs" onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'settings' && settings && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Settings2 className="size-4 text-primary" /> Reglas de peso facturable</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mínimo facturable</label>
              <Input type="number" step="0.01" value={settingsForm.minimumBillableWeight ?? settings.minimumBillableWeight} onChange={(e) => setSettingsForm((f) => ({ ...f, minimumBillableWeight: Number(e.target.value) }))} className="rounded-xl" /></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Incremento de redondeo</label>
              <Input type="number" step="0.01" value={settingsForm.weightRoundingIncrement ?? settings.weightRoundingIncrement} onChange={(e) => setSettingsForm((f) => ({ ...f, weightRoundingIncrement: Number(e.target.value) }))} className="rounded-xl" /></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidad por defecto</label>
              <select value={settingsForm.defaultUnitOfMeasure ?? settings.defaultUnitOfMeasure} onChange={(e) => setSettingsForm((f) => ({ ...f, defaultUnitOfMeasure: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {['lb', 'kg', 'oz', 'unidades'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">País por defecto</label>
              <Input value={settingsForm.defaultCountry ?? settings.defaultCountry ?? ''} onChange={(e) => setSettingsForm((f) => ({ ...f, defaultCountry: e.target.value }))} className="rounded-xl" /></div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Ej: 0.13 → 0.50 · 1.13 → 1.20 · 3.87 → 3.90 (redondeo siempre hacia arriba).</p>
          <div className="mt-4"><Button className="rounded-xl" onClick={saveSettings} disabled={busy} data-tour="log-config-save"><Save className="size-4" /> Guardar</Button></div>
        </Card>
      )}

      {tab === 'warehouses' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Warehouse className="size-4 text-primary" /> Bodegas por país</h3>
          {whEditId && <p className="mt-1 text-[11px] font-black text-primary">Editando bodega…</p>}
          <div className="mt-4 grid gap-2 sm:grid-cols-6">
            <Input placeholder="País *" value={whForm.country || ''} onChange={(e) => setWhForm((f) => ({ ...f, country: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Nombre *" value={whForm.name || ''} onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
            <select value={whForm.provider || ''} onChange={(e) => setWhForm((f) => ({ ...f, provider: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="">Sin proveedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={whForm.unitOfMeasure || 'lb'} onChange={(e) => setWhForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {['lb', 'kg', 'oz', 'unidades'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={whForm.strategy || 'NONE'} onChange={(e) => setWhForm((f) => ({ ...f, strategy: e.target.value as WarehouseStrategy }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {Object.entries(WAREHOUSE_STRATEGY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {whEditId ? (
              <Button className="rounded-xl" onClick={saveWarehouseEdit} disabled={busy}><Check className="size-4" /> Guardar</Button>
            ) : (
              <Button className="rounded-xl" onClick={addWarehouse} disabled={busy}><Plus className="size-4" /> Agregar</Button>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {warehouses.length === 0 && <p className="text-xs text-muted-foreground">Sin bodegas configuradas.</p>}
            {warehouses.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-black">{w.name} · {w.country}</p>
                  <p className="text-[11px] text-muted-foreground">{w.provider || 'Sin proveedor'} · {w.unitOfMeasure} · {WAREHOUSE_STRATEGY_LABELS[w.strategy]}{w.strategy === 'TRACKING_LAST_N' ? ` (N=${w.trackingLastN})` : ''}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => { setWhEditId(w.id); setWhForm({ country: w.country, name: w.name, provider: w.provider || '', unitOfMeasure: w.unitOfMeasure, strategy: w.strategy as WarehouseStrategy, trackingLastN: w.trackingLastN }); }}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={async () => { if (!window.confirm('¿Eliminar esta bodega?')) return; try { await logisticsService.deleteWarehouse(w.id); await load(); toast.success('Bodega eliminada'); } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo eliminar')); } }}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'subagencies' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><UserRound className="size-4 text-primary" /> Subagencias</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">Se usan en Recepción como propietario del paquete. El cliente final es opcional.</p>
          {subEditId && <p className="mt-1 text-[11px] font-black text-primary">Editando subagencia…</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Input placeholder="Nombre * (ej. Subagencia Managua)" value={subForm.name || ''} onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))} className="min-w-56 flex-1 rounded-xl" />
            <Input placeholder="Código (opcional)" value={subForm.code || ''} onChange={(e) => setSubForm((f) => ({ ...f, code: e.target.value }))} className="w-40 rounded-xl" />
            {subEditId ? (
              <Button className="rounded-xl" onClick={saveSubagency} disabled={busy}><Check className="size-4" /> Guardar</Button>
            ) : (
              <Button className="rounded-xl" onClick={saveSubagency} disabled={busy}><Plus className="size-4" /> Agregar</Button>
            )}
            {subEditId && <Button variant="outline" className="rounded-xl" onClick={() => { setSubEditId(null); setSubForm({}); }}>Cancelar</Button>}
          </div>
          <div className="mt-4 space-y-2">
            {subagencies.length === 0 && <p className="text-xs text-muted-foreground">Sin subagencias. Agrega la primera arriba.</p>}
            {subagencies.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-black">{s.name}{s.code ? ` · ${s.code}` : ''}</p>
                  <p className="text-[11px] text-muted-foreground">{s.isActive ? 'Activa' : 'Inactiva'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={async () => { await logisticsService.updateSubagency(s.id, { isActive: !s.isActive }); await load(); }}>{s.isActive ? 'Desactivar' : 'Activar'}</Button>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => { setSubEditId(s.id); setSubForm({ name: s.name, code: s.code || '' }); }}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => void removeSubagency(s.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'modes' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm" data-tour="log-config-form">
          <h3 className="text-sm font-black">Tipos de envío configurables</h3>
          <div className="mt-4 flex gap-2">
            <Input placeholder="Código (ej. AEREO)" value={modeForm.code || ''} onChange={(e) => setModeForm((f) => ({ ...f, code: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Nombre (ej. Aéreo)" value={modeForm.name || ''} onChange={(e) => setModeForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
            <Button className="rounded-xl" onClick={addMode} disabled={busy}><Plus className="size-4" /></Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {modes.map((m) => (
              <Badge key={m.id} variant="outline" className="gap-1 rounded-lg py-1 text-[11px]">
                <b>{m.code}</b> {m.name}
                <button className="ml-1 text-destructive" onClick={async () => { await logisticsService.deleteShipmentMode(m.id); await load(); }}><Trash2 className="size-3" /></button>
              </Badge>
            ))}
            {modes.length === 0 && <p className="text-xs text-muted-foreground">Sin tipos configurados.</p>}
          </div>
        </Card>
      )}

      {tab === 'prefixes' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="text-sm font-black">Prefijos de tracking (catálogo opcional)</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">El prefijo se guarda sin interpretar ni eliminar. Si no hay prefijos, el campo se oculta en la recepción.</p>
          <div className="mt-4 flex gap-2">
            <Input placeholder="Código (ej. GFUS)" value={prefixForm.code || ''} onChange={(e) => setPrefixForm((f) => ({ ...f, code: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Nombre" value={prefixForm.name || ''} onChange={(e) => setPrefixForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
            <Button className="rounded-xl" onClick={addPrefix} disabled={busy}><Plus className="size-4" /></Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {prefixes.map((p) => (
              <Badge key={p.id} variant="outline" className="gap-1 rounded-lg py-1 text-[11px]">
                <b>{p.code}</b> {p.name}
                <button className="ml-1 text-destructive" onClick={async () => { await logisticsService.deleteTrackingPrefix(p.id); await load(); }}><Trash2 className="size-3" /></button>
              </Badge>
            ))}
            {prefixes.length === 0 && <p className="text-xs text-muted-foreground">La empresa no utiliza prefijos.</p>}
          </div>
        </Card>
      )}

      {tab === 'fields' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="text-sm font-black">Campos personalizados (sin nuevas columnas)</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-6">
            <Input placeholder="Etiqueta *" value={fieldForm.label || ''} onChange={(e) => setFieldForm((f) => ({ ...f, label: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Clave (key) *" value={fieldForm.key || ''} onChange={(e) => setFieldForm((f) => ({ ...f, key: e.target.value }))} className="rounded-xl" />
            <select value={fieldForm.inputType || 'TEXT'} onChange={(e) => setFieldForm((f) => ({ ...f, inputType: e.target.value as CustomFieldInputType }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {Object.entries(CUSTOM_FIELD_INPUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={fieldForm.context || 'RECEPTION'} onChange={(e) => setFieldForm((f) => ({ ...f, context: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="RECEPTION">Recepción</option>
              <option value="WAREHOUSE">Bodega</option>
            </select>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={fieldForm.required || false} onChange={(e) => setFieldForm((f) => ({ ...f, required: e.target.checked }))} /> Obligatorio
            </label>
            <Button className="rounded-xl" onClick={addField} disabled={busy}><Plus className="size-4" /></Button>
          </div>
          {fieldForm.inputType === 'SELECT' && (
            <Input className="mt-2 rounded-xl" placeholder="Opciones separadas por coma" value={(fieldForm.options || []).join(', ')} onChange={(e) => setFieldForm((f) => ({ ...f, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) }))} />
          )}
          <div className="mt-4 space-y-2">
            {fields.map((field) => (
              <div key={field.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
                <div>
                  <p className="text-sm font-black">{field.label} <Badge variant="outline" className="ml-1 rounded-lg text-[10px]">{CUSTOM_FIELD_INPUT_LABELS[field.inputType]}</Badge>{field.required && <span className="ml-1 text-[10px] text-destructive">*</span>}</p>
                  <p className="text-[11px] text-muted-foreground">key: {field.key} · {field.context}{field.inputType === 'SELECT' ? ` · ${(field.options || []).join(', ')}` : ''}</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={async () => { await logisticsService.deleteCustomFieldDefinition(field.id); await load(); }}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            {fields.length === 0 && <p className="text-xs text-muted-foreground">Sin campos personalizados.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}