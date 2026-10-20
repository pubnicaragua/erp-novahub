import { getPdfTemplatePartyConfig, getPdfTemplateTarget, isPdfTemplateFixed, type PdfTemplateTarget } from './pdf-document-catalog';

export type PdfTemplateNodeType = 'section' | 'text' | 'field' | 'table' | 'report-sections' | 'chart' | 'totals' | 'image' | 'barcode' | 'divider' | 'spacer';
export type PdfTemplateChartType = 'area' | 'bar' | 'donut';
export type PdfTemplateHorizontalAlign = 'left' | 'center' | 'right';

export interface PdfTemplateColumn {
  id: string;
  label: string;
  token: string;
  width?: number;
  align?: PdfTemplateHorizontalAlign;
  backgroundColor?: string;
  color?: string;
}

export interface PdfTemplateReportSection {
  id: string;
  title: string;
  columns: PdfTemplateColumn[];
  rows: Array<Record<string, unknown>>;
  templateIndex?: number;
  /** Color base heredado del renderer nativo del módulo Reportes. */
  color?: readonly number[];
}

export interface PdfTemplateReportSectionStyle {
  headerColor?: string;
  headerTextColor?: string;
  rowTextColor?: string;
  rowColor?: string;
  stripeColor?: string;
  columnColors?: Record<string, string>;
  columnTextColors?: Record<string, string>;
}

export interface PdfTemplateKpi {
  label: string;
  value: string;
  detail: string;
}

export interface PdfTemplateChart {
  id: string;
  title: string;
  type: PdfTemplateChartType;
  labels: string[];
  values?: number[];
  series?: Array<{ label: string; values: number[]; color?: string }>;
  colors?: string[];
  valueFormat?: 'currency' | 'count' | 'percent';
  unitLabel?: string;
  imageDataUrl?: string;
  imageAspectRatio?: number;
}

export function formatPdfPageNumber(format: unknown, customTemplate: unknown, page: number, pageCount: number) {
  const currentPage = Math.max(1, Math.floor(Number(page) || 1));
  const totalPages = Math.max(currentPage, Math.floor(Number(pageCount) || 1));
  if (format === 'number-only') return String(currentPage);
  if (format !== 'custom') return `Página ${currentPage} de ${totalPages}`;
  const template = String(customTemplate || 'Página {page} de {pages}')
    .replace(/\{(page|pages)\}([.,]0+)(?!\d)/gi, '{$1}');
  return template.replace(/\{page\}/gi, String(currentPage)).replace(/\{pages\}/gi, String(totalPages));
}

export interface PdfTemplateNode {
  id: string;
  type: PdfTemplateNodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page?: number;
  enabled?: boolean;
  text?: string;
  token?: string;
  sample?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 400 | 500 | 600 | 700 | 800;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
  borderRadius?: number;
  pdfHeaderDecoration?: 'rule' | 'box' | 'band' | 'soft' | 'wave' | 'tab';
  pdfHeaderAccentColor?: string;
  shape?: 'rectangle' | 'pill' | 'wave' | 'wave-bottom' | 'circle' | 'angled' | 'blob' | 'arc';
  clipPath?: string;
  rotation?: number;
  opacity?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  lineHeight?: number;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  align?: PdfTemplateHorizontalAlign;
  padding?: number;
  columns?: PdfTemplateColumn[];
  tableHeaderColor?: string;
  tableHeaderTextColor?: string;
  tableTextColor?: string;
  tableRowColor?: string;
  tableStripeColor?: string;
  chartType?: PdfTemplateChartType;
  reportSectionVisibility?: Record<string, boolean>;
  reportSectionStyles?: Record<string, PdfTemplateReportSectionStyle>;
  repeatHeader?: boolean;
  firstPageOnly?: boolean;
  subsequentY?: number;
  subsequentHeight?: number;
}

export function pdfTemplateImageShapeStyles(shape: PdfTemplateNode['shape'], borderRadius = 0) {
  const selectedShape = shape || 'rectangle';
  const borderRadiusByShape: Record<string, string> = {
    pill: '999px',
    circle: '50%',
    blob: '42% 58% 62% 38% / 45% 35% 65% 55%',
    arc: '50% 50% 0 0 / 60% 60% 0 0',
    wave: '50% 50% 0 0 / 42% 42% 0 0',
    'wave-bottom': '0 0 50% 50% / 0 0 42% 42%',
  };
  return {
    borderRadius: borderRadiusByShape[selectedShape] || `${Math.max(0, Number(borderRadius) || 0)}px`,
    clipPath: selectedShape === 'angled' ? 'polygon(0 0,100% 0,88% 100%,0 100%)' : 'none',
  };
}

export interface PdfTemplateDefinition {
  version: 1;
  page: { paperSize: string; orientation: 'portrait' | 'landscape'; background: string };
  nodes: PdfTemplateNode[];
  metadata?: { importedFrom?: 'html' | 'docx' | 'pdf'; importWarnings?: string[]; preset?: string; pdfStyleConfig?: unknown; [key: string]: unknown };
}

export type PdfHeaderComposition = 'company-left-logo-right' | 'logo-left-company-right' | 'centered-stack';
export type PdfHeaderContentSpacing = 'small' | 'medium' | 'large';

/**
 * Marca la estructura empresarial compartida por los documentos de venta.
 * Los diseños guardados antes de esta versión se reconstruyen con la base del
 * ERP para que sus nodos de texto importados no sustituyan tablas o secciones.
 */
export const SALES_PDF_LAYOUT_VERSION = 'sales-document-v3';
export const PURCHASE_PDF_LAYOUT_VERSION = 'purchase-document-v2';
const SALES_PDF_REPORT_LAYOUT_VERSION = 'sales-report-v4';
const SALES_PDF_REPORT_LAYOUT_VERSIONS_BY_TARGET: Record<string, string> = {
  'ventas.cash-session': 'sales-report-v4',
  'ventas.cash-historical-report': 'sales-report-v4',
  'ventas.customer-history': 'sales-report-v4',
  'ventas.customers': 'sales-report-v4',
};

const STANDARD_SALES_REPORT_TARGETS = [
  'ventas.cash-session',
  'ventas.cash-historical-report',
  'ventas.customer-history',
  'ventas.customers',
];

export function isSalesPdfLayoutTarget(targetKey: string) {
  const target = getPdfTemplateTarget(targetKey);
  return target.module === 'ventas'
    && (target.structure === 'transaction'
      || target.key === 'ventas.payment'
      || ['ventas.cash-session', 'ventas.cash-historical-report', 'ventas.customer-history', 'ventas.customers'].includes(target.key));
}

export function isPurchasePdfLayoutTarget(targetKey: string) {
  return getPdfTemplateTarget(targetKey).module === 'compras';
}

export function isStandardPdfLayoutTarget(targetKey: string) {
  return !isPdfTemplateFixed(targetKey);
}

export function salesPdfLayoutVersionForTarget(targetKey: string) {
  const target = getPdfTemplateTarget(targetKey);
  return SALES_PDF_REPORT_LAYOUT_VERSIONS_BY_TARGET[target.key]
    || (STANDARD_SALES_REPORT_TARGETS.includes(target.key) ? SALES_PDF_REPORT_LAYOUT_VERSION : SALES_PDF_LAYOUT_VERSION);
}

export function hasCurrentSalesPdfLayout(targetKey: string, definition: PdfTemplateDefinition | null | undefined) {
  if (!isSalesPdfLayoutTarget(targetKey)) return true;
  return definition?.metadata?.salesLayoutVersion === salesPdfLayoutVersionForTarget(targetKey);
}

export function hasCurrentStandardPdfLayout(targetKey: string, definition: PdfTemplateDefinition | null | undefined) {
  if (isSalesPdfLayoutTarget(targetKey)) return hasCurrentSalesPdfLayout(targetKey, definition);
  if (!isPurchasePdfLayoutTarget(targetKey)) return true;
  return definition?.metadata?.purchaseLayoutVersion === PURCHASE_PDF_LAYOUT_VERSION;
}

/** Mantiene las tablas de ventas con rejilla completa en el patrón inicial. */
export function applySalesPdfLayoutSettings<T extends Record<string, unknown>>(targetKey: string, settings: T): T {
  return isSalesPdfLayoutTarget(targetKey)
    ? { ...settings, tableLayout: 'boxed', pdfTableStyle: 'boxed' }
    : settings;
}

export function applyStandardPdfLayoutSettings<T extends Record<string, unknown>>(targetKey: string, settings: T): T {
  if (isSalesPdfLayoutTarget(targetKey)) return applySalesPdfLayoutSettings(targetKey, settings);
  if (!isPurchasePdfLayoutTarget(targetKey)) return settings;
  return {
    ...settings,
    tableLayout: 'boxed',
    pdfTableStyle: 'boxed',
    ...(getPdfTemplateTarget(targetKey).key === 'compras.supplier-history'
      ? { paperSize: 'LETTER', orientation: 'landscape', fontSize: 9 }
      : {}),
  };
}

export interface PdfTemplateData {
  [key: string]: unknown;
  company?: Record<string, unknown>;
  document?: Record<string, unknown>;
  customer?: Record<string, unknown>;
  supplier?: Record<string, unknown>;
  party?: Record<string, unknown>;
  items?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
  totals?: Record<string, unknown>;
  tableSummary?: Record<string, unknown>;
  history?: Array<Record<string, unknown>>;
  reportSections?: PdfTemplateReportSection[];
  reportKpis?: PdfTemplateKpi[];
  dashboardCharts?: PdfTemplateChart[];
  dashboardPreferences?: { indicators?: string[]; blocks?: string[] };
}

export const TEMPLATE_TOKENS = [
  { token: 'company.name', label: 'Empresa', sample: 'NovaHub Comercial' },
  { token: 'company.slogan', label: 'Eslogan', sample: 'Soluciones simples para crecer' },
  { token: 'company.fiscalInfo', label: 'Identificación fiscal', sample: 'RUC J0310000000000' },
  { token: 'company.address', label: 'Dirección', sample: 'Managua, Nicaragua' },
  { token: 'company.phone', label: 'Teléfono', sample: '+505 2255-0000' },
  { token: 'company.email', label: 'Correo', sample: 'contacto@empresa.com' },
  { token: 'company.website', label: 'Sitio web', sample: 'www.empresa.com' },
  { token: 'company.footerText', label: 'Texto del pie', sample: 'Gracias por confiar en nosotros.' },
  { token: 'company.summary', label: 'Datos de la sucursal', sample: 'Soluciones simples para crecer\nManagua, Nicaragua\nRUC J0310000000000 · +505 2255-0000 · contacto@empresa.com · www.empresa.com' },
  { token: 'document.title', label: 'Título del documento', sample: 'COTIZACIÓN' },
  { token: 'document.number', label: 'Número', sample: 'COT-000123' },
  { token: 'document.date', label: 'Fecha', sample: '29/08/2026' },
  { token: 'document.status', label: 'Estado', sample: 'Pendiente' },
  { token: 'document.period', label: 'Período del reporte', sample: 'Periodo: 01/08/2026 al 31/08/2026' },
  { token: 'document.generated', label: 'Fecha de generación', sample: 'Generado: 08/09/2026 10:30' },
  { token: 'party.name', label: 'Entidad relacionada', sample: 'Entidad de ejemplo' },
  { token: 'party.taxId', label: 'Identificación de la entidad', sample: 'J0310000000000' },
  { token: 'party.address', label: 'Dirección de la entidad', sample: 'Dirección de la entidad' },
  { token: 'party.phone', label: 'Teléfono de la entidad', sample: '+505 8888-0000' },
  { token: 'party.email', label: 'Correo de la entidad', sample: 'entidad@empresa.com' },
  { token: 'party.contact', label: 'Contacto de la entidad', sample: 'Contacto comercial' },
  { token: 'customer.name', label: 'Cliente', sample: 'Cliente de ejemplo' },
  { token: 'customer.taxId', label: 'Identificación del cliente', sample: 'J0310000000000' },
  { token: 'customer.address', label: 'Dirección del cliente', sample: 'Dirección del cliente' },
  { token: 'customer.phone', label: 'Teléfono del cliente', sample: '+505 8888-0000' },
  { token: 'customer.email', label: 'Correo del cliente', sample: 'cliente@empresa.com' },
  { token: 'customer.balanceSummary', label: 'Saldo del cliente', sample: 'En contra: C$ 1,150.00' },
  { token: 'supplier.name', label: 'Proveedor', sample: 'Proveedor de ejemplo' },
  { token: 'supplier.taxId', label: 'Identificación del proveedor', sample: 'J0310000000000' },
  { token: 'supplier.address', label: 'Dirección del proveedor', sample: 'Managua, Nicaragua' },
  { token: 'supplier.phone', label: 'Teléfono del proveedor', sample: '+505 2222-0000' },
  { token: 'supplier.email', label: 'Correo del proveedor', sample: 'proveedor@empresa.com' },
  { token: 'account.name', label: 'Cuenta financiera', sample: 'Caja general' },
  { token: 'employee.name', label: 'Colaborador', sample: 'Ana Martínez' },
  { token: 'product.name', label: 'Producto', sample: 'Producto de muestra' },
  { token: 'product.code', label: 'Código del producto', sample: 'SKU-0001' },
  { token: 'product.barcode', label: 'Código de barras', sample: '7501234567890' },
  { token: 'product.price', label: 'Precio del producto', sample: 'C$ 500.00' },
  { token: 'totals.subtotal', label: 'Subtotal', sample: 'C$ 1,000.00' },
  { token: 'totals.tax', label: 'Impuestos', sample: 'C$ 150.00' },
  { token: 'totals.discount', label: 'Descuento', sample: 'C$ 0.00' },
  { token: 'totals.total', label: 'Total', sample: 'C$ 1,150.00' },
  { token: 'document.notes', label: 'Notas', sample: 'Notas del documento' },
  { token: 'document.terms', label: 'Términos', sample: 'Vigencia: 15 días' },
  { token: 'page.number', label: 'Página', sample: 'Página 1 de 1' },
] as const;

/**
 * Configuración que representa el diseño nativo que existía antes del editor.
 * Se mantiene en un módulo sin UI para que el canvas y los exportadores usen
 * exactamente la misma base, incluso cuando la sucursal todavía no tiene un
 * diseño persistido.
 */
export const SYSTEM_DEFAULT_PDF_SETTINGS: Record<string, unknown> = {
  paperSize: 'LETTER',
  orientation: 'portrait',
  headerComposition: 'company-left-logo-right',
  headerContentSpacing: 'small',
  headerLayout: 'classic',
  footerLayout: 'line',
  tableLayout: 'standard',
  logoPosition: 'right',
  logoSize: 34,
  showCompanyName: true,
  companyName: '',
  slogan: '',
  fiscalInfo: '',
  address: '',
  phone: '',
  email: '',
  website: '',
  bankInfo: '',
  showQr: false,
  showBarcode: false,
  watermark: '',
  watermarkOpacity: 12,
  footerText: '',
  showPageNumber: true,
  pageNumberFormat: 'page-of',
  pageNumberCustom: 'Página {page} de {pages}',
  legalText: '',
  terms: '',
  defaultNotes: '',
  margins: 14,
  fontFamily: 'Arial',
  fontSize: 9,
  primaryColor: '#01422c',
  secondaryColor: '#01422c',
  textColor: '#334155',
  lineColor: '#01422c',
  tableHeaderColor: '#01422c',
  tableHeaderTextColor: '#ffffff',
  tableRowColor: '#ffffff',
  tableStripeColor: '#f8fafc',
  tableBorderColor: '#d7dee7',
  backgroundColor: '#ffffff',
  separator: 'solid',
  paletteMode: 'independent',
};

/**
 * Política de papel para las salidas PDF del ERP.
 *
 * Los documentos semánticos usan Carta vertical salvo el listado de clientes,
 * cuyo ancho de columnas necesita Carta horizontal por defecto. Los destinos
 * físicos (tickets, rollos y etiquetas) conservan sus dimensiones porque
 * dependen de una impresora o material no estándar.
 */
export function normalizePdfPaperSettings(targetKey: string, settings?: Record<string, unknown>) {
  const target = getPdfTemplateTarget(targetKey);
  const next = { ...(settings || {}) };
  // El listado incluye datos de contacto y necesita la anchura de Carta
  // horizontal para mostrar sus columnas completas en el predeterminado.
  // Se respeta una orientación vertical elegida explícitamente en un diseño.
  if (target.key === 'ventas.customers') {
    return { ...next, paperSize: 'LETTER', orientation: next.orientation === 'landscape' ? 'landscape' as const : 'portrait' as const };
  }
  if (!isPdfTemplateFixed(target)) return { ...next, paperSize: 'LETTER', orientation: 'portrait' as const };
  if (target.family === 'label' || target.key === 'inventario.product-labels') return { ...next, paperSize: 'LABEL', orientation: 'landscape' as const };
  if (target.family === 'cash-ticket' || target.structure === 'print') return { ...next, paperSize: 'ROLL-80', orientation: 'portrait' as const };
  return next;
}

/** Limpia ejemplos que versiones anteriores guardaban como si fueran datos reales de empresa. */
export function normalizePdfCompanySettings<T extends Record<string, unknown>>(settings: T): T {
  const legacySamples: Record<string, string[]> = {
    slogan: ['Soluciones simples para crecer'],
    fiscalInfo: ['RUC / Identificación fiscal'],
    address: ['Dirección fiscal de la empresa'],
    phone: ['+505 0000-0000', '+505 000-0000'],
    email: ['contacto@empresa.com'],
    website: ['www.empresa.com'],
    footerText: ['Gracias por confiar en nosotros.'],
  };
  const normalized: Record<string, unknown> = { ...settings };
  Object.entries(legacySamples).forEach(([key, values]) => {
    if (values.includes(String(normalized[key] ?? '').trim())) normalized[key] = '';
  });
  if ('headerComposition' in normalized) {
    const headerComposition = String(normalized.headerComposition || '');
    normalized.headerComposition = (['company-left-logo-right', 'logo-left-company-right', 'centered-stack'] as const).includes(headerComposition as PdfHeaderComposition)
      ? headerComposition
      : 'company-left-logo-right';
  }
  const headerContentSpacing = String(normalized.headerContentSpacing || '');
  normalized.headerContentSpacing = (['small', 'medium', 'large'] as const).includes(headerContentSpacing as PdfHeaderContentSpacing)
    ? headerContentSpacing
    : 'small';
  return normalized as T;
}

/** Reubica únicamente los elementos semánticos del encabezado; el cuerpo conserva sus coordenadas. */
export function applyPdfHeaderComposition<T extends PdfTemplateDefinition>(definition: T, composition: unknown, targetKey: string): T {
  const selected = String(composition || '') as PdfHeaderComposition;
  if (!(['company-left-logo-right', 'logo-left-company-right', 'centered-stack'] as string[]).includes(selected)) return definition;
  if (isPdfTemplateFixed(getPdfTemplateTarget(targetKey))) return definition;

  const hasLogo = definition.nodes.some(item => item.id === 'company-logo' && item.enabled !== false);
  const metadataY = hasLogo ? 27.2 : 23.2;
  const reportLikeSalesTarget = ['ventas.cash-session', 'ventas.cash-historical-report', 'ventas.customer-history', 'ventas.customers'].includes(getPdfTemplateTarget(targetKey).key);
  const isCashSession = getPdfTemplateTarget(targetKey).key === 'ventas.cash-session';
  const isCashHistoricalReport = getPdfTemplateTarget(targetKey).key === 'ventas.cash-historical-report';
  const isCustomerHistory = getPdfTemplateTarget(targetKey).key === 'ventas.customer-history';
  const isCustomerList = getPdfTemplateTarget(targetKey).key === 'ventas.customers';
  const isPurchaseTarget = isPurchasePdfLayoutTarget(getPdfTemplateTarget(targetKey).key);
  const cashSectionsY = isCashSession ? 38.5 : isCashHistoricalReport ? 35.3 : 34.8;
  const centeredCashSectionsY = isCashSession ? 42 : isCashHistoricalReport ? 39.3 : 38.8;
  const reportHeaderPlacements: Record<string, Partial<PdfTemplateNode>> = reportLikeSalesTarget
    ? selected === 'centered-stack'
      ? {
        'company-summary': { height: 8.5 },
        'document-title': { x: 55, y: isCashSession ? 23 : 26, width: 40, height: isCashSession ? 5 : isCashHistoricalReport || isCustomerHistory || isCustomerList ? 4.8 : 9, align: 'right' },
        'document-number': { x: 55, y: isCustomerHistory ? 31 : isCashSession ? 28.5 : 35.5, width: 40, height: 2.8, align: 'right' },
        'document-date': { x: isCustomerHistory ? 55 : 5, y: isCustomerHistory ? 34.2 : isCashSession ? 31.5 : 38.8, width: 40, height: 2.8, align: isCustomerHistory ? 'right' as const : 'left' as const },
        'document-status': { x: isCustomerHistory ? 55 : 58, y: isCustomerHistory ? 37.4 : isCashSession ? 31.5 : 38.8, width: isCustomerHistory ? 40 : 37, height: 2.8, align: 'right' },
        'document-generated': { x: 67, y: isCashSession ? 31.5 : isCashHistoricalReport ? 33.5 : isCustomerList ? 32.5 : 35.5, width: 28, height: 2.8, align: 'right' },
        'report-meta': { x: 5, y: isCashSession ? 31.5 : isCashHistoricalReport ? 33.5 : isCustomerList ? 32.5 : 35.5, width: 60, height: 2.8, align: 'left' },
        'cash-report-sections': { x: 5, y: centeredCashSectionsY, width: 90, height: 96 - centeredCashSectionsY },
        'report-sections': { x: 5, y: 56, width: 90, height: 39 },
        'cashier-label': { x: 5, y: isCashSession ? 35 : 43, width: 40, height: 2.6 },
        'cashier-name': { x: 5, y: isCashSession ? 37.5 : 45.5, width: 50, height: 3.2 },
        ...(isCustomerHistory ? {
          'history-customer-name': { x: 5, y: 26, width: 44, height: 4.5 },
          'party-tax-id': { x: 5, y: 31.3, width: 44, height: 5.2 },
          'party-address': { x: 5, y: 35, width: 44, height: 5.2 },
          'party-phone': { x: 5, y: 38.7, width: 44, height: 5.2 },
          'party-email': { x: 5, y: 42.4, width: 44, height: 5.2 },
          'party-contact': { x: 5, y: 46.1, width: 44, height: 5.2 },
          'party-balance-summary': { x: 5, y: 49.8, width: 44, height: 5.2 },
          'items-table': { x: 5, y: 56, width: 90, height: 39 },
        } : {}),
      }
      : {
        'company-summary': { height: 8 },
        'document-title': { x: 55, y: isCashSession ? 19 : 22, width: 40, height: isCashSession ? 5 : isCashHistoricalReport || isCustomerHistory || isCustomerList ? 4.8 : 9, align: 'right' },
        'document-number': { x: 55, y: isCustomerHistory ? 27 : isCashSession ? 24.5 : 31.5, width: 40, height: 2.8, align: 'right' },
        'document-date': { x: isCustomerHistory ? 55 : 5, y: isCustomerHistory ? 30.2 : isCashSession ? 28 : 35, width: 40, height: 2.8, align: isCustomerHistory ? 'right' as const : 'left' as const },
        'document-status': { x: isCustomerHistory ? 55 : 58, y: isCustomerHistory ? 33.4 : isCashSession ? 28 : 35, width: isCustomerHistory ? 40 : 37, height: 2.8, align: 'right' },
        'document-generated': { x: 67, y: isCashSession ? 28 : isCashHistoricalReport ? 29.5 : isCustomerList ? 27.5 : 31.5, width: 28, height: 2.8, align: 'right' },
        'report-meta': { x: 5, y: isCashSession ? 28 : isCashHistoricalReport ? 29.5 : isCustomerList ? 27.5 : 31.5, width: 60, height: 2.8, align: 'left' },
        'cash-report-sections': { x: 5, y: cashSectionsY, width: 90, height: 96 - cashSectionsY },
        'report-sections': { x: 5, y: 51, width: 90, height: 44 },
        'cashier-label': { x: 5, y: isCashSession ? 32 : 38.5, width: 40, height: 2.6 },
        'cashier-name': { x: 5, y: isCashSession ? 34.5 : 41, width: 50, height: 3.2 },
        ...(isCustomerHistory ? {
          'history-customer-name': { x: 5, y: 23, width: 44, height: 4.5 },
          'party-tax-id': { x: 5, y: 28.3, width: 44, height: 5.2 },
          'party-address': { x: 5, y: 32, width: 44, height: 5.2 },
          'party-phone': { x: 5, y: 35.7, width: 44, height: 5.2 },
          'party-email': { x: 5, y: 39.4, width: 44, height: 5.2 },
          'party-contact': { x: 5, y: 43.1, width: 44, height: 5.2 },
          'party-balance-summary': { x: 5, y: 46.8, width: 44, height: 5.2 },
          'items-table': { x: 5, y: 53, width: 90, height: 42 },
        } : {}),
      }
    : {};
  const placements: Record<string, Partial<PdfTemplateNode>> = selected === 'company-left-logo-right'
    ? {
      'company-name': { x: 5, y: 6, width: 54, height: 5.5, align: 'left' },
      'company-summary': { x: 5, y: 11, width: 54, height: 10, align: 'left' },
      'company-logo': { x: 75, y: 4.5, width: 20, height: 9 },
      'document-title': { x: 66, y: 20.2, width: 29, height: 4.8, align: 'right' },
      'document-number': { x: 66, y: 25, width: 29, height: 3, align: 'right' },
      'document-date': { x: 5, y: 29, width: 36, height: 2.4, align: 'left' },
      'document-status': { x: 58, y: 29, width: 37, height: 2.4, align: 'right' },
      'document-generated': { x: 67, y: 29, width: 28, height: 2.4, align: 'right' },
      'report-meta': { x: 5, y: 29, width: 90, height: 2.4, align: 'left' },
    }
    : selected === 'logo-left-company-right'
      ? {
        'company-logo': { x: 5, y: 4.5, width: 20, height: 9 },
        'company-name': { x: 41, y: 6, width: 54, height: 5.5, align: 'right' },
        'company-summary': { x: 41, y: 11, width: 54, height: 10, align: 'right' },
        'document-title': { x: 66, y: 20.2, width: 29, height: 4.8, align: 'right' },
        'document-number': { x: 66, y: 25, width: 29, height: 3, align: 'right' },
        'document-date': { x: 5, y: 29, width: 36, height: 2.4, align: 'left' },
        'document-status': { x: 58, y: 29, width: 37, height: 2.4, align: 'right' },
        'document-generated': { x: 67, y: 29, width: 28, height: 2.4, align: 'right' },
        'report-meta': { x: 5, y: 29, width: 90, height: 2.4, align: 'left' },
      }
      : {
        'company-logo': hasLogo ? { x: 40, y: 3.6, width: 20, height: 6.3 } : {},
        'company-name': { x: 5, y: hasLogo ? 10.1 : 4.8, width: 90, height: 4.2, align: 'center' },
        'company-summary': { x: 5, y: hasLogo ? 14.8 : 9.8, width: 90, height: 10, align: 'center' },
        'document-title': { x: 5, y: hasLogo ? 19.1 : 14.1, width: 90, height: 4.2, align: 'center' },
        'document-number': { x: 5, y: hasLogo ? 23.5 : 18.5, width: 90, height: 3, align: 'center' },
        'document-date': { x: 5, y: metadataY, width: 36, height: 2.6, align: 'left' },
        'document-status': { x: 58, y: metadataY, width: 37, height: 2.6, align: 'right' },
        'document-generated': { x: 67, y: metadataY, width: 28, height: 2.6, align: 'right' },
        'report-meta': { x: 5, y: metadataY, width: 90, height: 2.6, align: 'left' },
      };

  const customerKpiY = reportLikeSalesTarget && selected === 'centered-stack'
    ? targetKey === 'ventas.customers' ? 37.5 : 41
    : targetKey === 'ventas.customers' ? 31 : 36;
  const customerKpiWidth = (90 - 4 * 1.2) / 5;
  const customerKpiPlacements = targetKey === 'ventas.customers'
    ? Object.fromEntries(Array.from({ length: 5 }, (_, index) => {
      const x = 5 + index * (customerKpiWidth + 1.2);
      const y = customerKpiY;
      return [
        [`report-kpi-card-${index}`, { x, y, width: customerKpiWidth, height: 12.5 }],
        [`report-kpi-label-${index}`, { x: x + 0.8, y: y + 0.8, width: customerKpiWidth - 1.6, height: 3.1 }],
        [`report-kpi-value-${index}`, { x: x + 0.8, y: y + 4.2, width: customerKpiWidth - 1.6, height: 4 }],
        [`report-kpi-detail-${index}`, { x: x + 0.8, y: y + 8.6, width: customerKpiWidth - 1.6, height: 2.8 }],
      ];
    }).flat())
    : {};
  const customerReportSectionPlacement = targetKey === 'ventas.customers'
    ? { x: 5, y: selected === 'centered-stack' ? 52.5 : 46, width: 90, height: selected === 'centered-stack' ? 42.5 : 49 }
    : undefined;
  const centeredPurchasePlacements: Record<string, Partial<PdfTemplateNode>> = isPurchaseTarget && selected === 'centered-stack'
    ? {
      'company-logo': { x: 40, y: 3.6, width: 20, height: 6.3 },
      'company-name': { x: 5, y: 10.1, width: 90, height: 4.2, align: 'center' },
      'company-summary': { x: 5, y: 14.8, width: 90, height: 8.5, align: 'center' },
      'document-title': { x: 55, y: 26, width: 40, height: 5, align: 'right' },
      'document-number': { x: 55, y: 31, width: 40, height: 2.8, align: 'right' },
      'document-date': { x: 5, y: 34.5, width: 40, height: 2.8, align: 'left' },
      'document-status': { x: 58, y: 34.5, width: 37, height: 2.8, align: 'right' },
      'document-generated': { x: 67, y: 34.5, width: 28, height: 2.8, align: 'right' },
      'document-extra': { x: 55, y: 38, width: 40, height: 5, align: 'right' },
      'report-meta': { x: 5, y: 33, width: 60, height: 2.8, align: 'left' },
      'items-table': { x: 5, y: 41, width: 90, height: 52 },
      'report-sections': { x: 5, y: 41, width: 90, height: 52 },
      'party-section': { x: 5, y: 26, width: 90, height: 18 },
    }
    : {};
  const isSavedCustomLayout = ['sales-custom', 'purchase-custom', 'custom'].includes(String(definition.metadata?.preset || ''));
  const customIdentityNodeIds = new Set(['company-name', 'company-summary', 'company-logo']);

  return {
    ...definition,
    nodes: definition.nodes.map(item => {
      if (isSavedCustomLayout) {
        if (!customIdentityNodeIds.has(item.id)) return item;
        const identityPlacement = placements[item.id];
        if (!identityPlacement) return item;
        const preservedWidth = Number(item.width) || 0;
        const x = selected === 'centered-stack'
          ? Math.max(0, (100 - preservedWidth) / 2)
          : item.id === 'company-logo' && selected === 'company-left-logo-right'
            ? Math.max(0, 95 - preservedWidth)
            : Number(identityPlacement.x ?? item.x);
        return {
          ...item,
          x,
          y: Number(identityPlacement.y ?? item.y),
          align: identityPlacement.align || item.align,
        };
      }
      const placement = customerKpiPlacements[item.id]
        || (item.id === 'report-sections' && customerReportSectionPlacement)
        || reportHeaderPlacements[item.id]
        || centeredPurchasePlacements[item.id]
        || placements[item.id];
      return placement ? { ...item, ...placement } : item;
    }),
  };
}

export function createSystemDefaultPdfSettings(overrides?: Record<string, unknown>) {
  return { ...SYSTEM_DEFAULT_PDF_SETTINGS, ...(overrides || {}) };
}

/**
 * Escala de lectura aplicada a la salida nativa y a los presets de biblioteca.
 * Los tamaños guardados siguen siendo puntos PDF editables; esta escala evita
 * que el rasterizador los convierta en texto visualmente demasiado pequeño.
 */
export const PDF_DEFAULT_FONT_SCALE = 1.4;

/**
 * Muestra contextual para que el canvas no presente una cotización genérica
 * cuando el usuario está diseñando otra salida del ERP.
 */
export function createPdfTemplateSampleData(targetKey: string): PdfTemplateData {
  const target = getPdfTemplateTarget(targetKey);
  const partyConfig = getPdfTemplatePartyConfig(target.key);
  const customer = { name: 'Cliente de ejemplo', taxId: 'J0310000000000', address: 'Carretera Norte, local 25', phone: '+505 8888-0000', email: 'cliente@empresa.com', contact: 'Contacto comercial', balanceDue: 'C$ 1,150.00', balanceFavor: 'C$ 250.00', balanceSummary: 'En contra: C$ 1,150.00' };
  const supplier = { name: 'Proveedor de ejemplo', taxId: 'J0310000000000', address: 'Managua, Nicaragua', phone: '+505 2222-0000', email: 'proveedor@empresa.com', contact: 'Contacto de compras' };
  const requester = { name: 'Ana Martínez', address: 'Departamento de Ventas', phone: '+505 2255-0012', email: 'ana@empresa.com', contact: 'Responsable de la solicitud' };
  const payee = { name: 'Beneficiario de ejemplo', taxId: 'J0310000000000', address: 'Managua, Nicaragua', phone: '+505 2222-0000', email: 'beneficiario@empresa.com', contact: 'Contacto del pago' };
  const transactionItems = [
    { description: 'Producto de muestra\nCódigo: PROD-001\nSKU variante: PROD-001-AZ-M\nNombre variante: Azul / M\nAtributos: Color: Azul · Talla: M', quantity: '2', unitPrice: 'C$ 500.00', total: 'C$ 1,000.00' },
    { description: 'Servicio adicional', quantity: '1', unitPrice: 'C$ 150.00', total: 'C$ 150.00' },
  ];
  const base: PdfTemplateData = {
    company: { name: '', slogan: '', fiscalInfo: '', address: '', phone: '', email: '', website: '', footerText: '', logo: '' },
    document: { title: target.label.toUpperCase(), number: 'DOC-000123', date: '29/08/2026', status: 'Pendiente', notes: 'Notas del documento', terms: 'Vigencia: 15 días' },
    customer,
    supplier,
    party: partyConfig.mode === 'supplier' ? supplier : partyConfig.mode === 'requester' ? requester : partyConfig.mode === 'payee' ? payee : partyConfig.mode === 'none' ? undefined : customer,
    items: transactionItems,
    totals: { subtotal: 'C$ 1,000.00', tax: 'C$ 150.00', discount: 'C$ 0.00', total: 'C$ 1,150.00' },
  };

  const reportSection = (
    id: string,
    title: string,
    headers: string[],
    values: Array<Array<string | number>> = [],
    columnWidths?: number[],
  ): PdfTemplateReportSection => {
    const sampleValue = (header: string, rowIndex: number) => {
      const label = header.toLocaleLowerCase('es-NI');
      if (/fecha|per[ií]odo|mes|ingreso|vencimiento|entrega|inicio|fin/.test(label)) return rowIndex ? '07/08/2026' : '08/09/2026';
      if (/participaci[oó]n|margen|rotaci[oó]n|porcentaje|cobertura/.test(label)) return rowIndex ? '12.4%' : '18.5%';
      if (/cliente/.test(label)) return rowIndex ? 'Distribuidora Central' : 'Comercial La Colonia';
      if (/proveedor/.test(label)) return rowIndex ? 'Suministros del Norte' : 'Distribuciones Vega';
      if (/colaborador|empleado/.test(label)) return rowIndex ? 'Luis Pérez' : 'Ana Martínez';
      if (/producto|insumo/.test(label)) return rowIndex ? 'Tóner compatible TN-450' : 'Papel carta Premium';
      if (/sucursal|bodega/.test(label)) return rowIndex ? 'Bodega Central' : 'Tienda 1';
      if (/categor[ií]a|segmento|origen|tipo|estado|status|departamento|cargo|forma de pago|cuenta/.test(label)) return rowIndex ? 'Operaciones' : 'Ventas';
      if (/indicador/.test(label)) return rowIndex ? 'Operaciones del período' : 'Ventas pagadas';
      if (/detalle|interpretaci[oó]n|alcance|f[oó]rmula|incidencias/.test(label)) return rowIndex ? 'Comparación con el período anterior' : 'Datos del período consultado';
      if (/unidades|cantidad|productos|facturas|proveedores|pagos|d[ií]as|operaciones|movimientos|colaboradores|sesiones|bajas|altas|existencia|stock|l[ií]neas|documentos/.test(label)) return rowIndex ? '18' : '42';
      if (/monto|valor|saldo|precio|importe|ventas|compras|costo|salario|ingreso|egreso|flujo|cobro|total|debe|haber|utilidad|inversi[oó]n|capital|liquidez|presupuesto/.test(label)) return rowIndex ? 'C$ 8,725.00' : 'C$ 24,500.00';
      return rowIndex ? 'Registro de muestra 2' : 'Registro de muestra 1';
    };
    const rows = values.length ? values : [
      headers.map(header => sampleValue(header, 0)),
      headers.map(header => sampleValue(header, 1)),
    ];
    return ({
    id,
    title,
    columns: headers.map((label, index) => ({
      id: `column-${index}`,
      label,
      token: `column-${index}`,
      width: columnWidths?.[index] || 100 / headers.length,
      align: index === 0 ? 'left' : 'right',
    })),
    rows: rows.map((row) =>
      Object.fromEntries(row.map((value, index) => [`column-${index}`, value])),
    ),
  });
  };

  const sampleKpiValue = (label: string, index: number) => /margen|ratio|rotaci[oó]n|participaci[oó]n|asistencia|antig[uü]edad/.test(label.toLocaleLowerCase('es-NI'))
    ? `${18 + index * 3}.5%`
    : /activo|factura|producto|colaborador|movimiento|unidades|cuenta|sesiones|saldo|cliente|proveedor|pendiente/.test(label.toLocaleLowerCase('es-NI'))
      ? (index + 1) * 24
      : `C$ ${(24500 + index * 1825).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (target.key === 'ventas.customer-history') {
    const history = [
      { description: 'Factura FAC-000124', date: '15/08/2026', status: 'Pagada', amount: 'C$ 1,150.00', detail: 'Venta de productos · Tienda 1' },
      { description: 'Cotización COT-000118', date: '09/08/2026', status: 'Aceptada', amount: 'C$ 850.00', detail: 'Vigencia de 15 días · Tienda 1' },
      { description: 'Pago REC-000099', date: '05/08/2026', status: 'Recibido', amount: 'C$ 500.00', detail: 'Abono a factura · Tienda 1' },
    ];
    return { ...base, party: customer, customer, document: { ...base.document, title: 'HISTORIAL DEL CLIENTE', number: 'CLI-000123', date: '29/08/2026', status: '', notes: 'Movimientos y documentos relacionados con el cliente.' }, items: history, history };
  }
  if (target.key === 'ventas.customers') {
    const customerRows = [
      ['CLI-00124', 'Comercial La Colonia', 'Empresa', 'María López', 'maria@colonia.example', '+505 2222-0101', 'Activo'],
      ['CLI-00123', 'Distribuidora Central', 'Empresa', 'Carlos Ruiz', 'carlos@central.example', '+505 2222-0102', 'Activo'],
      ['CLI-00122', 'Ana Martínez', 'Particular', 'Ana Martínez', 'ana@example.com', '+505 8888-0103', 'Inactivo'],
      ['CLI-00121', 'Luis Pérez', 'Particular', 'Luis Pérez', 'luis@example.com', '+505 8888-0104', 'Activo'],
    ];
    const customerList: PdfTemplateReportSection = {
      id: 'sales-customers',
      title: 'Clientes',
      columns: [
        { id: 'code', label: 'Código', token: 'column-0', width: 10, align: 'left' },
        { id: 'name', label: 'Cliente', token: 'column-1', width: 18, align: 'left' },
        { id: 'type', label: 'Tipo', token: 'column-2', width: 12, align: 'left' },
        { id: 'contact', label: 'Contacto', token: 'column-3', width: 16, align: 'left' },
        { id: 'email', label: 'Correo', token: 'column-4', width: 24, align: 'left' },
        { id: 'phone', label: 'Teléfono', token: 'column-5', width: 12, align: 'left' },
        { id: 'status', label: 'Estado', token: 'column-6', width: 8, align: 'center' },
      ],
      rows: customerRows.map(row => Object.fromEntries(row.map((value, index) => [`column-${index}`, value]))),
    };
    return {
      ...base,
      party: undefined,
      document: { ...base.document, title: 'LISTADO DE CLIENTES', number: '', date: '', status: '', period: 'Alcance: todos los clientes de la sucursal', generated: 'Generado: 09/09/2026 10:30' },
      reportKpis: [
        { label: 'CLIENTES', value: '4', detail: 'En el listado' },
        { label: 'ACTIVOS', value: '3', detail: 'Estado activo' },
        { label: 'INACTIVOS', value: '1', detail: 'Estado inactivo' },
        { label: 'PARTICULARES', value: '2', detail: 'Personas' },
        { label: 'EMPRESAS', value: '2', detail: 'Organizaciones' },
      ],
      reportSections: [customerList],
      items: customerList.rows,
      rows: customerList.rows,
    };
  }
  if (target.key === 'ventas.cash-session') {
    const summary = reportSection('cash-session-summary', 'Resumen del turno', ['Concepto', 'Monto'], [
      ['Fondo inicial', 'C$ 2,000.00'], ['Ventas', 'C$ 3,000.00'], ['Gastos', 'C$ 500.00'],
      ['Saldo esperado', 'C$ 4,500.00'], ['Efectivo contado', 'C$ 4,450.00'], ['Diferencia', 'C$ -50.00'],
    ]);
    const movements = reportSection('cash-session-movements', 'Movimientos de caja', ['Referencia', 'Tipo', 'Descripción', 'Hora', 'Monto'], [
      ['TKT-0124', 'Venta', 'Venta en efectivo', '10:30 a. m.', 'C$ 2,500.00'],
      ['MOV-0081', 'Gasto', 'Compra de suministros', '11:15 a. m.', '-C$ 500.00'],
    ]);
    return {
      ...base,
      party: { name: 'Gabriel Tinoco' },
      document: { ...base.document, title: 'RESUMEN DE SESIÓN DE CAJA', number: 'Caja 1', status: 'Cerrada', date: '08/09/2026 10:30' },
      reportSections: [summary, movements],
      items: movements.rows,
      rows: movements.rows,
    };
  }
  if (target.key === 'inventario.product-labels') {
    return { ...base, document: { ...base.document, title: 'ETIQUETA DE PRODUCTO', barcode: '7501234567890', date: '29/08/2026' }, product: { name: 'Producto de muestra', code: 'SKU-0001', barcode: '7501234567890', price: 'C$ 500.00' }, items: [] };
  }
  if (target.key === 'ventas.cash-ticket') {
    return { ...base, party: customer, document: { ...base.document, title: 'COMPROBANTE DE VENTA', number: 'FAC-001245', meta: 'FAC-001245 · CJ-01 · 09/09/2026 10:30', notes: 'Pago: Efectivo C$ 1,150.00 · Cambio: C$ 0.00' }, items: transactionItems };
  }
  if (target.key === 'ventas.cash-historical-report') {
    const reportSections: PdfTemplateReportSection[] = [
      reportSection('cash-summary', 'Resumen general', ['Sesiones', 'Cerradas', 'Ventas NIO', 'Ventas USD', 'Diferencia NIO', 'Depósitos NIO'], [
        ['15', '12', 'C$ 21,636.68', '$ 0.00', 'C$ -9,654.93', 'C$ 5,000.00'],
      ]),
      reportSection('cash-payment-methods', 'Formas de pago', ['Forma de pago', 'Operaciones', 'Monto NIO', 'Monto USD'], [
        ['Efectivo', '12', 'C$ 12,000.00', '$ 0.00'],
        ['Tarjeta', '4', 'C$ 9,636.68', '$ 0.00'],
      ]),
      reportSection('cash-sessions', 'Detalle de sesiones', ['Fecha', 'Caja', 'Cajero', 'N.º ventas', 'Ventas NIO / USD', 'Dif. NIO / depósito NIO'], [
        ['08/09/2026', 'Caja 1', 'Gabriel Tinoco', '17', 'C$ 21,636.68\n$ 0.00', 'C$ -9,654.93\nC$ 5,000.00'],
        ['07/09/2026', 'Caja 2', 'Ana Martínez', '12', 'C$ 8,500.00\n$ 0.00', 'C$ 250.00\nC$ 2,000.00'],
      ], [15, 14, 14, 8, 24.5, 24.5]),
    ];
    return {
      ...base,
      party: undefined,
      document: {
        ...base.document,
        title: 'REPORTE HISTÓRICO DE CAJA',
        number: '',
        status: '',
        date: '08/09/2026',
        period: 'Periodo: 01/08/2026 al 31/08/2026',
        generated: 'Generado: 08/09/2026 10:30',
        notes: '',
      },
      reportSections,
      items: reportSections[2].rows,
      rows: reportSections[2].rows,
    };
  }
  if (target.key === 'dashboard.tenant-overview') {
    const dashboardCharts: PdfTemplateChart[] = [
      { id: 'dashboard.trend', title: 'Evolución del período', type: 'area', labels: ['01 sep', '03 sep', '05 sep', '07 sep', '09 sep'], series: [{ label: 'Ventas pagadas', values: [7200, 10400, 8300, 15600, 12450], color: '#10b981' }, { label: 'Gastos registrados', values: [2100, 2800, 3400, 2500, 3900], color: '#2563eb' }] },
      { id: 'dashboard.attention', title: 'Atención requerida', type: 'donut', labels: ['Órdenes abiertas', 'Agotados', 'Stock bajo', 'Reordenar'], values: [7, 3, 5, 4], colors: ['#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'] },
      { id: 'dashboard.products-sales', title: 'Productos más vendidos', type: 'bar', labels: ['Papel carta Premium', 'Tóner TN-450', 'Carpeta ejecutiva'], values: [48, 32, 21], colors: ['#10b981', '#2563eb', '#f59e0b'] },
      { id: 'dashboard.products-margin', title: 'Utilidad de referencia', type: 'bar', labels: ['Tóner TN-450', 'Resma Premium', 'Carpeta ejecutiva'], values: [6200, 4850, 3120], colors: ['#10b981', '#2563eb', '#f59e0b'] },
      { id: 'dashboard.registers', title: 'Ventas por caja', type: 'bar', labels: ['Caja 1', 'Caja 2', 'Caja 3'], values: [18400, 12100, 8350], colors: ['#10b981', '#2563eb', '#f59e0b'] },
    ];
    const reportSections = [
      reportSection('dashboard-attention', 'Atención requerida', ['Prioridad', 'Cantidad', 'Detalle'], [['Órdenes abiertas', '7', 'Seguimiento comercial pendiente'], ['Productos con alerta', '12', 'Revisar existencias por bodega']]),
      reportSection('dashboard-products', 'Desempeño de productos', ['Producto', 'Unidades', 'Venta neta'], [['Papel carta Premium', '48', 'C$ 24,500.00'], ['Tóner compatible TN-450', '32', 'C$ 18,725.00']]),
      reportSection('dashboard-registers', 'Ventas por caja', ['Caja', 'Operaciones', 'Ventas pagadas'], [['Caja 1 · Tienda principal', '36', 'C$ 18,400.00'], ['Caja 2 · Sucursal norte', '24', 'C$ 12,100.00']]),
      reportSection('dashboard-transactions', 'Actividad reciente', ['Documento', 'Cliente', 'Monto', 'Estado'], [['FAC-001245', 'Comercial La Colonia', 'C$ 4,850.00', 'Pagada'], ['FAC-001244', 'Distribuidora Central', 'C$ 2,300.00', 'Pagada']]),
    ];
    return {
      ...base,
      document: { ...base.document, title: 'RESUMEN DE GESTIÓN', number: 'DASH-0001', period: 'Período: 01/09/2026 al 09/09/2026', meta: '', generated: 'Generado: 09/09/2026', notes: 'Indicadores y bloques seleccionados en el dashboard.' },
      reportKpis: [
        { label: 'VENTAS PAGADAS', value: 'C$ 42,850.00', detail: 'En el período' },
        { label: 'GASTOS REGISTRADOS', value: 'C$ 12,400.00', detail: 'En el período' },
        { label: 'FACTURAS PAGADAS', value: '84', detail: 'Operaciones' },
        { label: 'TICKET PROMEDIO', value: 'C$ 510.12', detail: 'Por factura' },
      ],
      dashboardCharts,
      dashboardPreferences: { indicators: ['totalRevenue', 'totalExpenses', 'paidInvoicesCount', 'averagePaidInvoice', 'netMargin'], blocks: ['trend', 'attention', 'products', 'customers', 'registers', 'transactions'] },
      reportSections,
      items: reportSections.flatMap(section => section.rows),
      rows: reportSections.flatMap(section => section.rows),
    };
  }
  if (target.key === 'portal.customer-summary') {
    const reportSections = [
      reportSection('portal-inventory', 'Mi inventario', ['Producto / código', 'Variante / SKU', 'Bodega', 'Disponibles', 'Valor disponible'], [
        ['Papel carta Premium / PAP-001', 'Caja 10 resmas / PAP-001-10', 'Tienda 1', '24', 'C$ 18,750.00'],
        ['Tóner compatible TN-450 / TON-450', 'Negro / TN-450-N', 'Bodega Central', '8', 'C$ 6,400.00'],
      ]),
      reportSection('portal-sales', 'Mis ventas y facturas', ['Fecha', 'Factura', 'Estado', 'Productos', 'Total', 'Pagado', 'Saldo'], [
        ['08/09/2026', 'FAC-001245', 'Pagada', 'Papel carta Premium', 'C$ 4,850.00', 'C$ 4,850.00', 'C$ 0.00'],
        ['05/09/2026', 'FAC-001231', 'Pendiente', 'Tóner compatible TN-450', 'C$ 2,300.00', 'C$ 1,000.00', 'C$ 1,300.00'],
      ]),
    ];
    return {
      ...base,
      company: { ...base.company, name: 'NovaHub Comercial' },
      customer,
      party: customer,
      document: { ...base.document, title: 'RESUMEN DEL PORTAL DE CLIENTES', number: 'PORTAL-0001', date: '09/09/2026', period: 'Información de inventario y ventas atribuida al cliente.', meta: 'Cuenta de cliente · Estado: Activo' },
      reportKpis: [
        { label: 'VENTAS DE HOY', value: 'C$ 4,850.00', detail: '1 factura' },
        { label: 'VENTAS DEL MES', value: 'C$ 28,450.00', detail: '12 facturas' },
        { label: 'UNIDADES DISPONIBLES', value: '32', detail: '2 productos' },
        { label: 'SALDO PENDIENTE', value: 'C$ 1,300.00', detail: '1 factura' },
      ],
      reportSections,
      items: reportSections.flatMap(section => section.rows),
      rows: reportSections.flatMap(section => section.rows),
    };
  }
  if (target.key === 'contabilidad.journal') {
    const entries = [
      ['AS-000124', '08/09/2026', 'Venta de factura FAC-001245', 'Contabilizado', 'C$ 4,850.00', 'C$ 4,850.00', 'Factura', 'FAC-001245'],
      ['AS-000123', '07/09/2026', 'Pago a proveedor PRO-00088', 'Contabilizado', 'C$ 2,300.00', 'C$ 2,300.00', 'Pago', 'PAG-00088'],
      ['AS-000122', '06/09/2026', 'Gasto de servicios básicos', 'Borrador', 'C$ 1,250.00', 'C$ 1,250.00', 'Gasto', 'GAS-00042'],
    ].map(row => Object.fromEntries(row.map((value, index) => [`column-${index}`, value])));
    return { ...base, party: undefined, document: { ...base.document, title: 'LIBRO DIARIO', number: 'DIARIO-0001', period: 'Período: 01/09/2026 al 09/09/2026' }, items: entries, rows: entries };
  }
  if (target.key === 'contabilidad.ledger') {
    const entries = [
      ['08/09/2026', '1101', 'Caja general', 'Activo', 'Venta de factura FAC-001245', 'FAC-001245', 'C$ 4,850.00', 'C$ 0.00', 'C$ 12,350.00'],
      ['07/09/2026', '2101', 'Proveedores', 'Pasivo', 'Pago a proveedor PRO-00088', 'PAG-00088', 'C$ 2,300.00', 'C$ 0.00', 'C$ 9,700.00'],
      ['06/09/2026', '4101', 'Ventas', 'Ingreso', 'Factura FAC-001238', 'FAC-001238', 'C$ 0.00', 'C$ 6,250.00', 'C$ -6,250.00'],
    ].map(row => Object.fromEntries(row.map((value, index) => [`column-${index}`, value])));
    return { ...base, party: undefined, document: { ...base.document, title: 'LIBRO MAYOR', number: 'MAYOR-0001', period: 'Cuenta: Caja general · Período: 01/09/2026 al 09/09/2026' }, items: entries, rows: entries };
  }
  if (target.module === 'reportes') {
    const reportKpisByTarget: Record<string, PdfTemplateKpi[]> = {
      'reportes.sales': [
        { label: 'VENTAS NETAS', value: '', detail: '' },
        { label: 'COBRANZA', value: '', detail: '' },
        { label: 'UTILIDAD BRUTA', value: '', detail: '' },
        { label: 'MARGEN BRUTO', value: '', detail: '' },
        { label: 'SALDO PENDIENTE', value: '', detail: '' },
      ],
      'reportes.purchases': [
        { label: 'COMPRAS NETAS DEL PERÍODO', value: '', detail: '' },
        { label: 'PAGOS EFECTUADOS', value: '', detail: '' },
        { label: 'SALDO PENDIENTE POR PAGAR', value: '', detail: '' },
        { label: 'TICKET PROMEDIO DE COMPRA', value: '', detail: '' },
      ],
      'reportes.finance': [
        { label: 'INGRESOS COBRADOS', value: '', detail: '' },
        { label: 'PAGOS REALIZADOS', value: '', detail: '' },
        { label: 'FLUJO NETO DEL PERÍODO', value: '', detail: '' },
        { label: 'SALDO DISPONIBLE', value: '', detail: '' },
        { label: 'COBERTURA DE PAGOS', value: '', detail: '' },
      ],
      'reportes.inventory': [
        { label: 'VALOR DEL INVENTARIO A COSTO', value: '', detail: '' },
        { label: 'PRODUCTOS EN RIESGO', value: '', detail: '' },
        { label: 'ROTACIÓN DE INVENTARIO', value: '', detail: '' },
        { label: 'VALOR POTENCIAL A PRECIO DE VENTA', value: '', detail: '' },
      ],
      'reportes.customers': [
        { label: 'CARTERA', value: '', detail: '' },
        { label: 'ADQUISICIÓN', value: '', detail: '' },
        { label: 'RATIO PAGO', value: '', detail: '' },
        { label: 'LTV PROMEDIO', value: '', detail: '' },
      ],
      'reportes.providers': [
        { label: 'SUMINISTRO TOTAL', value: '', detail: '' },
        { label: 'LOGÍSTICA ACTIVA', value: '', detail: '' },
        { label: 'CUENTAS POR PAGAR', value: '', detail: '' },
        { label: 'FLUJO DE PAGO', value: '', detail: '' },
      ],
      'reportes.hr': [
        { label: 'ACTIVOS', value: '', detail: '' },
        { label: 'COSTO NÓMINA', value: '', detail: '' },
        { label: 'COSTO / COLAB.', value: '', detail: '' },
        { label: 'ASISTENCIA', value: '', detail: '' },
        { label: 'ROTACIÓN', value: '', detail: '' },
        { label: 'ANTIGÜEDAD', value: '', detail: '' },
      ],
    };
    const reportSectionsByTarget: Record<string, PdfTemplateReportSection[]> = {
      'reportes.sales': [
        reportSection('sales-projection', 'Proyección de Cierre de Ventas', ['Indicador', 'Valor', 'Detalle']),
        reportSection('sales-category', 'Distribución de Ventas por Categoría', ['Categoría', 'Ventas netas', 'Participación', 'Unidades', 'Productos']),
        reportSection('sales-evolution', 'Evolución de Ventas', ['Período', 'Ventas netas', 'Cobros totales', 'Cobros del período', 'Acumulado']),
        reportSection('sales-cxc-aging', 'Antigüedad de CxC', ['Rango', 'Saldo pendiente', 'Facturas', 'Participación']),
        reportSection('sales-billing-collections', 'Ventas Facturadas y Cobros Recibidos', ['Indicador', 'Monto', 'Movimientos', 'Alcance']),
        reportSection('sales-operational', 'Resumen Operativo de Ventas', ['Indicador', 'Monto', 'Detalle']),
        reportSection('sales-customers', 'Principales Clientes por Ventas Netas', ['Cliente', 'Ventas netas', 'Facturas', 'Saldo', 'Participación']),
        reportSection('sales-products', 'Productos con Mayor Contribución', ['Producto', 'Ventas netas', 'Unidades', 'Utilidad', 'Margen']),
      ],
      'reportes.purchases': [
        reportSection('purchases-amount', 'Productos con Mayor Inversión de Compra · Monto', ['Producto', 'Monto', 'Unidades', 'Precio promedio']),
        reportSection('purchases-units', 'Productos con Mayor Inversión de Compra · Unidades', ['Producto', 'Unidades', 'Monto', 'Precio promedio']),
        reportSection('purchases-price-variation', 'Productos con Mayor Inversión de Compra · Variación de precio', ['Producto', 'Variación', 'Precio anterior', 'Precio actual']),
        reportSection('purchases-suppliers-performance', 'Desempeño de Proveedores', ['Proveedor', 'Compras', 'Desempeño', 'Entrega / incidencias']),
        reportSection('purchases-supplier-concentration', 'Concentración de Compras por Proveedor', ['Proveedor', 'Monto', 'Participación', 'Saldo']),
        reportSection('purchases-evolution', 'Evolución de Compras Netas', ['Período', 'Compra neta', 'Acumulado', 'Período anterior']),
        reportSection('purchases-cxp-aging', 'Antigüedad de CxP', ['Rango', 'Saldo', 'Facturas', 'Proveedores']),
        reportSection('purchases-billing-payments', 'Compras Facturadas y Pagos Realizados', ['Indicador', 'Monto', 'Movimientos', 'Alcance']),
        reportSection('purchases-period-payments', 'Compras Facturadas y Pagos Realizados por Período', ['Período', 'Compras netas', 'Pagos totales', 'Pagos del período']),
        reportSection('purchases-cycle-operational', 'Estado del Ciclo de Compra · Operativo', ['Indicador', 'Cantidad', 'Monto / valor', 'Detalle']),
        reportSection('purchases-cycle-incidents', 'Estado del Ciclo de Compra · Incidencias', ['Indicador', 'Cantidad', 'Unidades', 'Detalle']),
        reportSection('purchases-cycle-retentions', 'Estado del Ciclo de Compra · Retenciones', ['Indicador', 'Comprobantes', 'Monto', 'Estado']),
        reportSection('purchases-commitments', 'Compromisos de pago próximos', ['Horizonte', 'Monto', 'Facturas']),
        reportSection('purchases-budget', 'Presupuesto de Compras', ['Indicador', 'Monto', 'Detalle']),
        reportSection('purchases-cycle-time', 'Desglose del tiempo del ciclo de compra', ['Etapa', 'Promedio', 'Detalle']),
        reportSection('purchases-cycle-status', 'Desglose del estado del ciclo de compra', ['Etapa', 'Cantidad', 'Monto']),
        reportSection('purchases-incidents-suppliers', 'Incidencias por proveedor', ['Proveedor', 'Recepciones', 'Diferencias', 'Incidencias']),
        reportSection('purchases-retentions-detail', 'Detalle de retenciones', ['Factura', 'Proveedor', 'Tipo', 'Base', 'Monto', 'Estado']),
      ],
      'reportes.finance': [
        reportSection('finance-profitability', 'Rentabilidad (Estado de Resultados)', ['Concepto', 'Período actual', 'Período anterior']),
        reportSection('finance-cash-flow', 'Flujo de Caja por Período', ['Período', 'Ingresos', 'Pagos', 'Flujo neto', 'Ingresos acum.', 'Pagos acum.']),
        reportSection('finance-cash-forecast', 'Flujo de Caja Acumulado y Proyectado', ['Escenario', 'Período / fecha', 'Saldo', 'Entradas', 'Salidas']),
        reportSection('finance-income-origin', 'Ingresos por Origen', ['Origen', 'Monto', 'Participación']),
        reportSection('finance-cxc-aging', 'Composición de Ingresos · Antigüedad de CxC', ['Rango', 'Saldo pendiente', 'Facturas', 'Participación']),
        reportSection('finance-payment-category', 'Pagos por Categoría', ['Categoría', 'Monto', 'Participación']),
        reportSection('finance-cxp-aging', 'Composición de Pagos · Antigüedad de CxP', ['Rango', 'Saldo pendiente', 'Facturas', 'Participación']),
        reportSection('finance-income-movements', 'Movimientos de Ingresos', ['Fecha', 'Concepto', 'Origen', 'Documento', 'Monto', 'Estado']),
        reportSection('finance-payment-movements', 'Movimientos de Pagos', ['Fecha', 'Concepto', 'Origen', 'Documento', 'Monto', 'Estado']),
        reportSection('finance-position', 'Posición Financiera y Liquidez', ['Indicador', 'Valor', 'Detalle']),
        reportSection('finance-cash-reconciliation', 'Caja y Conciliación', ['Indicador', 'Valor', 'Detalle']),
        reportSection('finance-budget-recurring', 'Presupuesto y Recurrentes', ['Indicador', 'Valor', 'Detalle']),
        reportSection('finance-break-even', 'Punto de Equilibrio', ['Indicador', 'Valor', 'Detalle']),
        reportSection('finance-indicators', 'Indicadores Financieros', ['Indicador', 'Valor', 'Fórmula / interpretación']),
        reportSection('finance-commitments', 'Compromisos próximos 30 días', ['Fecha', 'Monto', 'Detalle']),
        reportSection('finance-trial-balance', 'Balance de comprobación', ['Código', 'Cuenta', 'Tipo', 'Debe', 'Haber', 'Saldo']),
      ],
      'reportes.inventory': [
        reportSection('inventory-immobilized', 'Productos con mayor valor inmovilizado', ['Producto', 'Unidades', 'Costo prom.', 'Valor total', 'Participación', 'Días sin mov.', 'Bodega']),
        reportSection('inventory-turnover', 'Productos con mayor rotación', ['Producto', 'Salidas', 'Stock prom.', 'Rotación', 'Stock actual', 'Cobertura']),
        reportSection('inventory-replenishment', 'Reposición sugerida', ['Producto', 'Bodega', 'Actual', 'Mínimo', 'Sugerido', 'Estado']),
        reportSection('inventory-distribution-category', 'Distribución del valor del inventario · Categoría', ['Segmento', 'Valor', 'Participación', 'Unidades', 'Productos']),
        reportSection('inventory-distribution-warehouse', 'Distribución del valor del inventario · Bodega', ['Segmento', 'Valor', 'Participación', 'Unidades', 'Productos']),
        reportSection('inventory-distribution-brand', 'Distribución del valor del inventario · Marca', ['Segmento', 'Valor', 'Participación', 'Unidades', 'Productos']),
        reportSection('inventory-distribution-turnover', 'Distribución del valor del inventario · Rotación', ['Segmento', 'Valor', 'Participación', 'Unidades', 'Productos']),
        reportSection('inventory-movements', 'Entradas, salidas y ajustes', ['Período', 'Entradas', 'Salidas', 'Ajustes positivos', 'Ajustes negativos']),
        reportSection('inventory-adjustments', 'Ajustes y mermas', ['Número', 'Fecha', 'Motivo', 'Bodega', 'Unidades', 'Estado']),
        reportSection('inventory-transfers', 'Transferencias', ['Número', 'Fecha', 'Origen', 'Destino', 'Líneas', 'Estado']),
        reportSection('inventory-risk', 'Indicadores de riesgo y abastecimiento', ['Indicador', 'Productos', 'Detalle']),
        reportSection('inventory-aging-value', 'Antigüedad y valor inmovilizado', ['Rango', 'Productos', 'Valor']),
        reportSection('inventory-oldest', 'Productos con mayor antigüedad', ['Producto', 'Unidades', 'Valor', 'Días sin movimiento', 'Bodega']),
        reportSection('inventory-overstock', 'Sobrestock', ['Producto', 'Actual', 'Máximo', 'Valor', 'Bodega']),
        reportSection('inventory-low-turnover', 'Menor rotación', ['Producto', 'Salidas', 'Stock prom.', 'Rotación', 'Stock actual', 'Cobertura']),
        reportSection('inventory-low-coverage', 'Menor cobertura', ['Producto', 'Stock actual', 'Cobertura', 'Consumo diario', 'Rotación']),
      ],
      'reportes.customers': [
        reportSection('customers-growth', 'Dinámica de Crecimiento', ['Mes', 'Ventas']),
        reportSection('customers-operations', 'Salud de Operaciones', ['Indicador', 'Cantidad', 'Detalle']),
        reportSection('customers-market', 'Composición del Mercado', ['Segmento', 'Clientes', 'Participación']),
        reportSection('customers-balance', 'Clientes con Mayor Saldo', ['Cliente', 'Saldo pendiente']),
        reportSection('customers-billing-leaders', 'Líderes de Facturación', ['Cliente', 'Ventas netas', 'Participación']),
        reportSection('customers-products', 'Productos Estrella', ['Producto', 'Valor vendido', 'Unidades']),
      ],
      'reportes.providers': [
        reportSection('providers-trend', 'Tendencia de Abastecimiento', ['Mes', 'Compras', 'Participación']),
        reportSection('providers-cycle', 'Eficiencia del Ciclo', ['Indicador', 'Valor', 'Detalle']),
        reportSection('providers-top', 'Principales Proveedores', ['Proveedor', 'Compras', 'Participación']),
        reportSection('providers-products', 'Insumos con Mayor Gasto', ['Insumo', 'Monto', 'Unidades']),
      ],
      'reportes.hr': [
        reportSection('hr-directory', 'Directorio de Colaboradores', ['Colaborador', 'Identificación', 'Cargo', 'Departamento', 'Estado', 'Ingreso']),
        reportSection('hr-antiquity', 'Mayor Antigüedad', ['Colaborador', 'Ingreso', 'Antigüedad', 'Departamento', 'Cargo']),
        reportSection('hr-vacations-balance', 'Vacaciones Pendientes', ['Colaborador', 'Días pendientes']),
        reportSection('hr-distribution-department', 'Distribución de la plantilla · Departamento', ['Segmento', 'Colaboradores', 'Participación', 'Costo nómina', 'Participación costo']),
        reportSection('hr-distribution-position', 'Distribución de la plantilla · Cargo', ['Segmento', 'Colaboradores', 'Participación', 'Costo nómina', 'Participación costo']),
        reportSection('hr-distribution-contract', 'Distribución de la plantilla · Tipo de contrato', ['Segmento', 'Colaboradores', 'Participación', 'Costo nómina', 'Participación costo']),
        reportSection('hr-distribution-branch', 'Distribución de la plantilla · Sucursal', ['Segmento', 'Colaboradores', 'Participación', 'Costo nómina', 'Participación costo']),
        reportSection('hr-payroll', 'Evolución del costo de nómina', ['Período', 'Salario', 'Variables', 'Cargas', 'Costo total']),
        reportSection('hr-stability', 'Movimientos y estabilidad', ['Período', 'Altas', 'Bajas', 'Plantilla']),
        reportSection('hr-attendance', 'Asistencia y ausentismo', ['Período', 'Presentes', 'Ausentes', 'Tardanzas']),
        reportSection('hr-turnover-department', 'Rotación por departamento', ['Departamento', 'Bajas', 'Promedio plantilla', 'Rotación']),
        reportSection('hr-cost-department', 'Costo por departamento', ['Departamento', 'Costo', 'Participación', 'Período anterior']),
        reportSection('hr-cost-employee', 'Costo por colaborador', ['Colaborador', 'Departamento', 'Costo']),
        reportSection('hr-absence-type', 'Ausentismo por tipo', ['Tipo de ausencia', 'Días', 'Participación']),
        reportSection('hr-upcoming-vacations', 'Próximas vacaciones aprobadas', ['Colaborador', 'Inicio', 'Fin', 'Días']),
        reportSection('hr-anniversaries', 'Próximos aniversarios', ['Colaborador', 'Departamento', 'Antigüedad', 'Aniversario']),
        reportSection('hr-performance', 'Desempeño', ['Indicador', 'Valor', 'Detalle']),
        reportSection('hr-training', 'Capacitación', ['Indicador', 'Valor', 'Detalle']),
        reportSection('hr-documentation', 'Documentación', ['Indicador', 'Cantidad', 'Detalle']),
        reportSection('hr-benefits', 'Beneficios', ['Indicador', 'Valor', 'Detalle']),
      ],
      'reportes.subscriptions': [
        reportSection('subscriptions-metrics', 'Indicadores de suscripciones', ['Métrica', 'Valor'], [
          ['MRR (Ingreso Mensual)', 'C$ 12,500.00'],
          ['Suscripciones Activas', '48'],
          ['Tasa de Retención', '94%'],
          ['LTV Proyectado', 'C$ 8,750.00'],
          ['Churn (Período)', '3'],
        ], [62, 38]),
      ],
    };

    const reportSections = reportSectionsByTarget[target.key] || [
      reportSection('report-summary', 'Resumen del reporte', ['Indicador', 'Valor', 'Detalle']),
    ];

    return {
      ...base,
      company: {},
      customer: {},
      supplier: {},
      party: undefined,
      document: { title: target.label.toUpperCase(), number: '', date: '', status: '', notes: '', terms: '', meta: '' },
      totals: {},
      history: [],
      reportKpis: (reportKpisByTarget[target.key] || []).map((kpi, index) => ({
        ...kpi,
        value: kpi.value || String(sampleKpiValue(kpi.label, index)),
        detail: kpi.detail || (index % 2 ? 'Comparado con el período anterior' : 'Período consultado'),
      })),
      reportSections,
      items: [],
      rows: [],
    };
  }
  if (target.module === 'actividades') {
    const sectionsByTarget: Record<string, PdfTemplateReportSection[]> = {
      'actividades.tasks': [reportSection('activities-tasks', 'Tareas', ['Título', 'Responsable', 'Prioridad', 'Vencimiento', 'Estado'])],
      'actividades.events': [reportSection('activities-events', 'Eventos', ['Evento', 'Inicio', 'Fin', 'Lugar', 'Responsable', 'Estado'])],
      'actividades.reminders': [reportSection('activities-reminders', 'Recordatorios', ['Recordatorio', 'Fecha', 'Alcance', 'Responsable', 'Estado'])],
      'actividades.logs': [reportSection('activities-logs', 'Bitácora de actividades', ['Fecha', 'Acción', 'Usuario', 'Módulo', 'Registro', 'Resultado'])],
      'actividades.calendar': [reportSection('activities-calendar', 'Calendario', ['Tipo', 'Título', 'Inicio', 'Fin', 'Responsable', 'Estado'])],
      'actividades.meetings': [reportSection('activities-meetings', 'Reuniones', ['Reunión', 'Inicio', 'Fin', 'Participantes', 'Plataforma', 'Estado'])],
    };
    const sections = sectionsByTarget[target.key] || [reportSection('activities-summary', 'Resumen de actividades', ['Indicador', 'Valor', 'Detalle'])];
    return { ...base, party: undefined, document: { ...base.document, title: target.label.toUpperCase(), number: `ACT-${target.key.split('.').pop()?.toUpperCase() || '0001'}` }, reportSections: sections, items: sections.flatMap(section => section.rows), rows: sections.flatMap(section => section.rows) };
  }
  if (target.module === 'proyectos') {
    if (target.key === 'proyectos.quote') {
      const sections = [
        reportSection('project-quote-summary', 'Cliente y proyecto', ['Dato', 'Detalle'], [
          ['Cliente', 'Cliente de ejemplo'],
          ['Proyecto', 'Proyecto de muestra · PROY-0001'],
          ['Asesor', 'Ana Martínez'],
          ['Fecha de emisión', '17/10/2026'],
        ], [24, 76]),
        reportSection('project-quote-items', 'Partidas ofertadas', ['Ítem', 'Descripción de la partida', 'Unidad', 'Cantidad', 'Precio unitario', 'Subtotal sin IVA'], [
          ['01', 'Suministro e instalación de perfilería\nMaterial y mano de obra especializada', 'm²', '24', 'USD 85.00', 'USD 2,040.00'],
          ['02', 'Instalación de acabado arquitectónico', 'Global', '1', 'USD 1,450.00', 'USD 1,450.00'],
        ], [7, 43, 12, 10, 14, 14]),
        reportSection('project-quote-payment', 'Condiciones de pago', ['Etapa', 'Porcentaje', 'Monto con IVA', 'Base sin IVA'], [
          ['Anticipo contractual', '70%', 'USD 2,823.70', 'USD 2,455.00'],
          ['Saldo contra entrega', '30%', 'USD 1,210.16', 'USD 1,052.14'],
        ], [34, 16, 25, 25]),
        reportSection('project-quote-terms', 'Términos y garantías', ['Término', 'Detalle'], [
          ['Garantía', 'Garantía comercial según alcance del servicio.'],
          ['Entrega', 'Cronograma acordado con el proyecto.'],
          ['Validez', 'Oferta válida durante 15 días hábiles.'],
          ['Cláusulas', 'Los términos específicos se incluyen en la cotización emitida.'],
        ], [24, 76]),
      ];
      return { ...base, party: undefined, document: { ...base.document, title: 'COTIZACIÓN DE PROYECTO', number: 'COT-PROY-0001' }, reportSections: sections, items: sections.flatMap(section => section.rows), rows: sections.flatMap(section => section.rows) };
    }
    const sections = [reportSection('projects-list', 'Proyectos', ['Código', 'Proyecto', 'Estado', 'Prioridad', 'Responsable', 'Inicio', 'Fin', 'Avance', 'Presupuesto', 'Ejecutado'])];
    return { ...base, party: undefined, document: { ...base.document, title: 'LISTADO DE PROYECTOS', number: 'PROY-0001' }, reportSections: sections, items: sections[0].rows, rows: sections[0].rows };
  }
  if (target.module === 'tracking') {
    const sections = [reportSection('tracking-transit', 'Envíos en tránsito', ['Ticket', 'Código tracking', 'Cliente', 'Ruta', 'Estado', 'Última actualización'])];
    return { ...base, party: undefined, document: { ...base.document, title: 'ENVÍOS EN TRÁNSITO', number: 'TRK-0001' }, reportSections: sections, items: sections[0].rows, rows: sections[0].rows };
  }
  if (target.module === 'tickets') {
    const sectionsByTarget: Record<string, PdfTemplateReportSection[]> = {
      'tickets.list': [reportSection('tickets-list', 'Tickets de soporte', ['Ticket', 'Asunto', 'Cliente', 'Prioridad', 'Estado', 'Creado'])],
      'tickets.knowledge': [reportSection('tickets-knowledge', 'Base de conocimiento', ['Artículo', 'Categoría', 'Visibilidad', 'Actualizado', 'Estado'])],
      'tickets.agents': [reportSection('tickets-agents', 'Agentes de soporte', ['Agente', 'Correo', 'Rol', 'Estado', 'Último acceso'])],
    };
    const sections = sectionsByTarget[target.key] || [reportSection('tickets-summary', 'Resumen de soporte', ['Indicador', 'Valor', 'Detalle'])];
    return { ...base, party: undefined, document: { ...base.document, title: target.label.toUpperCase(), number: `TKT-${target.key.split('.').pop()?.toUpperCase() || '0001'}` }, reportSections: sections, items: sections.flatMap(section => section.rows), rows: sections.flatMap(section => section.rows) };
  }
  if (target.module === 'financiamiento') {
    const sections = [reportSection('financing-applications', 'Solicitudes de financiamiento', ['Número', 'Estado', 'Monto solicitado', 'Plazo', 'Destino', 'Garantías', 'Creada'])];
    return { ...base, party: undefined, document: { ...base.document, title: 'SOLICITUDES DE FINANCIAMIENTO', number: 'FIN-PYME-0001' }, reportSections: sections, items: sections[0].rows, rows: sections[0].rows };
  }
  if (target.module === 'compras' || target.key.includes('supplier')) {
    const sampleParty = target.key === 'compras.purchase-request' ? requester : target.key === 'compras.expense' || target.key === 'compras.recurring-expense' ? payee : supplier;
    return { ...base, party: sampleParty, document: { ...base.document, title: target.label.toUpperCase(), number: 'COM-000123' }, items: transactionItems.map(item => ({ ...item, description: item.description.replace('Producto', 'Insumo') })) };
  }
  if (target.module === 'finanzas' || target.key.includes('finance') || target.key.includes('balance')) {
    const accounts = [
      { description: 'Caja general', quantity: 'Activo', unitPrice: '1101', total: 'C$ 8,500.00' },
      { description: 'Bancos nacionales', quantity: 'Activo', unitPrice: '1102', total: 'C$ 42,100.00' },
      { description: 'Cuentas por cobrar', quantity: 'Activo', unitPrice: '1201', total: 'C$ 18,750.00' },
    ];
    return { ...base, party: { name: 'Cuenta financiera' }, account: { name: 'Caja general' }, document: { ...base.document, title: target.label.toUpperCase(), number: 'FIN-0001' }, items: accounts, totals: { subtotal: 'C$ 69,350.00', tax: 'C$ 0.00', discount: 'C$ 0.00', total: 'C$ 69,350.00' } };
  }
  if (target.key === 'contabilidad.trial-balance') {
    const accounts = [
      { 'column-0': '1101', 'column-1': 'Caja general', 'column-2': 'Activo', 'column-3': 'C$ 8,500.00', 'column-4': 'C$ 0.00', 'column-5': 'C$ 8,500.00' },
      { 'column-0': '1102', 'column-1': 'Bancos nacionales', 'column-2': 'Activo', 'column-3': 'C$ 42,100.00', 'column-4': 'C$ 0.00', 'column-5': 'C$ 42,100.00' },
      { 'column-0': '4101', 'column-1': 'Ventas', 'column-2': 'Ingreso', 'column-3': 'C$ 0.00', 'column-4': 'C$ 50,600.00', 'column-5': 'C$ -50,600.00' },
    ];
    return { ...base, party: { name: 'Balance de comprobación' }, account: { name: 'Catálogo contable' }, document: { ...base.document, title: 'BALANCE DE COMPROBACIÓN', number: 'BC-0001' }, items: accounts, totals: { subtotal: 'C$ 50,600.00', tax: 'C$ 50,600.00', discount: 'C$ 0.00', total: 'C$ 0.00' } };
  }
  if (target.module === 'recursos-humanos') {
    const hrSections: Record<string, PdfTemplateReportSection[]> = {
      'recursos-humanos.dashboard': [
        reportSection('hr-dashboard-headcount', 'Plantilla activa', ['Indicador', 'Valor', 'Detalle'], [['Colaboradores activos', '42', 'Alcance de la sucursal'], ['Departamentos', '6', 'Departamentos con personal']]),
        reportSection('hr-dashboard-absence', 'Ausencias y desempeño', ['Indicador', 'Valor', 'Detalle'], [['Ausencias pendientes', '4', 'Solicitudes por revisar'], ['Evaluaciones del período', '18', 'Revisiones registradas']]),
      ],
      'recursos-humanos.employees': [reportSection('hr-employees', 'Directorio de colaboradores', ['Colaborador', 'Identificación', 'Cargo', 'Departamento', 'Estado', 'Ingreso'])],
      'recursos-humanos.departments': [reportSection('hr-departments', 'Departamentos y cargos', ['Departamento', 'Responsable', 'Colaboradores', 'Cargos', 'Estado'])],
      'recursos-humanos.attendance': [reportSection('hr-attendance', 'Registro de asistencia', ['Fecha', 'Colaborador', 'Entrada', 'Salida', 'Horas', 'Estado'])],
      'recursos-humanos.leave': [reportSection('hr-leave', 'Vacaciones y ausencias', ['Colaborador', 'Tipo', 'Inicio', 'Fin', 'Días', 'Estado'])],
      'recursos-humanos.performance': [reportSection('hr-performance-view', 'Evaluaciones de desempeño', ['Colaborador', 'Período', 'Evaluador', 'Puntuación', 'Estado'])],
      'recursos-humanos.kpi': [reportSection('hr-kpi', 'Indicadores de colaboradores', ['Indicador', 'Colaborador', 'Meta', 'Resultado', 'Estado'])],
      'recursos-humanos.training': [reportSection('hr-training-view', 'Capacitaciones', ['Capacitación', 'Colaborador', 'Inicio', 'Fin', 'Estado', 'Resultado'])],
      'recursos-humanos.benefits': [reportSection('hr-benefits-view', 'Beneficios asignados', ['Beneficio', 'Colaborador', 'Valor', 'Inicio', 'Fin', 'Estado'])],
      'recursos-humanos.commissions': [reportSection('hr-commissions', 'Comisiones de ventas', ['Vendedor', 'Período', 'Ventas', 'Base', 'Comisión', 'Estado'])],
      'recursos-humanos.payrolls': [reportSection('hr-payroll-view', 'Reporte de nóminas', ['Colaborador', 'Período', 'Salario bruto', 'Deducciones', 'Neto', 'Estado'])],
    };
    const reportSections = hrSections[target.key] || [reportSection('hr-summary', 'Resumen de Recursos Humanos', ['Indicador', 'Valor', 'Detalle'])];
    const isDashboard = target.key === 'recursos-humanos.dashboard';
    return {
      ...base,
      party: undefined,
      document: { ...base.document, title: target.label.toUpperCase(), number: `RH-${target.key.split('.').pop()?.toUpperCase() || '0001'}` },
      reportSections,
      reportKpis: isDashboard ? [
        { label: 'COLABORADORES ACTIVOS', value: '42', detail: 'Plantilla actual' },
        { label: 'COSTO DE NÓMINA', value: 'C$ 84,500.00', detail: 'Período consultado' },
        { label: 'ASISTENCIA', value: '96.5%', detail: 'Promedio del período' },
        { label: 'AUSENCIAS PENDIENTES', value: '4', detail: 'Solicitudes por revisar' },
      ] : undefined,
      items: reportSections.flatMap(section => section.rows),
      rows: reportSections.flatMap(section => section.rows),
    };
  }
  if (target.key.includes('payroll')) {
    const payroll = [
      { description: 'Ana Martínez', quantity: 'Administración', unitPrice: 'C$ 18,000.00', total: 'C$ 18,000.00' },
      { description: 'Luis Pérez', quantity: 'Ventas', unitPrice: 'C$ 16,500.00', total: 'C$ 16,500.00' },
    ];
    return { ...base, party: { name: 'Ana Martínez' }, employee: { name: 'Ana Martínez' }, document: { ...base.document, title: 'REPORTE DE NÓMINA', number: 'RH-0001' }, items: payroll };
  }
  if (target.key.includes('cash')) {
    return { ...base, party: { name: 'Caja principal' }, document: { ...base.document, title: target.label.toUpperCase(), number: 'CAJ-0001' }, items: [
      { description: 'Ventas en efectivo', quantity: '12', unitPrice: 'C$ 250.00', total: 'C$ 3,000.00' },
      { description: 'Transferencias recibidas', quantity: '4', unitPrice: 'C$ 500.00', total: 'C$ 2,000.00' },
    ] };
  }
  if (target.structure === 'dashboard') {
    return { ...base, document: { ...base.document, title: 'RESUMEN DEL DASHBOARD', number: 'DASH-0001', notes: 'Ingresos, gastos y actividad resumida de la sucursal.' }, items: [
      { description: 'Ventas del periodo', quantity: '—', unitPrice: '—', total: 'C$ 12,450.00' },
      { description: 'Clientes activos', quantity: '—', unitPrice: '—', total: '128' },
      { description: 'Documentos pendientes', quantity: '—', unitPrice: '—', total: '7' },
    ] };
  }
  return base;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function getFamily(target: PdfTemplateTarget) {
  if (target.family) return target.family;
  if (target.key.includes('cash')) return 'cash';
  // Estas vistas fueron catalogadas como administrativas por su origen de
  // datos, pero su salida sigue siendo una ficha/listado con filas repetibles.
  // Forzarlas a la familia administrativa ocultaba las columnas en el PDF.
  if (target.key === 'compras.supplier') return 'report';
  if (target.key === 'compras.purchase-request') return 'transaction';
  if (target.structure === 'history') return 'history';
  if (target.structure === 'report') return 'report';
  if (target.structure === 'dashboard') return 'dashboard';
  if (target.structure === 'print') return 'label';
  if (target.structure === 'receipt') return 'receipt';
  return target.structure === 'administrative' ? 'administrative' : 'transaction';
}

function settingsValue(settings: Record<string, unknown> | undefined, key: string, fallback: string) {
  const value = settings?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function defaultBorderStyle(type: PdfTemplateNodeType): PdfTemplateNode['borderStyle'] {
  if (type === 'table' || type === 'report-sections' || type === 'divider') return 'solid';
  return 'none';
}

/**
 * Columnas de muestra para que el canvas explique la vista que se está
 * editando. El exportador reemplaza estas columnas por las columnas reales de
 * cada reporte; aquí no se intenta inventar datos, únicamente se evita que
 * todos los destinos parezcan una cotización genérica.
 */
function defaultTableColumns(targetKey: string): PdfTemplateColumn[] {
  const presets: Record<string, string[]> = {
    'inventario.products': ['Código', 'Nombre', 'Categoría', 'Unidad', 'Stock', 'Precio', 'Estado'],
    'inventario.services': ['Código', 'Nombre', 'Categoría', 'Unidad', 'Precio', 'Estado'],
    'inventario.assets': ['Código', 'Nombre', 'Categoría', 'Ubicación', 'Responsable', 'Costo', 'Estado'],
    'ventas.customer-history': ['Documento', 'Fecha', 'Estado', 'Monto', 'Descripción / sucursal'],
    'ventas.customers': ['Código', 'Cliente', 'Tipo', 'Contacto', 'Correo', 'Teléfono', 'Estado'],
    'ventas.cash-historical-report': ['Fecha', 'Caja', 'Cajero', 'N.º ventas', 'Ventas NIO / USD', 'Dif. NIO / depósito NIO'],
    'ventas.cash-session': ['Referencia', 'Tipo', 'Descripción', 'Hora', 'Monto'],
    'compras.supplier-history': ['Movimiento', 'Estado', 'Fecha', 'Monto'],
    'compras.list': ['Documento', 'Proveedor', 'Fecha', 'Total'],
    'compras.supplier': ['Proveedor', 'Identificación', 'Contacto', 'Estado'],
    'compras.purchase-request': ['Solicitud', 'Solicitante', 'Fecha', 'Estado'],
    'finanzas.balance': ['Concepto', 'Tipo', 'Fecha', 'Monto'],
    'finanzas.transactions': ['Fecha', 'Concepto', 'Tipo', 'Monto'],
    'contabilidad.journal': ['# Asiento', 'Fecha', 'Descripción', 'Estado', 'Debe', 'Haber', 'Ref. Tipo', 'Referencia'],
    'contabilidad.ledger': ['Fecha', 'Código', 'Cuenta', 'Tipo', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Saldo'],
    'recursos-humanos.payrolls': ['Colaborador', 'Periodo', 'Neto', 'Estado'],
    'recursos-humanos.dashboard': ['Indicador', 'Valor', 'Detalle'],
    'recursos-humanos.employees': ['Colaborador', 'Identificación', 'Cargo', 'Departamento', 'Estado', 'Ingreso'],
    'recursos-humanos.departments': ['Departamento', 'Responsable', 'Colaboradores', 'Cargos', 'Estado'],
    'recursos-humanos.attendance': ['Fecha', 'Colaborador', 'Entrada', 'Salida', 'Horas', 'Estado'],
    'recursos-humanos.leave': ['Colaborador', 'Tipo', 'Inicio', 'Fin', 'Días', 'Estado'],
    'recursos-humanos.performance': ['Colaborador', 'Período', 'Evaluador', 'Puntuación', 'Estado'],
    'recursos-humanos.kpi': ['Indicador', 'Colaborador', 'Meta', 'Resultado', 'Estado'],
    'recursos-humanos.training': ['Capacitación', 'Colaborador', 'Inicio', 'Fin', 'Estado', 'Resultado'],
    'recursos-humanos.benefits': ['Beneficio', 'Colaborador', 'Valor', 'Inicio', 'Fin', 'Estado'],
    'recursos-humanos.commissions': ['Vendedor', 'Período', 'Ventas', 'Base', 'Comisión', 'Estado'],
    'actividades.tasks': ['Título', 'Responsable', 'Prioridad', 'Vencimiento', 'Estado'],
    'actividades.events': ['Evento', 'Inicio', 'Fin', 'Lugar', 'Responsable', 'Estado'],
    'actividades.reminders': ['Recordatorio', 'Fecha', 'Alcance', 'Responsable', 'Estado'],
    'actividades.logs': ['Fecha', 'Acción', 'Usuario', 'Módulo', 'Registro', 'Resultado'],
    'actividades.calendar': ['Tipo', 'Título', 'Inicio', 'Fin', 'Responsable', 'Estado'],
    'actividades.meetings': ['Reunión', 'Inicio', 'Fin', 'Participantes', 'Plataforma', 'Estado'],
    'proyectos.list': ['Código', 'Proyecto', 'Estado', 'Prioridad', 'Responsable', 'Inicio', 'Fin', 'Avance', 'Presupuesto', 'Ejecutado'],
    'tracking.transit': ['Ticket', 'Código tracking', 'Cliente', 'Ruta', 'Estado', 'Última actualización'],
    'tracking.batches': ['Referencia', 'Proveedor', 'Fecha', 'Paquetes', 'Estado'],
    'tracking.packages': ['Tracking', 'Cliente', 'SKU', 'Bodega', 'Peso real', 'Peso cobrable', 'Recibido'],
    'tracking.reconciliation': ['Tracking', 'Cliente', 'SKU', 'Bodega', 'Peso factura', 'Peso real', 'Recibido'],
    'tracking.billing': ['Tracking', 'Cliente', 'SKU', 'Peso cobrable', 'Estado', 'Recibido'],
    'tickets.list': ['Ticket', 'Asunto', 'Cliente', 'Prioridad', 'Estado', 'Creado'],
    'tickets.knowledge': ['Artículo', 'Categoría', 'Visibilidad', 'Actualizado', 'Estado'],
    'tickets.agents': ['Agente', 'Correo', 'Rol', 'Estado', 'Último acceso'],
    'financiamiento.applications': ['Número', 'Estado', 'Monto solicitado', 'Plazo', 'Destino', 'Garantías', 'Creada'],
    'reportes.customers': ['Cliente', 'Identificación', 'Teléfono', 'Estado'],
    'reportes.sales': ['Indicador', 'Valor', 'Detalle'],
    'reportes.purchases': ['Producto', 'Monto', 'Unidades', 'Precio promedio'],
    'reportes.inventory': ['Producto', 'Existencia', 'Valor'],
    'reportes.providers': ['Indicador', 'Valor', 'Detalle'],
    'reportes.finance': ['Indicador', 'Monto', 'Participación'],
    'reportes.hr': ['Colaborador', 'Identificación', 'Cargo'],
    'reportes.subscriptions': ['Métrica', 'Valor'],
    'dashboard.tenant-overview': ['Indicador', 'Valor', 'Detalle'],
  };
  if (targetKey === 'contabilidad.journal') {
    return ['# Asiento', 'Fecha', 'Descripción', 'Estado', 'Debe', 'Haber', 'Ref. Tipo', 'Referencia'].map((label, index) => ({ id: `column-${index}`, label, token: `column-${index}`, width: index === 2 ? 23 : 11, align: index === 0 || index === 2 || index === 3 ? 'left' : 'right' }));
  }
  if (targetKey === 'contabilidad.ledger') {
    return ['Fecha', 'Código', 'Cuenta', 'Tipo', 'Descripción', 'Referencia', 'Débito', 'Crédito', 'Saldo'].map((label, index) => ({ id: `column-${index}`, label, token: `column-${index}`, width: index === 4 ? 20 : 10, align: index === 4 ? 'left' : index < 4 ? 'left' : 'right' }));
  }
  if (targetKey === 'ventas.customer-history') {
    return [
      { id: 'description', label: 'Documento', token: 'description', width: 22, align: 'left' },
      { id: 'date', label: 'Fecha', token: 'date', width: 13, align: 'center' },
      { id: 'status', label: 'Estado', token: 'status', width: 13, align: 'left' },
      { id: 'amount', label: 'Monto', token: 'amount', width: 16, align: 'right' },
      { id: 'detail', label: 'Descripción / sucursal', token: 'detail', width: 36, align: 'left' },
    ];
  }
  if (targetKey === 'ventas.customers') {
    return [
      { id: 'column-0', label: 'Código', token: 'column-0', width: 10, align: 'left' },
      { id: 'column-1', label: 'Cliente', token: 'column-1', width: 18, align: 'left' },
      { id: 'column-2', label: 'Tipo', token: 'column-2', width: 12, align: 'left' },
      { id: 'column-3', label: 'Contacto', token: 'column-3', width: 16, align: 'left' },
      { id: 'column-4', label: 'Correo', token: 'column-4', width: 24, align: 'left' },
      { id: 'column-5', label: 'Teléfono', token: 'column-5', width: 12, align: 'left' },
      { id: 'column-6', label: 'Estado', token: 'column-6', width: 8, align: 'center' },
    ];
  }
  if (targetKey === 'ventas.cash-session') {
    return [
      { id: 'reference', label: 'Referencia', token: 'reference', width: 19, align: 'left' },
      { id: 'type', label: 'Tipo', token: 'type', width: 15, align: 'left' },
      { id: 'description', label: 'Descripción', token: 'description', width: 34, align: 'left' },
      { id: 'time', label: 'Hora', token: 'time', width: 12, align: 'center' },
      { id: 'amount', label: 'Monto', token: 'amount', width: 20, align: 'right' },
    ];
  }
  if (targetKey === 'ventas.cash-historical-report') {
    return [
      { id: 'date', label: 'Fecha', token: 'date', width: 15, align: 'left' },
      { id: 'register', label: 'Caja', token: 'register', width: 14, align: 'left' },
      { id: 'cashier', label: 'Cajero', token: 'cashier', width: 14, align: 'left' },
      { id: 'sales-count', label: 'N.º ventas', token: 'salesCount', width: 8, align: 'right' },
      { id: 'sales-amounts', label: 'Ventas NIO / USD', token: 'salesAmounts', width: 24.5, align: 'right' },
      { id: 'difference-deposit', label: 'Dif. NIO / depósito NIO', token: 'differenceDeposit', width: 24.5, align: 'right' },
    ];
  }
  if (targetKey === 'compras.supplier-history') {
    return [
      { id: 'column-0', label: 'Fecha', token: 'column-0', width: 11, align: 'left' },
      { id: 'column-1', label: 'Tipo', token: 'column-1', width: 10, align: 'left' },
      { id: 'column-2', label: 'Documento', token: 'column-2', width: 14, align: 'left' },
      { id: 'column-3', label: 'Descripción', token: 'column-3', width: 30, align: 'left' },
      { id: 'column-4', label: 'Cant.', token: 'column-4', width: 8, align: 'right' },
      { id: 'column-5', label: 'Precio U.', token: 'column-5', width: 13.5, align: 'right' },
      { id: 'column-6', label: 'Total', token: 'column-6', width: 13.5, align: 'right' },
    ];
  }
  if (targetKey === 'compras.purchase-request') {
    return [
      { id: 'description', label: 'Descripción', token: 'description', width: 52, align: 'left' },
      { id: 'quantity', label: 'Cant.', token: 'quantity', width: 12, align: 'right' },
      { id: 'unitPrice', label: 'Precio', token: 'unitPrice', width: 18, align: 'right' },
      { id: 'total', label: 'Total', token: 'total', width: 18, align: 'right' },
    ];
  }
  if (targetKey === 'portal.customer-summary') {
    return ['Producto / código', 'Variante / SKU', 'Bodega', 'Disponibles', 'Valor disponible'].map((label, index) => ({ id: `column-${index}`, label, token: `column-${index}`, width: index < 2 ? 24 : 17.33, align: index < 3 ? 'left' : 'right' }));
  }
  const labels = presets[targetKey] || ['Descripción', 'Cant.', 'Precio', 'Total'];
  return labels.map((label, index) => ({
    id: index === 0 ? 'description' : index === 1 ? 'quantity' : index === 2 ? 'unitPrice' : 'total',
    label,
    token: index === 0 ? 'description' : index === 1 ? 'quantity' : index === 2 ? 'unitPrice' : 'total',
    width: index === 0 ? 48 : 52 / Math.max(labels.length - 1, 1),
    align: index === 0 ? 'left' : 'right',
  }));
}

const node = (value: Omit<PdfTemplateNode, 'id'>, id: string): PdfTemplateNode => ({
  id,
  enabled: true,
  padding: 1.5,
  borderStyle: defaultBorderStyle(value.type),
  fontSize: 9,
  color: '#334155',
  borderColor: value.type === 'table' || value.type === 'report-sections' ? '#e2e8f0' : 'transparent',
  ...value,
});

const DIAGONAL_CLIP_PATH = 'polygon(0 0,100% 0,78% 100%,0 100%)';
const TICKET_CLIP_PATH = 'polygon(0 0,100% 0,100% 88%,96% 100%,92% 88%,88% 100%,84% 88%,80% 100%,76% 88%,72% 100%,68% 88%,64% 100%,60% 88%,56% 100%,52% 88%,48% 100%,44% 88%,40% 100%,36% 88%,32% 100%,28% 88%,24% 100%,20% 88%,16% 100%,12% 88%,8% 100%,4% 88%,0 100%)';
const NOTCH_CLIP_PATH = 'polygon(0 0,100% 0,100% 72%,96% 100%,92% 72%,88% 100%,84% 72%,80% 100%,76% 72%,72% 100%,68% 72%,64% 100%,60% 72%,56% 100%,52% 72%,48% 100%,44% 72%,40% 100%,36% 72%,32% 100%,28% 72%,24% 100%,20% 72%,16% 100%,12% 72%,8% 100%,4% 72%,0 100%)';

function createBaseTemplateDefinition(targetKey: string, requestedSettings?: Record<string, unknown>): PdfTemplateDefinition {
  const settings = normalizePdfPaperSettings(targetKey, requestedSettings);
  const target = getPdfTemplateTarget(targetKey);
  const family = getFamily(target);
  const primary = settingsValue(settings, 'primaryColor', '#10b981');
  const secondary = settingsValue(settings, 'secondaryColor', '#0f3b65');
  const text = settingsValue(settings, 'textColor', '#334155');
  const line = settingsValue(settings, 'lineColor', '#e2e8f0');
  const background = settingsValue(settings, 'backgroundColor', '#ffffff');
  const headerLayout = String(settings?.headerLayout || 'split');
  const defaultFooterLayout = ['fluid', 'aurora', 'ink'].includes(headerLayout) ? 'layers' : ['diagonal', 'ticket'].includes(headerLayout) ? 'notch' : headerLayout === 'corner' || headerLayout === 'ribbon' ? 'wave' : headerLayout === 'minimal' ? 'minimal' : 'line';
  const footerLayout = String(settings?.footerLayout || defaultFooterLayout);
  const headerIsFilled = ['banner', 'double-band', 'fluid', 'aurora', 'diagonal', 'ink', 'ticket', 'steps'].includes(headerLayout);
  const headerTextColor = headerIsFilled ? '#ffffff' : text;
  const titleColor = ['split', 'topline', 'editorial', 'ribbon', 'portal', 'grid'].includes(headerLayout) ? primary : headerTextColor;
  const party = getPdfTemplatePartyConfig(target.key);
  const partyLabel = party.nameLabel;
  const partyToken = party.mode === 'none' ? '' : `${party.tokenPrefix}.name`;
  const partySectionLabel = party.sectionLabel;
  const hasLogo = Boolean(settings?.logoUrl);
  const isHistoricalCashReport = target.key === 'ventas.cash-historical-report';
  const isDashboard = target.structure === 'dashboard';
  const isPortalSummary = target.key === 'portal.customer-summary';
  const isReportOutput = target.structure === 'report' || target.module === 'reportes';
  const reportKpiCount = isDashboard ? 4 : isPortalSummary ? 4 : target.module === 'reportes'
    ? ['reportes.hr', 'reportes.finance', 'reportes.sales'].includes(target.key) ? 5 : 4
    : 0;
  const reportKpiColumns = reportKpiCount >= 5 ? 4 : reportKpiCount;
  const reportKpiHeight = 13;
  const reportKpiRowGap = 1;
  const reportKpiRows = reportKpiCount > 0 ? Math.ceil(reportKpiCount / reportKpiColumns) : 0;
  const reportSectionsY = isDashboard ? 31 : reportKpiCount > 0
    ? 30 + reportKpiRows * reportKpiHeight + (reportKpiRows - 1) * reportKpiRowGap + 3
    : 46;
  const reportSectionsHeight = isDashboard ? 60 : reportKpiCount > 0 ? Math.max(20, 91 - reportSectionsY) : 45;

  if (family === 'cash-ticket') {
    const columns = [
      { id: 'description', label: 'Descripción', token: 'description', width: 35, align: 'left' as const },
      { id: 'quantity', label: 'Cant.', token: 'quantity', width: 15, align: 'right' as const },
      { id: 'unitPrice', label: 'Precio', token: 'unitPrice', width: 24, align: 'right' as const },
      { id: 'total', label: 'Total', token: 'total', width: 26, align: 'right' as const },
    ];
    return {
      version: 1,
      page: { paperSize: settingsValue(settings, 'paperSize', 'ROLL-80'), orientation: 'portrait', background },
      nodes: [
        node({ type: 'field', label: 'Empresa', token: 'company.name', x: 5, y: 3, width: 90, height: 6, fontSize: 10, bold: true, align: 'center', borderStyle: 'none' }, 'company-name'),
        node({ type: 'field', label: 'Título', token: 'document.title', x: 5, y: 9.5, width: 90, height: 4.5, fontSize: 8, bold: true, align: 'center', borderStyle: 'none' }, 'document-title'),
        node({ type: 'field', label: 'Número y fecha', token: 'document.meta', x: 5, y: 14.5, width: 90, height: 6.5, fontSize: 6.5, align: 'center', borderStyle: 'none' }, 'ticket-meta'),
        node({ type: 'field', label: 'Cliente', token: 'customer.name', x: 5, y: 21.5, width: 90, height: 5.5, fontSize: 7, borderStyle: 'none' }, 'party-name'),
        node({ type: 'table', label: 'Detalle del ticket', x: 5, y: 27.5, width: 90, height: 51, fontSize: 6, columns, repeatHeader: true, tableHeaderColor: '#ffffff', tableHeaderTextColor: text, tableRowColor: '#ffffff', tableStripeColor: '#ffffff' }, 'items-table'),
        node({ type: 'totals', label: 'Totales', x: 5, y: 79.5, width: 90, height: 14, fontSize: 7, backgroundColor: '#ffffff', borderColor: line }, 'totals'),
        node({ type: 'field', label: 'Pago', token: 'document.notes', x: 5, y: 94, width: 90, height: 3.5, fontSize: 5.5, borderStyle: 'none' }, 'ticket-payment'),
        node({ type: 'field', label: 'Gracias por su compra', text: 'Gracias por su compra', x: 5, y: 97.5, width: 90, height: 2, fontSize: 5.5, align: 'center', borderStyle: 'none' }, 'ticket-footer'),
      ],
      metadata: { preset: 'system-default-cash-ticket' },
    };
  }

  if (family === 'label') {
    return {
      version: 1,
      page: { paperSize: settingsValue(settings, 'paperSize', 'LABEL'), orientation: 'landscape', background },
      nodes: [
        node({ type: 'barcode', label: 'Código de barras', token: 'product.barcode', x: 5, y: 5, width: 90, height: 40, fontSize: 7, color: text, borderStyle: 'none', padding: 0.2 }, 'label-barcode'),
        node({ type: 'field', label: 'Nombre del producto', token: 'product.name', x: 5, y: 47, width: 90, height: 16, fontSize: 8.5, fontWeight: 700, color: text, align: 'center', lineHeight: 1.25, borderStyle: 'none', padding: 0.2 }, 'label-name'),
        node({ type: 'field', label: 'Precio', token: 'product.price', x: 5, y: 64, width: 90, height: 16, fontSize: 11, fontWeight: 800, color: primary, align: 'center', lineHeight: 1.2, borderStyle: 'none', padding: 0.2 }, 'label-price'),
        node({ type: 'field', label: 'Empresa', token: 'company.name', x: 5, y: 81, width: 90, height: 8, fontSize: 5.5, fontWeight: 600, color: text, align: 'center', lineHeight: 1.2, borderStyle: 'none', padding: 0.2 }, 'label-company'),
        node({ type: 'field', label: 'Fecha', token: 'document.date', x: 5, y: 90, width: 90, height: 6, fontSize: 4.5, color: text, align: 'center', lineHeight: 1.2, borderStyle: 'none', padding: 0.2 }, 'label-date'),
      ],
      metadata: { preset: 'system-default-label' },
    };
  }
  const headerNodes: PdfTemplateNode[] = [];

  if (headerLayout === 'classic') {
    headerNodes.push(node({ type: 'divider', label: 'Línea superior', x: 5, y: 4, width: 90, height: 1, borderColor: primary }, 'header-accent'));
  } else if (headerLayout === 'topline') {
    headerNodes.push(node({ type: 'section', label: 'Línea de color', x: 5, y: 4, width: 90, height: 1.5, backgroundColor: primary, borderColor: primary }, 'header-accent'));
  } else if (headerLayout === 'sidebar') {
    headerNodes.push(node({ type: 'section', label: 'Acento lateral', x: 5, y: 4, width: 2.4, height: 18, backgroundColor: primary, borderColor: primary, borderRadius: 4, clipPath: 'ellipse(100% 50% at 0% 50%)' }, 'header-accent'));
    headerNodes.push(node({ type: 'section', label: 'Sombra lateral', x: 6.8, y: 6, width: 1.4, height: 14, backgroundColor: secondary, borderColor: secondary, borderRadius: 4, clipPath: 'ellipse(100% 50% at 0% 50%)', opacity: 0.28 }, 'header-sidebar-shadow'));
  } else if (headerLayout === 'centered') {
    headerNodes.push(node({ type: 'section', label: 'Píldora de marca', x: 32, y: 4, width: 36, height: 3, backgroundColor: primary, borderColor: primary, borderRadius: 4 }, 'header-accent'));
  } else if (headerLayout === 'corner') {
    headerNodes.push(node({ type: 'section', label: 'Acento de esquina', x: 76, y: 4, width: 19, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 999, shape: 'circle', clipPath: 'ellipse(100% 100% at 100% 0%)' }, 'header-accent'));
  } else if (headerLayout === 'editorial') {
    headerNodes.push(node({ type: 'divider', label: 'Regla editorial', x: 5, y: 4, width: 90, height: 1, borderColor: primary }, 'header-accent'));
  } else if (headerLayout === 'boxed') {
    headerNodes.push(node({ type: 'section', label: 'Marco de cabecera', x: 5, y: 4, width: 90, height: 17, backgroundColor: '#ffffff', borderColor: primary, borderRadius: 2, borderStyle: 'solid' }, 'header'));
  } else if (headerLayout === 'double-band') {
    headerNodes.push(node({ type: 'section', label: 'Banda superior', x: 5, y: 4, width: 90, height: 6, backgroundColor: primary, borderColor: primary, borderRadius: 0 }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Banda inferior', x: 5, y: 16, width: 90, height: 5, backgroundColor: primary, borderColor: primary, borderRadius: 0 }, 'header-band'));
  } else if (headerLayout === 'compact') {
    headerNodes.push(node({ type: 'section', label: 'Banda compacta', x: 5, y: 4, width: 90, height: 2, backgroundColor: primary, borderColor: primary }, 'header-accent'));
  } else if (headerLayout === 'ribbon') {
    headerNodes.push(node({ type: 'section', label: 'Cinta corporativa', x: 5, y: 4, width: 31, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 2, clipPath: 'polygon(0 0,100% 0,86% 100%,0 100%)' }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Acento de cinta', x: 28, y: 4, width: 18, height: 17, backgroundColor: secondary, borderColor: secondary, borderRadius: 2, clipPath: 'polygon(38% 0,100% 0,62% 100%,0 100%)', opacity: 0.42 }, 'header-ribbon-accent'));
    headerNodes.push(node({ type: 'section', label: 'Contraste de cinta', x: 36, y: 4, width: 59, height: 17, backgroundColor: '#f8fafc', borderColor: line, borderRadius: 2 }, 'header-band'));
  } else if (headerLayout === 'split') {
    headerNodes.push(node({ type: 'section', label: 'Cabecera dividida', x: 5, y: 4, width: 90, height: 17, backgroundColor: '#ffffff', borderColor: line, borderRadius: 2 }, 'header'));
    headerNodes.push(node({ type: 'divider', label: 'Acento de cabecera', x: 5, y: 20, width: 90, height: 1, borderColor: primary }, 'header-accent'));
  } else if (headerLayout === 'banner') {
    headerNodes.push(node({ type: 'section', label: 'Banda corporativa', x: 5, y: 4, width: 90, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 2 }, 'header'));
  } else if (headerLayout === 'fluid') {
    headerNodes.push(node({ type: 'section', label: 'Onda orgánica principal', x: 5, y: 3, width: 90, height: 18, backgroundColor: primary, borderColor: primary, borderRadius: 8, shape: 'wave-bottom', clipPath: 'ellipse(90% 100% at 50% 0%)' }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Onda de profundidad', x: 5, y: 7, width: 90, height: 14, backgroundColor: secondary, borderColor: secondary, borderRadius: 8, shape: 'wave-bottom', clipPath: 'ellipse(78% 100% at 62% 0%)', opacity: 0.38 }, 'header-band'));
    headerNodes.push(node({ type: 'section', label: 'Pulso de marca', x: 10, y: 5, width: 25, height: 2, backgroundColor: '#ffffff', borderColor: '#ffffff', borderRadius: 999, shape: 'pill', opacity: 0.9 }, 'header-accent'));
  } else if (headerLayout === 'aurora') {
    headerNodes.push(node({ type: 'section', label: 'Aurora principal', x: 5, y: 3, width: 90, height: 18, backgroundColor: primary, borderColor: primary, clipPath: 'ellipse(92% 100% at 50% 0%)', opacity: 0.96 }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Aurora secundaria', x: 5, y: 6, width: 90, height: 15, backgroundColor: secondary, borderColor: secondary, clipPath: 'ellipse(72% 100% at 72% 0%)', opacity: 0.56 }, 'header-band'));
    headerNodes.push(node({ type: 'section', label: 'Halo', x: 75, y: 5, width: 13, height: 13, backgroundColor: '#ffffff', borderColor: '#ffffff', borderRadius: 999, shape: 'circle', opacity: 0.16 }, 'header-accent'));
  } else if (headerLayout === 'diagonal') {
    headerNodes.push(node({ type: 'section', label: 'Plano diagonal', x: 5, y: 4, width: 90, height: 17, backgroundColor: primary, borderColor: primary, clipPath: DIAGONAL_CLIP_PATH }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Contraste diagonal', x: 5, y: 4, width: 90, height: 17, backgroundColor: secondary, borderColor: secondary, clipPath: 'polygon(24% 0,100% 0,100% 100%,0 100%)', opacity: 0.34 }, 'header-band'));
  } else if (headerLayout === 'portal') {
    headerNodes.push(node({ type: 'section', label: 'Portal de marca', x: 5, y: 4, width: 20, height: 16, backgroundColor: '#ffffff', borderColor: primary, borderRadius: 999, borderStyle: 'solid', shape: 'circle' }, 'header-accent'));
    headerNodes.push(node({ type: 'section', label: 'Marco portal', x: 26, y: 4, width: 69, height: 17, backgroundColor: '#f8fafc', borderColor: primary, borderRadius: 2, borderStyle: 'solid' }, 'header'));
  } else if (headerLayout === 'steps') {
    headerNodes.push(node({ type: 'section', label: 'Escalón uno', x: 5, y: 4, width: 53, height: 4, backgroundColor: primary, borderColor: primary, borderRadius: 3 }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Escalón dos', x: 18, y: 8, width: 77, height: 4, backgroundColor: primary, borderColor: primary, borderRadius: 3, opacity: 0.72 }, 'header-band'));
    headerNodes.push(node({ type: 'section', label: 'Escalón tres', x: 35, y: 12, width: 60, height: 4, backgroundColor: primary, borderColor: primary, borderRadius: 3, opacity: 0.42 }, 'header-accent'));
  } else if (headerLayout === 'ink') {
    headerNodes.push(node({ type: 'section', label: 'Mancha de tinta', x: 5, y: 3, width: 90, height: 18, backgroundColor: primary, borderColor: primary, clipPath: 'ellipse(78% 100% at 18% 0%)', opacity: 0.94 }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Sombra de tinta', x: 5, y: 6, width: 90, height: 15, backgroundColor: secondary, borderColor: secondary, clipPath: 'ellipse(58% 100% at 72% 0%)', opacity: 0.3 }, 'header-band'));
    headerNodes.push(node({ type: 'section', label: 'Trazo', x: 9, y: 17, width: 28, height: 1.5, backgroundColor: '#ffffff', borderColor: '#ffffff', borderRadius: 999, shape: 'pill', opacity: 0.82 }, 'header-accent'));
  } else if (headerLayout === 'grid') {
    headerNodes.push(node({ type: 'section', label: 'Retícula de cabecera', x: 5, y: 4, width: 90, height: 17, backgroundColor: '#f8fafc', borderColor: primary, borderRadius: 1, borderStyle: 'solid' }, 'header'));
    headerNodes.push(node({ type: 'divider', label: 'Retícula vertical uno', x: 34, y: 4, width: 1, height: 17, borderColor: primary, opacity: 0.45 }, 'header-grid-one'));
    headerNodes.push(node({ type: 'divider', label: 'Retícula vertical dos', x: 67, y: 4, width: 1, height: 17, borderColor: primary, opacity: 0.45 }, 'header-grid-two'));
    headerNodes.push(node({ type: 'divider', label: 'Retícula horizontal', x: 5, y: 12, width: 90, height: 1, borderColor: primary, opacity: 0.3 }, 'header-grid-three'));
  } else if (headerLayout === 'ticket') {
    headerNodes.push(node({ type: 'section', label: 'Talón superior', x: 5, y: 4, width: 90, height: 17, backgroundColor: primary, borderColor: primary, clipPath: TICKET_CLIP_PATH }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Línea del talón', x: 8, y: 17, width: 84, height: 1, backgroundColor: '#ffffff', borderColor: '#ffffff', opacity: 0.35 }, 'header-accent'));
  } else {
    headerNodes.push(node({ type: 'section', label: 'Cabecera', x: 5, y: 4, width: 90, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 2 }, 'header'));
  }

  const headerFields: PdfTemplateNode[] = [
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: headerLayout === 'centered' ? 20 : headerLayout === 'ribbon' ? (hasLogo ? 21 : 8) : hasLogo ? 28 : 8, y: headerLayout === 'compact' ? 8 : headerLayout === 'centered' ? 12 : headerLayout === 'steps' ? 6 : 7, width: headerLayout === 'centered' ? 60 : headerLayout === 'ribbon' ? (hasLogo ? 14 : 25) : hasLogo ? 28 : headerLayout === 'portal' ? 24 : 40, height: 8, fontSize: headerLayout === 'editorial' ? 9 : 14, color: headerLayout === 'ribbon' ? '#ffffff' : headerTextColor, bold: true, align: headerLayout === 'centered' ? 'center' : 'left', textTransform: headerLayout === 'editorial' ? 'uppercase' : 'none', borderStyle: 'none', padding: 0.4 }, 'company-name'),
    node({ type: 'field', label: 'Título', token: 'document.title', x: headerLayout === 'centered' ? 20 : headerLayout === 'ribbon' ? 43 : headerLayout === 'portal' ? 50 : 58, y: headerLayout === 'centered' ? 16 : headerLayout === 'compact' ? 8 : headerLayout === 'steps' ? 10 : 7, width: headerLayout === 'centered' ? 60 : headerLayout === 'ribbon' ? 52 : headerLayout === 'portal' ? 41 : 34, height: 5, fontSize: headerLayout === 'editorial' ? 16 : 14, color: titleColor, bold: true, align: headerLayout === 'centered' ? 'center' : 'right', borderStyle: 'none', padding: 0.4 }, 'document-title'),
    node({ type: 'field', label: 'Número', token: 'document.number', x: headerLayout === 'ribbon' ? 43 : headerLayout === 'portal' ? 50 : 58, y: headerLayout === 'compact' ? 13 : headerLayout === 'centered' ? 21 : headerLayout === 'double-band' ? 17 : headerLayout === 'steps' ? 14 : 13, width: headerLayout === 'ribbon' ? 52 : headerLayout === 'portal' ? 41 : 34, height: 4.5, fontSize: 8, color: headerLayout === 'ribbon' ? text : headerIsFilled ? '#dbeafe' : text, align: 'right', borderStyle: 'none', padding: 0.4 }, 'document-number'),
    node({ type: 'field', label: 'Estado', token: 'document.status', x: 55, y: 24, width: 40, height: 3, fontSize: 7, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-status'),
    node({ type: 'field', label: 'Datos de la sucursal', token: 'company.summary', x: headerLayout === 'ribbon' ? 43 : headerLayout === 'portal' ? 50 : 8, y: headerLayout === 'compact' ? 16 : 16, width: headerLayout === 'ribbon' ? 52 : headerLayout === 'portal' ? 41 : 46, height: 7, fontSize: 5.8, lineHeight: 1.15, color: headerLayout === 'ribbon' || headerLayout === 'portal' ? text : headerTextColor, align: 'left', borderStyle: 'none', padding: 0.2 }, 'company-summary'),
  ];
  const logoNode = node({ type: 'image', label: 'Logotipo', x: 8, y: 7, width: headerLayout === 'ribbon' ? 11 : 16, height: 8, enabled: hasLogo, borderStyle: 'none', backgroundColor: 'transparent' }, 'company-logo');
  const reportHeaderFields = isDashboard
    ? [
      node({ type: 'field', label: 'Empresa', token: 'company.name', x: 24, y: 6, width: 36, height: 9, fontSize: 7, color: headerTextColor, bold: true, borderStyle: 'none', padding: 0.25 }, 'company-name'),
      node({ type: 'field', label: 'Título', token: 'document.title', x: 61, y: 6, width: 34, height: 9, fontSize: 7, color: titleColor, bold: true, align: 'right', borderStyle: 'none', padding: 0.25 }, 'document-title'),
      node({ type: 'field', label: 'Datos de la sucursal', token: 'company.summary', x: 8, y: 14, width: 84, height: 4, fontSize: 5.5, lineHeight: 1.1, color: text, align: 'center', borderStyle: 'none', padding: 0.2 }, 'company-summary'),
      node({ type: 'field', label: 'Período y filtros', token: 'document.meta', x: 8, y: 23, width: 55, height: 4.5, fontSize: 6.5, color: '#64748b', align: 'left', borderStyle: 'none', padding: 0.2 }, 'report-meta'),
    ]
    : isReportOutput || isPortalSummary
      ? [
        ...headerFields.filter(item => ['company-name', 'company-summary', 'document-title'].includes(item.id)).map(item => item.id === 'company-summary' && headerLayout === 'split' ? { ...item, y: 13, height: 5 } : item),
        node({ type: 'field', label: 'Período, filtros y generación', token: 'document.meta', x: 8, y: 24, width: 84, height: 4.5, fontSize: 6.5, color: '#64748b', align: 'left', borderStyle: 'none', padding: 0.2 }, 'report-meta'),
      ]
      : headerFields;
  const historicalHeaderFields: PdfTemplateNode[] = [
    ...headerFields.filter(item => !['document-number', 'document-status'].includes(item.id)),
    node({ type: 'field', label: 'Período', token: 'document.period', x: 8, y: 24, width: 48, height: 4, fontSize: 8, color: text }, 'document-date'),
  ];
  const nodes: PdfTemplateNode[] = [...headerNodes, logoNode, ...(isHistoricalCashReport ? historicalHeaderFields : reportHeaderFields),
    ...((isHistoricalCashReport || isDashboard) ? [node({ type: 'field', label: 'Generado', token: 'document.generated', x: 64, y: isDashboard ? 23 : 24, width: 28, height: 4.5, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2, firstPageOnly: true }, 'document-generated')] : []),
    ...(isHistoricalCashReport || isDashboard || isReportOutput ? [] : [node({ type: 'field', label: 'Fecha', token: 'document.date', x: 8, y: headerLayout === 'compact' ? 20 : 24, width: 35, height: 4, fontSize: 8, color: text }, 'document-date')]),
    node({ type: 'section', label: partySectionLabel, x: 5, y: 31, width: 90, height: 19, backgroundColor: '#f8fafc', borderColor: line, borderRadius: 3, color: text, borderStyle: 'none' }, 'party-section'),
    node({ type: 'field', label: partyLabel, token: partyToken, x: 8, y: 34, width: 50, height: 5.5, fontSize: 10, color: text, bold: true, borderStyle: 'none' }, 'party-name'),
    node({ type: 'field', label: party.labels.taxId, token: `${party.tokenPrefix}.taxId`, x: 62, y: 34, width: 30, height: 5.5, fontSize: 8, color: text, align: 'right', borderStyle: 'none' }, 'party-tax-id'),
    node({ type: 'field', label: party.labels.address, token: `${party.tokenPrefix}.address`, x: 8, y: 40.3, width: 50, height: 4.8, fontSize: 8, color: text, borderStyle: 'none' }, 'party-address'),
    node({ type: 'field', label: party.labels.phone, token: `${party.tokenPrefix}.phone`, x: 62, y: 40.3, width: 30, height: 4.8, fontSize: 8, color: text, align: 'right', borderStyle: 'none' }, 'party-phone'),
    node({ type: 'field', label: party.labels.email, token: `${party.tokenPrefix}.email`, x: 8, y: 45.5, width: 50, height: 4, fontSize: 7, color: '#64748b', borderStyle: 'none' }, 'party-email'),
    node({ type: 'field', label: party.labels.contact, token: `${party.tokenPrefix}.contact`, x: 62, y: 45.5, width: 30, height: 4, fontSize: 7, color: '#64748b', align: 'right', borderStyle: 'none' }, 'party-contact'),
  ];

  if (target.module === 'reportes' || isDashboard || isPortalSummary) {
    const kpiWidth = (90 - (reportKpiColumns - 1) * 2) / reportKpiColumns;
    const kpiColors = [primary, secondary, primary, secondary, primary, secondary];
    for (let index = 0; index < reportKpiCount; index += 1) {
      const row = Math.floor(index / reportKpiColumns);
      const column = index % reportKpiColumns;
      const itemsInRow = Math.min(reportKpiColumns, reportKpiCount - row * reportKpiColumns);
      const rowOffset = itemsInRow < reportKpiColumns
        ? ((reportKpiColumns - itemsInRow) * (kpiWidth + 2)) / 2
        : 0;
      const x = 5 + rowOffset + column * (kpiWidth + 2);
      const y = 30 + row * (reportKpiHeight + reportKpiRowGap);
      nodes.push(node({ type: 'section', label: '', text: '', x, y, width: kpiWidth, height: reportKpiHeight, backgroundColor: kpiColors[index], borderColor: kpiColors[index], borderRadius: 3, firstPageOnly: true }, `report-kpi-card-${index}`));
      nodes.push(node({ type: 'field', label: 'Indicador', token: `reportKpis.${index}.label`, x: x + 1, y: y + 1, width: kpiWidth - 2, height: 2.5, fontSize: isDashboard ? 4 : 5.2, color: '#ffffff', align: 'center', borderStyle: 'none', padding: 0, firstPageOnly: true }, `report-kpi-label-${index}`));
      nodes.push(node({ type: 'field', label: 'Valor', token: `reportKpis.${index}.value`, x: x + 1, y: y + 4, width: kpiWidth - 2, height: 4.7, fontSize: isDashboard ? 7 : 9, color: '#ffffff', bold: true, align: 'center', borderStyle: 'none', padding: 0, firstPageOnly: true }, `report-kpi-value-${index}`));
      nodes.push(node({ type: 'field', label: 'Detalle', token: `reportKpis.${index}.detail`, x: x + 1, y: y + 9.4, width: kpiWidth - 2, height: 3, fontSize: isDashboard ? 3.8 : 4.6, color: '#ffffff', align: 'center', borderStyle: 'none', padding: 0, firstPageOnly: true }, `report-kpi-detail-${index}`));
    }
  }

  const isTabular = family === 'transaction' || family === 'receipt' || family === 'report' || family === 'history' || family === 'cash' || family === 'dashboard';
  const compactReport = family === 'report' || family === 'dashboard' || family === 'cash' || party.mode === 'none';
  const tableColumns: PdfTemplateColumn[] = target.key === 'contabilidad.trial-balance'
    ? [
      { id: 'column-0', label: 'Código', token: 'column-0', width: 13, align: 'left' },
      { id: 'column-1', label: 'Cuenta', token: 'column-1', width: 29, align: 'left' },
      { id: 'column-2', label: 'Tipo', token: 'column-2', width: 15, align: 'left' },
      { id: 'column-3', label: 'Débitos', token: 'column-3', width: 14, align: 'right' },
      { id: 'column-4', label: 'Créditos', token: 'column-4', width: 14, align: 'right' },
      { id: 'column-5', label: 'Saldo', token: 'column-5', width: 15, align: 'right' },
    ]
    : defaultTableColumns(target.key);
  if (isTabular) {
    if (isHistoricalCashReport) {
      nodes.push(node({
        type: 'report-sections', label: 'Secciones del reporte', x: 5, y: 31, width: 90, height: 60,
        subsequentY: 31, subsequentHeight: 63, backgroundColor: '#ffffff', borderColor: line, color: text, columns: tableColumns, repeatHeader: true,
      }, 'cash-report-sections'));
    } else if (target.module === 'reportes' || isDashboard || isPortalSummary) {
      nodes.push(node({
        type: 'report-sections', label: 'Secciones del reporte', x: 5, y: reportSectionsY, width: 90, height: reportSectionsHeight,
        subsequentY: 31, subsequentHeight: 63, backgroundColor: '#ffffff', borderColor: line, color: text, columns: tableColumns, repeatHeader: true,
      }, 'report-sections'));
    } else {
      nodes.push(node({
        type: 'table', label: family === 'history' || family === 'report' || family === 'cash' ? 'Tabla de resultados' : 'Detalle',
        x: 5, y: compactReport ? 31 : 52, width: 90, height: compactReport ? 47 : 26, backgroundColor: '#ffffff', borderColor: line, color: text, columns: tableColumns, repeatHeader: true,
      }, 'items-table'));
    }
  } else {
    nodes.push(node({ type: 'text', label: 'Información', text: 'Información del documento', x: 5, y: 51, width: 90, height: 8, fontSize: 11, color: text, bold: true }, 'information-title'));
    nodes.push(node({ type: 'field', label: 'Notas', token: 'document.notes', x: 5, y: 58, width: 90, height: 17, fontSize: 9, color: text }, 'document-notes'));
  }

  if (isDashboard) {
    nodes.push(node({ type: 'chart', label: 'Evolución del período', token: 'dashboard.trend', chartType: 'area', x: 5, y: 46, width: 90, height: 42, borderColor: line, backgroundColor: '#ffffff' }, 'chart-trend'));
    nodes.push(node({ type: 'chart', label: 'Atención requerida', token: 'dashboard.attention', chartType: 'donut', x: 5, y: 61, width: 28, height: 14, borderColor: line, backgroundColor: '#ffffff' }, 'chart-attention'));
    nodes.push(node({ type: 'chart', label: 'Productos más vendidos', token: 'dashboard.products-sales', chartType: 'bar', x: 35, y: 61, width: 28, height: 14, borderColor: line, backgroundColor: '#ffffff' }, 'chart-products-sales'));
    nodes.push(node({ type: 'chart', label: 'Utilidad de referencia', token: 'dashboard.products-margin', chartType: 'bar', x: 65, y: 61, width: 30, height: 14, borderColor: line, backgroundColor: '#ffffff' }, 'chart-products-margin'));
    nodes.push(node({ type: 'chart', label: 'Ventas por caja', token: 'dashboard.registers', chartType: 'bar', x: 5, y: 76, width: 90, height: 14, borderColor: line, backgroundColor: '#ffffff' }, 'chart-registers'));
  }

  if ((family === 'transaction' || family === 'receipt' || family === 'cash') && !isHistoricalCashReport) {
    nodes.push(node({ type: 'totals', label: 'Totales', x: 55, y: 80, width: 40, height: 12, backgroundColor: '#f8fafc', borderColor: line, color: text }, 'totals'));
  }
  if (target.module !== 'reportes' && !isDashboard && !isPortalSummary && !isHistoricalCashReport) nodes.push(node({ type: 'field', label: 'Notas', token: 'document.notes', x: 5, y: 80, width: 46, height: 10, fontSize: 8, color: text }, 'notes'));
  const footerIsFilled = ['band', 'wave', 'layers', 'notch'].includes(footerLayout);
  if (footerLayout === 'band') {
    nodes.push(node({ type: 'section', label: 'Banda inferior', x: 5, y: 95.2, width: 90, height: 3.1, backgroundColor: primary, borderColor: primary, borderRadius: 1 }, 'footer-band'));
  } else if (footerLayout === 'wave') {
    nodes.push(node({ type: 'section', label: 'Ola inferior', x: 5, y: 95.2, width: 90, height: 3.1, backgroundColor: primary, borderColor: primary, borderRadius: 10, shape: 'wave' }, 'footer-band'));
    nodes.push(node({ type: 'section', label: 'Contraste inferior', x: 5, y: 96.65, width: 90, height: 1.45, backgroundColor: secondary, borderColor: secondary, borderRadius: 10, shape: 'wave' }, 'footer-accent'));
  } else if (footerLayout === 'layers') {
    nodes.push(node({ type: 'section', label: 'Capa orgánica inferior', x: 5, y: 95.2, width: 90, height: 3.1, backgroundColor: primary, borderColor: primary, borderRadius: 10, shape: 'wave' }, 'footer-band'));
    nodes.push(node({ type: 'section', label: 'Capa secundaria', x: 5, y: 96.65, width: 90, height: 1.45, backgroundColor: secondary, borderColor: secondary, borderRadius: 10, shape: 'wave', opacity: 0.58 }, 'footer-layer'));
    nodes.push(node({ type: 'section', label: 'Trazo inferior', x: 11, y: 96, width: 24, height: 0.55, backgroundColor: '#ffffff', borderColor: '#ffffff', borderRadius: 999, shape: 'pill', opacity: 0.86 }, 'footer-accent'));
  } else if (footerLayout === 'notch') {
    nodes.push(node({ type: 'section', label: 'Pie dentado', x: 5, y: 95.2, width: 90, height: 3.1, backgroundColor: primary, borderColor: primary, clipPath: NOTCH_CLIP_PATH }, 'footer-band'));
  } else if (footerLayout === 'boxed') {
    nodes.push(node({ type: 'section', label: 'Marco inferior', x: 5, y: 95.2, width: 90, height: 3.1, backgroundColor: '#ffffff', borderColor: primary, borderRadius: 2, borderStyle: 'solid' }, 'footer-band'));
  } else if (footerLayout === 'split') {
    nodes.push(node({ type: 'section', label: 'Pie dividido', x: 5, y: 95.2, width: 90, height: 3.1, backgroundColor: '#f8fafc', borderColor: line, borderRadius: 1 }, 'footer-band'));
    nodes.push(node({ type: 'section', label: 'Acento del pie', x: 5, y: 95.2, width: 65, height: 3.1, backgroundColor: primary, borderColor: primary, borderRadius: 1 }, 'footer-accent'));
  } else if (footerLayout === 'minimal') {
    nodes.push(node({ type: 'divider', label: 'Separador mínimo', x: 5, y: 95.35, width: 90, height: 0.35, borderColor: line }, 'footer-divider'));
  } else if (footerLayout === 'dots') {
    nodes.push(node({ type: 'divider', label: 'Separador de puntos', x: 5, y: 95.35, width: 90, height: 0.35, borderColor: line }, 'footer-divider'));
    [10, 14, 18].forEach((x, index) => nodes.push(node({ type: 'section', label: `Punto ${index + 1}`, x, y: 95.1, width: 0.9, height: 0.9, backgroundColor: primary, borderColor: primary, borderRadius: 999, shape: 'circle' }, `footer-dot-${index + 1}`)));
  } else {
    nodes.push(node({ type: 'divider', label: 'Separador', x: 5, y: 95.35, width: 90, height: 0.35, borderColor: line }, 'footer-divider'));
  }
  nodes.push(node({ type: 'field', label: 'Pie', token: 'company.footerText', x: 8, y: 95.45, width: footerLayout === 'split' ? 60 : 62, height: 3.1, fontSize: 7, lineHeight: 1.1, color: footerIsFilled || footerLayout === 'split' ? '#ffffff' : '#64748b' }, 'footer-contact'));
  nodes.push(node({ type: 'field', label: 'Página', token: 'page.number', x: 72, y: 95.45, width: 23, height: 3.1, fontSize: 7, color: footerIsFilled ? '#ffffff' : '#64748b', align: 'right' }, 'footer-page'));

  const partyNodeIds = ['party-section', 'party-name', 'party-tax-id', 'party-address', 'party-phone', 'party-email', 'party-contact'];
  const nodesWithoutParty = party.mode === 'none' ? nodes.filter(item => !partyNodeIds.includes(item.id)) : nodes;
  const reportWithoutParty = compactReport ? nodesWithoutParty.filter(item => !partyNodeIds.includes(item.id)) : nodesWithoutParty;
  return {
    version: 1,
    page: { paperSize: settingsValue(settings, 'paperSize', 'LETTER'), orientation: settings?.orientation === 'landscape' ? 'landscape' : 'portrait', background },
    nodes: reportWithoutParty,
    metadata: { preset: `${headerLayout}-${footerLayout}` },
  };
}

/** Estructura común de reportes, historiales y vistas administrativas. */
function createStandardModuleDefinition(targetKey: string, settings: Record<string, unknown>, base: PdfTemplateDefinition): PdfTemplateDefinition {
  const primary = settingsValue(settings, 'primaryColor', '#01422c');
  const text = settingsValue(settings, 'textColor', '#334155');
  const line = settingsValue(settings, 'lineColor', '#d7dee7');
  const target = getPdfTemplateTarget(targetKey);
  const logoEnabled = Boolean(settings.logoUrl);
  const hasReportKpis = base.nodes.some(item => item.id.startsWith('report-kpi-card-'));
  const replacedHeaderIds = new Set([
    'company-logo', 'company-name', 'company-summary', 'document-title', 'document-number',
    'document-date', 'document-status', 'document-extra', 'document-generated', 'report-meta',
  ]);
  const bodyNodes = base.nodes
    .filter(item => !item.id.startsWith('header') && !item.id.startsWith('footer-'))
    .filter(item => !replacedHeaderIds.has(item.id))
    .filter(item => !['notes', 'document-notes'].includes(item.id))
    .map(item => {
      const shifted = typeof item.y === 'number' && item.y >= 28 ? { ...item, y: item.y + 5.3 } : item;
      if (shifted.type === 'report-sections') {
        // Los reportes con KPI conservan el espacio para las tarjetas antes
        // de sus tablas. En listados sin KPI, acercamos la primera tabla al
        // título/metadatos para no dejar media página vacía.
        const y = target.structure !== 'dashboard' && !hasReportKpis ? 35.3 : shifted.y;
        return { ...shifted, x: 5, y, width: 90, backgroundColor: 'transparent', borderColor: 'transparent' };
      }
      if (shifted.type === 'table') return { ...shifted, x: 5, width: 90 };
      return shifted;
    });
  const nodes: PdfTemplateNode[] = [
    node({ type: 'divider', label: 'Separador del encabezado', x: 5, y: 4, width: 90, height: 0.5, borderColor: primary }, 'header-accent'),
    node({ type: 'image', label: 'Logotipo', x: 75, y: 5.5, width: 20, height: 9, enabled: logoEnabled, borderStyle: 'none', backgroundColor: 'transparent' }, 'company-logo'),
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: 5, y: 6, width: 54, height: 5.5, fontSize: 14, color: text, bold: true, borderStyle: 'none', padding: 0.2, enabled: settings.showCompanyName !== false }, 'company-name'),
    node({ type: 'field', label: 'Datos de empresa', token: 'company.summary', x: 5, y: 11, width: 54, height: 10, fontSize: 6.5, lineHeight: 1.2, color: text, borderStyle: 'none', padding: 0.2 }, 'company-summary'),
    node({ type: 'field', label: 'Título del documento', token: 'document.title', x: 55, y: 22, width: 40, height: 4.8, fontSize: 10, color: primary, bold: true, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-title'),
    node({ type: 'field', label: 'Período', token: 'document.period', x: 5, y: 29.5, width: 60, height: 2.8, fontSize: 7, color: text, borderStyle: 'none', padding: 0.2 }, 'report-meta'),
    node({ type: 'field', label: 'Generado', token: 'document.generated', x: 67, y: 29.5, width: 28, height: 2.8, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-generated'),
    ...bodyNodes,
  ];
  nodes.push(
    node({ type: 'divider', label: 'Separador del pie', x: 5, y: 95.35, width: 90, height: 0.35, borderColor: line }, 'footer-divider'),
    node({ type: 'field', label: 'Pie', token: 'company.footerText', x: 8, y: 95.45, width: 62, height: 3.1, fontSize: 6.5, color: '#64748b', borderStyle: 'none', padding: 0.2 }, 'footer-contact'),
    node({ type: 'field', label: 'Página', token: 'page.number', x: 72, y: 95.45, width: 23, height: 3.1, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'footer-page'),
  );
  return {
    version: 1,
    page: base.page,
    nodes,
    metadata: { ...(base.metadata || {}), preset: 'module-standard', standardLayoutVersion: 1 },
  };
}

/**
 * Estructura inicial común para los documentos de venta: encabezado de
 * empresa/documento, tablas de cliente y documento, detalle cuadriculado,
 * totales y pie. La opción de composición solo mueve la marca dentro de este
 * patrón; el contenido y su orden se mantienen iguales en todos los tipos.
 */
function createStandardSalesReportDefinition(targetKey: string, settings: Record<string, unknown>, base: PdfTemplateDefinition): PdfTemplateDefinition {
  const primary = settingsValue(settings, 'primaryColor', '#01422c');
  const secondary = settingsValue(settings, 'secondaryColor', '#0f3b65');
  const text = settingsValue(settings, 'textColor', '#334155');
  const line = settingsValue(settings, 'lineColor', '#d7dee7');
  const logoEnabled = Boolean(settings.logoUrl);
  const isCustomerHistory = targetKey === 'ventas.customer-history';
  const isCustomers = targetKey === 'ventas.customers';
  const isCashSession = targetKey === 'ventas.cash-session';
  const isCashHistory = targetKey === 'ventas.cash-historical-report';
  const nodes: PdfTemplateNode[] = [
    node({ type: 'divider', label: 'Separador del encabezado', x: 5, y: 4, width: 90, height: 0.5, borderColor: primary }, 'header-accent'),
    node({ type: 'image', label: 'Logotipo', x: 75, y: 5.5, width: 20, height: 9, enabled: logoEnabled, borderStyle: 'none', backgroundColor: 'transparent' }, 'company-logo'),
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: 5, y: 6, width: 54, height: 5.5, fontSize: 14, color: text, bold: true, borderStyle: 'none', padding: 0.2, enabled: settings.showCompanyName !== false }, 'company-name'),
    node({ type: 'field', label: 'Datos de empresa', token: 'company.summary', x: 5, y: 11, width: 54, height: 10, fontSize: 6.5, lineHeight: 1.2, color: text, borderStyle: 'none', padding: 0.2 }, 'company-summary'),
      node({ type: 'field', label: 'Tipo de documento', token: 'document.title', x: 55, y: 22, width: 40, height: isCashHistory || isCustomerHistory || isCustomers ? 4.8 : 9, fontSize: 10, color: primary, bold: true, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-title'),
  ];

  if (isCustomerHistory) {
    const party = getPdfTemplatePartyConfig(targetKey);
    const partyToken = `${party.tokenPrefix}.`;
    nodes.push(
      node({ type: 'field', label: 'Código', token: 'document.number', x: 56, y: 27, width: 39, height: 2.8, fontSize: 8, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-number'),
      node({ type: 'field', label: 'Fecha de generación', token: 'document.date', x: 56, y: 30.2, width: 39, height: 2.8, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-date'),
      node({ type: 'field', label: 'Estado', token: 'document.status', x: 56, y: 33.4, width: 39, height: 2.8, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-status'),
      node({ type: 'field', label: '', token: `${partyToken}name`, x: 5, y: 22, width: 44, height: 4.8, fontSize: 10, color: text, bold: true, borderStyle: 'none', padding: 0 }, 'history-customer-name'),
      node({ type: 'field', label: party.labels.taxId, token: `${partyToken}taxId`, x: 5, y: 38, width: 42, height: 4, fontSize: 7.5, color: text, borderStyle: 'none' }, 'party-tax-id'),
      node({ type: 'field', label: party.labels.address, token: `${partyToken}address`, x: 50, y: 38, width: 45, height: 4, fontSize: 7, color: text, borderStyle: 'none' }, 'party-address'),
      node({ type: 'field', label: party.labels.phone, token: `${partyToken}phone`, x: 5, y: 42.5, width: 42, height: 4, fontSize: 7, color: text, borderStyle: 'none' }, 'party-phone'),
      node({ type: 'field', label: party.labels.email, token: `${partyToken}email`, x: 50, y: 42.5, width: 45, height: 4, fontSize: 6.5, color: text, borderStyle: 'none' }, 'party-email'),
      node({ type: 'field', label: party.labels.contact, token: `${partyToken}contact`, x: 5, y: 47, width: 42, height: 4, fontSize: 6.5, color: text, borderStyle: 'none' }, 'party-contact'),
      node({ type: 'field', label: 'Saldo', token: `${partyToken}balanceSummary`, x: 50, y: 47, width: 45, height: 4, fontSize: 7, color: text, borderStyle: 'none' }, 'party-balance-summary'),
    );
    const table = base.nodes.find(item => item.id === 'items-table' && item.type === 'table');
    if (table) nodes.push({ ...table, x: 5, y: 53.5, width: 90, height: 41.5, columns: defaultTableColumns(targetKey), backgroundColor: '#ffffff', borderColor: line, borderStyle: 'solid', tableHeaderColor: primary, tableHeaderTextColor: '#ffffff', tableTextColor: text, tableRowColor: '#ffffff', tableStripeColor: '#ffffff', repeatHeader: true });
  } else if (isCashSession) {
    nodes.push(
      node({ type: 'field', label: 'Caja', token: 'document.number', x: 55, y: 31.5, width: 40, height: 2.8, fontSize: 8, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-number'),
      node({ type: 'field', label: 'Apertura', token: 'document.date', x: 5, y: 35, width: 48, height: 2.8, fontSize: 7.5, color: text, borderStyle: 'none', padding: 0.2 }, 'document-date'),
      node({ type: 'field', label: 'Estado', token: 'document.status', x: 58, y: 35, width: 37, height: 2.8, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-status'),
      node({ type: 'field', label: 'Cajero', text: 'Cajero', x: 5, y: 38.5, width: 40, height: 2.6, fontSize: 5.8, color: '#64748b', bold: true, borderStyle: 'none', padding: 0.1 }, 'cashier-label'),
      node({ type: 'field', label: 'Cajero', token: 'party.name', x: 5, y: 41, width: 50, height: 3.2, fontSize: 8, color: text, bold: true, borderStyle: 'none', padding: 0.1 }, 'cashier-name'),
      node({ type: 'report-sections', label: 'Resumen y movimientos de caja', x: 5, y: 46, width: 90, height: 50, subsequentY: 8, subsequentHeight: 86, backgroundColor: '#ffffff', borderColor: line, color: text, columns: defaultTableColumns(targetKey), repeatHeader: true }, 'cash-report-sections'),
    );
  } else {
    nodes.push(
      ...(isCashHistory ? [
        node({ type: 'field', label: 'Período', token: 'document.period', x: 5, y: 29.5, width: 60, height: 2.8, fontSize: 7, color: text, borderStyle: 'none', padding: 0.2 }, 'report-meta'),
        node({ type: 'field', label: 'Generado', token: 'document.generated', x: 67, y: 29.5, width: 28, height: 2.8, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-generated'),
        node({ type: 'report-sections', label: 'Secciones del reporte', x: 5, y: 35.3, width: 90, height: 60.7, subsequentY: 23.5, subsequentHeight: 76.5, backgroundColor: '#ffffff', borderColor: line, color: text, columns: defaultTableColumns(targetKey), repeatHeader: true }, 'cash-report-sections'),
      ] : [
        node({ type: 'field', label: 'Alcance', token: 'document.period', x: 5, y: isCustomers ? 27.5 : 29.5, width: 60, height: 2.8, fontSize: 7, color: text, borderStyle: 'none', padding: 0.2 }, 'report-meta'),
        node({ type: 'field', label: 'Generado', token: 'document.generated', x: 67, y: isCustomers ? 27.5 : 29.5, width: 28, height: 2.8, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-generated'),
        ...Array.from({ length: 5 }, (_, index) => {
          const kpiWidth = (90 - 4 * 1.2) / 5;
          const x = 5 + index * (kpiWidth + 1.2);
          return [
            node({ type: 'section', label: '', x, y: isCustomers ? 31 : 33.5, width: kpiWidth, height: 12.5, backgroundColor: index % 2 ? secondary : primary, borderColor: index % 2 ? secondary : primary, borderRadius: 2, firstPageOnly: true }, `report-kpi-card-${index}`),
            node({ type: 'field', label: 'Indicador', token: `reportKpis.${index}.label`, x: x + 0.8, y: (isCustomers ? 31 : 33.5) + 0.8, width: kpiWidth - 1.6, height: 3.1, fontSize: 5, color: '#ffffff', align: 'center', borderStyle: 'none', padding: 0, firstPageOnly: true }, `report-kpi-label-${index}`),
            node({ type: 'field', label: 'Valor', token: `reportKpis.${index}.value`, x: x + 0.8, y: (isCustomers ? 31 : 33.5) + 4.2, width: kpiWidth - 1.6, height: 4, fontSize: 8.5, color: '#ffffff', bold: true, align: 'center', borderStyle: 'none', padding: 0, firstPageOnly: true }, `report-kpi-value-${index}`),
            node({ type: 'field', label: 'Detalle', token: `reportKpis.${index}.detail`, x: x + 0.8, y: (isCustomers ? 31 : 33.5) + 8.6, width: kpiWidth - 1.6, height: 2.8, fontSize: 4.8, color: '#ffffff', align: 'center', borderStyle: 'none', padding: 0, firstPageOnly: true }, `report-kpi-detail-${index}`),
          ];
        }).flat(),
        node({ type: 'report-sections', label: 'Lista de clientes', x: 5, y: 46, width: 90, height: 49, subsequentY: 8, subsequentHeight: 86, backgroundColor: 'transparent', borderColor: 'transparent', color: text, columns: defaultTableColumns(targetKey), repeatHeader: true }, 'report-sections'),
      ]),
    );
  }

  const footerNodes = base.nodes.filter(item => ['footer-divider', 'footer-contact', 'footer-page'].includes(item.id));
  nodes.push(...footerNodes);
  return {
    version: 1,
    page: base.page,
    nodes,
    metadata: { preset: 'sales-standard-report', salesLayoutVersion: salesPdfLayoutVersionForTarget(targetKey) },
  };
}

/** Estructura predeterminada de Compras; el detalle conserva las columnas propias del destino. */
function createStandardPurchaseDefinition(targetKey: string, settings: Record<string, unknown>, base: PdfTemplateDefinition): PdfTemplateDefinition {
  const primary = settingsValue(settings, 'primaryColor', '#01422c');
  const text = settingsValue(settings, 'textColor', '#334155');
  const line = settingsValue(settings, 'lineColor', '#d7dee7');
  const party = getPdfTemplatePartyConfig(targetKey);
  const isSupplierList = targetKey === 'compras.supplier';
  const isPurchaseList = targetKey === 'compras.list';
  const isSupplierHistory = targetKey === 'compras.supplier-history';
  const isList = isSupplierList || isPurchaseList;
  const hasLogo = Boolean(settings.logoUrl);
  const table = base.nodes.find(item => item.id === 'items-table' && item.type === 'table');
  const tableColumns = isSupplierHistory || targetKey === 'compras.purchase-request'
    ? defaultTableColumns(targetKey)
    : table?.columns?.length ? table.columns : defaultTableColumns(targetKey);
  const nodes: PdfTemplateNode[] = [
    node({ type: 'divider', label: 'Separador del encabezado', x: 5, y: 4, width: 90, height: 0.5, borderColor: primary }, 'header-accent'),
    node({ type: 'image', label: 'Logotipo', x: 75, y: 5.5, width: 20, height: 9, enabled: hasLogo, borderStyle: 'none', backgroundColor: 'transparent' }, 'company-logo'),
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: 5, y: 6, width: 54, height: 5.5, fontSize: 14, color: text, bold: true, borderStyle: 'none', padding: 0.2, enabled: settings.showCompanyName !== false }, 'company-name'),
    node({ type: 'field', label: 'Datos de empresa', token: 'company.summary', x: 5, y: 11, width: 54, height: 10, fontSize: 6.5, lineHeight: 1.2, color: text, borderStyle: 'none', padding: 0.2 }, 'company-summary'),
  ];

  if (isList) {
    nodes.push(
      node({ type: 'field', label: 'Título del documento', token: 'document.title', x: 55, y: 22, width: 40, height: 5.5, fontSize: 10, color: primary, bold: true, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-title'),
      node({ type: 'field', label: 'Alcance', token: 'document.meta', x: 5, y: 30, width: 60, height: 3.2, fontSize: 7.5, color: text, borderStyle: 'none', padding: 0.2 }, 'report-meta'),
      node({ type: 'field', label: 'Generado', token: 'document.generated', x: 67, y: 30, width: 28, height: 3.2, fontSize: 7, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-generated'),
    );
  } else if (isSupplierHistory) {
    const prefix = `${party.tokenPrefix}.`;
    nodes.push(
      node({ type: 'field', label: 'Historial', token: 'document.title', x: 55, y: 22, width: 40, height: 4.8, fontSize: 10, color: primary, bold: true, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-title'),
      node({ type: 'field', label: 'Código del proveedor', token: 'document.number', x: 56, y: 27, width: 39, height: 2.8, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-number'),
      node({ type: 'field', label: 'Generado', token: 'document.generated', x: 56, y: 30.2, width: 39, height: 2.8, fontSize: 7, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-generated'),
      node({ type: 'field', label: 'Detalle', token: 'document.meta', x: 56, y: 33.4, width: 39, height: 2.8, fontSize: 6.8, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'report-meta'),
      node({ type: 'field', label: '', token: `${prefix}name`, x: 5, y: 22, width: 44, height: 4.8, fontSize: 10, color: text, bold: true, borderStyle: 'none', padding: 0 }, 'party-name'),
      node({ type: 'field', label: party.labels.taxId, token: `${prefix}taxId`, x: 5, y: 38, width: 42, height: 4, fontSize: 7.5, color: text, borderStyle: 'none', padding: 0 }, 'party-tax-id'),
      node({ type: 'field', label: party.labels.address, token: `${prefix}address`, x: 50, y: 38, width: 45, height: 4, fontSize: 7, color: text, borderStyle: 'none', padding: 0 }, 'party-address'),
      node({ type: 'field', label: party.labels.phone, token: `${prefix}phone`, x: 5, y: 42.5, width: 42, height: 4, fontSize: 7, color: text, borderStyle: 'none', padding: 0 }, 'party-phone'),
      node({ type: 'field', label: party.labels.email, token: `${prefix}email`, x: 50, y: 42.5, width: 45, height: 4, fontSize: 6.5, color: text, borderStyle: 'none', padding: 0 }, 'party-email'),
      node({ type: 'field', label: party.labels.contact, token: `${prefix}contact`, x: 5, y: 47, width: 42, height: 4, fontSize: 6.5, color: text, borderStyle: 'none', padding: 0 }, 'party-contact'),
      node({ type: 'field', label: 'Saldo', token: `${prefix}balanceSummary`, x: 50, y: 47, width: 45, height: 4, fontSize: 7, color: text, borderStyle: 'none', padding: 0 }, 'party-balance-summary'),
    );
  } else {
    const prefix = `${party.tokenPrefix}.`;
    nodes.push(
      node({ type: 'field', label: 'Tipo de documento', token: 'document.title', x: 58, y: 22, width: 37, height: 5, fontSize: 10, color: primary, bold: true, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-title'),
      node({ type: 'field', label: 'Número', token: 'document.number', x: 58, y: 27, width: 37, height: 2.8, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-number'),
      node({ type: 'field', label: 'Fecha', token: 'document.date', x: 58, y: 30.5, width: 37, height: 2.8, fontSize: 7, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-date'),
      node({ type: 'field', label: 'Estado', token: 'document.status', x: 58, y: 34, width: 37, height: 2.8, fontSize: 7, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-status'),
      node({ type: 'field', label: 'Información', token: 'document.extra', x: targetKey === 'compras.purchase-request' ? 5 : 58, y: targetKey === 'compras.purchase-request' ? 49.5 : 37.5, width: targetKey === 'compras.purchase-request' ? 90 : 37, height: targetKey === 'compras.purchase-request' ? 5.5 : 5.5, fontSize: 6.8, color: text, align: targetKey === 'compras.purchase-request' ? 'left' : 'right', borderStyle: 'none', padding: 0.2 }, 'document-extra'),
      node({ type: 'section', label: party.sectionLabel, x: 5, y: 22, width: 90, height: 19, backgroundColor: '#ffffff', borderColor: line, borderStyle: 'none', color: text }, 'party-section'),
      node({ type: 'field', label: party.nameLabel, token: `${prefix}name`, x: 5, y: 23, width: 44, height: 4.5, fontSize: 9, color: text, bold: true, borderStyle: 'none', padding: 0 }, 'party-name'),
      node({ type: 'field', label: party.labels.taxId, token: `${prefix}taxId`, x: 5, y: 28, width: 44, height: 4.2, fontSize: 7.3, color: text, borderStyle: 'none', padding: 0 }, 'party-tax-id'),
      node({ type: 'field', label: party.labels.address, token: `${prefix}address`, x: 5, y: 32.2, width: 44, height: 4.2, fontSize: 7.1, color: text, borderStyle: 'none', padding: 0 }, 'party-address'),
      node({ type: 'field', label: party.labels.phone, token: `${prefix}phone`, x: 5, y: 36.4, width: 44, height: 4.2, fontSize: 7, color: text, borderStyle: 'none', padding: 0 }, 'party-phone'),
      node({ type: 'field', label: party.labels.email, token: `${prefix}email`, x: 5, y: 40.6, width: 44, height: 4.2, fontSize: 6.8, color: text, borderStyle: 'none', padding: 0 }, 'party-email'),
      node({ type: 'field', label: party.labels.contact, token: `${prefix}contact`, x: 5, y: 44.8, width: 44, height: 4.2, fontSize: 6.8, color: text, borderStyle: 'none', padding: 0 }, 'party-contact'),
    );
  }

  if (table) {
    nodes.push({
      ...table,
      x: 5,
      y: isList ? 27.5 : isSupplierHistory ? 53.5 : targetKey === 'compras.purchase-request' ? 57 : 54,
      width: 90,
      height: isList ? 62 : isSupplierHistory ? 41.5 : targetKey === 'compras.purchase-request' ? 37 : 40,
      label: isSupplierHistory ? 'Historial de compras' : isList ? 'Registros' : 'Detalle',
      columns: tableColumns,
      backgroundColor: '#ffffff',
      borderColor: line,
      borderStyle: 'solid',
      tableHeaderColor: primary,
      tableHeaderTextColor: '#ffffff',
      tableTextColor: text,
      tableRowColor: '#ffffff',
      tableStripeColor: '#ffffff',
      repeatHeader: true,
    });
  }

  if (!isList && !isSupplierHistory) {
    nodes.push(node({ type: 'totals', label: 'Totales', x: 55, y: 80, width: 40, height: 13, fontSize: 8, color: text, backgroundColor: 'transparent', borderColor: 'transparent', borderStyle: 'none' }, 'totals'));
  }

  nodes.push(
    node({ type: 'divider', label: 'Separador del pie', x: 5, y: 95.35, width: 90, height: 0.35, borderColor: line }, 'footer-divider'),
    node({ type: 'field', label: 'Pie', token: 'company.footerText', x: 8, y: 95.45, width: 62, height: 3.1, fontSize: 6.5, color: '#64748b', borderStyle: 'none', padding: 0.2 }, 'footer-contact'),
    node({ type: 'field', label: 'Página', token: 'page.number', x: 72, y: 95.45, width: 23, height: 3.1, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'footer-page'),
  );

  return {
    version: 1,
    page: { paperSize: settingsValue(settings, 'paperSize', 'LETTER'), orientation: settings.orientation === 'landscape' ? 'landscape' : 'portrait', background: settingsValue(settings, 'backgroundColor', '#ffffff') },
    nodes,
    metadata: { preset: 'purchase-standard', purchaseLayoutVersion: PURCHASE_PDF_LAYOUT_VERSION },
  };
}

export function createDefaultTemplateDefinition(targetKey: string, requestedSettings?: Record<string, unknown>): PdfTemplateDefinition {
  const target = getPdfTemplateTarget(targetKey);
  if (!isStandardPdfLayoutTarget(target.key)) return createBaseTemplateDefinition(target.key, requestedSettings);

  const settings = normalizePdfPaperSettings(target.key, applyStandardPdfLayoutSettings(target.key, requestedSettings || {}));
  const base = createBaseTemplateDefinition(target.key, settings);
  if (isPurchasePdfLayoutTarget(target.key)) return createStandardPurchaseDefinition(target.key, settings, base);
  if (['ventas.cash-session', 'ventas.cash-historical-report', 'ventas.customer-history', 'ventas.customers'].includes(target.key)) {
    return createStandardSalesReportDefinition(target.key, settings, base);
  }
  if (!isSalesPdfLayoutTarget(target.key)) return createStandardModuleDefinition(target.key, settings, base);
  const party = getPdfTemplatePartyConfig(target.key);
  const primary = settingsValue(settings, 'primaryColor', '#01422c');
  const text = settingsValue(settings, 'textColor', '#334155');
  const line = settingsValue(settings, 'lineColor', '#d7dee7');
  const table = base.nodes.find(item => item.id === 'items-table' && item.type === 'table');
  const columns = target.key === 'ventas.payment'
    ? [
      { id: 'description', label: 'Método', token: 'description', width: 32, align: 'left' as const },
      { id: 'quantity', label: 'Moneda', token: 'quantity', width: 18, align: 'center' as const },
      { id: 'unitPrice', label: 'Monto', token: 'unitPrice', width: 25, align: 'right' as const },
      { id: 'total', label: 'Total', token: 'total', width: 25, align: 'right' as const },
    ]
    : table?.columns?.length ? table.columns : defaultTableColumns(target.key);
  const hasLogo = Boolean(settings.logoUrl);
  const nodes: PdfTemplateNode[] = [
    node({ type: 'divider', label: 'Separador del encabezado', x: 5, y: 4, width: 90, height: 0.5, borderColor: primary }, 'header-accent'),
    node({ type: 'image', label: 'Logotipo', x: 75, y: 5.5, width: 20, height: 9, enabled: hasLogo, borderStyle: 'none', backgroundColor: 'transparent' }, 'company-logo'),
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: 5, y: 6, width: 54, height: 5.5, fontSize: 14, color: text, bold: true, borderStyle: 'none', padding: 0.2, enabled: settings.showCompanyName !== false }, 'company-name'),
    node({ type: 'field', label: 'Datos de empresa', token: 'company.summary', x: 5, y: 11, width: 54, height: 10, fontSize: 6.5, lineHeight: 1.2, color: text, borderStyle: 'none', padding: 0.2 }, 'company-summary'),
    node({ type: 'field', label: 'Tipo de documento', token: 'document.title', x: 66, y: 20.2, width: 29, height: 4.8, fontSize: 11, color: primary, bold: true, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-title'),
    node({ type: 'field', label: 'Número', token: 'document.number', x: 66, y: 25, width: 29, height: 3, fontSize: 8, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-number'),
    node({ type: 'field', label: 'Fecha', token: 'document.date', x: 5, y: 29, width: 36, height: 2.5, fontSize: 7.5, color: text, borderStyle: 'none', padding: 0.2 }, 'document-date'),
    node({ type: 'field', label: 'Estado', token: 'document.status', x: 58, y: 29, width: 37, height: 2.5, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-status'),
    node({ type: 'field', label: 'Información adicional', token: 'document.extra', x: 58, y: 32, width: 37, height: 6, fontSize: 6.8, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-extra'),
  ];

  if (party.mode !== 'none') {
    const partyToken = `${party.tokenPrefix}.`;
    nodes.push(
      node({ type: 'section', label: party.sectionLabel, x: 5, y: 22, width: 90, height: 18, backgroundColor: '#ffffff', borderColor: line, borderStyle: 'solid', color: text }, 'party-section'),
      node({ type: 'field', label: party.nameLabel, token: `${partyToken}name`, x: 8, y: 35, width: 44, height: 5, fontSize: 8, color: text, bold: true, borderStyle: 'none' }, 'party-name'),
      node({ type: 'field', label: party.labels.taxId, token: `${partyToken}taxId`, x: 54, y: 35, width: 38, height: 5, fontSize: 7.5, color: text, align: 'right', borderStyle: 'none' }, 'party-tax-id'),
      node({ type: 'field', label: party.labels.address, token: `${partyToken}address`, x: 8, y: 41, width: 44, height: 4.5, fontSize: 7, color: text, borderStyle: 'none' }, 'party-address'),
      node({ type: 'field', label: party.labels.phone, token: `${partyToken}phone`, x: 54, y: 41, width: 38, height: 4.5, fontSize: 7, color: text, align: 'right', borderStyle: 'none' }, 'party-phone'),
      node({ type: 'field', label: party.labels.email, token: `${partyToken}email`, x: 8, y: 46, width: 44, height: 4, fontSize: 6.5, color: text, borderStyle: 'none' }, 'party-email'),
      node({ type: 'field', label: party.labels.contact, token: `${partyToken}contact`, x: 54, y: 46, width: 38, height: 4, fontSize: 6.5, color: text, align: 'right', borderStyle: 'none' }, 'party-contact'),
    );
  }

  if (table) {
    nodes.push({
      ...table,
      x: 5, y: 55, width: 90, height: 39,
      label: target.key === 'ventas.payment' ? 'Detalle de pagos' : 'Detalle de productos y servicios',
      columns,
      backgroundColor: '#ffffff', borderColor: line, borderStyle: 'solid',
      tableHeaderColor: primary, tableHeaderTextColor: '#ffffff', tableTextColor: text,
      tableRowColor: '#ffffff', tableStripeColor: '#ffffff',
      repeatHeader: true,
    });
  }

  nodes.push(node({ type: 'totals', label: 'Totales', x: 55, y: 80, width: 40, height: 13, fontSize: 8, color: text, backgroundColor: 'transparent', borderColor: 'transparent', borderStyle: 'none' }, 'totals'));
  // En pagos recibidos, las notas son el método y referencia de liquidación;
  // para los demás documentos las notas del diseño ya se habían retirado.
  if (target.key === 'ventas.payment') {
    nodes.push(node({ type: 'field', label: 'Detalles del pago', token: 'document.notes', x: 8, y: 80, width: 44, height: 13, fontSize: 7, color: text, borderStyle: 'none' }, 'payment-details'));
  }
  nodes.push(
    node({ type: 'divider', label: 'Separador del pie', x: 5, y: 95.35, width: 90, height: 0.35, borderColor: line }, 'footer-divider'),
    node({ type: 'field', label: 'Pie', token: 'company.footerText', x: 8, y: 95.45, width: 62, height: 3.1, fontSize: 6.5, color: '#64748b', borderStyle: 'none', padding: 0.2 }, 'footer-contact'),
    node({ type: 'field', label: 'Página', token: 'page.number', x: 72, y: 95.45, width: 23, height: 3.1, fontSize: 6.5, color: '#64748b', align: 'right', borderStyle: 'none', padding: 0.2 }, 'footer-page'),
  );

  return {
    version: 1,
    page: base.page,
    nodes,
    metadata: { preset: 'sales-standard', salesLayoutVersion: SALES_PDF_LAYOUT_VERSION },
  };
}

/** Añade las gráficas estándar a definiciones de dashboard antiguas que aún no tenían nodos de gráfica. */
export function ensureDashboardChartNodes(definition: PdfTemplateDefinition, targetKey: string, settings?: Record<string, unknown>) {
  if (getPdfTemplateTarget(targetKey).structure !== 'dashboard' || definition.nodes.some(item => item.type === 'chart')) return definition;
  const chartNodes = createDefaultTemplateDefinition(targetKey, settings).nodes.filter(item => item.type === 'chart');
  return { ...definition, nodes: [...definition.nodes, ...chartNodes] };
}

/**
 * Registro virtual del predeterminado nativo para una salida concreta.
 *
 * No se guarda en PostgreSQL: los diseños personalizados siguen siendo la
 * única escritura por sucursal. Esto permite que cada una empiece con la
 * composición anterior del ERP y que el mismo contrato sirva para todos los
 * documentos, aunque tengan estructuras distintas (tabla, historial o
 * comprobante).
 */
export function createSystemDefaultPdfDesign(targetKey: string, overrides?: Record<string, unknown>) {
  const target = getPdfTemplateTarget(targetKey);
  const initialSettings = createSystemDefaultPdfSettings({
    ...(target.key === 'inventario.product-labels' ? { paperSize: 'LABEL', orientation: 'landscape', margins: 2, fontFamily: 'helvetica', fontSize: 8 } : {}),
    ...(['ventas.cash-historical-report', 'ventas.customers', 'compras.supplier-history'].includes(target.key) ? { paperSize: 'LETTER', orientation: 'landscape', fontSize: 9 } : {}),
    ...(target.family === 'cash-ticket' ? { paperSize: 'ROLL-80', orientation: 'portrait', margins: 3, fontFamily: 'helvetica', fontSize: 8, primaryColor: '#000000', secondaryColor: '#000000', textColor: '#000000', lineColor: '#000000' } : {}),
    ...(overrides || {}),
  });
  const settings = normalizePdfPaperSettings(target.key, applyStandardPdfLayoutSettings(target.key, initialSettings));
  const defaultDefinition = createDefaultTemplateDefinition(target.key, settings);
  return {
    id: `system-default:${target.key}`,
    clientTenantId: undefined,
    name: `Predeterminado del ERP · ${target.label}`,
    description: 'Diseño nativo de NovaHub. Se puede personalizar y guardar para esta sucursal.',
    templateKey: 'system-default',
    documentTypes: [target.key],
    folderId: null,
    folder: null,
    settings,
    sourceType: 'SYSTEM' as const,
    sourceFileUrl: null,
    sourceFileName: null,
    analysisStatus: 'NOT_APPLICABLE',
    layoutZones: {
      status: 'system-default',
      definition: {
        ...defaultDefinition,
        metadata: { ...(defaultDefinition.metadata || {}), preset: 'system-default' },
      },
      fields: [],
    },
    engine: 'HTML_TEMPLATE',
    isActive: true,
    isSystemDefault: true,
  };
}

function safeNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' ? value.slice(0, 500) : fallback;
}

function safeColorMap(value: unknown) {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 24)
    .map(([key, color]) => [key.slice(0, 80), safeText(color, '')] as const)
    .filter(([, color]) => Boolean(color));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function safeReportSectionStyles(value: unknown): Record<string, PdfTemplateReportSectionStyle> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries: Array<[string, PdfTemplateReportSectionStyle]> = [];
  for (const [key, rawStyle] of Object.entries(value as Record<string, unknown>).slice(0, 120)) {
    if (!rawStyle || typeof rawStyle !== 'object' || Array.isArray(rawStyle)) continue;
    const style = rawStyle as Record<string, unknown>;
    entries.push([key.slice(0, 80), {
        headerColor: safeText(style.headerColor, ''),
        headerTextColor: safeText(style.headerTextColor, ''),
        rowTextColor: safeText(style.rowTextColor, ''),
        rowColor: safeText(style.rowColor, ''),
        stripeColor: safeText(style.stripeColor, ''),
        columnColors: safeColorMap(style.columnColors),
        columnTextColors: safeColorMap(style.columnTextColors),
    }]);
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function upgradeReportTemplateNodes(nodes: PdfTemplateNode[], targetKey: string, settings?: Record<string, unknown>) {
  const normalizedTarget = getPdfTemplateTarget(targetKey).key;
  if (normalizedTarget === 'ventas.cash-historical-report') {
    const fallback = createDefaultTemplateDefinition(normalizedTarget, settings);
    const fallbackReportNode = fallback.nodes.find(item => item.id === 'cash-report-sections' || item.type === 'report-sections');
    if (!fallbackReportNode) return nodes;
    const existingReportNode = nodes.find(item => item.type === 'report-sections');
    const existingTable = nodes.find(item => item.type === 'table');
    const sourceReportNode = existingReportNode || existingTable;
    const reportNode: PdfTemplateNode = {
      ...fallbackReportNode,
      ...(sourceReportNode || {}),
      id: existingReportNode?.id || fallbackReportNode.id,
      type: 'report-sections',
      label: sourceReportNode?.label || 'Secciones del reporte',
      x: sourceReportNode?.x ?? fallbackReportNode.x,
      y: sourceReportNode?.y ?? fallbackReportNode.y,
      width: sourceReportNode?.width ?? fallbackReportNode.width,
      height: Math.max(Number(sourceReportNode?.height) || 0, fallbackReportNode.height),
      subsequentY: fallbackReportNode.subsequentY,
      subsequentHeight: fallbackReportNode.subsequentHeight,
      columns: sourceReportNode?.columns?.length ? sourceReportNode.columns : fallbackReportNode.columns,
    };
    const generatedNode = nodes.find(item => item.id === 'document-generated')
      || fallback.nodes.find(item => item.id === 'document-generated');
    const preservedNodes = nodes
      .filter(item => item.id !== existingTable?.id && item.id !== existingReportNode?.id)
      .filter(item => !['document-number', 'document-status'].includes(item.id))
      .map(item => item.id === 'document-date'
        ? { ...item, label: 'Período', token: 'document.period', x: 8, y: 24, width: 48, height: 4 }
        : item);
    return [...preservedNodes, ...(generatedNode ? [generatedNode] : []), reportNode];
  }
  if (getPdfTemplateTarget(targetKey).module !== 'reportes') return nodes;
  const fallback = createDefaultTemplateDefinition(targetKey, settings);
  const reportKpiCount = ['reportes.hr', 'reportes.finance', 'reportes.sales'].includes(normalizedTarget) ? 5 : 4;
  const fallbackKpiNodes = fallback.nodes.filter(item => item.id.startsWith('report-kpi-'));
  const existingKpiCards = nodes.filter(item => /^report-kpi-card-[0-4]$/.test(item.id));
  const hasLegacyFiveKpiLayout = reportKpiCount === 5
    && existingKpiCards.length === 5
    && existingKpiCards.every(item => Math.abs((Number(item.y) || 0) - 30) < 0.5);
  const normalizedReportNodes = hasLegacyFiveKpiLayout
    ? nodes.map(item => {
      const fallbackNode = fallbackKpiNodes.find(candidate => candidate.id === item.id);
      return fallbackNode
        ? { ...item, x: fallbackNode.x, y: fallbackNode.y, width: fallbackNode.width, height: fallbackNode.height }
        : item;
    })
    : nodes;
  const fallbackReportNode = fallback.nodes.find(item => item.id === 'report-sections');
  const alignedReportNodes = hasLegacyFiveKpiLayout && fallbackReportNode
    ? normalizedReportNodes.map(item => item.id === 'report-sections'
      ? { ...item, x: fallbackReportNode.x, y: fallbackReportNode.y, width: fallbackReportNode.width, height: fallbackReportNode.height }
      : item)
    : normalizedReportNodes;
  const companySummaryNode = alignedReportNodes.find(item => item.id === 'company-summary') || fallback.nodes.find(item => item.id === 'company-summary');
  if (alignedReportNodes.some(item => item.type === 'report-sections')) {
    return alignedReportNodes.some(item => item.id === 'company-summary') || !companySummaryNode ? alignedReportNodes : [...alignedReportNodes, companySummaryNode];
  }
  const reportKpiNodes = fallbackKpiNodes;
  const reportMetaNode = fallback.nodes.find(item => item.id === 'report-meta');
  const previousTable = alignedReportNodes.find(item => item.type === 'table');
  const reportNode = fallbackReportNode;
  if (!reportNode || !reportMetaNode) return nodes;
  const migratedReportNode: PdfTemplateNode = {
    ...reportNode,
    ...(previousTable || {}),
    id: 'report-sections',
    type: 'report-sections',
    label: 'Secciones del reporte',
    x: previousTable?.x ?? reportNode.x,
    y: reportNode.y,
    width: previousTable?.width ?? reportNode.width,
    height: reportNode.height,
    subsequentY: 31,
    subsequentHeight: 63,
    columns: reportNode.columns,
  };
  return [
    ...alignedReportNodes.filter(item => item.type !== 'table' && !item.id.startsWith('report-kpi-') && !['company-summary', 'document-number', 'document-status', 'document-date', 'report-meta'].includes(item.id)),
    ...reportKpiNodes,
    ...(companySummaryNode ? [companySummaryNode] : []),
    reportMetaNode,
    migratedReportNode,
  ];
}

export function sanitizeTemplateDefinition(value: unknown, targetKey: string, settings?: Record<string, unknown>): PdfTemplateDefinition {
  const normalizedSettings = normalizePdfPaperSettings(targetKey, settings);
  const fallback = createDefaultTemplateDefinition(targetKey, normalizedSettings);
  const party = getPdfTemplatePartyConfig(targetKey);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<PdfTemplateDefinition>;
  if (!Array.isArray(candidate.nodes)) return fallback;
  const nodes = candidate.nodes.slice(0, 120).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<PdfTemplateNode>;
    const type: PdfTemplateNodeType = ['section', 'text', 'field', 'table', 'report-sections', 'chart', 'totals', 'image', 'barcode', 'divider', 'spacer'].includes(String(item.type))
      ? item.type as PdfTemplateNodeType
      : 'text';
    const sanitizedNode = {
      ...node({
        type,
        label: safeText(item.label, `Elemento ${index + 1}`),
        x: safeNumber(item.x, 5), y: safeNumber(item.y, 5), width: safeNumber(item.width, 30), height: safeNumber(item.height, 5),
        page: Math.max(1, Math.floor(Number(item.page) || 1)), enabled: item.enabled !== false,
        text: safeText(item.text, ''), token: safeText(item.token, ''), sample: safeText(item.sample, ''),
        fontSize: Math.max(5, Math.min(72, Number(item.fontSize) || 9)), fontFamily: safeText(item.fontFamily, ''),
        fontWeight: [400, 500, 600, 700, 800].includes(Number(item.fontWeight)) ? Number(item.fontWeight) as PdfTemplateNode['fontWeight'] : undefined,
        color: safeText(item.color, '#334155'),
        backgroundColor: safeText(item.backgroundColor, 'transparent'), borderColor: safeText(item.borderColor, type === 'table' || type === 'report-sections' ? '#e2e8f0' : 'transparent'),
        borderStyle: item.borderStyle === 'solid' || item.borderStyle === 'dashed' || item.borderStyle === 'dotted' || item.borderStyle === 'double' || item.borderStyle === 'none' ? item.borderStyle : defaultBorderStyle(type),
        borderRadius: Math.max(0, Math.min(999, Number(item.borderRadius) || 0)), shape: item.shape === 'pill' || item.shape === 'wave' || item.shape === 'wave-bottom' || item.shape === 'circle' || item.shape === 'angled' || item.shape === 'blob' || item.shape === 'arc' ? item.shape : 'rectangle',
        rotation: Number.isFinite(Number(item.rotation)) ? Math.max(-180, Math.min(180, Number(item.rotation))) : 0, bold: Boolean(item.bold), italic: Boolean(item.italic),
        clipPath: /^[a-z0-9%(),.\s/-]+$/i.test(String(item.clipPath || '')) ? String(item.clipPath) : undefined,
        opacity: Number.isFinite(Number(item.opacity)) ? Math.max(0, Math.min(1, Number(item.opacity))) : undefined,
        underline: Boolean(item.underline), strikethrough: Boolean(item.strikethrough), lineHeight: Math.max(0.8, Math.min(3, Number(item.lineHeight) || 1.25)),
        letterSpacing: Math.max(-2, Math.min(10, Number(item.letterSpacing) || 0)), textTransform: item.textTransform === 'uppercase' || item.textTransform === 'lowercase' || item.textTransform === 'capitalize' ? item.textTransform : 'none',
        align: item.align === 'center' || item.align === 'right' ? item.align : 'left', padding: Number.isFinite(Number(item.padding)) ? Math.max(0, Math.min(12, Number(item.padding))) : 1.5,
        columns: Array.isArray(item.columns) ? item.columns.slice(0, 12).map((column, columnIndex) => ({
          id: safeText(column?.id, `column-${columnIndex}`), label: safeText(column?.label, `Columna ${columnIndex + 1}`),
          token: safeText(column?.token, 'description'), width: Math.max(1, Math.min(100, Number(column?.width) || 25)),
          align: column?.align === 'center' || column?.align === 'right' ? column.align : 'left',
          backgroundColor: safeText(column?.backgroundColor, ''), color: safeText(column?.color, ''),
        })) : undefined,
        chartType: item.chartType === 'area' || item.chartType === 'donut' ? item.chartType : type === 'chart' ? 'bar' : undefined,
        tableHeaderColor: safeText(item.tableHeaderColor, ''), tableHeaderTextColor: safeText(item.tableHeaderTextColor, ''),tableTextColor: safeText(item.tableTextColor, ''),
        tableRowColor: safeText(item.tableRowColor, ''), tableStripeColor: safeText(item.tableStripeColor, ''),
        reportSectionVisibility: item.reportSectionVisibility && typeof item.reportSectionVisibility === 'object'
          ? Object.fromEntries(Object.entries(item.reportSectionVisibility as Record<string, unknown>).slice(0, 120).map(([key, visible]) => [key.slice(0, 80), Boolean(visible)]))
          : undefined,
        reportSectionStyles: safeReportSectionStyles(item.reportSectionStyles),
        repeatHeader: item.repeatHeader !== false,
        firstPageOnly: Boolean(item.firstPageOnly),
        subsequentY: Number.isFinite(Number(item.subsequentY)) ? safeNumber(item.subsequentY, 31) : undefined,
        subsequentHeight: Number.isFinite(Number(item.subsequentHeight)) ? safeNumber(item.subsequentHeight, 63) : undefined,
      }, safeText(item.id, `node-${index + 1}`)),
    };
    // Diseños guardados antes de la escala tipográfica pueden conservar una
    // caja de sucursal de 3–5% de alto. Al aumentar la lectura, esa caja
    // recorta la segunda línea del resumen fiscal aunque el preset nuevo ya
    // tenga dimensiones correctas. Normalizamos solo este nodo semántico;
    // los demás tamaños siguen siendo editables por el usuario.
    if (targetKey === 'ventas.cash-ticket' || getPdfTemplateTarget(targetKey).family === 'cash-ticket') {
      if (sanitizedNode.type === 'table' || sanitizedNode.id === 'items-table') {
        return [{
          ...sanitizedNode,
          y: Math.min(sanitizedNode.y, 27.5),
          columns: [
            { id: 'description', label: 'Descripción', token: 'description', width: 35, align: 'left' as const },
            { id: 'quantity', label: 'Cant.', token: 'quantity', width: 15, align: 'right' as const },
            { id: 'unitPrice', label: 'Precio', token: 'unitPrice', width: 24, align: 'right' as const },
            { id: 'total', label: 'Total', token: 'total', width: 26, align: 'right' as const },
          ],
        }];
      }
      if (sanitizedNode.type === 'totals' || sanitizedNode.id === 'totals') {
        return [{
          ...sanitizedNode,
          y: 79.5,
          height: 14,
        }];
      }
      if (sanitizedNode.id === 'ticket-payment') {
        return [{
          ...sanitizedNode,
          y: 94,
          height: 3.5,
        }];
      }
      if (sanitizedNode.id === 'ticket-footer') {
        return [{
          ...sanitizedNode,
          y: 97.5,
          height: 2,
        }];
      }
    }
    if (/^report-kpi-label-\d+$/.test(sanitizedNode.id)) {
      return [{
        ...sanitizedNode,
        height: Math.max(sanitizedNode.height, 3.2),
        align: 'center' as const,
        lineHeight: Math.min(sanitizedNode.lineHeight || 1.25, 1.05),
      }];
    }
    if (sanitizedNode.id === 'company-summary') {
      return [{
        ...sanitizedNode,
        y: Math.min(sanitizedNode.y, 16),
        height: Math.max(sanitizedNode.height, 7),
        lineHeight: Math.min(sanitizedNode.lineHeight || 1.25, 1.15),
      }];
    }
    return [sanitizedNode];
  });
  const partyNodeIds = new Set(['party-section', 'party-name', 'party-tax-id', 'party-address', 'party-phone', 'party-email', 'party-contact', 'party-balance-due', 'party-balance-favor', 'party-balance-summary']);
  const partyLabels: Record<string, string> = {
    'party-section': party.sectionLabel,
    'party-name': party.nameLabel,
    'party-tax-id': party.labels.taxId,
    'party-address': party.labels.address,
    'party-phone': party.labels.phone,
    'party-email': party.labels.email,
    'party-contact': party.labels.contact,
    'party-balance-due': 'Saldo en contra',
    'party-balance-favor': 'Saldo a favor',
    'party-balance-summary': 'Saldo',
  };
  const normalizedNodes = nodes
    .filter(item => party.mode !== 'none' || (!partyNodeIds.has(item.id) && !String(item.token || '').startsWith('party.')))
    .map(item => {
      const hasPartyToken = item.type === 'field' && String(item.token || '').startsWith('party.');
      if ((!partyNodeIds.has(item.id) && !hasPartyToken) || party.mode === 'none') return item;
      const suffix = partyNodeIds.has(item.id)
        ? item.id.replace(/^party-/, '')
        : String(item.token || '').replace(/^party\./, '');
      const tokenSuffix = suffix === 'name' ? 'name' : suffix === 'tax-id' ? 'taxId' : suffix === 'address' ? 'address' : suffix === 'phone' ? 'phone' : suffix === 'email' ? 'email' : suffix === 'balance-due' ? 'balanceDue' : suffix === 'balance-favor' ? 'balanceFavor' : suffix === 'balance-summary' ? 'balanceSummary' : 'contact';
      const tokenLabels: Record<string, string> = {
        name: party.nameLabel,
        taxId: party.labels.taxId,
        address: party.labels.address,
        phone: party.labels.phone,
        email: party.labels.email,
        contact: party.labels.contact,
        balanceDue: 'Saldo en contra',
        balanceFavor: 'Saldo a favor',
        balanceSummary: 'Saldo',
      };
      return {
        ...item,
        label: partyLabels[item.id] || tokenLabels[tokenSuffix] || item.label,
        token: item.type === 'field' ? `${party.tokenPrefix}.${tokenSuffix}` : item.token,
      };
    });
  const normalizedPaper = normalizePdfPaperSettings(targetKey, {
    paperSize: safeText(candidate.page?.paperSize, fallback.page.paperSize),
    orientation: candidate.page?.orientation === 'landscape' ? 'landscape' : fallback.page.orientation,
  });
  return {
    version: 1,
    page: {
      paperSize: normalizedPaper.paperSize as string,
      orientation: normalizedPaper.orientation as 'portrait' | 'landscape',
      background: safeText(candidate.page?.background, fallback.page.background),
    },
    nodes: upgradeReportTemplateNodes(normalizedNodes.length ? normalizedNodes : fallback.nodes, targetKey, settings),
    metadata: candidate.metadata,
  };
}

export function getTemplateTokenSample(token?: string, fallback = '') {
  return TEMPLATE_TOKENS.find(item => item.token === token)?.sample || fallback || `{{${token || 'campo'}}}`;
}

function readPath(data: unknown, path: string) {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, data);
}

export function resolveTemplateToken(token: string | undefined, data: PdfTemplateData, fallback = ''): string {
  if (!token) return fallback;
  if (token === 'company.summary') {
    const company = data.company || {};
    const readCompanyValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';
    const contactLine = [company.fiscalInfo, company.phone, company.email, company.website]
      .map(readCompanyValue)
      .filter(Boolean)
      .join(' · ');
    const summary = [readCompanyValue(company.slogan), readCompanyValue(company.address), contactLine]
      .filter(Boolean)
      .join('\n');
    return summary || fallback;
  }
  let value = readPath(data, token);
  const partyToken = /^(party|customer|supplier)\.(.+)$/.exec(token);
  if (partyToken) {
    const [, prefix, path] = partyToken;
    const sources = prefix === 'party'
      ? [data.party, data.customer, data.supplier]
      : prefix === 'customer'
        ? [data.customer, data.party]
        : [data.supplier, data.party];
    for (const source of sources) {
      const candidate = readPath(source, path);
      if (candidate !== null && candidate !== undefined && String(candidate).trim()) {
        value = candidate;
        break;
      }
    }
  }
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return value.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(value);
}

export function definitionFromExtractedPdf(layout: { pages?: Array<{ width?: number; height?: number; items?: Array<{ text?: string; x?: number; y?: number; width?: number; height?: number }>; textItems?: Array<{ text?: string; x?: number; y?: number; width?: number; height?: number }> }> }, targetKey: string, settings?: Record<string, unknown>) {
  const definition = createDefaultTemplateDefinition(targetKey, settings);
  const firstPage = layout.pages?.[0];
  const pageWidth = Number(firstPage?.width) || 216;
  const pageHeight = Number(firstPage?.height) || 279;
  const extracted = (firstPage?.items || firstPage?.textItems || []).filter(item => item.text?.trim()).slice(0, 36);
  if (!extracted.length) return { ...definition, metadata: { importedFrom: 'pdf' as const, importWarnings: ['No se encontró texto seleccionable; el PDF queda como referencia visual.'] } };
  const importedNodes = extracted.map((item, index) => node({
    type: 'text', label: `Texto importado ${index + 1}`, text: item.text?.trim() || '',
    x: safeNumber((Number(item.x) / pageWidth) * 100, 8), y: safeNumber((Number(item.y) / pageHeight) * 100, 8 + index * 3), width: Math.max(4, safeNumber((Number(item.width) / pageWidth) * 100, 80)), height: Math.max(2, safeNumber((Number(item.height) / pageHeight) * 100, 3)),
    fontSize: Math.max(6, Math.min(18, Number(item.height) || 9)), color: '#334155',
  }, `imported-text-${index + 1}`));
  return {
    ...definition,
    nodes: [...definition.nodes.filter(item => ['header', 'company-name', 'document-title', 'document-number', 'footer-divider', 'footer-contact', 'footer-page'].includes(item.id)), ...importedNodes],
    metadata: { importedFrom: 'pdf' as const, importWarnings: ['El PDF se convirtió a elementos editables de texto. Fondos, imágenes y tipografías complejas deben revisarse en el canvas.'] },
  };
}

export function definitionFromHtml(html: string, targetKey: string, settings?: Record<string, unknown>, importedFrom: 'html' | 'docx' = 'html') {
  const definition = createDefaultTemplateDefinition(targetKey, settings);
  if (typeof DOMParser === 'undefined') return definition;
  const document = new DOMParser().parseFromString(html, 'text/html');
  const body = document.body;
  const pageElement = body.querySelector('[data-novahub-page]');
  const pagePaperSize = pageElement?.getAttribute('data-novahub-paper-size') || pageElement?.getAttribute('data-paper-size');
  const pageOrientation = pageElement?.getAttribute('data-novahub-orientation');
  const pageBackground = pageElement?.getAttribute('data-novahub-background') || (pageElement ? getStyle(pageElement, 'background-color') : '');

  const explicitElements = Array.from(body.querySelectorAll('[data-novahub-type], table, [data-novahub-bind]')).slice(0, 120);
  if (explicitElements.some(element => element.hasAttribute('data-novahub-type'))) {
    const parsed = explicitElements.flatMap((element, index) => htmlElementToNode(element, index));
    const importedPage = normalizePdfPaperSettings(targetKey, {
      paperSize: pagePaperSize || definition.page.paperSize,
      orientation: pageOrientation === 'landscape' ? 'landscape' : pageOrientation === 'portrait' ? 'portrait' : definition.page.orientation,
    });
    return {
      ...definition,
      page: {
        ...definition.page,
        paperSize: importedPage.paperSize as string,
        orientation: importedPage.orientation as 'portrait' | 'landscape',
        background: pageBackground || definition.page.background,
      },
      nodes: parsed.length ? parsed : definition.nodes,
      metadata: { importedFrom, importWarnings: ['Se conservaron las posiciones, tipografías, colores y formas declaradas mediante atributos data-novahub.'] },
    };
  }

  const parsed: PdfTemplateNode[] = [];
  const elements = Array.from(body.querySelectorAll('h1,h2,h3,p,div,table,img,[data-novahub-bind]')).slice(0, 80);
  let cursorY = 25;
  elements.forEach((element, index) => {
    if (element.tagName.toLowerCase() === 'table') {
      const columns = Array.from(element.querySelectorAll('thead th')).map((th, columnIndex) => ({ id: `column-${columnIndex}`, label: th.textContent?.trim() || `Columna ${columnIndex + 1}`, token: `column-${columnIndex}`, width: 100 / Math.max(1, element.querySelectorAll('thead th').length) }));
      parsed.push(node({ type: 'table', label: 'Tabla importada', x: 5, y: cursorY, width: 90, height: 22, columns: columns.length ? columns : undefined, backgroundColor: '#ffffff', borderColor: '#e2e8f0' }, `imported-table-${index}`));
      cursorY += 25;
      return;
    }
    const textContent = element.textContent?.trim();
    if (!textContent || element.querySelector('table')) return;
    const binding = element.getAttribute('data-novahub-bind') || textContent.match(/^\{\{\s*([^}]+)\s*\}\}$/)?.[1];
    parsed.push(node({ type: binding ? 'field' : 'text', label: binding ? `Campo ${binding}` : 'Texto importado', token: binding || undefined, text: binding ? undefined : textContent, x: 8, y: cursorY, width: 84, height: element.tagName.toLowerCase().startsWith('h') ? 7 : 5, fontSize: element.tagName.toLowerCase() === 'h1' ? 16 : element.tagName.toLowerCase().startsWith('h') ? 12 : 9, color: '#334155', bold: element.tagName.toLowerCase().startsWith('h') }, `imported-element-${index}`));
    cursorY += element.tagName.toLowerCase().startsWith('h') ? 9 : 6;
  });
  return {
    ...definition,
    nodes: parsed.length ? parsed : definition.nodes,
    metadata: { importedFrom, importWarnings: ['La importación conserva el contenido semántico y las tablas; estilos CSS externos pueden requerir ajuste manual.'] },
  };
}

function getStyle(element: Element, property: string) {
  return element.getAttribute('style')?.split(';').map(rule => rule.trim()).find(rule => rule.toLowerCase().startsWith(`${property.toLowerCase()}:`))?.split(':').slice(1).join(':').trim() || '';
}

function styleNumber(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function htmlPercent(element: Element, attribute: string, property: string, fallback: number) {
  const explicit = element.getAttribute(attribute);
  if (explicit) return safeNumber(styleNumber(explicit, fallback), fallback);
  const value = getStyle(element, property);
  if (!value) return fallback;
  return safeNumber(styleNumber(value, fallback), fallback);
}

function htmlColor(element: Element, property: string, fallback: string) {
  return getStyle(element, property) || fallback;
}

function htmlFontFamily(element: Element) {
  return getStyle(element, 'font-family')
    .replace(/var\(--font-body\)/g, '"DM Sans", "DMSans", "Segoe UI", sans-serif')
    .replace(/var\(--font-display\)/g, 'Gotham, "DM Sans", "DMSans", "Segoe UI", sans-serif') || undefined;
}

function normalizedNodeType(value: string | null, element: Element): PdfTemplateNodeType | null {
  const type = String(value || '').toLowerCase();
  if (['section', 'text', 'field', 'table', 'report-sections', 'totals', 'image', 'barcode', 'divider', 'spacer'].includes(type)) return type as PdfTemplateNodeType;
  if (element.tagName.toLowerCase() === 'table') return 'table';
  const binding = element.getAttribute('data-novahub-bind');
  return binding ? 'field' : null;
}

function htmlElementToNode(element: Element, index: number): PdfTemplateNode[] {
  const type = normalizedNodeType(element.getAttribute('data-novahub-type'), element);
  if (!type) return [];
  const textContent = element.textContent?.trim() || '';
  const binding = element.getAttribute('data-novahub-bind') || textContent.match(/^\{\{\s*([^}]+)\s*\}\}$/)?.[1] || undefined;
  const tag = element.tagName.toLowerCase();
  const fontSize = styleNumber(getStyle(element, 'font-size'), tag === 'h1' ? 16 : tag.startsWith('h') ? 12 : 9);
  const fontWeight = styleNumber(getStyle(element, 'font-weight'), tag.startsWith('h') ? 700 : 400);
  const textDecoration = getStyle(element, 'text-decoration');
  const columns = type === 'table' || type === 'report-sections' ? Array.from(element.querySelectorAll('thead th')).map((th, columnIndex) => {
    const label = th.textContent?.trim() || `Columna ${columnIndex + 1}`;
    const token = th.getAttribute('data-novahub-token') || th.getAttribute('data-token') || th.getAttribute('data-novahub-bind') || ['description', 'quantity', 'unitPrice', 'total'][columnIndex] || `column-${columnIndex}`;
    return { id: `column-${columnIndex}`, label, token, width: styleNumber(th.getAttribute('data-width') || getStyle(th, 'width'), 100 / Math.max(1, element.querySelectorAll('thead th').length)), align: (th.getAttribute('data-align') || getStyle(th, 'text-align') || 'left') as PdfTemplateHorizontalAlign };
  }) : undefined;
  const rawClipPath = getStyle(element, 'clip-path') || element.getAttribute('data-novahub-clip-path') || '';
  const clipPath = /^[a-z0-9%(),.\s/-]+$/i.test(rawClipPath) ? rawClipPath : undefined;
  const rawShape = element.getAttribute('data-novahub-shape');
  const shape = rawShape === 'pill' || rawShape === 'wave' || rawShape === 'wave-bottom' || rawShape === 'circle' ? rawShape : 'rectangle';
  return [node({
    type,
    label: element.getAttribute('data-novahub-label') || (binding ? `Campo ${binding}` : textContent.slice(0, 80) || `Elemento ${index + 1}`),
    x: htmlPercent(element, 'data-novahub-x', 'left', 8),
    y: htmlPercent(element, 'data-novahub-y', 'top', 8 + index * 3),
    width: htmlPercent(element, 'data-novahub-width', 'width', type === 'table' || type === 'report-sections' ? 84 : 30),
    height: htmlPercent(element, 'data-novahub-height', 'height', type === 'table' || type === 'report-sections' ? 16 : 5),
    text: binding || type === 'field' ? undefined : textContent,
    token: binding,
    sample: element.getAttribute('data-novahub-sample') || undefined,
    fontSize,
    fontFamily: htmlFontFamily(element),
    fontWeight: [400, 500, 600, 700, 800].includes(fontWeight) ? fontWeight as PdfTemplateNode['fontWeight'] : undefined,
    color: htmlColor(element, 'color', '#334155'),
    backgroundColor: htmlColor(element, 'background-color', 'transparent'),
    borderColor: htmlColor(element, 'border-color', '#e2e8f0'),
    borderRadius: styleNumber(getStyle(element, 'border-radius'), 0),
    shape,
    clipPath,
    opacity: Math.max(0, Math.min(1, styleNumber(getStyle(element, 'opacity'), 1))),
    bold: fontWeight >= 600,
    italic: getStyle(element, 'font-style') === 'italic',
    underline: /underline/i.test(textDecoration),
    strikethrough: /line-through/i.test(textDecoration),
    lineHeight: styleNumber(getStyle(element, 'line-height'), 1.25),
    letterSpacing: styleNumber(getStyle(element, 'letter-spacing'), 0),
    textTransform: (getStyle(element, 'text-transform') || 'none') as PdfTemplateNode['textTransform'],
    align: (getStyle(element, 'text-align') || 'left') as PdfTemplateHorizontalAlign,
    padding: styleNumber(getStyle(element, 'padding'), 1.5),
    columns,
    repeatHeader: element.getAttribute('data-novahub-repeat-header') !== 'false',
  }, element.getAttribute('data-novahub-id') || `imported-element-${index}`)];
}

export function definitionToHtml(definition: PdfTemplateDefinition) {
  return clone(definition);
}
