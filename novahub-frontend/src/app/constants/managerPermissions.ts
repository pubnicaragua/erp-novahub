export type ManagerPermissionLevel = 'NONE' | 'READ' | 'EDIT' | 'FULL';

export type ManagerPermissionState = Record<string, ManagerPermissionLevel>;

export const MANAGER_PERMISSION_OPTIONS = [
  { id: 'MANAGER_OVERVIEW', label: 'Resumen empresarial', description: 'Indicadores y distribución por sucursal' },
  { id: 'MANAGER_INVENTORY', label: 'Inventario consolidado', description: 'Stock, bodegas y existencias' },
  { id: 'MANAGER_ACCOUNTING', label: 'Contabilidad y finanzas', description: 'Movimientos y cuentas por sucursal' },
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

