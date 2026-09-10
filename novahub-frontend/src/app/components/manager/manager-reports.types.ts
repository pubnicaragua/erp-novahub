export type ManagerReportsView =
  | 'overview'
  | 'sales'
  | 'purchases'
  | 'financial'
  | 'inventory'
  | 'customers'
  | 'providers'
  | 'hr'
  | 'subscriptions';

export const MANAGER_REPORTS_VIEWS: Array<{ id: ManagerReportsView; label: string }> = [
  { id: 'overview', label: 'Resumen de reportes' },
  { id: 'sales', label: 'Ventas' },
  { id: 'purchases', label: 'Compras' },
  { id: 'financial', label: 'Financiero' },
  { id: 'inventory', label: 'Inventario' },
  { id: 'customers', label: 'Clientes' },
  { id: 'providers', label: 'Proveedores' },
  { id: 'hr', label: 'Recursos Humanos' },
  { id: 'subscriptions', label: 'Suscripciones' },
];
