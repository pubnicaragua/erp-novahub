import { getPdfTemplatePartyConfig, getPdfTemplateTarget, type PdfTemplateTarget } from './pdf-document-catalog';

export type PdfTemplateNodeType = 'section' | 'text' | 'field' | 'table' | 'totals' | 'image' | 'barcode' | 'divider' | 'spacer';
export type PdfTemplateHorizontalAlign = 'left' | 'center' | 'right';

export interface PdfTemplateColumn {
  id: string;
  label: string;
  token: string;
  width?: number;
  align?: PdfTemplateHorizontalAlign;
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
  repeatHeader?: boolean;
}

export interface PdfTemplateDefinition {
  version: 1;
  page: { paperSize: string; orientation: 'portrait' | 'landscape'; background: string };
  nodes: PdfTemplateNode[];
  metadata?: { importedFrom?: 'html' | 'docx' | 'pdf'; importWarnings?: string[]; preset?: string };
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
  history?: Array<Record<string, unknown>>;
}

export const TEMPLATE_TOKENS = [
  { token: 'company.name', label: 'Empresa', sample: 'NovaHub Comercial' },
  { token: 'company.fiscalInfo', label: 'Identificación fiscal', sample: 'RUC J0310000000000' },
  { token: 'company.address', label: 'Dirección', sample: 'Managua, Nicaragua' },
  { token: 'company.phone', label: 'Teléfono', sample: '+505 2255-0000' },
  { token: 'company.email', label: 'Correo', sample: 'contacto@empresa.com' },
  { token: 'company.summary', label: 'Datos de la sucursal', sample: 'RUC J0310000000000 · Managua, Nicaragua · +505 2255-0000 · contacto@empresa.com' },
  { token: 'document.title', label: 'Título del documento', sample: 'COTIZACIÓN' },
  { token: 'document.number', label: 'Número', sample: 'COT-000123' },
  { token: 'document.date', label: 'Fecha', sample: '29/08/2026' },
  { token: 'document.status', label: 'Estado', sample: 'Pendiente' },
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
  headerLayout: 'split',
  footerLayout: 'line',
  tableLayout: 'standard',
  logoPosition: 'left',
  logoSize: 34,
  showCompanyName: true,
  companyName: '',
  slogan: 'Soluciones simples para crecer',
  fiscalInfo: 'RUC / Identificación fiscal',
  address: 'Dirección fiscal de la empresa',
  phone: '+505 0000-0000',
  email: 'contacto@empresa.com',
  website: 'www.empresa.com',
  bankInfo: '',
  showQr: false,
  showBarcode: false,
  watermark: '',
  watermarkOpacity: 12,
  footerText: 'Gracias por confiar en nosotros.',
  showPageNumber: true,
  pageNumberFormat: 'page-of',
  pageNumberCustom: 'Página {page} de {pages}',
  legalText: '',
  terms: '',
  defaultNotes: '',
  margins: 14,
  fontFamily: 'helvetica',
  fontSize: 9,
  primaryColor: '#10b981',
  secondaryColor: '#0f3b65',
  textColor: '#334155',
  lineColor: '#e2e8f0',
  backgroundColor: '#ffffff',
  separator: 'solid',
  paletteMode: 'corporate',
};

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
  const customer = { name: 'Cliente de ejemplo', taxId: 'J0310000000000', address: 'Carretera Norte, local 25', phone: '+505 8888-0000', email: 'cliente@empresa.com', contact: 'Contacto comercial' };
  const supplier = { name: 'Proveedor de ejemplo', taxId: 'J0310000000000', address: 'Managua, Nicaragua', phone: '+505 2222-0000', email: 'proveedor@empresa.com', contact: 'Contacto de compras' };
  const requester = { name: 'Ana Martínez', address: 'Departamento de Ventas', phone: '+505 2255-0012', email: 'ana@empresa.com', contact: 'Responsable de la solicitud' };
  const payee = { name: 'Beneficiario de ejemplo', taxId: 'J0310000000000', address: 'Managua, Nicaragua', phone: '+505 2222-0000', email: 'beneficiario@empresa.com', contact: 'Contacto del pago' };
  const transactionItems = [
    { description: 'Producto de muestra', quantity: '2', unitPrice: 'C$ 500.00', total: 'C$ 1,000.00' },
    { description: 'Servicio adicional', quantity: '1', unitPrice: 'C$ 150.00', total: 'C$ 150.00' },
  ];
  const base: PdfTemplateData = {
    company: { name: 'NovaHub Comercial', fiscalInfo: 'RUC J0310000000000', address: 'Managua, Nicaragua', phone: '+505 2255-0000', email: 'contacto@empresa.com', logo: '' },
    document: { title: target.label.toUpperCase(), number: 'DOC-000123', date: '29/08/2026', status: 'Pendiente', notes: 'Notas del documento', terms: 'Vigencia: 15 días' },
    customer,
    supplier,
    party: partyConfig.mode === 'supplier' ? supplier : partyConfig.mode === 'requester' ? requester : partyConfig.mode === 'payee' ? payee : partyConfig.mode === 'none' ? undefined : customer,
    items: transactionItems,
    totals: { subtotal: 'C$ 1,000.00', tax: 'C$ 150.00', discount: 'C$ 0.00', total: 'C$ 1,150.00' },
  };

  if (target.key === 'ventas.customer-history') {
    const history = [
      { description: 'Factura FAC-000124', quantity: 'Pagada', unitPrice: '15/08/2026', total: 'C$ 1,150.00' },
      { description: 'Cotización COT-000118', quantity: 'Aceptada', unitPrice: '09/08/2026', total: 'C$ 850.00' },
      { description: 'Pago REC-000099', quantity: 'Recibido', unitPrice: '05/08/2026', total: 'C$ 500.00' },
    ];
    return { ...base, party: customer, document: { ...base.document, title: 'HISTORIAL DEL CLIENTE', number: 'CLI-000123', notes: 'Movimientos y documentos relacionados con el cliente.' }, items: history, history };
  }
  if (target.key === 'inventario.product-labels') {
    return { ...base, document: { ...base.document, title: 'ETIQUETA DE PRODUCTO', barcode: '7501234567890', date: '29/08/2026' }, product: { name: 'Producto de muestra', code: 'SKU-0001', barcode: '7501234567890', price: 'C$ 500.00' }, items: [] };
  }
  if (target.key === 'reportes.customers') {
    const customers = [
      { description: 'Cliente de ejemplo', quantity: 'Activo', unitPrice: 'J0310000000000', total: '+505 8888-0000' },
      { description: 'Comercial del Pacífico', quantity: 'Activo', unitPrice: 'J0310000000042', total: '+505 2277-1144' },
      { description: 'Servicios del Norte', quantity: 'Inactivo', unitPrice: 'J0310000000088', total: '+505 2233-7788' },
    ];
    return { ...base, party: customer, document: { ...base.document, title: 'REPORTE DE CLIENTES', number: 'CLI-0001' }, items: customers };
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
  if (target.module === 'recursos-humanos' || target.key.includes('payroll')) {
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
  if (type === 'table' || type === 'divider') return 'solid';
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
    'ventas.customer-history': ['Movimiento', 'Estado', 'Fecha', 'Monto'],
    'ventas.cash-historical-report': ['Fecha', 'Sucursal', 'Caja', 'Estado'],
    'ventas.cash-session': ['Referencia', 'Tipo', 'Descripción', 'Monto'],
    'compras.supplier-history': ['Movimiento', 'Estado', 'Fecha', 'Monto'],
    'compras.list': ['Documento', 'Proveedor', 'Fecha', 'Total'],
    'compras.supplier': ['Proveedor', 'Identificación', 'Contacto', 'Estado'],
    'compras.purchase-request': ['Solicitud', 'Solicitante', 'Fecha', 'Estado'],
    'finanzas.balance': ['Concepto', 'Tipo', 'Fecha', 'Monto'],
    'finanzas.transactions': ['Fecha', 'Concepto', 'Tipo', 'Monto'],
    'recursos-humanos.payrolls': ['Colaborador', 'Periodo', 'Neto', 'Estado'],
    'reportes.customers': ['Cliente', 'Identificación', 'Teléfono', 'Estado'],
    'reportes.sales': ['Documento', 'Cliente', 'Fecha', 'Total'],
    'reportes.purchases': ['Documento', 'Proveedor', 'Fecha', 'Total'],
    'reportes.inventory': ['Producto', 'Código', 'Existencia', 'Valor'],
    'reportes.providers': ['Proveedor', 'Identificación', 'Teléfono', 'Estado'],
    'reportes.finance': ['Cuenta', 'Tipo', 'Debe', 'Haber'],
    'reportes.hr': ['Colaborador', 'Cargo', 'Estado', 'Ingreso'],
    'reportes.subscriptions': ['Cliente', 'Estado', 'Plan', 'Monto'],
    'dashboard.tenant-overview': ['Indicador', 'Valor', 'Detalle'],
  };
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
  borderColor: value.type === 'table' ? '#e2e8f0' : 'transparent',
  ...value,
});

const DIAGONAL_CLIP_PATH = 'polygon(0 0,100% 0,78% 100%,0 100%)';
const TICKET_CLIP_PATH = 'polygon(0 0,100% 0,100% 88%,96% 100%,92% 88%,88% 100%,84% 88%,80% 100%,76% 88%,72% 100%,68% 88%,64% 100%,60% 88%,56% 100%,52% 88%,48% 100%,44% 88%,40% 100%,36% 88%,32% 100%,28% 88%,24% 100%,20% 88%,16% 100%,12% 88%,8% 100%,4% 88%,0 100%)';
const NOTCH_CLIP_PATH = 'polygon(0 0,100% 0,100% 72%,96% 100%,92% 72%,88% 100%,84% 72%,80% 100%,76% 72%,72% 100%,68% 72%,64% 100%,60% 72%,56% 100%,52% 72%,48% 100%,44% 72%,40% 100%,36% 72%,32% 100%,28% 72%,24% 100%,20% 72%,16% 100%,12% 72%,8% 100%,4% 72%,0 100%)';

export function createDefaultTemplateDefinition(targetKey: string, settings?: Record<string, unknown>): PdfTemplateDefinition {
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

  if (family === 'label') {
    return {
      version: 1,
      page: { paperSize: settingsValue(settings, 'paperSize', 'LABEL'), orientation: 'portrait', background },
      nodes: [
        node({ type: 'image', label: 'Logotipo de la sucursal', x: 68, y: 1, width: 25, height: 6, enabled: hasLogo, borderStyle: 'none', backgroundColor: 'transparent', align: 'right' }, 'label-logo'),
        node({ type: 'barcode', label: 'Código de barras', token: 'product.barcode', x: 7, y: 7, width: 86, height: 42, fontSize: 7, color: text, borderStyle: 'none', padding: 0.5 }, 'label-barcode'),
        node({ type: 'field', label: 'Nombre del producto', token: 'product.name', x: 7, y: 52, width: 86, height: 15, fontSize: 8, fontWeight: 700, color: text, align: 'center', borderStyle: 'none', padding: 0.5 }, 'label-name'),
        node({ type: 'field', label: 'Precio', token: 'product.price', x: 7, y: 68, width: 86, height: 12, fontSize: 10, fontWeight: 800, color: primary, align: 'center', borderStyle: 'none', padding: 0.5 }, 'label-price'),
        node({ type: 'field', label: 'Empresa', token: 'company.name', x: 7, y: 83, width: 86, height: 8, fontSize: 6, color: text, align: 'center', borderStyle: 'none', padding: 0.5 }, 'label-company'),
        node({ type: 'field', label: 'Fecha', token: 'document.date', x: 7, y: 91, width: 86, height: 6, fontSize: 5, color: text, align: 'center', borderStyle: 'none', padding: 0.5 }, 'label-date'),
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
    headerNodes.push(node({ type: 'section', label: 'Acento lateral', x: 5, y: 4, width: 7, height: 23, backgroundColor: primary, borderColor: primary, borderRadius: 4, clipPath: 'ellipse(100% 50% at 0% 50%)' }, 'header-accent'));
    headerNodes.push(node({ type: 'section', label: 'Sombra lateral', x: 10, y: 6, width: 5, height: 21, backgroundColor: secondary, borderColor: secondary, borderRadius: 4, clipPath: 'ellipse(100% 50% at 0% 50%)', opacity: 0.28 }, 'header-sidebar-shadow'));
  } else if (headerLayout === 'centered') {
    headerNodes.push(node({ type: 'section', label: 'Píldora de marca', x: 32, y: 4, width: 36, height: 3, backgroundColor: primary, borderColor: primary, borderRadius: 4 }, 'header-accent'));
  } else if (headerLayout === 'corner') {
    headerNodes.push(node({ type: 'section', label: 'Acento de esquina', x: 76, y: 4, width: 19, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 999, shape: 'circle', clipPath: 'ellipse(100% 100% at 100% 0%)' }, 'header-accent'));
  } else if (headerLayout === 'editorial') {
    headerNodes.push(node({ type: 'divider', label: 'Regla editorial', x: 5, y: 4, width: 90, height: 1, borderColor: primary }, 'header-accent'));
  } else if (headerLayout === 'boxed') {
    headerNodes.push(node({ type: 'section', label: 'Marco de cabecera', x: 5, y: 4, width: 90, height: 17, backgroundColor: '#ffffff', borderColor: primary, borderRadius: 2 }, 'header'));
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
    headerNodes.push(node({ type: 'section', label: 'Portal de marca', x: 5, y: 4, width: 27, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 999, shape: 'circle', opacity: 0.15 }, 'header-accent'));
    headerNodes.push(node({ type: 'section', label: 'Marco portal', x: 29, y: 4, width: 66, height: 17, backgroundColor: '#f8fafc', borderColor: primary, borderRadius: 2 }, 'header'));
  } else if (headerLayout === 'steps') {
    headerNodes.push(node({ type: 'section', label: 'Escalón uno', x: 5, y: 4, width: 53, height: 4, backgroundColor: primary, borderColor: primary, borderRadius: 3 }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Escalón dos', x: 18, y: 8, width: 77, height: 4, backgroundColor: primary, borderColor: primary, borderRadius: 3, opacity: 0.72 }, 'header-band'));
    headerNodes.push(node({ type: 'section', label: 'Escalón tres', x: 35, y: 12, width: 60, height: 4, backgroundColor: primary, borderColor: primary, borderRadius: 3, opacity: 0.42 }, 'header-accent'));
  } else if (headerLayout === 'ink') {
    headerNodes.push(node({ type: 'section', label: 'Mancha de tinta', x: 5, y: 3, width: 90, height: 18, backgroundColor: primary, borderColor: primary, clipPath: 'ellipse(78% 100% at 18% 0%)', opacity: 0.94 }, 'header'));
    headerNodes.push(node({ type: 'section', label: 'Sombra de tinta', x: 5, y: 6, width: 90, height: 15, backgroundColor: secondary, borderColor: secondary, clipPath: 'ellipse(58% 100% at 72% 0%)', opacity: 0.3 }, 'header-band'));
    headerNodes.push(node({ type: 'section', label: 'Trazo', x: 9, y: 17, width: 28, height: 1.5, backgroundColor: '#ffffff', borderColor: '#ffffff', borderRadius: 999, shape: 'pill', opacity: 0.82 }, 'header-accent'));
  } else if (headerLayout === 'grid') {
    headerNodes.push(node({ type: 'section', label: 'Retícula de cabecera', x: 5, y: 4, width: 90, height: 17, backgroundColor: '#f8fafc', borderColor: primary, borderRadius: 1 }, 'header'));
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
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: headerLayout === 'centered' ? 20 : headerLayout === 'ribbon' ? (hasLogo ? 21 : 8) : hasLogo ? 28 : 8, y: headerLayout === 'compact' ? 8 : headerLayout === 'centered' ? 12 : headerLayout === 'steps' ? 6 : 7, width: headerLayout === 'centered' ? 60 : headerLayout === 'ribbon' ? (hasLogo ? 14 : 25) : hasLogo ? 28 : headerLayout === 'portal' ? 24 : 40, height: 5, fontSize: headerLayout === 'editorial' ? 9 : 14, color: headerLayout === 'ribbon' ? '#ffffff' : headerTextColor, bold: true, align: headerLayout === 'centered' ? 'center' : 'left', textTransform: headerLayout === 'editorial' ? 'uppercase' : 'none', borderStyle: 'none', padding: 0.4 }, 'company-name'),
    node({ type: 'field', label: 'Título', token: 'document.title', x: headerLayout === 'centered' ? 20 : headerLayout === 'ribbon' ? 43 : headerLayout === 'portal' ? 50 : 58, y: headerLayout === 'centered' ? 16 : headerLayout === 'compact' ? 8 : headerLayout === 'steps' ? 10 : 7, width: headerLayout === 'centered' ? 60 : headerLayout === 'ribbon' ? 52 : headerLayout === 'portal' ? 41 : 34, height: 5, fontSize: headerLayout === 'editorial' ? 16 : 14, color: titleColor, bold: true, align: headerLayout === 'centered' ? 'center' : 'right', borderStyle: 'none', padding: 0.4 }, 'document-title'),
    node({ type: 'field', label: 'Número', token: 'document.number', x: headerLayout === 'ribbon' ? 43 : headerLayout === 'portal' ? 50 : 58, y: headerLayout === 'compact' ? 13 : headerLayout === 'centered' ? 21 : headerLayout === 'double-band' ? 17 : headerLayout === 'steps' ? 14 : 13, width: headerLayout === 'ribbon' ? 52 : headerLayout === 'portal' ? 41 : 34, height: 3, fontSize: 8, color: headerLayout === 'ribbon' ? text : headerIsFilled ? '#dbeafe' : text, align: 'right', borderStyle: 'none', padding: 0.4 }, 'document-number'),
    node({ type: 'field', label: 'Estado', token: 'document.status', x: 55, y: 24, width: 40, height: 3, fontSize: 7, color: text, align: 'right', borderStyle: 'none', padding: 0.2 }, 'document-status'),
    node({ type: 'field', label: 'Datos de la sucursal', token: 'company.summary', x: headerLayout === 'ribbon' ? 43 : headerLayout === 'portal' ? 50 : 8, y: headerLayout === 'compact' ? 16 : 16, width: headerLayout === 'ribbon' ? 52 : headerLayout === 'portal' ? 41 : 46, height: 7, fontSize: 5.8, lineHeight: 1.15, color: headerLayout === 'ribbon' || headerLayout === 'portal' ? text : headerTextColor, align: 'left', borderStyle: 'none', padding: 0.2 }, 'company-summary'),
  ];
  const logoNode = node({ type: 'image', label: 'Logotipo', x: 8, y: 7, width: headerLayout === 'ribbon' ? 11 : 16, height: 8, enabled: hasLogo, borderStyle: 'none', backgroundColor: 'transparent' }, 'company-logo');
  const nodes: PdfTemplateNode[] = [...headerNodes, logoNode, ...headerFields,
    node({ type: 'field', label: 'Fecha', token: 'document.date', x: 8, y: headerLayout === 'compact' ? 20 : 24, width: 35, height: 4, fontSize: 8, color: text }, 'document-date'),
    node({ type: 'section', label: partySectionLabel, x: 5, y: 31, width: 90, height: 19, backgroundColor: '#f8fafc', borderColor: line, borderRadius: 3, color: text, borderStyle: 'none' }, 'party-section'),
    node({ type: 'field', label: partyLabel, token: partyToken, x: 8, y: 34, width: 50, height: 5.5, fontSize: 10, color: text, bold: true, borderStyle: 'none' }, 'party-name'),
    node({ type: 'field', label: party.labels.taxId, token: `${party.tokenPrefix}.taxId`, x: 62, y: 34, width: 30, height: 5.5, fontSize: 8, color: text, align: 'right', borderStyle: 'none' }, 'party-tax-id'),
    node({ type: 'field', label: party.labels.address, token: `${party.tokenPrefix}.address`, x: 8, y: 40.3, width: 50, height: 4.8, fontSize: 8, color: text, borderStyle: 'none' }, 'party-address'),
    node({ type: 'field', label: party.labels.phone, token: `${party.tokenPrefix}.phone`, x: 62, y: 40.3, width: 30, height: 4.8, fontSize: 8, color: text, align: 'right', borderStyle: 'none' }, 'party-phone'),
    node({ type: 'field', label: party.labels.email, token: `${party.tokenPrefix}.email`, x: 8, y: 45.5, width: 50, height: 4, fontSize: 7, color: '#64748b', borderStyle: 'none' }, 'party-email'),
    node({ type: 'field', label: party.labels.contact, token: `${party.tokenPrefix}.contact`, x: 62, y: 45.5, width: 30, height: 4, fontSize: 7, color: '#64748b', align: 'right', borderStyle: 'none' }, 'party-contact'),
  ];

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
    nodes.push(node({
      type: 'table', label: family === 'history' || family === 'report' || family === 'cash' ? 'Tabla de resultados' : 'Detalle',
       x: 5, y: compactReport ? 31 : 52, width: 90, height: compactReport ? 47 : 26, backgroundColor: '#ffffff', borderColor: line, color: text, columns: tableColumns, repeatHeader: true,
    }, 'items-table'));
  } else {
    nodes.push(node({ type: 'text', label: 'Información', text: 'Información del documento', x: 5, y: 51, width: 90, height: 8, fontSize: 11, color: text, bold: true }, 'information-title'));
    nodes.push(node({ type: 'field', label: 'Notas', token: 'document.notes', x: 5, y: 58, width: 90, height: 17, fontSize: 9, color: text }, 'document-notes'));
  }

  if (family === 'transaction' || family === 'receipt' || family === 'cash') {
    nodes.push(node({ type: 'totals', label: 'Totales', x: 55, y: 80, width: 40, height: 12, backgroundColor: '#f8fafc', borderColor: line, color: text }, 'totals'));
  }
  nodes.push(node({ type: 'field', label: 'Notas', token: 'document.notes', x: 5, y: 80, width: 46, height: 10, fontSize: 8, color: text }, 'notes'));
  const footerIsFilled = ['band', 'wave', 'layers', 'notch'].includes(footerLayout);
  if (footerLayout === 'band') {
    nodes.push(node({ type: 'section', label: 'Banda inferior', x: 5, y: 93, width: 90, height: 5, backgroundColor: primary, borderColor: primary, borderRadius: 1 }, 'footer-band'));
  } else if (footerLayout === 'wave') {
    nodes.push(node({ type: 'section', label: 'Ola inferior', x: 5, y: 93, width: 90, height: 5, backgroundColor: primary, borderColor: primary, borderRadius: 10, shape: 'wave' }, 'footer-band'));
    nodes.push(node({ type: 'section', label: 'Contraste inferior', x: 5, y: 96, width: 90, height: 2, backgroundColor: secondary, borderColor: secondary, borderRadius: 10, shape: 'wave' }, 'footer-accent'));
  } else if (footerLayout === 'layers') {
    nodes.push(node({ type: 'section', label: 'Capa orgánica inferior', x: 5, y: 93, width: 90, height: 5, backgroundColor: primary, borderColor: primary, borderRadius: 10, shape: 'wave' }, 'footer-band'));
    nodes.push(node({ type: 'section', label: 'Capa secundaria', x: 5, y: 96, width: 90, height: 3, backgroundColor: secondary, borderColor: secondary, borderRadius: 10, shape: 'wave', opacity: 0.58 }, 'footer-layer'));
    nodes.push(node({ type: 'section', label: 'Trazo inferior', x: 11, y: 94, width: 24, height: 1.2, backgroundColor: '#ffffff', borderColor: '#ffffff', borderRadius: 999, shape: 'pill', opacity: 0.86 }, 'footer-accent'));
  } else if (footerLayout === 'notch') {
    nodes.push(node({ type: 'section', label: 'Pie dentado', x: 5, y: 93, width: 90, height: 5, backgroundColor: primary, borderColor: primary, clipPath: NOTCH_CLIP_PATH }, 'footer-band'));
  } else if (footerLayout === 'boxed') {
    nodes.push(node({ type: 'section', label: 'Marco inferior', x: 5, y: 93, width: 90, height: 5, backgroundColor: '#ffffff', borderColor: primary, borderRadius: 2 }, 'footer-band'));
  } else if (footerLayout === 'split') {
    nodes.push(node({ type: 'section', label: 'Pie dividido', x: 5, y: 93, width: 90, height: 5, backgroundColor: '#f8fafc', borderColor: line, borderRadius: 1 }, 'footer-band'));
    nodes.push(node({ type: 'section', label: 'Acento del pie', x: 5, y: 93, width: 28, height: 5, backgroundColor: primary, borderColor: primary, borderRadius: 1 }, 'footer-accent'));
  } else if (footerLayout === 'minimal') {
    nodes.push(node({ type: 'divider', label: 'Separador mínimo', x: 5, y: 94, width: 90, height: 1, borderColor: line }, 'footer-divider'));
  } else if (footerLayout === 'dots') {
    nodes.push(node({ type: 'divider', label: 'Separador de puntos', x: 5, y: 94, width: 90, height: 1, borderColor: line }, 'footer-divider'));
    [10, 14, 18].forEach((x, index) => nodes.push(node({ type: 'section', label: `Punto ${index + 1}`, x, y: 93.4, width: 1.6, height: 1.6, backgroundColor: primary, borderColor: primary, borderRadius: 999, shape: 'circle' }, `footer-dot-${index + 1}`)));
  } else {
    nodes.push(node({ type: 'divider', label: 'Separador', x: 5, y: 94, width: 90, height: 1, borderColor: line }, 'footer-divider'));
  }
  nodes.push(node({ type: 'field', label: 'Pie', token: 'company.email', x: footerLayout === 'split' ? 8 : 5, y: 95, width: footerLayout === 'split' ? 21 : 65, height: 3, fontSize: 7, color: footerIsFilled || footerLayout === 'split' ? '#ffffff' : '#64748b' }, 'footer-contact'));
  nodes.push(node({ type: 'field', label: 'Página', token: 'page.number', x: 72, y: 95, width: 23, height: 3, fontSize: 7, color: footerIsFilled ? '#ffffff' : '#64748b', align: 'right' }, 'footer-page'));

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
  const settings = createSystemDefaultPdfSettings({
    ...(target.key === 'inventario.product-labels' ? { paperSize: 'LABEL', orientation: 'portrait', margins: 2, fontFamily: 'helvetica', fontSize: 8 } : {}),
    ...(overrides || {}),
  });
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
        ...createDefaultTemplateDefinition(target.key, settings),
        metadata: { preset: 'system-default' },
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

export function sanitizeTemplateDefinition(value: unknown, targetKey: string, settings?: Record<string, unknown>): PdfTemplateDefinition {
  const fallback = createDefaultTemplateDefinition(targetKey, settings);
  const party = getPdfTemplatePartyConfig(targetKey);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<PdfTemplateDefinition>;
  if (!Array.isArray(candidate.nodes)) return fallback;
  const nodes = candidate.nodes.slice(0, 120).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<PdfTemplateNode>;
    const type: PdfTemplateNodeType = ['section', 'text', 'field', 'table', 'totals', 'image', 'barcode', 'divider', 'spacer'].includes(String(item.type))
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
        backgroundColor: safeText(item.backgroundColor, 'transparent'), borderColor: safeText(item.borderColor, type === 'table' ? '#e2e8f0' : 'transparent'),
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
        })) : undefined,
        repeatHeader: item.repeatHeader !== false,
      }, safeText(item.id, `node-${index + 1}`)),
    };
    // Diseños guardados antes de la escala tipográfica pueden conservar una
    // caja de sucursal de 3–5% de alto. Al aumentar la lectura, esa caja
    // recorta la segunda línea del resumen fiscal aunque el preset nuevo ya
    // tenga dimensiones correctas. Normalizamos solo este nodo semántico;
    // los demás tamaños siguen siendo editables por el usuario.
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
  const partyNodeIds = new Set(['party-section', 'party-name', 'party-tax-id', 'party-address', 'party-phone', 'party-email', 'party-contact']);
  const partyLabels: Record<string, string> = {
    'party-section': party.sectionLabel,
    'party-name': party.nameLabel,
    'party-tax-id': party.labels.taxId,
    'party-address': party.labels.address,
    'party-phone': party.labels.phone,
    'party-email': party.labels.email,
    'party-contact': party.labels.contact,
  };
  const normalizedNodes = nodes
    .filter(item => party.mode !== 'none' || (!partyNodeIds.has(item.id) && !String(item.token || '').startsWith('party.')))
    .map(item => {
      const hasPartyToken = item.type === 'field' && String(item.token || '').startsWith('party.');
      if ((!partyNodeIds.has(item.id) && !hasPartyToken) || party.mode === 'none') return item;
      const suffix = partyNodeIds.has(item.id)
        ? item.id.replace(/^party-/, '')
        : String(item.token || '').replace(/^party\./, '');
      const tokenSuffix = suffix === 'name' ? 'name' : suffix === 'tax-id' ? 'taxId' : suffix === 'address' ? 'address' : suffix === 'phone' ? 'phone' : suffix === 'email' ? 'email' : 'contact';
      const tokenLabels: Record<string, string> = {
        name: party.nameLabel,
        taxId: party.labels.taxId,
        address: party.labels.address,
        phone: party.labels.phone,
        email: party.labels.email,
        contact: party.labels.contact,
      };
      return {
        ...item,
        label: partyLabels[item.id] || tokenLabels[tokenSuffix] || item.label,
        token: item.type === 'field' ? `${party.tokenPrefix}.${tokenSuffix}` : item.token,
      };
    });
  return {
    version: 1,
    page: {
      paperSize: safeText(candidate.page?.paperSize, fallback.page.paperSize),
      orientation: candidate.page?.orientation === 'landscape' ? 'landscape' : fallback.page.orientation,
      background: safeText(candidate.page?.background, fallback.page.background),
    },
    nodes: normalizedNodes.length ? normalizedNodes : fallback.nodes,
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
    const summary = [company.fiscalInfo, company.address, company.phone, company.email]
      .filter(value => typeof value === 'string' && value.trim())
      .join(' · ');
    return summary || fallback;
  }
  let value = readPath(data, token);
  if (token.startsWith('party.')) {
    const path = token.slice('party.'.length);
    for (const source of [data.party, data.customer, data.supplier]) {
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
    return {
      ...definition,
      page: {
        ...definition.page,
        paperSize: pagePaperSize && ['LETTER', 'A4', 'OFICIO', 'LEGAL'].includes(pagePaperSize.toUpperCase()) ? pagePaperSize.toUpperCase() : definition.page.paperSize,
        orientation: pageOrientation === 'landscape' ? 'landscape' : pageOrientation === 'portrait' ? 'portrait' : definition.page.orientation,
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
  if (['section', 'text', 'field', 'table', 'totals', 'image', 'barcode', 'divider', 'spacer'].includes(type)) return type as PdfTemplateNodeType;
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
  const columns = type === 'table' ? Array.from(element.querySelectorAll('thead th')).map((th, columnIndex) => {
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
    width: htmlPercent(element, 'data-novahub-width', 'width', type === 'table' ? 84 : 30),
    height: htmlPercent(element, 'data-novahub-height', 'height', type === 'table' ? 16 : 5),
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
