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
  { id: 'SALES_RETURNS', label: 'Devoluciones', description: 'Retornos de mercancía' },
  { id: 'SALES_CREDIT_NOTES', label: 'Notas de Crédito', description: 'Ajustes y créditos emitidos' },
];

// Submódulos de Compras (alineados con sidebar)
export const PURCHASES_SUBMODULES: Submodule[] = [
  { id: 'PURCHASES_PROVIDERS', label: 'Proveedores', description: 'Gestión de proveedores' },
  { id: 'PURCHASES_EXPENSES', label: 'Gastos', description: 'Registro de gastos' },
  { id: 'PURCHASES_EXPENSES_REC', label: 'Gastos Recurrentes', description: 'Gastos periódicos' },
  { id: 'PURCHASES_ORDERS', label: 'Órdenes de Compra', description: 'Órdenes de compra' },
  { id: 'PURCHASES_RECEIPTS', label: 'Recepciones', description: 'Recepción de mercancía' },
  { id: 'PURCHASES_INVOICES', label: 'Facturas de Proveedor', description: 'Facturas de proveedores' },
  { id: 'PURCHASES_INVOICES_REC', label: 'Facturas Proveedor Rec.', description: 'Facturas recurrentes de proveedores' },
  { id: 'PURCHASES_PAYMENTS', label: 'Pagos Realizados', description: 'Pagos a proveedores' },
  { id: 'PURCHASES_RETURNS', label: 'Créditos del Proveedor', description: 'Devoluciones y créditos' },
];

// Submódulos de Inventario
export const INVENTORY_SUBMODULES: Submodule[] = [
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', description: 'Catálogo de productos' },
  { id: 'INVENTORY_WAREHOUSES', label: 'Almacenes', description: 'Gestión de almacenes' },
  { id: 'INVENTORY_TRANSFERS', label: 'Transferencias', description: 'Transferencias entre almacenes' },
  { id: 'INVENTORY_ADJUSTMENTS', label: 'Ajustes', description: 'Ajustes de inventario' },
  { id: 'INVENTORY_COUNT', label: 'Conteos', description: 'Conteos físicos' },
  { id: 'INVENTORY_SERIALS', label: 'Seriales', description: 'Números de serie' },
  { id: 'INVENTORY_LOTS', label: 'Lotes', description: 'Gestión de lotes' },
];

// Submódulos de Finanzas
export const FINANCIAL_SUBMODULES: Submodule[] = [
  { id: 'FINANCIAL_ACCOUNTS', label: 'Plan de Cuentas', description: 'Catálogo de cuentas contables' },
  { id: 'FINANCIAL_JOURNAL', label: 'Libro Diario', description: 'Asientos contables' },
  { id: 'FINANCIAL_LEDGER', label: 'Libro Mayor', description: 'Mayor general' },
  { id: 'FINANCIAL_BANK', label: 'Bancos', description: 'Conciliación bancaria' },
  { id: 'FINANCIAL_BUDGET', label: 'Presupuestos', description: 'Gestión de presupuestos' },
  { id: 'FINANCIAL_REPORTS', label: 'Reportes', description: 'Estados financieros' },
];

// Submódulos de Recursos Humanos
export const HR_SUBMODULES: Submodule[] = [
  { id: 'HR_EMPLOYEES', label: 'Empleados', description: 'Gestión de empleados' },
  { id: 'HR_PAYROLL', label: 'Nómina', description: 'Procesamiento de nómina' },
  { id: 'HR_ATTENDANCE', label: 'Asistencia', description: 'Control de asistencia' },
  { id: 'HR_LEAVES', label: 'Vacaciones', description: 'Gestión de vacaciones' },
  { id: 'HR_PERFORMANCE', label: 'Desempeño', description: 'Evaluaciones de desempeño' },
  { id: 'HR_TRAINING', label: 'Capacitación', description: 'Programas de capacitación' },
  { id: 'HR_BENEFITS', label: 'Beneficios', description: 'Beneficios y prestaciones' },
];

// Submódulos de Proyectos
export const PROJECTS_SUBMODULES: Submodule[] = [
  { id: 'PROJECTS_LIST', label: 'Proyectos', description: 'Lista de proyectos' },
  { id: 'PROJECTS_TASKS', label: 'Tareas', description: 'Gestión de tareas' },
  { id: 'PROJECTS_MILESTONES', label: 'Hitos', description: 'Hitos del proyecto' },
  { id: 'PROJECTS_TIME', label: 'Tiempo', description: 'Registro de tiempo' },
  { id: 'PROJECTS_EXPENSES', label: 'Gastos', description: 'Gastos del proyecto' },
  { id: 'PROJECTS_DOCUMENTS', label: 'Documentos', description: 'Documentos del proyecto' },
];
