/**
 * Catálogo de permisos que representan vistas navegables del sidebar.
 *
 * Las capacidades internas de un flujo (por ejemplo, la gestión que ocurre
 * dentro de Solicitudes de compra) deben colgar de la vista que las contiene,
 * no aparecer como una vista independiente en la matriz de roles.
 */
export interface SidebarPermissionDefinition {
  id: string;
  label: string;
  parent: string;
  /** Los permisos internos de una vista no representan módulos facturables. */
  subscription?: boolean;
}

export const SIDEBAR_PERMISSION_SUBMODULES: SidebarPermissionDefinition[] = [
  // Ventas
  { id: 'SALES_CLIENTS', label: 'Clientes', parent: 'SALES' },
  { id: 'SALES_QUOTES', label: 'Cotizaciones', parent: 'SALES' },
  { id: 'SALES_ORDERS', label: 'Órdenes de venta', parent: 'SALES' },
  { id: 'SALES_INVOICES', label: 'Facturas', parent: 'SALES' },
  { id: 'SALES_RECURRING', label: 'Facturas recurrentes', parent: 'SALES' },
  { id: 'SALES_PAYMENTS', label: 'Pagos recibidos', parent: 'SALES' },
  { id: 'SALES_RETURNS', label: 'Notas de crédito', parent: 'SALES' },
  { id: 'SALES_CREDIT_NOTES', label: 'Créditos', parent: 'SALES' },
  { id: 'SALES_PRICE_LISTS', label: 'Listas de precios', parent: 'SALES' },
  // Facturación por caja y Control de Caja comparten el permiso RETAIL_POS.
  { id: 'RETAIL_POS', label: 'Facturación por caja', parent: 'SALES' },

  // Compras
  { id: 'PURCHASES_REQUESTS', label: 'Solicitudes', parent: 'PURCHASES' },
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones de compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_INVOICES_REC', label: 'Facturas de proveedor rec.', parent: 'PURCHASES' },
  { id: 'PURCHASES_PAYMENTS', label: 'Pagos realizados', parent: 'PURCHASES' },
  { id: 'PURCHASES_RETURNS', label: 'Créditos del proveedor', parent: 'PURCHASES' },

  // Inventario
  // Productos, Servicios, Ajustes, Auditorías y Pérdidas son vistas del
  // mismo catálogo/control de inventario y usan sus permisos existentes.
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', parent: 'INVENTORY' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', parent: 'INVENTORY' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', parent: 'INVENTORY' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', parent: 'INVENTORY' },
  { id: 'INVENTORY_MOVEMENTS', label: 'Movimientos', parent: 'INVENTORY' },

  // Finanzas
  { id: 'FINANCIAL_DASHBOARD', label: 'Resumen Financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BANK', label: 'Caja y Bancos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_RECEIVABLES', label: 'Cuentas por Cobrar', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_PAYABLES', label: 'Cuentas por Pagar', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_INCOMES', label: 'Ingresos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES', label: 'Gastos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES_REC', label: 'Movimientos recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_CALENDAR', label: 'Calendario Financiero', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_ANALYSIS', label: 'Análisis de ingresos y gastos', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_BALANCE', label: 'Balance General', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_LOSSES', label: 'Pérdidas', parent: 'FINANCIAL', subscription: false },

  // Recursos Humanos
  { id: 'HR_DASHBOARD', label: 'Dashboard', parent: 'HR' },
  { id: 'HR_EMPLOYEES', label: 'Empleados', parent: 'HR' },
  { id: 'HR_PAYROLL', label: 'Nóminas', parent: 'HR' },
  { id: 'HR_ATTENDANCE', label: 'Asistencia', parent: 'HR' },
  { id: 'HR_LEAVES', label: 'Vacaciones', parent: 'HR' },
  { id: 'HR_PERFORMANCE', label: 'Desempeño', parent: 'HR' },
  { id: 'HR_TRAINING', label: 'Capacitación', parent: 'HR' },
  { id: 'HR_BENEFITS', label: 'Beneficios', parent: 'HR' },
  { id: 'HR_PAYROLL_CONFIG', label: 'Configuración de nómina', parent: 'HR' },

  // Actividades
  { id: 'ACTIVITIES_TASKS', label: 'Tareas', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_EVENTS', label: 'Eventos', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_REMINDERS', label: 'Recordatorios', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_LOGS', label: 'Bitácora', parent: 'ACTIVITIES' },

  // Documentos
  { id: 'DOCUMENTS_FILES', label: 'Archivos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_CONTRACTS', label: 'Contratos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_INVOICES', label: 'Facturas Legales', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_REPORTS', label: 'Reportes', parent: 'DOCUMENTS' },

  // Notificaciones
  { id: 'NOTIFICATIONS_ALERTS', label: 'Alertas', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_MESSAGES', label: 'Mensajes', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_PUSH', label: 'Push', parent: 'NOTIFICATIONS' },

  // Tickets y soporte
  { id: 'TICKETS_KNOWLEDGE_BASE', label: 'Base de Conocimiento', parent: 'TICKETS' },
  { id: 'TICKETS_AGENTS', label: 'Agentes', parent: 'TICKETS' },

  // Asesoría legal
  { id: 'LEGAL_CASES', label: 'Casos', parent: 'LEGAL' },
  { id: 'LEGAL_REMINDERS', label: 'Recordatorios', parent: 'LEGAL' },

  // Reportes
  { id: 'REPORTS_SALES', label: 'Ventas', parent: 'REPORTS' },
  { id: 'REPORTS_PURCHASES', label: 'Compras', parent: 'REPORTS' },
  { id: 'REPORTS_FINANCIAL', label: 'Financiero', parent: 'REPORTS' },
  { id: 'REPORTS_INVENTORY', label: 'Inventario', parent: 'REPORTS' },
  { id: 'REPORTS_CLIENTS', label: 'Clientes', parent: 'REPORTS' },
  { id: 'REPORTS_PROVIDERS', label: 'Proveedores', parent: 'REPORTS' },
  { id: 'REPORTS_HR', label: 'Recursos Humanos', parent: 'REPORTS' },
  { id: 'REPORTS_SUBSCRIPTIONS', label: 'Suscripciones', parent: 'REPORTS' },

  // Contabilidad: únicamente las entradas presentes en el sidebar.
  { id: 'ACCOUNTING_CHART', label: 'Plan de Cuentas', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_JOURNAL', label: 'Libro Diario', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_LEDGER', label: 'Libro Mayor', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_TRIAL_BALANCE', label: 'Balance de comprobación', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_PROFIT_LOSS', label: 'Estado de Resultados', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_BALANCE_SHEET', label: 'Balance General', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_CASH_FLOW', label: 'Flujo de Efectivo', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_EXCHANGE_DIFFERENCES', label: 'Diferencias Cambiarias', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_EQUITY', label: 'Cambios Patrimonio', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_ASSETS', label: 'Activos Fijos', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_RECONCILIATION', label: 'Conciliación bancaria', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_PERIODS', label: 'Períodos contables', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_FISCAL', label: 'Reportes Fiscales', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_INVOICE_AUDIT', label: 'Auditoría de Facturas', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_BUDGET', label: 'Presupuestos', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_EXPENSE_CATEGORIES', label: 'Categorías Gastos', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_CONFIG', label: 'Configuración', parent: 'ACCOUNTING' },
];

/** Requisitos de suscripción para cada subentrada real del sidebar. */
export const SIDEBAR_SUBMENU_MODULE_REQUIREMENTS: Record<string, string[]> = {
  clientes: ['SALES_CLIENTS'],
  estimaciones: ['SALES_QUOTES'],
  'ordenes-venta': ['SALES_ORDERS'],
  facturas: ['SALES_INVOICES'],
  'facturas-recurrentes': ['SALES_RECURRING'],
  'pagos-recibidos': ['SALES_PAYMENTS'],
  'devoluciones-venta': ['SALES_RETURNS'],
  'notas-credito': ['SALES_CREDIT_NOTES'],
  'facturacion-caja': ['RETAIL_POS', 'SALES_POS'],
  'control-caja': ['RETAIL_POS', 'SALES_POS'],
  'listas-precios': ['SALES_PRICE_LISTS'],

  solicitudes: ['PURCHASES_REQUESTS', 'PURCHASES'],
  proveedores: ['PURCHASES_PROVIDERS'],
  gastos: ['PURCHASES_EXPENSES'],
  'gastos-recurrentes': ['PURCHASES_EXPENSES_REC'],
  'ordenes-compra': ['PURCHASES_ORDERS'],
  'recepciones-compra': ['PURCHASES_RECEIPTS'],
  'facturas-proveedor-rec': ['PURCHASES_INVOICES_REC'],
  'pagos-realizados': ['PURCHASES_PAYMENTS'],
  'creditos-proveedor': ['PURCHASES_RETURNS'],

  'dashboard-hr': ['HR_DASHBOARD'],
  empleados: ['HR_EMPLOYEES'],
  departamentos: ['HR_EMPLOYEES'],
  nominas: ['HR_PAYROLL'],
  asistencia: ['HR_ATTENDANCE'],
  ausencias: ['HR_LEAVES'],
  evaluaciones: ['HR_PERFORMANCE'],
  capacitaciones: ['HR_TRAINING'],
  beneficios: ['HR_BENEFITS'],
  'config-nomina': ['HR_PAYROLL_CONFIG'],

  'resumen-financiero': ['FINANCIAL_DASHBOARD'],
  'caja-bancos': ['FINANCIAL_BANK', 'FINANCIAL_DASHBOARD'],
  'cuentas-cobrar': ['FINANCIAL_INCOMES'],
  'cuentas-pagar': ['FINANCIAL_EXPENSES'],
  ingresos: ['FINANCIAL_INCOMES'],
  egresos: ['FINANCIAL_EXPENSES'],
  'movimientos-recurrentes': ['FINANCIAL_EXPENSES_REC'],
  'calendario-financiero': ['FINANCIAL_DASHBOARD'],
  'analisis-ingresos-gastos': ['FINANCIAL_REPORTS', 'FINANCIAL_BALANCE'],
  'balance-general': ['FINANCIAL_BALANCE'],
  'finanzas:perdidas': ['FINANCIAL_EXPENSES'],

  productos: ['INVENTORY_PRODUCTS'],
  servicios: ['INVENTORY_PRODUCTS'],
  almacenes: ['INVENTORY_WAREHOUSES'],
  transferencias: ['INVENTORY_TRANSFERS'],
  ajustes: ['INVENTORY_ADJUSTMENTS'],
  auditorias: ['INVENTORY_ADJUSTMENTS'],
  'inventario:perdidas': ['INVENTORY_ADJUSTMENTS'],
  movimientos: ['INVENTORY_MOVEMENTS'],

  alertas: ['NOTIFICATIONS_ALERTS'],
  mensajes: ['NOTIFICATIONS_MESSAGES'],
  push: ['NOTIFICATIONS_PUSH'],

  archivos: ['DOCUMENTS_FILES'],
  contratos: ['DOCUMENTS_CONTRACTS'],
  'doc-facturas': ['DOCUMENTS_INVOICES'],
  'doc-reportes': ['DOCUMENTS_REPORTS'],
  'nova-cloud-planes': ['DOCUMENTS'],

  tareas: ['ACTIVITIES_TASKS'],
  eventos: ['ACTIVITIES_EVENTS'],
  recordatorios: ['ACTIVITIES_REMINDERS'],
  bitacora: ['ACTIVITIES_LOGS'],

  tickets: ['TICKETS'],
  faqs: ['TICKETS_KNOWLEDGE_BASE'],
  agents: ['TICKETS_AGENTS'],

  cases: ['LEGAL_CASES'],
  reminders: ['LEGAL_REMINDERS'],

  'reportes-ventas': ['REPORTS_SALES'],
  'reportes-compras': ['REPORTS_PURCHASES'],
  'reportes-financieros': ['REPORTS_FINANCIAL'],
  'reportes-inventario': ['REPORTS_INVENTORY'],
  'reportes-clientes': ['REPORTS_CLIENTS'],
  'reportes-proveedores': ['REPORTS_PROVIDERS'],
  'reportes-suscripciones': ['REPORTS_SUBSCRIPTIONS'],
  'reportes-rrhh': ['REPORTS_HR'],

  'plan-cuentas': ['ACCOUNTING_CHART'],
  diario: ['ACCOUNTING_JOURNAL'],
  'libro-mayor': ['ACCOUNTING_LEDGER'],
  'balance-comprobacion': ['ACCOUNTING_TRIAL_BALANCE'],
  'estado-resultados': ['ACCOUNTING_PROFIT_LOSS'],
  'balance-general-contable': ['ACCOUNTING_BALANCE_SHEET'],
  'flujo-efectivo': ['ACCOUNTING_CASH_FLOW'],
  'diferencias-cambiarias': ['ACCOUNTING_EXCHANGE_DIFFERENCES'],
  'cambios-patrimonio': ['ACCOUNTING_EQUITY'],
  'activos-fijos': ['ACCOUNTING_ASSETS'],
  conciliacion: ['ACCOUNTING_RECONCILIATION'],
  periodos: ['ACCOUNTING_PERIODS'],
  'reportes-fiscales': ['ACCOUNTING_FISCAL'],
  'auditoria-facturas': ['ACCOUNTING_INVOICE_AUDIT'],
  presupuestos: ['ACCOUNTING_BUDGET'],
  'categorias-gastos': ['ACCOUNTING_EXPENSE_CATEGORIES'],
  configuracion: ['ACCOUNTING_CONFIG'],
};

/** Permiso exacto de cada vista del sidebar. Puede diferir del módulo que habilita la suscripción. */
export const SIDEBAR_SUBMENU_PERMISSION_MODULES: Record<string, string[]> = {
  'cuentas-cobrar': ['FINANCIAL_RECEIVABLES', 'FINANCIAL_INCOMES'],
  'cuentas-pagar': ['FINANCIAL_PAYABLES', 'FINANCIAL_EXPENSES'],
  'calendario-financiero': ['FINANCIAL_CALENDAR', 'FINANCIAL_DASHBOARD'],
  'analisis-ingresos-gastos': ['FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'],
  'finanzas:perdidas': ['FINANCIAL_LOSSES', 'FINANCIAL_EXPENSES'],
};

/** Tabs internos que no son entradas propias del sidebar, pero sí requieren autorización individual. */
export const INTERNAL_PERMISSION_SUBMODULES: SidebarPermissionDefinition[] = [
  // Configuración
  { id: 'CONFIG_BRANDING', label: 'Marca y Tema', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_PDF', label: 'Documentos PDF', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_SECURITY', label: 'Seguridad', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_TENANCY', label: 'Multi-Tenancy', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_CURRENCY', label: 'Moneda y Cambio', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_PLATFORM', label: 'Plataforma', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_COUNTRIES', label: 'Países', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_MODULE_PRICING', label: 'Precios de Módulos', parent: 'CONFIGURATION', subscription: false },

  // Mi Empresa
  { id: 'CONFIG_COMPANY', label: 'Datos generales', parent: 'MY_COMPANY', subscription: false },
  { id: 'SUBSCRIPTIONS', label: 'Módulos y Plan', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_USERS', label: 'Usuarios', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_ROLES', label: 'Roles y Permisos', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_DEPARTMENTS', label: 'Departamentos', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_ORG_CHART', label: 'Organigrama', parent: 'MY_COMPANY', subscription: false },
  { id: 'COMPANY_BRANCHES', label: 'Sucursales', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_DOMAINS', label: 'Dominio propio', parent: 'MY_COMPANY', subscription: false },
];

/** Catálogo completo usado por la matriz de roles; incluye tabs internos. */
export const PERMISSION_SUBMODULES: SidebarPermissionDefinition[] = [
  ...SIDEBAR_PERMISSION_SUBMODULES,
  ...INTERNAL_PERMISSION_SUBMODULES,
];

export const SIDEBAR_PERMISSION_MODULE_IDS = new Set([
  'SALES', 'PURCHASES', 'INVENTORY', 'FINANCIAL', 'ACCOUNTING', 'HR',
  'ACTIVITIES', 'TICKETS', 'DOCUMENTS', 'NOTIFICATIONS', 'REPORTS',
  'FINANCING', 'LEGAL', 'HR_TRAINING', 'SUPPORT_TECH', 'NOVACHAT',
  'MY_COMPANY', 'CONFIGURATION',
  ...PERMISSION_SUBMODULES.map(({ id }) => id),
]);

/** Permisos internos que siguen existiendo, pero se gobiernan desde su vista padre. */
export const SIDEBAR_PERMISSION_PARENT_ALIASES: Record<string, string[]> = {
  MY_COMPANY: ['MY_COMPANY', 'CONFIG_COMPANY', 'CONFIG_USERS', 'CONFIG_ROLES', 'CONFIG_DEPARTMENTS', 'CONFIG_ORG_CHART', 'COMPANY_BRANCHES', 'CONFIG_DOMAINS', 'SUBSCRIPTIONS'],
  CONFIGURATION: ['CONFIGURATION', 'CONFIG_BRANDING', 'CONFIG_SECURITY', 'CONFIG_CURRENCY', 'CONFIG_PDF', 'CONFIG_TENANCY', 'CONFIG_PLATFORM', 'CONFIG_COUNTRIES', 'CONFIG_MODULE_PRICING'],
};
