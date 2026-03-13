import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';

export type Role = 'admin' | 'partner' | 'manager' | 'employee' | 'viewer';

export type Module =
  | 'inventario'
  | 'ventas'
  | 'compras'
  | 'finanzas'
  | 'rh'
  | 'clientes'
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
  | 'schema';

export type SubModule = string;

export interface Permission {
  module: Module;
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
  tenantId: string;
  tenantName: string;
  permissions: Permission[];
  enabledModules: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  hasAccess: (module: Module | string) => boolean;
  canPerform: (module: Module, action: 'view' | 'create' | 'edit' | 'delete') => boolean;
  login: (email: string, password: string) => void;
  logout: () => void;
  switchIdentity: (userId: string) => Promise<void>;
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
        canCreate: module !== 'roles' && module !== 'configuracion' && module !== 'schema',
        canEdit: module !== 'roles' && module !== 'configuracion' && module !== 'schema',
        canDelete: module !== 'roles' && module !== 'configuracion' && module !== 'schema',
      }));
    case 'employee':
      return ALL_MODULES.map(module => ({
        module,
        canView: module !== 'roles' && module !== 'configuracion' && module !== 'finanzas',
        canCreate: ['inventario', 'ventas', 'compras', 'tickets', 'actividades'].includes(module),
        canEdit: ['inventario', 'ventas', 'compras', 'tickets'].includes(module),
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const isAuthenticated = user !== null;

  const hasAccess = useCallback((module: string): boolean => {
    if (!user) return false;
    
    // Si el usuario es 'admin' general de Nova Hub (Super Admin), tiene acceso total
    if (user.role === 'admin') return true;

    // Módulos solo para admin
    const adminOnlyModules = ['suscripciones', 'roles', 'schema'];
    if (adminOnlyModules.includes(module)) return false;

    // 1. Verificar si el módulo está habilitado para el tenant (Suscripción)
    // Algunos módulos son core y siempre están activos
    const coreModules = ['notificaciones', 'configuracion', 'reportes', 'dashboard'];
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
      'documentos': 'DOCUMENTS'
    };

    const backendModuleName = moduleEnumMap[module] || module.toUpperCase();
    
    // HR es especial: buscar cualquier submódulo HR_*
    let isSubscribed = coreModules.includes(module) || user.enabledModules.includes(backendModuleName);
    
    if (module === 'rh' && !isSubscribed) {
      isSubscribed = user.enabledModules.some(m => m.startsWith('HR_'));
    }

    if (!isSubscribed) return false;

    // 2. Verificar permisos del Rol
    const permission = user.permissions.find(p => p.module === module);

    return permission?.canView ?? false;
  }, [user]);

  const canPerform = useCallback((module: Module, action: 'view' | 'create' | 'edit' | 'delete'): boolean => {
    if (!user) return false;
    const permission = user.permissions.find(p => p.module === module);
    if (!permission) return false;
    switch (action) {
      case 'view': return permission.canView;
      case 'create': return permission.canCreate;
      case 'edit': return permission.canEdit;
      case 'delete': return permission.canDelete;
      default: return false;
    }
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await api.post<{ access_token: string; user: any }>('/auth/login', { email, password });
      
      localStorage.setItem('nh-auth-token', response.access_token);
      
      const { user: apiUser } = response;
      
      setUser({
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        avatar: apiUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(apiUser.name)}&background=10b981&color=fff`,
        role: apiUser.role.toLowerCase() as Role,
        tenantId: apiUser.clientTenantId,
        tenantName: apiUser.clientTenant?.name || 'Nova Hub',
        permissions: getPermissionsByRole(apiUser.role.toLowerCase() as Role),
        enabledModules: apiUser.enabledModules || [],
      });
    } catch (error: any) {
      throw new Error(error.message || 'Error al iniciar sesión. Verifica tus credenciales.');
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('nh-auth-token');
  }, []);

  const switchIdentity = useCallback(async (userId: string) => {
    try {
      const response = await api.post<{ access_token: string; user: any }>('/auth/switch-context', { userId });
      localStorage.setItem('nh-auth-token', response.access_token);
      
      const { user: apiUser } = response;
      setUser({
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        avatar: apiUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(apiUser.name)}&background=10b981&color=fff`,
        role: apiUser.role.toLowerCase() as Role,
        tenantId: apiUser.clientTenantId,
        tenantName: apiUser.clientTenant?.name || 'Nova Hub',
        permissions: getPermissionsByRole(apiUser.role.toLowerCase() as Role),
        enabledModules: apiUser.enabledModules || [],
      });
      window.location.reload(); // Recargar para asegurar que todos los servicios se reinicien
    } catch (error: any) {
      console.error('Error switching identity:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, hasAccess, canPerform, login, logout, switchIdentity }}>
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
