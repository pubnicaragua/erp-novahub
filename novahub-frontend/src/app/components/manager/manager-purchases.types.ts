export type ManagerPurchasesView =
  | 'overview'
  | 'suppliers'
  | 'orders'
  | 'receipts'
  | 'invoices'
  | 'recurring'
  | 'payments'
  | 'credits'
  | 'expenses'
  | 'recurringexpenses'
  | 'requests'
  | 'management'
  | 'supplierprices';

export const MANAGER_PURCHASES_VIEWS: Array<{ id: ManagerPurchasesView; label: string }> = [
  { id: 'overview', label: 'Resumen de compras' },
  { id: 'suppliers', label: 'Proveedores' },
  { id: 'orders', label: 'Órdenes de compra' },
  { id: 'receipts', label: 'Recepciones' },
  { id: 'invoices', label: 'Facturas de proveedor' },
  { id: 'recurring', label: 'Facturas recurrentes' },
  { id: 'payments', label: 'Pagos realizados' },
  { id: 'credits', label: 'Créditos de proveedor' },
  { id: 'expenses', label: 'Gastos' },
  { id: 'recurringexpenses', label: 'Gastos recurrentes' },
  { id: 'requests', label: 'Solicitudes de compra' },
  { id: 'management', label: 'Gestión de compras' },
  { id: 'supplierprices', label: 'Precios de proveedores' },
];
