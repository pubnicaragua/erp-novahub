import React, { createContext, useContext, useState, useCallback } from 'react';
import { api, clearRequestCaches } from '../services/api';
import { isLegacyAuthToken, storeAuthToken } from '../services/auth-token';
import { subscriptionsService } from '../services/subscriptions.service';
import { queryClient } from '../services/query-client';
import { clearSessionCache } from '../services/session-cache';
import { clearImplementationSetupCache } from '../services/implementation-setup.service';
import { clearStorageUrlCache } from '../services/storage.service';
import { BrandLogoLoader } from '../components/BrandLogo';
import { SIDEBAR_PERMISSION_PARENT_ALIASES, SIDEBAR_PERMISSION_MODULE_IDS } from '../utils/sidebarPermissions';

export type Role = 'superadmin' | 'admin' | 'partner' | 'manager' | 'employee' | 'viewer';
export type UserType = 'admin' | 'collaborator' | 'manager';

const SESSION_BRANDING_KEY = 'nh-session-branding';

function rememberSessionBranding(payload: any) {
  const apiUser = payload?.user || payload?.data || payload || {};
  const normalizedRole = String(apiUser?.role || '').toLowerCase();
  const normalizedUserType = String(apiUser?.userType || '').toLowerCase();
  const isDetachedPlatformAdmin = !apiUser?.clientTenantId
    && (['superadmin', 'super_admin', 'partner', 'platform_admin'].includes(normalizedRole)
      || (normalizedUserType === 'admin' && normalizedRole !== 'manager'));
  const hasActiveTenantBranding = Boolean(apiUser?.clientTenantId && apiUser?.clientTenant);
  const branding = isDetachedPlatformAdmin
    ? { kind: 'platform', name: 'NovaHub Platform', logo: null }
    : hasActiveTenantBranding
      ? { kind: 'branch', name: apiUser.clientTenant.name, logo: apiUser.clientTenant.logo || null }
      : (apiUser?.sessionBranding || {});
  const logo = branding.logo ?? apiUser?.clientTenant?.logo ?? '';
  const name = branding.name || apiUser?.clientTenant?.name || '';
  if (!logo && !name) {
    localStorage.removeItem(SESSION_BRANDING_KEY);
    return;
  }
  localStorage.setItem(SESSION_BRANDING_KEY, JSON.stringify({
    logo,
    name: name || 'NovaHub ERP',
    kind: branding.kind || (apiUser?.clientTenant ? 'branch' : 'group'),
  }));
}

function getRememberedSessionBranding() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_BRANDING_KEY) || 'null');
    const impersonation = JSON.parse(localStorage.getItem('nh-impersonation-state') || 'null');
    if (impersonation?.branch?.name) {
      return {
        logo: impersonation.branch.logo ?? parsed?.logo ?? null,
        name: impersonation.branch.name,
        kind: 'branch',
      };
    }
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export type Module =
  | 'dashboard'
  | 'inventario'
  | 'ventas'
  | 'restaurante'
  | 'compras'
  | 'finanzas'
  | 'rh'
  | 'clientes'
  | 'facturas'
  | 'inventario_productos'
  | 'inventario_almacenes'
  | 'inventario_transferencias'
  | 'inventario_ajustes'
  | 'inventario_movimientos'
  | 'proveedores'
  | 'actividades'
  | 'tickets'
  | 'documentos'
  | 'notificaciones'
  | 'transferencias'
  | 'reportes'
  | 'roles'
  | 'configuracion'
  | 'suscripciones'
  | 'tenant-admin'
  | 'schema'
  | 'financiamiento-pyme'
  | 'centro-capacitacion'
  | 'soporte-tecnico'
  | 'asesoria-legal'
  | 'novachat'
  | 'inventario_productos'
  | 'contabilidad'
  | 'dashboard-ventas'
  | 'qa-console';

export type SubModule = string;

export interface Permission {
  module: string; // Changed from Module to string to allow granular submodules like 'SALES_CLIENTS'
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canDeactivate: boolean;
  canCancel: boolean;
  canImport: boolean;
  canExport: boolean;
  [action: string]: string | boolean | undefined;
}

export type PermissionAction =
  | 'view' | 'create' | 'edit' | 'delete' | 'deactivate' | 'cancel'
  | 'import' | 'export' | 'approve' | 'reject' | 'authorize' | 'reopen'
  | 'close' | 'confirm' | 'process' | 'pay' | 'apply' | 'reconcile'
  | 'reverse' | 'duplicate' | 'convert' | 'assign' | 'download'
  | 'generate' | 'send' | 'print' | 'manage';

// La matriz de roles expone CRUD, importación/exportación y una acción de
// flujo. Estas acciones legacy siguen aceptándose en las vistas, pero ahora
// se resuelven contra "Aprobar" cuando la vista tiene ese permiso disponible.
const DELETE_COMPATIBLE_ACTIONS: PermissionAction[] = ['deactivate', 'cancel', 'reject', 'reverse'];
const CREATE_COMPATIBLE_ACTIONS: PermissionAction[] = ['duplicate'];
const APPROVAL_COMPATIBLE_ACTIONS: PermissionAction[] = [
  'approve', 'authorize', 'reopen', 'close', 'confirm', 'process', 'pay', 'apply', 'reconcile', 'convert', 'send',
];

/**
 * Cada sesión nueva debe iniciar en el primer módulo accesible. La URL y el
 * almacenamiento local solo representan navegación de la sesión anterior.
 */
function resetNavigationState() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('erp-active-module');
  localStorage.removeItem('erp-active-submodule');

  const url = new URL(window.location.href);
  const hadNavigationParams = url.searchParams.has('m') || url.searchParams.has('sm');
  if (!hadNavigationParams) return;

  url.searchParams.delete('m');
  url.searchParams.delete('sm');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  /** Tipo de identidad canónico. Los roles operativos no incluyen Manager. */
  userType: UserType;
  role: Role;
  customRoleName?: string;
  tenantId: string;
  /** Canonical tenant id used by the current backend session contract. */
  clientTenantId?: string;
  tenantName: string;
  permissions: Permission[];
  enabledModules: string[];
  isPlatformAdmin: boolean;
  isTenantUser: boolean;
  isTenantAdmin: boolean;
  /** Sesión temporal de trabajo de un Manager dentro de una sucursal. */
  managerMode?: boolean;
  managerCanEdit?: boolean;
  branchIds?: string[];
  /** Datos del tenant propietario tal como los devuelve /auth/profile.
   *  `expiresAt` es la fecha real de expiración de la suscripción/trial
   *  (validada contra el servidor, no un flag local editable). */
  clientTenant?: {
    name?: string;
    expiresAt?: string | null;
    isActive?: boolean;
    plan?: string;
    logo?: string;
  } | null;
  /** Marca correspondiente al contexto que se está preparando (grupo o sucursal). */
  sessionBranding?: {
    kind?: 'group' | 'branch' | 'platform';
    name?: string;
    logo?: string | null;
  };
}

/**
 * Los administradores del tenant heredan todas las acciones, pero no pueden
 * saltarse la suscripción de su empresa. Configuración y Mi Empresa son
 * capacidades internas del tenant y no dependen de una suscripción operativa.
 */
const TENANT_SYSTEM_PERMISSION_MODULES = new Set([
  'CONFIGURATION', 'MY_COMPANY', 'SUBSCRIPTIONS',
  'CONFIG_COMPANY', 'CONFIG_BRANDING', 'CONFIG_PDF', 'CONFIG_SECURITY',
  'CONFIG_TENANCY', 'CONFIG_CURRENCY', 'CONFIG_PLATFORM', 'CONFIG_COUNTRIES',
  'CONFIG_MODULE_PRICING', 'CONFIG_USERS', 'CONFIG_ROLES', 'CONFIG_DOMAINS',
  'CONFIG_DEPARTMENTS', 'CONFIG_ORG_CHART', 'COMPANY_BRANCHES',
]);

const TENANT_PERMISSION_SUBSCRIPTION_ALIASES: Record<string, string[]> = {
  // Ventas incluye facturación y caja; la API de Caja conserva RETAIL_POS
  // como permiso canónico, por lo que ambos módulos deben ser equivalentes.
  RETAIL_POS: ['RETAIL_POS', 'SALES_POS', 'SALES', 'CAJA'],
  FINANCIAL_ACCOUNTS: ['FINANCIAL_ACCOUNTS', 'FINANCIAL_BANK', 'FINANCIAL_DASHBOARD', 'FINANCIAL_BALANCE'],
  FINANCIAL_INCOMES: ['FINANCIAL_INCOMES', 'FINANCIAL_RECEIVABLES', 'FINANCIAL_DASHBOARD', 'FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'],
  FINANCIAL_RECEIVABLES: ['FINANCIAL_RECEIVABLES', 'FINANCIAL_INCOMES', 'FINANCIAL_DASHBOARD', 'FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'],
  FINANCIAL_EXPENSES: ['FINANCIAL_EXPENSES', 'FINANCIAL_PAYABLES', 'FINANCIAL_DASHBOARD', 'FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE', 'FINANCIAL_LOSSES'],
  FINANCIAL_PAYABLES: ['FINANCIAL_PAYABLES', 'FINANCIAL_EXPENSES', 'FINANCIAL_DASHBOARD', 'FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'],
  FINANCIAL_EXPENSES_REC: ['FINANCIAL_EXPENSES_REC', 'FINANCIAL_CALENDAR', 'FINANCIAL_ANALYSIS', 'FINANCIAL_DASHBOARD'],
  FINANCIAL_CALENDAR: ['FINANCIAL_CALENDAR', 'FINANCIAL_DASHBOARD', 'FINANCIAL_EXPENSES_REC'],
  FINANCIAL_ANALYSIS: ['FINANCIAL_ANALYSIS', 'FINANCIAL_REPORTS', 'FINANCIAL_BALANCE', 'FINANCIAL_DASHBOARD'],
  FINANCIAL_LOSSES: ['FINANCIAL_LOSSES', 'FINANCIAL_EXPENSES'],
  SALES_CLIENTS: ['SALES_CLIENTS', 'SALES', 'CLIENTS'],
  PURCHASES_PROVIDERS: ['PURCHASES_PROVIDERS', 'PURCHASES', 'PROVIDERS'],
};

function tenantPermissionSubscriptionCandidates(module: string): string[] {
  const normalized = String(module || '').toUpperCase();
  const candidates = new Set(TENANT_PERMISSION_SUBSCRIPTION_ALIASES[normalized] || [normalized]);
  const parent = normalized.split('_')[0];
  if (['SALES', 'PURCHASES', 'INVENTORY', 'FINANCIAL', 'HR', 'ACCOUNTING', 'ACTIVITIES', 'DOCUMENTS', 'NOTIFICATIONS', 'REPORTS', 'TICKETS', 'LEGAL'].includes(parent)) {
    candidates.add(parent);
  }
  return [...candidates];
}

function tenantAdminHasModuleEnabled(user: User, module: string): boolean {
  const normalized = String(module || '').toUpperCase();
  if (TENANT_SYSTEM_PERMISSION_MODULES.has(normalized)) return true;
  const enabledModules = new Set((user.enabledModules || []).map((item) => String(item).toUpperCase()));
  return tenantPermissionSubscriptionCandidates(normalized).some((candidate) => enabledModules.has(candidate));
}

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  location?: string;
}

function clearClientSessionState(options: { preserveAuthToken?: boolean; preserveImpersonation?: boolean; preserveSessionBranding?: boolean } = {}) {
  void queryClient.cancelQueries();
  queryClient.clear();
  clearRequestCaches();
  clearImplementationSetupCache();
  clearStorageUrlCache();
  clearSessionCache(options);
  if (typeof window !== 'undefined' && !options.preserveAuthToken) {
    window.dispatchEvent(new CustomEvent('auth-session-reset'));
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasAccess: (module: string) => boolean;
  canPerform: (module: string, action: PermissionAction) => boolean;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Sets the auth session from a pre-existing token + user pair.
   * Used by the free-trial registration flow where the backend
   * already returns a valid JWT and the user object.
   */
  setSession: (token: string, user: any) => void;
  logout: () => void;
  switchIdentity: (userId: string) => Promise<void>;
  refreshEnabledModules: () => Promise<void>;
  /** Incrementa cada vez que una sesión autenticada debe iniciar navegación limpia. */
  sessionStartVersion: number;
  isLoading: boolean;
  userBranches: BranchInfo[];
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_MODULES: Module[] = [
  'dashboard', 'inventario', 'ventas', 'restaurante', 'compras', 'finanzas', 'rh',
  'clientes', 'proveedores', 'actividades', 'tickets',
  'documentos', 'notificaciones', 'transferencias',
  'reportes', 'roles', 'configuracion', 'suscripciones', 'schema',
  'financiamiento-pyme', 'centro-capacitacion', 'soporte-tecnico', 'asesoria-legal',
  'contabilidad', 'novachat', 'qa-console',
];

const getPermissionsByRole = (role: Role): Permission[] => {
  switch (role) {
    case 'superadmin':
    case 'admin':
      return ALL_MODULES.map(module => ({
        module,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canDeactivate: true,
        canCancel: true,
        canImport: true,
        canExport: true,
      }));
    case 'manager':
      return ALL_MODULES.map(module => ({
        module,
        canView: true,
        canCreate: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canEdit: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canDelete: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canDeactivate: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canCancel: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canImport: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canExport: true,
      }));
    case 'employee':
      return ALL_MODULES.map(module => ({
        module,
        canView: !['roles', 'configuracion', 'finanzas', 'suscripciones', 'schema'].includes(module),
        canCreate: false, // Por defecto no crea nada sin un rol específico
        canEdit: false,   // Por defecto no edita nada sin un rol específico
        canDelete: false,
        canDeactivate: false,
        canCancel: false,
        canImport: false,
        canExport: false,
      }));
    case 'partner':
      return ALL_MODULES.map(module => ({
        module,
        canView: ['notificaciones', 'configuracion', 'reportes', 'dashboard', 'suscripciones', 'clientes'].includes(module),
        canCreate: ['suscripciones', 'clientes'].includes(module),
        canEdit: ['suscripciones', 'clientes'].includes(module),
        canDelete: false,
        canDeactivate: false,
        canCancel: false,
        canImport: false,
        canExport: ['notificaciones', 'configuracion', 'reportes', 'clientes'].includes(module),
      }));
    case 'viewer':
      return ALL_MODULES.map(module => ({
        module,
        canView: module !== 'roles' && module !== 'configuracion' && module !== 'rh' && module !== 'schema',
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canDeactivate: false,
        canCancel: false,
        canImport: false,
        canExport: false,
      }));
    default:
      return ALL_MODULES.map(module => ({
        module,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canDeactivate: false,
        canCancel: false,
        canImport: false,
        canExport: false,
      }));
  }
};

const normalizeRole = (rawRole: string): Role => {
  if (!rawRole) return 'employee';
  const lowered = rawRole.toLowerCase().replace(/[^a-z_]/g, '');
  if (lowered === 'superadmin' || lowered === 'super_admin') return 'superadmin';
  return lowered as Role;
};

const createUserObject = (apiPayload: any): User => {
  // Manejar el caso donde el backend devuelve { user: {...} } o { data: {...} }
  const apiUser = apiPayload?.user || apiPayload?.data || apiPayload || {};
  
  const normalizedUserType = String(apiUser?.userType || '').toLowerCase();
  const userType: UserType = normalizedUserType === 'manager'
    ? 'manager'
    : normalizedUserType === 'admin'
      ? 'admin'
      : ['manager'].includes(String(apiUser?.role || '').toLowerCase())
        ? 'manager'
        : ['admin', 'super_admin', 'partner'].includes(String(apiUser?.role || '').toLowerCase())
          ? 'admin'
          : 'collaborator';
  // `role=manager` se mantiene como compatibilidad de presentación para
  // sesiones antiguas, pero la fuente de verdad es userType.
  const role = userType === 'manager' ? 'manager' : normalizeRole(apiUser?.role);
  
  // Platform Admins: SuperAdmin, Partner, or DEV admin
  // Las cuentas de plataforma históricas pueden llegar como ADMIN después
  // de la normalización de roles. La separación real es que no tienen
  // clientTenantId; los Managers quedan fuera porque su userType es MANAGER.
  const isPlatformAdmin = ['superadmin', 'partner'].includes(role)
    || (!apiUser.clientTenantId && userType === 'admin' && role !== 'manager');

  const hasActiveTenantBranding = Boolean(apiUser?.clientTenantId && apiUser?.clientTenant);
  const sessionBranding = isPlatformAdmin
    ? { kind: 'platform' as const, name: 'NovaHub Platform', logo: null }
    : hasActiveTenantBranding
      ? { kind: 'branch' as const, name: apiUser.clientTenant.name, logo: apiUser.clientTenant.logo || null }
      : apiUser.sessionBranding || (apiUser.clientTenant
        ? { kind: 'branch' as const, name: apiUser.clientTenant.name, logo: apiUser.clientTenant.logo || null }
        : undefined);
  
  const moduleEnumMapInverse: Record<string, string> = {
    'SALES': 'ventas',
    'PURCHASES': 'compras',
    'INVENTORY': 'inventario',
    'FINANCIAL': 'finanzas',
    'HR': 'rh',
    'PROJECTS': 'proyectos',
    'CLIENTS': 'clientes',
    'PROVIDERS': 'proveedores',
    'TOOLS': 'herramientas',
    'ACTIVITIES': 'actividades',
    'DOCUMENTS': 'documentos',
    'NOVACHAT': 'novachat',
    'NOTIFICATIONS': 'notificaciones',
    'REPORTS': 'reportes',
    'TICKETS': 'tickets',
    'ACCOUNTING': 'contabilidad',
    'CONFIGURATION': 'configuracion',
    'CONFIG_ROLES': 'roles',
    'CONFIG_USERS': 'usuarios',
    'SUBSCRIPTIONS': 'suscripciones',
    'QA_CONSOLE': 'qa-console',
    'RETAIL_POS': 'ventas',
    'FINANCING': 'financiamiento-pyme',
    'LEGAL': 'asesoria-legal',
    'HR_TRAINING': 'centro-capacitacion',
    'SUPPORT_TECH': 'soporte-tecnico'
  };

  const defaultPermissions = getPermissionsByRole(role);
  const specialPermissionActions = [
    'approve', 'reject', 'authorize', 'reopen', 'close', 'confirm', 'process', 'pay',
    'apply', 'reconcile', 'reverse', 'duplicate', 'convert', 'assign', 'download',
    'generate', 'send', 'print', 'manage',
  ] as const;
  const mapSpecialPermissionFlags = (permission: any) => Object.fromEntries(
    specialPermissionActions.map(action => [
      `can${action.charAt(0).toUpperCase()}${action.slice(1)}`,
      permission?.[action] === true,
    ]),
  );
  
  // Normalizar permisos del servidor: puede venir como objeto {moduleName: {read,write,delete}} o como array
  const rawPerms = apiUser.permissions;
  let serverPermissionsSnippet: any[] = [];
  if (Array.isArray(rawPerms)) {
    serverPermissionsSnippet = rawPerms;
  } else if (rawPerms && typeof rawPerms === 'object') {
    // Convertir objeto a array: { ventas: { read: true, write: true, delete: false } } => [{ module: 'ventas', read: true, ... }]
    serverPermissionsSnippet = Object.entries(rawPerms).map(([key, val]: [string, any]) => ({
      module: key,
      ...(typeof val === 'object' ? val : {}),
    }));
  }
  
  // Mapeamos los permisos del servidor a la estructura del frontend
  const mergedPermissions = defaultPermissions.map(def => {
    // Buscar si el servidor envió algo para este módulo (o su nombre interno en el backend)
    const serverMatch = serverPermissionsSnippet.find((sp: any) => {
      const spMod = (sp.module || sp.id || '').toUpperCase();
      const defModBackend = Object.entries(moduleEnumMapInverse).find(([_, v]) => v === def.module)?.[0] || def.module.toUpperCase();
      return spMod === defModBackend || spMod === def.module.toUpperCase();
    });

    if (serverMatch) {
      return {
        module: def.module,
        canView: serverMatch.read !== undefined ? !!serverMatch.read : serverMatch.view !== undefined ? !!serverMatch.view : !!serverMatch.canView,
        canCreate: serverMatch.create !== undefined ? !!serverMatch.create : serverMatch.write !== undefined ? !!serverMatch.write : !!serverMatch.canCreate,
        canEdit: serverMatch.edit !== undefined ? !!serverMatch.edit : serverMatch.write !== undefined ? !!serverMatch.write : !!serverMatch.canEdit,
        canDelete: serverMatch.delete !== undefined ? !!serverMatch.delete : !!serverMatch.canDelete,
        canDeactivate: serverMatch.deactivate !== undefined ? !!serverMatch.deactivate : !!serverMatch.delete,
        canCancel: serverMatch.cancel !== undefined ? !!serverMatch.cancel : !!serverMatch.delete,
        canImport: !!serverMatch.import,
        canExport: !!serverMatch.export,
        approve: Object.prototype.hasOwnProperty.call(serverMatch, 'approve') ? !!serverMatch.approve : undefined,
        ...mapSpecialPermissionFlags(serverMatch),
      };
    }
    
    // Si tiene un rol personalizado pero no hay permiso explícito del servidor para este módulo
    // y NO es un admin global, denegamos cualquier acción de escritura/borrado.
    if (apiUser.customRoleId && !['admin', 'superadmin', 'partner'].includes(role)) {
      return {
        ...def,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canDeactivate: false,
        canCancel: false,
        canImport: false,
        canExport: false,
      };
    }
    
    return def;
  });

  // Include granular permissions that were not in ALL_MODULES
  serverPermissionsSnippet.forEach((sp: any) => {
    const spMod = (sp.module || sp.id || '').toUpperCase();
    const mappedModule = moduleEnumMapInverse[spMod] || spMod;
    if (!mergedPermissions.find(p => p.module.toUpperCase() === mappedModule.toUpperCase() || p.module.toUpperCase() === spMod)) {
      mergedPermissions.push({
        module: mappedModule,
        canView: sp.read !== undefined ? !!sp.read : sp.view !== undefined ? !!sp.view : !!sp.canView,
        canCreate: sp.create !== undefined ? !!sp.create : sp.write !== undefined ? !!sp.write : !!sp.canCreate,
        canEdit: sp.edit !== undefined ? !!sp.edit : sp.write !== undefined ? !!sp.write : !!sp.canEdit,
        canDelete: sp.delete !== undefined ? !!sp.delete : !!sp.canDelete,
        canDeactivate: sp.deactivate !== undefined ? !!sp.deactivate : !!sp.delete,
        canCancel: sp.cancel !== undefined ? !!sp.cancel : !!sp.delete,
        canImport: !!sp.import,
        canExport: !!sp.export,
        approve: Object.prototype.hasOwnProperty.call(sp, 'approve') ? !!sp.approve : undefined,
        ...mapSpecialPermissionFlags(sp),
      });
    }
  });

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    avatar: apiUser.avatar,
    userType,
    role,
    customRoleName: apiUser.customRoleName,
    // Un SuperAdmin es una identidad de plataforma, no un usuario operativo
    // de una sucursal. Conservamos el tenantId vacío en el frontend para que
    // ningún módulo tenant intente usarlo accidentalmente.
    tenantId: apiUser.clientTenantId || '',
    clientTenantId: apiUser.clientTenantId || undefined,
    tenantName: isPlatformAdmin ? 'NovaHub Platform' : (apiUser.clientTenant?.name || 'Nova Hub'),
    permissions: mergedPermissions,
    enabledModules: apiUser.enabledModules || [],
    isPlatformAdmin,
    isTenantUser: !isPlatformAdmin,
    isTenantAdmin: userType === 'admin' && role === 'admin' && !isPlatformAdmin,
    managerMode: Boolean(apiUser.managerMode),
    managerCanEdit: Boolean(apiUser.managerCanEdit),
    branchIds: apiUser.branchIds || apiUser.branchAccess?.map((b: any) => b.id) || undefined,
    sessionBranding,
    clientTenant: apiUser.clientTenant
      ? {
          name: apiUser.clientTenant.name,
          expiresAt: apiUser.clientTenant.expiresAt ?? null,
          isActive: apiUser.clientTenant.isActive,
          plan: apiUser.clientTenant.plan,
          logo: apiUser.clientTenant.logo,
        }
      : null,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionStartVersion, setSessionStartVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userBranches, setUserBranches] = useState<BranchInfo[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  React.useEffect(() => {
    const remembered = isLoading ? getRememberedSessionBranding() : {};
    const workspaceName = user?.sessionBranding?.name
      || user?.clientTenant?.name
      || user?.tenantName
      || remembered.name
      || 'NovaHub ERP';
    document.title = workspaceName;
  }, [isLoading, user?.sessionBranding?.name, user?.clientTenant?.name, user?.tenantName]);

  React.useEffect(() => {
    const handleExternalLogout = (event: StorageEvent) => {
      if (event.key !== 'nh-auth-token' || event.newValue !== null) return;
      clearClientSessionState();
      resetNavigationState();
      setUser(null);
      setUserBranches([]);
      setSelectedBranchId(null);
    };

    window.addEventListener('storage', handleExternalLogout);
    return () => window.removeEventListener('storage', handleExternalLogout);
  }, []);

  const fetchBranches = useCallback(async () => {
    setUserBranches([]);
    setSelectedBranchId(null);
    try {
      const res = await api.get<any>('/auth/me/branches');
      const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
      const mapped = list.map((b: any) => ({ id: b.id, name: b.name, code: b.code, location: b.location }));
      setUserBranches(mapped);
      if (mapped.length === 1) {
        setSelectedBranchId(mapped[0].id);
      }
    } catch {
      setUserBranches([]);
      setSelectedBranchId(null);
    }
  }, []);

  const isAuthenticated = user !== null;

  // Restore session from localStorage on mount
  React.useEffect(() => {
    const restoreSession = async () => {
      try {
        // A hard refresh can leave persisted UI/cache state from a previous
        // identity. Keep only the token long enough to validate it again.
        clearClientSessionState({ preserveAuthToken: true, preserveImpersonation: true, preserveSessionBranding: true });
        setUserBranches([]);
        setSelectedBranchId(null);
        const token = localStorage.getItem('nh-auth-token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        if (isLegacyAuthToken(token)) {
          localStorage.removeItem('nh-auth-token');
          setIsLoading(false);
          return;
        }

        try {
          const me = await api.get<any>('/auth/profile');
          rememberSessionBranding(me);
          setUser(createUserObject(me));
          fetchBranches();
        } catch {
          // Backward compatibility with backends that still use switch-context for session restore.
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userId = payload.sub;
          if (!userId) {
            localStorage.removeItem('nh-auth-token');
            setIsLoading(false);
            return;
          }
          const response = await api.post<{ access_token: string; user: any }>('/auth/switch-context', { userId });
          storeAuthToken(response.access_token);
          rememberSessionBranding(response.user);
          setUser(createUserObject(response.user));
          fetchBranches();
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('nh-auth-token');
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const hasAccess = useCallback((module: string): boolean => {
    if (!user) return false;

    // Platform Admins (SuperAdmin, Partner) don't have ERP modules, only platform control modules.
    if (user.isPlatformAdmin) {
      const platformModules = [
        'dashboard', 'suscripciones', 'tenant-admin', 'configuracion', 'notificaciones',
        'centro-capacitacion', 'soporte-tecnico', 'asesoria-legal', 'novachat',
        'qa-console',
      ];
      const platformConfigurationModules = [
        'CONFIGURATION', 'CONFIG_COMPANY', 'CONFIG_BRANDING', 'CONFIG_PDF',
        'CONFIG_SECURITY', 'CONFIG_ROLES', 'CONFIG_USERS', 'CONFIG_TENANCY',
        'CONFIG_CURRENCY', 'CONFIG_PLATFORM', 'CONFIG_COUNTRIES', 'CONFIG_MODULE_PRICING', 'CONFIG_DOMAINS',
      ];
      if (module === 'qa-console') return user.role === 'superadmin';
      if (platformConfigurationModules.includes(String(module).toUpperCase())) return true;
      return platformModules.includes(module);
    }

    // Módulos solo para admin
    const adminOnlyModules = ['schema'];
    if (adminOnlyModules.includes(module) && !user.isTenantAdmin) return false;

    // 1. Verificar si el módulo está habilitado para el tenant (Suscripción)
    // Algunos módulos de sistema siempre están activos
    const coreModules = [
      'configuracion', 'dashboard', 'suscripciones',
    ];
    const moduleEnumMap: Record<string, string> = {
      'ventas': 'SALES',
      'restaurante': 'RESTAURANT',
      'compras': 'PURCHASES',
      'inventario': 'INVENTORY',
      'finanzas': 'FINANCIAL',
      'rh': 'HR',
      'proyectos': 'PROJECTS',
      'clientes': 'CLIENTS',
      'proveedores': 'PROVIDERS',
      'herramientas': 'TOOLS',
      'actividades': 'ACTIVITIES',
      'tickets': 'TOOLS',
      'documentos': 'DOCUMENTS',
      'notificaciones': 'NOTIFICATIONS',
      'reportes': 'REPORTS',
      'contabilidad': 'ACCOUNTING',
      'financiamiento-pyme': 'FINANCING',
      'asesoria-legal': 'LEGAL',
      'centro-capacitacion': 'HR_TRAINING',
      'soporte-tecnico': 'SUPPORT_TECH',
      'novachat': 'NOVACHAT',
      'roles': 'CONFIG_ROLES',
      'usuarios': 'CONFIG_USERS',
      'configuracion': 'CONFIGURATION',
      'suscripciones': 'MY_COMPANY',
    };
    const moduleGroupMap: Record<string, string[]> = {
      ventas: [
        'SALES', 'CLIENTS',
        'SALES_CLIENTS', 'SALES_QUOTES', 'SALES_ORDERS', 'SALES_INVOICES',
        'SALES_RECURRING', 'SALES_RETURNS', 'SALES_CREDIT_NOTES', 'SALES_PAYMENTS', 'RETAIL_POS', 'SALES_POS',
        'SALES_PRICE_LISTS',
      ],
       restaurante: ['RESTAURANT'],
      compras: [
        'PURCHASES', 'PROVIDERS',
        'PURCHASES_PROVIDERS', 'PURCHASES_REQUESTS', 'PURCHASES_EXPENSES', 'PURCHASES_EXPENSES_REC',
        'PURCHASES_ORDERS', 'PURCHASES_RECEIPTS',
        'PURCHASES_INVOICES_REC', 'PURCHASES_RETURNS', 'PURCHASES_PAYMENTS',
      ],
      inventario: [
        'INVENTORY',
        'INVENTORY_PRODUCTS', 'INVENTORY_WAREHOUSES', 'INVENTORY_TRANSFERS',
        'INVENTORY_ADJUSTMENTS',
        'INVENTORY_MOVEMENTS',
      ],
      finanzas: [
        'FINANCIAL', 'FINANCIAL_BANK',
        'FINANCIAL_INCOMES', 'FINANCIAL_EXPENSES', 'FINANCIAL_EXPENSES_REC', 'FINANCIAL_BALANCE', 'FINANCIAL_DASHBOARD',
      ],
      actividades: [
        'ACTIVITIES',
        'ACTIVITIES_TASKS', 'ACTIVITIES_EVENTS', 'ACTIVITIES_REMINDERS', 'ACTIVITIES_LOGS',
      ],
      documentos: [
        'DOCUMENTS',
        'DOCUMENTS_FILES', 'DOCUMENTS_CONTRACTS', 'DOCUMENTS_INVOICES', 'DOCUMENTS_REPORTS',
      ],
      notificaciones: [
        'NOTIFICATIONS',
        'NOTIFICATIONS_ALERTS', 'NOTIFICATIONS_MESSAGES', 'NOTIFICATIONS_PUSH',
      ],
      reportes: [
        'REPORTS',
        'REPORTS_SALES', 'REPORTS_PURCHASES', 'REPORTS_FINANCIAL', 'REPORTS_INVENTORY', 'REPORTS_CLIENTS', 'REPORTS_PROVIDERS', 'REPORTS_HR', 'REPORTS_SUBSCRIPTIONS',
      ],
      tickets: [
        'TICKETS', 'TICKETS_KNOWLEDGE_BASE', 'TICKETS_AGENTS',
      ],
      contabilidad: [
        'ACCOUNTING',
        'ACCOUNTING_CHART', 'ACCOUNTING_JOURNAL', 'ACCOUNTING_HR_PAYMENT_REQUESTS', 'ACCOUNTING_TRIAL_BALANCE',
        'ACCOUNTING_PROFIT_LOSS', 'ACCOUNTING_BALANCE_SHEET', 'ACCOUNTING_CASH_FLOW',
        'ACCOUNTING_LEDGER', 'ACCOUNTING_EXCHANGE_DIFFERENCES', 'ACCOUNTING_EQUITY', 'ACCOUNTING_ASSETS',
        'ACCOUNTING_RECONCILIATION', 'ACCOUNTING_PERIODS', 'ACCOUNTING_FISCAL',
        'ACCOUNTING_INVOICE_AUDIT', 'ACCOUNTING_BUDGET', 'ACCOUNTING_EXPENSE_CATEGORIES', 'ACCOUNTING_CONFIG',
      ],
      clientes: ['SALES', 'CLIENTS', 'SALES_CLIENTS'],
      proveedores: ['PURCHASES', 'PROVIDERS', 'PURCHASES_PROVIDERS'],
      'financiamiento-pyme': ['FINANCING'],
      'asesoria-legal': ['LEGAL'],
      'centro-capacitacion': ['HR_TRAINING', 'TRAINING'],
      'soporte-tecnico': ['SUPPORT_TECH', 'SUPPORT'],
      'novachat': ['NOVACHAT'],
    };

    const backendModuleName = moduleEnumMap[module] || module.toUpperCase();
    const isAdminControlModule = adminOnlyModules.includes(module) && user.isTenantAdmin;
    const groupModules = moduleGroupMap[module] || [];
    
    // HR es especial: buscar cualquier submódulo HR_*
    let isSubscribed = coreModules.includes(module)
      || isAdminControlModule
      || user.enabledModules.includes(backendModuleName)
      || groupModules.some(m => user.enabledModules.includes(m));
    
    if (module === 'rh' && !isSubscribed) {
      isSubscribed = user.enabledModules.some(m => m.startsWith('HR_'));
    }

    if (!isSubscribed) return false;

    // Al entrar a una sucursal, el Manager debe ver el mismo menú operativo
    // que el usuario administrador de esa sucursal. El backend sigue
    // validando la suscripción y el contexto Manager en cada request.
    if (user.managerMode) return true;

    // El ADMIN tiene todas las acciones, pero únicamente dentro de los
    // módulos habilitados para su empresa.
    if (user.isTenantAdmin) return true;

    // 2. Verificar permisos del Rol
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    const directPermission = permissions.find((p) => p.module.toUpperCase() === module.toUpperCase())
      || permissions.find((p) => p.module.toUpperCase() === backendModuleName.toUpperCase());
    if (directPermission?.canView) return true;

    const parentAliases = SIDEBAR_PERMISSION_PARENT_ALIASES[backendModuleName] || [];
    if (permissions.some((permission) =>
      parentAliases.includes(String(permission.module || '').toUpperCase()) && permission.canView
    )) return true;

    // A granular role may omit the parent row while still granting access to
    // one or more views inside the module; that is enough to render the shell.
    return permissions.some((permission) => {
      const key = permission.module.toUpperCase();
      return SIDEBAR_PERMISSION_MODULE_IDS.has(key)
        && key.startsWith(`${backendModuleName.toUpperCase()}_`)
        && permission.canView;
    });
  }, [user]);

  const canPerform = useCallback((module: string, action: PermissionAction): boolean => {
    if (!user) return false;
    if (user.managerMode) return tenantAdminHasModuleEnabled(user, module);
    // El administrador de la empresa tiene todas las acciones de los módulos
    // habilitados, incluidos permisos de flujo nuevos.
    if (user.isTenantAdmin) return tenantAdminHasModuleEnabled(user, module);
    if (user.isPlatformAdmin) return hasAccess(module);

    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    const normalizedModule = String(module || '');
    const upperModule = normalizedModule.toUpperCase();
    const parentByGranularPrefix: Record<string, string> = {
      'PURCHASES_': 'PURCHASES',
      'SALES_': 'SALES',
      'INVENTORY_': 'INVENTORY',
      'FINANCIAL_': 'FINANCIAL',
      'HR_': 'HR',
      'NOTIFICATIONS_': 'NOTIFICATIONS',
      'REPORTS_': 'REPORTS',
      'DOCUMENTS_': 'DOCUMENTS',
      'ACTIVITIES_': 'ACTIVITIES',
      'PROVIDERS_': 'PROVIDERS',
      'CLIENTS_': 'CLIENTS',
      'ACCOUNTING_': 'ACCOUNTING',
      'CONFIG_': 'CONFIGURATION',
      'MY_COMPANY_': 'MY_COMPANY',
    };

    const findPermission = (moduleName: string) => permissions.find(
      (p) => String(p.module || '').toUpperCase() === String(moduleName || '').toUpperCase(),
    );

    let permission = findPermission(normalizedModule);
    if (!permission) {
      const parentAlias = Object.entries(SIDEBAR_PERMISSION_PARENT_ALIASES)
        .find(([, aliases]) => aliases.includes(upperModule))?.[0];
      if (parentAlias) permission = findPermission(parentAlias);
    }
    if (!permission) {
      const moduleEnumMap: Record<string, string> = {
        'inventario': 'INVENTORY',
        'ventas': 'SALES',
        'compras': 'PURCHASES',
        'finanzas': 'FINANCIAL',
        'rh': 'HR',
        'proyectos': 'PROJECTS',
        'clientes': 'CLIENTS',
        'proveedores': 'PROVIDERS',
        'herramientas': 'TOOLS',
        'actividades': 'ACTIVITIES',
        'documentos': 'DOCUMENTS',
      'notificaciones': 'NOTIFICATIONS',
      'reportes': 'REPORTS',
      'tickets': 'TICKETS',
      'contabilidad': 'ACCOUNTING',
      'roles': 'CONFIG_ROLES',
      'usuarios': 'CONFIG_USERS',
      'configuracion': 'CONFIGURATION',
      'suscripciones': 'SUBSCRIPTIONS',
      'qa-console': 'QA_CONSOLE',
        'financiamiento-pyme': 'FINANCING',
        'asesoria-legal': 'LEGAL',
        'centro-capacitacion': 'HR_TRAINING',
        'soporte-tecnico': 'SUPPORT_TECH',
        'novachat': 'NOVACHAT',
      };
      const mappedModule = Object.entries(moduleEnumMap).find(([, v]) => v === normalizedModule)?.[0];
      if (mappedModule) permission = findPermission(mappedModule);
      if (!permission) {
        const parentModule = Object.entries(parentByGranularPrefix).find(([prefix]) => upperModule.startsWith(prefix))?.[1];
        if (parentModule) permission = findPermission(parentModule);
      }
    }

    if (!permission) return false;
    if (permission.canManage === true) return true;
    const legacyActionAllowed = (permission as any)[`can${action.charAt(0).toUpperCase()}${action.slice(1)}`] === true;
    switch (action) {
      case 'view': return permission.canView;
      case 'create': return permission.canCreate;
      case 'edit': return permission.canEdit;
      case 'delete': return permission.canDelete || permission.canDeactivate || permission.canCancel || legacyActionAllowed;
      case 'import': return permission.canImport;
      case 'export': return permission.canExport;
      default:
        if (DELETE_COMPATIBLE_ACTIONS.includes(action)) return permission.canDelete || permission.canDeactivate || permission.canCancel || legacyActionAllowed;
        if (action === 'download') return permission.canExport || legacyActionAllowed;
        if (APPROVAL_COMPATIBLE_ACTIONS.includes(action)) {
          return (permission as any).approve !== undefined
            ? (permission as any).approve === true
            : permission.canEdit || legacyActionAllowed;
        }
        if (CREATE_COMPATIBLE_ACTIONS.includes(action)) return permission.canCreate || legacyActionAllowed;
        return permission.canEdit || legacyActionAllowed;
    }
  }, [user, hasAccess]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      // Do not let a new login reuse any in-memory query, request or local
      // tenant state from the previous identity.
      clearClientSessionState();
      setUser(null);
      setUserBranches([]);
      setSelectedBranchId(null);
      const response = await api.post<{ access_token: string; user: any }>('/auth/login', { email, password });

      resetNavigationState();
      setSessionStartVersion((version) => version + 1);
      storeAuthToken(response.access_token);
      rememberSessionBranding(response.user);
      setUser(createUserObject(response.user));
      fetchBranches();
    } catch (error: any) {
      throw new Error(error.message || 'Error al iniciar sesión. Verifica tus credenciales.', { cause: error });
    }
  }, [fetchBranches]);

  const setSession = useCallback((token: string, userData: any) => {
    clearClientSessionState();
    setUser(null);
    setUserBranches([]);
    setSelectedBranchId(null);
    resetNavigationState();
    setSessionStartVersion((version) => version + 1);
    storeAuthToken(token);
    rememberSessionBranding(userData);
    setUser(createUserObject(userData));
    fetchBranches();
  }, [fetchBranches]);

  const logout = useCallback(() => {
    clearClientSessionState();
    resetNavigationState();
    setUser(null);
    setUserBranches([]);
    setSelectedBranchId(null);
    localStorage.removeItem('nh-auth-token');
    localStorage.removeItem(SESSION_BRANDING_KEY);
    localStorage.removeItem('erp-active-module');
    localStorage.removeItem('erp-active-submodule');
  }, []);

  const switchIdentity = useCallback(async (userId: string) => {
    if (!(import.meta as any).env.DEV) {
      console.warn('switchIdentity is disabled outside development');
      return;
    }
    try {
      // This development-only identity switch must follow the same cache
      // boundary as a normal login, while keeping the current token long
      // enough to authorize the switch-context request.
      clearClientSessionState({ preserveAuthToken: true });
      const response = await api.post<{ access_token: string; user: any }>('/auth/switch-context', { userId });
      window.dispatchEvent(new CustomEvent('auth-session-reset'));
      storeAuthToken(response.access_token);
      rememberSessionBranding(response.user);
      setSessionStartVersion((version) => version + 1);
      localStorage.removeItem('erp-active-module');
      localStorage.removeItem('erp-active-submodule');
      
      setUser(createUserObject(response.user));
      window.location.reload(); // Recargar para asegurar que todos los servicios se reinicien
    } catch (error: any) {
      console.error('Error switching identity:', error);
    }
  }, []);

  const refreshEnabledModules = useCallback(async () => {
    if (!user) return;
    try {
      const modules = await subscriptionsService.getEnabledModules(user.tenantId);
      const moduleList = Array.isArray(modules) ? modules : (modules as any)?.data || [];
      setUser(prev => prev ? { ...prev, enabledModules: moduleList } : prev);
    } catch (error) {
      console.error('Error refreshing enabledModules:', error);
    }
  }, [user?.tenantId]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, hasAccess, canPerform, login, setSession, logout, switchIdentity, refreshEnabledModules, sessionStartVersion, isLoading, userBranches, selectedBranchId, setSelectedBranchId }}>
      {isLoading ? (
        <BrandLogoLoader
          logo={getRememberedSessionBranding().logo}
          title={getRememberedSessionBranding().name || 'NovaHub ERP'}
          kind={getRememberedSessionBranding().kind || 'group'}
          description="Cargando tu sesión segura…"
        />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
