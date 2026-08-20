export type ManagerSalesView =
  | 'overview'
  | 'customers'
  | 'quotes'
  | 'orders'
  | 'invoices'
  | 'recurring'
  | 'payments'
  | 'creditnotes'
  | 'credits'
  | 'deliveries'
  | 'cash'
  | 'pricelists';

export const MANAGER_SALES_VIEWS: Array<{ id: ManagerSalesView; label: string }> = [
  { id: 'overview', label: 'Resumen de ventas' },
  { id: 'customers', label: 'Clientes' },
  { id: 'quotes', label: 'Cotizaciones' },
  { id: 'orders', label: 'Órdenes de venta' },
  { id: 'invoices', label: 'Facturas' },
  { id: 'recurring', label: 'Facturación recurrente' },
  { id: 'payments', label: 'Pagos recibidos' },
  { id: 'creditnotes', label: 'Notas de crédito' },
  { id: 'credits', label: 'Créditos' },
  { id: 'deliveries', label: 'Entregas' },
  { id: 'cash', label: 'Facturación y reportes de caja' },
  { id: 'pricelists', label: 'Listas de precios' },
];
