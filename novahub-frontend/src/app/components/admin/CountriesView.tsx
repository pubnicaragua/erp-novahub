import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Loader2, Search, ChevronDown, ChevronRight,
  Save, DollarSign, Percent, Building2,
  Phone, FileText, Users, Scale, BarChart3,
  ShoppingBag, ShoppingCart, BookOpen, Settings, Package,
  HandCoins, MessageCircle, ShieldCheck,
  ExternalLink, FileDown, LayoutList, Eye,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import {
  countryConfigService, COUNTRY_FLAGS, getImpactByCountry,
  type CountryConfig, type ImpactModule, type ImpactSubmodule
} from '../../services/country-config.service';

interface PlanInfo { id: string; name: string; price: number; modules: string; desc: string; features: string[]; popular?: boolean }
const PLANES_DATA: PlanInfo[] = [
  { id: 'emprendedor', name: 'Emprendedor', price: 920, modules: 'Hasta 6 módulos', desc: 'Para negocios en etapa inicial que están comenzando su transformación digital.', features: ['Hasta 6 módulos del ERP', 'Soporte por ticket', 'Actualizaciones incluidas', 'Respaldos automáticos'], popular: false },
  { id: 'pyme', name: 'PYME', price: 1300, modules: 'Módulos ilimitados', desc: 'Para pequeñas y medianas empresas que necesitan toda la potencia del ERP.', features: ['Módulos ilimitados', 'Soporte prioritario', 'DTE / Facturación electrónica', 'Múltiples sucursales', 'API de integraciones'], popular: true },
  { id: 'corporativo', name: 'Corporativo', price: 1900, modules: 'Todo incluido', desc: 'Para empresas consolidadas que requieren capacidad empresarial completa.', features: ['Todo lo de PYME', 'SLA garantizado', 'Usuario ilimitados', 'On-premise opcional', 'Capacitación presencial', 'Gerente de cuenta dedicado'], popular: false },
];

const CATEGORY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  currency: { label: 'Moneda', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: DollarSign },
  tax: { label: 'Impuestos', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: Percent },
  document: { label: 'Documentos', color: 'text-blue-600 bg-blue-50 border-blue-200', icon: FileText },
  format: { label: 'Formatos', color: 'text-violet-600 bg-violet-50 border-violet-200', icon: LayoutList },
  validation: { label: 'Validaciones', color: 'text-orange-600 bg-orange-50 border-orange-200', icon: ShieldCheck },
  integration: { label: 'Integraciones', color: 'text-cyan-600 bg-cyan-50 border-cyan-200', icon: ExternalLink },
  ui: { label: 'Interfaz', color: 'text-sky-600 bg-sky-50 border-sky-200', icon: Eye },
  template: { label: 'Plantillas', color: 'text-rose-600 bg-rose-50 border-rose-200', icon: FileDown },
};

export function CountriesView() {
  const [countries, setCountries] = useState<CountryConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CountryConfig | null>(null);
  const [search, setSearch] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await countryConfigService.list();
      setCountries(res?.data || res || []);
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al cargar países'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetch();
    };
    load();
  }, []);

  const filtered = countries.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              Super Admin
            </Badge>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight sm:text-3xl">
                Configuración por <span className="text-primary">País</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Gestioná las configuraciones fiscales, monetarias, laborales y templates
                para cada país. Estos valores definen cómo opera el ERP en cada jurisdicción.
              </p>
            </div>
          </div>
          <div className="flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Globe className="size-10 text-primary" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar país..." className="pl-9 h-10 rounded-xl" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((country) => (
            <CountryCard
              key={country.code}
              country={country}
              isSelected={selected?.code === country.code}
              onSelect={() => setSelected(selected?.code === country.code ? null : country)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <CountryDetail country={selected} onRefresh={fetch} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CountryCard({ country, isSelected, onSelect }: { country: CountryConfig; isSelected: boolean; onSelect: () => void }) {
  return (
    <Card className={cn('cursor-pointer transition-all border-border/50 hover:border-primary/50', isSelected && 'ring-2 ring-primary/30 border-primary')} onClick={onSelect}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{COUNTRY_FLAGS[country.code] || '\u{1F310}'}</div>
            <div>
              <h3 className="font-black text-sm">{country.name}</h3>
              <span className="text-[10px] font-mono text-muted-foreground">{country.code}</span>
            </div>
          </div>
          <Badge variant="outline" className={cn('text-[10px]', country.isActive ? 'border-emerald-200 text-emerald-600' : 'border-gray-200 text-gray-400')}>
            {country.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground"><DollarSign className="size-3" /> {country.currencyCode} ({country.currencySymbol})</div>
          <div className="flex items-center gap-1.5 text-muted-foreground"><Percent className="size-3" /> {country.ivaLabel} {country.ivaRate}%</div>
          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2 truncate"><Building2 className="size-3 shrink-0" /> {country.taxAuthName}</div>
          <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="size-3" /> +{country.phoneCode}</div>
          <div className="flex items-center gap-1.5 text-muted-foreground"><FileText className="size-3" /> {country.taxIdLabel}</div>
        </div>
      </CardContent>
    </Card>
  );
}

type ChangeStatus = 'pending' | 'in-progress' | 'done';

const STATUS_META: Record<ChangeStatus, { label: string; color: string; icon: string; order: number }> = {
  pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600 border-gray-300', icon: '○', order: 0 },
  'in-progress': { label: 'En Progreso', color: 'bg-amber-100 text-amber-700 border-amber-300', icon: '◐', order: 1 },
  done: { label: 'Implementado', color: 'bg-emerald-100 text-emerald-700 border-emerald-300', icon: '●', order: 2 },
};

const STORAGE_KEY = (code: string) => `nova-impact-${code}`;

function loadStatuses(code: string): Record<string, ChangeStatus> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(code)) || '{}'); } catch { return {}; }
}

function CountryDetail({ country, onRefresh }: { country: CountryConfig; onRefresh: () => void }) {
  const [form, setForm] = useState<CountryConfig>(country);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('impacto');
  const [statuses, setStatuses] = useState<Record<string, ChangeStatus>>(() => loadStatuses(country.code));
  const [impactFilter, setImpactFilter] = useState<ChangeStatus | 'all'>('all');
  const impact = getImpactByCountry(form);

  const handleChange = (field: string, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const cycleStatus = (key: string) => {
    setStatuses((prev) => {
      const cur: ChangeStatus = prev[key] || 'pending';
      const next: ChangeStatus = cur === 'pending' ? 'in-progress' : cur === 'in-progress' ? 'done' : 'pending';
      const updated = { ...prev, [key]: next };
      localStorage.setItem(STORAGE_KEY(form.code), JSON.stringify(updated));
      return updated;
    });
  };

  const flatChanges = impact.flatMap((mod) =>
    mod.submodules.flatMap((sm) => [
      ...sm.views.map((v) => ({ key: `${mod.module}/${sm.submodule}/${v.view}`, desc: v.description })),
      ...(sm.templates || []).map((t) => ({ key: `${mod.module}/${sm.submodule}/t:${t.name}`, desc: t.name })),
    ])
  );
  const totalChanges = flatChanges.length;
  const doneCount = flatChanges.filter((c) => (statuses[c.key] || 'pending') === 'done').length;
  const inProgCount = flatChanges.filter((c) => (statuses[c.key] || 'pending') === 'in-progress').length;
  const pctDone = totalChanges > 0 ? Math.round((doneCount / totalChanges) * 100) : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await countryConfigService.update(form.code, form);
      toast.success(`${form.name} actualizado`);
      onRefresh();
    } catch (e: any) { toast.error(e?.response?.data?.message || e?.message || 'Error al guardar configuración del país'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-4 [&>button]:flex-none">
          <TabsTrigger value="impacto"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
            <BarChart3 className="size-4" /> Checklist Impacto
          </TabsTrigger>
          <TabsTrigger value="config"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
            <Settings className="size-4" /> Gral
          </TabsTrigger>
          <TabsTrigger value="fiscal"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
            <Percent className="size-4" /> Fiscal
          </TabsTrigger>
          <TabsTrigger value="payroll"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
            <Users className="size-4" /> Nóminas
          </TabsTrigger>
          <TabsTrigger value="planes"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">
            <Package className="size-4" /> Planes
          </TabsTrigger>
        </TabsList>

        {/* ════════ IMPACTO TAB ════════ */}
        <TabsContent value="impacto" className="space-y-6 mt-0">
          {/* Summary dashboard */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/[0.02]">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Checklist de Implementación — <span className="text-primary">{form.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Hacé clic en cada ítem para marcar su estado. El progreso se guarda automáticamente.
                    {form.code === 'CL' && (
                      <span className="block mt-1 text-rose-600 font-medium">Chile requiere DTE (Documento Tributario Electrónico) obligatorio ante SII.</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black tabular-nums">{pctDone}%</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">completado</div>
                </div>
              </div>
              {/* progress bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${pctDone}%` }} />
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">{totalChanges} cambios totales</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> {doneCount} implementados</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-amber-500" /> {inProgCount} en progreso</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-gray-300" /> {totalChanges - doneCount - inProgCount} pendientes</span>
              </div>
            </CardContent>
          </Card>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'pending', 'in-progress', 'done'] as const).map((f) => {
              const count = f === 'all' ? totalChanges : f === 'done' ? doneCount : f === 'in-progress' ? inProgCount : totalChanges - doneCount - inProgCount;
              return (
                <button key={f} onClick={() => setImpactFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all',
                    impactFilter === f ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  )}>
                  {f === 'all' ? 'Todo' : STATUS_META[f].label} ({count})
                </button>
              );
            })}
          </div>

          {impact.map((mod) => (
            <ModuleImpactCard
              key={mod.module} module={mod}
              statuses={statuses} cycleStatus={cycleStatus}
              impactFilter={impactFilter}
            />
          ))}
        </TabsContent>

        {/* ════════ CONFIG TAB ════════ */}
        <TabsContent value="config">
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{COUNTRY_FLAGS[form.code] || '\u{1F310}'}</span>
                  <h3 className="text-xl font-black">{form.name}</h3>
                  <Badge variant="outline" className="text-[10px]">{form.code}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={form.isActive} onCheckedChange={(v) => handleChange('isActive', v)} />
                    Activo
                  </label>
                  <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2 text-xs font-bold h-9">
                    {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />} Guardar
                  </Button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Código" value={form.code} disabled />
                <Field label="Nombre" value={form.name} onChange={(v) => handleChange('name', v)} />
                <Field label="Moneda" value={form.currencyCode} onChange={(v) => handleChange('currencyCode', v)} />
                <Field label="Símbolo" value={form.currencySymbol} onChange={(v) => handleChange('currencySymbol', v)} />
                <Field label="Código Telefónico" value={form.phoneCode} prefix="+" onChange={(v) => handleChange('phoneCode', v)} />
                <Field label="Locale" value={form.locale} onChange={(v) => handleChange('locale', v)} />
                <Field label="Formato Fecha" value={form.dateFormat} onChange={(v) => handleChange('dateFormat', v)} />
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Sin centavos</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={!form.usesCentavos} onCheckedChange={(v) => handleChange('usesCentavos', !v)} />
                    <span className="text-xs text-muted-foreground">{form.usesCentavos ? 'Usa centavos' : 'Redondeo al entero'}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Unidad de Fomento</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch checked={form.usesUf} onCheckedChange={(v) => handleChange('usesUf', v)} />
                    {form.usesUf && (
                      <Input value={form.ufName || ''} onChange={(e) => handleChange('ufName', e.target.value)} placeholder="UF" className="h-8 text-xs flex-1 max-w-[200px] rounded-xl" />
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ FISCAL TAB ════════ */}
        <TabsContent value="fiscal">
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Field label="Nombre IVA" value={form.ivaLabel} onChange={(v) => handleChange('ivaLabel', v)} />
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-black tracking-widest">Tasa IVA (%)</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={form.ivaRate} onChange={(e) => handleChange('ivaRate', Number(e.target.value))} className="h-10 rounded-xl" />
                </div>
                <Field label="Autoridad Tributaria" value={form.taxAuthName} onChange={(v) => handleChange('taxAuthName', v)} />
                <Field label="ID Tributario" value={form.taxIdLabel} onChange={(v) => handleChange('taxIdLabel', v)} />
                <Field label="Impuesto Renta" value={form.incomeTaxLabel} onChange={(v) => handleChange('incomeTaxLabel', v)} />
                <Field label="Seguridad Social" value={form.socialSecurityLabel} onChange={(v) => handleChange('socialSecurityLabel', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ PAYROLL TAB ════════ */}
        <TabsContent value="payroll">
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-6">
              <p className="text-xs text-muted-foreground">Valores en blanco = el concepto no aplica en este país.</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FieldNumber label="Aporte empleado (%)" value={form.inssLaboralPct} onChange={(v) => handleChange('inssLaboralPct', v)} placeholder="No aplica" />
                <FieldNumber label="Aporte empleador (%)" value={form.inssPatronalPct} onChange={(v) => handleChange('inssPatronalPct', v)} placeholder="No aplica" />
                <FieldNumber label="INATEC / Capacitación (%)" value={form.inatecPct} onChange={(v) => handleChange('inatecPct', v)} placeholder="No aplica" />
                <FieldNumber label="Treceavo / Aguinaldo (%)" value={form.trecenoMesPct} onChange={(v) => handleChange('trecenoMesPct', v)} placeholder="No aplica" />
                <FieldNumber label="Vacaciones (%)" value={form.vacacionesPct} onChange={(v) => handleChange('vacacionesPct', v)} placeholder="No aplica" />
                <FieldNumber label="Indemnización (%)" value={form.indemnizacionPct} onChange={(v) => handleChange('indemnizacionPct', v)} placeholder="No aplica" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ════════ PLANES TAB ════════ */}
        <TabsContent value="planes" className="space-y-6 mt-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Planes de Suscripción — <span className="text-primary">{form.name}</span></h3>
              <p className="text-xs text-muted-foreground mt-1">Precios anuales en USD. Todos los planes incluyen hosting, actualizaciones y soporte.</p>
            </div>
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary text-[10px]">USD</Badge>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANES_DATA.map((plan) => (
              <Card key={plan.id} className={cn(
                'relative border-border/50 overflow-hidden transition-all',
                plan.popular && 'ring-2 ring-primary/30 border-primary shadow-lg shadow-primary/5',
              )}>
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-primary text-primary-foreground text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">Recomendado</div>
                  </div>
                )}
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'flex size-10 items-center justify-center rounded-xl text-sm font-black',
                      plan.popular ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                    )}>
                      {plan.id === 'emprendedor' ? 'E' : plan.id === 'pyme' ? 'P' : 'C'}
                    </div>
                    <div>
                      <h4 className="font-black text-sm">{plan.name}</h4>
                      <p className="text-[10px] text-muted-foreground">{plan.modules}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black">${plan.price}</span>
                    <span className="text-xs text-muted-foreground">/año</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{plan.desc}</p>
                  <ul className="space-y-1.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <svg className="size-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground text-center pt-2">
            * Los precios no incluyen impuestos aplicables. Facturación anual. Aplican términos y condiciones.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── MODULE IMPACT CARD (expanded, with progress) ─────────────────

function ModuleImpactCard({
  module: mod, statuses, cycleStatus, impactFilter,
}: {
  module: ImpactModule; statuses: Record<string, ChangeStatus>; cycleStatus: (k: string) => void;
  impactFilter: ChangeStatus | 'all';
}) {
  const [expanded, setExpanded] = useState(false);

  const allChanges = mod.submodules.flatMap((sm) => [
    ...sm.views.map((v) => ({ key: `${mod.module}/${sm.submodule}/${v.view}`, desc: v.description })),
    ...(sm.templates || []).map((t) => ({ key: `${mod.module}/${sm.submodule}/t:${t.name}`, desc: t.name })),
  ]);

  const done = allChanges.filter((c) => (statuses[c.key] || 'pending') === 'done').length;
  const inProg = allChanges.filter((c) => (statuses[c.key] || 'pending') === 'in-progress').length;
  const total = allChanges.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const filteredSubmodules = mod.submodules
    .map((sm) => {
      const smChanges = [
        ...sm.views.map((v) => ({ key: `${mod.module}/${sm.submodule}/${v.view}`, status: statuses[`${mod.module}/${sm.submodule}/${v.view}`] || 'pending' })),
        ...(sm.templates || []).map((t) => ({ key: `${mod.module}/${sm.submodule}/t:${t.name}`, status: statuses[`${mod.module}/${sm.submodule}/t:${t.name}`] || 'pending' })),
      ];
      return { sm, visible: impactFilter === 'all' ? true : smChanges.some((c) => c.status === impactFilter) };
    })
    .filter(({ visible }) => visible);

  if (filteredSubmodules.length === 0 && impactFilter !== 'all') return null;

  return (
    <Card className={cn('border-border/50 overflow-hidden transition-all', impactFilter !== 'all' && filteredSubmodules.length === 0 && 'hidden')}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left">
        <CardContent className="p-4 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <ModuleIcon moduleId={mod.module} />
            <div className="min-w-0">
              <h4 className="text-sm font-black flex items-center gap-2">
                {mod.label}
                <span className="text-[10px] font-normal text-muted-foreground/60">{done}/{total}</span>
              </h4>
              <div className="flex items-center gap-3 mt-1">
                <div className="h-1.5 flex-1 min-w-[80px] max-w-[160px] bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-emerald-500" /><span className="text-[9px] text-muted-foreground">{done}</span></span>
                <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-amber-500" /><span className="text-[9px] text-muted-foreground">{inProg}</span></span>
                <span className="flex items-center gap-0.5"><span className="size-1.5 rounded-full bg-gray-300" /><span className="text-[9px] text-muted-foreground">{total - done - inProg}</span></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          </div>
        </CardContent>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
              {mod.submodules.map((sm) => {
                const allKeys = [
                  ...sm.views.map((v) => `${mod.module}/${sm.submodule}/${v.view}`),
                  ...(sm.templates || []).map((t) => `${mod.module}/${sm.submodule}/t:${t.name}`),
                ];
                const hasVisible = impactFilter === 'all' || allKeys.some((k) => (statuses[k] || 'pending') === impactFilter);
                if (!hasVisible) return null;
                return (
                  <InteractiveSubmoduleSection
                    key={sm.submodule} submodule={sm}
                    moduleId={mod.module} statuses={statuses} cycleStatus={cycleStatus}
                    impactFilter={impactFilter}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ─── INTERACTIVE SUBMODULE SECTION ─────────────────────────────────

function InteractiveSubmoduleSection({
  submodule, moduleId, statuses, cycleStatus, impactFilter,
}: {
  submodule: ImpactSubmodule; moduleId: string;
  statuses: Record<string, ChangeStatus>; cycleStatus: (k: string) => void;
  impactFilter: ChangeStatus | 'all';
}) {
  const filteredViews = submodule.views.filter((v) => {
    if (impactFilter === 'all') return true;
    const k = `${moduleId}/${submodule.submodule}/${v.view}`;
    return (statuses[k] || 'pending') === impactFilter;
  });
  const filteredTemplates = (submodule.templates || []).filter((t) => {
    if (impactFilter === 'all') return true;
    const k = `${moduleId}/${submodule.submodule}/t:${t.name}`;
    return (statuses[k] || 'pending') === impactFilter;
  });

  if (filteredViews.length === 0 && filteredTemplates.length === 0) return null;

  return (
    <div>
      <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-primary/50" />
        {submodule.submodule}
        <span className="text-[9px] font-normal text-muted-foreground/60">({submodule.views.length} vistas)</span>
      </h5>

      {/* Views as clickable rows */}
      <div className="space-y-1 mb-3">
        {filteredViews.map((v, i) => {
          const meta = CATEGORY_META[v.category] || CATEGORY_META.ui;
          const Icon = meta.icon;
          const key = `${moduleId}/${submodule.submodule}/${v.view}`;
          const status = statuses[key] || 'pending';
          return (
            <div key={i}
              onClick={() => cycleStatus(key)}
              className={cn(
                'flex items-center gap-2 text-xs p-2 rounded-xl cursor-pointer transition-all select-none',
                'hover:bg-muted/30 border border-transparent hover:border-border/40',
                status === 'done' && 'bg-emerald-50/40 border-emerald-200/30',
                status === 'in-progress' && 'bg-amber-50/40 border-amber-200/30',
              )}>
              <Badge variant="outline" className={cn('text-[8px] px-1.5 py-0 h-4 shrink-0 gap-1 font-bold uppercase', meta.color)}>
                <Icon className="size-2.5" /> {meta.label}
              </Badge>
              <span className="flex-1 text-muted-foreground">{v.description}</span>
              <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-4 font-mono bg-muted/20 shrink-0">{v.view}</Badge>
              <StatusBadge status={status} />
            </div>
          );
        })}
      </div>

      {/* Interactive Templates */}
      {filteredTemplates.length > 0 && (
        <div className="rounded-xl border border-rose-200/30 bg-rose-50/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-rose-600 mb-2">
            <FileDown className="size-3" />
            Templates / Formatos obligatorios
          </div>
          {filteredTemplates.map((t, i) => {
            const key = `${moduleId}/${submodule.submodule}/t:${t.name}`;
            const status = statuses[key] || 'pending';
            return (
              <div key={i}
                onClick={() => cycleStatus(key)}
                className={cn(
                  'grid grid-cols-[1fr_auto] gap-2 text-xs items-start py-2 px-2 rounded-xl cursor-pointer transition-all select-none border border-transparent',
                  'hover:bg-muted/20',
                  status === 'done' && 'bg-emerald-50/40 border-emerald-200/30',
                  status === 'in-progress' && 'bg-amber-50/40 border-amber-200/30',
                )}>
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={status} />
                  <div>
                    <span className="font-bold text-foreground text-xs">{t.name}</span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.description}</p>
                    {t.mandatory && <Badge className="bg-rose-500/10 text-rose-600 border-rose-200 text-[8px] mt-1">Obligatorio</Badge>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-[8px] bg-rose-500/5 border-rose-200/50">{t.format}</Badge>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{t.authority} · {t.periodicity}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── STATUS BADGE ──────────────────────────────────────────────────

function StatusBadge({ status, onClick }: { status: ChangeStatus; onClick?: () => void }) {
  const m = STATUS_META[status];
  return (
    <span onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider cursor-pointer transition-all shrink-0',
        m.color,
        onClick && 'hover:ring-2 hover:ring-offset-1',
      )}>
      <span className="text-xs leading-none">{m.icon}</span>
      {m.label}
    </span>
  );
}

// ─── HELPERS ───────────────────────────────────────────────────────

const MODULE_ICONS: Record<string, React.ElementType> = {
  ventas: ShoppingBag, compras: ShoppingCart, inventario: Package,
  contabilidad: BookOpen, rh: Users, 'asesoria-legal': Scale,
  finanzas: DollarSign, reportes: BarChart3, plataforma: Settings,
  financiamiento: HandCoins, novachat: MessageCircle,
};

function ModuleIcon({ moduleId }: { moduleId: string }) {
  const Icon = MODULE_ICONS[moduleId] || FileText;
  return (
    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="size-4.5" />
    </div>
  );
}

function Field({ label, value, onChange, disabled, prefix }: { label: string; value: string; onChange?: (v: string) => void; disabled?: boolean; prefix?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase font-black tracking-widest">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
        <Input value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} className={cn('h-10 rounded-xl', prefix && 'pl-8')} />
      </div>
    </div>
  );
}

function FieldNumber({ label, value, onChange, placeholder }: { label: string; value?: number | null; onChange: (v?: number) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase font-black tracking-widest">{label}</Label>
      <Input type="number" step="0.01" min="0" max="100" value={value ?? ''} placeholder={placeholder || '0'}
        onChange={(e) => { const v = e.target.value; onChange(v === '' ? undefined : Number(v)); }}
        className={cn('h-10 rounded-xl', value === null && 'text-muted-foreground italic')} />
    </div>
  );
}
