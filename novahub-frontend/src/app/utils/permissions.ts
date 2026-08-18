export const PERMISSION_ACTION_DEFINITIONS = [
  { key: 'read', label: 'Ver', description: 'Permite entrar a la vista y consultar sus registros.' },
  { key: 'create', label: 'Crear', description: 'Permite agregar nuevos registros o borradores.' },
  { key: 'edit', label: 'Editar', description: 'Permite modificar los datos de un registro existente.' },
  { key: 'delete', label: 'Eliminar', description: 'Permite eliminar, inhabilitar, cancelar, rechazar o revertir según la vista.' },
  { key: 'approve', label: 'Aprobar', description: 'Permite aprobar o avanzar el flujo: enviar a otra vista, confirmar/procesar, convertir, aplicar o registrar pagos.' },
  { key: 'import', label: 'Importar', description: 'Permite cargar registros desde archivos o cargas masivas.' },
  { key: 'export', label: 'Exportar', description: 'Permite descargar o exportar información de la vista.' },
] as const;

export type PermissionMatrixAction = typeof PERMISSION_ACTION_DEFINITIONS[number]['key'];

export const PERMISSION_ACTION_KEYS = PERMISSION_ACTION_DEFINITIONS.map(action => action.key);

/**
 * Vistas que tienen una acción de flujo además del CRUD: aprobar, enviar a
 * otra vista, confirmar una transacción, aplicar/contabilizar o registrar un
 * pago. La matriz no muestra "Aprobar" en las demás vistas para no crear
 * permisos ambiguos.
 */
export const APPROVAL_PERMISSION_MODULES = [
  'SALES_QUOTES',
  'SALES_ORDERS',
  'SALES_INVOICES',
  'SALES_RETURNS',
  'SALES_CREDIT_NOTES',
  'SALES_PAYMENTS',
  'RETAIL_POS',
  'PURCHASES_REQUESTS',
  'PURCHASES_ORDERS',
  'PURCHASES_RECEIPTS',
  'PURCHASES_EXPENSES',
  'PURCHASES_RETURNS',
  'PURCHASES_PAYMENTS',
  'INVENTORY_ADJUSTMENTS',
  'HR_EMPLOYEES',
  'HR_LEAVES',
  'HR_PAYROLL',
  'ACCOUNTING_HR_PAYMENT_REQUESTS',
  'ACCOUNTING_JOURNAL',
  'ACCOUNTING_RECONCILIATION',
  'ACCOUNTING_EXCHANGE_DIFFERENCES',
  'ACCOUNTING_PERIODS',
] as const;

export function supportsPermissionAction(module: string, action: PermissionMatrixAction): boolean {
  return action !== 'approve' || APPROVAL_PERMISSION_MODULES.includes(String(module || '').toUpperCase() as typeof APPROVAL_PERMISSION_MODULES[number]);
}

export function permissionValue(permission: any, action: PermissionMatrixAction): boolean {
  if (!permission) return false;
  if (action === 'read') return permission.read === true || permission.view === true || permission.canView === true;
  // Los roles existentes pueden guardar la misma capacidad con los nombres
  // históricos "deactivate", "cancel", "reject" o "reverse". Se muestran y editan como Eliminar.
  if (action === 'delete' && (
    permission.delete === true || permission.deactivate === true || permission.cancel === true || permission.reject === true || permission.reverse === true
    || permission.canDelete === true || permission.canDeactivate === true || permission.canCancel === true || permission.canReject === true || permission.canReverse === true
  )) return true;
  if (permission[action] !== undefined) return permission[action] === true;
  const frontendKey = `can${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  if (permission[frontendKey] !== undefined) return permission[frontendKey] === true;
  if ((action === 'create' || action === 'edit') && permission.write === true) return true;
  return false;
}

export function hydratePermissionActions(permission: any, module: string) {
  return {
    module,
    ...Object.fromEntries(PERMISSION_ACTION_DEFINITIONS.map(({ key }) => [key, permissionValue(permission, key)])),
  };
}
