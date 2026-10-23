export type ManagerReportSource =
  | 'sales' | 'purchases' | 'inventory' | 'finances' | 'accounting' | 'hr'
  | 'activities' | 'projects' | 'tickets' | 'documents' | 'restaurant' | 'hotel'
  | 'logistics' | 'intl-imports' | 'asana' | 'notifications' | 'financing'
  | 'legal' | 'novachat' | 'support';

export type ManagerReportsView = 'overview' | 'sales' | 'purchases' | 'financial' | 'inventory'
  | 'customers' | 'providers' | 'hr' | 'subscriptions' | `source-${ManagerReportSource}`;

export const MANAGER_REPORT_SOURCES: Array<{ id: ManagerReportSource; label: string }> = [
  { id: 'sales', label: 'Ventas' }, { id: 'purchases', label: 'Compras' }, { id: 'inventory', label: 'Inventario' },
  { id: 'finances', label: 'Finanzas' }, { id: 'accounting', label: 'Contabilidad' }, { id: 'hr', label: 'Recursos Humanos' },
  { id: 'activities', label: 'Actividades' }, { id: 'projects', label: 'Proyectos' }, { id: 'tickets', label: 'Tickets' },
  { id: 'documents', label: 'Nova Cloud' }, { id: 'restaurant', label: 'Restaurante' }, { id: 'hotel', label: 'Hotel' },
  { id: 'logistics', label: 'Tracking' }, { id: 'intl-imports', label: 'Importaciones Internacionales' }, { id: 'asana', label: 'Asana' },
  { id: 'notifications', label: 'Notificaciones' }, { id: 'financing', label: 'Financiamiento PYME' },
  { id: 'legal', label: 'Asesoría legal' }, { id: 'novachat', label: 'Nova Suite' }, { id: 'support', label: 'Soporte técnico' },
];

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
  ...MANAGER_REPORT_SOURCES.map((source) => ({ id: `source-${source.id}` as const, label: source.label })),
];
