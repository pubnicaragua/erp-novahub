import { getPdfTemplateTarget, type PdfTemplateTarget } from './pdf-document-catalog';

export type PdfTemplateNodeType = 'section' | 'text' | 'field' | 'table' | 'totals' | 'image' | 'divider' | 'spacer';
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
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  bold?: boolean;
  italic?: boolean;
  align?: PdfTemplateHorizontalAlign;
  padding?: number;
  columns?: PdfTemplateColumn[];
  repeatHeader?: boolean;
}

export interface PdfTemplateDefinition {
  version: 1;
  page: { paperSize: string; orientation: 'portrait' | 'landscape'; background: string };
  nodes: PdfTemplateNode[];
  metadata?: { importedFrom?: 'html' | 'docx' | 'pdf'; importWarnings?: string[] };
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
  { token: 'document.title', label: 'Título del documento', sample: 'COTIZACIÓN' },
  { token: 'document.number', label: 'Número', sample: 'COT-000123' },
  { token: 'document.date', label: 'Fecha', sample: '29/08/2026' },
  { token: 'document.status', label: 'Estado', sample: 'Pendiente' },
  { token: 'party.name', label: 'Cliente / proveedor', sample: 'Cliente de ejemplo' },
  { token: 'party.taxId', label: 'Identificación del tercero', sample: 'J0310000000000' },
  { token: 'party.address', label: 'Dirección del tercero', sample: 'Dirección del cliente' },
  { token: 'party.phone', label: 'Teléfono del tercero', sample: '+505 8888-0000' },
  { token: 'totals.subtotal', label: 'Subtotal', sample: 'C$ 1,000.00' },
  { token: 'totals.tax', label: 'Impuestos', sample: 'C$ 150.00' },
  { token: 'totals.discount', label: 'Descuento', sample: 'C$ 0.00' },
  { token: 'totals.total', label: 'Total', sample: 'C$ 1,150.00' },
  { token: 'document.notes', label: 'Notas', sample: 'Notas del documento' },
  { token: 'document.terms', label: 'Términos', sample: 'Vigencia: 15 días' },
  { token: 'page.number', label: 'Página', sample: 'Página 1 de 1' },
] as const;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function getFamily(target: PdfTemplateTarget) {
  if (target.family) return target.family;
  if (target.key.includes('cash')) return 'cash';
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

const node = (value: Omit<PdfTemplateNode, 'id'>, id: string): PdfTemplateNode => ({
  id,
  enabled: true,
  padding: 1.5,
  fontSize: 9,
  color: '#334155',
  borderColor: '#e2e8f0',
  ...value,
});

export function createDefaultTemplateDefinition(targetKey: string, settings?: Record<string, unknown>): PdfTemplateDefinition {
  const target = getPdfTemplateTarget(targetKey);
  const family = getFamily(target);
  const primary = settingsValue(settings, 'primaryColor', '#10b981');
  const text = settingsValue(settings, 'textColor', '#334155');
  const line = settingsValue(settings, 'lineColor', '#e2e8f0');
  const background = settingsValue(settings, 'backgroundColor', '#ffffff');
  const nodes: PdfTemplateNode[] = [
    node({ type: 'section', label: 'Cabecera', x: 5, y: 4, width: 90, height: 17, backgroundColor: primary, borderColor: primary, borderRadius: 2 }, 'header'),
    node({ type: 'field', label: 'Empresa', token: 'company.name', x: 8, y: 7, width: 40, height: 5, fontSize: 14, color: '#ffffff', bold: true }, 'company-name'),
    node({ type: 'field', label: 'Título', token: 'document.title', x: 58, y: 7, width: 34, height: 5, fontSize: 14, color: '#ffffff', bold: true, align: 'right' }, 'document-title'),
    node({ type: 'field', label: 'Número', token: 'document.number', x: 58, y: 13, width: 34, height: 3, fontSize: 8, color: '#dbeafe', align: 'right' }, 'document-number'),
    node({ type: 'field', label: 'Fecha', token: 'document.date', x: 8, y: 24, width: 35, height: 4, fontSize: 8, color: text }, 'document-date'),
    node({ type: 'section', label: family === 'history' ? 'Entidad consultada' : 'Datos del tercero', x: 5, y: 31, width: 90, height: 13, backgroundColor: '#f8fafc', borderColor: line, borderRadius: 2, color: text }, 'party-section'),
    node({ type: 'field', label: 'Cliente / proveedor', token: 'party.name', x: 8, y: 34, width: 50, height: 4, fontSize: 10, color: text, bold: true }, 'party-name'),
    node({ type: 'field', label: 'Identificación', token: 'party.taxId', x: 62, y: 34, width: 30, height: 4, fontSize: 8, color: text, align: 'right' }, 'party-tax-id'),
    node({ type: 'field', label: 'Dirección', token: 'party.address', x: 8, y: 39, width: 50, height: 3, fontSize: 8, color: text }, 'party-address'),
  ];

  const isTabular = family === 'transaction' || family === 'receipt' || family === 'report' || family === 'history' || family === 'cash';
  if (isTabular) {
    nodes.push(node({
      type: 'table', label: family === 'history' || family === 'report' || family === 'cash' ? 'Tabla de resultados' : 'Detalle',
      x: 5, y: 48, width: 90, height: 29, backgroundColor: '#ffffff', borderColor: line, color: text, columns: [
        { id: 'description', label: 'Descripción', token: 'description', width: 48, align: 'left' },
        { id: 'quantity', label: 'Cant.', token: 'quantity', width: 14, align: 'right' },
        { id: 'unitPrice', label: 'Precio', token: 'unitPrice', width: 19, align: 'right' },
        { id: 'total', label: 'Total', token: 'total', width: 19, align: 'right' },
      ], repeatHeader: true,
    }, 'items-table'));
  } else {
    nodes.push(node({ type: 'text', label: 'Información', text: 'Información del documento', x: 5, y: 48, width: 90, height: 8, fontSize: 11, color: text, bold: true }, 'information-title'));
    nodes.push(node({ type: 'field', label: 'Notas', token: 'document.notes', x: 5, y: 58, width: 90, height: 17, fontSize: 9, color: text }, 'document-notes'));
  }

  if (family === 'transaction' || family === 'receipt' || family === 'cash') {
    nodes.push(node({ type: 'totals', label: 'Totales', x: 55, y: 80, width: 40, height: 12, backgroundColor: '#f8fafc', borderColor: line, color: text }, 'totals'));
  }
  nodes.push(node({ type: 'field', label: 'Notas', token: 'document.notes', x: 5, y: 80, width: 46, height: 10, fontSize: 8, color: text }, 'notes'));
  nodes.push(node({ type: 'divider', label: 'Separador', x: 5, y: 94, width: 90, height: 1, borderColor: line }, 'footer-divider'));
  nodes.push(node({ type: 'field', label: 'Pie', token: 'company.email', x: 5, y: 96, width: 65, height: 2, fontSize: 7, color: '#64748b' }, 'footer-contact'));
  nodes.push(node({ type: 'field', label: 'Página', token: 'page.number', x: 72, y: 96, width: 23, height: 2, fontSize: 7, color: '#64748b', align: 'right' }, 'footer-page'));

  return {
    version: 1,
    page: { paperSize: settingsValue(settings, 'paperSize', 'LETTER'), orientation: settings?.orientation === 'landscape' ? 'landscape' : 'portrait', background },
    nodes,
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
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<PdfTemplateDefinition>;
  if (!Array.isArray(candidate.nodes)) return fallback;
  const nodes = candidate.nodes.slice(0, 120).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Partial<PdfTemplateNode>;
    const type: PdfTemplateNodeType = ['section', 'text', 'field', 'table', 'totals', 'image', 'divider', 'spacer'].includes(String(item.type))
      ? item.type as PdfTemplateNodeType
      : 'text';
    return [{
      ...node({
        type,
        label: safeText(item.label, `Elemento ${index + 1}`),
        x: safeNumber(item.x, 5), y: safeNumber(item.y, 5), width: safeNumber(item.width, 30), height: safeNumber(item.height, 5),
        page: Math.max(1, Math.floor(Number(item.page) || 1)), enabled: item.enabled !== false,
        text: safeText(item.text, ''), token: safeText(item.token, ''), sample: safeText(item.sample, ''),
        fontSize: Math.max(5, Math.min(72, Number(item.fontSize) || 9)), color: safeText(item.color, '#334155'),
        backgroundColor: safeText(item.backgroundColor, 'transparent'), borderColor: safeText(item.borderColor, '#e2e8f0'),
        borderRadius: Math.max(0, Math.min(24, Number(item.borderRadius) || 0)), bold: Boolean(item.bold), italic: Boolean(item.italic),
        align: item.align === 'center' || item.align === 'right' ? item.align : 'left', padding: Math.max(0, Math.min(12, Number(item.padding) || 1.5)),
        columns: Array.isArray(item.columns) ? item.columns.slice(0, 12).map((column, columnIndex) => ({
          id: safeText(column?.id, `column-${columnIndex}`), label: safeText(column?.label, `Columna ${columnIndex + 1}`),
          token: safeText(column?.token, 'description'), width: Math.max(1, Math.min(100, Number(column?.width) || 25)),
          align: column?.align === 'center' || column?.align === 'right' ? column.align : 'left',
        })) : undefined,
        repeatHeader: item.repeatHeader !== false,
      }, safeText(item.id, `node-${index + 1}`)),
    }];
  });
  return {
    version: 1,
    page: {
      paperSize: safeText(candidate.page?.paperSize, fallback.page.paperSize),
      orientation: candidate.page?.orientation === 'landscape' ? 'landscape' : fallback.page.orientation,
      background: safeText(candidate.page?.background, fallback.page.background),
    },
    nodes: nodes.length ? nodes : fallback.nodes,
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
  const aliases: Record<string, string> = {
    'party.name': 'customer.name', 'party.taxId': 'customer.taxId', 'party.address': 'customer.address', 'party.phone': 'customer.phone',
  };
  const value = readPath(data, aliases[token] || token);
  if (value === null || value === undefined) return fallback || getTemplateTokenSample(token);
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

export function definitionToHtml(definition: PdfTemplateDefinition) {
  return clone(definition);
}
