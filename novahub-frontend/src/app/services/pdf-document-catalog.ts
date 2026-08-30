export type PdfDocumentStructure = 'transaction' | 'history' | 'report' | 'receipt' | 'administrative' | 'dashboard' | 'print';
export type PdfTemplateFamily = 'transaction' | 'history' | 'report' | 'receipt' | 'cash' | 'dashboard' | 'label' | 'administrative';

export type PdfTemplateModule =
  | 'ventas'
  | 'compras'
  | 'finanzas'
  | 'contabilidad'
  | 'inventario'
  | 'recursos-humanos'
  | 'reportes'
  | 'dashboard';

export interface PdfTemplateTarget {
  key: string;
  module: PdfTemplateModule;
  moduleLabel: string;
  label: string;
  structure: PdfDocumentStructure;
  family?: PdfTemplateFamily;
  capabilities?: {
    editableCanvas?: boolean;
    importable?: boolean;
    repeatableTable?: boolean;
  };
  legacyKeys?: string[];
  source: string;
}

/**
 * Catálogo único de salidas PDF/imprimibles del ERP.
 * Cada clave debe corresponder a un exportador real del frontend.
 */
export const PDF_TEMPLATE_TARGETS: PdfTemplateTarget[] = [
  { key: 'ventas.estimate', module: 'ventas', moduleLabel: 'Ventas', label: 'Cotizaciones', structure: 'transaction', legacyKeys: ['estimate'], source: 'generateEstimatePDF' },
  { key: 'ventas.order', module: 'ventas', moduleLabel: 'Ventas', label: 'Órdenes de venta', structure: 'transaction', legacyKeys: ['order'], source: 'generateEstimatePDF' },
  { key: 'ventas.invoice', module: 'ventas', moduleLabel: 'Ventas', label: 'Facturas', structure: 'transaction', legacyKeys: ['invoice'], source: 'generateEstimatePDF' },
  { key: 'ventas.recurring', module: 'ventas', moduleLabel: 'Ventas', label: 'Facturas recurrentes', structure: 'transaction', legacyKeys: ['recurring'], source: 'generateRecurringInvoicePDF' },
  { key: 'ventas.payment', module: 'ventas', moduleLabel: 'Ventas', label: 'Pagos recibidos', structure: 'receipt', legacyKeys: ['payment'], source: 'generateEstimatePDF' },
  { key: 'ventas.return', module: 'ventas', moduleLabel: 'Ventas', label: 'Devoluciones', structure: 'transaction', legacyKeys: ['return'], source: 'generateEstimatePDF' },
  { key: 'ventas.credit-note', module: 'ventas', moduleLabel: 'Ventas', label: 'Notas de crédito', structure: 'transaction', legacyKeys: ['credit-note'], source: 'generateEstimatePDF' },
  { key: 'ventas.cash-session', module: 'ventas', moduleLabel: 'Ventas', label: 'Resumen de sesión de caja', structure: 'receipt', source: 'generateSessionSummaryPDF' },
  { key: 'ventas.cash-ticket', module: 'ventas', moduleLabel: 'Ventas', label: 'Ticket de caja', structure: 'print', source: 'printPosTicket' },
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

  { key: 'finanzas.balance', module: 'finanzas', moduleLabel: 'Finanzas', label: 'Balance general', structure: 'report', source: 'FinanceBalanceView.exportPDF' },
  { key: 'finanzas.transactions', module: 'finanzas', moduleLabel: 'Finanzas', label: 'Tabla financiera', structure: 'report', source: 'FinanceTableView.exportPDF' },
  { key: 'contabilidad.trial-balance', module: 'contabilidad', moduleLabel: 'Contabilidad', label: 'Balance de comprobación', structure: 'report', source: 'BalanceComprobacionView.handlePrint' },
  { key: 'recursos-humanos.payrolls', module: 'recursos-humanos', moduleLabel: 'Recursos Humanos', label: 'Reporte de nóminas', structure: 'report', source: 'NominasView.handleExportPDF' },

  { key: 'reportes.customers', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de clientes', structure: 'report', source: 'CustomersReportTab.exportPDF' },
  { key: 'reportes.sales', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de ventas', structure: 'report', source: 'SalesReportTab.exportPDF' },
  { key: 'reportes.purchases', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de compras', structure: 'report', source: 'PurchasesReportTab.exportPDF' },
  { key: 'reportes.inventory', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de inventario', structure: 'report', source: 'InventoryReportTab.exportPDF' },
  { key: 'reportes.providers', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de proveedores', structure: 'report', source: 'ProvidersReportTab.exportPDF' },
  { key: 'reportes.finance', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte financiero', structure: 'report', source: 'FinanceReportTab.exportPDF' },
  { key: 'reportes.hr', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de capital humano', structure: 'report', source: 'HRReportTab.exportPDF' },
  { key: 'reportes.subscriptions', module: 'reportes', moduleLabel: 'Reportes', label: 'Reporte de suscripciones', structure: 'report', source: 'SubscriptionsReportTab.exportPDF' },
  { key: 'dashboard.tenant-overview', module: 'dashboard', moduleLabel: 'Dashboard', label: 'Reporte del dashboard', structure: 'dashboard', source: 'TenantOverview.handleExport' },
];

export type PdfTemplatePartyMode = 'customer' | 'supplier' | 'requester' | 'payee' | 'none';

export interface PdfTemplatePartyConfig {
  mode: PdfTemplatePartyMode;
  sectionLabel: string;
  nameLabel: string;
  tokenPrefix: 'customer' | 'supplier' | 'party';
  labels: {
    taxId: string;
    address: string;
    phone: string;
    email: string;
    contact: string;
  };
}

const partyConfig = (mode: PdfTemplatePartyMode): PdfTemplatePartyConfig => {
  if (mode === 'customer') {
    return {
      mode,
      sectionLabel: 'Datos del cliente',
      nameLabel: 'Cliente',
      tokenPrefix: 'customer',
      labels: {
        taxId: 'Identificación del cliente',
        address: 'Dirección del cliente',
        phone: 'Teléfono del cliente',
        email: 'Correo del cliente',
        contact: 'Contacto del cliente',
      },
    };
  }
  if (mode === 'supplier') {
    return {
      mode,
      sectionLabel: 'Datos del proveedor',
      nameLabel: 'Proveedor',
      tokenPrefix: 'supplier',
      labels: {
        taxId: 'Identificación del proveedor',
        address: 'Dirección del proveedor',
        phone: 'Teléfono del proveedor',
        email: 'Correo del proveedor',
        contact: 'Contacto del proveedor',
      },
    };
  }
  if (mode === 'requester') {
    return {
      mode,
      sectionLabel: 'Datos de la solicitud',
      nameLabel: 'Solicitante',
      tokenPrefix: 'party',
      labels: {
        taxId: 'Identificación del solicitante',
        address: 'Área solicitante',
        phone: 'Teléfono del solicitante',
        email: 'Correo del solicitante',
        contact: 'Responsable',
      },
    };
  }
  if (mode === 'payee') {
    return {
      mode,
      sectionLabel: 'Datos del pago',
      nameLabel: 'Beneficiario',
      tokenPrefix: 'party',
      labels: {
        taxId: 'Identificación del beneficiario',
        address: 'Dirección del beneficiario',
        phone: 'Teléfono del beneficiario',
        email: 'Correo del beneficiario',
        contact: 'Contacto del beneficiario',
      },
    };
  }
  return {
    mode,
    sectionLabel: '',
    nameLabel: '',
    tokenPrefix: 'party',
    labels: { taxId: '', address: '', phone: '', email: '', contact: '' },
  };
};

/**
 * Define la entidad que puede aparecer en la ficha superior de cada PDF.
 * No se infiere desde los datos recibidos: se fija por destino para evitar
 * que una cotización termine presentando campos de proveedor o viceversa.
 */
export function getPdfTemplatePartyConfig(key: string | null | undefined): PdfTemplatePartyConfig {
  const target = getPdfTemplateTarget(key);
  if (target.module === 'ventas' && !['ventas.cash-session', 'ventas.cash-ticket', 'ventas.cash-historical-report'].includes(target.key)) {
    return partyConfig('customer');
  }
  if (target.module === 'compras') {
    if (target.key === 'compras.purchase-request') return partyConfig('requester');
    if (target.key === 'compras.expense' || target.key === 'compras.recurring-expense') return partyConfig('payee');
    return partyConfig('supplier');
  }
  return partyConfig('none');
}

export const PDF_TEMPLATE_MODULES = Array.from(
  new Map(PDF_TEMPLATE_TARGETS.map(target => [target.module, { id: target.module, label: target.moduleLabel }])).values(),
);

export function getPdfTemplateTarget(key: string | null | undefined) {
  if (!key) return PDF_TEMPLATE_TARGETS[0];
  return PDF_TEMPLATE_TARGETS.find(target => target.key === key || target.legacyKeys?.includes(key)) || {
    key,
    module: 'reportes',
    moduleLabel: 'Otros',
    label: `Documento (${key})`,
    structure: 'administrative',
    family: 'administrative',
    source: 'unmapped',
  } satisfies PdfTemplateTarget;
}

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
