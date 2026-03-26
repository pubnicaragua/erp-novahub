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

// Submódulos de Inventario (sin vistas subordinadas en sidebar por ahora)
export const INVENTORY_SUBMODULES: Submodule[] = [];

// Submódulos de Finanzas
export const FINANCIAL_SUBMODULES: Submodule[] = [
  { id: 'FINANCIAL_INCOMES', label: 'Ingresos', description: 'Registro de ingresos' },
  { id: 'FINANCIAL_EXPENSES', label: 'Gastos', description: 'Registro de egresos' },
  { id: 'FINANCIAL_EXPENSES_REC', label: 'Gastos Recurrentes', description: 'Programación de gastos' },
  { id: 'FINANCIAL_BALANCE', label: 'Balance General', description: 'Reportes y balance' },
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
export const PROJECTS_SUBMODULES: Submodule[] = [];
