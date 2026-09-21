export type ManagerPermissionAction = 'read' | 'create' | 'edit' | 'delete' | 'export' | 'manage';
export type ManagerPermissionState = Record<string, Record<ManagerPermissionAction, boolean>>;

export const MANAGER_PERMISSION_OPTIONS = [
  { id: 'MANAGER_OVERVIEW', label: 'Resumen empresarial', description: 'Indicadores y distribución por sucursal' },
  { id: 'MANAGER_INVENTORY', label: 'Inventario consolidado', description: 'Stock, bodegas, existencias e importación masiva' },
  { id: 'MANAGER_INVENTORY_COST', label: 'Ver costos de inventario', description: 'Permite consultar costos, valor al costo y pérdidas monetarias del inventario' },
  { id: 'MANAGER_SALES', label: 'Ventas consolidadas', description: 'Clientes, documentos, cobros y caja' },
  { id: 'MANAGER_PURCHASES', label: 'Compras consolidadas', description: 'Proveedores, órdenes, recepciones, facturas y pagos' },
  { id: 'MANAGER_FINANCE', label: 'Finanzas consolidadas', description: 'Caja, ingresos, gastos, saldos y análisis financieros' },
  { id: 'MANAGER_ACCOUNTING', label: 'Contabilidad consolidada', description: 'Plan de cuentas, asientos, libros y reportes contables' },
  { id: 'MANAGER_REPORTS', label: 'Reportes consolidados', description: 'Indicadores y reportes comparativos por área' },
  { id: 'MANAGER_HR', label: 'Recursos Humanos consolidados', description: 'Personal, nómina, asistencia y talento por sucursal' },
  { id: 'MANAGER_ACTIVITIES', label: 'Actividades consolidadas', description: 'Tareas, eventos, recordatorios y bitácoras por sucursal' },
  { id: 'MANAGER_PROJECTS', label: 'Proyectos consolidados', description: 'Proyectos, tareas, hitos y costos operativos por sucursal' },
  { id: 'MANAGER_TICKETS', label: 'Tickets consolidados', description: 'Soporte operativo, categorías y cumplimiento de SLA por sucursal' },
  { id: 'MANAGER_DOCUMENTS', label: 'Documentos consolidados', description: 'Archivos y reportes persistidos de las sucursales' },
  { id: 'MANAGER_RESTAURANT', label: 'Restaurante consolidado', description: 'Comandas, cocina, mesas y carta por sucursal' },
  { id: 'MANAGER_LOGISTICS', label: 'Logística consolidada', description: 'Envíos, paquetes recibidos y recepciones por sucursal' },
  { id: 'MANAGER_FINANCING', label: 'Financiamiento PYME consolidado', description: 'Solicitudes de financiamiento y montos por sucursal' },
  { id: 'MANAGER_LEGAL', label: 'Asesoría legal consolidada', description: 'Casos y recordatorios legales por sucursal' },
  { id: 'MANAGER_NOVACHAT', label: 'NovaChat consolidado', description: 'Conversaciones, canales, contactos y agentes por sucursal' },
  { id: 'MANAGER_SUPPORT', label: 'Soporte técnico consolidado', description: 'Tickets de soporte de las sucursales y su estado' },
  { id: 'MANAGER_CONSOLIDATED', label: 'Estados financieros', description: 'Balance, resultados y comparativos' },
  { id: 'MANAGER_TRANSFERS', label: 'Transferencias', description: 'Movimientos entre bodegas y sucursales' },
  { id: 'MANAGER_CATALOG', label: 'Catálogo compartido', description: 'Productos, precios y sincronización' },
  { id: 'MANAGER_USERS', label: 'Usuarios de sucursales', description: 'Recuento y consulta de usuarios' },
  { id: 'MANAGER_WAREHOUSES', label: 'Almacenes corporativos', description: 'Creación y abastecimiento autorizado' },
  { id: 'MANAGER_MANAGERS', label: 'Managers', description: 'Crear y administrar accesos Manager' },
] as const;

export const MANAGER_PERMISSION_ACTIONS: Array<{ key: ManagerPermissionAction; label: string }> = [
  { key: 'read', label: 'Ver' },
  { key: 'create', label: 'Crear' },
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Eliminar' },
  { key: 'export', label: 'Exportar' },
  { key: 'manage', label: 'Administrar' },
];

// Actions are limited to the operations exposed by the consolidated Manager
// experience. Branch edits still use the separate per-branch policy matrix.
const READ_EXPORT: readonly ManagerPermissionAction[] = ['read', 'export'];
export const MANAGER_PERMISSION_ACTIONS_BY_MODULE: Record<string, readonly ManagerPermissionAction[]> = {
  MANAGER_OVERVIEW: READ_EXPORT,
  MANAGER_INVENTORY: ['read', 'create', 'edit', 'export'],
  MANAGER_INVENTORY_COST: ['read'],
  MANAGER_SALES: ['read', 'edit', 'export'],
  MANAGER_PURCHASES: READ_EXPORT,
  MANAGER_FINANCE: READ_EXPORT,
  MANAGER_ACCOUNTING: ['read', 'create', 'export'],
  MANAGER_REPORTS: READ_EXPORT,
  MANAGER_HR: READ_EXPORT,
  MANAGER_ACTIVITIES: READ_EXPORT,
  MANAGER_PROJECTS: READ_EXPORT,
  MANAGER_TICKETS: READ_EXPORT,
  MANAGER_DOCUMENTS: READ_EXPORT,
  MANAGER_RESTAURANT: READ_EXPORT,
  MANAGER_LOGISTICS: READ_EXPORT,
  MANAGER_FINANCING: READ_EXPORT,
  MANAGER_LEGAL: READ_EXPORT,
  MANAGER_NOVACHAT: READ_EXPORT,
  MANAGER_SUPPORT: READ_EXPORT,
  MANAGER_CONSOLIDATED: READ_EXPORT,
  MANAGER_TRANSFERS: ['read', 'create', 'edit', 'export'],
  MANAGER_CATALOG: ['read', 'create', 'edit'],
  MANAGER_USERS: ['read', 'edit'],
  MANAGER_WAREHOUSES: ['read', 'create', 'edit'],
  MANAGER_MANAGERS: ['read', 'manage'],
};

export function managerPermissionActionsFor(module: string) {
  const supported = new Set(MANAGER_PERMISSION_ACTIONS_BY_MODULE[module] || ['read']);
  return MANAGER_PERMISSION_ACTIONS.filter((action) => supported.has(action.key));
}

const emptyActions = (): Record<ManagerPermissionAction, boolean> => ({ read: false, create: false, edit: false, delete: false, export: false, manage: false });

export const emptyManagerPermissionState = (): ManagerPermissionState => Object.fromEntries(
  MANAGER_PERMISSION_OPTIONS.map((option) => [option.id, emptyActions()]),
) as ManagerPermissionState;

export function managerPermissionsToState(value: unknown): ManagerPermissionState {
  const state = emptyManagerPermissionState();
  if (!Array.isArray(value)) return state;
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const module = String((item as any).module || '').toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(state, module)) continue;
    const record = item as any;
    const actions = emptyActions();
    for (const action of MANAGER_PERMISSION_ACTIONS) actions[action.key] = record[action.key] === true;
    if (record.write === true) actions.create = actions.edit = true;
    if (module === 'MANAGER_INVENTORY_COST') {
      actions.create = actions.edit = actions.delete = actions.export = actions.manage = false;
    } else if (Object.entries(actions).some(([key, value]) => key !== 'read' && value)) {
      actions.read = true;
    }
    state[module] = actions;
  }
  return state;
}

export function managerStateToPermissions(state: ManagerPermissionState) {
  return MANAGER_PERMISSION_OPTIONS.flatMap<{ module: string } & Record<ManagerPermissionAction, boolean>>((option) => {
    const actions = state[option.id] || emptyActions();
    if (option.id === 'MANAGER_INVENTORY_COST') {
      return actions.read ? [{ module: option.id, ...emptyActions(), read: true }] : [];
    }
    if (!Object.values(actions).some(Boolean)) return [];
    return [{ module: option.id, ...actions, read: actions.read || actions.create || actions.edit || actions.delete || actions.export || actions.manage }];
  });
}
