import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';
import { getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { applyPdfHeaderComposition, applyStandardPdfLayoutSettings, createDefaultTemplateDefinition, createSystemDefaultPdfSettings, ensureDashboardChartNodes, formatPdfPageNumber, hasCurrentStandardPdfLayout, isPurchasePdfLayoutTarget, isStandardPdfLayoutTarget, isSalesPdfLayoutTarget, normalizePdfCompanySettings, normalizePdfPaperSettings, PDF_DEFAULT_FONT_SCALE, pdfTemplateImageShapeStyles, resolveTemplateToken, type PdfHeaderComposition, type PdfHeaderContentSpacing, type PdfTemplateColumn, type PdfTemplateData, type PdfTemplateDefinition, type PdfTemplateNode, type PdfTemplateReportSection } from '../services/pdf-template-definition';
import { pdfDocumentDesignService } from '../services/pdf-document-design.service';
import { applyPdfStyleToDefinition, getPdfTableCellBorders, getPdfTablePresentation, isPdfFrameFooterNode, isPdfFrameHeaderNode, normalizePdfFrameGeometry, normalizePdfFontFamily, normalizePdfStyleConfig, resolvePdfHtmlTokens, resolvePdfTableRowBackground, sanitizePdfHtmlFragment, sanitizePdfTemplateCss, type PdfTableStyle } from '../services/pdf-document-style';
import { PDF_APPEARANCE_FONTS } from '../services/pdf-appearance';
import { getBase64Image, safeHtml2CanvasColor } from './export-utils';
import { pdfStatusLabel } from './pdfStatus';

export interface PdfTemplateRenderSettings {
  paperSize: 'LETTER' | 'A4' | 'OFICIO' | 'LEGAL' | string;
  orientation: 'portrait' | 'landscape';
  headerComposition?: PdfHeaderComposition;
  headerContentSpacing?: PdfHeaderContentSpacing;
  backgroundColor?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  lineColor?: string;
  fontFamily?: string;
  fontSize?: number;
  margins?: number;
  tableLayout?: string;
  pdfTableStyle?: PdfTableStyle;
  footerText?: string;
  showPageNumber?: boolean;
  pageNumberFormat?: 'page-of' | 'number-only' | 'custom';
  pageNumberCustom?: string;
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
  onProgress?: (progress: PdfTemplateRenderProgress) => void;
}

export interface PdfTemplateRenderProgress {
  page: number;
  totalPages: number;
}

const SINGLE_PAGE_PDF_INFO_NODE_IDS = new Set([
  'company-name', 'company-summary', 'document-title', 'document-number', 'document-date',
  'document-status', 'document-generated', 'document-extra', 'report-meta', 'ticket-meta',
  'history-customer-name',
]);

export function isPdfFirstPageOnlyInfoNode(nodeId: string) {
  return SINGLE_PAGE_PDF_INFO_NODE_IDS.has(nodeId);
}

/** El logo es la única pieza del encabezado que debe sobrevivir a una continuación. */
export function shouldRenderPdfNodeOnPage(nodeId: string, firstPageOnly: boolean | undefined, pageNumber: number) {
  if (nodeId === 'company-logo') return true;
  return !firstPageOnly || pageNumber === 1;
}

/** Reduce la altura ocupada por el interlineado y el padding vertical del encabezado de tabla. */
export function getPdfTableHeaderCellLayout(compact: boolean, standard: boolean, rollPaper = false) {
  const verticalPadding = rollPaper ? 1 : compact || standard ? 2 : 4;
  const horizontalPadding = rollPaper ? 4 : compact ? 5 : 8;
  return {
    padding: `${verticalPadding}px ${horizontalPadding}px`,
    lineHeight: rollPaper ? '1.15' : '1.25',
    contentDisplay: 'flex',
    contentAlignItems: 'center',
    contentMinHeight: rollPaper ? '1.15em' : '1.25em',
  };
}

function createPdfTableHeaderLabel(label: unknown, layout: ReturnType<typeof getPdfTableHeaderCellLayout>, whiteSpace: 'normal' | 'nowrap' = 'normal') {
  const content = document.createElement('span');
  Object.assign(content.style, {
    display: layout.contentDisplay,
    alignItems: layout.contentAlignItems,
    width: '100%',
    minWidth: '0',
    minHeight: layout.contentMinHeight,
  });
  const text = document.createElement('span');
  text.textContent = label === null || label === undefined ? '' : String(label);
  Object.assign(text.style, {
    display: 'block',
    width: '100%',
    minWidth: '0',
    lineHeight: layout.lineHeight,
    whiteSpace,
    overflowWrap: whiteSpace === 'nowrap' ? 'normal' : 'anywhere',
    wordBreak: whiteSpace === 'nowrap' ? 'normal' : 'break-word',
  });
  content.appendChild(text);
  return content;
}

/** Give React and the browser a paint opportunity between expensive canvas jobs. */
export function yieldToBrowser() {
  return new Promise<void>(resolve => {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      setTimeout(resolve, 0);
      return;
    }
    let settled = false;
    let fallbackTimer = 0;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      resolve();
    };
    fallbackTimer = window.setTimeout(finish, 100);
    window.requestAnimationFrame(() => window.requestAnimationFrame(finish));
  });
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

export function getPdfTableCellVerticalAlignment(_region: 'header' | 'body' | 'footer') {
  return 'middle' as const;
}

export function getPdfReportSectionTableGap(targetKey: string) {
  return isStandardPdfLayoutTarget(targetKey) ? 6 : 0;
}

export function resolvePdfHeaderAnchoredTop(headerContentBottom: number, preferredTop: number, gap: number, preservePreferredTop: boolean) {
  const preferred = Number.isFinite(Number(preferredTop)) ? Math.max(0, Number(preferredTop)) : 0;
  const headerBottom = Number.isFinite(Number(headerContentBottom)) ? Math.max(0, Number(headerContentBottom)) : 0;
  const safeGap = Number.isFinite(Number(gap)) ? Math.max(0, Number(gap)) : 0;
  const measuredTop = headerBottom > 0 ? headerBottom + safeGap : preferred;
  return preservePreferredTop ? Math.max(preferred, measuredTop) : measuredTop;
}

/** Conserva el espaciado actual como pequeño y amplía solo el margen bajo el encabezado según el diseño. */
export function resolvePdfHeaderContentGap(currentGap: number, pageHeight: number, spacing: unknown) {
  if (spacing === 'medium') return currentGap + Math.max(12, pageHeight * 0.012);
  if (spacing === 'large') return currentGap + Math.max(24, pageHeight * 0.024);
  return currentGap;
}

/** Aplica el nivel seleccionado sobre la posición pequeña existente, conservando el anclaje al encabezado real. */
export function resolvePdfHeaderContentTop(headerBottom: number, preferredTop: number, currentGap: number, pageHeight: number, spacing: unknown, preservePreferredTop: boolean) {
  const currentTop = resolvePdfHeaderAnchoredTop(headerBottom, preferredTop, currentGap, preservePreferredTop);
  const selectedGap = resolvePdfHeaderContentGap(currentGap, pageHeight, spacing);
  return currentTop + Math.max(0, selectedGap - currentGap);
}

export function resolvePdfHistoryInfoTop(documentHeaderBottom: number, entityHeadingBottom: number, gap: number) {
  const documentBottom = Number.isFinite(Number(documentHeaderBottom)) ? Math.max(0, Number(documentHeaderBottom)) : 0;
  const entityBottom = Number.isFinite(Number(entityHeadingBottom)) ? Math.max(0, Number(entityHeadingBottom)) : 0;
  const safeGap = Number.isFinite(Number(gap)) ? Math.max(0, Number(gap)) : 0;
  return Math.max(documentBottom, entityBottom) + safeGap;
}

export function resolvePdfReportTableBorderColor(targetKey: string, nodeBorderColor: string | undefined, configuredLineColor: string) {
  const configuredBorder = String(nodeBorderColor || '').trim();
  const lineColor = String(configuredLineColor || '').trim() || '#e2e8f0';
  if (targetKey === 'ventas.customers' && (!configuredBorder || configuredBorder.toLowerCase() === 'transparent')) return lineColor;
  return configuredBorder || lineColor;
}

/** Place continuation content just below the header elements that actually repeat. */
export function getPdfStandardContinuationY(repeatedHeaderBottom: number) {
  const headerBottom = Number.isFinite(Number(repeatedHeaderBottom)) ? Math.max(0, Number(repeatedHeaderBottom)) : 13.5;
  return Math.min(82, Math.max(16, headerBottom + 2.5));
}

function generatedMetadataParts(value: unknown) {
  return String(value || '').split('·').map(part => part.trim()).filter(part => part && !/^generado\s*:/i.test(part));
}

export function normalizeReportDocumentMetadata(document: Record<string, unknown>, pageNumber: number) {
  const generated = String(document.generated || '').trim();
  const generationInMeta = String(document.meta || '').split('·').map(part => part.trim()).find(part => /^generado\s*:/i.test(part)) || '';
  const generatedInMetaFallback = document.generatedInMetaFallback === true;
  const metaParts = pageNumber === 1 ? generatedMetadataParts(document.meta) : [];
  if (pageNumber === 1 && generatedInMetaFallback) metaParts.push(generated || generationInMeta);
  return {
    ...document,
    period: pageNumber === 1 ? document.period : '',
    generated: pageNumber === 1 ? generated || generationInMeta : '',
    meta: [...new Set(metaParts.filter(Boolean))].join(' · '),
  };
}

export async function capturePdfChartSnapshot(element: HTMLElement, scale = 2.5) {
  if (typeof document === 'undefined') throw new Error('La captura de gráficas requiere un navegador.');
  await document.fonts?.ready;
  await yieldToBrowser();
  const snapshotId = `pdf-chart-${Math.random().toString(36).slice(2)}`;
  element.dataset.pdfChartSnapshot = snapshotId;
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: Math.max(1, Math.min(3, scale)),
      backgroundColor: null,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      onclone: clonedDocument => {
        const clonedRoot = clonedDocument.querySelector<HTMLElement>(`[data-pdf-chart-snapshot="${snapshotId}"]`);
        if (!clonedRoot) return;
        const sourceNodes = [element, ...Array.from(element.querySelectorAll<HTMLElement | SVGElement>('*'))];
        const clonedNodes = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement | SVGElement>('*'))];
        const colorContext = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
        const normalizedColorCache = new Map<string, string>();
        const normalizeColor = (value: string, fallback: string) => {
          if (!colorContext || !value || value === 'none' || value.startsWith('url(')) return value || fallback;
          const cacheKey = `${value}\u0000${fallback}`;
          const cachedColor = normalizedColorCache.get(cacheKey);
          if (cachedColor) return cachedColor;
          const rememberColor = (color: string) => {
            normalizedColorCache.set(cacheKey, color);
            return color;
          };
          try {
            if (window.CSS?.supports && !window.CSS.supports('color', value)) return rememberColor(fallback);
            colorContext.fillStyle = 'rgb(1, 2, 3)';
            const sentinel = colorContext.fillStyle;
            colorContext.fillStyle = value;
            if (colorContext.fillStyle === sentinel && value !== sentinel) return rememberColor(fallback);
            colorContext.clearRect(0, 0, 1, 1);
            colorContext.fillRect(0, 0, 1, 1);
            const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data;
            if (!alpha) return rememberColor('rgba(0, 0, 0, 0)');
            if (alpha === 255) return rememberColor(`rgb(${red}, ${green}, ${blue})`);
            return rememberColor(`rgba(${red}, ${green}, ${blue}, ${Number((alpha / 255).toFixed(3))})`);
          } catch {
            return rememberColor(fallback);
          }
        };
        const unsupportedColorSyntax = /(?:var\(|oklch|oklab|color-mix|color\(|lch\(|lab\(|currentcolor)/i;
        sourceNodes.forEach((sourceNode, index) => {
          const cloneNode = clonedNodes[index] as HTMLElement | SVGElement | undefined;
          if (!cloneNode) return;
          const computed = window.getComputedStyle(sourceNode);
          const cloneStyle = (cloneNode as HTMLElement).style;
          if (computed.color) cloneStyle.setProperty('color', normalizeColor(computed.color, '#334155'), 'important');
          if (computed.backgroundColor && computed.backgroundColor !== 'transparent') cloneStyle.setProperty('background-color', normalizeColor(computed.backgroundColor, '#ffffff'), 'important');
          ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'].forEach(property => {
            const color = computed.getPropertyValue(property);
            if (color) cloneStyle.setProperty(property, normalizeColor(color, '#e2e8f0'), 'important');
          });
          ['outline-color', 'text-decoration-color', 'column-rule-color', '-webkit-text-stroke-color', '-webkit-text-fill-color', 'caret-color'].forEach(property => {
            const color = computed.getPropertyValue(property);
            if (unsupportedColorSyntax.test(color)) cloneStyle.setProperty(property, normalizeColor(color, '#334155'), 'important');
          });
          if (unsupportedColorSyntax.test(computed.backgroundImage)) cloneStyle.setProperty('background-image', 'none', 'important');
          if (unsupportedColorSyntax.test(computed.boxShadow)) cloneStyle.setProperty('box-shadow', 'none', 'important');
          if (unsupportedColorSyntax.test(computed.textShadow)) cloneStyle.setProperty('text-shadow', 'none', 'important');
          if (unsupportedColorSyntax.test(computed.filter)) cloneStyle.setProperty('filter', 'none', 'important');
          if (!(sourceNode instanceof SVGElement)) return;
          const svgStyle = window.getComputedStyle(sourceNode);
          const fill = sourceNode.getAttribute('fill');
          const stroke = sourceNode.getAttribute('stroke');
          const stopColor = sourceNode.getAttribute('stop-color');
          if (fill && !fill.startsWith('url(')) cloneNode.setAttribute('fill', normalizeColor(unsupportedColorSyntax.test(fill) ? svgStyle.fill : fill, '#334155'));
          if (stroke && !stroke.startsWith('url(')) cloneNode.setAttribute('stroke', normalizeColor(unsupportedColorSyntax.test(stroke) ? svgStyle.stroke : stroke, '#94a3b8'));
          if (stopColor) cloneNode.setAttribute('stop-color', normalizeColor(unsupportedColorSyntax.test(stopColor) ? svgStyle.getPropertyValue('stop-color') : stopColor, '#10b981'));
        });
      },
    });
  } finally {
    delete element.dataset.pdfChartSnapshot;
  }
  const imageAspectRatio = canvas.width / Math.max(1, canvas.height);
  const imageDataUrl = canvas.toDataURL('image/png');
  canvas.width = 0;
  canvas.height = 0;
  return { imageDataUrl, imageAspectRatio };
}

/**
 * Los listados y reportes conocen su esquema real en el momento de exportar.
 * La definición visual sigue siendo reutilizable, pero no debe reducir una
 * tabla de 6 o 7 columnas a las 4 columnas de la plantilla de transacciones.
 */
function shouldAdaptReportWidths(targetKey: string) {
  return targetKey.startsWith('compras.')
    || targetKey.startsWith('reportes.');
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
    align: (column.align === 'center' || column.align === 'right' ? column.align : 'left') as PdfTemplateColumn['align'],
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

function chunkTableRows(rows: Array<Record<string, unknown>>, columns: PdfTemplateColumn[], firstPageCapacity: number, continuationPageCapacity = firstPageCapacity) {
  const section = { id: 'table', title: '', columns, rows };
  const chunks: Array<Array<Record<string, unknown>>> = [];
  let current: Array<Record<string, unknown>> = [];
  let used = 0;
  let pageIndex = 0;
  const capacity = () => pageIndex === 0 ? firstPageCapacity : continuationPageCapacity;
  const flush = () => {
    if (!current.length) return;
    chunks.push(current);
    current = [];
    used = 0;
    pageIndex += 1;
  };
  rows.forEach(row => {
    const units = reportRowUnits(section, row);
    if (current.length && used + units > capacity()) {
      flush();
    }
    current.push(row);
    used += units;
    if (used >= capacity() - 0.8) flush();
  });
  flush();
  return chunks;
}

export function paginatePdfReportSections(sections: PdfTemplateReportSection[], options: { firstPageCapacity?: number; continuationPageCapacity?: number } = {}) {
  const groups: PdfTemplateReportSection[][] = [];
  let current: PdfTemplateReportSection[] = [];
  let used = 0;
  let pageIndex = 0;
  const firstPageCapacity = Math.max(1, Number(options.firstPageCapacity) || 11);
  const continuationPageCapacity = Math.max(1, Number(options.continuationPageCapacity) || 20);
  const capacity = () => pageIndex === 0 ? firstPageCapacity : continuationPageCapacity;
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

export function getPdfReportPagination(targetKey: string) {
  if (targetKey === 'ventas.cash-session') return { firstPageCapacity: 16, continuationPageCapacity: 24 };
  if (targetKey === 'ventas.cash-historical-report') return { firstPageCapacity: 20, continuationPageCapacity: 24 };
  if (targetKey === 'ventas.customers') return { firstPageCapacity: 11, continuationPageCapacity: 17 };
  return undefined;
}

function normalizeData(data: PdfTemplateData | undefined, settings: PdfTemplateRenderSettings, targetKey: string, pageNumber: number, pageCount: number): PdfTemplateData {
  const target = getPdfTemplateTarget(targetKey);
  const source = data || {};
  const firstRow = asRows(source)[0];
  const sourceCompany = source.company || {};
  const globalCompanyProfile = source.pdfCompanyProfile && typeof source.pdfCompanyProfile === 'object'
    ? source.pdfCompanyProfile as Record<string, unknown>
    : null;
  const configuredSettings = normalizePdfCompanySettings(settings as PdfTemplateRenderSettings & Record<string, unknown>);
  const company = {
    ...sourceCompany,
    name: globalCompanyProfile ? String(globalCompanyProfile.name || '') : configuredSettings.companyName || sourceCompany.name,
    slogan: globalCompanyProfile ? String(globalCompanyProfile.slogan || '') : configuredSettings.slogan || sourceCompany.slogan,
    fiscalInfo: globalCompanyProfile ? String(globalCompanyProfile.fiscalInfo || '') : configuredSettings.fiscalInfo || sourceCompany.fiscalInfo,
    address: globalCompanyProfile ? String(globalCompanyProfile.address || '') : configuredSettings.address || sourceCompany.address,
    phone: globalCompanyProfile ? String(globalCompanyProfile.phone || '') : configuredSettings.phone || sourceCompany.phone,
    email: globalCompanyProfile ? String(globalCompanyProfile.email || '') : configuredSettings.email || sourceCompany.email,
    website: globalCompanyProfile ? String(globalCompanyProfile.website || '') : configuredSettings.website || sourceCompany.website,
    footerText: typeof configuredSettings.footerText === 'string' ? configuredSettings.footerText : sourceCompany.footerText,
  };
  const sourceDocument: Record<string, unknown> = { title: target.label.toUpperCase(), notes: '', terms: '', ...(source.document || {}) };
  const isBranchReportOutput = (target.structure === 'report' || target.structure === 'history' || target.structure === 'dashboard' || target.module === 'reportes' || target.key === 'compras.supplier')
    && !['manager', 'platform', 'portal'].includes(target.module);
  const document = isBranchReportOutput ? normalizeReportDocumentMetadata(sourceDocument, pageNumber) : sourceDocument;
  const formattedPageNumber = formatPdfPageNumber(settings.pageNumberFormat, settings.pageNumberCustom, pageNumber, pageCount);
  return {
    ...source,
    company,
    document: { ...document, status: document.status ? pdfStatusLabel(document.status) : '', notes: document.notes || (source.defaultNotes as string) || '', page: formattedPageNumber, pages: pageCount },
    page: { number: formattedPageNumber, index: pageNumber, pages: pageCount },
    ...(target.key === 'inventario.product-labels' && firstRow && typeof firstRow === 'object' ? { product: { ...firstRow, ...((source.product || {}) as Record<string, unknown>) } } : {}),
  };
}

function tokenValue(node: PdfTemplateNode, data: PdfTemplateData) {
  if (node.id === 'footer-contact' && typeof data.company?.footerText === 'string') return data.company.footerText;
  const fallback = node.token?.startsWith('company.') ? '' : node.sample || node.text || '';
  return resolveTemplateToken(node.token, data, fallback);
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

export async function waitForPdfImageDecode(image: Pick<HTMLImageElement, 'decode'>) {
  if (typeof image.decode !== 'function') return;
  try {
    await image.decode();
  } catch {
    // Una imagen rota no debe bloquear la exportación; el nodo ya tiene fallback.
  }
}

export function fitPdfImageInsideSlot(slot: { x: number; y: number; width: number; height: number }, sourceWidth: number, sourceHeight: number) {
  const width = Math.max(0, Number(slot.width) || 0);
  const height = Math.max(0, Number(slot.height) || 0);
  const imageWidth = Math.max(0, Number(sourceWidth) || 0);
  const imageHeight = Math.max(0, Number(sourceHeight) || 0);
  if (!width || !height || !imageWidth || !imageHeight) return { x: Number(slot.x) || 0, y: Number(slot.y) || 0, width: 0, height: 0 };
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const fittedWidth = imageWidth * scale;
  const fittedHeight = imageHeight * scale;
  return {
    x: (Number(slot.x) || 0) + (width - fittedWidth) / 2,
    y: (Number(slot.y) || 0) + (height - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

function getPdfCompanyLogoOverlayRect(page: HTMLElement, definition: PdfTemplateDefinition, widthMm: number, heightMm: number) {
  const logoDefinition = definition.nodes.find(node => node.id === 'company-logo' && node.enabled !== false && node.type === 'image');
  if (!logoDefinition || logoDefinition.rotation || Number(logoDefinition.opacity ?? 1) < 1 || logoDefinition.shape === 'angled') return null;
  const logoNode = page.querySelector<HTMLElement>('[data-pdf-node-id="company-logo"]');
  const frame = logoNode?.firstElementChild as HTMLElement | null;
  const image = logoNode?.querySelector<HTMLImageElement>('img');
  if (!logoNode || !frame || !image?.naturalWidth || !image.naturalHeight) return null;
  const pageBounds = page.getBoundingClientRect();
  const frameBounds = frame.getBoundingClientRect();
  if (!pageBounds.width || !pageBounds.height || !frameBounds.width || !frameBounds.height) return null;
  const slot = {
    x: (frameBounds.left - pageBounds.left) / pageBounds.width * widthMm,
    y: (frameBounds.top - pageBounds.top) / pageBounds.height * heightMm,
    width: frameBounds.width / pageBounds.width * widthMm,
    height: frameBounds.height / pageBounds.height * heightMm,
  };
  const rect = fitPdfImageInsideSlot(slot, image.naturalWidth, image.naturalHeight);
  if (!rect.width || !rect.height) return null;
  image.style.visibility = 'hidden';
  return rect;
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll('img'));
  const svgImages = Array.from(root.querySelectorAll('svg image'));
  await Promise.all([...images.map(async image => {
    await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => { if (settled) return; settled = true; resolve(); };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    if (image.complete) {
      finish();
      return;
    }
    // Solo las imágenes externas que todavía no terminaron de cargar usan un
    // pequeño margen de seguridad. La espera fija anterior se repetía por
    // cada página y podía sumar varios segundos en un reporte individual.
    window.setTimeout(finish, 750);
    });
    await waitForPdfImageDecode(image);
  }), ...svgImages.map(image => new Promise<void>(resolve => {
    if (image.hasAttribute('data-pdf-image-ready')) {
      resolve();
      return;
    }
    let settled = false;
    const finish = () => { if (settled) return; settled = true; image.setAttribute('data-pdf-image-ready', 'true'); resolve(); };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    window.setTimeout(finish, 750);
  }))]);
}

export function browserFontFamily(value?: string) {
  const family = normalizePdfFontFamily(value || 'Arial');
  const normalized = family.toLowerCase();
  const generic = PDF_APPEARANCE_FONTS.slice(6, 9).some(font => font.toLowerCase() === normalized)
    || ['times new roman', 'georgia', 'garamond', 'cambria', 'palatino linotype', 'bookman'].includes(normalized)
    ? 'serif'
    : PDF_APPEARANCE_FONTS.slice(9).some(font => font.toLowerCase() === normalized)
      || ['courier new', 'consolas', 'monaco'].includes(normalized)
      ? 'monospace'
      : 'sans-serif';
  return `"${family.replace(/"/g, '\\"')}", ${generic}`;
}

/** Replaces node-level families while preserving all semantic text styling. */
export function applyPdfDocumentFontFamily<T extends { nodes: any[]; metadata?: Record<string, any> }>(definition: T, fontFamily?: string): T {
  const family = normalizePdfFontFamily(fontFamily || 'Arial');
  return { ...definition, nodes: definition.nodes.map(node => ({ ...node, fontFamily: family })) };
}

function collectPdfFontFaceRules(family: string) {
  if (typeof document === 'undefined') return [];
  const expected = family.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const found: string[] = [];
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        const match = rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '').toLowerCase();
        if (match === expected) found.push(rule.cssText);
      } else if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
        try { visit((rule as CSSGroupingRule).cssRules); } catch { /* la hoja puede estar protegida por CORS */ }
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { if (sheet.cssRules) visit(sheet.cssRules); } catch { /* omite hojas externas no accesibles */ }
  }
  return [...new Set(found)];
}

async function waitForPdfDocumentFonts(renderDocument: Document, family?: string) {
  const selected = normalizePdfFontFamily(family || 'Arial');
  const rules = collectPdfFontFaceRules(selected);
  if (rules.length && renderDocument.head) {
    const style = renderDocument.createElement('style');
    style.dataset.pdfFontFaces = selected;
    style.textContent = rules.join('\n');
    renderDocument.head.appendChild(style);
  }
  const fontSet = renderDocument.fonts;
  if (!fontSet) return;
  const cssFamily = browserFontFamily(selected).split(',')[0];
  try {
    await Promise.all(['400', '700'].map(weight => fontSet.load(`${weight} 12px ${cssFamily}`)));
    await fontSet.ready;
  } catch {
    // Keep the browser's generic fallback if a local font asset is unavailable.
  }
}

function enforcePdfDocumentFont(root: HTMLElement, family?: string) {
  const cssFamily = browserFontFamily(family);
  root.style.setProperty('font-family', cssFamily, 'important');
  root.querySelectorAll<HTMLElement>('*').forEach(element => element.style.setProperty('font-family', cssFamily, 'important'));
}

export function resolvePdfStyleConfigForRender(value: unknown, settings: Record<string, unknown>) {
  const stored = normalizePdfStyleConfig(value);
  if (!stored) return undefined;
  const requestedPalette = settings.pdfAppearancePalette;
  const palette = requestedPalette && typeof requestedPalette === 'object' ? requestedPalette as Record<string, unknown> : {};
  return normalizePdfStyleConfig({
    ...stored,
    fontFamily: settings.fontFamily || stored.fontFamily,
    fontSize: settings.fontSize || stored.fontSize,
    presetId: settings.pdfStylePreset || stored.presetId,
    tableStyle: settings.pdfTableStyle || stored.tableStyle,
    palette: {
      ...stored.palette,
      primary: palette.primary || settings.primaryColor || stored.palette.primary,
      secondary: palette.secondary || settings.secondaryColor || stored.palette.secondary,
      text: palette.text || settings.textColor || stored.palette.text,
      line: palette.line || settings.lineColor || stored.palette.line,
      tableHeader: palette.tableHeader || settings.tableHeaderColor || stored.palette.tableHeader,
      tableHeaderText: palette.tableHeaderText || settings.tableHeaderTextColor || stored.palette.tableHeaderText,
      tableRow: palette.tableRow || settings.tableRowColor || stored.palette.tableRow,
      tableStripe: palette.tableStripe || settings.tableStripeColor || stored.palette.tableStripe,
      tableBorder: palette.tableBorder || settings.tableBorderColor || stored.palette.tableBorder,
    },
  });
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

function svgElement<T extends keyof SVGElementTagNameMap>(name: T, attributes: Record<string, string | number> = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
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
  const imageShape = node.type === 'image' ? pdfTemplateImageShapeStyles(node.shape, node.borderRadius) : undefined;
  const borderRadius = imageShape?.borderRadius || (node.shape === 'pill' ? '999px' : node.shape === 'circle' ? '50%' : node.shape === 'blob' ? '42% 58% 62% 38% / 45% 35% 65% 55%' : node.shape === 'arc' ? '50% 50% 0 0 / 60% 60% 0 0' : node.shape === 'wave' ? '50% 50% 0 0 / 42% 42% 0 0' : node.shape === 'wave-bottom' ? '0 0 50% 50% / 0 0 42% 42%' : `${node.borderRadius || 0}px`);
  const clipPath = imageShape?.clipPath || (node.type === 'image' ? 'none' : node.clipPath || (node.shape === 'angled' ? 'polygon(0 0,100% 0,88% 100%,0 100%)' : 'none'));
  const padding = Math.max(0, Number(node.padding ?? 1.5) || 0);
  const verticalPadding = Math.min(1.25, padding * 0.45);
  const horizontalPadding = Math.min(2.2, padding);
  const textualNode = node.type === 'text' || node.type === 'field' || node.type === 'section';
  const imageNode = node.type === 'image';
  const borderStyle = node.borderStyle || (node.type === 'table' || node.type === 'report-sections' || node.type === 'divider' ? 'solid' : 'none');
  const isSplitFooterAccent = node.id === 'footer-accent' && node.type === 'section' && node.shape !== 'pill' && Number(node.width || 0) <= 30 && Number(node.height || 0) >= 3;
  const nodeX = node.id === 'footer-contact' ? 8 : Number(node.x || 0);
  const nodeWidth = node.id === 'footer-contact' ? Math.max(60, Number(node.width || 0)) : isSplitFooterAccent ? 65 : Number(node.width || 0);
  Object.assign(element.style, {
    position: 'absolute', left: `${nodeX}%`, top: `${node.y}%`, width: `${nodeWidth}%`, height: `${node.height}%`, boxSizing: 'border-box',
    padding: `${verticalPadding}% ${horizontalPadding}%`, color: safeHtml2CanvasColor(node.color || settings.textColor, '#334155'), backgroundColor: imageNode ? 'transparent' : safeHtml2CanvasColor(node.backgroundColor, 'transparent'),
    borderColor: safeHtml2CanvasColor(node.borderColor || settings.lineColor, '#e2e8f0'), borderStyle: imageNode ? 'none' : borderStyle, borderWidth: imageNode ? '0' : node.type === 'divider' ? '1px' : borderStyle === 'none' ? '0' : borderStyle === 'double' ? '3px' : '1px', borderRadius: imageNode ? '0' : borderRadius, clipPath: imageNode ? 'none' : clipPath, opacity: String(node.opacity ?? 1), transform: node.rotation ? `rotateZ(${node.rotation}deg)` : '', transformOrigin: 'center center', fontSize: pdfPointsToCss(node.fontSize || settings.fontSize || 9),
    fontFamily: browserFontFamily(settings.fontFamily), fontWeight: String(node.fontWeight || (node.bold ? 700 : 400)), fontStyle: node.italic ? 'italic' : 'normal', textAlign: node.align || 'left',
    textDecorationLine: [node.underline ? 'underline' : '', node.strikethrough ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
    textTransform: node.textTransform || 'none', letterSpacing: `${node.letterSpacing || 0}px`,
    overflow: imageNode ? 'visible' : 'hidden', lineHeight: String(node.lineHeight || 1.25), display: textualNode ? 'flex' : 'block', alignItems: node.id === 'company-summary' || (node.type === 'section' && node.id === 'party-section') ? 'flex-start' : 'center',
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
  const isProductLabelPrice = node.id === 'label-price';
  const isProductLabelValue = node.id === 'label-price' || node.id === 'label-company' || node.id === 'label-date';
  const isProductLabelText = isProductLabelName || isProductLabelValue;
  const content = isStatusField && rawContent ? `Estado: ${pdfStatusLabel(rawContent)}` : rawContent;
  // El canvas deja que el contenido del encabezado y de etiquetas respire dentro de su caja;
  // el exportador debe conservar ese mismo comportamiento para no recortar letras descendentes
  // (como g, j, p, q, y) ni desplazar textos importantes.
  if (isHeaderText || isProductLabelText) element.style.overflow = 'visible';
  if (node.id === 'company-name' || node.id === 'company-summary') {
    Object.assign(element.style, { alignItems: 'flex-start', justifyContent: 'flex-start', padding: '0' });
  }
  if (node.id === 'document-title') Object.assign(element.style, { overflow: 'visible', whiteSpace: 'normal', textOverflow: 'clip', overflowWrap: 'anywhere', alignItems: 'flex-start', lineHeight: '1.15' });
  if (isProductLabelPrice) {
    element.style.height = `${Math.max(5, Number(node.height) || 0)}%`;
    element.style.padding = '0';
  }
  if (['party-balance-due', 'party-balance-favor'].includes(node.id) && !String(rawContent || '').trim()) {
    element.style.display = 'none';
    return element;
  }
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
    if (node.id === 'company-name' || node.id === 'company-summary') {
      Object.assign(text.style, { display: 'block', width: '100%', textAlign: node.align || 'left', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
    }
    if (node.id === 'document-title') Object.assign(text.style, { display: 'block', width: '100%', whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', overflowWrap: 'anywhere', lineHeight: '1.15' });
    const contentLength = String(content).trim().length;
    const productLabelFontSize = isProductLabelName
      ? Math.max(5.8, Math.min(Number(node.fontSize) || 7.5, 8.6 - Math.max(0, contentLength - 18) * 0.11))
      : isProductLabelValue
        ? Math.max(4.2, Math.min(Number(node.fontSize) || 8, 8.6 - Math.max(0, contentLength - 22) * 0.08))
        : undefined;
    const [labelPageWidthMm, labelPageHeightMm] = pageDimensions(settings.paperSize);
    const labelPageWidthCss = labelPageWidthMm * 96 / 25.4;
    const labelPageHeightCss = labelPageHeightMm * 96 / 25.4;
    const labelNodeWidthCss = labelPageWidthCss * Math.max(0, Number(node.width) || 0) / 100;
    const effectiveLabelNodeHeightPercent = isProductLabelPrice
      ? Math.max(5, Number(node.height) || 0)
      : Math.max(0, Number(node.height) || 0);
    const labelNodeHeightCss = labelPageHeightCss * effectiveLabelNodeHeightPercent / 100;
    const nodeVerticalPaddingPercent = isProductLabelPrice
      ? 0
      : Math.min(1.25, Math.max(0, Number(node.padding ?? 1.5)) * 0.45);
    const labelVerticalPaddingCss = labelNodeWidthCss * nodeVerticalPaddingPercent / 100;
    const labelNodeContentHeightCss = Math.max(0, labelNodeHeightCss - labelVerticalPaddingCss * 2 - 1.5);
    const labelFontSizeThatFits = labelNodeContentHeightCss / (1.333 * PDF_DEFAULT_FONT_SCALE * 1.1);
    const fittedProductLabelFontSize = isProductLabelValue && productLabelFontSize !== undefined
      ? Math.max(2.5, Math.min(productLabelFontSize, labelFontSizeThatFits))
      : productLabelFontSize;
    Object.assign(text.style, {
      position: 'relative', zIndex: '1', display: 'block', width: '100%', height: 'auto', minWidth: '0', minHeight: '0',
      justifyContent: isReportKpiLabel ? 'center' : 'flex-start', textAlign: isReportKpiLabel ? 'center' : node.align || 'left',
      whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'normal', overflow: 'visible',
      ...(isReportKpiLabel ? { lineHeight: '1.05', padding: '0 2px' } : {}),
      ...(isProductLabelName ? { fontSize: pdfPointsToCss(fittedProductLabelFontSize, 5.5), lineHeight: '1.25', whiteSpace: 'normal', wordBreak: 'break-word' } : {}),
      ...(isProductLabelValue ? { fontSize: pdfPointsToCss(fittedProductLabelFontSize, 2.5), lineHeight: '1.2', whiteSpace: 'nowrap', textOverflow: 'clip' } : {}),
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

function createTableNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings, targetKey?: string) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  // Una tabla con pocas filas no debe conservar la altura editorial del nodo:
  // el navegador estira sus filas para llenar una tabla con height: 100%,
  // dejando el contenido suspendido en medio de un gran espacio vacío.
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.overflow = 'visible';
  element.style.padding = '0';
  const isRollPaper = settings.paperSize === 'ROLL-80' || settings.paperSize === 'ROLL-58';
  const isTransactionTable = node.id === 'items-table' && !isRollPaper;
  const isStandardTable = Boolean(targetKey && isStandardPdfLayoutTarget(targetKey));
  const salesTableTextBoost = targetKey && isStandardPdfLayoutTarget(targetKey) ? 1.25 : 0;
  // Algunos diseños guardados dejaron la tabla de partidas más cerca del
  // borde que las tarjetas. Normalizamos solo sus márgenes, conservando una
  // anchura menor si el usuario ya había definido una tabla más estrecha.
  const tableLeft = Number(node.x || 0);
  const tableWidth = Number(node.width || 0);
  if (isTransactionTable && (tableLeft < 5 || tableLeft + tableWidth > 95)) {
    element.style.left = '5%';
    element.style.width = `${Math.min(90, tableWidth || 90)}%`;
  }
  const pdfTableStyle = settings.pdfTableStyle || (['light', 'boxed', 'bold', 'striped', 'bubble', 'wave', 'folder'].includes(settings.tableLayout || '') ? settings.tableLayout as PdfTableStyle : 'light');
  const tablePresentation = getPdfTablePresentation(pdfTableStyle);
  element.style.borderStyle = tablePresentation.outerBorder || isTransactionTable ? 'solid' : 'none';
  element.style.borderWidth = `${isTransactionTable ? Math.max(1, tablePresentation.outerBorderWidth) : tablePresentation.outerBorderWidth}px`;
  element.style.borderRadius = tablePresentation.roundedRows ? '7px' : isTransactionTable ? '2px' : '0';
  const table = document.createElement('table');
  // Esta tabla vive en un lienzo de impresión; no debe ser transformada en
  // tarjetas por el hook responsive global mientras html2canvas la captura.
  table.setAttribute('data-responsive-cards', 'false');
  table.style.width = '100%'; table.style.height = 'auto'; table.style.borderCollapse = isTransactionTable ? 'collapse' : tablePresentation.rowGap ? 'separate' : 'collapse'; table.style.borderSpacing = isTransactionTable ? '0' : tablePresentation.rowGap ? `0 ${tablePresentation.rowGap}px` : '0';
  const columns = node.columns?.length ? node.columns : [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'total', label: 'Total', token: 'total', width: 30, align: 'right' as const }];
  const compact = node.id === 'items-table' || columns.length >= 5 || isRollPaper;
  table.style.fontSize = pdfPointsToCss(Math.max(isRollPaper ? 6.5 : compact ? 7 : 7.5, (node.fontSize || settings.fontSize || 9) - (isRollPaper ? 1.2 : compact ? 1.8 : 1) + salesTableTextBoost));
  table.style.fontFamily = browserFontFamily(settings.fontFamily); table.style.tableLayout = 'fixed'; table.style.lineHeight = compact ? '1.12' : '1.25';
  const head = table.createTHead().insertRow();
  const tableLayout = settings.tableLayout || 'standard';
  const primaryColor = safeHtml2CanvasColor(settings.primaryColor, '#10b981');
  const textColor = safeHtml2CanvasColor(settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const tableOuterBorderColor = safeHtml2CanvasColor(node.borderColor || lineColor, lineColor);
  const tableBorderColor = safeHtml2CanvasColor(resolvePdfReportTableBorderColor(targetKey || '', node.borderColor, lineColor), lineColor);
  element.style.borderColor = tablePresentation.outerBorderTone === 'accent' ? primaryColor : tableOuterBorderColor;
  const headerBackground = node.tableHeaderColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? '#ffffff' : primaryColor);
  const headerColor = node.tableHeaderTextColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? textColor : '#ffffff');
  const rowTextColor = node.tableTextColor || textColor;
  const rowBackground = node.tableStripeColor || (tableLayout === 'striped' || tableLayout === 'standard' || tableLayout === 'accent' ? '#f8fafc' : 'transparent');
  columns.forEach((column, columnIndex) => {
    const cell = document.createElement('th');
    const headerCellLayout = getPdfTableHeaderCellLayout(compact, isStandardTable || isTransactionTable, isRollPaper);
    cell.scope = 'col';
    cell.appendChild(createPdfTableHeaderLabel(column.label, headerCellLayout, isRollPaper ? 'nowrap' : 'normal'));
    head.appendChild(cell);
    cell.style.width = `${column.width || 25}%`;
    cell.style.minWidth = '0'; cell.style.maxWidth = '100%'; cell.style.boxSizing = 'border-box';
    cell.style.textAlign = column.align || 'left'; cell.style.verticalAlign = getPdfTableCellVerticalAlignment('header');
    cell.style.padding = headerCellLayout.padding;
    cell.style.backgroundColor = safeHtml2CanvasColor(column.backgroundColor || headerBackground, headerBackground);
    cell.style.color = safeHtml2CanvasColor(column.color || headerColor, headerColor);
    cell.style.fontWeight = pdfTableStyle === 'bold' ? '800' : '700';
    cell.style.fontSize = pdfPointsToCss(Math.max(isRollPaper ? 6.5 : compact ? 6.8 : 7.5, (node.fontSize || settings.fontSize || 9) - (isRollPaper ? 1.5 : compact ? 2 : 1.5) + salesTableTextBoost));
    cell.style.lineHeight = headerCellLayout.lineHeight;
    cell.style.letterSpacing = isRollPaper || compact ? '0' : '0.15px';
    cell.style.textTransform = tablePresentation.headerTextTransform;
    const headerRuleColor = tablePresentation.headerRuleTone === 'accent' ? primaryColor : tableBorderColor;
    cell.style.borderBottom = `${tablePresentation.headerRuleWidth}px solid ${headerRuleColor}`;
    cell.style.whiteSpace = isRollPaper ? 'nowrap' : 'normal'; cell.style.overflow = 'visible';
    cell.style.overflowWrap = isRollPaper ? 'normal' : 'break-word'; cell.style.wordBreak = 'normal';
    if (tablePresentation.cellBorders === 'grid') {
      cell.style.borderLeft = `1px solid ${tableBorderColor}`;
      cell.style.borderRight = `1px solid ${tableBorderColor}`;
    }
    if (isTransactionTable) {
      cell.style.border = `1px solid ${tableBorderColor}`;
      cell.style.borderBottom = `2px solid ${tableBorderColor}`;
    }
    if (tablePresentation.rowAccentWidth && columnIndex === 0) cell.style.borderLeft = `${tablePresentation.rowAccentWidth}px solid ${primaryColor}`;
  });
  const body = table.createTBody();
  body.style.height = 'auto';
  // Las filas ya se dividen en trabajos por página antes de renderizar. No
  // volver a truncarlas aquí: ese límite ocultaba registros de exportaciones
  // globales cuando una plantilla recibía más de 30 filas.
  asRows(data).forEach((row, rowIndex) => {
    const tr = body.insertRow();
    tr.style.height = 'auto';
    columns.forEach((column, columnIndex) => {
      const cell = tr.insertCell();
      const rawValue = row[column.token] ?? row[column.id];
      const cellText = isStatusColumn(column) ? pdfStatusLabel(rawValue) : escapeValue(rawValue);
      cell.textContent = cellText;
      cell.style.padding = isRollPaper ? '3px 4px' : isStandardTable ? compact ? '5px 6px' : '7px 8px' : isTransactionTable ? '6px 8px' : compact ? '4px 5px' : tableLayout === 'compact' ? '5px 7px' : '7px 9px';
      cell.style.height = 'auto';
      cell.style.maxHeight = 'none';
      cell.style.minWidth = '0';
      cell.style.maxWidth = '100%';
      cell.style.textAlign = column.align || 'left';
      const isDescription = column.token === 'description' || column.id === 'description' || /descrip|concepto|detalle/i.test(`${column.label || ''} ${column.token || ''} ${column.id || ''}`) || String(rawValue ?? '').includes('\n');
      const isNumericCell = column.align === 'right' && !isDescription;
      cell.style.verticalAlign = getPdfTableCellVerticalAlignment('body');
      cell.style.lineHeight = compact ? '1.25' : '1.35';
      cell.style.whiteSpace = isDescription ? 'pre-wrap' : isNumericCell ? 'nowrap' : 'normal';
      cell.style.overflow = 'visible';
      cell.style.overflowWrap = isNumericCell ? 'normal' : 'anywhere';
      cell.style.wordBreak = isNumericCell ? 'normal' : 'break-word';
      cell.style.color = rowTextColor;
      cell.style.backgroundColor = safeHtml2CanvasColor(resolvePdfTableRowBackground(pdfTableStyle, { tableRow: node.tableRowColor || '#ffffff', tableStripe: node.tableStripeColor || rowBackground }, rowIndex), '#ffffff');
      Object.assign(cell.style, getPdfTableCellBorders(pdfTableStyle, columnIndex, columns.length, tableBorderColor, primaryColor));
      if (isTransactionTable) cell.style.border = `1px solid ${tableBorderColor}`;
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
      cell.style.padding = isTransactionTable ? '6px 8px' : compact ? '4px 4px' : '6px 8px';
      cell.style.borderTop = `${tablePresentation.summaryTone === 'plain' ? 1 : 2}px solid ${tablePresentation.summaryTone === 'plain' ? tableBorderColor : primaryColor}`;
      cell.style.backgroundColor = tablePresentation.summaryTone === 'accent' ? primaryColor : tablePresentation.summaryTone === 'header' ? headerBackground : tablePresentation.summaryTone === 'stripe' ? (node.tableStripeColor || '#f8fafc') : 'transparent';
      cell.style.color = tablePresentation.summaryTone === 'accent' ? headerColor : textColor;
      cell.style.fontWeight = '700';
      cell.style.textAlign = column.align || 'left';
      cell.style.verticalAlign = getPdfTableCellVerticalAlignment('footer');
      cell.style.whiteSpace = column.align === 'right' ? 'nowrap' : 'normal';
      cell.style.overflow = 'visible';
      cell.style.overflowWrap = column.align === 'right' ? 'normal' : 'anywhere';
      if (isTransactionTable) cell.style.border = `1px solid ${tableBorderColor}`;
    });
  }
  element.appendChild(table);
  return element;
}

function createReportSectionsNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings, targetKey?: string) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  const pageNumber = Number((data.page as Record<string, unknown> | undefined)?.index || (data.page as Record<string, unknown> | undefined)?.number || 1);
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
  // La altura de cada encabezado depende de cuánto envuelva el texto. Si el
  // contenedor recorta su contenido, los encabezados de las primeras tablas
  // (que suelen tener columnas más largas) quedan cortados en la captura.
  element.style.overflow = 'visible';

  const fullWidthReportSections = Boolean(targetKey && isStandardPdfLayoutTarget(targetKey));
  const isCustomerList = targetKey === 'ventas.customers';
  const sectionTableGap = getPdfReportSectionTableGap(targetKey || '');
  const sections = Array.isArray(data.reportSections) ? data.reportSections : [];
  const content = document.createElement('div');
  Object.assign(content.style, { width: '100%', height: 'auto', minHeight: '0', overflow: 'visible', padding: fullWidthReportSections ? '0' : '6px 8px', boxSizing: 'border-box' });
  const tableLayout = settings.tableLayout || 'standard';
  const pdfTableStyle = settings.pdfTableStyle || (['light', 'boxed', 'bold', 'striped', 'bubble', 'wave', 'folder'].includes(tableLayout) ? tableLayout as PdfTableStyle : 'light');
  const tablePresentation = getPdfTablePresentation(pdfTableStyle);
  const primaryColor = safeHtml2CanvasColor(settings.primaryColor, '#10b981');
  const textColor = safeHtml2CanvasColor(settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const tableOuterBorderColor = safeHtml2CanvasColor(node.borderColor || lineColor, lineColor);
  const tableBorderColor = safeHtml2CanvasColor(resolvePdfReportTableBorderColor(targetKey || '', node.borderColor, lineColor), lineColor);
  element.style.borderStyle = tablePresentation.outerBorder && !fullWidthReportSections ? 'solid' : 'none';
  element.style.borderWidth = fullWidthReportSections ? '0' : `${tablePresentation.outerBorderWidth}px`;
  element.style.borderColor = tablePresentation.outerBorderTone === 'accent' ? primaryColor : tableOuterBorderColor;
  if (fullWidthReportSections) element.style.backgroundColor = 'transparent';
  const headerBackground = node.tableHeaderColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? '#ffffff' : primaryColor);
  const headerColor = node.tableHeaderTextColor || (tableLayout === 'minimal' || tableLayout === 'ledger' ? textColor : '#ffffff');
  const rowBackground = node.tableStripeColor || '#f8fafc';
  const compact = tableLayout === 'compact' || (settings.orientation !== 'landscape' && sections.some(section => section.columns.length >= 5));
  const isStandardReportTable = Boolean(targetKey && isStandardPdfLayoutTarget(targetKey));
  const standardTableTextBoost = fullWidthReportSections ? 1.25 : 0;
  const baseFontSize = Number(settings.fontSize || 9) + standardTableTextBoost;
  const tableFontSize = Math.max(6, Math.min(12, baseFontSize * (compact ? 7 / 9 : 7.5 / 9)));
  const tableHeaderFontSize = Math.max(5.5, Math.min(11, baseFontSize * (compact ? 6.8 / 9 : 7.5 / 9)));
  const tableTitleFontSize = Math.max(7, Math.min(14, baseFontSize * 10 / 9));

  sections.forEach((section, sectionIndex) => {
    const styleIndex = section.templateIndex ?? sectionIndex;
    const sectionStyle = node.reportSectionStyles?.[String(styleIndex)] || {};
    const sectionColor = section.color?.length === 3
      ? `#${section.color.map(channel => Math.max(0, Math.min(255, Math.round(Number(channel) || 0))).toString(16).padStart(2, '0')).join('')}`
      : undefined;
    const sectionHeaderBackground = sectionStyle.headerColor || node.tableHeaderColor || sectionColor || headerBackground;
    const sectionHeaderText = sectionStyle.headerTextColor || node.tableHeaderTextColor || headerColor;
    const rowTextColor = sectionStyle.rowTextColor || node.tableTextColor || textColor;
    const sectionElement = document.createElement('div');
    Object.assign(sectionElement.style, { width: '100%', marginBottom: sectionIndex === sections.length - 1 ? '0' : compact ? '6px' : '9px', overflow: 'visible' });
    const title = document.createElement('div');
    title.textContent = section.title;
    Object.assign(title.style, { display: 'block', boxSizing: 'border-box', width: fullWidthReportSections ? '100%' : '96%', height: 'auto', minHeight: pdfPointsToCss(tableTitleFontSize), margin: fullWidthReportSections ? '0' : '0 auto 15px', color: textColor, fontFamily: browserFontFamily(settings.fontFamily), fontSize: pdfPointsToCss(tableTitleFontSize), fontWeight: '700', lineHeight: '1.25', padding: '2px 0 1px', borderBottom: 'none', whiteSpace: 'normal', overflow: 'visible', overflowWrap: 'anywhere' });
    sectionElement.appendChild(title);

    const table = document.createElement('table');
    Object.assign(table.style, { width: fullWidthReportSections ? '100%' : '96%', height: 'auto', margin: fullWidthReportSections ? `${sectionTableGap}px 0 0` : '0 auto', borderCollapse: tablePresentation.rowGap ? 'separate' : 'collapse', borderSpacing: tablePresentation.rowGap ? `0 ${tablePresentation.rowGap}px` : '0', tableLayout: 'fixed', fontFamily: browserFontFamily(settings.fontFamily), fontSize: pdfPointsToCss(tableFontSize), lineHeight: compact ? '1.25' : '1.3' });
    table.setAttribute('data-responsive-cards', 'false');
    const head = table.createTHead().insertRow();
    Object.assign(head.style, { backgroundColor: safeHtml2CanvasColor(sectionHeaderBackground, headerBackground), color: safeHtml2CanvasColor(sectionHeaderText, headerColor), height: 'auto', lineHeight: compact ? '1.15' : '1.2' });
    section.columns.forEach((column, columnIndex) => {
      const cell = document.createElement('th');
      const headerCellLayout = getPdfTableHeaderCellLayout(compact, isStandardReportTable);
      cell.scope = 'col';
      head.appendChild(cell);
      const keepSessionDateTogether = fullWidthReportSections && section.id === 'cash-sessions' && column.id === 'date';
      cell.appendChild(createPdfTableHeaderLabel(column.label, headerCellLayout, keepSessionDateTogether ? 'nowrap' : 'normal'));
      const configuredColumn = node.columns?.[columnIndex];
      const headerCellBackground = settings.pdfTableStyle ? sectionHeaderBackground : column.backgroundColor || sectionStyle.columnColors?.[String(columnIndex)] || configuredColumn?.backgroundColor || sectionHeaderBackground;
      const headerCellText = settings.pdfTableStyle ? sectionHeaderText : column.color || sectionStyle.columnTextColors?.[String(columnIndex)] || configuredColumn?.color || sectionHeaderText;
      const headerRuleColor = tablePresentation.headerRuleTone === 'accent' ? primaryColor : tableBorderColor;
      const rightAlignHistoricalHeaders = fullWidthReportSections && section.id === 'cash-sessions';
      Object.assign(cell.style, { width: `${column.width || 100 / Math.max(1, section.columns.length)}%`, minWidth: '0', maxWidth: '100%', boxSizing: 'border-box', textAlign: rightAlignHistoricalHeaders ? 'right' : column.align || 'left', verticalAlign: getPdfTableCellVerticalAlignment('header'), padding: headerCellLayout.padding, backgroundColor: safeHtml2CanvasColor(headerCellBackground, sectionHeaderBackground), color: safeHtml2CanvasColor(headerCellText, sectionHeaderText), fontWeight: '700', fontSize: pdfPointsToCss(tableHeaderFontSize), lineHeight: headerCellLayout.lineHeight, textTransform: tablePresentation.headerTextTransform, borderBottom: `${tablePresentation.headerRuleWidth}px solid ${headerRuleColor}`, whiteSpace: keepSessionDateTogether ? 'nowrap' : 'normal', overflow: 'visible', overflowWrap: keepSessionDateTogether ? 'normal' : 'anywhere', wordBreak: keepSessionDateTogether ? 'normal' : 'break-word', ...(tablePresentation.cellBorders === 'grid' ? { borderLeft: `1px solid ${tableBorderColor}`, borderRight: `1px solid ${tableBorderColor}` } : {}), ...(tablePresentation.rowAccentWidth && columnIndex === 0 ? { borderLeft: `${tablePresentation.rowAccentWidth}px solid ${primaryColor}` } : {}) });
    });
  const body = table.createTBody();
    body.style.height = 'auto';
    const rows = section.rows;
    rows.forEach((row, rowIndex) => {
      const tr = body.insertRow();
      tr.style.height = 'auto';
      section.columns.forEach((column, columnIndex) => {
        const cell = tr.insertCell();
        const keepSessionDateTogether = fullWidthReportSections && section.id === 'cash-sessions' && column.id === 'date';
        const rawValue = row[column.token] ?? row[column.id];
        const cellText = isStatusColumn(column) ? pdfStatusLabel(rawValue) : escapeValue(rawValue ?? '—');
        cell.textContent = cellText;
        const rowColor = sectionStyle.rowColor || resolvePdfTableRowBackground(pdfTableStyle, { tableRow: node.tableRowColor || '#ffffff', tableStripe: sectionStyle.stripeColor || rowBackground }, rowIndex);
        Object.assign(cell.style, { padding: isCustomerList ? '4px 6px' : isStandardReportTable ? compact ? '5px 6px' : '7px 8px' : compact ? '5px 6px' : '7px 8px', height: 'auto', maxHeight: 'none', minWidth: '0', maxWidth: '100%', color: rowTextColor, textAlign: column.align || 'left', verticalAlign: getPdfTableCellVerticalAlignment('body'), whiteSpace: keepSessionDateTogether ? 'nowrap' : 'pre-wrap', overflow: 'visible', overflowWrap: keepSessionDateTogether ? 'normal' : 'anywhere', wordBreak: keepSessionDateTogether ? 'normal' : 'break-word', lineHeight: compact || isCustomerList ? '1.2' : '1.35', backgroundColor: safeHtml2CanvasColor(rowColor, '#ffffff'), ...getPdfTableCellBorders(pdfTableStyle, columnIndex, section.columns.length, tableBorderColor, primaryColor) });
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
        cell.style.borderTop = `${tablePresentation.summaryTone === 'plain' ? 1 : 2}px solid ${tablePresentation.summaryTone === 'plain' ? tableBorderColor : primaryColor}`;
        cell.style.backgroundColor = tablePresentation.summaryTone === 'accent' ? primaryColor : tablePresentation.summaryTone === 'header' ? headerBackground : tablePresentation.summaryTone === 'stripe' ? (node.tableStripeColor || '#f8fafc') : 'transparent';
        cell.style.color = tablePresentation.summaryTone === 'accent' ? headerColor : textColor;
        cell.style.fontWeight = '700';
        cell.style.textAlign = column.align || 'left';
        cell.style.verticalAlign = getPdfTableCellVerticalAlignment('footer');
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
  element.style.height = 'auto';
  element.style.minHeight = '0';
  element.style.overflow = 'visible';
  element.style.borderStyle = 'none'; element.style.borderWidth = '0';
  element.style.backgroundColor = 'transparent';
  const isRollPaper = settings.paperSize === 'ROLL-80' || settings.paperSize === 'ROLL-58';
  element.style.padding = isRollPaper ? '4px 6px' : '0 10px';
  element.style.fontSize = pdfPointsToCss(Math.max(isRollPaper ? 7 : 8, (node.fontSize || settings.fontSize || 9) - 0.5));
  const totals = data.totals || {};
  [['subtotal', 'Subtotal'], ['tax', 'Impuestos'], ['discount', 'Descuento'], ['total', 'Total']].forEach(([key, label]) => {
    const row = document.createElement('div'); row.style.display = 'flex'; row.style.justifyContent = 'space-between'; row.style.gap = '8px'; row.style.marginBottom = key === 'total' ? '0' : isRollPaper ? '2px' : '3px'; row.style.lineHeight = '1.35'; row.style.fontSize = pdfPointsToCss(key === 'total' ? (isRollPaper ? 8.5 : 9.5) : (isRollPaper ? 7.5 : 8)); if (key === 'total') { row.style.borderTop = `1px solid ${safeHtml2CanvasColor(settings.lineColor, '#cbd5e1')}`; row.style.marginTop = isRollPaper ? '4px' : '6px'; row.style.paddingTop = isRollPaper ? '4px' : '5px'; row.style.fontWeight = '700'; }
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
    overflow: 'visible',
  });
  const canvas = document.createElement('canvas');
  const value = tokenValue(node, data) || node.sample || '000000000000';
  const barcodeMultiplier = isProductLabelBarcode ? 2.5 : 1;
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: (isProductLabelBarcode ? 1.8 : 1.5) * barcodeMultiplier,
      height: (isProductLabelBarcode ? 32 : 34) * barcodeMultiplier,
      displayValue: true,
      fontSize: Math.max(8, Math.min(22, Math.round((Number(node.fontSize) || 8) * 1.2 * PDF_DEFAULT_FONT_SCALE))) * barcodeMultiplier,
      margin: 0,
      textMargin: (isProductLabelBarcode ? 2 : 1) * barcodeMultiplier,
      background: 'transparent',
      lineColor: safeHtml2CanvasColor(node.color, '#111827'),
    });
    Object.assign(canvas.style, {
      display: 'block',
      maxWidth: '100%',
      maxHeight: '100%',
      width: 'auto',
      height: 'auto',
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

function createChartNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings) {
  const element = document.createElement('div');
  setBaseNodeStyle(element, node, settings);
  Object.assign(element.style, { display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '4px 6px', gap: '3px', overflow: 'hidden', borderWidth: '1px', boxSizing: 'border-box' });
  const chart = data.dashboardCharts?.find(item => item.id === node.token);
  if (!chart) return element;
  if (chart.imageDataUrl) {
    Object.assign(element.style, { display: 'block', padding: '0', gap: '0', border: '0', backgroundColor: 'transparent' });
    const image = document.createElement('img');
    image.src = chart.imageDataUrl;
    image.alt = chart.title;
    Object.assign(image.style, { display: 'block', width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', objectPosition: 'center' });
    element.appendChild(image);
    return element;
  }
  const chartType = node.chartType || chart.type;
  const title = document.createElement('div');
  title.textContent = chart.title || node.label;
  Object.assign(title.style, { flex: '0 0 auto', minHeight: pdfPointsToCss(8), maxHeight: pdfPointsToCss(20), fontFamily: browserFontFamily(settings.fontFamily), fontSize: pdfPointsToCss(8), fontWeight: '700', color: safeHtml2CanvasColor(node.color || settings.textColor, '#334155'), lineHeight: '1.15', whiteSpace: 'normal', overflow: 'hidden', textOverflow: 'ellipsis', overflowWrap: 'anywhere', position: 'relative', zIndex: '1' });
  element.appendChild(title);
  const viewBox = chartType === 'area' ? '0 0 420 230' : '0 0 360 220';
  const svg = svgElement('svg', { viewBox, preserveAspectRatio: 'xMidYMid meet', width: '100%', height: '100%' });
  // Mantiene la proporción del dibujo: los círculos permanecen circulares y
  // las etiquetas no se estiran al encajar en tarjetas de distinto tamaño.
  svg.style.flex = '1 1 auto';
  svg.style.minHeight = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  const labels = chart.labels || [];
  const values = chart.values || chart.series?.[0]?.values || [];
  const palette = chart.colors?.length ? chart.colors : ['#10b981', '#2563eb', '#f59e0b', '#8b5cf6', '#ef4444'];
  const textColor = safeHtml2CanvasColor(node.color || settings.textColor, '#334155');
  const lineColor = safeHtml2CanvasColor(settings.lineColor, '#e2e8f0');
  const safeValues = values.map(value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  const formatChartValue = (value: number, compact = false) => {
    const maximumFractionDigits = chart.valueFormat === 'currency' ? 2 : chart.valueFormat === 'percent' ? 1 : 0;
    const formatted = new Intl.NumberFormat('es-NI', {
      maximumFractionDigits: compact ? 1 : maximumFractionDigits,
      minimumFractionDigits: compact ? 0 : chart.valueFormat === 'currency' ? 2 : 0,
      ...(compact ? { notation: 'compact' as const } : {}),
    }).format(value);
    return chart.unitLabel && !compact ? `${formatted} ${chart.unitLabel}` : formatted;
  };
  const allChartValues = [...safeValues, ...(chart.series || []).flatMap(series => series.values.map(value => Math.max(0, Number(value) || 0)))];
  const hasChartData = allChartValues.some(value => value > 0);
  const maxValue = Math.max(1, ...safeValues, ...(chart.series || []).flatMap(series => series.values.map(value => Math.max(0, Number(value) || 0))));
  if (!labels.length || !hasChartData) {
    const empty = svgElement('text', { x: chartType === 'area' ? 210 : 180, y: 112, fill: '#64748b', 'font-size': 13, 'text-anchor': 'middle' });
    empty.textContent = 'Sin datos para este período';
    svg.appendChild(empty);
  } else if (chartType === 'donut') {
    const total = safeValues.reduce((sum, value) => sum + value, 0) || 1;
    const displayValues = safeValues.length > 5
      ? [...safeValues.slice(0, 4), safeValues.slice(4).reduce((sum, value) => sum + value, 0)]
      : safeValues;
    const displayLabels = safeValues.length > 5 ? [...labels.slice(0, 4), 'Otros'] : labels.slice(0, 5);
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    displayValues.forEach((value, index) => {
      const length = circumference * value / total;
      svg.appendChild(svgElement('circle', { cx: 82, cy: 110, r: radius, fill: 'none', stroke: palette[index % palette.length], 'stroke-width': 22, 'stroke-dasharray': `${length} ${circumference - length}`, 'stroke-dashoffset': -offset, transform: 'rotate(-90 82 110)' }));
      offset += length;
    });
    const center = svgElement('text', { x: 82, y: 115, fill: textColor, 'font-size': 13, 'font-weight': '700', 'text-anchor': 'middle' });
    center.textContent = formatChartValue(total, true);
    svg.appendChild(center);
    if (chart.unitLabel) {
      const unit = svgElement('text', { x: 158, y: 15, fill: textColor, 'font-size': 8, 'font-weight': '700' });
      unit.textContent = chart.unitLabel;
      svg.appendChild(unit);
    }
    displayLabels.forEach((label, index) => {
      const y = 34 + index * 36;
      svg.appendChild(svgElement('rect', { x: 158, y: y - 8, width: 9, height: 9, rx: 2, fill: palette[index % palette.length] }));
      const itemLabel = svgElement('text', { x: 174, y, fill: textColor, 'font-size': 8.5 });
      itemLabel.textContent = String(label).length > 30 ? `${String(label).slice(0, 29)}…` : String(label);
      svg.appendChild(itemLabel);
      const itemValue = svgElement('text', { x: 352, y, fill: textColor, 'font-size': 10, 'text-anchor': 'end', 'font-weight': '700' });
      itemValue.textContent = formatChartValue(displayValues[index] ?? 0, true);
      svg.appendChild(itemValue);
    });
  } else if (chartType === 'bar') {
    const chartValues = safeValues.slice(0, 5);
    const chartLabels = labels.slice(0, chartValues.length);
    const rowHeight = Math.min(38, 188 / Math.max(1, chartValues.length));
    if (chart.unitLabel) {
      const unit = svgElement('text', { x: 4, y: 10, fill: textColor, 'font-size': 8, 'font-weight': '700' });
      unit.textContent = chart.unitLabel;
      svg.appendChild(unit);
    }
    chartValues.forEach((value, index) => {
      const y = 14 + index * rowHeight;
      const label = svgElement('text', { x: 3, y: y + 13, fill: textColor, 'font-size': 9 });
      const fullLabel = String(chartLabels[index] || '');
      label.textContent = fullLabel.length > 21 ? `${fullLabel.slice(0, 20)}…` : fullLabel;
      svg.appendChild(label);
      svg.appendChild(svgElement('rect', { x: 146, y: y + 3, width: Math.max(2, (value / maxValue) * 145), height: Math.max(8, rowHeight - 8), rx: 3, fill: palette[index % palette.length], opacity: 0.88 }));
      const valueLabel = svgElement('text', { x: 356, y: y + 13, fill: textColor, 'font-size': 9, 'text-anchor': 'end', 'font-weight': '700' });
      valueLabel.textContent = formatChartValue(value, true);
      svg.appendChild(valueLabel);
    });
  } else {
    const series = chart.series?.length ? chart.series : [{ label: chart.title, values: safeValues, color: palette[0] }];
    const allValues = series.flatMap(item => item.values.map(value => Math.max(0, Number(value) || 0)));
    const chartMax = Math.max(1, ...allValues);
    const plotTop = chart.unitLabel ? 52 : 43;
    const plotBottom = 178;
    const plotLeft = 64;
    const plotRight = 410;
    if (chart.unitLabel) {
      const unit = svgElement('text', { x: plotLeft, y: 36, fill: textColor, 'font-size': 9, 'font-weight': '700' });
      unit.textContent = chart.unitLabel;
      svg.appendChild(unit);
    }
    series.slice(0, 3).forEach((item, seriesIndex) => {
      const legendStep = series.length > 2 ? 112 : 166;
      const legendX = 72 + seriesIndex * legendStep;
      const color = item.color || palette[seriesIndex % palette.length];
      svg.appendChild(svgElement('line', { x1: legendX, y1: 16, x2: legendX + 13, y2: 16, stroke: color, 'stroke-width': 3.5 }));
      const legend = svgElement('text', { x: legendX + 18, y: 19, fill: textColor, 'font-size': 8.5 });
      const legendLabel = String(item.label || '');
      const maxLegendLength = series.length > 2 ? 12 : 19;
      legend.textContent = legendLabel.length > maxLegendLength ? `${legendLabel.slice(0, maxLegendLength - 1)}…` : legendLabel;
      svg.appendChild(legend);
    });
    [0, 0.5, 1].forEach(fraction => {
      const y = plotBottom - fraction * (plotBottom - plotTop);
      svg.appendChild(svgElement('line', { x1: plotLeft, y1: y, x2: plotRight, y2: y, stroke: lineColor, 'stroke-width': 0.7 }));
      const axis = svgElement('text', { x: 57, y: y + 3, fill: textColor, 'font-size': 8, 'text-anchor': 'end' });
      axis.textContent = formatChartValue(chartMax * fraction, true);
      svg.appendChild(axis);
    });
    series.slice(0, 3).forEach((item, seriesIndex) => {
      const color = item.color || palette[seriesIndex % palette.length];
      const points = item.values.slice(0, labels.length).map((value, index, source) => ({ x: source.length === 1 ? (plotLeft + plotRight) / 2 : plotLeft + index * ((plotRight - plotLeft) / (source.length - 1)), y: plotBottom - (Math.max(0, Number(value) || 0) / chartMax) * (plotBottom - plotTop) }));
      if (!points.length) return;
      const linePath = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
      const areaPath = `${linePath} L${points[points.length - 1].x},${plotBottom} L${points[0].x},${plotBottom} Z`;
      svg.appendChild(svgElement('path', { d: areaPath, fill: color, opacity: 0.12 }));
      svg.appendChild(svgElement('path', { d: linePath, fill: 'none', stroke: color, 'stroke-width': 2.5 }));
      points.forEach(point => svg.appendChild(svgElement('circle', { cx: point.x, cy: point.y, r: 2.5, fill: color })));
      if (points.length === 1) {
        const callout = svgElement('text', { x: points[0].x, y: points[0].y - 9, fill: textColor, 'font-size': 9, 'font-weight': '700', 'text-anchor': 'middle' });
        callout.textContent = formatChartValue(Number(item.values[0]) || 0, true);
        svg.appendChild(callout);
      }
    });
    [0, Math.floor((labels.length - 1) / 2), labels.length - 1].filter((index, at, array) => index >= 0 && array.indexOf(index) === at).forEach((index, position) => {
      const x = position === 0 ? plotLeft : position === 1 ? (plotLeft + plotRight) / 2 : plotRight;
      const label = svgElement('text', { x, y: 211, fill: textColor, 'font-size': 9, 'text-anchor': position === 0 ? 'start' : position === 2 ? 'end' : 'middle' });
      const timeLabel = String(labels[index] || '');
      label.textContent = timeLabel.length > 18 ? `${timeLabel.slice(0, 17)}…` : timeLabel;
      svg.appendChild(label);
    });
  }
  element.appendChild(svg);
  return element;
}

function createNode(node: PdfTemplateNode, data: PdfTemplateData, settings: PdfTemplateRenderSettings, targetKey?: string) {
  if (node.type === 'table') return createTableNode(node, data, settings, targetKey);
  if (node.type === 'report-sections') return createReportSectionsNode(node, data, settings, targetKey);
  if (node.type === 'chart') return createChartNode(node, data, settings);
  if (node.type === 'totals') return createTotalsNode(node, data, settings);
  if (node.type === 'barcode') return createBarcodeNode(node, data, settings);
  if (node.type === 'image') {
    const element = document.createElement('div');
    setBaseNodeStyle(element, node, settings);
    const isCompanyLogo = node.id === 'company-logo';
    if (isCompanyLogo) element.style.padding = '0';
    const shapeStyles = pdfTemplateImageShapeStyles(node.shape, node.borderRadius);
    const borderStyle = node.borderStyle || 'none';
    const borderColor = safeHtml2CanvasColor(node.borderColor || settings.lineColor, '#e2e8f0');
    const borderWidth = borderStyle === 'none' ? '0' : borderStyle === 'double' ? '3px' : '2px';
    const frame = document.createElement('div');
    Object.assign(frame.style, {
      position: 'relative', width: '100%', height: '100%', boxSizing: 'border-box', overflow: isCompanyLogo ? 'visible' : 'hidden',
      display: isCompanyLogo ? 'flex' : 'block', alignItems: isCompanyLogo ? 'center' : '', justifyContent: isCompanyLogo ? 'center' : '',
      backgroundColor: node.shape === 'angled' ? 'transparent' : safeHtml2CanvasColor(node.backgroundColor, 'transparent'), borderRadius: shapeStyles.borderRadius,
      clipPath: node.shape === 'angled' ? 'none' : shapeStyles.clipPath,
      border: node.shape === 'angled' ? '0' : `${borderWidth} ${borderStyle} ${borderColor}`,
    });
    const logo = typeof data.logo === 'string' ? data.logo : typeof data.company?.logo === 'string' ? data.company.logo : '';
    if (isCompanyLogo && !logo.trim()) {
      element.style.display = 'none';
      return element;
    }
    const fallback = createLogoFallback(data, settings);
    fallback.style.display = logo ? 'none' : 'flex';
    if (node.id === 'label-logo' && !logo) {
      fallback.style.display = 'none';
      element.style.display = 'none';
    }
    const hasRenderableLogo = Boolean(logo && /^(data:image\/|https?:\/\/|\/)/i.test(logo));
    if (node.shape === 'angled') {
      const svg = svgElement('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
      Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
      const clipId = `pdf-logo-clip-${String(node.id).replace(/[^a-zA-Z0-9_-]/g, '-')}-${Math.random().toString(36).slice(2)}`;
      const defs = svgElement('defs');
      const clipPath = svgElement('clipPath', { id: clipId });
      clipPath.appendChild(svgElement('polygon', { points: '0,0 100,0 88,100 0,100' }));
      defs.appendChild(clipPath);
      svg.appendChild(defs);
      const contentClip = `url(#${clipId})`;
      const background = svgElement('rect', { x: 0, y: 0, width: 100, height: 100, fill: safeHtml2CanvasColor(node.backgroundColor, 'transparent'), 'clip-path': contentClip });
      svg.appendChild(background);
      if (hasRenderableLogo) {
        const image = svgElement('image', { x: 0, y: 0, width: 100, height: 100, href: logo, preserveAspectRatio: 'xMidYMid meet', 'clip-path': contentClip });
        image.addEventListener('load', () => image.setAttribute('data-pdf-image-ready', 'true'), { once: true });
        image.addEventListener('error', () => image.setAttribute('data-pdf-image-ready', 'true'), { once: true });
        svg.appendChild(image);
      } else if (!(node.id === 'label-logo' && !logo)) {
        const gradientId = `${clipId}-gradient`;
        const gradient = svgElement('linearGradient', { id: gradientId, x1: '0%', y1: '0%', x2: '100%', y2: '100%' });
        gradient.appendChild(svgElement('stop', { offset: '0%', 'stop-color': safeHtml2CanvasColor(settings.primaryColor, '#10b981') }));
        gradient.appendChild(svgElement('stop', { offset: '100%', 'stop-color': safeHtml2CanvasColor(settings.secondaryColor, '#0f3b65') }));
        defs.appendChild(gradient);
        svg.appendChild(svgElement('rect', { x: 0, y: 0, width: 100, height: 100, fill: `url(#${gradientId})`, 'clip-path': contentClip }));
        svg.appendChild(svgElement('text', { x: 50, y: 54, fill: '#ffffff', 'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 30, 'font-weight': 800, 'text-anchor': 'middle', 'letter-spacing': '1px' }));
        svg.lastElementChild!.textContent = companyInitials(data);
      }
      if (borderStyle !== 'none') {
        const dashArray = borderStyle === 'dashed' ? '5 3' : borderStyle === 'dotted' ? '0.1 3' : '';
        const addPolygon = (points: string, strokeWidth: number) => {
          const polygon = svgElement('polygon', { points, fill: 'none', stroke: borderColor, 'stroke-width': strokeWidth });
          if (dashArray) polygon.setAttribute('stroke-dasharray', dashArray);
          if (borderStyle === 'dotted') polygon.setAttribute('stroke-linecap', 'round');
          svg.appendChild(polygon);
        };
        if (borderStyle === 'double') {
          addPolygon('1.5,1.5 98.5,1.5 86.8,98.5 1.5,98.5', 1.2);
          addPolygon('5,5 94,5 83,95 5,95', 1.2);
        } else {
          addPolygon('1.5,1.5 98.5,1.5 86.8,98.5 1.5,98.5', 2);
        }
      }
      frame.appendChild(svg);
    } else if (hasRenderableLogo) {
      const image = document.createElement('img');
      image.src = logo;
      image.alt = 'Logo de la empresa';
      image.style.width = isCompanyLogo ? 'auto' : '100%';
      image.style.height = isCompanyLogo ? 'auto' : '100%';
      image.style.maxWidth = '100%'; image.style.maxHeight = '100%'; image.style.objectFit = 'contain'; image.style.objectPosition = 'center'; image.style.display = 'block';
      image.addEventListener('load', () => {
        fallback.style.display = 'none';
        if (!isCompanyLogo) return;
        const naturalWidth = image.naturalWidth;
        const naturalHeight = image.naturalHeight;
        const availableWidth = frame.getBoundingClientRect().width;
        const availableHeight = frame.getBoundingClientRect().height;
        if (!naturalWidth || !naturalHeight || !availableWidth || !availableHeight) return;
        // html2canvas no aplica object-fit de forma consistente. Dar dimensiones
        // explícitas calculadas desde el ratio real evita estirar o cortar el logo.
        const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
        image.style.width = `${naturalWidth * scale}px`;
        image.style.height = `${naturalHeight * scale}px`;
        image.style.maxWidth = 'none';
        image.style.maxHeight = 'none';
        image.style.objectFit = 'fill';
        image.style.flex = '0 0 auto';
      }, { once: true });
      image.addEventListener('error', () => { image.remove(); fallback.style.display = 'flex'; }, { once: true });
      frame.appendChild(image);
    } else if (node.shape !== 'angled') {
      frame.appendChild(fallback);
    }
    element.appendChild(frame);
    return element;
  }
  return createTextNode(node, data, settings);
}

function isDashboardTrendNode(node: PdfTemplateNode) {
  return /(?:^|\.)trend$/i.test(String(node.token || ''));
}

function hasDefaultDashboardChartLayout(definition: PdfTemplateDefinition) {
  const charts = definition.nodes.filter(node => node.type === 'chart');
  if (!charts.length) return false;
  const standardOffset = Number(definition.metadata?.standardLayoutVersion) === 1 ? 5.3 : 0;
  const defaults: Record<string, { x: number; y: number; width: number; height: number }[]> = {
    'chart-trend': [{ x: 5, y: 46, width: 90, height: 14 }, { x: 5, y: 46, width: 90, height: 42 }],
    'chart-attention': [{ x: 5, y: 61, width: 28, height: 14 }],
    'chart-products-sales': [{ x: 35, y: 61, width: 28, height: 14 }],
    'chart-products-margin': [{ x: 65, y: 61, width: 30, height: 14 }],
    'chart-registers': [{ x: 5, y: 76, width: 90, height: 14 }],
  };
  return charts.every(chart => (defaults[chart.id] || []).some(position =>
    Math.abs(Number(chart.x) - position.x) < 0.01
    && Math.abs(Number(chart.y) - (position.y + standardOffset)) < 0.01
    && Math.abs(Number(chart.width) - position.width) < 0.01
    && Math.abs(Number(chart.height) - position.height) < 0.01));
}

function dashboardChartNodeForPage(
  node: PdfTemplateNode,
  pageMode: string,
  detailNodes: PdfTemplateNode[],
  defaultLayout: boolean,
  pageWidth: number,
  pageHeight: number,
  chartAspectRatios: Map<string, number>,
  standardModuleLayout: boolean,
): PdfTemplateNode {
  if (!defaultLayout) return node;
  const heightForImageRatio = (width: number, aspectRatio = chartAspectRatios.get(String(node.token || ''))) => aspectRatio && aspectRatio > 0
    ? width * (pageWidth / pageHeight) / aspectRatio
    : undefined;
  if (pageMode === 'overview' && isDashboardTrendNode(node)) {
    const y = standardModuleLayout ? 51.3 : 46;
    const availableHeight = 90 - y;
    return { ...node, x: 5, y, width: 90, height: Math.min(heightForImageRatio(90) || availableHeight, availableHeight), firstPageOnly: false };
  }
  if (pageMode !== 'detail' || isDashboardTrendNode(node)) return node;
  const index = detailNodes.findIndex(item => item.id === node.id);
  if (index < 0) return node;
  const columns = detailNodes.length === 1 ? 1 : 2;
  const rows = Math.ceil(detailNodes.length / columns);
  const row = Math.floor(index / columns);
  const column = index % columns;
  const gapX = columns === 1 ? 0 : 4;
  const width = (90 - gapX) / columns;
  const top = standardModuleLayout ? 36.3 : 31;
  const bottom = 90;
  const gapY = 3;
  const availableHeight = bottom - top - gapY * (rows - 1);
  const fallbackRowHeight = availableHeight / rows;
  const requestedRowHeights = Array.from({ length: rows }, (_, row) => Math.max(
    ...detailNodes.slice(row * columns, (row + 1) * columns).map(detailNode => heightForImageRatio(width, chartAspectRatios.get(String(detailNode.token || ''))) || fallbackRowHeight),
  ));
  const requestedHeight = requestedRowHeights.reduce((sum, height) => sum + height, 0);
  const rowScale = requestedHeight > availableHeight ? availableHeight / requestedHeight : 1;
  const rowHeights = requestedRowHeights.map(height => height * rowScale);
  const y = top + rowHeights.slice(0, row).reduce((sum, height) => sum + height + gapY, 0);
  return {
    ...node,
    x: columns === 1 ? 5 : 5 + column * (width + gapX),
    y,
    width,
    height: rowHeights[row] || fallbackRowHeight,
    firstPageOnly: false,
  };
}

function renderPage(definition: PdfTemplateDefinition, settings: PdfTemplateRenderSettings, data: PdfTemplateData, width: number, height: number, targetKey: string) {
  const page = document.createElement('div');
  Object.assign(page.style, { position: 'relative', width: `${width}mm`, height: `${height}mm`, overflow: 'hidden', background: safeHtml2CanvasColor(settings.backgroundColor || definition.page.background, '#ffffff'), color: safeHtml2CanvasColor(settings.textColor, '#334155'), boxSizing: 'border-box' });
  const pageMetadata = data.page as Record<string, unknown> | undefined;
  const pageNumber = Number(pageMetadata?.index || pageMetadata?.number || 1);
  const pageCount = Number(pageMetadata?.pages || 1);
  const dashboardPageMode = String((data as Record<string, unknown>).dashboardChartsPage || '');
  const defaultDashboardLayout = hasDefaultDashboardChartLayout(definition);
  const chartAspectRatios = new Map((data.dashboardCharts || []).map(chart => [chart.id, Number(chart.imageAspectRatio) || 0]));
  const activeChartIds = new Set((data.dashboardCharts || []).map(chart => chart.id));
  const detailChartNodes = definition.nodes.filter(node => node.type === 'chart' && !isDashboardTrendNode(node) && activeChartIds.has(String(node.token || '')));
  const styleConfig = normalizePdfStyleConfig(definition.metadata?.pdfStyleConfig);
  const isStandardLayout = isStandardPdfLayoutTarget(targetKey);
  const fallbackRepeatedHeaderBottom = styleConfig?.htmlTemplate?.headerHtml.trim() ? 17 : 13.5;
  const repeatedHeaderBottom = definition.nodes
    .filter(node => node.enabled !== false && isPdfFrameHeaderNode(node) && !isPdfFirstPageOnlyInfoNode(node.id))
    .reduce((bottom, node) => Math.max(bottom, Number(node.y || 0) + Number(node.height || 0)), fallbackRepeatedHeaderBottom);
  const standardContinuationY = getPdfStandardContinuationY(repeatedHeaderBottom);
  const hasRepeatableReportHeader = pageNumber > 1 && definition.nodes.some(item => item.enabled !== false && item.type !== 'report-sections' && !item.firstPageOnly && Number(item.y || 0) < 30);
  const hasParty = definition.nodes.some(node => partyField(node) && hasRenderablePartyValue(node, data));
  definition.nodes
    .filter(node => node.enabled !== false && (node.page || 1) === 1)
    .filter(node => !(styleConfig?.htmlTemplate?.headerHtml.trim() && isPdfFrameHeaderNode(node)))
    .filter(node => !(styleConfig?.htmlTemplate?.footerHtml.trim() && isPdfFrameFooterNode(node)))
    .filter(node => !(data.dashboardCover === true && node.type === 'report-sections'))
    .filter(node => !(isStandardLayout && pageNumber > 1 && (isPdfFirstPageOnlyInfoNode(node.id) || node.id === 'party-section' || node.id.startsWith('party-') || node.id.startsWith('cashier-'))))
    .filter(node => !(isStandardLayout && ['notes', 'document-notes'].includes(node.id)))
    .filter(node => node.type !== 'chart' || Boolean(data.dashboardCharts?.some(chart => chart.id === node.token)))
    .filter(node => node.type !== 'chart' || !dashboardPageMode || (dashboardPageMode === 'overview' ? isDashboardTrendNode(node) : dashboardPageMode === 'detail' ? !isDashboardTrendNode(node) : false))
    .filter(node => node.type === 'chart' && dashboardPageMode === 'detail' ? true : shouldRenderPdfNodeOnPage(node.id, node.firstPageOnly, pageNumber))
    .filter(node => settings.showPageNumber !== false || node.token !== 'page.number')
    // En un reporte individual los totales y las notas pertenecen a la última
    // página. Dejarlos en cada página hace que ocupen el espacio de la tabla
    // aunque todavía existan filas pendientes por imprimir.
    .filter(node => pageNumber >= pageCount || (node.type !== 'totals' && node.id !== 'notes'))
    .filter(node => !(node.id === 'company-name' && (settings as PdfTemplateRenderSettings & Record<string, unknown>).showCompanyName === false))
    .filter(node => node.id !== 'party-section' || hasParty)
    .filter(node => !partyField(node) || hasRenderablePartyValue(node, data))
    .forEach(node => {
      const logoScale = node.id === 'company-logo' ? Math.max(0.53, Math.min(1.5, (Number(settings.logoSize) || 34) / 34)) : 1;
      const scaledLogoWidth = node.width * logoScale;
      const canCenterLogoInSlot = node.id === 'company-logo' && !styleConfig?.htmlTemplate?.headerHtml.trim();
      const logoX = canCenterLogoInSlot ? node.x + (node.width - scaledLogoWidth) / 2 : node.x;
      const scaledLogoHeight = node.height * logoScale;
      const logoY = canCenterLogoInSlot ? node.y + (node.height - scaledLogoHeight) / 2 : node.y;
      const sizedNode = logoScale === 1 ? node : { ...node, x: logoX, y: logoY, width: scaledLogoWidth, height: scaledLogoHeight };
      const positionedNode = sizedNode.type === 'chart' && dashboardPageMode
        ? dashboardChartNodeForPage(sizedNode, dashboardPageMode, detailChartNodes, defaultDashboardLayout, width, height, chartAspectRatios, Number(definition.metadata?.standardLayoutVersion) === 1)
        : sizedNode;
      const continuationNode = isStandardLayout && pageNumber > 1 && (positionedNode.type === 'table' || positionedNode.type === 'report-sections')
        ? { ...positionedNode, y: standardContinuationY, ...(positionedNode.type === 'report-sections' ? { subsequentY: standardContinuationY, subsequentHeight: 100 - standardContinuationY } : {}) }
        : positionedNode.type === 'report-sections' && pageNumber > 1 && !hasRepeatableReportHeader
          ? { ...positionedNode, subsequentY: 24, subsequentHeight: 76 }
          : positionedNode;
      const renderedNode = createNode(continuationNode, data, settings, targetKey);
      renderedNode.dataset.pdfNodeId = positionedNode.id;
      renderedNode.dataset.pdfNodeType = positionedNode.type;
      page.appendChild(renderedNode);
    });
  if (styleConfig?.htmlTemplate) {
    const style = document.createElement('style');
    style.textContent = sanitizePdfTemplateCss(styleConfig.htmlTemplate.css, styleConfig.fontFamily);
    page.appendChild(style);
    const logo = typeof data.logo === 'string' ? data.logo : typeof data.company?.logo === 'string' ? data.company.logo : undefined;
    const appendRegion = (zone: 'header' | 'footer') => {
      const source = styleConfig.htmlTemplate?.[zone === 'header' ? 'headerHtml' : 'footerHtml'] || '';
      if (!source) return;
      const region = document.createElement('div');
      region.className = `pdf-${zone}`;
      region.innerHTML = sanitizePdfHtmlFragment(source, zone, styleConfig.fontFamily);
      resolvePdfHtmlTokens(region, data as Record<string, any>, styleConfig.fontFamily, logo);
      Object.assign(region.style, {
        position: 'absolute', left: `${Number(settings.margins || 8)}mm`, right: `${Number(settings.margins || 8)}mm`,
        [zone === 'header' ? 'top' : 'bottom']: `${Math.max(2, Number(settings.margins || 8) / 2)}mm`,
        maxHeight: zone === 'header' ? '14%' : '8%', overflow: 'hidden', zIndex: '2',
        fontFamily: styleConfig.fontFamily, color: styleConfig.palette.text, fontSize: `${styleConfig.fontSize}pt`, boxSizing: 'border-box',
      });
      page.appendChild(region);
    };
    appendRegion('header');
    appendRegion('footer');
  }
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
function reflowIndividualPage(page: HTMLElement, definition: PdfTemplateDefinition, hideDocumentNotes = false) {
  const tableNode = definition.nodes.find(node => node.enabled !== false && (node.type === 'table' || node.type === 'report-sections'));
  if (!tableNode) return;

  const pageRect = page.getBoundingClientRect();
  const renderedNodes = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'));
  const tableElement = renderedNodes.find(element => element.dataset.pdfNodeId === tableNode.id);
  if (!tableElement || pageRect.height <= 0) return;

  const tableRect = tableElement.getBoundingClientRect();
  const tableBottom = tableRect.bottom - pageRect.top;
  const gap = tableNode.id === 'items-table' ? 12 : Math.max(4, pageRect.height * 0.012);
  const flowStart = tableBottom + gap;
  const tableY = Number(tableNode.y || 0);
  if (hideDocumentNotes) renderedNodes.find(element => element.dataset.pdfNodeId === 'notes')?.remove();
  const candidates = definition.nodes
    .filter(node => node.enabled !== false && node.type !== 'table' && node.type !== 'report-sections')
    .filter(node => !(hideDocumentNotes && node.id === 'notes'))
    .filter(node => !isPdfFrameHeaderNode(node) && !isPdfFrameFooterNode(node))
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
      const isSummaryGroup = group.some(item => item.node.type === 'totals' || item.node.id === 'notes');
      const moveSummaryBelowItems = tableNode.id === 'items-table' && isSummaryGroup;
      const nextTop = moveSummaryBelowItems ? flowTop : Math.max(originalTop, flowTop);
      if (moveSummaryBelowItems) {
        group.filter(item => item.node.id === 'notes').forEach(item => {
          Object.assign(item.element.style, { height: 'auto', minHeight: '0', padding: '0', alignItems: 'flex-start' });
        });
      }
      group.forEach(item => { item.element.style.top = `${nextTop}px`; });
      const bottom = Math.max(...group.map(item => item.element.getBoundingClientRect().bottom - pageRect.top));
      flowTop = bottom + gap;
    });
}

/** Acerca el listado de Compras al título y solo baja la tabla cuando hay metadatos reales. */
function reflowCompactPurchaseListTable(page: HTMLElement, definition: PdfTemplateDefinition, data: PdfTemplateData, targetKey: string) {
  if (targetKey !== 'compras.list') return;
  const pageNumber = Number((data.page as Record<string, unknown> | undefined)?.index || (data.page as Record<string, unknown> | undefined)?.number || 1);
  if (pageNumber > 1) return;
  const documentData = (data.document || {}) as Record<string, unknown>;
  const hasMetadata = ['meta', 'period', 'generated', 'extra'].some(key => String(documentData[key] ?? '').trim().length > 0);
  if (!hasMetadata) return;

  const pageRect = page.getBoundingClientRect();
  const tableNode = definition.nodes.find(node => node.id === 'items-table' && node.type === 'table');
  const tableElement = page.querySelector<HTMLElement>('[data-pdf-node-id="items-table"]');
  if (!tableNode || !tableElement || pageRect.height <= 0) return;
  const metaIds = new Set(['report-meta', 'document-generated', 'document-extra']);
  const metaBottom = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'))
    .filter(element => metaIds.has(element.dataset.pdfNodeId || '') && element.textContent?.trim())
    .reduce((bottom, element) => Math.max(bottom, element.getBoundingClientRect().bottom - pageRect.top), 0);
  if (metaBottom <= 0) return;
  const tableTop = tableElement.getBoundingClientRect().top - pageRect.top;
  const desiredTop = metaBottom + pageRect.height * 0.012;
  if (desiredTop > tableTop) tableElement.style.top = `${(desiredTop / pageRect.height) * 100}%`;
}

/**
 * La sección de proveedor/cliente también se renderiza con coordenadas del
 * canvas, pero los datos disponibles cambian entre documentos. Compactamos
 * los campos que sí existen y hacemos que la tabla empiece después del último
 * dato visible, evitando tanto el espacio vacío como los solapamientos.
 */
function singularDocumentTitle(value: string) {
  const normalized = value.trim().toLocaleUpperCase('es-NI').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const singularTitles: Record<string, string> = {
    COTIZACIONES: 'COTIZACIÓN',
    FACTURAS: 'FACTURA',
    'FACTURAS RECURRENTES': 'FACTURA RECURRENTE',
    'ORDENES DE VENTA': 'ORDEN DE VENTA',
    'NOTAS DE CREDITO': 'NOTA DE CRÉDITO',
    'NOTAS DE DEBITO': 'NOTA DE DÉBITO',
    CREDITOS: 'CRÉDITO',
    DEVOLUCIONES: 'DEVOLUCIÓN',
    'PAGOS RECIBIDOS': 'PAGO RECIBIDO',
    RECIBOS: 'RECIBO',
    'ORDENES DE COMPRA': 'ORDEN DE COMPRA',
    'FACTURAS DE PROVEEDOR': 'FACTURA DE PROVEEDOR',
    'FACTURA RECURRENTE DE PROVEEDOR': 'FACTURA RECURRENTE DE PROVEEDOR',
    'PAGOS REALIZADOS': 'PAGO REALIZADO',
    'CREDITOS DE PROVEEDOR': 'CRÉDITO DE PROVEEDOR',
    'RECEPCIONES DE COMPRA': 'RECEPCIÓN DE COMPRA',
  };
  return singularTitles[normalized] || value.trim();
}

function createPdfDocumentSummary(fields: Array<{ id: string; label: string; value: string }>, settings: PdfTemplateRenderSettings) {
  const text = safeHtml2CanvasColor(settings.textColor, '#334155');
  const primary = safeHtml2CanvasColor(settings.primaryColor, '#14532d');
  const muted = '#64748b';
  const summary = document.createElement('div');
  Object.assign(summary.style, {
    flex: '1 1 0', minWidth: '0', display: 'flex', justifyContent: 'flex-end',
    alignItems: 'flex-start', overflow: 'visible', fontFamily: browserFontFamily(settings.fontFamily),
    color: text, textAlign: 'right',
  });
  const content = document.createElement('div');
  Object.assign(content.style, { width: '100%', textAlign: 'right', overflow: 'visible' });
  const title = fields.find(field => field.id === 'document-title');
  if (title) {
    const heading = document.createElement('div');
    heading.textContent = singularDocumentTitle(title.value);
    Object.assign(heading.style, {
      color: primary, fontSize: pdfPointsToCss(9), fontWeight: '700', lineHeight: '1.2',
      overflowWrap: 'anywhere', marginBottom: '1.5mm',
    });
    content.appendChild(heading);
  }
  fields.filter(field => field.id !== 'document-title').forEach(field => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      marginTop: '0.8mm', textAlign: 'right', lineHeight: '1.25',
      overflowWrap: 'anywhere', whiteSpace: 'normal',
    });
    const label = document.createElement('span');
    label.textContent = `${field.label}: `;
    Object.assign(label.style, {
      color: muted, fontSize: pdfPointsToCss(5.7), fontWeight: '700', textTransform: 'uppercase',
    });
    const value = document.createElement('span');
    value.textContent = field.value;
    Object.assign(value.style, {
      color: text, fontSize: pdfPointsToCss(7.4),
      fontWeight: field.id === 'document-number' ? '700' : '400',
    });
    row.append(label, value);
    content.appendChild(row);
  });
  summary.appendChild(content);
  return summary;
}

function createPdfPartySummary(fields: Array<{ id: string; label: string; value: string }>, settings: PdfTemplateRenderSettings) {
  const text = safeHtml2CanvasColor(settings.textColor, '#334155');
  const muted = '#64748b';
  const summary = document.createElement('div');
  Object.assign(summary.style, {
    flex: '1.1 1 0', minWidth: '0', display: 'flex', justifyContent: 'flex-start',
    alignItems: 'flex-start', overflow: 'visible', fontFamily: browserFontFamily(settings.fontFamily),
    color: text, textAlign: 'left',
  });
  const content = document.createElement('div');
  Object.assign(content.style, { width: '100%', textAlign: 'left', overflow: 'visible' });
  const name = fields.find(field => field.id === 'party-name');
  if (name) {
    const heading = document.createElement('div');
    heading.textContent = name.value;
    Object.assign(heading.style, {
      color: text, fontSize: pdfPointsToCss(9), fontWeight: '700', lineHeight: '1.2',
      overflowWrap: 'anywhere', marginBottom: '1.5mm',
    });
    content.appendChild(heading);
  }
  fields.filter(field => field.id !== 'party-name').forEach(field => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      marginTop: '0.8mm', textAlign: 'left', lineHeight: '1.25',
      overflowWrap: 'anywhere', whiteSpace: 'normal',
    });
    const label = document.createElement('span');
    label.textContent = `${field.label}: `;
    Object.assign(label.style, {
      color: muted, fontSize: pdfPointsToCss(5.7), fontWeight: '700', textTransform: 'uppercase',
    });
    const value = document.createElement('span');
    value.textContent = field.value;
    Object.assign(value.style, {
      color: text, fontSize: pdfPointsToCss(7.4),
      fontWeight: field.id === 'party-tax-id' ? '700' : '400',
    });
    row.append(label, value);
    content.appendChild(row);
  });
  summary.appendChild(content);
  return summary;
}

/** Recompone historiales de una sola entidad en filas útiles y sin una columna vacía. */
function reflowSingleEntityHistory(page: HTMLElement, definition: PdfTemplateDefinition, settings: PdfTemplateRenderSettings, targetKey: string, pageNumber: number) {
  if (!['ventas.customer-history', 'compras.supplier-history'].includes(targetKey)) return;
  if (pageNumber > 1) return;

  const pageRect = page.getBoundingClientRect();
  if (pageRect.height <= 0) return;
  const renderedNodes = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'));
  const byId = new Map(renderedNodes.map(element => [element.dataset.pdfNodeId || '', element]));
  const definitionNodes = new Map(definition.nodes.map(node => [node.id, node]));
  const documentHeaderIds = ['document-title', 'document-number', 'document-date', 'document-status', 'document-generated', 'report-meta'];
  const documentTitleElement = byId.get('document-title');
  const documentTitleRect = documentTitleElement?.getBoundingClientRect();
  const documentHeaderBottom = documentHeaderIds
    .map(id => byId.get(id))
    .filter((element): element is HTMLElement => Boolean(element?.textContent?.trim()))
    .reduce((bottom, element) => Math.max(bottom, element.getBoundingClientRect().bottom - pageRect.top), 0);
  if (!documentHeaderBottom) return;

  const readValue = (element: HTMLElement, id: string) => {
    if (id === 'history-customer-name') return element.querySelector('span')?.textContent?.trim() || element.textContent?.trim() || '';
    const children = Array.from(element.children).filter(child => child instanceof HTMLElement) as HTMLElement[];
    if (id === 'party-name') return children[1]?.textContent?.trim() || children[0]?.textContent?.trim() || '';
    return children[1]?.textContent?.trim() || '';
  };
  const partyNameId = targetKey === 'ventas.customer-history' ? 'history-customer-name' : 'party-name';
  const partyNameElement = byId.get(partyNameId);
  const partyName = partyNameElement ? readValue(partyNameElement, partyNameId) : '';
  partyNameElement?.remove();
  let entityHeadingBottom = 0;

  const orderedFieldIds = ['party-tax-id', 'party-address', 'party-phone', 'party-email', 'party-contact', 'party-balance-summary'];
  const fieldValues = orderedFieldIds.flatMap(id => {
    const element = byId.get(id);
    const node = definitionNodes.get(id);
    if (!element || !node) return [];
    const value = readValue(element, id);
    const label = (element.children.item(0) as HTMLElement | null)?.textContent?.trim() || node.label;
    element.remove();
    return value ? [{ id, label, value }] : [];
  });

  const block = document.createElement('section');
  block.dataset.pdfHistoryParty = 'true';
  Object.assign(block.style, {
    position: 'absolute', left: '5%', top: '0px',
    width: '90%', display: 'flex', flexDirection: 'column', gap: '2mm', minWidth: '0',
    overflow: 'visible', boxSizing: 'border-box', color: safeHtml2CanvasColor(settings.textColor, '#334155'),
    fontFamily: browserFontFamily(settings.fontFamily),
  });

  if (partyName) {
    const heading = document.createElement('div');
    heading.textContent = partyName;
    const titleStartsOnRightHalf = Boolean(documentTitleRect && documentTitleRect.left - pageRect.left >= pageRect.width * 0.5);
    const titleTop = documentTitleRect ? documentTitleRect.top - pageRect.top : documentHeaderBottom;
    const headingWidth = documentTitleRect
      ? Math.max(36, Math.min(56, ((documentTitleRect.left - pageRect.left) / pageRect.width) * 100 - 10))
      : 90;
    Object.assign(heading.style, {
      ...(titleStartsOnRightHalf ? { position: 'absolute', left: '5%', top: `${titleTop}px`, width: `${headingWidth}%` } : {}),
      width: titleStartsOnRightHalf ? `${headingWidth}%` : '100%', minWidth: '0', fontSize: pdfPointsToCss(9), fontWeight: '700', lineHeight: '1.2',
      whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
    });
    if (titleStartsOnRightHalf) {
      page.appendChild(heading);
      entityHeadingBottom = heading.getBoundingClientRect().bottom - pageRect.top;
    } else block.appendChild(heading);
  }

  block.style.top = `${resolvePdfHistoryInfoTop(documentHeaderBottom, entityHeadingBottom, Math.max(4, pageRect.height * 0.012))}px`;

  for (let index = 0; index < fieldValues.length; index += 2) {
    const fields = fieldValues.slice(index, index + 2);
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'grid', gridTemplateColumns: fields.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
      gap: '2mm 5mm', width: '100%', minWidth: '0', alignItems: 'start',
    });
    fields.forEach(field => {
      const cell = document.createElement('div');
      Object.assign(cell.style, { minWidth: '0', display: 'flex', flexDirection: 'column', gap: '0.5mm', overflow: 'visible' });
      const label = document.createElement('span');
      label.textContent = field.label;
      Object.assign(label.style, { color: '#64748b', fontSize: pdfPointsToCss(5.8), fontWeight: '700', letterSpacing: '0.35px', textTransform: 'uppercase', lineHeight: '1.05' });
      const value = document.createElement('span');
      value.textContent = field.value;
      Object.assign(value.style, { color: safeHtml2CanvasColor(settings.textColor, '#334155'), fontSize: pdfPointsToCss(7.4), lineHeight: '1.2', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'normal' });
      cell.append(label, value);
      row.appendChild(cell);
    });
    block.appendChild(row);
  }
  page.appendChild(block);

  const tableNode = definition.nodes.find(node => node.enabled !== false && (node.type === 'table' || node.type === 'report-sections'));
  const tableElement = tableNode ? byId.get(tableNode.id) : undefined;
  if (tableNode && tableElement) {
    const currentTop = tableElement.getBoundingClientRect().top - pageRect.top;
    const contentBottom = Math.max(block.getBoundingClientRect().bottom - pageRect.top, entityHeadingBottom, documentHeaderBottom);
    const desiredTop = contentBottom + Math.max(5, pageRect.height * 0.009);
    tableElement.style.top = `${(Math.max(0, desiredTop) / pageRect.height) * 100}%`;
    tableElement.dataset.pdfHistoryBaseTop = String(currentTop);
  }
}

/** Mantiene el resumen empresarial debajo del nombre real ya envuelto. */
function reflowCompanyIdentitySummary(page: HTMLElement, definition: PdfTemplateDefinition) {
  const nameNode = definition.nodes.find(node => node.enabled !== false && node.id === 'company-name');
  const summaryNode = definition.nodes.find(node => node.enabled !== false && node.id === 'company-summary');
  if (!nameNode || !summaryNode) return;

  const pageRect = page.getBoundingClientRect();
  if (pageRect.height <= 0) return;
  const renderedNodes = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'));
  const nameElement = renderedNodes.find(element => element.dataset.pdfNodeId === nameNode.id);
  const summaryElement = renderedNodes.find(element => element.dataset.pdfNodeId === summaryNode.id);
  if (!nameElement || !summaryElement) return;

  const nameText = Array.from(nameElement.children).find(child => child.textContent?.trim()) as HTMLElement | undefined;
  const summaryText = Array.from(summaryElement.children).find(child => child.textContent?.trim()) as HTMLElement | undefined;
  if (!nameText || !summaryText) return;

  const preferredTop = summaryElement.getBoundingClientRect().top - pageRect.top;
  let contentBottom = nameText.getBoundingClientRect().bottom - pageRect.top;
  const logoElement = renderedNodes.find(element => element.dataset.pdfNodeId === 'company-logo');
  if (logoElement) {
    const nameRect = nameElement.getBoundingClientRect();
    const summaryRect = summaryElement.getBoundingClientRect();
    const logoRect = logoElement.getBoundingClientRect();
    const overlapsName = nameRect.left < logoRect.right && nameRect.right > logoRect.left;
    const overlapsSummary = summaryRect.left < logoRect.right && summaryRect.right > logoRect.left;
    const sharesHorizontalSpace = overlapsName || overlapsSummary;
    if (sharesHorizontalSpace) contentBottom = Math.max(contentBottom, logoRect.bottom - pageRect.top);
  }

  const gap = Math.max(4, pageRect.height * 0.006);
  const top = resolvePdfHeaderAnchoredTop(contentBottom, preferredTop, gap, true);
  summaryElement.style.top = `${(top / pageRect.height) * 100}%`;
  summaryElement.style.height = 'auto';
  summaryElement.style.minHeight = '0';
  summaryElement.style.overflow = 'visible';
  summaryText.style.height = 'auto';
  summaryText.style.minHeight = '0';
  summaryText.style.overflow = 'visible';
}

/** Desplaza el contenido de primera página solo cuando el header real lo alcanza. */
function reflowFirstPageBelowCompanyHeader(page: HTMLElement, definition: PdfTemplateDefinition, settings: PdfTemplateRenderSettings, pageNumber: number) {
  if (pageNumber !== 1) return;
  const pageRect = page.getBoundingClientRect();
  if (pageRect.height <= 0) return;

  const renderedNodes = Array.from(page.querySelectorAll<HTMLElement>('[data-pdf-node-id]'));
  const identityIds = new Set(['company-logo', 'company-name', 'company-summary']);
  const headerBottom = Math.max(0, ...definition.nodes
    .filter(node => node.enabled !== false && (identityIds.has(node.id) || (isPdfFrameHeaderNode(node) && !['document-title', 'document-number', 'document-status', 'document-date', 'document-generated', 'report-meta', 'ticket-meta'].includes(node.id))))
    .map(node => renderedNodes.find(element => element.dataset.pdfNodeId === node.id))
    .filter((element): element is HTMLElement => Boolean(element))
    .map(element => {
      if (['company-name', 'company-summary'].includes(element.dataset.pdfNodeId || '')) {
        const visibleText = Array.from(element.children).find(child => child.textContent?.trim()) as HTMLElement | undefined;
        return visibleText ? visibleText.getBoundingClientRect().bottom - pageRect.top : 0;
      }
      return element.getBoundingClientRect().bottom - pageRect.top;
    }),
    ...Array.from(page.querySelectorAll<HTMLElement>('.pdf-header')).map(element => element.getBoundingClientRect().bottom - pageRect.top));
  if (!headerBottom) return;

  const bodyNodes = definition.nodes
    .filter(node => node.enabled !== false && !identityIds.has(node.id) && !isPdfFrameFooterNode(node))
    .filter(node => node.id !== 'header' && !node.id.startsWith('header-'))
    .map(node => ({ node, element: renderedNodes.find(element => element.dataset.pdfNodeId === node.id) }))
    .filter((item): item is { node: PdfTemplateNode; element: HTMLElement } => Boolean(item.element));
  const visibleBody = bodyNodes
    .map(item => ({ ...item, top: item.element.getBoundingClientRect().top - pageRect.top }))
    .filter(item => item.element.getBoundingClientRect().width > 0 && item.element.getBoundingClientRect().height > 0);
  if (!visibleBody.length) return;

  const bodyTop = Math.min(...visibleBody.map(item => item.top));
  const currentGap = Math.max(5, pageRect.height * 0.006);
  const nextBodyTop = resolvePdfHeaderContentTop(headerBottom, bodyTop, currentGap, pageRect.height, settings.headerContentSpacing, true);
  const shift = nextBodyTop - bodyTop;
  if (shift <= 0.5) return;

  visibleBody.forEach(({ element, top }) => {
    element.style.top = `${((top + shift) / pageRect.height) * 100}%`;
  });
}

/**
 * Convierte los campos semánticos ya renderizados en dos tablas compactas:
 * la persona/empresa relacionada y los datos del documento. Los valores se
 * leen del DOM generado por los tokens para mantener intactos los datos y sus
 * formatos; solo cambia su presentación en el PDF.
 */
function reflowPartySection(page: HTMLElement, definition: PdfTemplateDefinition, settings: PdfTemplateRenderSettings, targetKey: string, pageNumber: number) {
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
  const currentHeaderGap = Math.max(5, pageRect.height * 0.009);
  const spacing = pageNumber === 1 ? settings.headerContentSpacing : 'small';
  const extraHeaderGap = resolvePdfHeaderContentGap(currentHeaderGap, pageRect.height, spacing) - currentHeaderGap;
  const sectionTableGap = currentHeaderGap;
  const documentNodeIds = new Set(['document-title', 'document-number', 'document-date', 'document-status', 'document-generated', 'document-extra', 'report-meta']);
  const headerBottom = Math.max(0, ...definition.nodes
    .filter(node => node.enabled !== false && isPdfFrameHeaderNode(node) && !documentNodeIds.has(node.id))
    .map(node => renderedNodes.find(element => element.dataset.pdfNodeId === node.id))
    .filter((element): element is HTMLElement => Boolean(element))
    .map(element => {
      if (['company-name', 'company-summary'].includes(element.dataset.pdfNodeId || '')) {
        const visibleText = Array.from(element.children).find(child => child.textContent?.trim()) as HTMLElement | undefined;
        return visibleText ? visibleText.getBoundingClientRect().bottom - pageRect.top : 0;
      }
      return element.getBoundingClientRect().bottom - pageRect.top;
    }),
    ...(Array.from(page.querySelectorAll<HTMLElement>('.pdf-header')).map(element => element.getBoundingClientRect().bottom - pageRect.top)));
  const preferredSectionTop = sectionRect.top - pageRect.top;
  const hasStandardSalesPreset = ['sales-standard', 'system-default'].includes(String(definition.metadata?.preset || ''));
  const sectionTopAtSmall = preferredSectionTop - extraHeaderGap;
  const sectionTop = resolvePdfHeaderContentTop(headerBottom, sectionTopAtSmall, currentHeaderGap, pageRect.height, spacing, !hasStandardSalesPreset);

  const partyFields = new Map<string, { node: PdfTemplateNode; label: string; value: string }>();
  definition.nodes
    .filter(node => node.enabled !== false && partyField(node))
    .forEach(node => {
      const element = renderedNodes.find(item => item.dataset.pdfNodeId === node.id);
      if (!element) return;
      const label = (element.children.item(0) as HTMLElement | null)?.textContent?.trim() || node.label;
      const value = (element.children.item(1) as HTMLElement | null)?.textContent?.trim() || '';
      element.remove();
      if (value) partyFields.set(node.id, { node, label, value });
    });
  if (!partyFields.size) return;

  const documentLabels: Record<string, string> = {
    'document-title': 'Tipo de documento',
    'document-number': 'Número',
    'document-date': 'Fecha',
    'document-status': 'Estado',
    'document-generated': 'Generado',
    'document-extra': 'Información',
    'report-meta': targetKey === 'compras.supplier-history' ? 'Detalle' : 'Período y filtros',
  };
  const documentFields = definition.nodes
    .filter(node => node.enabled !== false && documentNodeIds.has(node.id))
    .map(node => {
      const element = renderedNodes.find(item => item.dataset.pdfNodeId === node.id);
      if (!element) return null;
      const value = (element.querySelector('span')?.textContent || element.textContent || '').trim()
        .replace(/^Estado:\s*/i, '');
      element.remove();
      return value ? { id: node.id, label: documentLabels[node.id] || node.label, value } : null;
    })
    .filter((field): field is { id: string; label: string; value: string } => Boolean(field));

  const partyOrder = ['party-name', 'party-tax-id', 'party-address', 'party-phone', 'party-email', 'party-contact', 'party-balance-due', 'party-balance-favor'];
  const usedPartyIds = new Set(partyOrder);
  const partySummaryFields = partyOrder
    .map(id => partyFields.get(id))
    .filter((field): field is { node: PdfTemplateNode; label: string; value: string } => Boolean(field))
    .map(field => ({ id: field.node.id, label: field.label, value: field.value }));
  Array.from(partyFields.entries())
    .filter(([id]) => !usedPartyIds.has(id))
    .map(([id, field]) => ({ id, label: field.label, value: field.value }))
    .forEach(field => partySummaryFields.push(field));

  const documentOrder = ['document-title', 'document-number', 'document-date', 'document-status', 'document-extra', 'document-generated', 'report-meta'];
  const sortedDocumentFields = documentFields.sort((left, right) => documentOrder.indexOf(left.id) - documentOrder.indexOf(right.id));
  sectionElement.remove();
  const infoRow = document.createElement('div');
  infoRow.dataset.pdfInfoRow = 'true';
  Object.assign(infoRow.style, {
    position: 'absolute', left: '5%', top: `${sectionTop}px`, width: '90%',
    display: 'flex', alignItems: 'stretch', gap: `${Math.max(2, pageRect.width * 0.018)}px`,
    boxSizing: 'border-box', overflow: 'visible',
  });
  const partySummary = createPdfPartySummary(partySummaryFields, settings);
  if (sortedDocumentFields.length) {
    infoRow.append(partySummary, createPdfDocumentSummary(sortedDocumentFields, settings));
  } else {
    partySummary.style.flexGrow = '1';
    infoRow.appendChild(partySummary);
  }
  page.appendChild(infoRow);
  const infoBottom = infoRow.getBoundingClientRect().bottom - pageRect.top;
  tableElement.style.top = `${infoBottom + sectionTableGap + pageRect.height * 0.01}px`;
}

export async function renderPdfTemplateToPdf({ definition, settings: requestedSettings, targetKey, data, fileName, save = true, onProgress }: PdfTemplateRenderOptions) {
  if (typeof document === 'undefined') throw new Error('La plantilla PDF requiere un navegador.');
  const target = getPdfTemplateTarget(targetKey);
  const isLegacyStandardDefinition = isStandardPdfLayoutTarget(target.key) && !hasCurrentStandardPdfLayout(target.key, definition);
  const standardSettings = isLegacyStandardDefinition
    ? createSystemDefaultPdfSettings({
      paperSize: requestedSettings.paperSize,
      orientation: requestedSettings.orientation,
      headerComposition: requestedSettings.headerComposition,
      headerContentSpacing: requestedSettings.headerContentSpacing,
    })
    : requestedSettings as unknown as Record<string, unknown>;
  const baseSettings = normalizePdfPaperSettings(target.key, applyStandardPdfLayoutSettings(target.key, standardSettings)) as PdfTemplateRenderSettings & Record<string, unknown>;
  // El estándar fija la geometría base del ERP; una personalización guardada
  // puede seguir aplicando paleta y presentación de tabla. Los campos de
  // apariencia resueltos en settings tienen prioridad sobre el estilo legacy.
  const pdfStyleConfig = resolvePdfStyleConfigForRender(definition.metadata?.pdfStyleConfig, baseSettings);
  const tableLayoutByStyle: Record<string, string> = { light: 'minimal', boxed: 'boxed', bold: 'boxed', striped: 'striped', bubble: 'cards', wave: 'accent', folder: 'ledger' };
  const settings = applyStandardPdfLayoutSettings(target.key, pdfStyleConfig ? {
    ...baseSettings,
    fontFamily: pdfStyleConfig.fontFamily,
    fontSize: pdfStyleConfig.fontSize,
    primaryColor: pdfStyleConfig.palette.primary,
    secondaryColor: pdfStyleConfig.palette.secondary,
    textColor: pdfStyleConfig.palette.text,
    lineColor: pdfStyleConfig.palette.line,
    tableLayout: tableLayoutByStyle[pdfStyleConfig.tableStyle] || 'standard',
    pdfTableStyle: pdfStyleConfig.tableStyle,
  } : baseSettings) as PdfTemplateRenderSettings & Record<string, unknown>;
  const canonicalStandardDefinition = isLegacyStandardDefinition ? createDefaultTemplateDefinition(target.key, settings) : definition;
  const renderDefinition = isLegacyStandardDefinition
    ? { ...canonicalStandardDefinition, metadata: { ...(canonicalStandardDefinition.metadata || {}), preset: 'system-default' } }
    : definition;
  let globalCompanyProfile = data?.pdfCompanyProfile && typeof data.pdfCompanyProfile === 'object'
    ? data.pdfCompanyProfile as Record<string, unknown>
    : null;
  if (!globalCompanyProfile && target.templateMode !== 'fixed') {
    try {
      globalCompanyProfile = await pdfDocumentDesignService.getCompanyProfile() as Record<string, unknown> | null;
    } catch {
      globalCompanyProfile = null;
    }
  }
  const renderSourceData: PdfTemplateData = globalCompanyProfile
    ? { ...(data || {}), pdfCompanyProfile: globalCompanyProfile }
    : { ...(data || {}) };
  // Las vistas reciben el branding por distintas capas (ThemeContext,
  // sessionBranding o clientTenant). El almacenamiento de sesión es la fuente
  // común del contexto de sucursal y evita que un reporte pierda el logo solo
  // porque su componente no recibió themeConfig.logo en ese render.
  const configuredSettings = settings as PdfTemplateRenderSettings & Record<string, unknown>;
  const profileLogo = typeof globalCompanyProfile?.logo === 'string' ? globalCompanyProfile.logo : '';
  const logoCandidates = globalCompanyProfile
    ? [profileLogo]
    : [data?.logo, data?.company?.logo, configuredSettings.templateLogoUrl, configuredSettings.templateLogoUri, rememberedSessionLogo()]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  let safeLogo = '';
  for (const candidate of [...new Set(logoCandidates)]) {
    safeLogo = await prepareLogoSource(candidate);
    if (safeLogo) break;
  }
  const renderData: PdfTemplateData = safeLogo
    ? { ...renderSourceData, logo: safeLogo, company: { ...(renderSourceData.company || {}), logo: safeLogo } }
    : { ...renderSourceData, logo: undefined, company: { ...(renderSourceData.company || {}), logo: undefined } };
  // El predeterminado virtual se construye inicialmente sin conocer el logo de
  // la sucursal. Regenerarlo aquí evita que el logo aparezca encima del nombre
  // y conserva las proporciones correctas de cada composición de biblioteca.
  const logoAdjustedDefinition = safeLogo && renderDefinition.metadata?.preset === 'system-default'
    ? createDefaultTemplateDefinition(target.key, { ...settings, logoUrl: safeLogo })
    : renderDefinition;
  const logoReadyDefinition = safeLogo && isStandardPdfLayoutTarget(target.key)
    ? (() => {
      const logoNode = logoAdjustedDefinition.nodes.find(node => node.id === 'company-logo')
        || createDefaultTemplateDefinition(target.key, { ...settings, logoUrl: safeLogo }).nodes.find(node => node.id === 'company-logo');
      if (!logoNode) return logoAdjustedDefinition;
      return {
        ...logoAdjustedDefinition,
        nodes: logoAdjustedDefinition.nodes.some(node => node.id === 'company-logo')
          ? logoAdjustedDefinition.nodes.map(node => node.id === 'company-logo' ? { ...node, enabled: true, firstPageOnly: false } : node)
          : [...logoAdjustedDefinition.nodes, { ...logoNode, enabled: true }],
      };
    })()
    : logoAdjustedDefinition;
  const ensuredDefinition = ensureDashboardChartNodes(normalizePdfFrameGeometry(logoReadyDefinition), targetKey, { ...settings });
  const composedDefinition = pdfStyleConfig?.htmlTemplate?.headerHtml.trim()
    ? ensuredDefinition
    : applyPdfHeaderComposition(ensuredDefinition, settings.headerComposition, targetKey);
  const styledDefinition = pdfStyleConfig ? applyPdfStyleToDefinition(composedDefinition, pdfStyleConfig) : composedDefinition;
  const baseDefinition = target.templateMode === 'fixed'
    ? styledDefinition
    : applyPdfDocumentFontFamily(styledDefinition, settings.fontFamily);
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
  const reportPagination = getPdfReportPagination(targetKey);
  const sectionGroups: Array<PdfTemplateReportSection[] | null> = reportNode
    ? (visibleReportSections.length ? paginatePdfReportSections(visibleReportSections, reportPagination) : [[]])
    : visibleReportSections.length
      ? visibleReportSections.map(section => [section])
      : [null];
  const renderJobs: Array<{ definition: PdfTemplateDefinition; data: PdfTemplateData }> = [];

  const dashboardTarget = getPdfTemplateTarget(targetKey).structure === 'dashboard';
  if (dashboardTarget) {
    const dashboardHasCover = Boolean(renderData.dashboardCharts?.length || renderData.reportKpis?.length);
    const chartNodes = baseDefinition.nodes.filter(node => node.enabled !== false && node.type === 'chart' && renderData.dashboardCharts?.some(chart => chart.id === node.token));
    const hasSupportingCharts = chartNodes.some(node => !isDashboardTrendNode(node));
    if (dashboardHasCover) renderJobs.push({ definition: baseDefinition, data: { ...renderData, reportSections: [], dashboardCover: true, dashboardChartsPage: 'overview', renderScale: 2.5 } });
    if (hasSupportingCharts) renderJobs.push({ definition: baseDefinition, data: { ...renderData, reportSections: [], dashboardCover: true, dashboardChartsPage: 'detail', renderScale: 2.5 } });
    sectionGroups.filter((group): group is PdfTemplateReportSection[] => Boolean(group?.length)).forEach(sectionGroup => {
      const firstSection = sectionGroup[0];
      renderJobs.push({
        definition: baseDefinition,
        data: {
          ...renderData,
          dashboardCover: false,
          dashboardChartsPage: 'none',
          reportSections: sectionGroup,
          items: firstSection?.rows || [],
          rows: firstSection?.rows || [],
          tableColumns: firstSection?.columns,
        },
      });
    });
    if (!renderJobs.length) renderJobs.push({ definition: baseDefinition, data: { ...renderData, dashboardCover: true, dashboardChartsPage: 'overview', reportSections: [] } });
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
    const purchaseDocument = isPurchasePdfLayoutTarget(target.key)
      && !['compras.list', 'compras.supplier', 'compras.supplier-history'].includes(target.key);
    // La tabla ya reacomoda el bloque de proveedor, los totales y el pie según
    // su altura real. Por eso puede usar el espacio disponible completo; el
    // límite reducido anterior dejaba páginas con solo dos filas y demasiado
    // espacio vacío aunque todavía cupieran más registros.
    const chunks = tableNode && rows.length
      ? chunkTableRows(
        rows,
        tableNode.columns?.length ? tableNode.columns : [],
        purchaseDocument ? (denseTable ? 12 : 15) : denseTable ? 12 : 14,
        purchaseDocument ? (denseTable ? 18 : 22) : denseTable ? 18 : 20,
      )
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
  const logoImageProperties = safeLogo
    ? (() => { try { return pdf.getImageProperties(safeLogo); } catch { return null; } })()
    : null;
  try {
    for (let index = 0; index < renderJobs.length; index += 1) {
      onProgress?.({ page: index + 1, totalPages: renderJobs.length });
      await yieldToBrowser();
      const job = renderJobs[index];
      const pageData = normalizeData(job.data, settings, targetKey, index + 1, renderJobs.length);
      const page = renderPage(job.definition, settings, pageData, width, height, targetKey);
      page.id = `pdf-template-page-${index}`;
      wrapper.appendChild(page);
      await waitForPdfDocumentFonts(renderDocument, settings.fontFamily);
      await waitForImages(page);
      reflowCompanyIdentitySummary(page, job.definition);
      reflowFirstPageBelowCompanyHeader(page, job.definition, settings, index + 1);
      reflowSingleEntityHistory(page, job.definition, settings, target.key, index + 1);
      reflowPartySection(page, job.definition, settings, target.key, index + 1);
      reflowCompactPurchaseListTable(page, job.definition, pageData, target.key);
      reflowIndividualPage(page, job.definition, isSalesPdfLayoutTarget(target.key) && target.structure === 'transaction');
      if (target.templateMode !== 'fixed') enforcePdfDocumentFont(page, settings.fontFamily);
      const logoOverlayRect = logoImageProperties?.width && logoImageProperties?.height
        ? getPdfCompanyLogoOverlayRect(page, job.definition, width, height)
        : null;
      const requestedRenderScale = Number((job.data as Record<string, unknown>).renderScale);
      const pageHasCharts = Boolean(page.querySelector('[data-pdf-node-type="chart"]'));
      const renderScale = Math.max(0.9, Math.min(2.5, requestedRenderScale || (pageHasCharts ? 2.5 : 1.5)));
      const canvas = await html2canvas(page, {
        scale: renderScale,
        backgroundColor: safeHtml2CanvasColor(job.definition.page.background, '#ffffff'),
        logging: false,
        useCORS: true,
        allowTaint: false,
        foreignObjectRendering: true,
      });
      if (index > 0) pdf.addPage([width, height], settings.orientation === 'landscape' ? 'l' : 'p');
      try {
        pdf.addImage(canvas, 'PNG', 0, 0, width, height, undefined, 'FAST');
        if (safeLogo && logoImageProperties?.fileType && logoOverlayRect) {
          pdf.addImage(safeLogo, logoImageProperties.fileType, logoOverlayRect.x, logoOverlayRect.y, logoOverlayRect.width, logoOverlayRect.height, undefined, 'FAST');
        }
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
      page.remove();
    }
    const blob = pdf.output('blob');
    if (save) pdf.save(fileName || `${getPdfTemplateTarget(targetKey).key.replace(/[^a-z0-9.-]+/gi, '-')}.pdf`);
    return { doc: pdf, blob };
  } finally { renderFrame.remove(); }
}
