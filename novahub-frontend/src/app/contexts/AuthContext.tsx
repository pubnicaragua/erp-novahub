import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';
import { subscriptionsService } from '../services/subscriptions.service';

export type Role = 'superadmin' | 'admin' | 'partner' | 'manager' | 'employee' | 'viewer';

export type Module =
  | 'inventario'
  | 'ventas'
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
  | 'schema'
  | 'inventario_productos';

export type SubModule = string;

export interface Permission {
  module: string; // Changed from Module to string to allow granular submodules like 'SALES_CLIENTS'
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  customRoleName?: string;
  tenantId: string;
  tenantName: string;
  permissions: Permission[];
  enabledModules: string[];
  isPlatformAdmin: boolean;
  isTenantUser: boolean;
  isTenantAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasAccess: (module: string) => boolean;
  canPerform: (module: string, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  switchIdentity: (userId: string) => Promise<void>;
  refreshEnabledModules: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ALL_MODULES: Module[] = [
  'inventario', 'ventas', 'compras', 'finanzas', 'rh',
  'clientes', 'proveedores', 'actividades', 'tickets',
  'documentos', 'notificaciones', 'transferencias',
  'reportes', 'roles', 'configuracion', 'suscripciones', 'schema',
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
      }));
    case 'manager':
      return ALL_MODULES.map(module => ({
        module,
        canView: true,
        canCreate: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canEdit: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
        canDelete: !['roles', 'configuracion', 'schema', 'suscripciones'].includes(module),
      }));
    case 'employee':
      return ALL_MODULES.map(module => ({
        module,
        canView: !['roles', 'configuracion', 'finanzas', 'suscripciones', 'schema'].includes(module),
        canCreate: false, // Por defecto no crea nada sin un rol específico
        canEdit: false,   // Por defecto no edita nada sin un rol específico
        canDelete: false,
      }));
    case 'partner':
      return ALL_MODULES.map(module => ({
        module,
        canView: ['notificaciones', 'configuracion', 'reportes', 'dashboard', 'suscripciones', 'clientes'].includes(module),
        canCreate: ['suscripciones', 'clientes'].includes(module),
        canEdit: ['suscripciones', 'clientes'].includes(module),
        canDelete: false,
      }));
    case 'viewer':
      return ALL_MODULES.map(module => ({
        module,
        canView: module !== 'roles' && module !== 'configuracion' && module !== 'rh' && module !== 'schema',
        canCreate: false,
        canEdit: false,
        canDelete: false,
      }));
    default:
      return ALL_MODULES.map(module => ({
        module,
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
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
  
  const role = normalizeRole(apiUser?.role);
  
  // Platform Admins: SuperAdmin, Partner, or DEV admin
  const isPlatformAdmin = ['superadmin', 'partner'].includes(role) || apiUser?.id === 'admin-001';
  
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
    'NOTIFICATIONS': 'notificaciones',
    'REPORTS': 'reportes',
    'TICKETS': 'tickets'
  };

  const defaultPermissions = getPermissionsByRole(role);
  
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
        canView: !!serverMatch.read,
        canCreate: serverMatch.create !== undefined ? !!serverMatch.create : !!serverMatch.write,
        canEdit: serverMatch.edit !== undefined ? !!serverMatch.edit : !!serverMatch.write,
        canDelete: !!serverMatch.delete
      };
    }
    
    // Si tiene un rol personalizado pero no hay permiso explícito del servidor para este módulo
    // y NO es un admin global o de tenant, denegamos cualquier acción de escritura/borrado.
    if (apiUser.customRoleId && !isPlatformAdmin && role !== 'admin') {
      return {
        ...def,
        canCreate: false,
        canEdit: false,
        canDelete: false
      };
    }
    
    return def;
  });

  // Include granular permissions that were not in ALL_MODULES
  serverPermissionsSnippet.forEach((sp: any) => {
    const spMod = (sp.module || sp.id || '').toUpperCase();
    if (!mergedPermissions.find(p => p.module.toUpperCase() === spMod)) {
      mergedPermissions.push({
        module: spMod,
        canView: !!sp.read,
        canCreate: sp.create !== undefined ? !!sp.create : !!sp.write,
        canEdit: sp.edit !== undefined ? !!sp.edit : !!sp.write,
        canDelete: !!sp.delete
      });
    }
  });

  console.log('[Auth] User Loaded:', { 
    id: apiUser.id, 
    role, 
    customRoleName: apiUser.customRoleName,
    isPlatformAdmin, 
    tenant: apiUser.clientTenantId,
    permissionsCount: mergedPermissions.length
  });

  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    avatar: apiUser.avatar,
    role,
    customRoleName: apiUser.customRoleName,
    tenantId: apiUser.clientTenantId,
    tenantName: apiUser.clientTenant?.name || 'Nova Hub',
    permissions: mergedPermissions,
    enabledModules: apiUser.enabledModules || [],
    isPlatformAdmin,
    isTenantUser: !isPlatformAdmin,
    isTenantAdmin: role === 'admin' && !isPlatformAdmin,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = user !== null;

  // Restore session from localStorage on mount
  React.useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = localStorage.getItem('nh-auth-token');
        if (!token) {
          setIsLoading(false);
          return;
        }

        try {
          const me = await api.get<any>('/auth/profile');
          setUser(createUserObject(me));
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
          localStorage.setItem('nh-auth-token', response.access_token);
          setUser(createUserObject(response.user));
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
      const platformModules = ['dashboard', 'suscripciones', 'configuracion', 'notificaciones'];
      return platformModules.includes(module);
    }

    // Módulos solo para admin
    const adminOnlyModules = ['roles', 'schema'];
    if (adminOnlyModules.includes(module) && !user.isTenantAdmin) return false;

    // 1. Verificar si el módulo está habilitado para el tenant (Suscripción)
    // Algunos módulos de sistema siempre están activos
    const coreModules = ['configuracion', 'dashboard', 'suscripciones'];
    const moduleEnumMap: Record<string, string> = {
      'ventas': 'SALES',
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
      'reportes': 'REPORTS'
    };
    const moduleGroupMap: Record<string, string[]> = {
      ventas: [
        'SALES', 'CLIENTS',
        'SALES_CLIENTS', 'SALES_QUOTES', 'SALES_ORDERS', 'SALES_INVOICES',
        'SALES_RECURRING', 'SALES_RETURNS', 'SALES_CREDIT_NOTES', 'SALES_PAYMENTS',
      ],
      compras: [
        'PURCHASES', 'PROVIDERS',
        'PURCHASES_PROVIDERS', 'PURCHASES_EXPENSES', 'PURCHASES_EXPENSES_REC',
        'PURCHASES_ORDERS', 'PURCHASES_RECEIPTS', 'PURCHASES_INVOICES',
        'PURCHASES_INVOICES_REC', 'PURCHASES_RETURNS', 'PURCHASES_PAYMENTS',
      ],
      inventario: [
        'INVENTORY',
        'INVENTORY_PRODUCTS', 'INVENTORY_WAREHOUSES', 'INVENTORY_TRANSFERS',
        'INVENTORY_ADJUSTMENTS', 'INVENTORY_COUNT', 'INVENTORY_SERIALS', 'INVENTORY_LOTS',
        'INVENTORY_MOVEMENTS',
      ],
      finanzas: [
        'FINANCIAL',
        'FINANCIAL_ACCOUNTS', 'FINANCIAL_JOURNAL', 'FINANCIAL_LEDGER',
        'FINANCIAL_BANK', 'FINANCIAL_BUDGET', 'FINANCIAL_REPORTS',
        'FINANCIAL_INCOMES', 'FINANCIAL_EXPENSES', 'FINANCIAL_EXPENSES_REC', 'FINANCIAL_BALANCE',
      ],
      actividades: [
        'ACTIVITIES',
        'ACTIVITIES_TASKS', 'ACTIVITIES_CALENDAR', 'ACTIVITIES_MEETINGS',
      ],
      documentos: [
        'DOCUMENTS',
        'DOCUMENTS_FILES', 'DOCUMENTS_FOLDERS', 'DOCUMENTS_CONTRACTS',
      ],
      notificaciones: [
        'NOTIFICATIONS',
        'NOTIFICATIONS_ALERTS', 'NOTIFICATIONS_MESSAGES', 'NOTIFICATIONS_PUSH',
      ],
      reportes: [
        'REPORTS',
        'REPORTS_SALES', 'REPORTS_FINANCIAL', 'REPORTS_INVENTORY',
      ],
      tickets: [
        'TICKETS',
      ],
      proveedores: [
        'PROVIDERS', 'PURCHASES_PROVIDERS',
      ],
      clientes: [
        'CLIENTS', 'SALES_CLIENTS',
      ],
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

    // 2. Verificar permisos del Rol
    // Si es admin del tenant, tiene acceso total a los módulos suscritos
    if (user.isTenantAdmin) return true;

    const permission = user.permissions.find(p => p.module === module);

    return permission?.canView ?? false;
  }, [user]);

  const canPerform = useCallback((module: string, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    if (!user) return false;
    // Admins (Platform o Tenant) tienen acceso basado en la suscripción del módulo
    if (user.isPlatformAdmin || user.isTenantAdmin) return hasAccess(module);
    
    const permission = user.permissions.find(p => p.module === module);
    if (!permission) return false;
    switch (action) {
      case 'view': return permission.canView;
      case 'create': return permission.canCreate;
      case 'edit': return permission.canEdit;
      case 'delete': return permission.canDelete;
      default: return false;
    }
  }, [user, hasAccess]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.post<{ access_token: string; user: any }>('/auth/login', { email, password });
      
      localStorage.setItem('nh-auth-token', response.access_token);
      setUser(createUserObject(response.user));
    } catch (error: any) {
      throw new Error(error.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('nh-auth-token');
  }, []);

  const switchIdentity = useCallback(async (userId: string) => {
    if (!(import.meta as any).env.DEV) {
      console.warn('switchIdentity is disabled outside development');
      return;
    }
    try {
      const response = await api.post<{ access_token: string; user: any }>('/auth/switch-context', { userId });
      localStorage.setItem('nh-auth-token', response.access_token);
      
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, hasAccess, canPerform, login, logout, switchIdentity, refreshEnabledModules, isLoading }}>
      {children}
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
