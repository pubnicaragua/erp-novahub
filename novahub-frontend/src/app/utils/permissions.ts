export const PERMISSION_ACTION_DEFINITIONS = [
  { key: 'read', label: 'Ver', description: 'Permite entrar a la vista y consultar sus registros.' },
  { key: 'create', label: 'Crear', description: 'Permite agregar nuevos registros o borradores.' },
  { key: 'edit', label: 'Editar', description: 'Permite modificar los datos de un registro existente.' },
  { key: 'delete', label: 'Eliminar', description: 'Permite eliminar, inhabilitar, cancelar, rechazar o revertir según la vista.' },
  { key: 'approve', label: 'Aprobar', description: 'Permite aprobar o avanzar el flujo: enviar a otra vista, confirmar/procesar, convertir, aplicar o registrar pagos.' },
  { key: 'import', label: 'Importar', description: 'Permite cargar registros desde archivos o cargas masivas.' },
  { key: 'export', label: 'Exportar', description: 'Permite descargar o exportar información de la vista.' },
] as const;

/** Permisos de datos sensibles que solo aplican a filas concretas de la matriz. */
export const SENSITIVE_PERMISSION_ACTION_DEFINITIONS = [
  { key: 'viewCost', label: 'Ver costo', description: 'Permite ver costos, valores de inventario y últimos costos de compra.' },
] as const;

/** Vistas de inventario que contienen costos o valoraciones monetarias visibles. */
export const INVENTORY_COST_PERMISSION_MODULES = ['INVENTORY', 'INVENTORY_PRODUCTS', 'INVENTORY_ADJUSTMENTS'] as const;

export function supportsInventoryCostPermission(module: string): boolean {
  return INVENTORY_COST_PERMISSION_MODULES.includes(String(module || '').toUpperCase() as typeof INVENTORY_COST_PERMISSION_MODULES[number]);
}

export type PermissionMatrixAction =
  | typeof PERMISSION_ACTION_DEFINITIONS[number]['key']
  | typeof SENSITIVE_PERMISSION_ACTION_DEFINITIONS[number]['key'];

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
  'RETAIL_CASH_CONTROL',
  'RESTAURANT_SALON',
  'RESTAURANT_ORDERS',
  'RESTAURANT_TABLES',
  'RESTAURANT_KITCHEN',
  'LEGAL_CASES',
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
  'HR_BENEFITS',
  'HR_TRAINING',
  'ACCOUNTING_HR_PAYMENT_REQUESTS',
  'ACCOUNTING_JOURNAL',
  'ACCOUNTING_RECONCILIATION',
  'ACCOUNTING_EXCHANGE_DIFFERENCES',
  'ACCOUNTING_PERIODS',
  'ACCOUNTING_ASSETS',
  'ACTIVITIES_TASKS',
] as const;

/**
 * Acciones que realmente se consumen por cada vista del catálogo de Roles.
 *
 * La pantalla no debe ofrecer una matriz CRUD idéntica para todas las vistas:
 * un reporte no crea registros y un dashboard no elimina datos. Los permisos
 * históricos que no aparecen aquí siguen siendo aceptados por el backend y
 * se conservan al editar un rol, pero no se ofrecen como nuevas opciones.
 */
const VIEW_PERMISSION_ACTIONS: Record<string, readonly PermissionMatrixAction[]> = {
  DASHBOARD: ['read'],
  FINANCING: ['read', 'create', 'edit'],
  SALES: ['read'],
  RESTAURANT: ['read'],
  TRACKING: ['read'],
  PURCHASES: ['read', 'create'],
  INVENTORY: ['read', 'edit', 'viewCost'],
  FINANCIAL: ['read'],
  ACCOUNTING: ['read', 'create', 'edit', 'delete', 'import', 'export'],
  HR: ['read'],
  ACTIVITIES: ['read'],
  PROJECTS: ['read', 'create', 'edit', 'delete'],
  FORCE_SALES: ['read'],
  TICKETS: ['read', 'create', 'edit', 'delete'],
  HR_TRAINING: ['read', 'create', 'edit', 'approve'],
  SUPPORT_TECH: ['read', 'create', 'edit', 'delete'],
  LEGAL: ['read'],
  NOVACHAT: ['read'],
  DOCUMENTS: ['read'],
  NOTIFICATIONS: ['read'],
  REPORTS: ['read'],
  MY_COMPANY: ['read'],
  CONFIGURATION: ['read', 'edit'],

  SALES_CLIENTS: ['read', 'create', 'edit', 'export'],
  SALES_QUOTES: ['read', 'create', 'edit', 'approve'],
  SALES_ORDERS: ['read', 'create', 'edit', 'delete', 'approve'],
  SALES_INVOICES: ['read', 'create', 'edit', 'delete', 'approve'],
  SALES_RECURRING: ['read', 'create', 'edit', 'delete'],
  SALES_PAYMENTS: ['read', 'create', 'approve'],
  SALES_RETURNS: ['read', 'create', 'edit', 'delete', 'approve'],
  SALES_CREDIT_NOTES: ['read', 'create', 'edit', 'delete', 'approve'],
  SALES_PRICE_LISTS: ['read', 'create', 'edit', 'import', 'export'],
  RETAIL_POS: ['read', 'edit', 'approve'],
  RETAIL_CASH_CONTROL: ['read', 'edit', 'approve', 'export'],

  // IDs separados para las pestañas del POS de restaurante.
  RESTAURANT_TABLES: ['read', 'create', 'approve'],
  RESTAURANT_SALON: ['read', 'create', 'edit', 'approve'],
  RESTAURANT_ORDERS: ['read', 'create', 'edit', 'approve'],
  RESTAURANT_MENU: ['read', 'create', 'edit'],
  RESTAURANT_KITCHEN: ['read', 'approve'],
  RESTAURANT_REPORTS: ['read'],

  PURCHASES_REQUESTS: ['read', 'delete', 'approve', 'export'],
  PURCHASES_PROVIDERS: ['read', 'create', 'edit', 'export'],
  PURCHASES_EXPENSES: ['read', 'create', 'edit', 'delete', 'approve'],
  PURCHASES_EXPENSES_REC: ['read', 'create', 'edit', 'delete'],
  PURCHASES_ORDERS: ['read', 'create', 'edit', 'delete', 'approve'],
  PURCHASES_RECEIPTS: ['read', 'create', 'edit', 'delete', 'approve'],
  PURCHASES_INVOICES_REC: ['read', 'create', 'edit', 'delete'],
  PURCHASES_PAYMENTS: ['read', 'create', 'edit', 'delete', 'approve'],
  PURCHASES_RETURNS: ['read', 'create', 'edit', 'delete', 'approve'],
  TRACKING_TRANSIT: ['read', 'create', 'edit', 'delete'],
  TRACKING_RECEPTION: ['read', 'create', 'edit', 'approve'],
  TRACKING_BATCHES: ['read', 'create', 'edit', 'approve'],
  TRACKING_PACKAGES: ['read', 'create', 'edit', 'approve'],
  TRACKING_RECONCILIATION: ['read', 'edit', 'approve'],
  TRACKING_BILLING: ['read', 'approve'],
  TRACKING_CONFIG: ['read', 'edit'],

  INVENTORY_PRODUCTS: ['read', 'create', 'edit', 'export', 'viewCost'],
  INVENTORY_SERVICES: ['read'],
  INVENTORY_ATTRIBUTES: ['read'],
  INVENTORY_WAREHOUSES: ['read', 'create', 'edit', 'delete'],
  INVENTORY_TRANSFERS: ['read', 'create'],
  INVENTORY_ADJUSTMENTS: ['read', 'create', 'approve', 'viewCost'],
  INVENTORY_MOVEMENTS: ['read'],
  INVENTORY_AUDITS: ['read', 'create', 'delete', 'approve'],
  INVENTORY_LOSSES: ['read'],
  INVENTORY_ASSETS: ['read'],
  INVENTORY_CONFIG: ['read', 'edit'],

  FINANCIAL_DASHBOARD: ['read'],
  FINANCIAL_BANK: ['read'],
  FINANCIAL_RECEIVABLES: ['read'],
  FINANCIAL_PAYABLES: ['read'],
  FINANCIAL_INCOMES: ['read', 'export'],
  FINANCIAL_EXPENSES: ['read', 'export'],
  FINANCIAL_EXPENSES_REC: ['read', 'export'],
  FINANCIAL_CALENDAR: ['read'],
  FINANCIAL_ANALYSIS: ['read', 'export'],
  FINANCIAL_BALANCE: ['read', 'export'],
  FINANCIAL_LOSSES: ['read', 'export'],
  FINANCIAL_INCOMES_REC: ['read', 'create', 'edit', 'delete', 'export'],
  FINANCIAL_ACCOUNTS: ['read', 'create', 'edit', 'delete'],
  FINANCIAL_JOURNAL: ['read', 'export'],
  FINANCIAL_LEDGER: ['read', 'export'],
  FINANCIAL_BUDGET: ['read', 'create', 'edit', 'delete', 'export'],
  FINANCIAL_REPORTS: ['read', 'export'],

  HR_DASHBOARD: ['read'],
  HR_EMPLOYEES: ['read', 'create', 'edit', 'delete', 'approve'],
  HR_DEPARTMENTS: ['read', 'create', 'edit', 'delete'],
  HR_PAYROLL: ['read', 'edit', 'delete', 'export', 'approve'],
  HR_COMMISSIONS: ['read', 'export'],
  HR_ATTENDANCE: ['read', 'create'],
  HR_LEAVES: ['read', 'create', 'edit', 'delete', 'approve'],
  HR_PERFORMANCE: ['read', 'create', 'edit'],
  HR_BENEFITS: ['read', 'create', 'edit', 'delete', 'approve'],
  HR_PAYROLL_CONFIG: ['read', 'edit'],

  ACTIVITIES_TASKS: ['read', 'create', 'edit', 'delete', 'approve'],
  ACTIVITIES_EVENTS: ['read', 'create', 'edit', 'delete', 'approve'],
  ACTIVITIES_REMINDERS: ['read', 'create', 'edit', 'delete'],
  ACTIVITIES_LOGS: ['read', 'create', 'edit', 'delete'],
  ACTIVITIES_CALENDAR: ['read', 'create', 'edit', 'delete'],
  ACTIVITIES_MEETINGS: ['read', 'create', 'edit', 'delete', 'approve'],

  PROJECTS_LIST: ['read', 'create', 'edit', 'delete'],
  PROJECTS_TASKS: ['read', 'create', 'edit', 'delete'],
  PROJECTS_MILESTONES: ['read'],
  PROJECTS_EXPENSES: ['read', 'create', 'edit'],
  PROJECTS_DOCUMENTS: ['read', 'create', 'delete'],
  PROJECTS_TIME: ['read'],

  DOCUMENTS_FILES: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_CONTRACTS: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_INVOICES: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_REPORTS: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_FOLDERS: ['read', 'create', 'edit', 'delete'],
  DOCUMENTS_STORAGE_PLANS: ['read'],
  NOTIFICATIONS_ALERTS: ['read', 'create'],
  NOTIFICATIONS_MESSAGES: ['read', 'create'],
  NOTIFICATIONS_PUSH: ['read', 'create'],
  TICKETS_KNOWLEDGE_BASE: ['read'],
  TICKETS_AGENTS: ['read'],
  TICKETS_LIST: ['read', 'create', 'edit', 'delete', 'approve'],
  LEGAL_CASES: ['read', 'create', 'edit', 'approve'],
  LEGAL_REMINDERS: ['read', 'create', 'delete'],

  REPORTS_SALES: ['read'],
  REPORTS_PURCHASES: ['read'],
  REPORTS_FINANCIAL: ['read'],
  REPORTS_INVENTORY: ['read'],
  REPORTS_CLIENTS: ['read'],
  REPORTS_PROVIDERS: ['read'],
  REPORTS_HR: ['read'],
  REPORTS_SUBSCRIPTIONS: ['read'],

  FINANCING_APPLICATIONS: ['read', 'create', 'edit', 'approve'],
  FINANCING_CALCULATOR: ['read'],

  ACCOUNTING_CHART: ['read', 'create', 'edit', 'export'],
  ACCOUNTING_JOURNAL: ['read', 'delete', 'approve'],
  ACCOUNTING_HR_PAYMENT_REQUESTS: ['read', 'approve'],
  ACCOUNTING_LEDGER: ['read'],
  ACCOUNTING_TRIAL_BALANCE: ['read', 'export'],
  ACCOUNTING_PROFIT_LOSS: ['read'],
  ACCOUNTING_BALANCE_SHEET: ['read'],
  ACCOUNTING_CASH_FLOW: ['read'],
  ACCOUNTING_EXCHANGE_DIFFERENCES: ['read', 'approve'],
  ACCOUNTING_EQUITY: ['read'],
  ACCOUNTING_ASSETS: ['read', 'create', 'approve', 'export'],
  ACCOUNTING_RECONCILIATION: ['read', 'create', 'edit', 'approve'],
  ACCOUNTING_PERIODS: ['read', 'create', 'approve'],
  ACCOUNTING_FISCAL: ['read'],
  ACCOUNTING_INVOICE_AUDIT: ['read', 'approve'],
  ACCOUNTING_BUDGET: ['read'],
  ACCOUNTING_EXPENSE_CATEGORIES: ['read'],
  ACCOUNTING_CONFIG: ['read'],

  CONFIG_BRANDING: ['read', 'edit'],
  CONFIG_PDF: ['read', 'create', 'edit', 'delete'],
  CONFIG_SECURITY: ['read', 'edit'],
  CONFIG_CURRENCY: ['read', 'edit'],
  CONFIG_COMPANY: ['read', 'create', 'edit', 'delete'],
  SUBSCRIPTIONS: ['read', 'create'],
  CONFIG_USERS: ['read', 'create', 'edit', 'delete'],
  CONFIG_ROLES: ['read', 'create', 'edit', 'delete'],
  CONFIG_DEPARTMENTS: ['read', 'create', 'edit', 'delete'],
  CONFIG_DOMAINS: ['read'],
};

export function getPermissionActionKeys(module: string): readonly PermissionMatrixAction[] {
  return VIEW_PERMISSION_ACTIONS[String(module || '').toUpperCase()] || ['read'];
}

export function supportsPermissionAction(module: string, action: PermissionMatrixAction): boolean {
  if (action === 'viewCost') return supportsInventoryCostPermission(module);
  return getPermissionActionKeys(module).includes(action);
}

export function permissionValue(permission: any, action: PermissionMatrixAction): boolean {
  if (!permission) return false;
  if (action === 'viewCost') return permission.viewCost === true || permission.canViewCost === true;
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

/**
 * Devuelve el alcance de listas de precios del usuario. `null` representa el
 * comportamiento legado: todas las listas están disponibles. Un arreglo vacío
 * es deliberado y significa que el rol aún no tiene listas asignadas.
 */
export function getAllowedPriceListIds(user: any): string[] | null {
  const permission = (Array.isArray(user?.permissions) ? user.permissions : [])
    .find((candidate: any) => String(candidate?.module || '').trim().toUpperCase() === 'SALES_PRICE_LISTS');
  if (!permission || !Object.prototype.hasOwnProperty.call(permission, 'allowedPriceListIds')) return null;
  return Array.isArray(permission.allowedPriceListIds)
    ? [...new Set(permission.allowedPriceListIds.map((id: unknown) => String(id || '').trim()).filter(Boolean))]
    : [];
}

export function filterAllowedPriceLists<T extends { id: string }>(lists: T[], user: any): T[] {
  const allowedIds = getAllowedPriceListIds(user);
  return allowedIds === null ? lists : lists.filter((list) => allowedIds.includes(list.id));
}

/**
 * El alcance del rol debe salir de las filas con permiso de lectura. Mantener
 * este cálculo en un único lugar evita que una pantalla guarde switches
 * activos sin actualizar `allowedModules`.
 */
export function allowedModulesFromPermissions(input: any): string[] {
  const permissions = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? Object.entries(input).map(([module, value]: [string, any]) => ({
          module,
          ...(value && typeof value === 'object' ? value : {}),
        }))
      : [];

  return [...new Set(permissions
    .map((permission: any) => ({
      module: String(permission?.module || permission?.id || '').trim().toUpperCase(),
      permission,
    }))
    .filter(({ module, permission }: { module: string; permission: any }) => module && permissionValue(permission, 'read'))
    .map(({ module }: { module: string }) => module))];
}

export function hydratePermissionActions(permission: any, module: string) {
  return {
    module,
    ...Object.fromEntries(PERMISSION_ACTION_DEFINITIONS.map(({ key }) => [key, permissionValue(permission, key)])),
    viewCost: permissionValue(permission, 'viewCost'),
    ...(Object.prototype.hasOwnProperty.call(permission || {}, 'allowedPriceListIds')
      ? { allowedPriceListIds: Array.isArray(permission.allowedPriceListIds) ? [...permission.allowedPriceListIds] : [] }
      : {}),
  };
}
