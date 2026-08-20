export type EnterpriseModuleOption = {
  id: string;
  label: string;
  description: string;
};

/**
 * Catálogo de módulos de primer nivel que existe en la matriz de roles y en
 * el sidebar del ERP. El rubro define la configuración por defecto y una
 * sucursal puede heredarla o personalizarla.
 */
export const ENTERPRISE_MODULE_OPTIONS: EnterpriseModuleOption[] = [
  { id: 'DASHBOARD', label: 'Dashboard', description: 'KPIs y resumen general del negocio' },
  { id: 'FINANCING', label: 'Financiamiento PYME', description: 'Financiamiento y créditos para el negocio' },
  { id: 'SALES', label: 'Ventas', description: 'Clientes, cotizaciones, facturación y caja' },
  { id: 'SALES_POS', label: 'Restaurante POS', description: 'Facturación rápida por caja para restaurante y alimentos' },
  { id: 'PURCHASES', label: 'Compras', description: 'Proveedores, órdenes y recepción' },
  { id: 'INVENTORY', label: 'Inventario de mercancías', description: 'Productos, servicios, stock, bodegas y transferencias' },
  { id: 'FINANCIAL', label: 'Finanzas', description: 'Ingresos, gastos, bancos y presupuestos' },
  { id: 'ACCOUNTING', label: 'Contabilidad', description: 'Plan de cuentas, asientos y reportes contables' },
  { id: 'HR', label: 'Recursos Humanos', description: 'Empleados, nómina y asistencia' },
  { id: 'HR_TRAINING', label: 'Centro de capacitación', description: 'Cursos y capacitaciones del equipo' },
  { id: 'ACTIVITIES', label: 'Actividades', description: 'Tareas, eventos y bitácora' },
  { id: 'TICKETS', label: 'Tickets y soporte', description: 'Atención y seguimiento de incidencias' },
  { id: 'SUPPORT_TECH', label: 'Soporte técnico', description: 'Soporte técnico especializado de NovaHub' },
  { id: 'LEGAL', label: 'Asesoría legal', description: 'Casos y recordatorios legales' },
  { id: 'NOVACHAT', label: 'Nova Suite', description: 'Bandeja multicanal y comunicación unificada' },
  { id: 'DOCUMENTS', label: 'Nova Cloud', description: 'Archivos, carpetas y documentos del negocio' },
  { id: 'NOTIFICATIONS', label: 'Notificaciones', description: 'Alertas, mensajes y notificaciones push' },
  { id: 'REPORTS', label: 'Reportes', description: 'Indicadores y reportes del negocio' },
  { id: 'MY_COMPANY', label: 'Mi Empresa', description: 'Equipo, roles, sucursales y configuración empresarial' },
  { id: 'CONFIGURATION', label: 'Configuración', description: 'Marca, seguridad, moneda y ajustes globales del tenant' },
];

export const DEFAULT_ENTERPRISE_MODULES = ENTERPRISE_MODULE_OPTIONS.map((module) => module.id);
