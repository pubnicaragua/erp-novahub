export interface E2eModuleDefinition {
  id: string;
  label: string;
  subModule?: string;
  requiresPlatformRole?: boolean;
  /** Identificador consumido por AuthContext.hasAccess cuando difiere de la vista. */
  accessModule?: string;
}

/**
 * Inventario de entradas efectivamente renderizadas por App.tsx.
 * Los IDs se mantienen alineados con el código de navegación; no son rutas
 * inventadas ni sustituyen el catálogo de permisos del backend.
 */
export const E2E_MODULE_CATALOG: readonly E2eModuleDefinition[] = [
  { id: 'overview', label: 'Dashboard', subModule: undefined, accessModule: 'dashboard' },
  { id: 'inventario', label: 'Inventario de Mercancías', subModule: 'productos' },
  { id: 'ventas', label: 'Ventas', subModule: 'clientes' },
  { id: 'restaurante', label: 'Restaurante POS', subModule: 'salon' },
  { id: 'tracking', label: 'Tracking de Importaciones', subModule: 'tracking' },
  { id: 'compras', label: 'Compras', subModule: 'proveedores' },
  { id: 'finanzas', label: 'Finanzas', subModule: 'resumen-financiero' },
  { id: 'rh', label: 'Recursos Humanos', subModule: 'empleados' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'actividades', label: 'Actividades', subModule: 'tareas' },
  { id: 'proyectos', label: 'Proyectos', subModule: 'proyectos' },
  { id: 'fuerza-comercial', label: 'Fuerza Comercial', requiresPlatformRole: true },
  { id: 'tickets', label: 'Gestión de tickets', subModule: 'tickets' },
  { id: 'documentos', label: 'Nova Cloud', subModule: 'archivos' },
  { id: 'notificaciones', label: 'Notificaciones', subModule: 'alertas' },
  { id: 'transferencias', label: 'Transferencias' },
  { id: 'reportes', label: 'Reportes', subModule: 'reportes-ventas' },
  { id: 'configuracion', label: 'Configuración', subModule: 'branding' },
  { id: 'suscripciones', label: 'Mi Sucursal', subModule: 'mi-sucursal' },
  { id: 'tenant-admin', label: 'Administración de tenants', requiresPlatformRole: true },
  { id: 'schema', label: 'Esquema Prisma', requiresPlatformRole: true },
  { id: 'financiamiento-pyme', label: 'Financiamiento PYME', subModule: 'solicitudes-financiamiento' },
  { id: 'centro-capacitacion', label: 'Centro de capacitación' },
  { id: 'soporte-tecnico', label: 'Soporte técnico' },
  { id: 'contabilidad', label: 'Contabilidad', subModule: 'plan-cuentas' },
  { id: 'asesoria-legal', label: 'Asesoría legal', subModule: 'cases' },
  { id: 'novachat', label: 'Nova Suite' },
  { id: 'qa-console', label: 'Validador ERP (QA)', requiresPlatformRole: true },
  { id: 'guia-implementacion', label: 'Guía de implementación', requiresPlatformRole: true },
] as const;
