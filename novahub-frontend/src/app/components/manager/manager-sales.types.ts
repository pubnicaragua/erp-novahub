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
  | 'invoice-series'
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
  { id: 'invoice-series', label: 'Series de facturación' },
  { id: 'pricelists', label: 'Listas de precios' },
];

/** La vista queda implementada para una fase posterior, pero no se navega aún. */
export const VISIBLE_MANAGER_SALES_VIEWS = MANAGER_SALES_VIEWS.filter((view) => view.id !== 'deliveries');
