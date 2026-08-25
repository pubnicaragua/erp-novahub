export type ManagerPermissionLevel = 'NONE' | 'READ' | 'EDIT' | 'FULL';

export type ManagerPermissionState = Record<string, ManagerPermissionLevel>;

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
  { id: 'MANAGER_CONSOLIDATED', label: 'Estados financieros', description: 'Balance, resultados y comparativos' },
  { id: 'MANAGER_TRANSFERS', label: 'Transferencias', description: 'Movimientos entre bodegas y sucursales' },
  { id: 'MANAGER_CATALOG', label: 'Catálogo compartido', description: 'Productos, precios y sincronización' },
  { id: 'MANAGER_USERS', label: 'Usuarios de sucursales', description: 'Recuento y consulta de usuarios' },
  { id: 'MANAGER_WAREHOUSES', label: 'Almacenes corporativos', description: 'Creación y abastecimiento autorizado' },
  { id: 'MANAGER_MANAGERS', label: 'Managers', description: 'Crear y administrar accesos Manager' },
  { id: 'BRANCH_OPERATIONS', label: 'Operar dentro de sucursales', description: 'Entrar como supervisor y realizar cambios operativos' },
] as const;

export const emptyManagerPermissionState = (): ManagerPermissionState => Object.fromEntries(
  MANAGER_PERMISSION_OPTIONS.map((option) => [option.id, 'NONE']),
) as ManagerPermissionState;

export function managerPermissionsToState(value: unknown): ManagerPermissionState {
  const state = emptyManagerPermissionState();
  if (!Array.isArray(value)) return state;
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const module = String((item as any).module || '').toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(state, module)) continue;
    const record = item as any;
    state[module] = record.manage || record.delete ? 'FULL' : record.edit || record.create ? 'EDIT' : record.read ? 'READ' : 'NONE';
  }
  return state;
}

export function managerStateToPermissions(state: ManagerPermissionState) {
  return MANAGER_PERMISSION_OPTIONS.flatMap((option) => {
    const level = state[option.id] || 'NONE';
    if (level === 'NONE') return [];
    if (level === 'READ') return [{ module: option.id, read: true, export: true }];
    if (level === 'EDIT') return [{ module: option.id, read: true, create: true, edit: true, export: true }];
    return [{ module: option.id, read: true, create: true, edit: true, delete: true, export: true, manage: true }];
  });
}
