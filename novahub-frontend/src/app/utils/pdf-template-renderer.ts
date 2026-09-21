import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { createDefaultTemplateDefinition, PDF_DEFAULT_FONT_SCALE, resolveTemplateToken, type PdfTemplateChart, type PdfTemplateColumn, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode, type PdfTemplateReportSection } from '../services/pdf-template-definition';
import { getBase64Image, safeHtml2CanvasColor } from './export-utils';
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
  if (paperSize === 'ROLL-80') return [80, 200];
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
function shouldAdaptReportWidths(targetKey: string) {
  return targetKey.startsWith('compras.')
    || targetKey.startsWith('reportes.')
    || targetKey === 'ventas.cash-historical-report'
    || targetKey === 'ventas.customer-history';
}

function reportColumnWeight(label: string) {
  const normalized = label.toLocaleLowerCase('es-NI');
  if (/descrip|detalle|concepto/.test(normalized)) return 2.4;
  if (/proveedor|nombre|direcci[oó]n/.test(normalized)) return 1.5;
  if (/categor[ií]a/.test(normalized)) return 0.75;
  if (/referencia|orden|solicitud|factura|c[oó]digo|documento/.test(normalized)) return 1.15;
  if (/total|monto|pagado|comprometido|saldo|precio|ventas|diferencia/.test(normalized)) return 1;
  if (/fecha/.test(normalized)) return 0.65;
  if (/estado/.test(normalized)) return 0.55;
  if (/m[eé]todo|tipo|[íi]tems?|cantidad|frecuencia/.test(normalized)) return 0.55;
  if (/sucursal|cajero|caja/.test(normalized)) return 1.1;
  return 0.9;
}

/**
 * Las plantillas guardadas pueden conservar anchos antiguos. Los listados
 * globales necesitan que el ancho se calcule a partir del contenido real,
 * especialmente para descripción/proveedor, que son las columnas que más se
 * cortan cuando el diseño fue creado para un reporte individual.
 */
function adaptReportColumnWidths(columns: PdfTemplateColumn[], enabled: boolean) {
  if (!enabled || columns.length < 5) return columns;
  const weights = columns.map(column => reportColumnWeight(column.label));
  const total = weights.reduce((sum, weight) => sum + weight, 0) || 1;
  return columns.map((column, index) => ({ ...column, width: (weights[index] / total) * 100 }));
}

function runtimeTableColumns(data: PdfTemplateData | undefined, adaptWidths = false): PdfTemplateColumn[] {
  if (!Array.isArray(data?.tableColumns)) return [];
  const source = data.tableColumns as Array<Partial<PdfTemplateColumn>>;
  const usable = source.filter(column => column && typeof column.label === 'string' && (column.token || column.id));
  if (!usable.length) return [];
  const defaultWidth = 100 / usable.length;
  const columns = usable.slice(0, 10).map((column, index) => ({
    id: String(column.id || `column-${index}`),
    label: String(column.label),
    token: String(column.token || column.id || `column-${index}`),
    width: Number.isFinite(Number(column.width)) && Number(column.width) > 0 ? Number(column.width) : defaultWidth,
    align: column.align === 'center' || column.align === 'right' ? column.align : 'left',
  }));
  return adaptReportColumnWidths(columns, adaptWidths);
}

function applyRuntimeTableColumns(definition: PdfTemplateDefinition, data: PdfTemplateData | undefined, adaptWidths = false) {
  const columns = runtimeTableColumns(data, adaptWidths);
  if (!columns.length) return definition;
  return {
    ...definition,
    nodes: definition.nodes.map(node => node.type === 'table' ? { ...node, columns } : node),
  };
}

function reportRowUnits(section: PdfTemplateReportSection, row: Record<string, unknown>) {
  const fallbackWidth = 100 / Math.max(1, section.columns.length);
  const lineCount = section.columns.reduce((maxLines, column) => {
    const rawValue = row[column.token] ?? row[column.id];
    const width = Math.max(8, Number(column.width) || fallbackWidth);
    const charactersPerLine = Math.max(8, Math.floor(width * 0.9));
    const lines = String(rawValue ?? '—').split('\n').reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0);
    return Math.max(maxLines, lines);
  }, 1);
  return Math.max(1.15, 0.35 + lineCount * 0.8);
}

function chunkTableRows(rows: Array<Record<string, unknown>>, columns: PdfTemplateColumn[], capacity: number) {
  const section = { id: 'table', title: '', columns, rows };
  const chunks: Array<Array<Record<string, unknown>>> = [];
  let current: Array<Record<string, unknown>> = [];
  let used = 0;
  rows.forEach(row => {
    const units = reportRowUnits(section, row);
    if (current.length && used + units > capacity) {
      chunks.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += units;
  });
  if (current.length) chunks.push(current);
  return chunks;
}

export function paginatePdfReportSections(sections: PdfTemplateReportSection[]) {
  const groups: PdfTemplateReportSection[][] = [];
  let current: PdfTemplateReportSection[] = [];
  let used = 0;
  let pageIndex = 0;
  const capacity = () => pageIndex === 0 ? 11 : 20;
  const flush = () => {
    if (!current.length) return;
    groups.push(current);
    current = [];
    used = 0;
    pageIndex += 1;
  };

  sections.forEach(section => {
    const rows = Array.isArray(section.rows) ? section.rows : [];
    let offset = 0;
    if (!rows.length) {
      if (current.length && used + 2.5 > capacity()) flush();
      current.push({ ...section, rows: [] });
      used += 2.5;
      return;
    }
    while (offset < rows.length) {
      if (current.length && used + 2.5 > capacity()) flush();
      const available = Math.max(1.15, capacity() - used - 2.5);
      let take = 0;
      let sectionUnits = 0;
      while (offset + take < rows.length) {
        const nextUnits = reportRowUnits(section, rows[offset + take]);
        if (take > 0 && sectionUnits + nextUnits > available) break;
        sectionUnits += nextUnits;
        take += 1;
        if (sectionUnits >= available) break;
      }
      if (!take) {
        if (current.length) {
          flush();
          continue;
        }
        take = 1;
        sectionUnits = reportRowUnits(section, rows[offset]);
      }
      current.push({ ...section, rows: rows.slice(offset, offset + take) });
      offset += take;
      used += 2.5 + sectionUnits;
      if (offset < rows.length || used >= capacity() - 1) flush();
    }
  });
  flush();
  return groups;
}

function normalizeData(data: PdfTemplateData | undefined, settings: PdfTemplateRenderSettings, targetKey: string, pageNumber: number, pageCount: number): PdfTemplateData {
  const target = getPdfTemplateTarget(targetKey);
  const source = data || {};
  const firstRow = asRows(source)[0];
  const sourceCompany = source.company || {};
  const configuredSettings = settings as PdfTemplateRenderSettings & Record<string, unknown>;
  const company = {
    ...sourceCompany,
    name: configuredSettings.companyName || sourceCompany.name,
    slogan: configuredSettings.slogan || sourceCompany.slogan,
    fiscalInfo: configuredSettings.fiscalInfo || sourceCompany.fiscalInfo,
    address: configuredSettings.address || sourceCompany.address,
    phone: configuredSettings.phone || sourceCompany.phone,
    email: configuredSettings.email || sourceCompany.email,
    website: configuredSettings.website || sourceCompany.website,
  };
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
    display: 'flex', width: '100%', height: '100%', minWidth: '0', minHeight: '0',
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
    // Los logos se convierten a data URLs antes de llegar aquí. Cuando el
    // navegador ya marcó la imagen como completa no hay motivo para esperar a
    // que termine una decodificación secundaria antes de rasterizar la página.
    if (image.complete) {
      finish();
      return;
    }
    // Solo las imágenes externas que todavía no terminaron de cargar usan un
    // pequeño margen de seguridad. La espera fija anterior se repetía por
    // cada página y podía sumar varios segundos en un reporte individual.
    window.setTimeout(finish, 750);
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
  const borderStyle = node.borderStyle || (node.type === 'table' || node.type === 'report-sections' || node.type === 'divider' ? 'solid' : 'none');
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
  const isHeaderText = ['company-name', 'document-title', 'document-number', 'document-status', 'company-summary', 'document-date', 'report-meta'].includes(node.id)
    || (node.type === 'field' && /^(company\.(name|summary)|document\.(title|number|status|date|meta))$/.test(String(node.token || '')));
  const isReportKpiLabel = node.type === 'field' && /^report-kpi-label-\d+$/.test(node.id);
  const isProductLabelName = node.id === 'label-name';
  const isProductLabelValue = node.id === 'label-price' || node.id === 'label-company' || node.id === 'label-date';
  const content = isStatusField && rawContent ? `Estado: ${pdfStatusLabel(rawContent)}` : rawContent;
  // El canvas deja que el contenido del encabezado respire dentro de su caja;
  // el exportador debe conservar ese mismo comportamiento para no desplazar o
  // recortar el nombre, título, número y datos de la sucursal.
  if (isHeaderText) element.style.overflow = 'visible';
  if (partyField(node)) {
    Object.assign(element.style, { height: 'auto', minHeight: '0', overflow: 'visible', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: '1px', padding: '0.2% 0.4%' });
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
    const contentLength = String(content).trim().length;
    const productLabelFontSize = isProductLabelName
      ? Math.max(5.8, Math.min(Number(node.fontSize) || 7.5, 8.6 - Math.max(0, contentLength - 18) * 0.11))
      : isProductLabelValue
        ? Math.max(4.2, Math.min(Number(node.fontSize) || 8, 8.6 - Math.max(0, contentLength - 22) * 0.08))
        : undefined;
    Object.assign(text.style, {
      position: 'relative', zIndex: '1', display: 'block', width: '100%', height: 'auto', minWidth: '0', minHeight: '0',
      justifyContent: isReportKpiLabel ? 'center' : 'flex-start', textAlign: isReportKpiLabel ? 'center' : node.align || 'left',
      whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'normal', overflow: 'visible',
      ...(isReportKpiLabel ? { lineHeight: '1.05', padding: '0 2px' } : {}),
      ...(isProductLabelName ? { fontSize: pdfPointsToCss(productLabelFontSize, 5.5), lineHeight: '1.05', whiteSpace: 'normal', wordBreak: 'break-word' } : {}),
      ...(isProductLabelValue ? { fontSize: pdfPointsToCss(productLabelFontSize, 4.2), lineHeight: '1', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } : {}),
    });
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
  // Una tabla con pocas filas no debe conservar la altura editorial del nodo:
  // el navegador estira sus filas para llenar una tabla con height: 100%,
  // dejando el contenido suspendido en medio de un gran espacio vacío.
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.overflow = 'visible';
  element.style.padding = '0';
  element.style.borderStyle = 'solid'; element.style.borderWidth = '1px';
  const table = document.createElement('table');
  // Esta tabla vive en un lienzo de impresión; no debe ser transformada en
  // tarjetas por el hook responsive global mientras html2canvas la captura.
  table.setAttribute('data-responsive-cards', 'false');
  table.style.width = '100%'; table.style.height = 'auto'; table.style.borderCollapse = 'collapse'; table.style.borderSpacing = '0';
  const columns = node.columns?.length ? node.columns : [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'total', label: 'Total', token: 'total', width: 30, align: 'right' as const }];
  const compact = columns.length >= 5;
  table.style.fontSize = pdfPointsToCss(Math.max(compact ? 7 : 7.5, (node.fontSize || settings.fontSize || 9) - (compact ? 1.8 : 1)));
  table.style.fontFamily = browserFontFamily(node.fontFamily || settings.fontFamily); table.style.tableLayout = 'fixed'; table.style.lineHeight = compact ? '1.12' : '1.25';
  const head = table.createTHead().insertRow();
  const tableLayout = settings.tableLayout || 'standard';
  const primaryColor = safeHtml2CanvasColor(settings.primaryColor, '#10b981');
  const textColor = safeHtml2CanvasColor(settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const headerBackground = node.tableHeaderColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? '#ffffff' : primaryColor);
  const headerColor = node.tableHeaderTextColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? textColor : '#ffffff');
  const rowBackground = node.tableStripeColor || (tableLayout === 'striped' || tableLayout === 'standard' || tableLayout === 'accent' ? '#f8fafc' : 'transparent');
  columns.forEach(column => { const cell = head.insertCell(); cell.textContent = column.label; cell.style.width = `${column.width || 25}%`; cell.style.minWidth = '0'; cell.style.maxWidth = '100%'; cell.style.boxSizing = 'border-box'; cell.style.textAlign = column.align || 'left'; cell.style.verticalAlign = 'middle'; cell.style.padding = compact ? '5px 6px' : '7px 8px'; cell.style.backgroundColor = safeHtml2CanvasColor(column.backgroundColor || headerBackground, headerBackground); cell.style.color = safeHtml2CanvasColor(column.color || headerColor, headerColor); cell.style.fontWeight = '700'; cell.style.fontSize = pdfPointsToCss(Math.max(compact ? 6.8 : 7.5, (node.fontSize || settings.fontSize || 9) - (compact ? 2 : 1.5))); cell.style.lineHeight = compact ? '1.2' : '1.25'; cell.style.letterSpacing = compact ? '0' : '0.15px'; cell.style.textTransform = 'uppercase'; cell.style.borderBottom = `${compact ? 1 : 2}px solid ${primaryColor}`; cell.style.whiteSpace = 'normal'; cell.style.overflow = 'visible'; cell.style.overflowWrap = 'anywhere'; cell.style.wordBreak = 'break-word'; });
  const body = table.createTBody();
  body.style.height = 'auto';
  // Las filas ya se dividen en trabajos por página antes de renderizar. No
  // volver a truncarlas aquí: ese límite ocultaba registros de exportaciones
  // globales cuando una plantilla recibía más de 30 filas.
  asRows(data).forEach((row, rowIndex) => {
    const tr = body.insertRow();
    tr.style.height = 'auto';
    columns.forEach(column => {
      const cell = tr.insertCell();
      const rawValue = row[column.token] ?? row[column.id];
      cell.textContent = isStatusColumn(column) ? pdfStatusLabel(rawValue) : escapeValue(rawValue);
      cell.style.padding = compact ? '5px 6px' : tableLayout === 'compact' ? '5px 7px' : '7px 9px';
      cell.style.height = 'auto';
      cell.style.maxHeight = 'none';
      cell.style.minWidth = '0';
      cell.style.maxWidth = '100%';
      cell.style.borderTop = `1px solid ${lineColor}`;
      cell.style.textAlign = column.align || 'left';
      const isDescription = column.token === 'description' || column.id === 'description' || /descrip|concepto|detalle/i.test(`${column.label || ''} ${column.token || ''} ${column.id || ''}`) || String(rawValue ?? '').includes('\n');
      const isNumericCell = column.align === 'right' && !isDescription;
      cell.style.verticalAlign = 'middle';
      cell.style.lineHeight = compact ? '1.25' : '1.35';
      cell.style.whiteSpace = isDescription ? 'pre-wrap' : isNumericCell ? 'nowrap' : 'normal';
      cell.style.overflow = 'visible';
      cell.style.overflowWrap = isNumericCell ? 'normal' : 'anywhere';
      cell.style.wordBreak = isNumericCell ? 'normal' : 'break-word';
      if (node.tableRowColor) cell.style.backgroundColor = safeHtml2CanvasColor(node.tableRowColor, '#ffffff');
      else if (rowIndex % 2 && rowBackground !== 'transparent') cell.style.backgroundColor = safeHtml2CanvasColor(rowBackground, '#f8fafc');
      if (tableLayout === 'boxed' || tableLayout === 'cards') cell.style.borderLeft = `1px solid ${lineColor}`;
    });
  });
  const tableSummary = data.tableSummary && typeof data.tableSummary === 'object'
    ? data.tableSummary as Record<string, unknown>
    : null;
  if (tableSummary) {
    const footer = table.createTFoot().insertRow();
    columns.forEach((column, columnIndex) => {
      const cell = footer.insertCell();
      const rawValue = tableSummary[column.token] ?? tableSummary[column.id] ?? (columnIndex === 0 ? tableSummary.label : '');
      cell.textContent = escapeValue(rawValue);
      cell.style.padding = compact ? '4px 4px' : '6px 8px';
      cell.style.borderTop = `2px solid ${primaryColor}`;
      cell.style.backgroundColor = '#f8fafc';
      cell.style.color = textColor;
      cell.style.fontWeight = '700';
      cell.style.textAlign = column.align || 'left';
      cell.style.whiteSpace = column.align === 'right' ? 'nowrap' : 'normal';
      cell.style.overflow = 'visible';
      cell.style.overflowWrap = column.align === 'right' ? 'normal' : 'anywhere';
    });
  }
  element.appendChild(table);
  return element;
}

function createReportSectionsNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  const pageNumber = Number((data.page as Record<string, unknown> | undefined)?.number || 1);
  if (pageNumber > 1) {
    if (Number.isFinite(Number(node.subsequentY))) element.style.top = `${Number(node.subsequentY)}%`;
    if (Number.isFinite(Number(node.subsequentHeight))) element.style.height = `${Number(node.subsequentHeight)}%`;
  }
  // Las secciones tienen una cantidad de filas variable. Mantener la altura
  // fija de la caja deja grandes espacios en blanco y puede recortar el título
  // de la siguiente sección. La caja debe crecer con sus tablas renderizadas.
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.padding = '0';
  element.style.borderStyle = 'solid';
  element.style.borderWidth = '1px';
  // La altura de cada encabezado depende de cuánto envuelva el texto. Si el
  // contenedor recorta su contenido, los encabezados de las primeras tablas
  // (que suelen tener columnas más largas) quedan cortados en la captura.
  element.style.overflow = 'visible';

  const sections = Array.isArray(data.reportSections) ? data.reportSections : [];
  const content = document.createElement('div');
  Object.assign(content.style, { width: '100%', height: 'auto', minHeight: '0', overflow: 'visible', padding: '5px 7px', boxSizing: 'border-box' });
  const tableLayout = settings.tableLayout || 'standard';
  const primaryColor = safeHtml2CanvasColor(settings.primaryColor, '#10b981');
  const textColor = safeHtml2CanvasColor(settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const headerBackground = node.tableHeaderColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? '#ffffff' : primaryColor);
  const headerColor = node.tableHeaderTextColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? textColor : '#ffffff');
  const rowBackground = node.tableStripeColor || '#f8fafc';
  const compact = tableLayout === 'compact' || sections.some(section => section.columns.length >= 5);

  sections.forEach((section, sectionIndex) => {
    const styleIndex = section.templateIndex ?? sectionIndex;
    const sectionStyle = node.reportSectionStyles?.[String(styleIndex)] || {};
    const sectionElement = document.createElement('div');
    Object.assign(sectionElement.style, { width: '100%', marginBottom: sectionIndex === sections.length - 1 ? '0' : compact ? '6px' : '9px', overflow: 'visible' });
    const title = document.createElement('div');
    title.textContent = section.title;
    Object.assign(title.style, { display: 'block', boxSizing: 'border-box', height: 'auto', minHeight: pdfPointsToCss(compact ? 9 : 11), color: textColor, fontFamily: browserFontFamily(node.fontFamily || settings.fontFamily), fontSize: pdfPointsToCss(compact ? 9 : 11), fontWeight: '700', lineHeight: '1.25', padding: '2px 0 1px', marginBottom: compact ? '3px' : '5px', whiteSpace: 'normal', overflow: 'visible', overflowWrap: 'anywhere' });
    sectionElement.appendChild(title);

    const table = document.createElement('table');
    Object.assign(table.style, { width: '100%', height: 'auto', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: browserFontFamily(node.fontFamily || settings.fontFamily), fontSize: pdfPointsToCss(compact ? 7 : 7.5), lineHeight: compact ? '1.25' : '1.3' });
    table.setAttribute('data-responsive-cards', 'false');
    const head = table.createTHead().insertRow();
    Object.assign(head.style, { backgroundColor: safeHtml2CanvasColor(sectionStyle.headerColor || headerBackground, headerBackground), color: safeHtml2CanvasColor(sectionStyle.headerTextColor || headerColor, headerColor), height: 'auto', lineHeight: compact ? '1.15' : '1.2' });
    section.columns.forEach((column, columnIndex) => {
      const cell = head.insertCell();
      cell.textContent = column.label;
      const configuredColumn = node.columns?.[columnIndex];
      Object.assign(cell.style, { width: `${column.width || 100 / Math.max(1, section.columns.length)}%`, minWidth: '0', maxWidth: '100%', boxSizing: 'border-box', textAlign: column.align || 'left', verticalAlign: 'middle', padding: compact ? '5px 6px' : '7px 8px', backgroundColor: safeHtml2CanvasColor(column.backgroundColor || sectionStyle.columnColors?.[String(columnIndex)] || configuredColumn?.backgroundColor || sectionStyle.headerColor || headerBackground, headerBackground), color: safeHtml2CanvasColor(column.color || sectionStyle.columnTextColors?.[String(columnIndex)] || configuredColumn?.color || sectionStyle.headerTextColor || headerColor, headerColor), fontWeight: '700', fontSize: pdfPointsToCss(compact ? 6.8 : 7.5), lineHeight: compact ? '1.2' : '1.25', textTransform: 'uppercase', borderBottom: `2px solid ${sectionStyle.headerColor || primaryColor}`, whiteSpace: 'normal', overflow: 'visible', overflowWrap: 'anywhere', wordBreak: 'break-word' });
    });
  const body = table.createTBody();
    body.style.height = 'auto';
    const rows = section.rows;
    rows.forEach((row, rowIndex) => {
      const tr = body.insertRow();
      tr.style.height = 'auto';
      section.columns.forEach(column => {
        const cell = tr.insertCell();
        const rawValue = row[column.token] ?? row[column.id];
        cell.textContent = isStatusColumn(column) ? pdfStatusLabel(rawValue) : escapeValue(rawValue ?? '—');
        Object.assign(cell.style, { padding: compact ? '5px 6px' : '7px 8px', height: 'auto', maxHeight: 'none', minWidth: '0', maxWidth: '100%', color: textColor, borderTop: `1px solid ${lineColor}`, textAlign: column.align || 'left', verticalAlign: 'middle', whiteSpace: 'pre-wrap', overflow: 'visible', overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: compact ? '1.25' : '1.35', backgroundColor: sectionStyle.rowColor || node.tableRowColor ? safeHtml2CanvasColor(sectionStyle.rowColor || node.tableRowColor, '#ffffff') : rowIndex % 2 === 1 && ['standard', 'striped', 'accent'].includes(tableLayout) ? safeHtml2CanvasColor(sectionStyle.stripeColor || rowBackground, '#f8fafc') : 'transparent' });
      });
    });
    sectionElement.appendChild(table);
    const tableSummary = data.tableSummary && typeof data.tableSummary === 'object'
      ? data.tableSummary as Record<string, unknown>
      : null;
    if (tableSummary && sectionIndex === sections.length - 1) {
      const footer = table.createTFoot().insertRow();
      section.columns.forEach((column, columnIndex) => {
        const cell = footer.insertCell();
        const rawValue = tableSummary[column.token] ?? tableSummary[column.id] ?? (columnIndex === 0 ? tableSummary.label : '');
        cell.textContent = escapeValue(rawValue);
        cell.style.padding = compact ? '4px 4px' : '5px 6px';
        cell.style.borderTop = `2px solid ${primaryColor}`;
        cell.style.backgroundColor = '#f8fafc';
        cell.style.color = textColor;
        cell.style.fontWeight = '700';
        cell.style.textAlign = column.align || 'left';
        cell.style.whiteSpace = column.align === 'right' ? 'nowrap' : 'normal';
        cell.style.overflow = 'visible';
        cell.style.overflowWrap = column.align === 'right' ? 'normal' : 'anywhere';
      });
    }
    content.appendChild(sectionElement);
  });
  if (!sections.length) {
    const empty = document.createElement('div');
    empty.textContent = 'Sin secciones para el período';
    Object.assign(empty.style, { padding: '10px', color: '#64748b', fontSize: pdfPointsToCss(8) });
    content.appendChild(empty);
  }
  element.appendChild(content);
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
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.gap = '8px'; row.style.marginBottom = key === 'total' ? '0' : '2px'; row.style.lineHeight = '1.2'; row.style.fontSize = pdfPointsToCss(key === 'total' ? 9.5 : 8); if (key === 'total') { row.style.borderTop = `1px solid ${safeHtml2CanvasColor(settings.lineColor, '#e2e8f0')}`; row.style.paddingTop = '3px'; row.style.fontWeight = '700'; }
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
  const isProductLabelBarcode = node.id === 'label-barcode';
  Object.assign(element.style, {
    border: '0',
    padding: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  });
  const canvas = document.createElement('canvas');
  const value = tokenValue(node, data) || node.sample || '000000000000';
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: isProductLabelBarcode ? 1.8 : 1.5,
      height: isProductLabelBarcode ? 30 : 34,
      displayValue: true,
      fontSize: Math.max(8, Math.min(22, Math.round((Number(node.fontSize) || 8) * 1.2 * PDF_DEFAULT_FONT_SCALE))),
      margin: 0,
      textMargin: isProductLabelBarcode ? 2 : 1,
      background: 'transparent',
      lineColor: safeHtml2CanvasColor(node.color, '#111827'),
    });
    Object.assign(canvas.style, {
      display: 'block',
      width: '100%',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
    });
    element.appendChild(canvas);
  } catch {
    element.textContent = value;
    Object.assign(element.style, {
      color: safeHtml2CanvasColor(node.color || settings.textColor, '#111827'),
      fontSize: pdfPointsToCss(Math.max(5, Number(node.fontSize) || 7), 5),
      fontWeight: '700',
      lineHeight: '1',
      textAlign: node.align || 'center',
      overflowWrap: 'anywhere',
      wordBreak: 'break-all',
    });
  }
  return element;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgElement<T extends keyof SVGElementTagNameMap>(name: T, attributes: Record<string, string | number>) {
  const element = document.createElementNS(SVG_NS, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function createChartNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  Object.assign(element.style, { display: 'flex', flexDirection: 'column', padding: '4px 6px', gap: '2px', overflow: 'hidden', borderWidth: '1px', boxSizing: 'border-box' });
  const chart = data.dashboardCharts?.find(item => item.id === node.token);
  if (!chart) return element;
  const title = document.createElement('div');
  title.textContent = chart.title || node.label;
  Object.assign(title.style, { flex: '0 0 auto', fontFamily: browserFontFamily(node.fontFamily || settings.fontFamily), fontSize: pdfPointsToCss(7.5), fontWeight: '700', color: safeHtml2CanvasColor(node.color || settings.textColor, '#334155'), lineHeight: '1.15', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' });
  element.appendChild(title);
  const svg = svgElement('svg', { viewBox: '0 0 320 92', preserveAspectRatio: 'none', width: '100%', height: '100%' });
  const labels = chart.labels || [];
  const values = chart.values || chart.series?.[0]?.values || [];
  const palette = chart.colors?.length ? chart.colors : ['#10b981', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444'];
  const textColor = safeHtml2CanvasColor(node.color || settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const safeValues = values.map(value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  const maxValue = Math.max(1, ...safeValues, ...(chart.series || []).flatMap(series => series.values.map(value => Math.max(0, Number(value) || 0))));
  if (!labels.length || (!safeValues.length && !chart.series?.some(series => series.values.length))) {
    const empty = svgElement('text', { x: 160, y: 53, fill: '#64748b', 'font-size': 11, 'text-anchor': 'middle' });
    empty.textContent = 'Sin datos para este período';
    svg.appendChild(empty);
  } else if ((node.chartType || chart.type) === 'donut') {
    const total = safeValues.reduce((sum, value) => sum + value, 0) || 1;
    const radius = 31;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    safeValues.forEach((value, index) => {
      const length = circumference * value / total;
      svg.appendChild(svgElement('circle', { cx: 48, cy: 47, r: radius, fill: 'none', stroke: palette[index % palette.length], 'stroke-width': 15, 'stroke-dasharray': `${length} ${circumference - length}`, 'stroke-dashoffset': -offset, transform: 'rotate(-90 48 47)' }));
      offset += length;
    });
    const center = svgElement('text', { x: 48, y: 51, fill: textColor, 'font-size': 10, 'font-weight': '700', 'text-anchor': 'middle' });
    center.textContent = String(safeValues.reduce((sum, value) => sum + value, 0));
    svg.appendChild(center);
    labels.slice(0, 5).forEach((label, index) => {
      const y = 18 + index * 15;
      svg.appendChild(svgElement('rect', { x: 100, y: y - 7, width: 6, height: 6, rx: 1, fill: palette[index % palette.length] }));
      const itemLabel = svgElement('text', { x: 110, y, fill: textColor, 'font-size': 9 });
      itemLabel.textContent = `${String(label).slice(0, 23)}  ${safeValues[index] ?? 0}`;
      svg.appendChild(itemLabel);
    });
  } else if ((node.chartType || chart.type) === 'bar') {
    const chartValues = safeValues.slice(0, 5);
    const chartLabels = labels.slice(0, chartValues.length);
    const rowHeight = Math.min(17, 72 / Math.max(1, chartValues.length));
    chartValues.forEach((value, index) => {
      const y = 10 + index * rowHeight;
      const label = svgElement('text', { x: 1, y: y + 8, fill: textColor, 'font-size': 8 });
      label.textContent = String(chartLabels[index] || '').slice(0, 13);
      svg.appendChild(label);
      svg.appendChild(svgElement('rect', { x: 105, y: y + 1, width: Math.max(1, (value / maxValue) * 180), height: Math.max(5, rowHeight - 4), rx: 2, fill: palette[index % palette.length], opacity: 0.85 }));
      const valueLabel = svgElement('text', { x: 312, y: y + 8, fill: textColor, 'font-size': 8, 'text-anchor': 'end' });
      valueLabel.textContent = value.toLocaleString('es-NI', { maximumFractionDigits: 1 });
      svg.appendChild(valueLabel);
    });
  } else {
    const series = chart.series?.length ? chart.series : [{ label: chart.title, values: safeValues, color: palette[0] }];
    const allValues = series.flatMap(item => item.values.map(value => Math.max(0, Number(value) || 0)));
    const chartMax = Math.max(1, ...allValues);
    svg.appendChild(svgElement('line', { x1: 8, y1: 70, x2: 312, y2: 70, stroke: lineColor, 'stroke-width': 1 }));
    series.slice(0, 3).forEach((item, seriesIndex) => {
      const color = item.color || palette[seriesIndex % palette.length];
      const points = item.values.slice(0, labels.length).map((value, index, source) => ({ x: 12 + index * (292 / Math.max(source.length - 1, 1)), y: 62 - (Math.max(0, Number(value) || 0) / chartMax) * 48 }));
      if (!points.length) return;
      const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
      const areaPath = `${linePath} L${points[points.length - 1].x},70 L${points[0].x},70 Z`;
      svg.appendChild(svgElement('path', { d: areaPath, fill: color, opacity: 0.12 }));
      svg.appendChild(svgElement('path', { d: linePath, fill: 'none', stroke: color, 'stroke-width': 2.5 }));
      points.forEach(point => svg.appendChild(svgElement('circle', { cx: point.x, cy: point.y, r: 2.5, fill: color })));
    });
    [0, Math.floor((labels.length - 1) / 2), labels.length - 1].filter((index, at, array) => index >= 0 && array.indexOf(index) === at).forEach((index, position) => {
      const x = position === 0 ? 12 : position === 1 ? 160 : 308;
      const label = svgElement('text', { x, y: 88, fill: textColor, 'font-size': 8, 'text-anchor': position === 0 ? 'start' : position === 2 ? 'end' : 'middle' });
      label.textContent = String(labels[index] || '').slice(0, 14);
      svg.appendChild(label);
    });
  }
  element.appendChild(svg);
  return element;
}

function createNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  if (node.type === 'table') return createTableNode(node, data, settings);
  if (node.type === 'report-sections') return createReportSectionsNode(node, data, settings);
  if (node.type === 'chart') return createChartNode(node, data, settings);
  if (node.type === 'totals') return createTotalsNode(node, data, settings);
  if (node.type === 'barcode') return createBarcodeNode(node, data, settings);
  if (node.type === 'image') {
    const element = document.createElement('div');
    setBaseNodeStyle(element, node, settings);
    element.style.border = '0';
    const logo = typeof data.logo === 'string' ? data.logo : typeof data.company?.logo === 'string' ? data.company.logo : '';
    const fallback = createLogoFallback(data, settings);
    fallback.style.display = logo ? 'none' : 'flex';
    if (logo && /^(data:image\/|https?:\/\/|\/)/i.test(logo)) {
      const image = document.createElement('img');
      image.src = logo;
      image.alt = 'Logo de la empresa';
      image.style.width = '100%'; image.style.height = '100%'; image.style.maxWidth = '100%'; image.style.maxHeight = '100%'; image.style.objectFit = 'contain'; image.style.display = 'block';
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
  const pageNumber = Number((data.page as Record<string, unknown> | undefined)?.number || 1);
  const pageCount = Number((data.page as Record<string, unknown> | undefined)?.pages || 1);
  const hasRepeatableReportHeader = pageNumber > 1 && definition.nodes.some(item => item.enabled !== false && item.type !== 'report-sections' && !item.firstPageOnly && Number(item.y || 0) < 30);
  const hasParty = definition.nodes.some(node => partyField(node) && hasRenderablePartyValue(node, data));
  definition.nodes
    .filter(node => node.enabled !== false && (node.page || 1) === 1)
    .filter(node => !(data.dashboardCover === true && node.type === 'report-sections'))
    .filter(node => node.type !== 'chart' || Boolean(data.dashboardCharts?.some(chart => chart.id === node.token)))
    .filter(node => !node.firstPageOnly || Number((data.page as Record<string, unknown> | undefined)?.number || 1) === 1)
    // En un reporte individual los totales y las notas pertenecen a la última
    // página. Dejarlos en cada página hace que ocupen el espacio de la tabla
    // aunque todavía existan filas pendientes por imprimir.
    .filter(node => pageNumber >= pageCount || (node.type !== 'totals' && node.id !== 'notes'))
    .filter(node => !(node.id === 'company-name' && (settings as PdfTemplateRenderSettings & Record<string, unknown>).showCompanyName === false))
    .filter(node => node.id !== 'party-section' || hasParty)
    .filter(node => !partyField(node) || hasRenderablePartyValue(node, data))
    .forEach(node => {
      const continuationNode = node.type === 'report-sections' && pageNumber > 1 && !hasRepeatableReportHeader
        ? { ...node, subsequentY: 8, subsequentHeight: 86 }
        : node;
      const renderedNode = createNode(continuationNode, data, settings);
      renderedNode.dataset.pdfNodeId = node.id;
      renderedNode.dataset.pdfNodeType = node.type;
      page.appendChild(renderedNode);
    });
  if (settings.watermark?.trim()) { const watermark = document.createElement('div'); Object.assign(watermark.style, { position: 'absolute', inset: '38% 0 auto', textAlign: 'center', transform: 'rotate(-28deg)', color: safeHtml2CanvasColor(settings.primaryColor, '#10b981'), opacity: String((settings.watermarkOpacity || 12) / 100), fontSize: '42px', fontWeight: '800' }); watermark.textContent = settings.watermark; page.appendChild(watermark); }
  return page;
}

/**
 * Las plantillas individuales posicionan totales, notas y pie de página con
 * coordenadas absolutas porque esas coordenadas también las usa el canvas de
 * edición. En la exportación, una tabla real puede crecer varias veces más
 * que la muestra del editor. Reacomodamos únicamente los elementos que están
 * después de la tabla, conservando sus anchos y posiciones horizontales.
 */
function reflowIndividualPage(page: HTMLElement, definition: PdfTemplateDefinition) {
  const tableNode = definition.nodes.find(node => node.enabled !== false && (node.type === 'table' || node.type === 'report-sections'));
  if (!tableNode) return;

  const pageRect = page.getBoundingClientRect();
  const renderedNodes = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'));
  const tableElement = renderedNodes.find(element => element.dataset.pdfNodeId === tableNode.id);
  if (!tableElement || pageRect.height <= 0) return;

  const tableRect = tableElement.getBoundingClientRect();
  const tableBottom = tableRect.bottom - pageRect.top;
  const gap = Math.max(4, pageRect.height * 0.012);
  const flowStart = tableBottom + gap;
  const tableY = Number(tableNode.y || 0);
  const candidates = definition.nodes
    .filter(node => node.enabled !== false && node.type !== 'table' && node.type !== 'report-sections')
    .filter(node => Number(node.y || 0) > tableY || node.type === 'totals' || node.id === 'notes')
    .map(node => {
      const element = renderedNodes.find(item => item.dataset.pdfNodeId === node.id);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { node, element, originalTop: rect.top - pageRect.top, height: rect.height };
    })
    .filter((item): item is { node: PdfTemplateNode; element: HTMLElement; originalTop: number; height: number } => Boolean(item));

  if (!candidates.length) return;

  // Totales y notas suelen compartir la misma franja horizontal. Se agrupan
  // para que sigan lado a lado cuando la tabla empuja esa franja hacia abajo.
  const groups = new Map<string, typeof candidates>();
  candidates.forEach(item => {
    const isSummary = item.node.type === 'totals' || item.node.id === 'notes';
    const key = isSummary ? 'summary' : `top-${Math.round(item.originalTop / 2) * 2}`;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  let flowTop = flowStart;
  Array.from(groups.values())
    .sort((left, right) => Math.min(...left.map(item => item.originalTop)) - Math.min(...right.map(item => item.originalTop)))
    .forEach(group => {
      const originalTop = Math.min(...group.map(item => item.originalTop));
      const nextTop = Math.max(originalTop, flowTop);
      group.forEach(item => { item.element.style.top = `${nextTop}px`; });
      const bottom = Math.max(...group.map(item => item.element.getBoundingClientRect().bottom - pageRect.top));
      flowTop = bottom + gap;
    });
}

/**
 * La sección de proveedor/cliente también se renderiza con coordenadas del
 * canvas, pero los datos disponibles cambian entre documentos. Compactamos
 * los campos que sí existen y hacemos que la tabla empiece después del último
 * dato visible, evitando tanto el espacio vacío como los solapamientos.
 */
function reflowPartySection(page: HTMLElement, definition: PdfTemplateDefinition) {
  const partySectionNode = definition.nodes.find(node => node.enabled !== false && node.id === 'party-section');
  const tableNode = definition.nodes.find(node => node.enabled !== false && (node.type === 'table' || node.type === 'report-sections'));
  if (!partySectionNode || !tableNode) return;

  const pageRect = page.getBoundingClientRect();
  if (pageRect.height <= 0) return;
  const renderedNodes = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'));
  const sectionElement = renderedNodes.find(element => element.dataset.pdfNodeId === partySectionNode.id);
  const tableElement = renderedNodes.find(element => element.dataset.pdfNodeId === tableNode.id);
  if (!sectionElement || !tableElement) return;

  const sectionRect = sectionElement.getBoundingClientRect();
  const sectionTop = sectionRect.top - pageRect.top;
  const gap = Math.max(4, pageRect.height * 0.01);
  let flowTop = sectionTop + Math.max(18, pageRect.height * 0.035);
  const groups = new Map<string, Array<{ node: PdfTemplateNode; element: HTMLElement }>>();

  definition.nodes
    .filter(node => node.enabled !== false && partyField(node))
    .forEach(node => {
      const element = renderedNodes.find(item => item.dataset.pdfNodeId === node.id);
      if (!element) return;
      const key = `party-${Math.round(Number(node.y || 0) * 2) / 2}`;
      const group = groups.get(key) || [];
      group.push({ node, element });
      groups.set(key, group);
    });

  if (!groups.size) return;

  Array.from(groups.values())
    .sort((left, right) => Number(left[0].node.y || 0) - Number(right[0].node.y || 0))
    .forEach(group => {
      group.forEach(item => { item.element.style.top = `${flowTop}px`; });
      const bottom = Math.max(...group.map(item => item.element.getBoundingClientRect().bottom - pageRect.top));
      flowTop = bottom + gap;
    });

  const sectionBottom = flowTop + gap;
  sectionElement.style.height = `${Math.max(pageRect.height * 0.08, sectionBottom - sectionTop)}px`;
  if (Number(tableNode.y || 0) > Number(partySectionNode.y || 0)) {
    const tableTop = sectionBottom + gap;
    tableElement.style.top = `${tableTop}px`;
  }
}

export async function renderPdfTemplateToPdf({ definition, settings, targetKey, data, fileName, save = true }: PdfTemplateRenderOptions) {
  if (typeof document === 'undefined') throw new Error('La plantilla PDF requiere un navegador.');
  // Las vistas reciben el branding por distintas capas (ThemeContext,
  // sessionBranding o clientTenant). El almacenamiento de sesión es la fuente
  // común del contexto de sucursal y evita que un reporte pierda el logo solo
  // porque su componente no recibió themeConfig.logo en ese render.
  const configuredSettings = settings as PdfTemplateRenderSettings & Record<string, unknown>;
  const logoCandidates = [
    data?.logo,
    data?.company?.logo,
    configuredSettings.templateLogoUrl,
    configuredSettings.templateLogoUri,
    rememberedSessionLogo(),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  let safeLogo = '';
  for (const candidate of [...new Set(logoCandidates)]) {
    safeLogo = await prepareLogoSource(candidate);
    if (safeLogo) break;
  }
  const renderData: PdfTemplateData = safeLogo
    ? { ...(data || {}), logo: safeLogo, company: { ...(data?.company || {}), logo: safeLogo } }
    : { ...(data || {}), logo: undefined, company: { ...(data?.company || {}), logo: undefined } };
  // El predeterminado virtual se construye inicialmente sin conocer el logo de
  // la sucursal. Regenerarlo aquí evita que el logo aparezca encima del nombre
  // y conserva las proporciones correctas de cada composición de biblioteca.
  const baseDefinition = safeLogo && definition.metadata?.preset === 'system-default'
    ? createDefaultTemplateDefinition(targetKey, { ...settings, logoUrl: safeLogo })
    : definition;
  const isRepeatedLabel = getPdfTemplateTarget(targetKey).key === 'inventario.product-labels';
  // LABEL ya define sus dimensiones físicas como 70 × 38 mm. No se debe
  // volver a intercambiar ese par por la orientación, porque jsPDF terminaría
  // creando una hoja vertical y la captura quedaría comprimida en la parte
  // superior con espacio blanco debajo.
  const renderOrientation = isRepeatedLabel ? 'landscape' : settings.orientation;
  const [baseWidth, baseHeight] = pageDimensions(settings.paperSize);
  const width = isRepeatedLabel ? baseWidth : renderOrientation === 'landscape' ? baseHeight : baseWidth;
  const height = isRepeatedLabel ? baseHeight : renderOrientation === 'landscape' ? baseWidth : baseHeight;
  const adaptReportWidths = shouldAdaptReportWidths(targetKey);
  const reportSections = Array.isArray(renderData.reportSections)
    ? renderData.reportSections.filter(section => section && Array.isArray(section.columns) && Array.isArray(section.rows))
      .map(section => ({ ...section, columns: adaptReportColumnWidths(section.columns, adaptReportWidths) }))
    : [];
  const reportNode = baseDefinition.nodes.find(node => node.type === 'report-sections' && node.enabled !== false);
  const fallbackRows = asRows(renderData);
  const fallbackColumns = Array.isArray(renderData.tableColumns)
    ? adaptReportColumnWidths(renderData.tableColumns as PdfTemplateColumn[], adaptReportWidths)
    : [];
  // Algunos diseños globales guardados usan el nodo de secciones, mientras
  // que los exportadores sencillos entregan filas y columnas normales. En ese
  // caso convertimos el listado en una sección única para no perder la tabla.
  const effectiveReportSections = reportSections.length || !reportNode || !fallbackRows.length || !fallbackColumns.length
    ? reportSections
    : [{
      id: 'global-report',
      title: String(renderData.document?.title || getPdfTemplateTarget(targetKey).label),
      columns: fallbackColumns,
      rows: fallbackRows,
    }];
  const indexedReportSections = effectiveReportSections.map((section, sectionIndex) => ({ ...section, templateIndex: sectionIndex }));
  const visibleReportSections = reportNode
    ? indexedReportSections.filter(section => reportNode.reportSectionVisibility?.[String(section.templateIndex)] !== false)
    : indexedReportSections;
  const sectionGroups: Array<PdfTemplateReportSection[] | null> = reportNode
    ? (visibleReportSections.length ? paginatePdfReportSections(visibleReportSections) : [[]])
    : visibleReportSections.length
      ? visibleReportSections.map(section => [section])
      : [null];
  const renderJobs: Array<{ definition: PdfTemplateDefinition; data: PdfTemplateData }> = [];

  const dashboardTarget = getPdfTemplateTarget(targetKey).structure === 'dashboard';
  if (dashboardTarget) {
    const dashboardHasCover = Boolean(renderData.dashboardCharts?.length || renderData.reportKpis?.length);
    if (dashboardHasCover) renderJobs.push({ definition: baseDefinition, data: { ...renderData, reportSections: [], dashboardCover: true } });
    sectionGroups.filter((group): group is PdfTemplateReportSection[] => Boolean(group?.length)).forEach(sectionGroup => {
      const firstSection = sectionGroup[0];
      renderJobs.push({
        definition: baseDefinition,
        data: {
          ...renderData,
          dashboardCover: false,
          reportSections: sectionGroup,
          items: firstSection?.rows || [],
          rows: firstSection?.rows || [],
          tableColumns: firstSection?.columns,
        },
      });
    });
    if (!renderJobs.length) renderJobs.push({ definition: baseDefinition, data: { ...renderData, dashboardCover: true, reportSections: [] } });
  }

  if (!dashboardTarget) sectionGroups.forEach((sectionGroup, groupIndex) => {
    const section = sectionGroup?.[0];
    const reportMode = Boolean(reportNode && sectionGroup);
    const sectionData: PdfTemplateData = sectionGroup
      ? {
        ...renderData,
        document: {
          ...(renderData.document || {}),
          title: (renderData.document?.title as string) || getPdfTemplateTarget(targetKey).label,
        },
        reportSections: reportMode ? sectionGroup : renderData.reportSections,
        items: section?.rows || [],
        rows: section?.rows || [],
        tableColumns: section?.columns,
      }
      : renderData;
    const effectiveDefinition = reportMode ? baseDefinition : applyRuntimeTableColumns(baseDefinition, sectionData, adaptReportWidths);
    const rows = asRows(sectionData);
    const tableNode = effectiveDefinition.nodes.find(node => node.type === 'table' && node.enabled !== false);
    if (reportMode && sectionGroup) {
      renderJobs.push({ definition: effectiveDefinition, data: { ...sectionData, reportSections: sectionGroup, tableSummary: groupIndex === sectionGroups.length - 1 ? renderData.tableSummary : undefined } });
      return;
    }
    // La escala tipográfica hace que las tablas de reportes (normalmente con
    // seis o más columnas) necesiten menos filas por página para que correos,
    // direcciones e identificaciones no queden recortados por la caja fija.
    const denseTable = Boolean(tableNode && (tableNode.columns?.length || 0) >= 6);
    // La tabla ya reacomoda el bloque de proveedor, los totales y el pie según
    // su altura real. Por eso puede usar el espacio disponible completo; el
    // límite reducido anterior dejaba páginas con solo dos filas y demasiado
    // espacio vacío aunque todavía cupieran más registros.
    const chunks = tableNode && rows.length
      ? chunkTableRows(rows, tableNode.columns?.length ? tableNode.columns : [], denseTable ? 12 : 14)
      : [[]];
    const renderChunks = isRepeatedLabel && rows.length ? rows.map(row => [row]) : chunks;
    renderChunks.forEach((currentChunk, chunkIndex) => renderJobs.push({
      definition: effectiveDefinition,
      data: { ...sectionData, ...(tableNode || isRepeatedLabel ? { items: currentChunk, rows: currentChunk } : {}), tableSummary: chunkIndex === renderChunks.length - 1 ? renderData.tableSummary : undefined },
    }));
  });
  const pdf = new jsPDF({ orientation: settings.orientation, unit: 'mm', format: [width, height], compress: true });
  // html2canvas clona el documento completo que contiene el elemento. En una
  // pantalla de detalle eso incluye tablas, paneles y listas que no forman
  // parte del PDF y puede bloquear el hilo principal durante decenas de
  // segundos. Un iframe del mismo origen deja al renderer únicamente la hoja
  // que debe capturar, sin cambiar el diseño ni los datos del reporte.
  const renderFrame = document.createElement('iframe');
  renderFrame.setAttribute('aria-hidden', 'true');
  Object.assign(renderFrame.style, {
    position: 'fixed', left: '-100000px', top: '0', width: `${width}mm`, height: `${height}mm`,
    border: '0', opacity: '0', pointerEvents: 'none',
  });
  document.body.appendChild(renderFrame);
  const renderDocument = renderFrame.contentDocument;
  if (!renderDocument) {
    renderFrame.remove();
    throw new Error('No se pudo preparar el renderizador del PDF.');
  }
  renderDocument.open();
  renderDocument.write('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:visible;background:#fff}*{box-sizing:border-box}</style></head><body></body></html>');
  renderDocument.close();
  const wrapper = renderDocument.body;
  Object.assign(wrapper.style, { width: `${width}mm`, height: `${height}mm`, overflow: 'visible', background: '#fff' });
  try {
    for (let index = 0; index < renderJobs.length; index += 1) {
      const job = renderJobs[index];
      const pageData = normalizeData(job.data, settings, targetKey, index + 1, renderJobs.length);
      const page = renderPage(job.definition, settings, pageData, width, height);
      page.id = `pdf-template-page-${index}`;
      wrapper.appendChild(page);
      await waitForImages(page);
      reflowPartySection(page, job.definition);
      reflowIndividualPage(page, job.definition);
      const requestedRenderScale = Number((job.data as Record<string, unknown>).renderScale);
      const renderScale = Math.max(0.9, Math.min(1.5, requestedRenderScale || 1.5));
      const canvas = await html2canvas(page, {
        scale: renderScale,
        backgroundColor: safeHtml2CanvasColor(job.definition.page.background, '#ffffff'),
        logging: false,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: false,
      });
      if (index > 0) pdf.addPage([width, height], settings.orientation === 'landscape' ? 'l' : 'p');
      pdf.addImage(canvas, 'PNG', 0, 0, width, height, undefined, 'FAST');
      page.remove();
    }
    const blob = pdf.output('blob');
    if (save) pdf.save(fileName || `${getPdfTemplateTarget(targetKey).key.replace(/[^a-z0-9.-]+/gi, '-')}.pdf`);
    return { doc: pdf, blob };
  } finally { renderFrame.remove(); }
}
