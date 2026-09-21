import { useMemo, useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { SIDEBAR_PERMISSION_PARENT_ORDER, SIDEBAR_PERMISSION_SUBMODULES } from '../../utils/sidebarPermissions';
import { getPermissionActionKeys, type PermissionMatrixAction, PERMISSION_ACTION_DEFINITIONS, SENSITIVE_PERMISSION_ACTION_DEFINITIONS } from '../../utils/permissions';

export type ManagerBranchAccessRule = {
  scopeType: 'BUSINESS_UNIT' | 'BRANCH' | 'GROUP';
  scopeId: string;
  mode: 'FULL' | 'CUSTOM' | 'NONE';
  permissions: Array<Record<string, unknown> & { module: string }>;
};

type ModuleOption = { id: string; label: string; parent: string };

const PARENT_LABELS: Record<string, string> = {
  DASHBOARD: 'Panel principal', SALES: 'Ventas', PURCHASES: 'Compras', RESTAURANT: 'Restaurante',
  TRACKING: 'Logística y tracking', INVENTORY: 'Inventario', FINANCIAL: 'Finanzas', ACCOUNTING: 'Contabilidad',
  REPORTS: 'Reportes', HR: 'Recursos Humanos', ACTIVITIES: 'Actividades', PROJECTS: 'Proyectos',
  FORCE_SALES: 'Fuerza de ventas', TICKETS: 'Tickets', HR_TRAINING: 'Capacitación', SUPPORT_TECH: 'Soporte técnico',
  LEGAL: 'Asesoría legal', FINANCING: 'Financiamiento', NOVACHAT: 'NovaChat', DOCUMENTS: 'Documentos',
  NOTIFICATIONS: 'Notificaciones', MY_COMPANY: 'Mi empresa', CONFIGURATION: 'Configuración',
};

const MODULE_OPTIONS: ModuleOption[] = (() => {
  const parents = SIDEBAR_PERMISSION_PARENT_ORDER.map((id) => ({ id, label: PARENT_LABELS[id] || id, parent: id }));
  const seen = new Set<string>(parents.map((item) => item.id));
  const children = SIDEBAR_PERMISSION_SUBMODULES.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).map((item) => ({ id: item.id, label: item.label, parent: item.parent }));
  return [...parents, ...children];
})();

const ACTION_LABELS = new Map<string, string>([
  ...PERMISSION_ACTION_DEFINITIONS.map(({ key, label }) => [key, label] as const),
  ...SENSITIVE_PERMISSION_ACTION_DEFINITIONS.map(({ key, label }) => [key, label] as const),
]);

function canDelegateBranchModule(module: string) {
  const normalized = String(module || '').toUpperCase();
  return normalized !== 'SUBSCRIPTIONS' && !normalized.startsWith('MANAGER_') && !normalized.startsWith('PLATFORM_');
}

function PermissionMatrix({ permissions, onChange }: {
  permissions: ManagerBranchAccessRule['permissions'];
  onChange: (permissions: ManagerBranchAccessRule['permissions']) => void;
}) {
  const [search, setSearch] = useState('');
  const grouped = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return SIDEBAR_PERMISSION_PARENT_ORDER.map((parent) => ({
      parent,
      label: PARENT_LABELS[parent] || parent,
      modules: MODULE_OPTIONS.filter((module) => canDelegateBranchModule(module.id) && module.parent === parent && (!query || `${module.label} ${module.id}`.toLocaleLowerCase('es').includes(query))),
    })).filter((group) => group.modules.length);
  }, [search]);

  const update = (module: string, action: PermissionMatrixAction, enabled: boolean) => {
    const current = permissions.find((permission) => permission.module === module) || { module };
    const next = { ...current, [action]: enabled };
    const hasAny = getPermissionActionKeys(module).some((key) => next[key] === true);
    const rest = permissions.filter((permission) => permission.module !== module);
    if (!hasAny) {
      onChange(rest);
      return;
    }
    if (action !== 'read' && enabled) next.read = true;
    if (action === 'read' && !enabled && getPermissionActionKeys(module).some((key) => key !== 'read' && next[key] === true)) next.read = true;
    onChange([...rest, next]);
  };

  return <div className="space-y-3 rounded-xl border border-border/60 bg-background p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">Permisos por módulo y acción</p>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar módulo o vista" className="h-8 w-full sm:max-w-64" />
    </div>
    <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
      {grouped.map((group) => <details key={group.parent} className="group rounded-xl border border-border/60" open={Boolean(search)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-bold marker:hidden [&::-webkit-details-marker]:hidden">
          <span>{group.label}</span><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-border/50 p-2">
          {group.modules.map((module) => {
            const permission = permissions.find((item) => item.module === module.id);
            const actions = getPermissionActionKeys(module.id) as readonly PermissionMatrixAction[];
            return <div key={module.id} className="flex flex-col gap-2 rounded-lg bg-muted/30 p-2.5 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0"><p className="text-xs font-bold">{module.label}</p><p className="text-[10px] text-muted-foreground">{module.id}</p></div>
              <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                {actions.map((action) => <label key={action} className="inline-flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                  <input type="checkbox" checked={permission?.[action] === true} onChange={(event) => update(module.id, action, event.target.checked)} className="size-3.5 accent-primary" />
                  <span>{ACTION_LABELS.get(action) || action}</span>
                </label>)}
              </div>
            </div>;
          })}
        </div>
      </details>)}
      {!grouped.length && <p className="py-4 text-center text-xs text-muted-foreground">No hay vistas que coincidan con la búsqueda.</p>}
    </div>
  </div>;
}

function RuleEditor({ rule, label, modeOptions, onChange }: {
  rule: ManagerBranchAccessRule;
  label: string;
  modeOptions: Array<{ value: ManagerBranchAccessRule['mode']; label: string }>;
  onChange: (rule: ManagerBranchAccessRule) => void;
}) {
  return <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0"><p className="truncate text-sm font-bold">{label}</p><p className="text-xs text-muted-foreground">{rule.mode === 'FULL' ? 'Módulos operativos habilitados, sin configuración ni datos sensibles' : rule.mode === 'CUSTOM' ? `${rule.permissions.length} vista(s) configurada(s)` : 'Sin operación en esta sucursal'}</p></div>
      <select aria-label={`Nivel de acceso para ${label}`} value={rule.mode} onChange={(event) => onChange({ ...rule, mode: event.target.value as ManagerBranchAccessRule['mode'], permissions: event.target.value === 'CUSTOM' ? rule.permissions : [] })} className="h-9 w-full shrink-0 rounded-xl border border-border bg-background px-2 text-xs font-bold sm:w-52">
        {modeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
    {rule.mode === 'CUSTOM' && <details className="mt-3 rounded-xl border border-border/50 bg-background p-2">
      <summary className="cursor-pointer list-none text-xs font-bold text-primary marker:hidden [&::-webkit-details-marker]:hidden"><ShieldCheck className="mr-1 inline size-3.5" />Configurar vistas y acciones</summary>
      <div className="mt-3"><PermissionMatrix permissions={rule.permissions} onChange={(permissions) => onChange({ ...rule, permissions })} /></div>
    </details>}
  </div>;
}

export function ManagerBranchAccessEditor({
  scopeMode,
  setScopeMode,
  businessUnitIds,
  setBusinessUnitIds,
  branchIds,
  setBranchIds,
  branchAccess,
  setBranchAccess,
  businessUnits,
  branches,
}: {
  scopeMode: 'BRANCHES' | 'BUSINESS_UNITS';
  setScopeMode: (mode: 'BRANCHES' | 'BUSINESS_UNITS') => void;
  businessUnitIds: string[];
  setBusinessUnitIds: (ids: string[]) => void;
  branchIds: string[];
  setBranchIds: (ids: string[]) => void;
  branchAccess: ManagerBranchAccessRule[];
  setBranchAccess: (rules: ManagerBranchAccessRule[]) => void;
  businessUnits: Array<{ id: string; name: string; isActive?: boolean }>;
  branches: Array<{ id: string; name: string; businessUnitId?: string | null }>;
}) {
  const activeUnits = businessUnits.filter((unit) => unit.isActive !== false);
  const selectedBranches = useMemo(
    () => scopeMode === 'BUSINESS_UNITS'
      ? branches.filter((branch) => businessUnitIds.includes(String(branch.businessUnitId || '')))
      : branches.filter((branch) => branchIds.includes(branch.id)),
    [scopeMode, branches, businessUnitIds, branchIds],
  );
  const selectedUnitSet = useMemo(() => new Set(businessUnitIds), [businessUnitIds]);
  const setRule = (rule: ManagerBranchAccessRule) => setBranchAccess([
    ...branchAccess.filter((candidate) => !(candidate.scopeType === rule.scopeType && candidate.scopeId === rule.scopeId)),
    rule,
  ]);
  const getRule = (scopeType: ManagerBranchAccessRule['scopeType'], scopeId: string): ManagerBranchAccessRule =>
    branchAccess.find((candidate) => candidate.scopeType === scopeType && candidate.scopeId === scopeId)
      || { scopeType, scopeId, mode: 'CUSTOM', permissions: [] };

  const toggleBranch = (branchId: string) => {
    const exists = branchIds.includes(branchId);
    setBranchIds(exists ? branchIds.filter((id) => id !== branchId) : [...branchIds, branchId]);
    if (exists) setBranchAccess(branchAccess.filter((rule) => !(rule.scopeType === 'BRANCH' && rule.scopeId === branchId)));
    else setRule({ scopeType: 'BRANCH', scopeId: branchId, mode: 'CUSTOM', permissions: [] });
  };
  const toggleUnit = (unitId: string) => {
    const exists = selectedUnitSet.has(unitId);
    setBusinessUnitIds(exists ? businessUnitIds.filter((id) => id !== unitId) : [...businessUnitIds, unitId]);
    if (exists) {
      const branchIdsInUnit = new Set(branches.filter((branch) => branch.businessUnitId === unitId).map((branch) => branch.id));
      setBranchAccess(branchAccess.filter((rule) => !(rule.scopeType === 'BUSINESS_UNIT' && rule.scopeId === unitId) && !(rule.scopeType === 'BRANCH' && branchIdsInUnit.has(rule.scopeId))));
    } else setRule({ scopeType: 'BUSINESS_UNIT', scopeId: unitId, mode: 'CUSTOM', permissions: [] });
  };

  return <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/15 p-4">
    <div><p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alcance y operación de sucursales</p><p className="mt-1 text-xs text-muted-foreground">Elige una lista fija de sucursales o una plantilla por rubro que también se aplicará a sucursales futuras.</p></div>
    <label className="block space-y-1.5 text-xs font-bold"><span>Alcance geográfico</span><select value={scopeMode} onChange={(event) => { const next = event.target.value as 'BRANCHES' | 'BUSINESS_UNITS'; setScopeMode(next); setBusinessUnitIds([]); setBranchIds([]); setBranchAccess([]); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
      <option value="BRANCHES">Sucursales específicas</option><option value="BUSINESS_UNITS">Rubros (sucursales actuales y futuras)</option>
    </select></label>

    {scopeMode === 'BUSINESS_UNITS' ? <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {activeUnits.map((unit) => <label key={unit.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background p-3 text-sm"><input type="checkbox" checked={selectedUnitSet.has(unit.id)} onChange={() => toggleUnit(unit.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 truncate">{unit.name}</span></label>)}
        {!activeUnits.length && <p className="text-sm text-muted-foreground">El grupo todavía no tiene rubros.</p>}
      </div>
      <div className="space-y-2">
        {activeUnits.filter((unit) => selectedUnitSet.has(unit.id)).map((unit) => <div key={unit.id} className="space-y-2 rounded-2xl border border-border/60 bg-background p-3">
          <RuleEditor label={`Regla base · ${unit.name}`} rule={getRule('BUSINESS_UNIT', unit.id)} modeOptions={[{ value: 'FULL', label: 'Completo en módulos operativos' }, { value: 'CUSTOM', label: 'Personalizado por vista/acción' }]} onChange={setRule} />
          <details className="rounded-xl border border-border/50 p-3">
            <summary className="cursor-pointer text-xs font-bold">Excepciones por sucursal ({branches.filter((branch) => branch.businessUnitId === unit.id).length})</summary>
            <div className="mt-3 space-y-2">{branches.filter((branch) => branch.businessUnitId === unit.id).map((branch) => {
              const override = branchAccess.find((rule) => rule.scopeType === 'BRANCH' && rule.scopeId === branch.id);
              return <div key={branch.id} className="space-y-2">
                <label className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 px-3 py-2 text-xs"><span className="min-w-0 truncate font-semibold">{branch.name}</span><select aria-label={`Excepción para ${branch.name}`} value={override?.mode || 'INHERIT'} onChange={(event) => {
                  if (event.target.value === 'INHERIT') setBranchAccess(branchAccess.filter((rule) => !(rule.scopeType === 'BRANCH' && rule.scopeId === branch.id)));
                  else setRule({ scopeType: 'BRANCH', scopeId: branch.id, mode: event.target.value as ManagerBranchAccessRule['mode'], permissions: override?.permissions || [] });
                }} className="h-8 max-w-52 rounded-lg border border-border bg-background px-2"><option value="INHERIT">Heredar rubro</option><option value="NONE">Sin acceso operativo</option><option value="FULL">Completo operativo</option><option value="CUSTOM">Personalizado</option></select></label>
                {override?.mode === 'CUSTOM' && <RuleEditor label={`Excepción · ${branch.name}`} rule={override} modeOptions={[{ value: 'CUSTOM', label: 'Personalizado por vista/acción' }, { value: 'FULL', label: 'Completo operativo' }, { value: 'NONE', label: 'Sin acceso' }]} onChange={setRule} />}
              </div>;
            })}</div>
          </details>
        </div>)}
      </div>
    </> : <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((branch) => <label key={branch.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background p-3 text-sm"><input type="checkbox" checked={branchIds.includes(branch.id)} onChange={() => toggleBranch(branch.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 truncate">{branch.name}</span><Badge variant="outline" className="ml-auto shrink-0 text-[10px]">{businessUnits.find((unit) => unit.id === branch.businessUnitId)?.name || 'Rubro'}</Badge></label>)}
        {!branches.length && <p className="text-sm text-muted-foreground">No hay sucursales activas.</p>}
      </div>
      <div className="space-y-2">{selectedBranches.map((branch) => <RuleEditor key={branch.id} label={branch.name} rule={getRule('BRANCH', branch.id)} modeOptions={[{ value: 'FULL', label: 'Completo en módulos operativos' }, { value: 'CUSTOM', label: 'Personalizado por vista/acción' }, { value: 'NONE', label: 'Sin acceso operativo' }]} onChange={setRule} />)}</div>
    </>}
  </div>;
}
