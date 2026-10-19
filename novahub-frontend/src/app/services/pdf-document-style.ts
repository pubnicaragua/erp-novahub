import { TEMPLATE_TOKENS } from './pdf-template-definition';
import { PDF_APPEARANCE_FONTS } from './pdf-appearance';

export type PdfStylePresetId = 'light' | 'boxed' | 'bold' | 'striped' | 'bubble' | 'wave' | 'folder';
export type PdfTableStyle = 'light' | 'boxed' | 'bold' | 'striped' | 'bubble' | 'wave' | 'folder';
export interface PdfTablePresentation {
  outerBorder: boolean;
  outerBorderWidth: number;
  outerBorderTone: 'line' | 'accent';
  cellBorders: 'none' | 'horizontal' | 'grid' | 'cards';
  rowGap: number;
  roundedRows: boolean;
  striped: boolean;
  headerRuleWidth: number;
  headerRuleTone: 'line' | 'accent';
  headerTextTransform: 'none' | 'uppercase';
  rowAccentWidth: number;
  summaryTone: 'plain' | 'stripe' | 'header' | 'accent';
}

export interface PdfStylePalette {
  primary: string;
  secondary: string;
  text: string;
  line: string;
  tableHeader: string;
  tableHeaderText: string;
  tableRow: string;
  tableStripe: string;
  tableBorder: string;
}

export interface PdfStyleConfigV1 {
  version: 1;
  presetId: PdfStylePresetId;
  fontFamily: string;
  fontSize: number;
  palette: PdfStylePalette;
  tableStyle: PdfTableStyle;
  htmlTemplate?: { headerHtml: string; footerHtml: string; css: string; sourceName?: string };
}

export const PDF_STYLE_FONTS = [
  'Arial', 'Arial Narrow', 'Calibri', 'Candara', 'Century Gothic', 'Futura', 'Gill Sans', 'Lucida Sans',
  'Segoe UI', 'Tahoma', 'Trebuchet MS', 'Verdana', 'Helvetica', 'Times New Roman', 'Georgia', 'Garamond',
  'Cambria', 'Palatino Linotype', 'Bookman', 'Courier New', 'Consolas', 'Monaco', 'Impact', ...PDF_APPEARANCE_FONTS,
] as const;

export const PDF_STYLE_PRESETS: Array<{ id: PdfStylePresetId; name: string; description: string; palette: PdfStylePalette; tableStyle: PdfTableStyle }> = [
  { id: 'light', name: 'Light', description: 'Limpio, ligero y con líneas discretas.', palette: { primary: '#65536b', secondary: '#8b7c91', text: '#29313c', line: '#d9dce1', tableHeader: '#ffffff', tableHeaderText: '#303541', tableRow: '#ffffff', tableStripe: '#f7f6f8', tableBorder: '#d9dce1' }, tableStyle: 'light' },
  { id: 'boxed', name: 'Boxed', description: 'Bloques delimitados y tabla enmarcada.', palette: { primary: '#355c7d', secondary: '#6c8ba4', text: '#263746', line: '#b9c7d1', tableHeader: '#eaf0f4', tableHeaderText: '#263746', tableRow: '#ffffff', tableStripe: '#f6f8fa', tableBorder: '#9eafbb' }, tableStyle: 'boxed' },
  { id: 'bold', name: 'Bold', description: 'Contraste alto para documentos ejecutivos.', palette: { primary: '#242a35', secondary: '#555f70', text: '#242a35', line: '#69717c', tableHeader: '#303641', tableHeaderText: '#ffffff', tableRow: '#ffffff', tableStripe: '#f1f2f4', tableBorder: '#89919a' }, tableStyle: 'bold' },
  { id: 'striped', name: 'Striped', description: 'Filas alternas para lectura rápida.', palette: { primary: '#566477', secondary: '#8794a3', text: '#293442', line: '#d5dbe1', tableHeader: '#566477', tableHeaderText: '#ffffff', tableRow: '#ffffff', tableStripe: '#e7ebef', tableBorder: '#d5dbe1' }, tableStyle: 'striped' },
  { id: 'bubble', name: 'Bubble', description: 'Acentos suaves y esquinas redondeadas.', palette: { primary: '#765f7d', secondary: '#a18fa7', text: '#3b3440', line: '#ddd6e0', tableHeader: '#765f7d', tableHeaderText: '#ffffff', tableRow: '#ffffff', tableStripe: '#eee8f0', tableBorder: '#d7ccd9' }, tableStyle: 'bubble' },
  { id: 'wave', name: 'Wave', description: 'Acentos fluidos con una jerarquía ligera.', palette: { primary: '#236f79', secondary: '#63a1a6', text: '#263c42', line: '#c4dcdd', tableHeader: '#236f79', tableHeaderText: '#ffffff', tableRow: '#ffffff', tableStripe: '#e2eff0', tableBorder: '#c4dcdd' }, tableStyle: 'wave' },
  { id: 'folder', name: 'Folder', description: 'Tono documental, cálido y ordenado.', palette: { primary: '#8a6743', secondary: '#b49870', text: '#42392f', line: '#ddd1c1', tableHeader: '#f0e8dd', tableHeaderText: '#42392f', tableRow: '#ffffff', tableStripe: '#f2e8da', tableBorder: '#d6c7b2' }, tableStyle: 'folder' },
];

const DEFAULT_PRESET = PDF_STYLE_PRESETS[0];
const COLOR_KEYS: Array<keyof PdfStylePalette> = ['primary', 'secondary', 'text', 'line', 'tableHeader', 'tableHeaderText', 'tableRow', 'tableStripe', 'tableBorder'];
const ALLOWED_CSS_PROPERTIES = new Set(['color', 'background-color', 'border', 'border-color', 'border-style', 'border-width', 'border-top', 'border-bottom', 'border-radius', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-decoration', 'text-transform', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'width', 'max-width', 'vertical-align', 'display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'row-gap', 'column-gap']);
const PDF_LAYOUT_CSS_PROPERTIES = new Set(['display', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap', 'row-gap', 'column-gap']);
const ALLOWED_HTML_TAGS = new Set(['header', 'footer', 'div', 'span', 'p', 'strong', 'b', 'em', 'i', 'small', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li', 'img']);
const ALLOWED_HTML_ATTRIBUTES = new Set(['class', 'title', 'colspan', 'rowspan', 'align', 'data-novahub-logo', 'style']);

export function normalizePdfFontFamily(value: unknown) {
  const requested = String(value || '').replace(/^["']|["']$/g, '').trim().toLowerCase();
  return PDF_STYLE_FONTS.find(font => font.toLowerCase() === requested) || 'Arial';
}

export function getPdfTablePresentation(style: PdfTableStyle): PdfTablePresentation {
  const presentations: Record<PdfTableStyle, PdfTablePresentation> = {
    light: { outerBorder: false, outerBorderWidth: 0, outerBorderTone: 'line', cellBorders: 'horizontal', rowGap: 0, roundedRows: false, striped: false, headerRuleWidth: 1, headerRuleTone: 'line', headerTextTransform: 'none', rowAccentWidth: 0, summaryTone: 'plain' },
    boxed: { outerBorder: true, outerBorderWidth: 1, outerBorderTone: 'line', cellBorders: 'grid', rowGap: 0, roundedRows: false, striped: false, headerRuleWidth: 1, headerRuleTone: 'line', headerTextTransform: 'none', rowAccentWidth: 0, summaryTone: 'header' },
    bold: { outerBorder: true, outerBorderWidth: 2, outerBorderTone: 'accent', cellBorders: 'grid', rowGap: 0, roundedRows: false, striped: false, headerRuleWidth: 3, headerRuleTone: 'accent', headerTextTransform: 'uppercase', rowAccentWidth: 0, summaryTone: 'accent' },
    striped: { outerBorder: true, outerBorderWidth: 1, outerBorderTone: 'line', cellBorders: 'horizontal', rowGap: 0, roundedRows: false, striped: true, headerRuleWidth: 2, headerRuleTone: 'accent', headerTextTransform: 'uppercase', rowAccentWidth: 0, summaryTone: 'stripe' },
    bubble: { outerBorder: false, outerBorderWidth: 0, outerBorderTone: 'line', cellBorders: 'cards', rowGap: 4, roundedRows: true, striped: false, headerRuleWidth: 0, headerRuleTone: 'accent', headerTextTransform: 'uppercase', rowAccentWidth: 0, summaryTone: 'stripe' },
    wave: { outerBorder: false, outerBorderWidth: 0, outerBorderTone: 'accent', cellBorders: 'horizontal', rowGap: 2, roundedRows: false, striped: true, headerRuleWidth: 3, headerRuleTone: 'accent', headerTextTransform: 'uppercase', rowAccentWidth: 4, summaryTone: 'header' },
    folder: { outerBorder: true, outerBorderWidth: 1, outerBorderTone: 'line', cellBorders: 'horizontal', rowGap: 0, roundedRows: false, striped: true, headerRuleWidth: 2, headerRuleTone: 'line', headerTextTransform: 'none', rowAccentWidth: 2, summaryTone: 'stripe' },
  };
  return presentations[style] || presentations.light;
}

export function getPdfTableCellBorders(style: PdfTableStyle, columnIndex: number, columnCount: number, borderColor: string, accentColor: string) {
  const presentation = getPdfTablePresentation(style);
  const borders: Record<string, string> = {};
  const border = `1px solid ${borderColor}`;
  if (presentation.cellBorders === 'grid') {
    borders.borderTop = border;
    borders.borderBottom = border;
    borders.borderLeft = border;
    borders.borderRight = border;
  } else if (presentation.cellBorders === 'horizontal') {
    borders.borderBottom = border;
  } else if (presentation.cellBorders === 'cards') {
    borders.borderTop = border;
    borders.borderBottom = border;
    if (columnIndex === 0) {
      borders.borderLeft = border;
      borders.borderRadius = '6px 0 0 6px';
    }
    if (columnIndex === columnCount - 1) {
      borders.borderRight = border;
      borders.borderRadius = columnIndex === 0 ? '6px' : '0 6px 6px 0';
    }
  }
  if (presentation.rowAccentWidth && columnIndex === 0) {
    borders.borderLeft = `${presentation.rowAccentWidth}px solid ${accentColor}`;
  }
  return borders;
}

export function getPdfTableHeaderCellBorders(style: PdfTableStyle, columnIndex: number, columnCount: number, borderColor: string, accentColor: string) {
  const presentation = getPdfTablePresentation(style);
  const borders: Record<string, string> = {};
  if (presentation.cellBorders === 'grid') {
    borders.borderLeft = `1px solid ${borderColor}`;
    borders.borderRight = `1px solid ${borderColor}`;
  }
  if (presentation.rowAccentWidth && columnIndex === 0) {
    borders.borderLeft = `${presentation.rowAccentWidth}px solid ${accentColor}`;
  }
  return borders;
}

export function resolvePdfTableRowBackground(style: PdfTableStyle, palette: Pick<PdfStylePalette, 'tableRow' | 'tableStripe'>, rowIndex: number) {
  const presentation = getPdfTablePresentation(style);
  return presentation.striped && rowIndex % 2 === 1 ? palette.tableStripe : palette.tableRow;
}

function tint(color: string, amount = 0.92) {
  const hex = color.replace('#', '');
  const channel = (start: number) => Math.round(parseInt(hex.slice(start, start + 2), 16) * (1 - amount) + 255 * amount).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function isSafePdfLayoutValue(property: string, value: string) {
  const normalized = value.trim().toLowerCase();
  const enumerations: Record<string, string[]> = {
    display: ['flex', 'inline-flex'],
    'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
    'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
    'align-items': ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'],
    'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
  };
  if (enumerations[property]) return enumerations[property].includes(normalized);
  if (['gap', 'row-gap', 'column-gap'].includes(property)) {
    const values = normalized.split(/\s+/);
    return values.length <= 2 && values.every(item => {
      const match = item.match(/^(\d+(?:\.\d+)?)(px|pt|mm|cm|rem|em|%)?$/);
      return Boolean(match && Number(match[1]) <= 32);
    });
  }
  return true;
}

export function createDefaultPdfStyleConfig(_targetKey?: string): PdfStyleConfigV1 {
  return { version: 1, presetId: DEFAULT_PRESET.id, fontFamily: 'Arial', fontSize: 9, palette: { ...DEFAULT_PRESET.palette }, tableStyle: DEFAULT_PRESET.tableStyle };
}

export function normalizePdfStyleConfig(value: unknown): PdfStyleConfigV1 | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<PdfStyleConfigV1>;
  const preset = PDF_STYLE_PRESETS.find(item => item.id === candidate.presetId) || DEFAULT_PRESET;
  const rawPalette = candidate.palette && typeof candidate.palette === 'object' ? candidate.palette as Partial<PdfStylePalette> : {};
  const palette = {} as PdfStylePalette;
  COLOR_KEYS.forEach(key => { palette[key] = /^#[0-9a-f]{6}$/i.test(String(rawPalette[key] || '')) ? String(rawPalette[key]) : preset.palette[key]; });
  const fontSize = Number(candidate.fontSize);
  const safeHtml = candidate.htmlTemplate && typeof candidate.htmlTemplate === 'object'
    ? { headerHtml: sanitizePdfHtmlFragment(String(candidate.htmlTemplate.headerHtml || ''), 'header', normalizePdfFontFamily(candidate.fontFamily)), footerHtml: sanitizePdfHtmlFragment(String(candidate.htmlTemplate.footerHtml || ''), 'footer', normalizePdfFontFamily(candidate.fontFamily)), css: sanitizePdfTemplateCss(String(candidate.htmlTemplate.css || ''), normalizePdfFontFamily(candidate.fontFamily)), sourceName: String(candidate.htmlTemplate.sourceName || '').slice(0, 120) }
    : undefined;
  return {
    version: 1,
    presetId: preset.id,
    fontFamily: normalizePdfFontFamily(candidate.fontFamily),
    fontSize: Number.isFinite(fontSize) ? Math.max(7, Math.min(16, fontSize)) : 9,
    palette,
    tableStyle: PDF_STYLE_PRESETS.some(item => item.id === candidate.tableStyle) ? candidate.tableStyle as PdfTableStyle : preset.tableStyle,
    ...(safeHtml ? { htmlTemplate: safeHtml } : {}),
  };
}

export function applyPdfStyleToDefinition<T extends { nodes: any[]; metadata?: Record<string, any> }>(definition: T, config: PdfStyleConfigV1): T {
  const normalizedDefinition = normalizePdfFrameGeometry(definition);
  const sizeRatio = config.fontSize / 9;
  const tablePresentation = getPdfTablePresentation(config.tableStyle);
  return {
    ...normalizedDefinition,
    nodes: normalizedDefinition.nodes.map(node => {
      const isTable = node.type === 'table' || node.type === 'report-sections';
      const accent = /title|number|total/i.test(String(node.id || ''));
      const isHeaderSection = node.type === 'section' && node.id === 'header';
      const isPartySection = node.type === 'section' && node.id === 'party-section';
      const isHeaderRule = node.type === 'divider' && node.id === 'header-accent';
      const isHeaderFrame = isPdfFrameHeaderNode(node);
      const isFooterFrame = isPdfFrameFooterNode(node);
      const isFrameDecoration = (isHeaderFrame || isFooterFrame) && node.type === 'section';
      const isFooterBand = node.id === 'footer-band';
      const isFooterLayer = node.id === 'footer-layer';
      const isFooterAccent = node.id === 'footer-accent' || String(node.id || '').startsWith('footer-dot-');
      const isFooterWaveAccent = node.id === 'footer-accent' && node.shape === 'wave';
      const sourceFrameFill = String(node.backgroundColor || '').trim().toLowerCase();
      const mappedFrameFill = sourceFrameFill && !isLightNeutralColor(sourceFrameFill) && sourceFrameFill !== 'transparent'
        ? (isFooterLayer || isFooterWaveAccent || /band|shadow/.test(String(node.id || '')) ? config.palette.secondary : config.palette.primary)
        : node.backgroundColor;
      const footerY = node.id === 'footer-band' ? 95.2
        : node.id === 'footer-layer' ? 96.65
          : node.id === 'footer-divider' ? 95.35
            : String(node.id || '').startsWith('footer-dot-') ? 95.1
              : node.id === 'footer-accent' && node.shape === 'pill' ? 96.0
                : isFooterWaveAccent ? 96.65
                : node.id === 'footer-accent' ? 95.2
                  : node.id === 'footer-contact' || node.id === 'footer-page' ? 95.45
                    : undefined;
      const footerHeight = node.id === 'footer-band' ? 3.1
        : node.id === 'footer-layer' ? 1.45
          : node.id === 'footer-divider' ? 0.35
            : String(node.id || '').startsWith('footer-dot-') ? 0.9
              : node.id === 'footer-accent' && node.shape === 'pill' ? 0.55
                : isFooterWaveAccent ? 1.45
                : node.id === 'footer-accent' ? 3.1
                  : node.id === 'footer-contact' || node.id === 'footer-page' ? 3.1
                    : undefined;
      const tableRadius = tablePresentation.roundedRows ? Math.max(Number(node.borderRadius || 0), 6) : Number(node.borderRadius || 0);
      const isSplitFooterAccent = node.id === 'footer-accent' && node.type === 'section' && node.shape !== 'pill' && Number(node.width || 0) <= 30 && Number(node.height || 0) >= 3;
      const baseFontSize = Number(node.fontSize || 9);
      const frameFontRatio = Math.min(sizeRatio, 1.15);
      const styledFontSize = isFooterFrame
        ? Math.min(8, baseFontSize * frameFontRatio)
        : isHeaderFrame
          ? Math.min(node.id === 'document-title' ? 16 : 15, baseFontSize * frameFontRatio)
          : baseFontSize * sizeRatio;
      const reportSectionStyles = node.type === 'report-sections' && node.reportSectionStyles
        ? Object.fromEntries(Object.entries(node.reportSectionStyles).map(([index, sectionStyle]) => [index, {
          ...sectionStyle,
          headerColor: config.palette.tableHeader,
          headerTextColor: config.palette.tableHeaderText,
          rowTextColor: config.palette.text,
          rowColor: undefined,
          stripeColor: config.palette.tableStripe,
          columnColors: {},
          columnTextColors: {},
        }]))
        : node.reportSectionStyles;
      return {
        ...node,
        ...(footerY !== undefined ? { y: footerY } : {}),
        ...(footerHeight !== undefined ? { height: footerHeight } : {}),
        ...(node.id === 'footer-contact' ? { x: 8, width: Math.max(60, Number(node.width || 0)) } : {}),
        ...(isSplitFooterAccent ? { width: 65 } : {}),
        fontFamily: config.fontFamily,
        fontSize: Math.max(5, Math.min(72, styledFontSize)),
        color: (isHeaderFrame || isFooterFrame) && node.color ? node.color : accent ? config.palette.primary : config.palette.text,
        borderColor: isTable ? config.palette.tableBorder
          : isHeaderRule ? config.palette.primary
            : isHeaderSection && !isLightNeutralColor(String(node.borderColor || '')) ? config.palette.primary
              : isFooterBand || isFooterAccent ? (sourceFrameFill && !isLightNeutralColor(sourceFrameFill) ? (isFooterLayer || isFooterWaveAccent ? config.palette.secondary : config.palette.primary) : config.palette.line)
                : isHeaderFrame && isFrameDecoration && sourceFrameFill && !isLightNeutralColor(sourceFrameFill) ? (/band|shadow/.test(String(node.id || '')) ? config.palette.secondary : config.palette.primary)
                  : isHeaderSection || isPartySection || isFooterFrame ? config.palette.line : config.palette.line,
        ...(isFrameDecoration ? { backgroundColor: mappedFrameFill } : {}),
        ...(isHeaderSection ? { pdfHeaderDecoration: undefined, pdfHeaderAccentColor: undefined } : {}),
        ...(isPartySection ? { backgroundColor: tint(config.palette.primary, 0.95), borderColor: config.palette.line, borderStyle: 'solid', borderRadius: 4 } : {}),
        ...(isHeaderRule ? { color: config.palette.primary } : {}),
        ...(isTable ? { borderRadius: tableRadius } : {}),
        ...(node.type === 'report-sections' ? { reportSectionStyles } : {}),
        ...(isTable ? {
          columns: Array.isArray(node.columns) ? node.columns.map((column: any) => ({ ...column, backgroundColor: config.palette.tableHeader, color: config.palette.tableHeaderText })) : node.columns,
          tableHeaderColor: config.palette.tableHeader,
          tableHeaderTextColor: config.palette.tableHeaderText,
          tableTextColor: config.palette.text,
          tableRowColor: config.palette.tableRow,
          tableStripeColor: config.palette.tableStripe,
        } : {}),
      };
    }),
    metadata: { ...(normalizedDefinition.metadata || {}), pdfStyleConfig: config },
  };
}

export function isPdfFrameHeaderNode(node: { id?: string }) {
  return node.id === 'header'
    || String(node.id || '').startsWith('header-')
    || ['company-logo', 'company-name', 'company-summary', 'document-title', 'document-number', 'document-status', 'document-date', 'document-generated', 'report-meta', 'ticket-meta'].includes(String(node.id || ''));
}

export function isPdfFrameFooterNode(node: { id?: string }) {
  return String(node.id || '').startsWith('footer-');
}

/** Corrige geometrías antiguas del editor experimental sin tocar el contenido del documento. */
export function normalizePdfFrameGeometry<T extends { nodes: any[] }>(definition: T): T {
  return {
    ...definition,
    nodes: definition.nodes.map(node => {
      const isLegacySidebarAccent = node.id === 'header-accent'
        && node.clipPath === 'ellipse(100% 50% at 0% 50%)'
        && Number(node.width || 0) >= 6;
      const isLegacySidebarShadow = node.id === 'header-sidebar-shadow'
        && node.clipPath === 'ellipse(100% 50% at 0% 50%)'
        && Number(node.width || 0) >= 4;
      const isSplitFooterAccent = node.id === 'footer-accent'
        && node.type === 'section'
        && node.shape !== 'pill'
        && Number(node.width || 0) <= 30
        && Number(node.height || 0) >= 3;
      if (isLegacySidebarAccent) return { ...node, x: 5, y: 4, width: 2.4, height: 18 };
      if (isLegacySidebarShadow) return { ...node, x: 6.8, y: 6, width: 1.4, height: 14 };
      if (node.id === 'footer-contact') return { ...node, x: 8, width: Math.max(60, Number(node.width || 0)) };
      if (isSplitFooterAccent) return { ...node, width: 65 };
      return node;
    }),
  };
}

function isLightNeutralColor(value: string) {
  const normalized = value.trim().toLowerCase();
  if (['white', 'transparent', '#fff', '#ffffff', '#f8fafc', '#f1f5f9', '#f6f7f8', '#f9fafb'].includes(normalized)) return true;
  const hex = normalized.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (!hex) return false;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return Math.min(red, green, blue) >= 218 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 28;
}

export function sanitizePdfTemplateCss(css: string, fontFamily = 'Arial') {
  const input = String(css || '').trim();
  if (input.length > 20000) throw new Error('El CSS del marco supera el límite de 20 KB.');
  if (/@|url\s*\(|expression\s*\(|javascript:|https?:|\\|<|>|position\s*:|float\s*:|transform\s*:|grid/i.test(input)) {
    throw new Error('El CSS no permitido contiene scripts, recursos externos o reglas de distribución.');
  }
  const rules = input.match(/[^{}]+\{[^{}]*\}/g) || [];
  if (rules.join('').replace(/\s/g, '') !== input.replace(/\s/g, '')) throw new Error('El CSS del marco tiene una regla inválida.');
  return rules.map(rule => {
    const match = rule.match(/^([^{}]+)\{([^{}]*)\}$/);
    if (!match) throw new Error('El CSS del marco tiene una regla inválida.');
    const selectors = match[1].split(',').map(selector => selector.trim());
    if (selectors.some(selector => !/^(?:\.pdf-header|\.pdf-footer)(?:\s+(?:[a-z][a-z0-9-]*|\.[a-z][a-z0-9_-]*|\*))*$/i.test(selector))) throw new Error('El CSS solo puede seleccionar el encabezado o el pie.');
    const declarations = match[2].split(';').map(value => value.trim()).filter(Boolean).map(declaration => {
      const colon = declaration.indexOf(':');
      if (colon < 1) throw new Error('El CSS del marco tiene una declaración inválida.');
      const property = declaration.slice(0, colon).trim().toLowerCase();
      let value = declaration.slice(colon + 1).trim();
      if (!ALLOWED_CSS_PROPERTIES.has(property) || !value || /url\s*\(|expression|javascript:|https?:|[{}<>]/i.test(value) || (PDF_LAYOUT_CSS_PROPERTIES.has(property) && !isSafePdfLayoutValue(property, value))) throw new Error('El CSS no permitido contiene una propiedad insegura.');
      if (property === 'font-family') value = fontFamily;
      return `${property}: ${value}`;
    });
    return `${selectors.join(', ')} { ${declarations.join('; ')}; }`;
  }).join('\n');
}

function safeStyleAttribute(value: string, fontFamily: string) {
  const declarations = value.split(';').map(item => item.trim()).filter(Boolean);
  return declarations.map(declaration => {
    const separator = declaration.indexOf(':');
    if (separator < 1) return '';
    const property = declaration.slice(0, separator).trim().toLowerCase();
    let cssValue = declaration.slice(separator + 1).trim();
    if (!ALLOWED_CSS_PROPERTIES.has(property) || /url\s*\(|expression|javascript:|https?:|[{}<>]/i.test(cssValue) || (PDF_LAYOUT_CSS_PROPERTIES.has(property) && !isSafePdfLayoutValue(property, cssValue))) return '';
    if (property === 'font-family') cssValue = fontFamily;
    return `${property}: ${cssValue}`;
  }).filter(Boolean).join('; ');
}

function cleanHtmlFragment(fragment: Element, fontFamily: string) {
  const document = fragment.ownerDocument;
  const clone = document.createElement(fragment.localName);
  Array.from(fragment.attributes).forEach(attribute => {
    const name = attribute.name.toLowerCase();
    if (!ALLOWED_HTML_ATTRIBUTES.has(name)) return;
    if (name === 'data-novahub-logo' && attribute.value !== 'true' && attribute.value !== '') return;
    const value = name === 'style' ? safeStyleAttribute(attribute.value, fontFamily) : attribute.value.slice(0, 300);
    if (value) clone.setAttribute(name, value);
  });
  Array.from(fragment.childNodes).forEach(child => {
    if (child.nodeType === 3) clone.appendChild(document.createTextNode(child.textContent || ''));
    else if (child.nodeType === 1) {
      const element = child as Element;
      if (!ALLOWED_HTML_TAGS.has(element.localName.toLowerCase())) return;
      clone.appendChild(cleanHtmlFragment(element, fontFamily));
    }
  });
  return clone;
}

export function sanitizePdfHtmlFragment(html: string, zone: 'header' | 'footer', fontFamily = 'Arial') {
  if (html.length > 20000) throw new Error(`El ${zone} HTML supera el límite de 20 KB.`);
  if (typeof DOMParser === 'undefined') return '';
  if (/<\s*(?:script|iframe|object|embed|form|link|style|svg|video|audio|input|button|meta|base)\b|\son[a-z]+\s*=|(?:src|href)\s*=|javascript:|vbscript:/i.test(html)) throw new Error(`El ${zone} HTML contiene etiquetas o recursos no admitidos.`);
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = parsed.body.firstElementChild;
  if (!wrapper) return '';
  wrapper.classList.add(`pdf-${zone}`);
  const sanitized = cleanHtmlFragment(wrapper, fontFamily);
  return sanitized.innerHTML;
}

export function parsePdfHtmlShell(html: string) {
  if (html.length > 50000) throw new Error('La plantilla HTML supera el límite de 50 KB.');
  if (/<\s*(?:script|iframe|object|embed|form|link|svg|video|audio|input|button|meta|base)\b|\son[a-z]+\s*=|(?:src|href)\s*=|javascript:|vbscript:/i.test(html)) throw new Error('La plantilla contiene scripts, recursos remotos o etiquetas no admitidas.');
  if (typeof DOMParser === 'undefined') throw new Error('El navegador no permite analizar el HTML importado.');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const header = parsed.querySelector('[data-novahub-zone="header"]');
  const footer = parsed.querySelector('[data-novahub-zone="footer"]');
  const content = parsed.querySelector('[data-novahub-content]');
  if (!header || !footer || !content) throw new Error('El HTML debe incluir zonas data-novahub-zone="header", data-novahub-content y data-novahub-zone="footer".');
  if (content.textContent?.trim() || content.children.length) throw new Error('La zona data-novahub-content debe permanecer vacía; NovaHub agrega ahí el contenido del ERP.');
  header.classList.add('pdf-header');
  footer.classList.add('pdf-footer');
  const detectedFont = parsed.querySelector('[style*="font-family"], style')?.getAttribute('style')?.match(/font-family\s*:\s*([^;}]+)/i)?.[1]
    || parsed.querySelector('style')?.textContent?.match(/font-family\s*:\s*([^;}]+)/i)?.[1]
    || '';
  const fontFamily = normalizePdfFontFamily(detectedFont.split(',')[0]);
  const css = sanitizePdfTemplateCss(Array.from(parsed.querySelectorAll('style')).map(style => style.textContent || '').join('\n'), fontFamily);
  const safeHeader = sanitizePdfHtmlFragment(header.innerHTML, 'header', fontFamily);
  const safeFooter = sanitizePdfHtmlFragment(footer.innerHTML, 'footer', fontFamily);
  return { headerHtml: safeHeader, footerHtml: safeFooter, css, fontFamily };
}

export function resolvePdfHtmlTokens(root: HTMLElement, data: Record<string, any>, fontFamily: string, logoUrl?: string) {
  root.querySelectorAll('[data-novahub-logo]').forEach(element => {
    if (element.tagName.toLowerCase() === 'img' && logoUrl) (element as HTMLImageElement).src = logoUrl;
    else if (!logoUrl) element.remove();
  });
  const walker = root.ownerDocument.createTreeWalker(root, 4);
  let textNode = walker.nextNode();
  const allowedTokens = new Set([...TEMPLATE_TOKENS.map(item => item.token), 'page.number', 'page.pages']);
  while (textNode) {
    const source = textNode.textContent || '';
    textNode.textContent = source.replace(/\{\{\s*([a-z0-9_.-]+)\s*\}\}/gi, (_match, token: string) => {
      if (!allowedTokens.has(token)) return '';
      const value = token.split('.').reduce((current: any, segment) => current?.[segment], token.startsWith('page.') ? data.page : data);
      return String(value ?? '');
    });
    textNode = walker.nextNode();
  }
  root.style.fontFamily = fontFamily;
}
