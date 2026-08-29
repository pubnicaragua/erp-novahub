import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { resolveTemplateToken, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode } from '../services/pdf-template-definition';

export interface PdfTemplateRenderSettings {
  paperSize: 'LETTER' | 'A4' | 'OFICIO' | 'LEGAL' | string;
  orientation: 'portrait' | 'landscape';
  primaryColor?: string;
  textColor?: string;
  lineColor?: string;
  fontFamily?: string;
  fontSize?: number;
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

function normalizeData(data: PdfTemplateData | undefined, settings: PdfTemplateRenderSettings, targetKey: string, pageNumber: number, pageCount: number): PdfTemplateData {
  const target = getPdfTemplateTarget(targetKey);
  const source = data || {};
  const company = { name: settings.footerText ? undefined : undefined, ...(source.company || {}) };
  const document = { title: target.label.toUpperCase(), notes: '', terms: '', ...(source.document || {}) };
  return {
    ...source,
    company,
    document: { ...document, notes: document.notes || (source.defaultNotes as string) || '', page: pageNumber, pages: pageCount },
    page: { number: pageNumber, pages: pageCount },
  };
}

function tokenValue(node: PdfTemplateNode, data: PdfTemplateData) {
  return resolveTemplateToken(node.token, data, node.sample || node.text || node.label);
}

function setBaseNodeStyle(element: HTMLDivElement, node: PdfTemplateNode, settings: PdfTemplateRenderSettings) {
  Object.assign(element.style, {
    position: 'absolute', left: `${node.x}%`, top: `${node.y}%`, width: `${node.width}%`, height: `${node.height}%`, boxSizing: 'border-box',
    padding: `${node.padding ?? 1.5}%`, color: node.color || settings.textColor || '#334155', backgroundColor: node.backgroundColor || 'transparent',
    borderColor: node.borderColor || settings.lineColor || '#e2e8f0', borderRadius: `${node.borderRadius || 0}px`, fontSize: `${node.fontSize || settings.fontSize || 9}px`,
    fontFamily: settings.fontFamily || 'Arial, sans-serif', fontWeight: node.bold ? '700' : '400', fontStyle: node.italic ? 'italic' : 'normal', textAlign: node.align || 'left',
    overflow: 'hidden', lineHeight: '1.25',
  });
}

function createTextNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  element.textContent = node.type === 'field' ? tokenValue(node, data) : node.text || node.sample || node.label;
  if (node.type === 'divider') { element.textContent = ''; element.style.borderTopStyle = 'solid'; element.style.borderTopWidth = '1px'; element.style.padding = '0'; }
  if (node.type === 'spacer') element.style.backgroundColor = 'transparent';
  return element;
}

function createTableNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  element.style.padding = '0';
  element.style.borderStyle = 'solid'; element.style.borderWidth = '1px';
  const table = document.createElement('table');
  table.style.width = '100%'; table.style.borderCollapse = 'collapse'; table.style.fontSize = `${Math.max(7, (node.fontSize || settings.fontSize || 9) - 1)}px`; table.style.tableLayout = 'fixed';
  const columns = node.columns?.length ? node.columns : [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'total', label: 'Total', token: 'total', width: 30, align: 'right' as const }];
  const head = table.createTHead().insertRow();
  columns.forEach(column => { const cell = head.insertCell(); cell.textContent = column.label; cell.style.width = `${column.width || 25}%`; cell.style.textAlign = column.align || 'left'; cell.style.padding = '5px 6px'; cell.style.backgroundColor = settings.primaryColor || '#10b981'; cell.style.color = '#ffffff'; cell.style.fontWeight = '700'; });
  const body = table.createTBody();
  asRows(data).slice(0, 30).forEach((row, rowIndex) => {
    const tr = body.insertRow();
    columns.forEach(column => { const cell = tr.insertCell(); cell.textContent = escapeValue(row[column.token] ?? row[column.id]); cell.style.padding = '5px 6px'; cell.style.borderTop = `1px solid ${settings.lineColor || '#e2e8f0'}`; cell.style.textAlign = column.align || 'left'; if (rowIndex % 2) cell.style.backgroundColor = '#f8fafc'; });
  });
  element.appendChild(table);
  return element;
}

function createTotalsNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  element.style.borderStyle = 'solid'; element.style.borderWidth = '1px';
  const totals = data.totals || {};
  [['subtotal', 'Subtotal'], ['tax', 'Impuestos'], ['discount', 'Descuento'], ['total', 'Total']].forEach(([key, label]) => {
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.gap = '8px'; row.style.marginBottom = '3px'; if (key === 'total') { row.style.borderTop = `1px solid ${settings.lineColor || '#e2e8f0'}`; row.style.paddingTop = '4px'; row.style.fontWeight = '700'; }
    const labelElement = document.createElement('span'); labelElement.textContent = label;
    const valueElement = document.createElement('span'); valueElement.textContent = escapeValue(totals[key]);
    row.append(labelElement, valueElement); element.appendChild(row);
  });
  return element;
}

function createNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  if (node.type === 'table') return createTableNode(node, data, settings);
  if (node.type === 'totals') return createTotalsNode(node, data, settings);
  if (node.type === 'image') {
    const element = createTextNode(node, data, settings);
    const logo = typeof data.logo === 'string' ? data.logo : typeof data.company?.logo === 'string' ? data.company.logo : '';
    if (logo && /^(data:image\/|https?:\/\/|\/)/i.test(logo)) { element.textContent = ''; const image = document.createElement('img'); image.src = logo; image.alt = 'Logo'; image.style.maxWidth = '100%'; image.style.maxHeight = '100%'; image.style.objectFit = 'contain'; element.appendChild(image); }
    return element;
  }
  return createTextNode(node, data, settings);
}

function renderPage(definition: PdfTemplateDefinition, settings: PdfTemplateRenderSettings, data: PdfTemplateData, width: number, height: number) {
  const page = document.createElement('div');
  Object.assign(page.style, { position: 'relative', width: `${width}mm`, height: `${height}mm`, overflow: 'hidden', background: definition.page.background || '#ffffff', boxSizing: 'border-box' });
  definition.nodes.filter(node => node.enabled !== false && (node.page || 1) === 1).forEach(node => page.appendChild(createNode(node, data, settings)));
  if (settings.watermark?.trim()) { const watermark = document.createElement('div'); Object.assign(watermark.style, { position: 'absolute', inset: '38% 0 auto', textAlign: 'center', transform: 'rotate(-28deg)', color: settings.primaryColor || '#10b981', opacity: String((settings.watermarkOpacity || 12) / 100), fontSize: '42px', fontWeight: '800' }); watermark.textContent = settings.watermark; page.appendChild(watermark); }
  return page;
}

export async function renderPdfTemplateToPdf({ definition, settings, targetKey, data, fileName, save = true }: PdfTemplateRenderOptions) {
  if (typeof document === 'undefined') throw new Error('La plantilla PDF requiere un navegador.');
  const [baseWidth, baseHeight] = pageDimensions(settings.paperSize);
  const width = settings.orientation === 'landscape' ? baseHeight : baseWidth;
  const height = settings.orientation === 'landscape' ? baseWidth : baseHeight;
  const rows = asRows(data || {});
  const tableNode = definition.nodes.find(node => node.type === 'table');
  const chunkSize = tableNode && rows.length > 14 ? 14 : Math.max(rows.length, 1);
  const chunks = tableNode && rows.length ? Array.from({ length: Math.ceil(rows.length / chunkSize) }, (_, index) => rows.slice(index * chunkSize, (index + 1) * chunkSize)) : [[]];
  const pdf = new jsPDF({ orientation: settings.orientation, unit: 'mm', format: [width, height], compress: true });
  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, { position: 'fixed', left: '-100000px', top: '0', width: '1px', height: '1px', overflow: 'visible', opacity: '1', pointerEvents: 'none' });
  document.body.appendChild(wrapper);
  try {
    for (let index = 0; index < chunks.length; index += 1) {
      const pageData = normalizeData({ ...(data || {}), ...(tableNode ? { items: chunks[index], rows: chunks[index] } : {}) }, settings, targetKey, index + 1, chunks.length);
      const page = renderPage(definition, settings, pageData, width, height);
      wrapper.appendChild(page);
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: definition.page.background || '#ffffff', logging: false, useCORS: false });
      if (index > 0) pdf.addPage([width, height], settings.orientation === 'landscape' ? 'l' : 'p');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height, undefined, 'FAST');
      page.remove();
    }
    const blob = pdf.output('blob');
    if (save) pdf.save(fileName || `${getPdfTemplateTarget(targetKey).key.replace(/[^a-z0-9.-]+/gi, '-')}.pdf`);
    return { doc: pdf, blob };
  } finally { wrapper.remove(); }
}
