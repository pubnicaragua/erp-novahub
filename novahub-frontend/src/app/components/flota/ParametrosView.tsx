import { useState } from 'react';
import { Check, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Skeleton } from '../ui/skeleton';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { flotaService, type CostFieldDefinition, type FleetSettings } from '../../services/flota.service';
import { toast } from '../../services/toast';
import { ErrorState, Field, PageTitle, Panel } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { COST_KIND_LABEL, useFleetRefresh } from './flota.helpers';
import { FormulaField } from './FormulaField';

export function ParametrosView() {
  const settings = useTenantQuery(['fleet', 'settings'], (signal) => flotaService.getSettings(signal));
  if (settings.isLoading) return <Skeleton className="h-96 w-full" aria-busy="true" />;
  if (settings.isError || !settings.data) return <ErrorState message={errorMessage(settings.error)} onRetry={() => void settings.refetch()} />;
  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle eyebrow="Flota y fletes" title="Parámetros y costos" subtitle="Valores que usan las fórmulas de flete, los campos de costo del viaje y las plantillas de arranque por giro." />
      <SettingsForm initial={settings.data} />
      <CostFields />
      <Templates />
    </div>
  );
}

function SettingsForm({ initial }: { initial: FleetSettings }) {
  const { canPerform } = useAuth();
  const refresh = useFleetRefresh();
  const canEdit = canPerform('FLEET_SETTINGS', 'edit');
  const [diesel, setDiesel] = useState(String(initial.dieselPrice ?? 0));
  const [factor, setFactor] = useState(String(initial.kmFactor ?? 0));
  const [kmPerGallon, setKmPerGallon] = useState(String(initial.defaultKmPerGallon ?? 10));
  const [linkAssets, setLinkAssets] = useState(Boolean(initial.linkFixedAssets));
  const [rateFormula, setRateFormula] = useState(initial.rateFormula || '');
  const [tiers, setTiers] = useState<Array<{ upToGallons: string; percent: string }>>((initial.commissionTiers || []).map((tier) => ({ upToGallons: String(tier.upToGallons), percent: String(tier.percent) })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      await flotaService.saveSettings({
        dieselPrice: diesel, kmFactor: factor, defaultKmPerGallon: kmPerGallon, linkFixedAssets: linkAssets, rateFormula,
        commissionTiers: tiers.filter((tier) => tier.upToGallons || tier.percent).map((tier) => ({ upToGallons: Number(tier.upToGallons), percent: Number(tier.percent) })),
      } as unknown as Partial<FleetSettings>);
      toast.success('Parámetros guardados');
      await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  };
  const setTier = (index: number, field: 'upToGallons' | 'percent', value: string) => setTiers((current) => current.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));

  return (
    <Panel
      title="Parámetros de flete"
      action={canEdit ? <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" aria-hidden="true" />}Guardar</Button> : undefined}
    >
      {error && <div className="mb-3"><ErrorState message={error} /></div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Precio del diésel (por galón)" htmlFor="fl-diesel" hint="Operaciones asume el flete a precio de bomba."><Input id="fl-diesel" inputMode="decimal" disabled={!canEdit} value={diesel} onChange={(event) => setDiesel(event.target.value)} /></Field>
        <Field label="Factor de kilómetros" htmlFor="fl-factor" hint="Para derivar la tarifa a partir de los km."><Input id="fl-factor" inputMode="decimal" disabled={!canEdit} value={factor} onChange={(event) => setFactor(event.target.value)} /></Field>
        <Field label="Rendimiento por defecto (km por galón)" htmlFor="fl-kmg"><Input id="fl-kmg" inputMode="decimal" disabled={!canEdit} value={kmPerGallon} onChange={(event) => setKmPerGallon(event.target.value)} /></Field>
      </div>
      <div className="mt-4">
        <Field label="Fórmula de la tarifa (opcional)" htmlFor="fl-rate-formula" hint="Se usa cuando el viaje no tiene tarifa manual ni de ruta. Por ejemplo: km * factor_km / capacidad. Cada empresa escribe la suya.">
          <FormulaField id="fl-rate-formula" value={rateFormula} onChange={setRateFormula} disabled={!canEdit} />
        </Field>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Conectar con Activos fijos</p>
          <p className="text-[12px] text-muted-foreground">Si está activo, la depreciación del viaje saldrá del activo fijo del vehículo; si no, se digita.</p>
        </div>
        <Switch checked={linkAssets} onCheckedChange={setLinkAssets} disabled={!canEdit} aria-label="Conectar con Activos fijos" />
      </div>
      <div className="mt-4">
        <p className="text-[13px] font-medium">Comisión por capacidad del vehículo</p>
        <p className="mb-2 text-[12px] text-muted-foreground">Cada fila dice: hasta cuántos galones de capacidad aplica qué porcentaje (por ejemplo, hasta 2000 galones: 12 %). Un vehículo con comisión propia usa la suya.</p>
        <div className="space-y-2">
          {tiers.map((tier, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-muted-foreground">Hasta</span>
              <Input aria-label={`Capacidad del tramo ${index + 1}`} className="w-32" inputMode="decimal" disabled={!canEdit} value={tier.upToGallons} onChange={(event) => setTier(index, 'upToGallons', event.target.value)} />
              <span className="text-[12px] text-muted-foreground">galones →</span>
              <Input aria-label={`Porcentaje del tramo ${index + 1}`} className="w-24" inputMode="decimal" disabled={!canEdit} value={tier.percent} onChange={(event) => setTier(index, 'percent', event.target.value)} />
              <span className="text-[12px] text-muted-foreground">%</span>
              {canEdit && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setTiers((current) => current.filter((_, i) => i !== index))} aria-label={`Quitar tramo ${index + 1}`}><Trash2 className="size-4" /></Button>}
            </div>
          ))}
          {canEdit && <Button type="button" variant="outline" size="sm" onClick={() => setTiers((current) => [...current, { upToGallons: '', percent: '' }])}><Plus className="size-4" aria-hidden="true" />Agregar tramo</Button>}
        </div>
      </div>
    </Panel>
  );
}

function CostFields() {
  const { canPerform } = useAuth();
  const refresh = useFleetRefresh();
  const canCreate = canPerform('FLEET_SETTINGS', 'create');
  const canEdit = canPerform('FLEET_SETTINGS', 'edit');
  const canDelete = canPerform('FLEET_SETTINGS', 'delete');
  const query = useTenantQuery(['fleet', 'cost-fields'], (signal) => flotaService.listCostFields(signal));
  const [draft, setDraft] = useState({ code: '', label: '', kind: 'AMOUNT', formula: '' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const add = async () => {
    setAdding(true); setError('');
    try {
      await flotaService.createCostField({ ...draft, sortOrder: (query.data?.length ?? 0) + 1 });
      setDraft({ code: '', label: '', kind: 'AMOUNT', formula: '' });
      await refresh();
    } catch (e) { setError(errorMessage(e)); } finally { setAdding(false); }
  };
  const patch = async (field: CostFieldDefinition, data: Record<string, unknown>) => {
    try { await flotaService.updateCostField(field.id, data); await refresh(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const remove = async (field: CostFieldDefinition) => {
    try { await flotaService.removeCostField(field.id); await refresh(); } catch (e) { toast.error(errorMessage(e)); }
  };

  const fields = query.data ?? [];
  return (
    <Panel title="Campos de costo del viaje">
      <p className="mb-3 text-[12px] text-muted-foreground">Costos que la empresa quiere ver predefinidos en cada viaje (viático, comisión, depreciación…). El cliente final nunca los ve, salvo que marques «Visible al cliente».</p>
      {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
      <div className="min-w-0 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-left text-[13px]">
          <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-3 py-2">Código</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Fórmula</th><th className="px-3 py-2">Visible al cliente</th><th className="px-3 py-2">Activo</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {fields.length === 0 && !query.isLoading && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Sin campos todavía. Aplica una plantilla o agrega uno.</td></tr>}
            {fields.map((field) => (
              <tr key={field.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-mono text-[12px]">{field.code}</td>
                <td className="px-3 py-2">{field.label}</td>
                <td className="px-3 py-2">{COST_KIND_LABEL[field.kind] ?? field.kind}</td>
                <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{field.formula || '—'}</td>
                <td className="px-3 py-2"><Switch checked={field.visibleToCustomer} disabled={!canEdit} onCheckedChange={(value) => void patch(field, { visibleToCustomer: value })} aria-label={`${field.label}: visible al cliente`} /></td>
                <td className="px-3 py-2"><Switch checked={field.isActive} disabled={!canEdit} onCheckedChange={(value) => void patch(field, { isActive: value })} aria-label={`${field.label}: activo`} /></td>
                <td className="px-3 py-2 text-right">{canDelete && <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => void remove(field)} aria-label={`Eliminar ${field.label}`}><Trash2 className="size-4" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canCreate && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Código" htmlFor="cf-code"><Input id="cf-code" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="VIATICO" /></Field>
          <Field label="Nombre" htmlFor="cf-label"><Input id="cf-label" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} placeholder="Viático del transportista" /></Field>
          <Field label="Tipo" htmlFor="cf-kind">
            <Select value={draft.kind} onValueChange={(value) => setDraft({ ...draft, kind: value })}>
              <SelectTrigger id="cf-kind"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(COST_KIND_LABEL).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Fórmula" htmlFor="cf-formula"><FormulaField id="cf-formula" value={draft.formula} disabled={draft.kind !== 'FORMULA'} onChange={(value) => setDraft({ ...draft, formula: value })} placeholder="costo_diesel * 0.05" /></Field>
          <div className="flex items-end"><Button type="button" className="w-full" onClick={() => void add()} disabled={adding || !draft.code || !draft.label}>{adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" aria-hidden="true" />}Agregar</Button></div>
          {error && <div className="sm:col-span-2 lg:col-span-5"><ErrorState message={error} /></div>}
        </div>
      )}
    </Panel>
  );
}

function Templates() {
  const { canPerform } = useAuth();
  const refresh = useFleetRefresh();
  const canEdit = canPerform('FLEET_SETTINGS', 'edit');
  const query = useTenantQuery(['fleet', 'templates'], (signal) => flotaService.listTemplates(signal));
  const [applying, setApplying] = useState('');
  const apply = async (code: string) => {
    setApplying(code);
    try {
      const result = await flotaService.applyTemplate(code);
      toast.success(`Plantilla aplicada: ${result.createdFields} campo(s) nuevo(s), ${result.skippedFields} ya existían`);
      await refresh();
    } catch (e) { toast.error(errorMessage(e)); } finally { setApplying(''); }
  };
  const templates = query.data ?? [];
  return (
    <Panel title="Plantillas por giro">
      <p className="mb-3 text-[12px] text-muted-foreground">Una plantilla copia a tu empresa los campos de costo y parámetros de arranque de un giro. No pisa lo que ya editaste: solo agrega lo que falta, y se puede volver a aplicar.</p>
      {templates.length === 0 && !query.isLoading && <p className="text-[13px] text-muted-foreground">No hay plantillas disponibles.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <div key={template.id} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-border p-3">
            <div className="min-w-0"><p className="text-[13px] font-medium">{template.name}</p>{template.description && <p className="text-[12px] text-muted-foreground">{template.description}</p>}</div>
            {canEdit && <Button type="button" size="sm" variant="outline" onClick={() => void apply(template.code)} disabled={applying === template.code}>{applying === template.code ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" aria-hidden="true" />}Aplicar</Button>}
          </div>
        ))}
      </div>
    </Panel>
  );
}
