export type PdfDocumentStructure = 'transaction' | 'history' | 'report' | 'receipt' | 'administrative' | 'dashboard' | 'print';
export type PdfTemplateFamily = 'transaction' | 'history' | 'report' | 'receipt' | 'cash' | 'cash-ticket' | 'dashboard' | 'label' | 'administrative';
export type PdfTemplateMode = 'editable' | 'fixed';
export type PdfExportAdapterKind = 'transaction' | 'history' | 'report' | 'dashboard' | 'receipt' | 'administrative' | 'fixed';

export type PdfTemplateModule =
  | 'ventas'
  | 'compras'
  | 'finanzas'
  | 'contabilidad'
  | 'inventario'
  | 'recursos-humanos'
  | 'reportes'
  | 'dashboard'
  | 'portal-clientes'
  | 'actividades'
  | 'proyectos'
  | 'restaurante'
  | 'tracking'
  | 'tickets'
  | 'financiamiento'
  | 'auditoria';

/** Contrato único de una salida que puede descargar una vista del ERP. */
export interface PdfTemplateTarget {
  key: string;
  /** Identificador estable de la vista montada que alimenta la salida. */
  viewId?: string;
  /** Adaptador semántico usado por PDF/Excel; nunca se resuelve desde texto de UI. */
  adapterId?: string;
  module: PdfTemplateModule;
  moduleLabel: string;
  label: string;
  structure: PdfDocumentStructure;
  family?: PdfTemplateFamily;
  /** Formato que puede aparecer en Documentos PDF. Los físicos no se editan. */
  templateMode?: PdfTemplateMode;
  /** Permiso de la vista que autoriza descargar la salida. */
  exportPermission?: string;
  capabilities?: {
    editableCanvas?: boolean;
    importable?: boolean;
    repeatableTable?: boolean;
    exportPdf?: boolean;
    exportExcel?: boolean;
    paperSizes?: Array<'LETTER' | 'A4' | 'OFICIO' | 'LEGAL' | 'LABEL' | 'ROLL-80'>;
  };
  legacyKeys?: string[];
  source: string;
}

/** Alias público del contrato nuevo. Se conserva PdfTemplateTarget para los
 * diseños guardados y para no romper consumidores existentes. */
export type PdfExportTarget = PdfTemplateTarget & {
  viewId: string;
  adapterId: string;
  templateMode: PdfTemplateMode;
  exportPermission: string;
  capabilities: NonNullable<PdfTemplateTarget['capabilities']>;
};

export interface PdfExportAdapter {
  id: string;
  kind: PdfExportAdapterKind;
  /** Render semántico compartido por vista previa y documento descargado. */
  pdfRenderer: 'configured-template' | 'configured-sections' | 'physical';
  /** Excel se genera desde las mismas filas filtradas de la vista. */
  excelRenderer: 'report-workbook' | 'transaction-workbook' | 'none';
}

export const PDF_EXPORT_ADAPTERS: Record<PdfExportAdapterKind, PdfExportAdapter> = {
  transaction: { id: 'semantic.transaction', kind: 'transaction', pdfRenderer: 'configured-template', excelRenderer: 'transaction-workbook' },
  history: { id: 'semantic.history', kind: 'history', pdfRenderer: 'configured-template', excelRenderer: 'report-workbook' },
  report: { id: 'semantic.report', kind: 'report', pdfRenderer: 'configured-template', excelRenderer: 'report-workbook' },
  dashboard: { id: 'semantic.dashboard', kind: 'dashboard', pdfRenderer: 'configured-sections', excelRenderer: 'report-workbook' },
  receipt: { id: 'semantic.receipt', kind: 'receipt', pdfRenderer: 'configured-template', excelRenderer: 'transaction-workbook' },
  administrative: { id: 'semantic.administrative', kind: 'administrative', pdfRenderer: 'configured-template', excelRenderer: 'report-workbook' },
  fixed: { id: 'physical.fixed', kind: 'fixed', pdfRenderer: 'physical', excelRenderer: 'none' },
};

/**
 * Catálogo único de salidas PDF/imprimibles del ERP.
 * Las entradas activas se consumen por los exportadores y por el canvas; las
 * vistas tabulares comparten la estructura semántica aunque su botón pueda
 * vivir en un componente de módulo o de reportes.
 */
const BASE_PDF_TEMPLATE_TARGETS: PdfTemplateTarget[] = [
  { key: 'ventas.estimate', module: 'ventas', moduleLabel: 'Ventas', label: 'Cotizaciones', structure: 'transaction', legacyKeys: ['estimate'], source: 'generateEstimatePDF' },
  { key: 'ventas.order', module: 'ventas', moduleLabel: 'Ventas', label: 'Órdenes de venta', structure: 'transaction', legacyKeys: ['order'], source: 'generateEstimatePDF' },
  { key: 'ventas.invoice', module: 'ventas', moduleLabel: 'Ventas', label: 'Facturas', structure: 'transaction', legacyKeys: ['invoice'], source: 'generateEstimatePDF' },
  { key: 'ventas.recurring', module: 'ventas', moduleLabel: 'Ventas', label: 'Facturas recurrentes', structure: 'transaction', legacyKeys: ['recurring'], source: 'generateRecurringInvoicePDF' },
  { key: 'ventas.payment', module: 'ventas', moduleLabel: 'Ventas', label: 'Pagos recibidos', structure: 'receipt', legacyKeys: ['payment'], source: 'generateEstimatePDF' },
  { key: 'ventas.return', module: 'ventas', moduleLabel: 'Ventas', label: 'Devoluciones', structure: 'transaction', legacyKeys: ['return'], source: 'generateEstimatePDF' },
  { key: 'ventas.credit-note', module: 'ventas', moduleLabel: 'Ventas', label: 'Notas de crédito', structure: 'transaction', legacyKeys: ['credit-note'], source: 'generateEstimatePDF' },
  { key: 'ventas.cash-session', module: 'ventas', moduleLabel: 'Ventas', label: 'Resumen de sesión de caja', structure: 'receipt', source: 'generateSessionSummaryPDF' },
  { key: 'ventas.cash-ticket', module: 'ventas', moduleLabel: 'Ventas', label: 'Ticket de caja', structure: 'print', family: 'cash-ticket', source: 'printPosTicket' },
  { key: 'ventas.cash-historical-report', module: 'ventas', moduleLabel: 'Ventas', label: 'Reporte histórico de caja', structure: 'report', family: 'cash', source: 'generateHistoricalCashReportPDF' },
  { key: 'ventas.customer-history', module: 'ventas', moduleLabel: 'Ventas', label: 'Historial de cliente', structure: 'history', source: 'customerTransactionsExport' },

  { key: 'compras.list', module: 'compras', moduleLabel: 'Compras', label: 'Listado de compras', structure: 'report', source: 'generatePurchaseListPDF' },
  { key: 'compras.purchase-record', module: 'compras', moduleLabel: 'Compras', label: 'Registro de compra', structure: 'transaction', source: 'generatePurchaseRecordPDF' },
  { key: 'compras.supplier-history', module: 'compras', moduleLabel: 'Compras', label: 'Historial de proveedor', structure: 'history', source: 'generateSupplierHistoryPDF' },
  { key: 'compras.supplier', module: 'compras', moduleLabel: 'Compras', label: 'Ficha de proveedor', structure: 'administrative', source: 'generatePurchaseRecordPDF' },
  { key: 'compras.supplier-credit', module: 'compras', moduleLabel: 'Compras', label: 'Crédito de proveedor', structure: 'receipt', source: 'generatePurchaseRecordPDF' },
  { key: 'compras.recurring-supplier-invoice', module: 'compras', moduleLabel: 'Compras', label: 'Factura recurrente de proveedor', structure: 'transaction', source: 'generatePurchaseRecordPDF' },
  { key: 'compras.recurring-expense', module: 'compras', moduleLabel: 'Compras', label: 'Gasto recurrente', structure: 'receipt', source: 'generatePurchaseRecordPDF' },
  { key: 'compras.expense', module: 'compras', moduleLabel: 'Compras', label: 'Comprobante de gasto', structure: 'receipt', source: 'generateExpensePDF' },
  { key: 'compras.purchase-order', module: 'compras', moduleLabel: 'Compras', label: 'Órdenes de compra', structure: 'transaction', source: 'generatePurchaseOrderPDF' },
  { key: 'compras.supplier-invoice', module: 'compras', moduleLabel: 'Compras', label: 'Facturas de proveedor', structure: 'transaction', source: 'generateSupplierInvoicePDF' },
  { key: 'compras.payment-made', module: 'compras', moduleLabel: 'Compras', label: 'Pagos realizados', structure: 'receipt', source: 'generateExpensePDF' },
  { key: 'compras.purchase-receipt', module: 'compras', moduleLabel: 'Compras', label: 'Recepción de compra', structure: 'receipt', source: 'generatePurchaseRecordPDF' },
  { key: 'compras.purchase-request', module: 'compras', moduleLabel: 'Compras', label: 'Solicitud de compra', structure: 'administrative', source: 'generatePurchaseRequestPDF' },

  { key: 'inventario.product-labels', module: 'inventario', moduleLabel: 'Inventario', label: 'Etiquetas de productos', structure: 'print', family: 'label', source: 'LabelPrintModal.handlePrint' },
  { key: 'inventario.products', module: 'inventario', moduleLabel: 'Inventario', label: 'Listado de productos', structure: 'report', source: 'ProductosView.export' },
  { key: 'inventario.services', module: 'inventario', moduleLabel: 'Inventario', label: 'Listado de servicios', structure: 'report', source: 'ProductosView.export' },
  { key: 'inventario.assets', module: 'inventario', moduleLabel: 'Inventario', label: 'Mobiliario y equipos', structure: 'report', source: 'MobiliarioEquiposView.export' },

  { key: 'finanzas.balance', module: 'finanzas', moduleLabel: 'Finanzas', label: 'Balance general', structure: 'report', source: 'FinanceBalanceView.exportPDF' },
  { key: 'finanzas.transactions', module: 'finanzas', moduleLabel: 'Finanzas', label: 'Tabla financiera', structure: 'report', source: 'FinanceTableView.exportPDF' },
  { key: 'contabilidad.trial-balance', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Balance de comprobación', structure: 'report', source: 'BalanceComprobacionView.handlePrint' },
  { key: 'contabilidad.journal', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Libro Diario', structure: 'report', source: 'DiarioView.handleExportPDF' },
  { key: 'contabilidad.ledger', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Libro Mayor', structure: 'report', source: 'LibroMayorView.handleExportPDF' },
  { key: 'contabilidad.profit-loss', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Estado de resultados', structure: 'report', source: 'EstadoResultadosView.handleExportPDF' },
  { key: 'contabilidad.chart', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Plan de cuentas', structure: 'administrative', source: 'PlanCuentasView.handleExportPdf' },
  { key: 'contabilidad.fixed-assets', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Activos fijos', structure: 'report', source: 'ActivosFijosView.export' },
  { key: 'recursos-humanos.payrolls', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Reporte de nóminas', structure: 'report', source: 'NominasView.handleExportPDF' },
  { key: 'recursos-humanos.dashboard', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Dashboard de RR. HH.', structure: 'dashboard', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.employees', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Directorio de empleados', structure: 'report', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.departments', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Departamentos y cargos', structure: 'report', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.attendance', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Asistencia', structure: 'history', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.leave', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Vacaciones y ausencias', structure: 'history', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.performance', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Evaluaciones de desempeño', structure: 'report', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.kpi', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Indicadores de RR. HH.', structure: 'report', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.training', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Capacitaciones', structure: 'report', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.benefits', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Beneficios', structure: 'report', source: 'RecursosHumanosPage.export' },
  { key: 'recursos-humanos.commissions', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Comisiones', structure: 'report', source: 'ComisionesView.export' },

  { key: 'reportes.customers', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de clientes', structure: 'report', source: 'CustomersReportTab.exportPDF' },
  { key: 'reportes.sales', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de ventas', structure: 'report', source: 'SalesReportTab.exportPDF' },
  { key: 'reportes.purchases', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de compras', structure: 'report', source: 'PurchasesReportTab.exportPDF' },
  { key: 'reportes.inventory', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de inventario', structure: 'report', source: 'InventoryReportTab.exportPDF' },
  { key: 'reportes.providers', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de proveedores', structure: 'report', source: 'ProvidersReportTab.exportPDF' },
  { key: 'reportes.finance', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte financiero', structure: 'report', source: 'FinanceReportTab.exportPDF' },
  { key: 'reportes.hr', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de capital humano', structure: 'report', source: 'HRReportTab.exportPDF' },
  { key: 'dashboard.tenant-overview', module: 'dashboard', moduleLabel: 'Dashboard', label: 'Reporte del dashboard', structure: 'dashboard', source: 'ExecutiveTenantOverview.exportDashboard' },
  { key: 'portal.customer-summary', module: 'portal-clientes', moduleLabel: 'Portal de clientes', label: 'Resumen del portal de clientes', structure: 'report', source: 'exportCustomerPortalPdf' },

  // Vistas montadas con exportador semántico propio.
  { key: 'ventas.customers', module: 'ventas', moduleLabel: 'Ventas', label: 'Listado de clientes', structure: 'report', source: 'ClientesPage.export' },
  { key: 'inventario.movements', module: 'inventario', moduleLabel: 'Inventario', label: 'Movimientos', structure: 'history', source: 'MovimientosView.export' },
  { key: 'restaurante.reports', module: 'restaurante', moduleLabel: 'Restaurante', label: 'Reportes operativos', structure: 'report', source: 'RestaurantePage.export' },
  { key: 'auditoria.logs', module: 'auditoria', moduleLabel: 'Auditoría', label: 'Bitácora de auditoría', structure: 'history', source: 'AuditoriaPage.export' },
  { key: 'actividades.tasks', module: 'actividades', moduleLabel: 'Actividades', label: 'Tareas', structure: 'report', source: 'ActividadesPage.export' },
  { key: 'actividades.events', module: 'actividades', moduleLabel: 'Actividades', label: 'Eventos', structure: 'report', source: 'ActividadesPage.export' },
  { key: 'actividades.reminders', module: 'actividades', moduleLabel: 'Actividades', label: 'Recordatorios', structure: 'report', source: 'ActividadesPage.export' },
  { key: 'actividades.logs', module: 'actividades', moduleLabel: 'Actividades', label: 'Bitácora de actividades', structure: 'history', source: 'ActividadesPage.export' },
  { key: 'actividades.calendar', module: 'actividades', moduleLabel: 'Actividades', label: 'Calendario de actividades', structure: 'report', source: 'ActividadesPage.export' },
  { key: 'actividades.meetings', module: 'actividades', moduleLabel: 'Actividades', label: 'Reuniones', structure: 'report', source: 'ActividadesPage.export' },
  { key: 'proyectos.list', module: 'proyectos', moduleLabel: 'Proyectos', label: 'Listado de proyectos', structure: 'report', source: 'ProyectosListView.export' },
  { key: 'tracking.transit', module: 'tracking', moduleLabel: 'Tracking', label: 'Envíos en tránsito', structure: 'history', source: 'TrackingPage.export' },
  { key: 'tracking.batches', module: 'tracking', moduleLabel: 'Tracking', label: 'Referencias de recepción', structure: 'report', source: 'BatchReception.export' },
  { key: 'tracking.packages', module: 'tracking', moduleLabel: 'Tracking', label: 'Paquetes recibidos', structure: 'history', source: 'ReceivedPackages.export' },
  { key: 'tracking.reconciliation', module: 'tracking', moduleLabel: 'Tracking', label: 'Conciliación de compras', structure: 'report', source: 'Reconciliation.export' },
  { key: 'tracking.billing', module: 'tracking', moduleLabel: 'Tracking', label: 'Paquetes disponibles para facturar', structure: 'report', source: 'Billing.export' },
  { key: 'tickets.list', module: 'tickets', moduleLabel: 'Tickets', label: 'Listado de tickets', structure: 'report', source: 'TicketsPage.export' },
  { key: 'tickets.knowledge', module: 'tickets', moduleLabel: 'Tickets', label: 'Base de conocimiento', structure: 'report', source: 'TicketsPage.export' },
  { key: 'tickets.agents', module: 'tickets', moduleLabel: 'Tickets', label: 'Agentes de soporte', structure: 'administrative', source: 'TicketsPage.export' },
  { key: 'financiamiento.applications', module: 'financiamiento', moduleLabel: 'Financiamiento', label: 'Solicitudes de financiamiento', structure: 'report', source: 'FinanciamientoPymePage.export' },
];

export const FIXED_PDF_TEMPLATE_KEYS = new Set<string>([
  'ventas.cash-ticket',
  'inventario.product-labels',
]);

const REPORT_EXPORT_PERMISSIONS: Record<string, string> = {
  'reportes.sales': 'REPORTS_SALES',
  'reportes.purchases': 'REPORTS_PURCHASES',
  'reportes.inventory': 'REPORTS_INVENTORY',
  'reportes.customers': 'REPORTS_CLIENTS',
  'reportes.providers': 'REPORTS_PROVIDERS',
  'reportes.finance': 'REPORTS_FINANCIAL',
  'reportes.hr': 'REPORTS_HR',
  'dashboard.tenant-overview': 'DASHBOARD',
  'portal.customer-summary': 'SALES_CLIENTS',
  'finanzas.balance': 'FINANCIAL_BALANCE',
  'finanzas.transactions': 'FINANCIAL_REPORTS',
  'contabilidad.trial-balance': 'ACCOUNTING_TRIAL_BALANCE',
  'contabilidad.journal': 'ACCOUNTING_JOURNAL',
  'contabilidad.ledger': 'ACCOUNTING_LEDGER',
  'contabilidad.profit-loss': 'ACCOUNTING_PROFIT_LOSS',
  'contabilidad.chart': 'ACCOUNTING_CHART',
  'contabilidad.fixed-assets': 'ACCOUNTING_ASSETS',
  'recursos-humanos.payrolls': 'HR_PAYROLL',
  'recursos-humanos.dashboard': 'HR_DASHBOARD',
  'recursos-humanos.employees': 'HR_EMPLOYEES',
  'recursos-humanos.departments': 'HR_EMPLOYEES',
  'recursos-humanos.attendance': 'HR_ATTENDANCE',
  'recursos-humanos.leave': 'HR_LEAVES',
  'recursos-humanos.performance': 'HR_PERFORMANCE',
  'recursos-humanos.kpi': 'HR_PERFORMANCE',
  'recursos-humanos.training': 'HR_TRAINING',
  'recursos-humanos.benefits': 'HR_BENEFITS',
  'recursos-humanos.commissions': 'HR_COMMISSIONS',
  'ventas.customers': 'SALES_CLIENTS',
  'ventas.customer-history': 'SALES_CLIENTS',
  'ventas.cash-ticket': 'RETAIL_POS',
  'ventas.cash-session': 'RETAIL_CASH_CONTROL',
  'ventas.cash-historical-report': 'RETAIL_CASH_CONTROL',
  'inventario.products': 'INVENTORY_PRODUCTS',
  'inventario.services': 'INVENTORY_SERVICES',
  'inventario.assets': 'INVENTORY_ASSETS',
  'inventario.movements': 'INVENTORY_MOVEMENTS',
  'restaurante.reports': 'RESTAURANT_REPORTS',
  'auditoria.logs': 'AUDIT_LOGS',
  'actividades.tasks': 'ACTIVITIES_TASKS',
  'actividades.events': 'ACTIVITIES_EVENTS',
  'actividades.reminders': 'ACTIVITIES_REMINDERS',
  'actividades.logs': 'ACTIVITIES_LOGS',
  'actividades.calendar': 'ACTIVITIES_CALENDAR',
  'actividades.meetings': 'ACTIVITIES_MEETINGS',
  'proyectos.list': 'PROJECTS_LIST',
  'tracking.transit': 'TRACKING_TRANSIT',
  'tracking.batches': 'TRACKING_BATCHES',
  'tracking.packages': 'TRACKING_PACKAGES',
  'tracking.reconciliation': 'TRACKING_RECONCILIATION',
  'tracking.billing': 'TRACKING_BILLING',
  'tickets.list': 'TICKETS_LIST',
  'tickets.knowledge': 'TICKETS_KNOWLEDGE_BASE',
  'tickets.agents': 'TICKETS_AGENTS',
  'financiamiento.applications': 'FINANCING_APPLICATIONS',
};

function decoratePdfTemplateTarget(target: PdfTemplateTarget): PdfExportTarget {
  const fixed = FIXED_PDF_TEMPLATE_KEYS.has(target.key)
    || target.structure === 'print'
    || target.family === 'label'
    || target.family === 'cash-ticket'
    || target.capabilities?.paperSizes?.some(size => size === 'LABEL' || size === 'ROLL-80');
  // Todas las salidas lógicas (incluidos documentos transaccionales) pueden
  // tener una representación tabular en Excel. Los adaptadores de cada vista
  // son quienes definen sus hojas: Documento/Detalle/Totales para documentos,
  // o bloques y filtros para reportes e historiales.
  const tabular = target.structure !== 'print';
  const adapterKind: PdfExportAdapterKind = fixed ? 'fixed' : (target.structure as PdfExportAdapterKind);
  const adapter = PDF_EXPORT_ADAPTERS[adapterKind] || PDF_EXPORT_ADAPTERS.report;
  const exportPermission = target.exportPermission
    || REPORT_EXPORT_PERMISSIONS[target.key]
    || (target.module === 'ventas' ? 'SALES'
      : target.module === 'compras' ? 'PURCHASES'
        : target.module === 'inventario' ? 'INVENTORY'
          : target.module === 'finanzas' ? 'FINANCIAL'
            : target.module === 'contabilidad' ? 'ACCOUNTING'
              : target.module === 'recursos-humanos' ? 'HR'
                : target.module === 'actividades' ? 'ACTIVITIES'
                  : target.module === 'proyectos' ? 'PROJECTS'
                    : target.module === 'restaurante' ? 'RESTAURANT'
                      : target.module === 'tracking' ? 'TRACKING'
                        : target.module === 'tickets' ? 'TICKETS'
                          : target.module === 'financiamiento' ? 'FINANCING'
                            : target.module === 'auditoria' ? 'AUDIT_LOGS'
                              : target.module === 'portal-clientes' ? 'SALES_CLIENTS'
                                : 'REPORTS');
  return {
    ...target,
    viewId: target.viewId || target.key,
    adapterId: target.adapterId || adapter.id,
    templateMode: fixed ? 'fixed' : 'editable',
    exportPermission,
    capabilities: {
      editableCanvas: !fixed,
      importable: !fixed,
      repeatableTable: tabular,
      exportPdf: adapter.pdfRenderer !== 'none',
      exportExcel: adapter.excelRenderer !== 'none' && !fixed && tabular,
      paperSizes: fixed ? (target.family === 'label' ? ['LABEL'] : ['ROLL-80']) : ['LETTER'],
      ...(target.capabilities || {}),
    },
  };
}

export const PDF_TEMPLATE_TARGETS: PdfExportTarget[] = BASE_PDF_TEMPLATE_TARGETS.map(decoratePdfTemplateTarget);

export function getPdfTemplateTarget(key: string | null | undefined): PdfExportTarget {
  if (!key) return PDF_TEMPLATE_TARGETS[0];
  return PDF_TEMPLATE_TARGETS.find(target => target.key === key || target.legacyKeys?.includes(key)) || {
    key,
    module: 'reportes',
    moduleLabel: 'Otros',
    label: `Documento (${key})`,
    structure: 'administrative',
    family: 'administrative',
    source: 'unmapped',
    viewId: key,
    adapterId: PDF_EXPORT_ADAPTERS.administrative.id,
    templateMode: 'editable',
    exportPermission: 'REPORTS',
    capabilities: {
      editableCanvas: true,
      importable: true,
      repeatableTable: false,
      exportPdf: true,
      exportExcel: false,
      paperSizes: ['LETTER'],
    },
  } satisfies PdfExportTarget;
}

export function getPdfExportTarget(keyOrTarget: string | PdfTemplateTarget | null | undefined): PdfExportTarget {
  const target = typeof keyOrTarget === 'string' ? getPdfTemplateTarget(keyOrTarget) : keyOrTarget;
  const known = target && PDF_TEMPLATE_TARGETS.find(item => item.key === target.key);
  if (known) return known;
  return getPdfTemplateTarget(target?.key);
}

export function getPdfExportAdapter(keyOrTarget: string | PdfTemplateTarget | null | undefined): PdfExportAdapter {
  const target = getPdfExportTarget(keyOrTarget);
  return Object.values(PDF_EXPORT_ADAPTERS).find(adapter => adapter.id === target.adapterId)
    || PDF_EXPORT_ADAPTERS[target.templateMode === 'fixed' ? 'fixed' : ((target.structure as PdfExportAdapterKind) || 'report')]
    || PDF_EXPORT_ADAPTERS.report;
}

export function isPdfTemplateFixed(keyOrTarget: string | PdfTemplateTarget | null | undefined): boolean {
  const target = typeof keyOrTarget === 'string' ? PDF_TEMPLATE_TARGETS.find(item => item.key === keyOrTarget || item.legacyKeys?.includes(keyOrTarget)) : keyOrTarget;
  if (!target) return false;
  return target.templateMode === 'fixed'
    || target.structure === 'print'
    || FIXED_PDF_TEMPLATE_KEYS.has(target.key)
    || target.family === 'label'
    || target.family === 'cash-ticket';
}

export function canEditPdfTemplate(keyOrTarget: string | PdfTemplateTarget | null | undefined): boolean {
  return !isPdfTemplateFixed(keyOrTarget);
}

export type PdfTemplatePartyMode = 'customer' | 'supplier' | 'requester' | 'payee' | 'none';

export interface PdfTemplatePartyConfig {
  mode: PdfTemplatePartyMode;
  sectionLabel: string;
  nameLabel: string;
  tokenPrefix: 'customer' | 'supplier' | 'party';
  labels: { taxId: string; address: string; phone: string; email: string; contact: string };
}

const partyConfig = (mode: PdfTemplatePartyMode): PdfTemplatePartyConfig => {
  if (mode === 'customer') return { mode, sectionLabel: 'Datos del cliente', nameLabel: 'Cliente', tokenPrefix: 'customer', labels: { taxId: 'Identificación del cliente', address: 'Dirección del cliente', phone: 'Teléfono del cliente', email: 'Correo del cliente', contact: 'Contacto del cliente' } };
  if (mode === 'supplier') return { mode, sectionLabel: 'Datos del proveedor', nameLabel: 'Proveedor', tokenPrefix: 'supplier', labels: { taxId: 'Identificación del proveedor', address: 'Dirección del proveedor', phone: 'Teléfono del proveedor', email: 'Correo del proveedor', contact: 'Contacto del proveedor' } };
  if (mode === 'requester') return { mode, sectionLabel: 'Datos de la solicitud', nameLabel: 'Solicitante', tokenPrefix: 'party', labels: { taxId: 'Identificación del solicitante', address: 'Área solicitante', phone: 'Teléfono del solicitante', email: 'Correo del solicitante', contact: 'Responsable' } };
  if (mode === 'payee') return { mode, sectionLabel: 'Datos del pago', nameLabel: 'Beneficiario', tokenPrefix: 'party', labels: { taxId: 'Identificación del beneficiario', address: 'Dirección del beneficiario', phone: 'Teléfono del beneficiario', email: 'Correo del beneficiario', contact: 'Contacto del beneficiario' } };
  return { mode, sectionLabel: '', nameLabel: '', tokenPrefix: 'party', labels: { taxId: '', address: '', phone: '', email: '', contact: '' } };
};

export function getPdfTemplatePartyConfig(key: string | null | undefined): PdfTemplatePartyConfig {
  const target = getPdfTemplateTarget(key);
  if (target.module === 'ventas' && !['ventas.cash-session', 'ventas.cash-ticket', 'ventas.cash-historical-report'].includes(target.key)) return partyConfig('customer');
  if (target.module === 'compras') {
    if (target.key === 'compras.purchase-request') return partyConfig('requester');
    if (target.key === 'compras.expense' || target.key === 'compras.recurring-expense') return partyConfig('payee');
    return partyConfig('supplier');
  }
  return partyConfig('none');
}

export const PDF_TEMPLATE_MODULES = Array.from(new Map(PDF_TEMPLATE_TARGETS.map(target => [target.module, { id: target.module, label: target.moduleLabel }])).values());

export function normalizePdfTemplateKey(key: string | null | undefined) {
  if (!key) return PDF_TEMPLATE_TARGETS[0].key;
  const knownTarget = PDF_TEMPLATE_TARGETS.find(target => target.key === key || target.legacyKeys?.includes(key));
  return knownTarget?.key || key;
}

export function getPdfTemplateTargetByLegacyKey(key: string) {
  return PDF_TEMPLATE_TARGETS.find(target => target.legacyKeys?.includes(key));
}

export function getPdfTemplateLegacyKey(key: string) {
  return getPdfTemplateTarget(key).legacyKeys?.[0] || key;
}
