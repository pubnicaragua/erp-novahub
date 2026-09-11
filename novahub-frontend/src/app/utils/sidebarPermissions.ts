/**
 * Catálogo de permisos que representan vistas navegables del sidebar.
 *
 * Cada entrada navegable del sidebar tiene un identificador propio. Las
 * acciones de cada vista se definen en permissions.ts, pero la visibilidad
 * siempre parte de este registro único.
 */
export interface SidebarPermissionDefinition {
  id: string;
  label: string;
  parent: string;
  /** Los permisos internos de una vista no representan módulos facturables. */
  subscription?: boolean;
}

/** Orden de los módulos padres tal como aparecen en el sidebar del tenant. */
export const SIDEBAR_PERMISSION_PARENT_ORDER = [
  'DASHBOARD',
  'SALES',
  'PURCHASES',
  'RESTAURANT',
  'TRACKING',
  'INVENTORY',
  'FINANCIAL',
  'ACCOUNTING',
  'REPORTS',
  'HR',
  'ACTIVITIES',
  'PROJECTS',
  'FORCE_SALES',
  'TICKETS',
  'HR_TRAINING',
  'SUPPORT_TECH',
  'LEGAL',
  'FINANCING',
  'NOVACHAT',
  'DOCUMENTS',
  'NOTIFICATIONS',
  'MY_COMPANY',
  'CONFIGURATION',
] as const;

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
  { id: 'RETAIL_POS', label: 'Facturación por caja', parent: 'SALES' },
  { id: 'RETAIL_CASH_CONTROL', label: 'Control de Caja', parent: 'SALES' },

  // Restaurante POS
  { id: 'RESTAURANT_SALON', label: 'Salón y mesas', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_ORDERS', label: 'Comandas', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_KITCHEN', label: 'Cocina', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_MENU', label: 'Carta', parent: 'RESTAURANT' },
  { id: 'RESTAURANT_REPORTS', label: 'Reportes restaurante', parent: 'RESTAURANT' },

  // Compras
  { id: 'PURCHASES_REQUESTS', label: 'Solicitudes', parent: 'PURCHASES' },
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', parent: 'PURCHASES' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones de compra', parent: 'PURCHASES' },
  { id: 'PURCHASES_INVOICES_REC', label: 'Compras recurrentes', parent: 'PURCHASES' },
  { id: 'PURCHASES_PAYMENTS', label: 'Pagos realizados', parent: 'PURCHASES' },
  { id: 'PURCHASES_RETURNS', label: 'Créditos del proveedor', parent: 'PURCHASES' },

  // Tracking
  { id: 'TRACKING_TRANSIT', label: 'En tránsito', parent: 'TRACKING' },
  { id: 'TRACKING_RECEPTION', label: 'Recepción de paquetes', parent: 'TRACKING' },
  { id: 'TRACKING_BATCHES', label: 'Recepción en lote', parent: 'TRACKING' },
  { id: 'TRACKING_PACKAGES', label: 'Paquetes recibidos', parent: 'TRACKING' },
  { id: 'TRACKING_RECONCILIATION', label: 'Conciliación de compras', parent: 'TRACKING' },
  { id: 'TRACKING_BILLING', label: 'Disponibles para facturar', parent: 'TRACKING' },
  { id: 'TRACKING_CONFIG', label: 'Configuración de tracking', parent: 'TRACKING' },

  // Inventario
  // Productos, Servicios, Ajustes, Auditorías y Pérdidas son vistas del
  // mismo catálogo/control de inventario y usan sus permisos existentes.
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', parent: 'INVENTORY' },
  { id: 'INVENTORY_SERVICES', label: 'Servicios', parent: 'INVENTORY' },
  { id: 'INVENTORY_ATTRIBUTES', label: 'Atributos y categorías', parent: 'INVENTORY' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', parent: 'INVENTORY' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', parent: 'INVENTORY' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', parent: 'INVENTORY' },
  { id: 'INVENTORY_AUDITS', label: 'Auditorías', parent: 'INVENTORY' },
  { id: 'INVENTORY_LOSSES', label: 'Pérdidas', parent: 'INVENTORY' },
  { id: 'INVENTORY_MOVEMENTS', label: 'Movimientos', parent: 'INVENTORY' },
  { id: 'INVENTORY_ASSETS', label: 'Mobiliario y equipos', parent: 'INVENTORY' },
  { id: 'INVENTORY_CONFIG', label: 'Configuración de inventario', parent: 'INVENTORY' },

  // Finanzas
  { id: 'FINANCIAL_DASHBOARD', label: 'Resumen Financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_BANK', label: 'Caja y Bancos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_RECEIVABLES', label: 'Cuentas por Cobrar', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_PAYABLES', label: 'Cuentas por Pagar', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_INCOMES', label: 'Ingresos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES', label: 'Gastos', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_EXPENSES_REC', label: 'Movimientos recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_INCOMES_REC', label: 'Ingresos recurrentes', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_JOURNAL', label: 'Diario financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_LEDGER', label: 'Libro mayor financiero', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_CALENDAR', label: 'Calendario Financiero', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_ANALYSIS', label: 'Análisis de ingresos y gastos', parent: 'FINANCIAL', subscription: false },
  { id: 'FINANCIAL_BALANCE', label: 'Balance General', parent: 'FINANCIAL' },
  { id: 'FINANCIAL_LOSSES', label: 'Pérdidas', parent: 'FINANCIAL', subscription: false },

  // Recursos Humanos
  { id: 'HR_DASHBOARD', label: 'Dashboard', parent: 'HR' },
  { id: 'HR_EMPLOYEES', label: 'Empleados', parent: 'HR' },
  { id: 'HR_DEPARTMENTS', label: 'Departamentos', parent: 'HR' },
  { id: 'HR_PAYROLL', label: 'Nóminas', parent: 'HR' },
  { id: 'HR_COMMISSIONS', label: 'Comisiones', parent: 'HR' },
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
  { id: 'ACTIVITIES_CALENDAR', label: 'Calendario', parent: 'ACTIVITIES' },
  { id: 'ACTIVITIES_MEETINGS', label: 'Reuniones', parent: 'ACTIVITIES' },

  // Proyectos
  { id: 'PROJECTS_LIST', label: 'Portafolio', parent: 'PROJECTS' },
  { id: 'PROJECTS_TASKS', label: 'Planificación y tareas', parent: 'PROJECTS' },
  { id: 'PROJECTS_MILESTONES', label: 'Hitos', parent: 'PROJECTS' },
  { id: 'PROJECTS_EXPENSES', label: 'Costos y presupuesto', parent: 'PROJECTS' },
  { id: 'PROJECTS_DOCUMENTS', label: 'Documentos', parent: 'PROJECTS' },
  { id: 'PROJECTS_TIME', label: 'Tiempo y cronograma', parent: 'PROJECTS' },

  // Documentos
  { id: 'DOCUMENTS_FILES', label: 'Archivos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_CONTRACTS', label: 'Contratos', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_INVOICES', label: 'Facturas Legales', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_REPORTS', label: 'Reportes', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_FOLDERS', label: 'Carpetas', parent: 'DOCUMENTS' },
  { id: 'DOCUMENTS_STORAGE_PLANS', label: 'Planes de almacenamiento', parent: 'DOCUMENTS' },

  // Notificaciones
  { id: 'NOTIFICATIONS_ALERTS', label: 'Alertas', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_MESSAGES', label: 'Mensajes', parent: 'NOTIFICATIONS' },
  { id: 'NOTIFICATIONS_PUSH', label: 'Push', parent: 'NOTIFICATIONS' },

  // Tickets y soporte
  { id: 'TICKETS_LIST', label: 'Tickets', parent: 'TICKETS' },
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

  // Financiamiento PyME
  { id: 'FINANCING_APPLICATIONS', label: 'Solicitudes', parent: 'FINANCING' },
  { id: 'FINANCING_CALCULATOR', label: 'Calculadora', parent: 'FINANCING' },

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
  { id: 'ACCOUNTING_HR_PAYMENT_REQUESTS', label: 'Solicitudes de pago RR. HH.', parent: 'ACCOUNTING' },
  { id: 'ACCOUNTING_CONFIG', label: 'Configuración', parent: 'ACCOUNTING' },
];

/** Requisitos de suscripción para cada subentrada real del sidebar. */
export const SIDEBAR_SUBMENU_MODULE_REQUIREMENTS: Record<string, string[]> = {
  'suscripciones:mi-sucursal': ['CONFIG_COMPANY'],
  'suscripciones:plan-sucursal': ['SUBSCRIPTIONS'],
  'suscripciones:usuarios': ['CONFIG_USERS'],
  'suscripciones:roles': ['CONFIG_ROLES'],
  'suscripciones:departamentos': ['CONFIG_DEPARTMENTS'],
  'suscripciones:dominio': ['CONFIG_DOMAINS'],
  'configuracion:branding': ['CONFIG_BRANDING'],
  'configuracion:documentos-pdf': ['CONFIG_PDF'],
  'configuracion:seguridad': ['CONFIG_SECURITY'],
  'configuracion:auditoria': ['AUDIT_LOGS'],
  'configuracion:currency': ['CONFIG_CURRENCY'],
  clientes: ['SALES_CLIENTS'],
  estimaciones: ['SALES_QUOTES'],
  'ordenes-venta': ['SALES_ORDERS'],
  facturas: ['SALES_INVOICES'],
  'facturas-recurrentes': ['SALES_RECURRING'],
  'pagos-recibidos': ['SALES_PAYMENTS'],
  'devoluciones-venta': ['SALES_RETURNS'],
  'notas-credito': ['SALES_CREDIT_NOTES'],
  'facturacion-caja': ['SALES', 'RETAIL_POS', 'SALES_POS', 'CAJA'],
  'control-caja': ['SALES', 'RETAIL_CASH_CONTROL', 'RETAIL_POS', 'SALES_POS', 'CAJA'],
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

  salon: ['RESTAURANT_SALON'],
  comandas: ['RESTAURANT_ORDERS'],
  cocina: ['RESTAURANT_KITCHEN'],
  carta: ['RESTAURANT_MENU'],
  'reportes-restaurante': ['RESTAURANT_REPORTS'],

  tracking: ['TRACKING_TRANSIT'],
  'tracking-recepcion': ['TRACKING_RECEPTION'],
  'tracking-lotes': ['TRACKING_BATCHES'],
  'tracking-paquetes': ['TRACKING_PACKAGES'],
  'tracking-conciliacion': ['TRACKING_RECONCILIATION'],
  'tracking-facturacion': ['TRACKING_BILLING'],
  'tracking-configuracion': ['TRACKING_CONFIG'],

  'dashboard-hr': ['HR_DASHBOARD'],
  empleados: ['HR_EMPLOYEES'],
  departamentos: ['HR_DEPARTMENTS'],
  nominas: ['HR_PAYROLL'],
  comisiones: ['HR_COMMISSIONS'],
  asistencia: ['HR_ATTENDANCE'],
  ausencias: ['HR_LEAVES'],
  evaluaciones: ['HR_PERFORMANCE'],
  capacitaciones: ['HR_TRAINING'],
  beneficios: ['HR_BENEFITS'],
  'config-nomina': ['HR_PAYROLL_CONFIG'],

  'resumen-financiero': ['FINANCIAL_DASHBOARD'],
  'caja-bancos': ['FINANCIAL_BANK', 'FINANCIAL_ACCOUNTS'],
  'cuentas-cobrar': ['FINANCIAL_RECEIVABLES', 'FINANCIAL_INCOMES'],
  'cuentas-pagar': ['FINANCIAL_PAYABLES', 'FINANCIAL_EXPENSES'],
  ingresos: ['FINANCIAL_INCOMES'],
  egresos: ['FINANCIAL_EXPENSES'],
  'movimientos-recurrentes': ['FINANCIAL_EXPENSES_REC'],
  'calendario-financiero': ['FINANCIAL_CALENDAR', 'FINANCIAL_DASHBOARD'],
  'analisis-ingresos-gastos': ['FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'],
  'balance-general': ['FINANCIAL_BALANCE'],
  'finanzas:perdidas': ['FINANCIAL_LOSSES', 'FINANCIAL_EXPENSES'],
  'ingresos-recurrentes': ['FINANCIAL_INCOMES_REC'],
  'diario-financiero': ['FINANCIAL_JOURNAL'],
  'libro-mayor-financiero': ['FINANCIAL_LEDGER'],

  'mi-sucursal': ['CONFIG_COMPANY'],
  'plan-sucursal': ['SUBSCRIPTIONS'],
  usuarios: ['CONFIG_USERS'],
  roles: ['CONFIG_ROLES'],
  dominio: ['CONFIG_DOMAINS'],

  productos: ['INVENTORY_PRODUCTS'],
  'marcas-clientes': ['INVENTORY_PRODUCTS'],
  servicios: ['INVENTORY_SERVICES'],
  atributos: ['INVENTORY_ATTRIBUTES'],
  almacenes: ['INVENTORY_WAREHOUSES'],
  transferencias: ['INVENTORY_TRANSFERS'],
  ajustes: ['INVENTORY_ADJUSTMENTS'],
  auditorias: ['INVENTORY_AUDITS'],
  'inventario:perdidas': ['INVENTORY_LOSSES'],
  'mobiliario-equipos': ['INVENTORY_ASSETS'],
  movimientos: ['INVENTORY_MOVEMENTS'],
  'inventario:configuracion': ['INVENTORY_CONFIG'],

  alertas: ['NOTIFICATIONS_ALERTS'],
  mensajes: ['NOTIFICATIONS_MESSAGES'],
  push: ['NOTIFICATIONS_PUSH'],

  archivos: ['DOCUMENTS_FILES'],
  contratos: ['DOCUMENTS_CONTRACTS'],
  'doc-facturas': ['DOCUMENTS_INVOICES'],
  'doc-reportes': ['DOCUMENTS_REPORTS'],
  'nova-cloud-planes': ['DOCUMENTS_STORAGE_PLANS'],
  carpetas: ['DOCUMENTS_FOLDERS'],

  tareas: ['ACTIVITIES_TASKS'],
  eventos: ['ACTIVITIES_EVENTS'],
  recordatorios: ['ACTIVITIES_REMINDERS'],
  bitacora: ['ACTIVITIES_LOGS'],
  calendario: ['ACTIVITIES_CALENDAR'],
  reuniones: ['ACTIVITIES_MEETINGS'],

  proyectos: ['PROJECTS_LIST'],
  'proyectos-tareas': ['PROJECTS_TASKS'],
  'proyectos-hitos': ['PROJECTS_MILESTONES'],
  'proyectos-costos': ['PROJECTS_EXPENSES'],
  'proyectos-documentos': ['PROJECTS_DOCUMENTS'],
  'proyectos-tiempo': ['PROJECTS_TIME'],

  tickets: ['TICKETS_LIST'],
  // TICKETS_FAQS es el identificador histórico de esta misma vista.
  faqs: ['TICKETS_KNOWLEDGE_BASE', 'TICKETS_FAQS'],
  agents: ['TICKETS_AGENTS'],

  cases: ['LEGAL_CASES'],
  reminders: ['LEGAL_REMINDERS'],

  'reportes-ventas': ['REPORTS_SALES'],
  'reportes-compras': ['REPORTS_PURCHASES'],
  'reportes-financieros': ['REPORTS_FINANCIAL'],
  'reportes-inventario': ['REPORTS_INVENTORY'],
  'reportes-clientes': ['REPORTS_CLIENTS'],
  'reportes-proveedores': ['REPORTS_PROVIDERS'],
  'reportes-rrhh': ['REPORTS_HR'],

  'solicitudes-financiamiento': ['FINANCING_APPLICATIONS'],
  'calculadora-financiamiento': ['FINANCING_CALCULATOR'],

  'plan-cuentas': ['ACCOUNTING_CHART'],
  'solicitudes-pago': ['ACCOUNTING_HR_PAYMENT_REQUESTS'],
  diario: ['ACCOUNTING_JOURNAL'],
  'libro-mayor': ['ACCOUNTING_LEDGER'],
  'balance-comprobacion': ['ACCOUNTING_TRIAL_BALANCE'],
  'estado-resultados': ['ACCOUNTING_PROFIT_LOSS'],
  'balance-general-contable': ['ACCOUNTING_BALANCE_SHEET'],
  'flujo-efectivo': ['ACCOUNTING_CASH_FLOW'],
  'diferencias-cambiarias': ['ACCOUNTING_EXCHANGE_DIFFERENCES'],
  'cambios-patrimonio': ['ACCOUNTING_EQUITY'],
  'activos-fijos': ['ACCOUNTING_ASSETS'],
  'libro-bancos': ['ACCOUNTING_LEDGER'],
  conciliacion: ['ACCOUNTING_RECONCILIATION'],
  periodos: ['ACCOUNTING_PERIODS'],
  'reportes-fiscales': ['ACCOUNTING_FISCAL'],
  'auditoria-facturas': ['ACCOUNTING_INVOICE_AUDIT'],
  presupuestos: ['ACCOUNTING_BUDGET'],
  'categorias-gastos': ['ACCOUNTING_EXPENSE_CATEGORIES'],
  configuracion: ['ACCOUNTING_CONFIG'],
};

/** Vistas retiradas del producto o aún no expuestas en la navegación. */
export const HIDDEN_DEFERRED_SALES_VIEW_IDS = new Set<string>([
  'entregas',
  'gestion-compras',
  'precios-proveedores',
  'organigrama',
  'sucursales',
  'tenancy',
  'plataforma',
  'paises',
  'precios',
]);

/** Alias para impedir que permisos históricos vuelvan a mostrarse en Roles. */
export const HIDDEN_PERMISSION_MODULE_IDS = new Set([
  'ENTREGAS',
  'SALES_DELIVERIES',
  'PURCHASES_MANAGEMENT',
  'PURCHASES_SUPPLIER_PRICES',
  'CONFIG_TENANCY',
  'CONFIG_PLATFORM',
  'CONFIG_COUNTRIES',
  'CONFIG_MODULE_PRICING',
  'CONFIG_ORG_CHART',
  'COMPANY_BRANCHES',
]);

/** Permiso exacto de cada vista del sidebar. Puede diferir del módulo que habilita la suscripción. */
export const SIDEBAR_SUBMENU_PERMISSION_MODULES: Record<string, string[]> = {
  'suscripciones:mi-sucursal': ['CONFIG_COMPANY'],
  'suscripciones:plan-sucursal': ['SUBSCRIPTIONS'],
  'suscripciones:usuarios': ['CONFIG_USERS'],
  'suscripciones:roles': ['CONFIG_ROLES'],
  'suscripciones:departamentos': ['CONFIG_DEPARTMENTS'],
  'suscripciones:dominio': ['CONFIG_DOMAINS'],
  'configuracion:branding': ['CONFIG_BRANDING'],
  'configuracion:documentos-pdf': ['CONFIG_PDF'],
  'configuracion:seguridad': ['CONFIG_SECURITY'],
  'configuracion:auditoria': ['AUDIT_LOGS'],
  'configuracion:currency': ['CONFIG_CURRENCY'],
  'facturacion-caja': ['RETAIL_POS'],
  'control-caja': ['RETAIL_CASH_CONTROL'],
  'creditos-proveedor': ['PURCHASES_RETURNS'],
  'cuentas-cobrar': ['FINANCIAL_RECEIVABLES', 'FINANCIAL_INCOMES'],
  'cuentas-pagar': ['FINANCIAL_PAYABLES', 'FINANCIAL_EXPENSES'],
  'caja-bancos': ['FINANCIAL_BANK', 'FINANCIAL_ACCOUNTS'],
  'calendario-financiero': ['FINANCIAL_CALENDAR', 'FINANCIAL_DASHBOARD'],
  'analisis-ingresos-gastos': ['FINANCIAL_ANALYSIS', 'FINANCIAL_BALANCE'],
  'finanzas:perdidas': ['FINANCIAL_LOSSES', 'FINANCIAL_EXPENSES'],
  'rh:comisiones': ['HR_COMMISSIONS'],
  'inventario:productos': ['INVENTORY_PRODUCTS'],
  'inventario:marcas-clientes': ['INVENTORY_PRODUCTS'],
  'inventario:servicios': ['INVENTORY_SERVICES'],
  'inventario:atributos': ['INVENTORY_ATTRIBUTES'],
  'inventario:auditorias': ['INVENTORY_AUDITS'],
  'inventario:perdidas': ['INVENTORY_LOSSES'],
  'inventario:mobiliario-equipos': ['INVENTORY_ASSETS'],
  'inventario:configuracion': ['INVENTORY_CONFIG'],
};

/** Tabs internos que no son entradas propias del sidebar, pero sí requieren autorización individual. */
export const INTERNAL_PERMISSION_SUBMODULES: SidebarPermissionDefinition[] = [
  // Cuentas financieras se muestran dentro de Caja y Bancos, pero sus
  // operaciones tienen endpoints y acciones propios en la API.
  { id: 'FINANCIAL_ACCOUNTS', label: 'Cuentas financieras', parent: 'FINANCIAL', subscription: false },

  // Configuración
  { id: 'CONFIG_BRANDING', label: 'Marca y Tema', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_PDF', label: 'Documentos PDF', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_SECURITY', label: 'Seguridad', parent: 'CONFIGURATION', subscription: false },
  { id: 'AUDIT_LOGS', label: 'Logs y auditoría', parent: 'CONFIGURATION', subscription: false },
  { id: 'CONFIG_CURRENCY', label: 'Moneda y Cambio', parent: 'CONFIGURATION', subscription: false },

  // Mi Empresa
  { id: 'CONFIG_COMPANY', label: 'Datos generales', parent: 'MY_COMPANY', subscription: false },
  { id: 'SUBSCRIPTIONS', label: 'Módulos y Plan', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_USERS', label: 'Usuarios', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_ROLES', label: 'Roles y Permisos', parent: 'MY_COMPANY', subscription: false },
  { id: 'CONFIG_DEPARTMENTS', label: 'Departamentos', parent: 'MY_COMPANY', subscription: false },
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
  'PROJECTS', 'FORCE_SALES', 'MY_COMPANY', 'CONFIGURATION', 'RESTAURANT',
  'RESTAURANT_TABLES', 'RESTAURANT_SALON', 'RESTAURANT_ORDERS', 'RESTAURANT_MENU', 'RESTAURANT_KITCHEN', 'RESTAURANT_REPORTS',
  'TRACKING', 'DASHBOARD',
  ...PERMISSION_SUBMODULES.map(({ id }) => id),
]);

/** Permisos internos que siguen existiendo, pero se gobiernan desde su vista padre. */
export const SIDEBAR_PERMISSION_PARENT_ALIASES: Record<string, string[]> = {
  MY_COMPANY: ['MY_COMPANY', 'CONFIG_COMPANY', 'CONFIG_USERS', 'CONFIG_ROLES', 'CONFIG_DEPARTMENTS', 'CONFIG_DOMAINS', 'SUBSCRIPTIONS'],
  CONFIGURATION: ['CONFIGURATION', 'CONFIG_BRANDING', 'CONFIG_SECURITY', 'AUDIT_LOGS', 'CONFIG_CURRENCY', 'CONFIG_PDF'],
};

/** Alias de lectura para roles guardados antes de separar las vistas. */
export const LEGACY_VIEW_PERMISSION_ALIASES: Record<string, string[]> = {
  RETAIL_POS: ['SALES_POS', 'SALES', 'CAJA'],
  RETAIL_CASH_CONTROL: ['RETAIL_POS', 'SALES_POS', 'SALES', 'CAJA'],
  FINANCIAL_BANK: ['FINANCIAL_ACCOUNTS'],
  FINANCIAL_ACCOUNTS: ['FINANCIAL_BANK'],
  CLIENTS: ['SALES_CLIENTS'],
  PROVIDERS: ['PURCHASES_PROVIDERS'],
  RESTAURANT_SALON: ['RESTAURANT_TABLES'],
  RESTAURANT_ORDERS: ['RESTAURANT_TABLES'],
  TICKETS_LIST: ['TICKETS_VIEW', 'TICKETS'],
  TICKETS_VIEW: ['TICKETS_LIST', 'TICKETS'],
  TICKETS_KNOWLEDGE_BASE: ['TICKETS_FAQS'],
  DOCUMENTS_STORAGE_PLANS: ['DOCUMENTS'],
  DOCUMENTS_FOLDERS: ['DOCUMENTS_FILES'],
  HR_DEPARTMENTS: ['HR_EMPLOYEES'],
  ACTIVITIES_CALENDAR: ['ACTIVITIES_EVENTS'],
  ACTIVITIES_MEETINGS: ['ACTIVITIES_EVENTS'],
};
