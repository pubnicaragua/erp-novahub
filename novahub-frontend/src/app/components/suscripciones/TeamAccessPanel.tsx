import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, ChevronDown, ChevronsDown, ChevronsUp, CircleHelp, Edit2, Eye, ListChecks, Plus, ShieldCheck, Trash2, UserCog, Users, Warehouse } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { toast } from 'sonner';
import { rolesService } from '../../services/roles.service';
import { priceListsService, type PriceList } from '../../services/price-lists.service';
import { subscriptionsService } from '../../services/subscriptions.service';
import { useAuth } from '../../contexts/AuthContext';
import { ALL_PERM_MODULES, normalizePermissions } from '../ConfiguracionPage';
import { useTenantQuery, asList } from '../../hooks/useTenantQuery';
import { allowedModulesFromPermissions, getPermissionActionKeys, hydratePermissionActions, permissionValue, PERMISSION_ACTION_DEFINITIONS, SENSITIVE_PERMISSION_ACTION_DEFINITIONS, serializePermissionActions, supportsInventoryCostPermission, supportsPermissionAction, type PermissionMatrixAction } from '../../utils/permissions';
import { HIDDEN_PERMISSION_MODULE_IDS, LEGACY_VIEW_PERMISSION_ALIASES, PERMISSION_SUBMODULES, SIDEBAR_PERMISSION_MODULE_IDS } from '../../utils/sidebarPermissions';
import { cn } from '../ui/utils';
import { useCardsOnlyBelowTableBreakpoint, ViewLayoutSelect, type ViewLayoutMode } from '../ui/ViewLayoutSelect';
import { AuditHistoryDisclosure } from '../ui/AuditHistoryDisclosure';
import { GuidedTour, type GuidedTourStep } from '../ui/GuidedTour';

interface TeamAccessPanelProps {
  tenantId: string;
  tenantName: string;
  users: any[];
  onBack: () => void;
  onRolesChange?: () => Promise<unknown> | void;
  canViewRoles?: boolean;
  canCreateRoles?: boolean;
  canEditRoles?: boolean;
  canDeleteRoles?: boolean;
  roleHighlightRequest?: { roleId: string; token: number } | null;
}

const permissionActions = [...PERMISSION_ACTION_DEFINITIONS, ...SENSITIVE_PERMISSION_ACTION_DEFINITIONS];
const LEGACY_PERMISSION_KEYS = ['view', 'canView', 'write', 'canWrite', 'canCreate', 'canEdit', 'canApprove', 'canViewCost', 'deactivate', 'cancel', 'reject', 'reverse', 'canDelete', 'canDeactivate', 'canCancel', 'canReject', 'canReverse'];

/**
 * Los padres siguen viniendo del catálogo histórico para conservar sus
 * nombres, mientras que los hijos vienen del catálogo real del sidebar y de
 * los tabs internos autorizables. PROJECTS no estaba en el catálogo histórico
 * aunque sí existe como módulo operativo, por eso se declara aquí con el
 * mismo identificador que consume la aplicación.
 */
const ROLE_PERMISSION_MODULES = (() => {
  const parents = ALL_PERM_MODULES
    .filter((module: any) => !module.parent)
    .filter((module: any) => module.id === 'DASHBOARD' || SIDEBAR_PERMISSION_MODULE_IDS.has(module.id));
  const knownParents = new Set(parents.map((module: any) => module.id));
  const allParents = knownParents.has('PROJECTS')
    ? parents
    : [...parents, { id: 'PROJECTS', label: 'Proyectos', description: 'Portafolio, planificación, costos y colaboración' }];
  const parentIds = new Set(allParents.map((parent: any) => parent.id));
  const seenIds = new Set<string>();

  return allParents.flatMap((parent: any) => {
    const entries = [
      parent,
      ...PERMISSION_SUBMODULES
        .filter((module) => module.parent === parent.id && !parentIds.has(module.id))
        .map((module) => ({ ...module, icon: undefined, description: `Permisos de la vista ${module.label}` })),
    ];
    return entries.filter((module: any) => {
      if (seenIds.has(module.id)) return false;
      seenIds.add(module.id);
      return true;
    });
  });
})();

const ROLE_PERMISSION_CHILDREN = ROLE_PERMISSION_MODULES.filter((module: any) => module.parent);

const emptyPermissions = () => ROLE_PERMISSION_MODULES.map((module: any) => ({
  module: module.id,
  ...Object.fromEntries(permissionActions.map(({ key }) => [key, false])),
  ...(module.id === 'SALES_PRICE_LISTS' ? { allowedPriceListIds: [] } : {}),
}));

const getPermissionGroupLabel = (group: string) => {
  const module = ROLE_PERMISSION_MODULES.find((item: any) => item.id === group) as any;
  return module?.label || group.replace(/_/g, ' ');
};

const getLinkedUserCount = (role: any, users: any[]) => Number.isFinite(Number(role?._count?.users))
  ? Number(role._count.users)
  : users.filter((user: any) => user.customRoleId === role?.id).length;

const getActionLabel = (key: PermissionMatrixAction) => permissionActions.find((action) => action.key === key)?.label || key;

const getViewActionDescription = (module: any, action: PermissionMatrixAction) => {
  if (action === 'read') return `Permite acceder a la vista ${module.label}.`;
  return permissionActions.find((item) => item.key === action)?.description || `Permite ejecutar ${getActionLabel(action).toLowerCase()} en ${module.label}.`;
};

const ROLE_PERMISSIONS_TOUR_STEPS: Record<'preview' | 'editor', GuidedTourStep[]> = {
  preview: [
    { target: '[data-tour="role-preview-permissions"]', title: 'Permisos directos', description: 'Aquí se muestran únicamente las vistas y acciones activas del rol seleccionado.', placement: 'bottom' },
    { target: '[data-tour="role-preview-groups"]', title: 'Módulos y vistas', description: 'Abre un módulo para revisar sus vistas y las acciones habilitadas en cada una.', placement: 'top' },
  ],
  editor: [
    { target: '[data-tour="role-permissions"]', title: 'Permisos del rol', description: 'Configura el acceso directo de este rol por módulo, vista y acción.', placement: 'bottom' },
    { target: '[data-tour="role-permission-actions"]', title: 'Acciones rápidas', description: 'Puedes expandir todo, contraer todo o marcar y desmarcar los permisos disponibles.', placement: 'bottom' },
  ],
};

function RolePermissionsTutorial({ mode }: { mode: 'preview' | 'editor' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-toolbar-role="help"
        data-tutorial-trigger="true"
        className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
        onClick={() => setOpen(true)}
        aria-label="Abrir tutorial de permisos"
        title="Abrir tutorial de permisos"
      >
        <CircleHelp className="size-4" />
      </Button>
      {open && <GuidedTour steps={ROLE_PERMISSIONS_TOUR_STEPS[mode]} onClose={() => setOpen(false)} title="Permisos del rol" allowTargetInteraction />}
    </>
  );
}

function hydratePermissions(role: any) {
  const current = normalizePermissions(role?.permissions)
    .filter((permission: any) => !HIDDEN_PERMISSION_MODULE_IDS.has(String(permission.module || '').toUpperCase()));
  const hydrated = ROLE_PERMISSION_MODULES.map((module: any) => {
    const candidates = [module.id, ...(LEGACY_VIEW_PERMISSION_ALIASES[module.id] || [])]
      .map((candidate) => String(candidate).toUpperCase());
    // La fila canónica de la vista siempre tiene prioridad. Antes se buscaba
    // cualquier alias con `find` sobre el arreglo completo; como el módulo
    // padre suele aparecer primero, un padre en false podía ocultar una vista
    // hija en true al volver a editar el rol.
    const existing = current.find((permission: any) => String(permission.module || '').toUpperCase() === candidates[0])
      || candidates.slice(1)
        .map((candidate) => current.find((permission: any) => String(permission.module || '').toUpperCase() === candidate))
        .find(Boolean);
    const parent = module.parent
      ? current.find((permission: any) => String(permission.module || '').toUpperCase() === String(module.parent).toUpperCase())
      : undefined;
    return hydratePermissionActions(existing || parent, module.id);
  });
  // El editor se guarda contra el catálogo canónico. Así los identificadores
  // retirados o desconocidos se limpian al editar un rol existente.
  return hydrated;
}

export function TeamAccessPanel({ tenantId, tenantName, users, onBack, onRolesChange, canViewRoles = true, canCreateRoles = true, canEditRoles = true, canDeleteRoles = true, roleHighlightRequest = null }: TeamAccessPanelProps) {
  const { user: currentUser } = useAuth();
  const [roleView, setRoleView] = useState<'list' | 'editor' | 'preview'>('list');
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [viewingRole, setViewingRole] = useState<any | null>(null);
  const [assignedUsersRole, setAssignedUsersRole] = useState<any | null>(null);
  const { data: warehouseCatalogData, isPending: warehouseCatalogLoading } = useTenantQuery<any[]>(
    ['role-warehouse-catalog', tenantId],
    async (signal) => asList(await rolesService.getWarehouses(signal)),
    {
      enabled: Boolean(tenantId && canViewRoles),
      onError: (error) => toast.error(error.message || 'No se pudo cargar el catálogo de bodegas'),
    },
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedViews, setExpandedViews] = useState<Record<string, boolean>>({});
  const [warehousesExpanded, setWarehousesExpanded] = useState(false);
  const [rolesLayout, setRolesLayout] = useState<ViewLayoutMode>('table');
  const isCompactRolesViewport = useCardsOnlyBelowTableBreakpoint();
  const effectiveRolesLayout: ViewLayoutMode = isCompactRolesViewport ? 'cards' : rolesLayout;

  const { data: enabledModulesData, isPending: enabledModulesLoading } = useTenantQuery<string[]>(
    ['role-permission-scope', tenantId],
    async (signal) => asList(await subscriptionsService.getEnabledModules(tenantId, undefined, signal)) as string[],
    {
      enabled: Boolean(tenantId && canViewRoles),
      onError: (error) => toast.error(error.message || 'No se pudo cargar el alcance de módulos de la sucursal'),
    },
  );

  const rolePermissionModules = useMemo(() => {
    const fallback = currentUser?.tenantId === tenantId && Array.isArray(currentUser.enabledModules)
      ? currentUser.enabledModules
      : [];
    const scope = new Set((enabledModulesData ?? fallback).map((module) => String(module || '').trim().toUpperCase()).filter(Boolean));
    const hasSalesScope = scope.has('SALES') || [...scope].some((module) => module.startsWith('SALES_'));
    const hasScope = (moduleId: string) => scope.has(moduleId)
      || (LEGACY_VIEW_PERMISSION_ALIASES[moduleId] || []).some((alias) => scope.has(String(alias).toUpperCase()))
      || (['RETAIL_POS', 'RETAIL_CASH_CONTROL'].includes(moduleId) && hasSalesScope);
    const hasParentScope = (parent: string) => hasScope(parent)
      || [...scope].some((module) => module.startsWith(`${parent}_`));

    // Las vistas administrativas son internas de la sucursal: quien ya tiene
    // acceso a Roles puede administrarlas, aunque no sean módulos facturables.
    return ROLE_PERMISSION_MODULES.filter((module: any) => {
      if (HIDDEN_PERMISSION_MODULE_IDS.has(String(module.id).toUpperCase())) return false;
      if (module.id === 'DASHBOARD') return true;
      if (module.parent === 'MY_COMPANY' || module.parent === 'CONFIGURATION') return true;
      if (module.parent && module.subscription === false) return hasParentScope(module.parent);
      if (hasScope(module.id)) return true;
      if (!module.parent) return hasParentScope(module.id);
      return hasParentScope(module.parent) && scope.has(module.parent);
    });
  }, [currentUser, enabledModulesData, tenantId]);

  useEffect(() => {
    if (!roleHighlightRequest?.roleId) return;
    const timer = window.setTimeout(() => {
      const roleElement = Array.from(document.querySelectorAll<HTMLElement>('[data-role-id]'))
        .find((element) => element.dataset.roleId === roleHighlightRequest.roleId);
      roleElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [roleHighlightRequest?.roleId, roleHighlightRequest?.token]);

  const { data: teamData, refetch: refetchTeam } = useTenantQuery(
    ['my-company-team-access', tenantId],
    async (signal) => {
      const rolesResponse = await rolesService.getAll({ clientTenantId: tenantId }, signal);
      return {
        roles: asList(rolesResponse).filter((role: any) => !role.clientTenantId || role.clientTenantId === tenantId),
      };
    },
    { enabled: Boolean(tenantId && canViewRoles), onError: (error) => toast.error(error.message || 'No se pudo cargar la configuración del equipo') },
  );

  const { data: priceListCatalogData, isPending: priceListCatalogLoading } = useTenantQuery<PriceList[]>(
    ['sales-price-list-permission-catalog', tenantId],
    async (signal) => asList(await priceListsService.getPermissionCatalog(signal)) as PriceList[],
    {
      enabled: Boolean(tenantId && canViewRoles),
      staleTime: 0,
      refetchOnMount: 'always',
      onError: (error) => toast.error(error.message || 'No se pudo cargar el catálogo de listas de precios'),
    },
  );

  const roles = teamData?.roles || [];
  const priceListCatalog = priceListCatalogData || [];
  const warehouseCatalog = warehouseCatalogData || [];
  const getRoleWarehouseIds = (role: any) => Array.isArray(role?.warehouseIds)
    ? role.warehouseIds.filter((warehouseId: string) => warehouseCatalog.some((warehouse: any) => warehouse.id === warehouseId))
    : warehouseCatalog.map((warehouse: any) => warehouse.id);
  const roleWarehouseScopeIsComplete = (role: any) => warehouseCatalog.length > 0
    && warehouseCatalog.every((warehouse: any) => getRoleWarehouseIds(role).includes(warehouse.id));

  const toggleRoleWarehouse = (warehouseId: string) => {
    if ((!canEditRoles && !canCreateRoles) || !warehouseId) return;
    setEditingRole((current: any) => {
      if (!current) return current;
      const currentIds = new Set(getRoleWarehouseIds(current));
      if (currentIds.has(warehouseId)) currentIds.delete(warehouseId);
      else currentIds.add(warehouseId);
      return { ...current, warehouseIds: [...currentIds] };
    });
  };

  const toggleAllRoleWarehouses = () => {
    if ((!canEditRoles && !canCreateRoles) || !warehouseCatalog.length) return;
    setEditingRole((current: any) => {
      if (!current) return current;
      const nextIds = roleWarehouseScopeIsComplete(current) ? [] : warehouseCatalog.map((warehouse: any) => warehouse.id);
      return { ...current, warehouseIds: nextIds };
    });
  };

  const load = async () => {
    const result = await refetchTeam({ throwOnError: true });
    return result.data?.roles || [];
  };

  const groupedModules = useMemo(() => rolePermissionModules.reduce((groups: Record<string, any[]>, module: any) => {
    const group = module.parent || module.id;
    (groups[group] ||= []).push(module);
    return groups;
  }, {}), [rolePermissionModules]);

  const actionIsAvailable = (moduleId: string, action: PermissionMatrixAction) => action === 'viewCost'
    ? supportsInventoryCostPermission(moduleId)
    : supportsPermissionAction(moduleId, action);

  const availableActionsFor = (moduleId: string) => permissionActions.filter(({ key }) => getPermissionActionKeys(moduleId).includes(key));

  const setAllExpanded = (expanded: boolean) => {
    setExpandedSections(Object.fromEntries(Object.keys(groupedModules).map((group) => [group, expanded])));
    setExpandedViews(Object.fromEntries(rolePermissionModules.map((module: any) => [module.id, expanded])));
  };
  const expandAll = () => setAllExpanded(true);
  const collapseAll = () => setAllExpanded(false);
  const toggleSection = (group: string) => setExpandedSections((current) => ({ ...current, [group]: !(current[group] ?? false) }));
  const toggleView = (moduleId: string) => setExpandedViews((current) => ({ ...current, [moduleId]: !(current[moduleId] ?? false) }));

  const updatePermissionActions = (permission: any, moduleId: string, shouldEnable: boolean) => {
    permissionActions.forEach(({ key }) => {
      if (actionIsAvailable(moduleId, key)) permission[key] = shouldEnable;
      else if (key === 'approve') permission[key] = false;
    });
    permission.write = shouldEnable && (actionIsAvailable(moduleId, 'create') || actionIsAvailable(moduleId, 'edit'));
    if (!shouldEnable) LEGACY_PERMISSION_KEYS.forEach((key) => { permission[key] = false; });
    if (moduleId === 'SALES_PRICE_LISTS' && (shouldEnable || Object.prototype.hasOwnProperty.call(permission, 'allowedPriceListIds'))) {
      permission.allowedPriceListIds = shouldEnable ? priceListCatalog.map((list) => list.id) : [];
    }
  };

  const priceListScopeIsComplete = (permission: any) => {
    if (!priceListCatalog.length) return true;
    if (!Object.prototype.hasOwnProperty.call(permission || {}, 'allowedPriceListIds')) return true;
    const selectedIds = new Set(Array.isArray(permission.allowedPriceListIds) ? permission.allowedPriceListIds : []);
    return priceListCatalog.every((list) => selectedIds.has(list.id));
  };

  const togglePriceListAccess = (priceListId: string) => {
    if ((!canEditRoles && !canCreateRoles) || !priceListId) return;
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      const target = permissions.find((permission: any) => permission.module === 'SALES_PRICE_LISTS');
      if (!target) return current;
      const currentIds = Object.prototype.hasOwnProperty.call(target, 'allowedPriceListIds')
        ? new Set(Array.isArray(target.allowedPriceListIds) ? target.allowedPriceListIds : [])
        : new Set(priceListCatalog.map((list) => list.id));
      if (currentIds.has(priceListId)) currentIds.delete(priceListId);
      else currentIds.add(priceListId);
      target.allowedPriceListIds = [...currentIds];
      return { ...current, permissions };
    });
  };

  const toggleAllPriceListAccess = () => {
    if ((!canEditRoles && !canCreateRoles) || !priceListCatalog.length) return;
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      const target = permissions.find((permission: any) => permission.module === 'SALES_PRICE_LISTS');
      if (!target) return current;
      target.allowedPriceListIds = priceListScopeIsComplete(target) ? [] : priceListCatalog.map((list) => list.id);
      return { ...current, permissions };
    });
  };

  const syncParentPermission = (permissions: any[], moduleId: string) => {
    const childDefinition = ROLE_PERMISSION_CHILDREN.find((module: any) => module.id === moduleId);
    if (!childDefinition) return;
    const parentPermission = permissions.find((permission: any) => permission.module === childDefinition.parent);
    const siblings = ROLE_PERMISSION_CHILDREN.filter((module: any) => module.parent === childDefinition.parent);
    const siblingPermissions = siblings.map((sibling: any) => permissions.find((permission: any) => permission.module === sibling.id)).filter(Boolean);
    if (!parentPermission || !siblingPermissions.length) return;
    permissionActions.forEach(({ key }) => {
      if (actionIsAvailable(childDefinition.parent, key)) {
        parentPermission[key] = siblingPermissions.every((permission: any) => permissionValue(permission, key));
      }
    });
    parentPermission.write = actionIsAvailable(childDefinition.parent, 'create') && permissionValue(parentPermission, 'create')
      || actionIsAvailable(childDefinition.parent, 'edit') && permissionValue(parentPermission, 'edit');
    parentPermission.read = siblingPermissions.every((permission: any) => permissionValue(permission, 'read'));
  };

  const isSectionFullyEnabled = (modules: any[]) => {
    return modules.length > 0 && modules.every((module: any) => isViewFullyEnabled(module));
  };

  const toggleSectionPermissions = (modules: any[]) => {
    if ((!canEditRoles && !canCreateRoles) || !modules.length) return;
    const shouldEnable = !isSectionFullyEnabled(modules);
    const moduleIds = new Set(modules.map((module: any) => module.id));
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      permissions.forEach((permission: any) => {
        if (!moduleIds.has(permission.module)) return;
        updatePermissionActions(permission, permission.module, shouldEnable);
      });
      return { ...current, permissions };
    });
  };

  const toggleViewPermissions = (module: any) => {
    if ((!canEditRoles && !canCreateRoles) || !module) return;
    const shouldEnable = !isViewFullyEnabled(module);
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      const target = permissions.find((permission: any) => permission.module === module.id);
      if (!target) return current;
      updatePermissionActions(target, module.id, shouldEnable);
      syncParentPermission(permissions, module.id);
      return { ...current, permissions };
    });
  };

  const toggleAllPermissions = () => {
    if ((!canEditRoles && !canCreateRoles)) return;
    const shouldEnable = !isAllPermissionsEnabled();
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      rolePermissionModules.forEach((module: any) => {
        const target = permissions.find((permission: any) => permission.module === module.id);
        if (target) updatePermissionActions(target, module.id, shouldEnable);
      });
      return { ...current, permissions };
    });
  };

  const openCreateRole = () => {
    if (!canCreateRoles) return;
    setEditingRole({ name: '', description: '', permissions: emptyPermissions(), ...(warehouseCatalogLoading ? {} : { warehouseIds: warehouseCatalog.map((warehouse: any) => warehouse.id) }) });
    setViewingRole(null);
    collapseAll();
    setRoleView('editor');
  };

  const isViewFullyEnabled = (module: any) => {
    const permission = normalizePermissions(editingRole?.permissions).find((item: any) => item.module === module.id) || {};
    const availableActions = availableActionsFor(module.id);
    return availableActions.length > 0
      && availableActions.every(({ key }) => permissionValue(permission, key))
      && (module.id !== 'SALES_PRICE_LISTS' || priceListScopeIsComplete(permission));
  };

  const isAllPermissionsEnabled = () => rolePermissionModules.length > 0 && rolePermissionModules.every((module: any) => isViewFullyEnabled(module));

  const openEditRole = async (role: any) => {
    if (!canEditRoles || roleLoading || !role?.id) return;
    setRoleLoading(true);
    try {
      // La fila de la tabla puede quedar desactualizada después de guardar.
      // El editor debe reconstruirse desde la respuesta autoritativa del API.
      const response = await rolesService.getById(String(role.id));
      const freshRole = response?.data?.id ? response.data : response;
      if (!freshRole?.id) throw new Error('El servidor no devolvió el rol solicitado');
      setEditingRole({
        ...freshRole,
        permissions: hydratePermissions(freshRole),
        ...(Array.isArray(freshRole.warehouseIds) ? { warehouseIds: freshRole.warehouseIds } : {}),
      });
      setViewingRole(null);
      collapseAll();
      setRoleView('editor');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cargar la información actualizada del rol');
    } finally {
      setRoleLoading(false);
    }
  };

  const openViewRole = (role: any) => {
    setViewingRole({ ...role, permissions: hydratePermissions(role), ...(Array.isArray(role.warehouseIds) ? { warehouseIds: role.warehouseIds } : {}) });
    setEditingRole(null);
    collapseAll();
    setRoleView('preview');
  };
  const openAssignedUsers = (role: any) => setAssignedUsersRole(role);

  const closeRoleView = () => {
    setRoleView('list');
    setEditingRole(null);
    setViewingRole(null);
  };

  const togglePermission = (moduleId: string, action: PermissionMatrixAction) => {
    if ((!canEditRoles && !canCreateRoles) || !actionIsAvailable(moduleId, action)) return;
    setEditingRole((current: any) => {
      if (!current) return current;
      const permissions = normalizePermissions(current.permissions).map((permission: any) => ({ ...permission }));
      const target = permissions.find((permission: any) => permission.module === moduleId);
      if (!target) return current;
      const nextValue = !permissionValue(target, action);
      if (action === 'read' && !nextValue && permissionActions.some(({ key }) => key !== 'read' && permissionValue(target, key))) return current;
      target[action] = nextValue;
      if (action !== 'read' && nextValue) target.read = true;

      const childModules = ROLE_PERMISSION_CHILDREN.filter((module: any) => module.parent === moduleId);
      childModules.forEach((child: any) => {
        if (!actionIsAvailable(child.id, action)) return;
        const childPermission = permissions.find((permission: any) => permission.module === child.id);
        if (!childPermission) return;
        childPermission[action] = nextValue;
        if (action !== 'read' && nextValue) childPermission.read = true;
        if (action === 'read' && !nextValue) {
          permissionActions.filter(({ key }) => key !== 'read').forEach(({ key }) => { childPermission[key] = false; });
          childPermission.write = false;
        }
      });

      const childDefinition = ROLE_PERMISSION_CHILDREN.find((module: any) => module.id === moduleId);
      if (childDefinition) {
        const parentPermission = permissions.find((permission: any) => permission.module === childDefinition.parent);
        const siblings = ROLE_PERMISSION_CHILDREN.filter((module: any) => module.parent === childDefinition.parent);
        const siblingPermissions = siblings.map((sibling: any) => permissions.find((permission: any) => permission.module === sibling.id)).filter(Boolean);
        if (parentPermission && actionIsAvailable(childDefinition.parent, action) && siblingPermissions.length > 0) {
          parentPermission[action] = siblingPermissions.every((permission: any) => permissionValue(permission, action));
          if (action !== 'read') parentPermission.read = siblingPermissions.every((permission: any) => permissionValue(permission, 'read'));
        }
      }

      return { ...current, permissions };
    });
  };

  const saveRole = async () => {
    if (!editingRole || (editingRole.id ? !canEditRoles : !canCreateRoles)) return;
    const name = String(editingRole?.name || '').trim();
    if (!name) return toast.error('El nombre del rol es obligatorio');
    setRoleSaving(true);
    try {
      const mergedPermissions = normalizePermissions(editingRole.permissions).reduce((result: any[], permission: any) => {
        const module = permission.module === 'TICKETS_VIEW' ? 'TICKETS_LIST' : permission.module;
        const existing = result.find((item) => item.module === module);
        if (!existing) {
          result.push({ ...permission, module });
          return result;
        }
        permissionActions.forEach(({ key }) => {
          existing[key] = Boolean(existing[key] || permissionValue(permission, key));
        });
        existing.write = Boolean(existing.write || permission.write);
        return result;
      }, []);
      const permissions = serializePermissionActions(mergedPermissions)
        // El catálogo visible puede estar cargando o usar un identificador
        // histórico. El backend valida el alcance real de la sucursal; no
        // descartamos aquí una vista que el usuario acaba de marcar.
        .filter((permission: any) => !HIDDEN_PERMISSION_MODULE_IDS.has(String(permission.module || '').toUpperCase()))
        .map((permission: any) => ({ ...permission }));
      const payload = {
        name,
        description: String(editingRole.description || '').trim(),
        permissions,
        allowedModules: allowedModulesFromPermissions(permissions),
        warehouseIds: getRoleWarehouseIds(editingRole),
        clientTenantId: tenantId,
      };
      const savedResponse = editingRole.id
        ? await rolesService.update(editingRole.id, payload)
        : await rolesService.create(payload);
      const savedRole = savedResponse?.data?.id ? savedResponse.data : savedResponse;
      const savedRoleId = String(editingRole.id || savedRole?.id || '');

      // Confirmar lo que realmente quedó persistido antes de cerrar el editor.
      // Esto evita que una respuesta antigua de la lista vuelva a pintar los
      // permisos desactivados.
      if (savedRoleId) {
        const verifiedResponse = await rolesService.getById(savedRoleId);
        const verifiedRole = verifiedResponse?.data?.id ? verifiedResponse.data : verifiedResponse;
        if (!verifiedRole?.id) throw new Error('El servidor no devolvió el rol actualizado');
      }
      toast.success(editingRole.id ? 'Rol actualizado' : 'Rol creado');
      closeRoleView();
      await load();
      await onRolesChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar el rol');
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteRole = async (role: any) => {
    if (!canDeleteRoles) return;
    if (role.isSystemRole) return toast.error('Los roles del sistema no se pueden eliminar');
    const linkedUsers = getLinkedUserCount(role, users);
    if (linkedUsers > 0) {
      return toast.error(`No se puede eliminar el rol porque tiene ${linkedUsers} usuario${linkedUsers === 1 ? '' : 's'} vinculado${linkedUsers === 1 ? '' : 's'}. Reasigna esos usuarios antes de eliminarlo.`);
    }
    try {
      await rolesService.delete(role.id);
      toast.success('Rol eliminado');
      await load();
      await onRolesChange?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Error al eliminar rol');
    }
  };

  return (
    <div className="min-w-0 space-y-6" data-tour="team-roles">
      {roleView === 'list' && <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={onBack} aria-label="Volver a Mi Equipo"><ArrowLeft className="size-4" /></Button>
            <div className="min-w-0"><h2 className="truncate text-2xl font-black uppercase italic tracking-tight">Roles y permisos</h2><p className="text-xs text-muted-foreground">Crea grupos de acceso para controlar los módulos y vistas de {tenantName}.</p></div>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 border-primary/20 text-primary"><UserCog className="size-3.5" /> {roles.length} {roles.length === 1 ? 'rol' : 'roles'}</Badge>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /><p>Los permisos se organizan por módulos y, cuando existen, por sus vistas internas. Puedes revisar un rol o editarlo en una vista completa sin perder el contexto de la empresa.</p></div>

        <Card data-tour="role-preview-permissions" className="min-w-0 border-border/50">
          <CardHeader className="flex flex-col gap-3 border-b border-border/30 bg-muted/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><UserCog className="size-4 text-primary" /> Catálogo de roles</CardTitle><CardDescription className="mt-1 text-xs">Define los permisos que tendrá cada grupo de usuarios.</CardDescription></div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <ViewLayoutSelect value={effectiveRolesLayout} onChange={setRolesLayout} ariaLabel="Distribución de roles" className="h-8" />
              {canCreateRoles && <Button size="sm" onClick={openCreateRole} className="h-9 w-fit gap-1.5 text-xs"><Plus className="size-3.5" /> Nuevo rol</Button>}
            </div>
          </CardHeader>
          <CardContent className="min-w-0 p-4 sm:p-6">
            {!roles.length && <p className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">Sin roles personalizados</p>}
            <div className={cn(effectiveRolesLayout === 'cards' ? 'grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3')}>
            {roles.map((role: any) => (
              (() => {
                const linkedUsers = getLinkedUserCount(role, users);
                const cannotDelete = Boolean(role.isSystemRole) || linkedUsers > 0;
                const deleteLabel = role.isSystemRole
                  ? 'Los roles del sistema no se pueden eliminar'
                  : linkedUsers > 0
                    ? `No se puede eliminar: ${linkedUsers} usuario${linkedUsers === 1 ? '' : 's'} vinculado${linkedUsers === 1 ? '' : 's'}`
                    : 'Eliminar rol';
                const isRoleCard = effectiveRolesLayout === 'cards';
                return <div key={role.id || role.name} data-role-id={role.id} className={cn('flex min-w-0 gap-3', isRoleCard ? 'h-full flex-col rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:border-primary/30' : 'flex-col rounded-xl border border-border/50 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', roleHighlightRequest?.roleId === String(role.id) && 'border-primary bg-primary/10 shadow-lg shadow-primary/20 ring-2 ring-primary/40')}>
                <div className="min-w-0 flex-1"><p className={cn('text-sm font-bold', isRoleCard ? 'break-words' : 'truncate')}>{role.name}</p><p className={cn('text-xs text-muted-foreground', isRoleCard ? 'break-words' : 'truncate')}>{role.description || 'Sin descripción'}</p></div>
                <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', isRoleCard && 'mt-auto pt-1')}>
                  <Badge variant="secondary" className="text-[9px]">{normalizePermissions(role.permissions).filter((permission: any) => permission.read).length} vistas</Badge>
                  <Badge variant="outline" className={cn('text-[9px]', linkedUsers > 0 && 'border-amber-500/40 text-amber-600')}>
                    {linkedUsers} {linkedUsers === 1 ? 'usuario vinculado' : 'usuarios vinculados'}
                  </Badge>
                  {canViewRoles && <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => openViewRole(role)} title="Ver permisos" aria-label={`Ver permisos de ${role.name}`}><Eye className="size-3.5" /></Button>}
                  {canViewRoles && <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => openAssignedUsers(role)} title="Ver usuarios asignados" aria-label={`Ver usuarios asignados al rol ${role.name}`}><Users className="size-3.5" /></Button>}
                  {canEditRoles && <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => openEditRole(role)} title="Editar permisos" aria-label={`Editar rol ${role.name}`}><Edit2 className="size-3.5" /></Button>}
                  {canDeleteRoles && <Button variant="ghost" size="icon" className="size-8 shrink-0 text-rose-500" disabled={cannotDelete} onClick={() => void deleteRole(role)} title={deleteLabel} aria-label={`${deleteLabel}: ${role.name}`}><Trash2 className="size-3.5" /></Button>}
                </div>
                </div>;
              })()
            ))}
            </div>
          </CardContent>
        </Card>
      </>}

      {roleView === 'preview' && viewingRole && <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3"><Button variant="outline" size="icon" onClick={closeRoleView} aria-label="Volver a Roles y permisos"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><h2 className="truncate text-2xl font-black uppercase italic tracking-tight">Permisos del rol</h2><p className="truncate text-xs text-muted-foreground">{viewingRole.name} · {viewingRole.description || 'Sin descripción'}</p></div></div>
          {canEditRoles && <Button className="w-fit gap-2" onClick={() => openEditRole(viewingRole)}><Edit2 className="size-4" /> Editar rol</Button>}
        </div>
        <Card className="min-w-0 border-border/50">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 bg-muted/10"><div><CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><Eye className="size-4 text-primary" /> Módulos y vistas habilitadas</CardTitle><CardDescription className="mt-1 text-xs">Revisa las acciones efectivas de este rol. Cada módulo se puede desplegar o contraer.</CardDescription></div><RolePermissionsTutorial mode="preview" /></CardHeader>
          <CardContent className="min-w-0 space-y-3 p-4 sm:p-6">
            <AuditHistoryDisclosure entity="ROLE" entityId={String(viewingRole.id)} createdAt={viewingRole.createdAt} />
            <div data-tour="role-preview-groups" className="space-y-3">
            {Object.entries(groupedModules).map(([group, modules]) => {
              const expanded = expandedSections[group] ?? false;
              return <section key={group} className="overflow-hidden rounded-xl border border-border/60">
                <div className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3"><button type="button" onClick={() => toggleSection(group)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={expanded}><ChevronDown className={cn('size-4 shrink-0 text-primary transition-transform', expanded && 'rotate-180')} /><span className="truncate text-xs font-black uppercase tracking-widest text-primary">{getPermissionGroupLabel(group)}</span><Badge variant="secondary" className="shrink-0 text-[9px]">{(modules as any[]).length} vistas</Badge></button><span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{expanded ? 'Contraer' : 'Desplegar'}</span></div>
                {expanded && <div className="overflow-x-auto"><div className="min-w-[1040px]"><div className="grid items-center gap-1.5 border-t border-border/40 bg-card px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground" style={{ gridTemplateColumns: `minmax(240px,1fr) repeat(${permissionActions.length},88px)` }}><span>Vista</span>{permissionActions.map(({ key, label }) => <span key={key} className="text-center">{label}</span>)}</div>{(modules as any[]).map((module: any) => { const permission = normalizePermissions(viewingRole.permissions).find((item: any) => item.module === module.id) || {}; return <div key={module.id} className="grid items-center gap-1.5 border-t border-border/40 px-5 py-3.5 text-sm" style={{ gridTemplateColumns: `minmax(240px,1fr) repeat(${permissionActions.length},88px)` }}><span className={module.parent ? 'pl-5 text-muted-foreground' : 'font-bold'}>{module.label}</span>{permissionActions.map(({ key }) => <div key={key} className="flex justify-center">{!actionIsAvailable(module.id, key) ? <span className="text-muted-foreground/20" aria-label="No aplica">—</span> : permissionValue(permission, key) ? <Badge className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-500"><Check className="mr-1 size-3" />Sí</Badge> : <span className="text-muted-foreground/30">—</span>}</div>)}</div>; })}</div></div>}
              </section>;
            })}
            </div>
          </CardContent>
        </Card>
      </>}

      {roleView === 'editor' && editingRole && <>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3"><Button variant="outline" size="icon" onClick={closeRoleView} disabled={roleSaving} aria-label="Volver a Roles y permisos"><ArrowLeft className="size-4" /></Button><div className="min-w-0"><h2 className="truncate text-2xl font-black uppercase italic tracking-tight">{editingRole.id ? 'Editar rol' : 'Nuevo rol'}</h2><p className="truncate text-xs text-muted-foreground">Define el acceso de este rol dentro de {tenantName}.</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={closeRoleView} disabled={roleSaving || roleLoading}>Cancelar</Button>{(editingRole.id ? canEditRoles : canCreateRoles) && <Button onClick={() => void saveRole()} disabled={roleSaving || roleLoading || warehouseCatalogLoading}>{roleLoading ? 'Cargando...' : roleSaving ? 'Guardando...' : 'Guardar rol'}</Button>}</div>
        </div>

          <Card className="min-w-0 border-border/50"><CardHeader className="border-b border-border/30 bg-muted/10"><CardTitle className="flex items-center gap-2 text-sm font-black uppercase tracking-wider"><ShieldCheck className="size-4 text-primary" /> Datos del rol</CardTitle><CardDescription className="mt-1 text-xs">El nombre y la descripción ayudan a identificar el alcance del equipo.</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-4 p-4 sm:p-6 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="role-name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre del rol</Label><Input id="role-name" data-tour="role-name" value={editingRole.name || ''} onChange={(event) => setEditingRole((current: any) => ({ ...current, name: event.target.value }))} placeholder="Ej: Gerencia" className="h-11" /></div><div className="space-y-2"><Label htmlFor="role-description" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descripción (opcional)</Label><Input id="role-description" data-tour="role-description" value={editingRole.description || ''} onChange={(event) => setEditingRole((current: any) => ({ ...current, description: event.target.value }))} placeholder="Describe el alcance del rol" className="h-11" /></div>{editingRole.id && <div className="md:col-span-2"><AuditHistoryDisclosure entity="ROLE" entityId={String(editingRole.id)} createdAt={editingRole.createdAt} /></div>}</CardContent></Card>

        <Card className="min-w-0 border-border/50">
          <CardHeader className="border-b border-border/30 bg-muted/10">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setWarehousesExpanded((current) => !current)}
                className="flex min-w-0 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-expanded={warehousesExpanded}
                aria-controls="role-warehouses-content"
                aria-label={`${warehousesExpanded ? 'Contraer' : 'Expandir'} Bodegas del rol`}
              >
                <ChevronDown className={cn('size-4 shrink-0 text-primary transition-transform', warehousesExpanded && 'rotate-180')} />
                <span className="flex min-w-0 items-center gap-2 text-sm font-black uppercase tracking-wider">
                  <Warehouse className="size-4 shrink-0 text-primary" />
                  <span className="truncate">Bodegas del rol</span>
                </span>
              </button>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {warehousesExpanded ? 'Contraer' : 'Desplegar'}
              </span>
            </div>
            <CardDescription className="mt-1 text-xs">Estas son las bodegas que recibirá un usuario al asignarle este rol. Después podrás ajustar las bodegas de cada usuario sin cambiar el rol.</CardDescription>
          </CardHeader>
          {warehousesExpanded && <CardContent id="role-warehouses-content" className="space-y-3 p-4 sm:p-6"><div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs"><p className="font-bold text-primary">Módulos afectados por esta selección</p><p className="mt-1 leading-relaxed text-muted-foreground">Ventas, Compras, Inventario de Mercancías, Facturación por caja y Control de Caja.</p></div>{warehouseCatalogLoading ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Cargando bodegas...</p> : warehouseCatalog.length === 0 ? <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">No hay bodegas activas en esta sucursal.</p> : <><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3"><label className="flex cursor-pointer items-center gap-2 text-xs font-bold"><Checkbox checked={roleWarehouseScopeIsComplete(editingRole)} onCheckedChange={toggleAllRoleWarehouses} /> Todas las bodegas</label><Badge variant="outline" className="text-[10px]">{getRoleWarehouseIds(editingRole).length} de {warehouseCatalog.length}</Badge></div><div className="grid gap-2 sm:grid-cols-2">{warehouseCatalog.map((warehouse: any) => <label key={warehouse.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs"><Checkbox checked={getRoleWarehouseIds(editingRole).includes(warehouse.id)} onCheckedChange={() => toggleRoleWarehouse(warehouse.id)} /><span className="truncate">{warehouse.name}</span></label>)}</div></>}</CardContent>}
        </Card>

        <Card data-tour="role-permissions" className="min-w-0 border-border/50"><CardHeader className="flex flex-col gap-3 border-b border-border/30 bg-muted/10"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="text-sm font-black uppercase tracking-wider">Permisos</CardTitle><CardDescription className="mt-1 text-xs">Cada sección es un módulo y cada tarjeta es una vista o tab real. Despliega o contrae los módulos y sus vistas para definir el acceso.</CardDescription></div><div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest">{rolePermissionModules.length} módulos y vistas</Badge>{enabledModulesLoading && <span className="text-[10px] text-muted-foreground">Validando alcance…</span>}</div></div><div data-tour="role-permission-actions" className="flex flex-wrap items-center gap-2 border-t border-border/30 pt-3"><RolePermissionsTutorial mode="editor" /><Button type="button" variant="outline" size="sm" onClick={expandAll} disabled={roleSaving} className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-wider"><ChevronsDown className="size-3.5" /> Expandir todo</Button><Button type="button" variant="outline" size="sm" onClick={collapseAll} disabled={roleSaving} className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-wider"><ChevronsUp className="size-3.5" /> Contraer todo</Button><Button type="button" variant="secondary" size="sm" onClick={toggleAllPermissions} disabled={roleSaving || (!canEditRoles && !canCreateRoles)} className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-wider"><ListChecks className="size-3.5" /> {isAllPermissionsEnabled() ? 'Desmarcar todo' : 'Marcar todo'}</Button><span className="text-[10px] text-muted-foreground">Puedes marcar una vista, un módulo o todos los permisos.</span></div></CardHeader><CardContent className="min-w-0 space-y-3 p-4 sm:p-6">
           {Object.entries(groupedModules).map(([group, modules]) => {
             const expanded = expandedSections[group] ?? false;
             const groupModules = modules as any[];
             const viewModules = groupModules.filter((module) => module.parent);
             const modulesToRender = viewModules.length > 0 ? viewModules : groupModules;
             const moduleEnabled = isSectionFullyEnabled(groupModules);
             return (
               <section key={group} className="overflow-hidden rounded-xl border border-border/60">
                 <div className="flex flex-col gap-3 bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                   <button type="button" onClick={() => toggleSection(group)} className="flex min-w-0 items-center gap-2 text-left" aria-expanded={expanded}>
                     <ChevronDown className={cn('size-4 shrink-0 text-primary transition-transform', expanded && 'rotate-180')} />
                     <span className="truncate text-xs font-black uppercase tracking-widest text-primary">{getPermissionGroupLabel(group)}</span>
                     <Badge variant="secondary" className="shrink-0 text-[9px]">{modulesToRender.length} {modulesToRender.length === 1 ? 'vista' : 'vistas'}</Badge>
                   </button>
                   <Button type="button" variant="outline" size="sm" onClick={() => toggleSectionPermissions(groupModules)} disabled={roleSaving || (!canEditRoles && !canCreateRoles)} className="h-8 w-fit shrink-0 gap-1.5 text-[10px] font-black uppercase tracking-wider">
                     {moduleEnabled ? <CheckCheck className="size-3.5" /> : <ListChecks className="size-3.5" />}
                     {moduleEnabled ? 'Desmarcar módulo' : 'Marcar módulo'}
                   </Button>
                 </div>
                 {expanded && (
                   <div className="space-y-2 border-t border-border/40 bg-muted/10 p-3 sm:p-4">
                     {modulesToRender.map((module: any) => {
                       const permission = normalizePermissions(editingRole.permissions).find((item: any) => item.module === module.id) || {};
                       const availableActions = availableActionsFor(module.id);
                       const viewExpanded = expandedViews[module.id] ?? false;
                       const viewEnabled = isViewFullyEnabled(module);
                       return (
                         <div key={module.id} className="rounded-xl border border-border/60 bg-card shadow-sm transition-colors hover:border-primary/30">
                           <div className="flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                             <button type="button" onClick={() => toggleView(module.id)} className="flex min-w-0 items-center gap-3 text-left" aria-expanded={viewExpanded} aria-label={`${viewExpanded ? 'Contraer' : 'Expandir'} permisos de ${module.label}`}>
                               <ChevronDown className={cn('size-4 shrink-0 text-primary transition-transform', viewExpanded && 'rotate-180')} />
                               <div className="min-w-0"><p className="truncate text-sm font-bold">{module.label}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{getViewActionDescription(module, 'read')}</p></div>
                             </button>
                             <div className="flex flex-wrap items-center gap-2 pl-7 sm:shrink-0 sm:pl-0">
                               <Badge variant="outline" className="text-[9px] uppercase tracking-wider">{availableActions.length} {availableActions.length === 1 ? 'opción' : 'opciones'}</Badge>
                               <Button type="button" variant="ghost" size="sm" onClick={() => toggleViewPermissions(module)} disabled={roleSaving || (!canEditRoles && !canCreateRoles)} className="h-8 gap-1.5 px-2 text-[10px] font-black uppercase tracking-wider">
                                 {viewEnabled ? <CheckCheck className="size-3.5" /> : <ListChecks className="size-3.5" />}
                                 {viewEnabled ? 'Desmarcar vista' : 'Marcar vista'}
                               </Button>
                             </div>
                           </div>
                           {viewExpanded && (
                             <div className="grid gap-2 border-t border-border/50 px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-3">
                               {availableActions.map(({ key }) => (
                                 <div key={key} className="flex min-w-0 items-start gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                                   <Checkbox checked={permissionValue(permission, key)} onCheckedChange={() => togglePermission(module.id, key)} aria-label={`${module.label}: ${getActionLabel(key)}`} className="mt-0.5" />
                                   <div className="min-w-0"><p className="text-xs font-semibold">{getActionLabel(key)}</p><p className="text-[10px] leading-relaxed text-muted-foreground">{getViewActionDescription(module, key)}</p></div>
                                 </div>
                               ))}
                               {module.id === 'SALES_PRICE_LISTS' && (
                                 <div className="col-span-full space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:p-4">
                                   <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                     <div className="min-w-0">
                                       <p className="text-xs font-bold">Listas de precios permitidas</p>
                                       <p className="text-[10px] leading-relaxed text-muted-foreground">Define qué listas puede consultar y seleccionar este rol al facturar. Las listas nuevas aparecerán aquí automáticamente al volver a editar el rol.</p>
                                     </div>
                                     <Button type="button" variant="outline" size="sm" onClick={toggleAllPriceListAccess} disabled={roleSaving || priceListCatalogLoading || (!canEditRoles && !canCreateRoles) || !priceListCatalog.length} className="h-8 shrink-0 gap-1.5 text-[10px] font-black uppercase tracking-wider">
                                       {priceListScopeIsComplete(permission) ? <CheckCheck className="size-3.5" /> : <ListChecks className="size-3.5" />}
                                       {priceListScopeIsComplete(permission) ? 'Desmarcar todas' : 'Marcar todas'}
                                     </Button>
                                   </div>
                                   {priceListCatalogLoading && <p className="text-[10px] text-muted-foreground">Cargando listas de precios…</p>}
                                   {!priceListCatalogLoading && !priceListCatalog.length && <p className="rounded-lg border border-dashed border-border/60 p-3 text-[10px] text-muted-foreground">No hay listas de precios creadas todavía.</p>}
                                   {!priceListCatalogLoading && priceListCatalog.length > 0 && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                     {priceListCatalog.map((list) => {
                                       const selected = !Object.prototype.hasOwnProperty.call(permission, 'allowedPriceListIds')
                                         || (Array.isArray(permission.allowedPriceListIds) && permission.allowedPriceListIds.includes(list.id));
                                       return <label key={list.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-border/50 bg-card px-3 py-2">
                                         <Checkbox checked={selected} onCheckedChange={() => togglePriceListAccess(list.id)} aria-label={`Lista de precios: ${list.name}`} className="mt-0.5" />
                                         <span className="min-w-0"><span className="block truncate text-xs font-semibold">{list.name}</span><span className="block truncate text-[10px] text-muted-foreground">{list.code}{list.isActive === false ? ' · Inactiva' : ''}</span></span>
                                       </label>;
                                     })}
                                   </div>}
                                 </div>
                               )}
                             </div>
                           )}
                         </div>
                       );
                     })}
                   </div>
                 )}
               </section>
             );
           })}
        </CardContent></Card>
      </>}

      <Dialog open={!!assignedUsersRole} onOpenChange={(open) => !open && setAssignedUsersRole(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="size-5 text-primary" /> Usuarios con el rol {assignedUsersRole?.name}</DialogTitle><DialogDescription>Usuarios que tienen asignado este rol personalizado.</DialogDescription></DialogHeader>
          <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">{users.filter((user: any) => user.customRoleId === assignedUsersRole?.id).map((user: any) => <div key={user.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-4 py-3"><div><p className="text-sm font-bold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div><Badge variant="outline" className="text-[9px] uppercase">{user.isActive ? 'Activo' : 'Suspendido'}</Badge></div>)}{!users.some((user: any) => user.customRoleId === assignedUsersRole?.id) && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Ningún usuario tiene este rol asignado.</div>}</div>
          <DialogFooter><Button variant="outline" onClick={() => setAssignedUsersRole(null)}>Cerrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
