import { LucideIcon } from 'lucide-react';

export interface Submodule {
  id: string;
  label: string;
  description: string;
}

export interface Module {
  id: string;
  label: string;
  icon: any;
  description: string;
  submodules?: Submodule[];
}

// Submódulos de Ventas (alineados con sidebar)
export const SALES_SUBMODULES: Submodule[] = [
  { id: 'SALES_CLIENTS', label: 'Clientes', description: 'Gestión de clientes y CRM' },
  { id: 'SALES_QUOTES', label: 'Estimaciones', description: 'Cotizaciones comerciales' },
  { id: 'SALES_ORDERS', label: 'Órdenes de Venta', description: 'Pedidos por procesar' },
  { id: 'SALES_INVOICES', label: 'Facturas', description: 'Facturación y cobros' },
  { id: 'SALES_RECURRING', label: 'Facturas Recurrentes', description: 'Suscripciones y contratos' },
  { id: 'SALES_PAYMENTS', label: 'Pagos Recibidos', description: 'Historial de ingresos' },
  { id: 'SALES_RETURNS', label: 'Devoluciones de Venta', description: 'Retornos de mercancía' },
  { id: 'SALES_CREDIT_NOTES', label: 'Notas de Crédito', description: 'Ajustes y créditos emitidos' },
];

// Submódulos de Compras (alineados con sidebar)
export const PURCHASES_SUBMODULES: Submodule[] = [
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', description: 'Gestión de proveedores' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', description: 'Registro de gastos' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos Recurrentes', description: 'Gastos periódicos' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de Compra', description: 'Órdenes de compra' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones de Compra', description: 'Recepción de mercancía' },
  { id: 'PURCHASES_INVOICES', label: 'Facturas de Proveedor', description: 'Facturas de proveedores' },
  { id: 'PURCHASES_INVOICES_REC', label: 'Facturas Proveedor Rec.', description: 'Facturas recurrentes de proveedores' },
  { id: 'PURCHASES_PAYMENTS', label: 'Pagos Realizados', description: 'Pagos a proveedores' },
  { id: 'PURCHASES_RETURNS', label: 'Créditos del Proveedor', description: 'Devoluciones y créditos' },
];

// Submódulos de Inventario
export const INVENTORY_SUBMODULES: Submodule[] = [
  { id: 'INVENTORY_DASHBOARD', label: 'Dashboard', description: 'Vista general de inventario' },
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', description: 'Catálogo de productos' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', description: 'Gestión de almacenes' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', description: 'Movimientos entre almacenes' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', description: 'Control de stock' },
  { id: 'INVENTORY_MOVEMENTS', label: 'Movimientos', description: 'Historial de movimientos' },
];

// Submódulos de Finanzas
export const FINANCIAL_SUBMODULES: Submodule[] = [
  { id: 'FINANCIAL_DASHBOARD', label: 'Dashboard', description: 'Dashboard y Estadísticas' },
  { id: 'FINANCIAL_INCOMES', label: 'Ingresos', description: 'Registro de ingresos' },
  { id: 'FINANCIAL_EXPENSES', label: 'Gastos', description: 'Registro de egresos' },
  { id: 'FINANCIAL_EXPENSES_REC', label: 'Gastos Recurrentes', description: 'Programación de gastos' },
  { id: 'FINANCIAL_INCOMES_REC', label: 'Ingresos Recurrentes', description: 'Programación de ingresos' },
  { id: 'FINANCIAL_BALANCE', label: 'Balance General', description: 'Reportes y balance' },
];

// Submódulos de Recursos Humanos
export const HR_SUBMODULES: Submodule[] = [
  { id: 'HR_DASHBOARD', label: 'Dashboard y Estadísticas', description: 'Vista General de RRHH' },
  { id: 'HR_EMPLOYEES', label: 'Empleados', description: 'Gestión de empleados' },
  { id: 'HR_PAYROLL', label: 'Nóminas', description: 'Procesamiento de nómina' },
  { id: 'HR_ATTENDANCE', label: 'Asistencia', description: 'Control de asistencia' },
  { id: 'HR_LEAVES', label: 'Vacaciones', description: 'Gestión de vacaciones' },
  { id: 'HR_PERFORMANCE', label: 'Desempeño', description: 'Evaluaciones de desempeño' },
  { id: 'HR_TRAINING', label: 'Capacitación', description: 'Programas de capacitación' },
  { id: 'HR_BENEFITS', label: 'Beneficios', description: 'Beneficios y prestaciones' },
  { id: 'HR_PAYROLL_CONFIG', label: 'Config Nómina', description: 'Configuraciones de nómina' },
];

// Submódulos de Proyectos
export const PROJECTS_SUBMODULES: Submodule[] = [];

// Submódulos de Notificaciones
export const NOTIFICATIONS_SUBMODULES: Submodule[] = [
  { id: 'NOTIFICATIONS_ALERTS', label: 'Alertas', description: 'Alertas del sistema' },
  { id: 'NOTIFICATIONS_MESSAGES', label: 'Mensajes', description: 'Mensajes y comunicaciones' },
  { id: 'NOTIFICATIONS_PUSH', label: 'Push', description: 'Notificaciones Push' },
];

// Submódulos de Actividades
export const ACTIVITIES_SUBMODULES: Submodule[] = [
  { id: 'ACTIVITIES_TASKS', label: 'Tareas', description: 'Gestión de tareas' },
  { id: 'ACTIVITIES_EVENTS', label: 'Eventos', description: 'Calendario de eventos' },
  { id: 'ACTIVITIES_REMINDERS', label: 'Recordatorios', description: 'Recordatorios' },
  { id: 'ACTIVITIES_LOGS', label: 'Bitácora', description: 'Historial de actividades' },
];

// Submódulos de Documentos
export const DOCUMENTS_SUBMODULES: Submodule[] = [
  { id: 'DOCUMENTS_FILES', label: 'Archivos', description: 'Almacenamiento de archivos' },
  { id: 'DOCUMENTS_CONTRACTS', label: 'Contratos', description: 'Gestión de contratos' },
  { id: 'DOCUMENTS_INVOICES', label: 'Facturas Legales', description: 'Facturas y documentos legales' },
  { id: 'DOCUMENTS_REPORTS', label: 'Reportes', description: 'Reportes documentales' },
];

// Submódulos de Configuración
export const CONFIGURATION_SUBMODULES: Submodule[] = [
  { id: 'CONFIG_COMPANY', label: 'Empresa', description: 'Datos fiscales y generales' },
  { id: 'CONFIG_BRANDING', label: 'Marca y Tema', description: 'Colores, logo y personalización' },
  { id: 'CONFIG_USERS', label: 'Usuarios', description: 'Gestión de accesos de usuarios' },
  { id: 'CONFIG_ROLES', label: 'Roles y Permisos', description: 'Control de acceso granular' },
  { id: 'CONFIG_SECURITY', label: 'Seguridad', description: '2FA, Auditoría y Sesiones' },
  { id: 'CONFIG_CURRENCY', label: 'Moneda', description: 'Tipo de cambio y moneda base' },
  { id: 'CONFIG_SUBSCRIPTION', label: 'Suscripción', description: 'Estado y planes de servicio' },
  { id: 'CONFIG_TENANCY', label: 'Multi-Tenancy', description: 'Configuración de tenencia' },
  { id: 'CONFIG_PLATFORM', label: 'Plataforma', description: 'Ajustes globales de sistema' },
  { id: 'CONFIG_DOMAINS', label: 'Dominios', description: 'Configuración de dominios y URLs' },
];


// Submódulos de Reportes
export const REPORTS_SUBMODULES: Submodule[] = [
  { id: 'REPORTS_SALES', label: 'Ventas', description: 'Reportes de ventas' },
  { id: 'REPORTS_PURCHASES', label: 'Compras', description: 'Reportes de compras' },
  { id: 'REPORTS_FINANCIAL', label: 'Financiero', description: 'Reportes financieros' },
  { id: 'REPORTS_INVENTORY', label: 'Inventario', description: 'Reportes de inventario' },
  { id: 'REPORTS_CLIENTS', label: 'Clientes', description: 'Reportes de clientes' },
  { id: 'REPORTS_PROVIDERS', label: 'Proveedores', description: 'Reportes de proveedores' },
  { id: 'REPORTS_HR', label: 'Recursos Humanos', description: 'Reportes de recursos humanos' },
  { id: 'REPORTS_SUBSCRIPTIONS', label: 'Suscripciones', description: 'Reportes de suscripciones' },
];
