import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { createDefaultTemplateDefinition, PDF_DEFAULT_FONT_SCALE, resolveTemplateToken, type PdfTemplateColumn, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode } from '../services/pdf-template-definition';
import { getBase64Image, safeHtml2CanvasColor, sanitizeHtml2CanvasOklch } from './export-utils';
import { pdfStatusLabel } from './pdfStatus';

export interface PdfTemplateRenderSettings {
  paperSize: 'LETTER' | 'A4' | 'OFICIO' | 'LEGAL' | string;
  orientation: 'portrait' | 'landscape';
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  lineColor?: string;
  fontFamily?: string;
  fontSize?: number;
  tableLayout?: string;
  footerText?: string;
  watermark?: string;
  watermarkOpacity?: number;
}

export interface PdfTemplateRenderOptions {
  definition: PdfTemplateDefinition;
  settings: PdfTemplateRenderSettings;
  targetKey: string;
  data?: PdfTemplateData;
  fileName?: string;
  save?: boolean;
}

function pageDimensions(paperSize: string) {
  if (paperSize === 'LABEL') return [70, 38];
  if (paperSize === 'A4') return [210, 297];
  if (paperSize === 'OFICIO') return [216, 330];
  if (paperSize === 'LEGAL') return [216, 356];
  return [216, 279];
}

function escapeValue(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function asRows(data: PdfTemplateData) {
  return data.items || data.rows || data.history || [];
}

/**
 * Los listados y reportes conocen su esquema real en el momento de exportar.
 * La definición visual sigue siendo reutilizable, pero no debe reducir una
 * tabla de 6 o 7 columnas a las 4 columnas de la plantilla de transacciones.
 */
function runtimeTableColumns(data: PdfTemplateData | undefined): PdfTemplateColumn[] {
  if (!Array.isArray(data?.tableColumns)) return [];
  const source = data.tableColumns as Array<Partial<PdfTemplateColumn>>;
  const usable = source.filter(column => column && typeof column.label === 'string' && (column.token || column.id));
  if (!usable.length) return [];
  const defaultWidth = 100 / usable.length;
  return usable.slice(0, 10).map((column, index) => ({
    id: String(column.id || `column-${index}`),
    label: String(column.label),
    token: String(column.token || column.id || `column-${index}`),
    width: Number.isFinite(Number(column.width)) && Number(column.width) > 0 ? Number(column.width) : defaultWidth,
    align: column.align === 'center' || column.align === 'right' ? column.align : 'left',
  }));
}

function applyRuntimeTableColumns(definition: PdfTemplateDefinition, data: PdfTemplateData | undefined) {
  const columns = runtimeTableColumns(data);
  if (!columns.length) return definition;
  return {
    ...definition,
    nodes: definition.nodes.map(node => node.type === 'table' ? { ...node, columns } : node),
  };
}

function normalizeData(data: PdfTemplateData | undefined, settings: PdfTemplateRenderSettings, targetKey: string, pageNumber: number, pageCount: number): PdfTemplateData {
  const target = getPdfTemplateTarget(targetKey);
  const source = data || {};
  const firstRow = asRows(source)[0];
  const company = { name: settings.footerText ? undefined : undefined, ...(source.company || {}) };
  const document = { title: target.label.toUpperCase(), notes: '', terms: '', ...(source.document || {}) };
  return {
    ...source,
    company,
    document: { ...document, status: document.status ? pdfStatusLabel(document.status) : '', notes: document.notes || (source.defaultNotes as string) || '', page: pageNumber, pages: pageCount },
    page: { number: pageNumber, pages: pageCount },
    ...(target.key === 'inventario.product-labels' && firstRow && typeof firstRow === 'object' ? { product: { ...firstRow, ...((source.product || {}) as Record<string, unknown>) } } : {}),
  };
}

function tokenValue(node: PdfTemplateNode, data: PdfTemplateData) {
  return resolveTemplateToken(node.token, data, node.sample || node.text || '');
}

function partyField(node: PdfTemplateNode) {
  return node.type === 'field' && node.id.startsWith('party-');
}

function companyInitials(data: PdfTemplateData) {
  const name = String(data.company?.name || 'NovaHub').trim();
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'NH';
}

function createLogoFallback(data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const fallback = document.createElement('div');
  const primary = safeHtml2CanvasColor(settings.primaryColor, '#10b981');
  const secondary = safeHtml2CanvasColor(settings.secondaryColor, '#0f3b65');
  Object.assign(fallback.style, {
    display: 'flex', width: 'min(100%, 38px)', height: 'min(100%, 38px)', minWidth: '20px', minHeight: '20px',
    alignItems: 'center', justifyContent: 'center', borderRadius: '22%', background: `linear-gradient(135deg, ${primary}, ${secondary})`,
    color: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: `${Math.round(11 * PDF_DEFAULT_FONT_SCALE)}px`, fontWeight: '800', letterSpacing: '0.3px',
  });
  fallback.textContent = companyInitials(data);
  return fallback;
}

async function prepareLogoSource(source: string) {
  if (!source) return '';
  if (/^data:image\//i.test(source)) return source;
  return (await getBase64Image(source)) || '';
}

function rememberedSessionLogo() {
  if (typeof window === 'undefined') return '';
  try {
    const value = JSON.parse(window.localStorage.getItem('nh-session-branding') || 'null');
    return typeof value?.logo === 'string' ? value.logo : '';
  } catch {
    return '';
  }
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map(image => new Promise<void>(resolve => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve(); };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    if (image.complete) {
      if (typeof image.decode === 'function') void image.decode().catch(() => {}).finally(finish);
      else finish();
    }
    window.setTimeout(finish, 2500);
  })));
}

function browserFontFamily(value?: string) {
  const normalized = String(value || 'helvetica').trim().toLowerCase();
  if (['times', 'times new roman', 'georgia', 'garamond', 'cambria', 'palatino linotype', 'bookman'].includes(normalized)) {
    return 'Georgia, "Times New Roman", serif';
  }
  if (['courier', 'courier new', 'consolas', 'monaco'].includes(normalized)) {
    return '"Courier New", Courier, monospace';
  }
  return 'Arial, Helvetica, sans-serif';
}

/**
 * Los tamaños guardados en la definición representan puntos PDF. El renderer
 * anterior los aplicaba como píxeles CSS, dejando tipografías de 5–9 px en el
 * PDF final. 96 dpi equivalen aproximadamente a 1.333 px por punto y la
 * salida nativa aplica una escala de lectura del 40%.
 */
function pdfPointsToCss(value: unknown, minimum = 6) {
  const points = Number(value);
  if (!Number.isFinite(points)) return `${minimum * 1.333 * PDF_DEFAULT_FONT_SCALE}px`;
  return `${Math.max(minimum, Math.min(96, points * 1.333 * PDF_DEFAULT_FONT_SCALE))}px`;
}

function isDecorativeSection(node: PdfTemplateNode) {
  return node.type === 'section' && /^(header|footer)(-|$)/i.test(node.id);
}

function isStatusColumn(column: PdfTemplateColumn) {
  return /estado|status/i.test(`${column.id || ''} ${column.label || ''} ${column.token || ''}`);
}

function hasRenderablePartyValue(node: PdfTemplateNode, data: PdfTemplateData) {
  if (!partyField(node)) return true;
  const value = tokenValue(node, data).trim();
  return Boolean(value) && value !== '—' && !/^\{\{.+\}\}$/.test(value);
}

function svgElement<T extends keyof SVGElementTagNameMap>(name: T) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

function percentageCoordinate(value: string) {
  const parsed = Number.parseFloat(value.replace('%', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * html2canvas no siempre interpreta clip-path. Para headers y footers con
 * ondas, diagonales y recortes se dibuja una forma SVG detrás del contenido;
 * SVG sí se rasteriza de forma estable en el canvas que termina en jsPDF.
 */
function appendVectorShapeBackground(element: HTMLDivElement, node: PdfTemplateNode, settings: PdfTemplateRenderSettings) {
  const clipPath = String(node.clipPath || '').trim();
  const shape = node.shape;
  const vectorShape = ['wave', 'wave-bottom', 'angled', 'blob', 'arc'].includes(String(shape));
  if (!clipPath || clipPath === 'none') {
    if (!vectorShape) return;
  }
  const svg = svgElement('svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '0', pointerEvents: 'none' });
  const fill = safeHtml2CanvasColor(node.backgroundColor, 'transparent');
  const stroke = safeHtml2CanvasColor(node.borderColor || settings.lineColor, 'transparent');
  let graphic: SVGElement | null = null;

  const polygonMatch = clipPath.match(/^polygon\((.+)\)$/i);
  if (polygonMatch) {
    const points = polygonMatch[1].split(',').map(pair => {
      const [x = '0', y = '0'] = pair.trim().split(/\s+/);
      return `${percentageCoordinate(x)},${percentageCoordinate(y)}`;
    }).join(' ');
    const polygon = svgElement('polygon');
    polygon.setAttribute('points', points);
    graphic = polygon;
  }

  const ellipseMatch = clipPath.match(/^ellipse\(\s*([\d.]+)%?\s+([\d.]+)%?\s+at\s+([\d.]+)%?\s+([\d.]+)%?\s*\)$/i);
  if (!graphic && ellipseMatch) {
    const ellipse = svgElement('ellipse');
    ellipse.setAttribute('cx', ellipseMatch[3]);
    ellipse.setAttribute('cy', ellipseMatch[4]);
    ellipse.setAttribute('rx', ellipseMatch[1]);
    ellipse.setAttribute('ry', ellipseMatch[2]);
    graphic = ellipse;
  }

  if (!graphic) {
    if (shape === 'wave-bottom') {
      const path = svgElement('path');
      path.setAttribute('d', 'M 0 0 H 100 V 68 C 78 102 24 102 0 68 Z');
      graphic = path;
    } else if (shape === 'wave') {
      const path = svgElement('path');
      path.setAttribute('d', 'M 0 36 C 24 0 76 0 100 36 V 100 H 0 Z');
      graphic = path;
    } else if (shape === 'angled') {
      const polygon = svgElement('polygon');
      polygon.setAttribute('points', '0,0 100,0 88,100 0,100');
      graphic = polygon;
    } else if (shape === 'blob') {
      const path = svgElement('path');
      path.setAttribute('d', 'M 0 36 C 8 8 34 0 58 8 C 84 16 100 32 94 58 C 88 86 58 100 30 92 C 6 86 -8 62 0 36 Z');
      graphic = path;
    } else if (shape === 'arc') {
      const path = svgElement('path');
      path.setAttribute('d', 'M 0 100 A 50 82 0 0 1 100 100 V 0 H 0 Z');
      graphic = path;
    }
  }

  if (!graphic) return;
  graphic.setAttribute('fill', fill);
  if (node.borderStyle && node.borderStyle !== 'none' && stroke !== 'transparent') {
    graphic.setAttribute('stroke', stroke);
    graphic.setAttribute('stroke-width', '0.8');
    if (node.borderStyle === 'dashed') graphic.setAttribute('stroke-dasharray', '3 2');
  }
  svg.appendChild(graphic);
  element.style.backgroundColor = 'transparent';
  element.style.border = '0';
  element.style.borderRadius = '0';
  element.style.clipPath = 'none';
  element.appendChild(svg);
}

function setBaseNodeStyle(element: HTMLDivElement, node: PdfTemplateNode, settings: PdfTemplateRenderSettings) {
  const borderRadius = node.shape === 'pill' ? '999px' : node.shape === 'circle' ? '50%' : node.shape === 'blob' ? '42% 58% 62% 38% / 45% 35% 65% 55%' : node.shape === 'arc' ? '50% 50% 0 0 / 60% 60% 0 0' : node.shape === 'wave' ? '50% 50% 0 0 / 42% 42% 0 0' : node.shape === 'wave-bottom' ? '0 0 50% 50% / 0 0 42% 42%' : `${node.borderRadius || 0}px`;
  const clipPath = node.clipPath || (node.shape === 'angled' ? 'polygon(0 0,100% 0,88% 100%,0 100%)' : 'none');
  const padding = Math.max(0, Number(node.padding ?? 1.5) || 0);
  const verticalPadding = Math.min(1.25, padding * 0.45);
  const horizontalPadding = Math.min(2.2, padding);
  const textualNode = node.type === 'text' || node.type === 'field' || node.type === 'section';
  const borderStyle = node.borderStyle || (node.type === 'table' || node.type === 'divider' ? 'solid' : 'none');
  Object.assign(element.style, {
    position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%`, height: `${node.height}%`, boxSizing: 'border-box',
    padding: `${verticalPadding}% ${horizontalPadding}%`, color: safeHtml2CanvasColor(node.color || settings.textColor, '#334155'), backgroundColor: safeHtml2CanvasColor(node.backgroundColor, 'transparent'),
    borderColor: safeHtml2CanvasColor(node.borderColor || settings.lineColor, '#e2e8f0'), borderStyle, borderWidth: node.type === 'divider' ? '1px' : borderStyle === 'none' ? '0' : '1px', borderRadius, clipPath, opacity: String(node.opacity ?? 1), transform: node.rotation ? `rotateZ(${node.rotation}deg)` : '', transformOrigin: 'center center', fontSize: pdfPointsToCss(node.fontSize || settings.fontSize || 9),
    fontFamily: browserFontFamily(node.fontFamily || settings.fontFamily), fontWeight: String(node.fontWeight || (node.bold ? 700 : 400)), fontStyle: node.italic ? 'italic' : 'normal', textAlign: node.align || 'left',
    textDecorationLine: [node.underline ? 'underline' : '', node.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    textTransform: node.textTransform || 'none', letterSpacing: `${node.letterSpacing || 0}px`,
    overflow: 'hidden', lineHeight: String(node.lineHeight || 1.25), display: textualNode ? 'flex' : 'block', alignItems: node.type === 'section' && node.id === 'party-section' ? 'flex-start' : 'center',
    WebkitFontSmoothing: 'antialiased', textRendering: 'geometricPrecision', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
  });
}

function createTextNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  appendVectorShapeBackground(element, node, settings);
  const rawContent = node.type === 'section' && isDecorativeSection(node) ? '' : node.type === 'field' ? tokenValue(node, data) : node.text || node.sample || node.label;
  const isStatusField = node.type === 'field' && (node.id === 'document-status' || /estado|status/i.test(`${node.label || ''} ${node.token || ''}`));
  const content = isStatusField && rawContent ? `Estado: ${pdfStatusLabel(rawContent)}` : rawContent;
  if (partyField(node)) {
    Object.assign(element.style, { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '1px', padding: '0.2% 0.4%' });
    const fieldLabel = document.createElement('span');
    fieldLabel.textContent = node.label;
    Object.assign(fieldLabel.style, { display: 'block', width: '100%', color: '#64748b', fontSize: pdfPointsToCss(5.8), fontWeight: '700', letterSpacing: '0.35px', textTransform: 'uppercase', lineHeight: '1' });
    const fieldValue = document.createElement('span');
    fieldValue.textContent = content || '—';
    Object.assign(fieldValue.style, { position: 'relative', zIndex: '1', display: 'block', width: '100%', color: safeHtml2CanvasColor(node.color || settings.textColor, '#334155'), fontSize: pdfPointsToCss(node.fontSize || 8), fontWeight: String(node.fontWeight || (node.bold ? 700 : 400)), lineHeight: '1.15', textAlign: node.align || 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
    element.append(fieldLabel, fieldValue);
  } else if (content) {
    const text = document.createElement('span');
    text.textContent = content;
    Object.assign(text.style, { position: 'relative', zIndex: '1', display: 'flex', width: '100%', height: '100%', alignItems: node.type === 'section' && node.id === 'party-section' ? 'flex-start' : 'center', justifyContent: 'flex-start', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
    if (node.type === 'section' && node.id === 'party-section') {
      Object.assign(text.style, { fontSize: pdfPointsToCss(7), fontWeight: '700', letterSpacing: '0.45px', textTransform: 'uppercase', color: safeHtml2CanvasColor(node.color || settings.textColor, '#334155') });
    }
    element.appendChild(text);
  }
  if (node.type === 'divider') {
    element.textContent = '';
    element.style.borderStyle = 'none';
    element.style.borderWidth = '0';
    element.style.borderTopStyle = 'solid';
    element.style.borderTopWidth = '1px';
    element.style.borderTopColor = safeHtml2CanvasColor(node.borderColor || node.color || settings.lineColor, '#e2e8f0');
    element.style.padding = '0';
  }
  if (node.type === 'spacer') element.style.backgroundColor = 'transparent';
  return element;
}

function createTableNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  element.style.padding = '0';
  element.style.borderStyle = 'solid'; element.style.borderWidth = '1px';
  const table = document.createElement('table');
  // Esta tabla vive en un lienzo de impresión; no debe ser transformada en
  // tarjetas por el hook responsive global mientras html2canvas la captura.
  table.setAttribute('data-responsive-cards', 'false');
  table.style.width = '100%'; table.style.height = '100%'; table.style.borderCollapse = 'collapse'; table.style.borderSpacing = '0';
  const columns = node.columns?.length ? node.columns : [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'total', label: 'Total', token: 'total', width: 30, align: 'right' as const }];
  const compact = columns.length >= 6;
  table.style.fontSize = pdfPointsToCss(Math.max(compact ? 6.5 : 7, (node.fontSize || settings.fontSize || 9) - (compact ? 2 : 1)));
  table.style.fontFamily = browserFontFamily(node.fontFamily || settings.fontFamily); table.style.tableLayout = 'fixed'; table.style.lineHeight = compact ? '1.12' : '1.25';
  const head = table.createTHead().insertRow();
  const tableLayout = settings.tableLayout || 'standard';
  const primaryColor = safeHtml2CanvasColor(settings.primaryColor, '#10b981');
  const textColor = safeHtml2CanvasColor(settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const headerBackground = tableLayout === 'minimal' || tableLayout === 'ledger' ? '#ffffff' : primaryColor;
  const headerColor = tableLayout === 'minimal' || tableLayout === 'ledger' ? textColor : '#ffffff';
  const rowBackground = tableLayout === 'striped' || tableLayout === 'standard' || tableLayout === 'accent' ? '#f8fafc' : 'transparent';
  columns.forEach(column => { const cell = head.insertCell(); cell.textContent = column.label; cell.style.width = `${column.width || 25}%`; cell.style.textAlign = column.align || 'left'; cell.style.padding = compact ? '4px 4px' : '7px 8px'; cell.style.backgroundColor = headerBackground; cell.style.color = headerColor; cell.style.fontWeight = '700'; cell.style.fontSize = pdfPointsToCss(Math.max(compact ? 6.2 : 7, (node.fontSize || settings.fontSize || 9) - (compact ? 2.5 : 1.5))); cell.style.letterSpacing = compact ? '0' : '0.15px'; cell.style.textTransform = 'uppercase'; cell.style.borderBottom = `${compact ? 1 : 2}px solid ${primaryColor}`; });
  const body = table.createTBody();
  asRows(data).slice(0, 30).forEach((row, rowIndex) => {
    const tr = body.insertRow();
    columns.forEach(column => { const cell = tr.insertCell(); const rawValue = row[column.token] ?? row[column.id]; cell.textContent = isStatusColumn(column) ? pdfStatusLabel(rawValue) : escapeValue(rawValue); cell.style.padding = compact ? '3px 4px' : tableLayout === 'compact' ? '4px 6px' : '6px 8px'; cell.style.borderTop = `1px solid ${lineColor}`; cell.style.textAlign = column.align || 'left'; const isDescription = column.token === 'description' || column.id === 'description' || /descrip|concepto|detalle/i.test(`${column.label || ''} ${column.token || ''} ${column.id || ''}`) || String(rawValue ?? '').includes('\n'); cell.style.verticalAlign = isDescription ? 'top' : 'middle'; cell.style.lineHeight = compact ? '1.12' : '1.25'; cell.style.whiteSpace = isDescription ? 'pre-wrap' : 'normal'; cell.style.overflowWrap = 'anywhere'; if (rowIndex % 2 && rowBackground !== 'transparent') cell.style.backgroundColor = rowBackground; if (tableLayout === 'boxed' || tableLayout === 'cards') cell.style.borderLeft = `1px solid ${lineColor}`; });
  });
  element.appendChild(table);
  return element;
}

function createTotalsNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  element.style.borderStyle = 'none'; element.style.borderWidth = '0';
  element.style.padding = '8px 10px';
  element.style.fontSize = pdfPointsToCss(Math.max(8, (node.fontSize || settings.fontSize || 9) - 0.5));
  const totals = data.totals || {};
  [['subtotal', 'Subtotal'], ['tax', 'Impuestos'], ['discount', 'Descuento'], ['total', 'Total']].forEach(([key, label]) => {
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.gap = '8px'; row.style.marginBottom = '4px'; row.style.lineHeight = '1.2'; row.style.fontSize = pdfPointsToCss(key === 'total' ? 9.5 : 8); if (key === 'total') { row.style.borderTop = `1px solid ${safeHtml2CanvasColor(settings.lineColor, '#e2e8f0')}`; row.style.paddingTop = '5px'; row.style.fontWeight = '700'; }
    const labelElement = document.createElement('span'); labelElement.textContent = label;
    const valueElement = document.createElement('span'); valueElement.textContent = escapeValue(totals[key]);
    valueElement.style.fontWeight = key === 'total' ? '800' : '600';
    row.append(labelElement, valueElement); element.appendChild(row);
  });
  return element;
}

function createBarcodeNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  element.style.border = '0';
  element.style.padding = '0';
  const canvas = document.createElement('canvas');
  const value = tokenValue(node, data) || node.sample || '000000000000';
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: 1.5,
      height: 34,
      displayValue: true,
      fontSize: Math.max(9, Math.min(22, Math.round((Number(node.fontSize) || 8) * 1.333 * PDF_DEFAULT_FONT_SCALE))),
      margin: 0,
      textMargin: 1,
      background: 'transparent',
      lineColor: safeHtml2CanvasColor(node.color, '#111827'),
    });
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    element.appendChild(canvas);
  } catch {
    element.textContent = value;
    element.style.textAlign = node.align || 'center';
  }
  return element;
}

function createNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  if (node.type === 'table') return createTableNode(node, data, settings);
  if (node.type === 'totals') return createTotalsNode(node, data, settings);
  if (node.type === 'barcode') return createBarcodeNode(node, data, settings);
  if (node.type === 'image') {
    const element = document.createElement('div');
    setBaseNodeStyle(element, node, settings);
    element.style.display = 'flex';
    element.style.alignItems = 'center';
    element.style.justifyContent = node.align === 'right' ? 'flex-end' : node.align === 'center' ? 'center' : 'flex-start';
    element.style.border = '0';
    element.style.padding = '0';
    const logo = typeof data.logo === 'string' ? data.logo : typeof data.company?.logo === 'string' ? data.company.logo : '';
    const fallback = createLogoFallback(data, settings);
    fallback.style.display = logo ? 'none' : 'flex';
    if (logo && /^(data:image\/|https?:\/\/|\/)/i.test(logo)) {
      const image = document.createElement('img');
      image.src = logo;
      image.alt = 'Logo de la empresa';
      image.style.maxWidth = '100%'; image.style.maxHeight = '100%'; image.style.objectFit = 'contain'; image.style.display = 'block';
      image.addEventListener('load', () => { fallback.style.display = 'none'; }, { once: true });
      image.addEventListener('error', () => { image.remove(); fallback.style.display = 'flex'; }, { once: true });
      element.appendChild(image);
    }
    element.appendChild(fallback);
    return element;
  }
  return createTextNode(node, data, settings);
}

function renderPage(definition: PdfTemplateDefinition, settings: PdfTemplateRenderSettings, data: PdfTemplateData, width: number, height: number) {
  const page = document.createElement('div');
  Object.assign(page.style, { position: 'relative', width: `${width}mm`, height: `${height}mm`, overflow: 'hidden', background: safeHtml2CanvasColor(definition.page.background, '#ffffff'), color: safeHtml2CanvasColor(settings.textColor, '#334155'), boxSizing: 'border-box' });
  const hasParty = definition.nodes.some(node => partyField(node) && hasRenderablePartyValue(node, data));
  definition.nodes
    .filter(node => node.enabled !== false && (node.page || 1) === 1)
    .filter(node => node.id !== 'party-section' || hasParty)
    .filter(node => !partyField(node) || hasRenderablePartyValue(node, data))
    .forEach(node => page.appendChild(createNode(node, data, settings)));
  if (settings.watermark?.trim()) { const watermark = document.createElement('div'); Object.assign(watermark.style, { position: 'absolute', inset: '38% 0 auto', textAlign: 'center', transform: 'rotate(-28deg)', color: safeHtml2CanvasColor(settings.primaryColor, '#10b981'), opacity: String((settings.watermarkOpacity || 12) / 100), fontSize: '42px', fontWeight: '800' }); watermark.textContent = settings.watermark; page.appendChild(watermark); }
  return page;
}

export async function renderPdfTemplateToPdf({ definition, settings, targetKey, data, fileName, save = true }: PdfTemplateRenderOptions) {
  if (typeof document === 'undefined') throw new Error('La plantilla PDF requiere un navegador.');
  // Las vistas reciben el branding por distintas capas (ThemeContext,
  // sessionBranding o clientTenant). El almacenamiento de sesión es la fuente
  // común del contexto de sucursal y evita que un reporte pierda el logo solo
  // porque su componente no recibió themeConfig.logo en ese render.
  const runtimeLogo = typeof data?.logo === 'string' && data.logo
    ? data.logo
    : typeof data?.company?.logo === 'string' && data.company.logo
      ? data.company.logo
      : rememberedSessionLogo();
  const safeLogo = await prepareLogoSource(runtimeLogo);
  const renderData: PdfTemplateData = safeLogo
    ? { ...(data || {}), logo: safeLogo, company: { ...(data?.company || {}), logo: safeLogo } }
    : { ...(data || {}), logo: undefined, company: { ...(data?.company || {}), logo: undefined } };
  // El predeterminado virtual se construye inicialmente sin conocer el logo de
  // la sucursal. Regenerarlo aquí evita que el logo aparezca encima del nombre
  // y conserva las proporciones correctas de cada composición de biblioteca.
  const baseDefinition = safeLogo && definition.metadata?.preset === 'system-default'
    ? createDefaultTemplateDefinition(targetKey, { ...settings, logoUrl: safeLogo })
    : definition;
  const effectiveDefinition = applyRuntimeTableColumns(baseDefinition, renderData);
  const [baseWidth, baseHeight] = pageDimensions(settings.paperSize);
  const width = settings.orientation === 'landscape' ? baseHeight : baseWidth;
  const height = settings.orientation === 'landscape' ? baseWidth : baseHeight;
  const rows = asRows(data || {});
  const tableNode = effectiveDefinition.nodes.find(node => node.type === 'table');
  const isRepeatedLabel = getPdfTemplateTarget(targetKey).key === 'inventario.product-labels';
  // La escala tipográfica hace que las tablas de reportes (normalmente con
  // seis o más columnas) necesiten menos filas por página para que correos,
  // direcciones e identificaciones no queden recortados por la caja fija.
  const denseTable = Boolean(tableNode && (tableNode.columns?.length || 0) >= 6);
  const chunkSize = tableNode && denseTable ? 9 : tableNode && rows.length > 14 ? 14 : Math.max(rows.length, 1);
  const chunks = tableNode && rows.length ? Array.from({ length: Math.ceil(rows.length / chunkSize) }, (_, index) => rows.slice(index * chunkSize, (index + 1) * chunkSize)) : [[]];
  const renderChunks = isRepeatedLabel && rows.length ? rows.map(row => [row]) : chunks;
  const pdf = new jsPDF({ orientation: settings.orientation, unit: 'mm', format: [width, height], compress: true });
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, { position: 'fixed', left: '-100000px', top: '0', width: '1px', height: '1px', overflow: 'visible', opacity: '1', pointerEvents: 'none' });
  document.body.appendChild(wrapper);
  try {
    for (let index = 0; index < renderChunks.length; index += 1) {
      const currentChunk = renderChunks[index];
      const pageData = normalizeData({ ...renderData, ...(tableNode || isRepeatedLabel ? { items: currentChunk, rows: currentChunk } : {}) }, settings, targetKey, index + 1, renderChunks.length);
      const page = renderPage(effectiveDefinition, settings, pageData, width, height);
      page.id = `pdf-template-page-${index}`;
      wrapper.appendChild(page);
      await waitForImages(page);
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: safeHtml2CanvasColor(effectiveDefinition.page.background, '#ffffff'), logging: false, useCORS: true, allowTaint: false, onclone: (clonedDoc) => sanitizeHtml2CanvasOklch(page.id, clonedDoc, safeHtml2CanvasColor(settings.primaryColor, '#10b981')) });
      if (index > 0) pdf.addPage([width, height], settings.orientation === 'landscape' ? 'l' : 'p');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height, undefined, 'FAST');
      page.remove();
    }
    const blob = pdf.output('blob');
    if (save) pdf.save(fileName || `${getPdfTemplateTarget(targetKey).key.replace(/[^a-z0-9.-]+/gi, '-')}.pdf`);
    return { doc: pdf, blob };
  } finally { wrapper.remove(); }
}
