// Sistema de Roles y Permisos Granulares para NovaHub

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'import' | 'approve' | 'manage';

export type ModuleName = 
  | 'inventario' | 'ventas' | 'compras' | 'finanzas' | 'rh' 
  | 'proyectos' | 'clientes' | 'proveedores' | 'reportes' 
  | 'configuracion' | 'suscripciones' | 'roles' | 'usuarios' | 'twilio';

export interface ModulePermissions {
  [action: string]: boolean;
}

export interface RolePermissions {
  [moduleName: string]: ModulePermissions;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  isSystemRole: boolean;
  permissions: RolePermissions;
  restrictions?: {
    warehouses?: string[]; // IDs de almacenes permitidos
    departments?: string[]; // IDs de departamentos permitidos
    regions?: string[]; // Regiones permitidas
  };
}

// Plantillas de Roles Predefinidos
export const PREDEFINED_ROLES: CustomRole[] = [
  {
    id: 'super-admin',
    name: 'Super Administrador',
    description: 'Acceso total al sistema sin restricciones',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, create: true, edit: true, delete: true, export: true, import: true, manage: true },
      ventas: { view: true, create: true, edit: true, delete: true, export: true, approve: true, manage: true },
      compras: { view: true, create: true, edit: true, delete: true, export: true, approve: true, manage: true },
      finanzas: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
      rh: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
      proyectos: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
      clientes: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
      proveedores: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
      reportes: { view: true, export: true, manage: true },
      configuracion: { view: true, edit: true, manage: true },
      suscripciones: { view: true, create: true, edit: true, delete: true, manage: true },
      roles: { view: true, create: true, edit: true, delete: true, manage: true },
      usuarios: { view: true, create: true, edit: true, delete: true, manage: true },
      twilio: { view: true, create: true, edit: true, delete: true, manage: true },
    }
  },
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Administrador de empresa con acceso completo',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, create: true, edit: true, delete: true, export: true, import: true, manage: true },
      ventas: { view: true, create: true, edit: true, delete: true, export: true, approve: true, manage: true },
      compras: { view: true, create: true, edit: true, delete: true, export: true, approve: true, manage: true },
      finanzas: { view: true, create: true, edit: true, delete: false, export: true, manage: true },
      rh: { view: true, create: true, edit: true, delete: false, export: true, manage: true },
      proyectos: { view: true, create: true, edit: true, delete: true, export: true, manage: true },
      clientes: { view: true, create: true, edit: true, delete: false, export: true, manage: true },
      proveedores: { view: true, create: true, edit: true, delete: false, export: true, manage: true },
      reportes: { view: true, export: true },
      configuracion: { view: true, edit: true },
      roles: { view: true, create: true, edit: true, delete: false },
      usuarios: { view: true, create: true, edit: true, delete: false },
      twilio: { view: true, create: true, edit: true, delete: false },
    }
  },
  {
    id: 'gerente',
    name: 'Gerente',
    description: 'Gerente con acceso a ver y editar, sin eliminar',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, create: true, edit: true, delete: false, export: true, import: true },
      ventas: { view: true, create: true, edit: true, delete: false, export: true, approve: true },
      compras: { view: true, create: true, edit: true, delete: false, export: true, approve: true },
      finanzas: { view: true, create: false, edit: false, delete: false, export: true },
      rh: { view: true, create: true, edit: true, delete: false, export: false },
      proyectos: { view: true, create: true, edit: true, delete: false, export: true },
      clientes: { view: true, create: true, edit: true, delete: false, export: true },
      proveedores: { view: true, create: true, edit: true, delete: false, export: true },
      reportes: { view: true, export: true },
      configuracion: { view: true, edit: false },
      roles: { view: true },
      usuarios: { view: true },
    }
  },
  {
    id: 'contador',
    name: 'Contador',
    description: 'Acceso completo a finanzas y reportes',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, export: true },
      ventas: { view: true, export: true },
      compras: { view: true, export: true },
      finanzas: { view: true, create: true, edit: true, delete: false, export: true, manage: true },
      rh: { view: true, export: true },
      proyectos: { view: true, export: true },
      clientes: { view: true, export: true },
      proveedores: { view: true, export: true },
      reportes: { view: true, export: true, manage: true },
      configuracion: { view: true },
    }
  },
  {
    id: 'vendedor',
    name: 'Vendedor',
    description: 'Acceso a ventas, clientes e inventario (consulta)',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, export: false },
      ventas: { view: true, create: true, edit: true, delete: false, export: false },
      compras: { view: false },
      finanzas: { view: false },
      rh: { view: false },
      proyectos: { view: true },
      clientes: { view: true, create: true, edit: true, delete: false, export: false },
      proveedores: { view: false },
      reportes: { view: true },
      configuracion: { view: false },
    }
  },
  {
    id: 'almacenero',
    name: 'Almacenero',
    description: 'Gestión de inventario y almacenes',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, create: true, edit: true, delete: false, export: true, import: true, manage: true },
      ventas: { view: true },
      compras: { view: true, create: true },
      finanzas: { view: false },
      rh: { view: false },
      proyectos: { view: false },
      clientes: { view: false },
      proveedores: { view: true },
      reportes: { view: true },
      configuracion: { view: false },
    }
  },
  {
    id: 'comprador',
    name: 'Comprador',
    description: 'Gestión de compras y proveedores',
    isSystemRole: true,
    permissions: {
      inventario: { view: true, export: true },
      ventas: { view: false },
      compras: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
      finanzas: { view: false },
      rh: { view: false },
      proyectos: { view: false },
      clientes: { view: false },
      proveedores: { view: true, create: true, edit: true, delete: false, export: true },
      reportes: { view: true },
      configuracion: { view: false },
    }
  },
  {
    id: 'empleado',
    name: 'Empleado',
    description: 'Acceso básico de solo lectura',
    isSystemRole: true,
    permissions: {
      inventario: { view: true },
      ventas: { view: true },
      compras: { view: false },
      finanzas: { view: false },
      rh: { view: false },
      proyectos: { view: true },
      clientes: { view: true },
      proveedores: { view: false },
      reportes: { view: true },
      configuracion: { view: false },
    }
  },
  {
    id: 'rh-manager',
    name: 'Gerente de RH',
    description: 'Gestión completa de recursos humanos',
    isSystemRole: true,
    permissions: {
      inventario: { view: false },
      ventas: { view: false },
      compras: { view: false },
      finanzas: { view: true },
      rh: { view: true, create: true, edit: true, delete: false, export: true, approve: true, manage: true },
      proyectos: { view: false },
      clientes: { view: false },
      proveedores: { view: false },
      reportes: { view: true, export: true },
      configuracion: { view: true },
      usuarios: { view: true, create: true, edit: true },
    }
  },
];

// Función helper para verificar permisos
export function hasPermission(role: CustomRole, module: ModuleName, action: PermissionAction): boolean {
  return role.permissions[module]?.[action] === true;
}

// Función para obtener un rol por ID
export function getRoleById(roleId: string): CustomRole | undefined {
  return PREDEFINED_ROLES.find(r => r.id === roleId);
}

// Función para crear un rol personalizado
export function createCustomRole(
  name: string, 
  description: string, 
  permissions: RolePermissions,
  restrictions?: CustomRole['restrictions']
): CustomRole {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    isSystemRole: false,
    permissions,
    restrictions
  };
}
