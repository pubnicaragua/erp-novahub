import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Settings2, Trash2, Warehouse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { getApiErrorMessage } from '../../services/api';
import {
  logisticsService,
  WAREHOUSE_STRATEGY_LABELS,
  CUSTOM_FIELD_INPUT_LABELS,
  type CustomFieldDefinition,
  type CustomFieldInputType,
  type LogisticsSettings,
  type LogisticsWarehouse,
  type ShipmentMode,
  type TrackingPrefix,
  type WarehouseStrategy,
} from '../../services/logistics.service';

type Tab = 'settings' | 'warehouses' | 'modes' | 'prefixes' | 'fields';

export function LogisticsConfig() {
  const [tab, setTab] = useState<Tab>('settings');
  const [settings, setSettings] = useState<LogisticsSettings | null>(null);
  const [warehouses, setWarehouses] = useState<LogisticsWarehouse[]>([]);
  const [modes, setModes] = useState<ShipmentMode[]>([]);
  const [prefixes, setPrefixes] = useState<TrackingPrefix[]>([]);
  const [fields, setFields] = useState<CustomFieldDefinition[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, w, m, p, f] = await Promise.all([
        logisticsService.getSettings(),
        logisticsService.listWarehouses(),
        logisticsService.listShipmentModes(),
        logisticsService.listTrackingPrefixes(),
        logisticsService.listCustomFieldDefinitions(),
      ]);
      setSettings(s);
      setWarehouses(w);
      setModes(m);
      setPrefixes(p);
      setFields(f);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar la configuraciÃ³n'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      toast.success('ConfiguraciÃ³n guardada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar'));
    } finally { setBusy(false); }
  };

  const [whForm, setWhForm] = useState<Partial<LogisticsWarehouse>>({});
  const addWarehouse = async () => {
    if (!whForm.country || !whForm.name) { toast.error('PaÃ­s y nombre de bodega son obligatorios'); return; }
    setBusy(true);
    try {
      await logisticsService.createWarehouse({ ...whForm, strategy: (whForm.strategy || 'NONE') as WarehouseStrategy, trackingLastN: whForm.trackingLastN || 6 });
      setWhForm({});
      toast.success('Bodega creada');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo crear la bodega')); } finally { setBusy(false); }
  };

  const [modeForm, setModeForm] = useState<Partial<ShipmentMode>>({});
  const addMode = async () => {
    if (!modeForm.code || !modeForm.name) { toast.error('CÃ³digo y nombre son obligatorios'); return; }
    setBusy(true);
    try {
      await logisticsService.createShipmentMode(modeForm);
      setModeForm({});
      toast.success('Tipo de envÃ­o creado');
      await load();
    } catch (error) { toast.error(getApiErrorMessage(error, 'No se pudo crear')); } finally { setBusy(false); }
  };

  const [prefixForm, setPrefixForm] = useState<Partial<TrackingPrefix>>({});
  const addPrefix = async () => {
    if (!prefixForm.code || !prefixForm.name) { toast.error('CÃ³digo y nombre son obligatorios'); return; }
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
    { id: 'warehouses', label: 'Bodegas / PaÃ­s' },
    { id: 'modes', label: 'Tipos de envÃ­o' },
    { id: 'prefixes', label: 'Prefijos' },
    { id: 'fields', label: 'Campos personalizados' },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
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
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">MÃ­nimo facturable</label>
              <Input type="number" step="0.01" value={settingsForm.minimumBillableWeight ?? settings.minimumBillableWeight} onChange={(e) => setSettingsForm((f) => ({ ...f, minimumBillableWeight: Number(e.target.value) }))} className="rounded-xl" /></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Incremento de redondeo</label>
              <Input type="number" step="0.01" value={settingsForm.weightRoundingIncrement ?? settings.weightRoundingIncrement} onChange={(e) => setSettingsForm((f) => ({ ...f, weightRoundingIncrement: Number(e.target.value) }))} className="rounded-xl" /></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Unidad por defecto</label>
              <select value={settingsForm.defaultUnitOfMeasure ?? settings.defaultUnitOfMeasure} onChange={(e) => setSettingsForm((f) => ({ ...f, defaultUnitOfMeasure: e.target.value }))} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {['lb', 'kg', 'oz', 'unidades'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">PaÃ­s por defecto</label>
              <Input value={settingsForm.defaultCountry ?? settings.defaultCountry ?? ''} onChange={(e) => setSettingsForm((f) => ({ ...f, defaultCountry: e.target.value }))} className="rounded-xl" /></div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Ej: 0.13 â†’ 0.50 Â· 1.13 â†’ 1.20 Â· 3.87 â†’ 3.90 (redondeo siempre hacia arriba).</p>
          <div className="mt-4"><Button className="rounded-xl" onClick={saveSettings} disabled={busy}><Save className="size-4" /> Guardar</Button></div>
        </Card>
      )}

      {tab === 'warehouses' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-black"><Warehouse className="size-4 text-primary" /> Bodegas por paÃ­s</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-6">
            <Input placeholder="PaÃ­s *" value={whForm.country || ''} onChange={(e) => setWhForm((f) => ({ ...f, country: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Nombre *" value={whForm.name || ''} onChange={(e) => setWhForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Proveedor" value={whForm.provider || ''} onChange={(e) => setWhForm((f) => ({ ...f, provider: e.target.value }))} className="rounded-xl" />
            <select value={whForm.unitOfMeasure || 'lb'} onChange={(e) => setWhForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {['lb', 'kg', 'oz', 'unidades'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={whForm.strategy || 'NONE'} onChange={(e) => setWhForm((f) => ({ ...f, strategy: e.target.value as WarehouseStrategy }))} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {Object.entries(WAREHOUSE_STRATEGY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Button className="rounded-xl" onClick={addWarehouse} disabled={busy}><Plus className="size-4" /> Agregar</Button>
          </div>
          <div className="mt-4 space-y-2">
            {warehouses.length === 0 && <p className="text-xs text-muted-foreground">Sin bodegas configuradas.</p>}
            {warehouses.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-black">{w.name} Â· {w.country}</p>
                  <p className="text-[11px] text-muted-foreground">{w.provider || 'Sin proveedor'} Â· {w.unitOfMeasure} Â· {WAREHOUSE_STRATEGY_LABELS[w.strategy]}{w.strategy === 'TRACKING_LAST_N' ? ` (N=${w.trackingLastN})` : ''}</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={async () => { await logisticsService.deleteWarehouse(w.id); await load(); toast.success('Bodega eliminada'); }}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'modes' && (
        <Card className="rounded-2xl border-border/60 p-5 shadow-sm">
          <h3 className="text-sm font-black">Tipos de envÃ­o configurables</h3>
          <div className="mt-4 flex gap-2">
            <Input placeholder="CÃ³digo (ej. AEREO)" value={modeForm.code || ''} onChange={(e) => setModeForm((f) => ({ ...f, code: e.target.value }))} className="rounded-xl" />
            <Input placeholder="Nombre (ej. AÃ©reo)" value={modeForm.name || ''} onChange={(e) => setModeForm((f) => ({ ...f, name: e.target.value }))} className="rounded-xl" />
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
          <h3 className="text-sm font-black">Prefijos de tracking (catÃ¡logo opcional)</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">El prefijo se guarda sin interpretar ni eliminar. Si no hay prefijos, el campo se oculta en la recepciÃ³n.</p>
          <div className="mt-4 flex gap-2">
            <Input placeholder="CÃ³digo (ej. GFUS)" value={prefixForm.code || ''} onChange={(e) => setPrefixForm((f) => ({ ...f, code: e.target.value }))} className="rounded-xl" />
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
              <option value="RECEPTION">RecepciÃ³n</option>
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
                  <p className="text-[11px] text-muted-foreground">key: {field.key} Â· {field.context}{field.inputType === 'SELECT' ? ` Â· ${(field.options || []).join(', ')}` : ''}</p>
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