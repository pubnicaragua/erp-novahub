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
export type ManagerBranchScopeRule = {
  businessUnitId: string;
  branchMode: 'ALL_CURRENT_AND_FUTURE' | 'SELECTED_BRANCHES';
  branchIds?: string[];
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
      <div className="min-w-0"><p className="truncate text-sm font-bold">{label}</p><p className="text-xs text-muted-foreground">{rule.mode === 'FULL' ? 'Módulos operativos habilitados, sin configuración ni datos sensibles' : rule.mode === 'CUSTOM' ? `${rule.permissions.length} vista(s) configurada(s)` : 'Sin acceso operativo'}</p></div>
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
  scopeRules,
  setScopeRules,
  branchAccess,
  setBranchAccess,
  businessUnits,
  branches,
}: {
  scopeRules: ManagerBranchScopeRule[];
  setScopeRules: (rules: ManagerBranchScopeRule[]) => void;
  branchAccess: ManagerBranchAccessRule[];
  setBranchAccess: (rules: ManagerBranchAccessRule[]) => void;
  businessUnits: Array<{ id: string; name: string; isActive?: boolean }>;
  branches: Array<{ id: string; name: string; businessUnitId?: string | null }>;
}) {
  const activeUnits = businessUnits.filter((unit) => unit.isActive !== false);
  const selectedUnitSet = useMemo(() => new Set(scopeRules.map((rule) => rule.businessUnitId)), [scopeRules]);
  const setRule = (rule: ManagerBranchAccessRule) => setBranchAccess([
    ...branchAccess.filter((candidate) => !(candidate.scopeType === rule.scopeType && candidate.scopeId === rule.scopeId)),
    rule,
  ]);
  const getRule = (scopeType: ManagerBranchAccessRule['scopeType'], scopeId: string): ManagerBranchAccessRule =>
    branchAccess.find((candidate) => candidate.scopeType === scopeType && candidate.scopeId === scopeId)
      || { scopeType, scopeId, mode: scopeType === 'BUSINESS_UNIT' ? 'NONE' : 'CUSTOM', permissions: [] };

  const branchesForUnit = (unitId: string) => branches.filter((branch) => String(branch.businessUnitId || '') === unitId);
  const branchesInScope = (scope: ManagerBranchScopeRule) => scope.branchMode === 'ALL_CURRENT_AND_FUTURE'
    ? branchesForUnit(scope.businessUnitId)
    : branchesForUnit(scope.businessUnitId).filter((branch) => (scope.branchIds || []).includes(branch.id));

  const toggleUnit = (unitId: string) => {
    const current = scopeRules.find((rule) => rule.businessUnitId === unitId);
    if (current) {
      const branchIdsInUnit = new Set([...branchesForUnit(unitId).map((branch) => branch.id), ...(current.branchIds || [])]);
      setScopeRules(scopeRules.filter((rule) => rule.businessUnitId !== unitId));
      setBranchAccess(branchAccess.filter((rule) => !(rule.scopeType === 'BUSINESS_UNIT' && rule.scopeId === unitId) && !(rule.scopeType === 'BRANCH' && branchIdsInUnit.has(rule.scopeId))));
      return;
    }
    const currentBranchIds = branchesForUnit(unitId).map((branch) => branch.id);
    setScopeRules([...scopeRules, { businessUnitId: unitId, branchMode: 'SELECTED_BRANCHES', branchIds: currentBranchIds }]);
    if (!branchAccess.some((rule) => rule.scopeType === 'BUSINESS_UNIT' && rule.scopeId === unitId)) {
      setRule({ scopeType: 'BUSINESS_UNIT', scopeId: unitId, mode: 'CUSTOM', permissions: [] });
    }
  };

  const updateScopeRule = (next: ManagerBranchScopeRule) => {
    setScopeRules(scopeRules.map((rule) => rule.businessUnitId === next.businessUnitId ? next : rule));
  };

  const setBranchMode = (scope: ManagerBranchScopeRule, mode: ManagerBranchScopeRule['branchMode']) => {
    if (mode === 'ALL_CURRENT_AND_FUTURE') {
      const { branchIds: _branchIds, ...next } = scope;
      updateScopeRule({ ...next, branchMode: mode });
      return;
    }
    updateScopeRule({ ...scope, branchMode: mode, branchIds: branchesForUnit(scope.businessUnitId).map((branch) => branch.id) });
  };

  const toggleScopedBranch = (scope: ManagerBranchScopeRule, branchId: string) => {
    const current = scope.branchIds || [];
    const branchIds = current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId];
    updateScopeRule({ ...scope, branchMode: 'SELECTED_BRANCHES', branchIds });
  };

  const selectedBranchCount = scopeRules.reduce((count, scope) => count + (scope.branchMode === 'ALL_CURRENT_AND_FUTURE' ? branchesForUnit(scope.businessUnitId).length : (scope.branchIds || []).length), 0);
  const operationalModes = [{ value: 'FULL' as const, label: 'Completo en módulos operativos' }, { value: 'CUSTOM' as const, label: 'Personalizado por módulo y acción' }, { value: 'NONE' as const, label: 'Sin acceso operativo' }];

  return <div className="space-y-4">
    <details open className="group rounded-2xl border border-border/60 bg-muted/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0"><span className="block text-xs font-black uppercase tracking-widest">Alcance por rubro</span><span className="mt-1 block text-xs text-muted-foreground">{scopeRules.length} rubro(s), {selectedBranchCount} sucursal(es) actuales visibles</span></span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-border/50 p-4">
        <p className="text-xs text-muted-foreground">Define qué sucursales puede consultar en los módulos Manager. Esto no determina si puede operar dentro de ellas.</p>
        {activeUnits.map((unit) => {
          const scope = scopeRules.find((rule) => rule.businessUnitId === unit.id);
          const currentBranches = branchesForUnit(unit.id);
          const scopeSummary = !scope ? 'Sin acceso' : scope.branchMode === 'ALL_CURRENT_AND_FUTURE'
            ? `${currentBranches.length} actual(es) y futuras`
            : `${(scope.branchIds || []).length} sucursal(es) fija(s)`;
          return <details key={unit.id} className="group rounded-xl border border-border/60 bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{unit.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{scopeSummary}</span></span>
              <span className="flex shrink-0 items-center gap-2"><Badge variant={scope ? 'default' : 'outline'}>{scope ? 'Incluido' : 'No incluido'}</Badge><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
            </summary>
            <div className="space-y-3 border-t border-border/50 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={Boolean(scope)} onChange={() => toggleUnit(unit.id)} className="size-4 accent-primary" /><span>Incluir este rubro en su alcance</span></label>
              {scope && <>
                <label className="block space-y-1.5 text-xs font-bold"><span>Sucursales que puede consultar</span><select value={scope.branchMode} onChange={(event) => setBranchMode(scope, event.target.value as ManagerBranchScopeRule['branchMode'])} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm">
                  <option value="ALL_CURRENT_AND_FUTURE">Todas las actuales y futuras</option><option value="SELECTED_BRANCHES">Solo sucursales seleccionadas</option>
                </select></label>
                {scope.branchMode === 'SELECTED_BRANCHES' && <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold">Sucursales actuales incluidas</p><Badge variant="outline">{(scope.branchIds || []).length}</Badge></div>
                  {currentBranches.length ? <div className="grid min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2">{currentBranches.map((branch) => <label key={branch.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs"><input type="checkbox" checked={(scope.branchIds || []).includes(branch.id)} onChange={() => toggleScopedBranch(scope, branch.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0 break-words">{branch.name}</span></label>)}</div> : <p className="text-xs text-muted-foreground">Este rubro todavía no tiene sucursales actuales. Usa la opción anterior para incluir las futuras.</p>}
                </div>}
              </>}
            </div>
          </details>;
        })}
        {!activeUnits.length && <p className="py-3 text-sm text-muted-foreground">El grupo todavía no tiene rubros activos.</p>}
      </div>
    </details>

    <details className="group rounded-2xl border border-border/60 bg-muted/15">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="min-w-0"><span className="block text-xs font-black uppercase tracking-widest">Operación en sucursales</span><span className="mt-1 block text-xs text-muted-foreground">Permisos por rubro con excepciones por sucursal · {scopeRules.length} regla(s) base</span></span>
        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-border/50 p-4">
        <p className="text-xs text-muted-foreground">Una sucursal seguirá visible en la Vista Manager aunque su operación esté en «Sin acceso».</p>
        {scopeRules.map((scope) => {
          const unit = businessUnits.find((candidate) => candidate.id === scope.businessUnitId);
          const scopedBranches = branchesInScope(scope);
          const baseRule = getRule('BUSINESS_UNIT', scope.businessUnitId);
          const overrideCount = scopedBranches.filter((branch) => branchAccess.some((rule) => rule.scopeType === 'BRANCH' && rule.scopeId === branch.id)).length;
          return <details key={scope.businessUnitId} className="group rounded-xl border border-border/60 bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden [&::-webkit-details-marker]:hidden">
              <span className="min-w-0"><span className="block truncate text-sm font-bold">{unit?.name || 'Rubro'}</span><span className="mt-0.5 block text-xs text-muted-foreground">{baseRule.mode === 'FULL' ? 'Operación completa' : baseRule.mode === 'NONE' ? 'Sin operación' : `${baseRule.permissions.length} módulo(s) personalizado(s)`} · {scopedBranches.length}{scope.branchMode === 'ALL_CURRENT_AND_FUTURE' ? '+' : ''} sucursal(es)</span></span>
              <span className="flex shrink-0 items-center gap-2"><Badge variant="outline">{overrideCount} excepción(es)</Badge><ChevronDown className="size-4 transition-transform group-open:rotate-180" /></span>
            </summary>
            <div className="space-y-3 border-t border-border/50 p-3">
              <RuleEditor label={`Regla base · ${unit?.name || 'Rubro'}`} rule={baseRule} modeOptions={operationalModes} onChange={setRule} />
              <details className="rounded-xl border border-border/50 p-3">
                <summary className="cursor-pointer text-xs font-bold">Excepciones por sucursal ({scopedBranches.length})</summary>
                <div className="mt-3 space-y-2">{scopedBranches.map((branch) => {
                  const override = branchAccess.find((rule) => rule.scopeType === 'BRANCH' && rule.scopeId === branch.id);
                  return <div key={branch.id} className="space-y-2">
                    <label className="flex flex-col items-start justify-between gap-2 rounded-xl bg-muted/30 px-3 py-2 text-xs sm:flex-row sm:items-center"><span className="min-w-0 break-words font-semibold">{branch.name}</span><select aria-label={`Excepción operativa para ${branch.name}`} value={override?.mode || 'INHERIT'} onChange={(event) => {
                      if (event.target.value === 'INHERIT') setBranchAccess(branchAccess.filter((rule) => !(rule.scopeType === 'BRANCH' && rule.scopeId === branch.id)));
                      else setRule({ scopeType: 'BRANCH', scopeId: branch.id, mode: event.target.value as ManagerBranchAccessRule['mode'], permissions: override?.permissions || [] });
                    }} className="h-9 w-full max-w-full rounded-lg border border-border bg-background px-2 sm:w-56"><option value="INHERIT">Heredar rubro</option><option value="NONE">Sin acceso operativo</option><option value="FULL">Completo operativo</option><option value="CUSTOM">Personalizado</option></select></label>
                    {override?.mode === 'CUSTOM' && <RuleEditor label={`Excepción · ${branch.name}`} rule={override} modeOptions={operationalModes} onChange={setRule} />}
                  </div>;
                })}{!scopedBranches.length && <p className="py-2 text-xs text-muted-foreground">No hay sucursales actuales dentro de esta selección.</p>}</div>
              </details>
            </div>
          </details>;
        })}
        {!scopeRules.length && <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">Selecciona primero el alcance por rubro.</p>}
      </div>
    </details>
  </div>;
}
