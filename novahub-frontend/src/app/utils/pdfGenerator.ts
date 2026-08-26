import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pdfDocumentDesignService } from '../services/pdf-document-design.service';
import { getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { sanitizeHtml2CanvasOklch } from './export-utils';
import { getNovaHubLogoPng, NOVAHUB_LOGO_DATA_URL } from './novahubBrand';
import type { PdfDownloadFormat } from './pdfDownloadFormats';
import { getSalesAdditionalCharges } from './salesCharges';
import { paymentMethodLabel } from './paymentMethods';

type PdfRgb = [number, number, number];

type PdfPageSizeMm = { width: number; height: number };

function basePdfPageSizeMm(paperSize: unknown): PdfPageSizeMm {
  switch (String(paperSize || '').toUpperCase()) {
    case 'A4':
      return { width: 210, height: 297 };
    case 'LEGAL':
      return { width: 216, height: 356 };
    case 'OFICIO':
      return { width: 216, height: 330 };
    case 'LETTER':
    default:
      return { width: 216, height: 279 };
  }
}

export function pdfDesignPageSize(settings: Record<string, any>): PdfPageSizeMm {
  const size = basePdfPageSizeMm(settings.paperSize);
  return settings.orientation === 'landscape'
    ? { width: size.height, height: size.width }
    : size;
}

function pdfHexToRgb(value: unknown, fallback: PdfRgb): PdfRgb {
  if (typeof value !== 'string') return fallback;
  const hex = value.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export async function getPdfDesignSettings(targetKey: string) {
  try {
    const target = getPdfTemplateTarget(targetKey);
    const design = await pdfDocumentDesignService.active(target.key);
    return (design?.settings || {}) as Record<string, any>;
  } catch {
    // La personalización es opcional: el exportador siempre conserva su diseño actual.
    return {};
  }
}

export function pdfDesignColor(value: unknown, fallback: PdfRgb): PdfRgb {
  return pdfHexToRgb(value, fallback);
}

export function pdfDesignPaper(settings: Record<string, any>) {
  const paperSize = String(settings.paperSize || 'LETTER').toUpperCase();
  return {
    format: paperSize === 'A4'
      ? 'a4'
      : paperSize === 'LEGAL'
        ? 'legal'
        : paperSize === 'OFICIO'
          ? [216, 330]
          : 'letter',
    orientation: String(settings.orientation || 'portrait').toLowerCase() === 'landscape' ? 'landscape' : 'portrait',
  } as any;
}

function fitPdfImage(doc: jsPDF, image: string, maxWidth: number, maxHeight: number) {
  let ratio = 2;
  try {
    const properties = doc.getImageProperties(image);
    if (Number(properties.width) > 0 && Number(properties.height) > 0) {
      ratio = Number(properties.width) / Number(properties.height);
    }
  } catch {
    // Si una imagen remota no expone sus dimensiones, se usa una proporción
    // segura para que el PDF siga siendo descargable.
  }
  const width = Math.min(maxWidth, maxHeight * ratio);
  const height = width / ratio;
  return { width, height };
}

function paperSettingForDownload(format: Exclude<PdfDownloadFormat, 'configured' | 'roll-58' | 'roll-80'>) {
  return format === 'A4' ? 'A4' : format === 'legal' ? 'LEGAL' : format === 'oficio' ? 'OFICIO' : 'LETTER';
}

function withPdfDownloadFormat(design: any, format: PdfDownloadFormat) {
  if (format === 'configured') return design;
  return {
    ...(design || {}),
    settings: {
      ...((design && design.settings) || {}),
      paperSize: paperSettingForDownload(format as Exclude<PdfDownloadFormat, 'configured' | 'roll-58' | 'roll-80'>),
      orientation: design?.settings?.orientation === 'landscape' ? 'landscape' : 'portrait',
    },
  };
}

function htmlSafeColor(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const color = value.trim();
  return /oklch\(|oklab\(|color\(|lch\(|lab\(/i.test(color) ? fallback : color;
}

/**
 * Los comprobantes térmicos se imprimen en monocromo. Si el logo configurado
 * es una imagen a color, se rasteriza en escala de grises antes de incrustarlo
 * en el PDF. Si el recurso remoto no permite leer sus píxeles, se omite para
 * no entregar un rollo que mezcle color con contenido monocromático.
 */
async function toGrayscaleImageSource(source?: string | null): Promise<string | undefined> {
  if (!source || typeof window === 'undefined') return undefined;
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    let timeout = 0;
    const finish = (value?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve(value);
    };
    timeout = window.setTimeout(() => finish(), 2500);
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = window.document.createElement('canvas');
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        if (!canvas.width || !canvas.height) return finish();
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) return finish();
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let index = 0; index < pixels.data.length; index += 4) {
          const luminance = Math.round(
            pixels.data[index] * 0.299
            + pixels.data[index + 1] * 0.587
            + pixels.data[index + 2] * 0.114,
          );
          pixels.data[index] = luminance;
          pixels.data[index + 1] = luminance;
          pixels.data[index + 2] = luminance;
        }
        context.putImageData(pixels, 0, 0);
        finish(canvas.toDataURL('image/png'));
      } catch {
        finish();
      }
    };
    image.onerror = () => finish();
    image.src = source;
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

function htmlFieldStyle(field: any) {
  return `position:absolute;left:${Number(field.x) || 0}%;top:${Number(field.y) || 0}%;width:${Number(field.width) || 30}%;min-height:${Number(field.height) || 7}%;`;
}

function getSalesPdfAdditionalCharges(transaction: any): Array<{ label: string; amount: number }> {
  return getSalesAdditionalCharges(transaction).map((charge) => ({ label: charge.description, amount: charge.amount }));
}

async function generateHtmlTemplatePdf({ savedDesign, estimate, tenantName, formatAmount, tenantLogo, documentType, save }: { savedDesign: any; estimate: any; tenantName: string; formatAmount: (amount: number, currency: string, rate: number) => string; tenantLogo?: string; documentType: string; save: boolean }): Promise<{ doc: jsPDF; blob: Blob }> {
  const design = savedDesign.settings || {};
  const fields = Array.isArray(savedDesign.layoutZones?.fields) ? savedDesign.layoutZones.fields : [];
  const field = (id: string, fallback: any) => fields.find((item: any) => item.id === id) || { id, x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height, enabled: true };
  const titleMap: Record<string, string> = { estimate: 'COTIZACIÓN', order: 'ORDEN DE VENTA', invoice: 'FACTURA', recurring: 'FACTURA RECURRENTE', payment: 'PAGO RECIBIDO', return: 'NOTA DE CRÉDITO', 'credit-note': 'CRÉDITO' };
  const total = formatAmount(Number(estimate.total || 0), estimate.currency, estimate.exchangeRate);
  const values: Record<string, string> = {
    company: design.companyName || tenantName || 'Nuestra Empresa',
    slogan: design.slogan || '',
    fiscal: design.fiscalInfo || '',
    documentTitle: titleMap[documentType] || documentType.toUpperCase(),
    documentNumber: estimate.number || 'N/A',
    date: estimate.date ? new Date(estimate.date).toLocaleDateString() : 'N/A',
    customer: estimate.customer?.name || 'Cliente sin registrar',
    address: design.address || '',
    phone: design.phone || '',
    email: design.email || estimate.customer?.email || '',
    totals: total,
    legal: design.legalText || '',
    terms: design.terms || '',
    notes: design.defaultNotes || estimate.notes || '',
    footer: design.footerText || `Documento generado por ${tenantName}`,
  };
  const primary = htmlSafeColor(design.primaryColor, '#10b981');
  const text = htmlSafeColor(design.textColor, '#334155');
  const line = htmlSafeColor(design.lineColor, '#e2e8f0');
  const pageSizeMm = pdfDesignPageSize(design);
  const pageWidthPx = Math.round(pageSizeMm.width * 96 / 25.4);
  const pageHeightPx = Math.round(pageSizeMm.height * 96 / 25.4);
  const headerLayout = String(design.headerLayout || 'split');
  const tableLayout = String(design.tableLayout || 'standard');
  const bannerHeader = ['banner', 'ribbon', 'corner', 'double-band'].includes(headerLayout);
  const tableHeaderBackground = tableLayout === 'minimal' ? '#f8fafc' : primary;
  const tableHeaderColor = tableLayout === 'minimal' ? text : '#fff';
  const tableBorder = tableLayout === 'cards' ? 'none' : `1px solid ${line}`;
  const zone = (id: string, content: string, extra = '') => {
    const meta = field(id, { x: 8, y: 8, width: 38, height: 8 });
    if (meta.enabled === false || !content) return '';
    return `<div data-template-field="${id}" style="${htmlFieldStyle(meta)}${extra}">${content}</div>`;
  };
  const items = Array.isArray(estimate.items) ? estimate.items : [];
  const rows = (items.length ? items : [{ description: 'Sin productos', quantity: 0, unitPrice: 0, total: 0 }]).map((item: any, index: number) => `<div style="display:grid;grid-template-columns:1fr 12% 18% 18%;gap:4px;padding:${tableLayout === 'compact' ? 5 : 8}px;border-top:${tableBorder};border-radius:${tableLayout === 'cards' ? 4 : 0}px;background:${['striped', 'ledger', 'accent'].includes(tableLayout) && index % 2 ? '#f8fafc' : '#fff'};"><span>${escapeHtml(item.description || item.name || 'Producto')}</span><span>${escapeHtml(item.quantity || 0)}</span><span>${escapeHtml(formatAmount(Number(item.unitPrice || 0), estimate.currency, estimate.exchangeRate))}</span><strong style="color:${tableLayout === 'accent' ? primary : text}">${escapeHtml(formatAmount(Number(item.total || 0), estimate.currency, estimate.exchangeRate))}</strong></div>`).join('');
  const headerBackground = bannerHeader ? primary : '#f7fbf9';
  const headerBorder = bannerHeader ? 'none' : `1px solid ${line}`;
  const logoSource = design.logoUrl || tenantLogo || NOVAHUB_LOGO_DATA_URL;
  const logo = `<img src="${escapeHtml(logoSource)}" alt="NovaHub" style="position:absolute;left:${design.logoPosition === 'right' ? '78%' : design.logoPosition === 'center' ? '42%' : '8%'};top:4.5%;width:${Math.min(Number(design.logoSize) || 42, 78) / 2}%;max-height:10%;object-fit:contain;" />`;
  const additionalChargesHtml = getSalesPdfAdditionalCharges(estimate)
    .map((charge) => `<div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>${escapeHtml(charge.label)}</span><span>${escapeHtml(formatAmount(charge.amount, estimate.currency, estimate.exchangeRate))}</span></div>`)
    .join('');
  const totalsHtml = `<div style="font-size:.78em;text-align:right;background:#f7fbf9;border-radius:6px;padding:10px 12px;"><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>Subtotal</span><span>${escapeHtml(formatAmount(Number(estimate.subtotal || 0), estimate.currency, estimate.exchangeRate))}</span></div><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><span>Impuesto</span><span>${escapeHtml(formatAmount(Number(estimate.taxAmount || 0), estimate.currency, estimate.exchangeRate))}</span></div>${additionalChargesHtml}<div style="display:flex;justify-content:space-between;border-top:1px solid ${line};padding-top:7px;margin-top:6px;color:${primary};font-size:1.18em;font-weight:800;"><span>TOTAL</span><span>${escapeHtml(total)}</span></div></div>`;
  const pageHtml = `<div id="pdf-template-canvas" style="position:relative;width:${pageWidthPx}px;height:${pageHeightPx}px;overflow:hidden;background:#fff;color:${text};font-family:${escapeHtml(design.fontFamily || 'Arial')};font-size:${Number(design.fontSize) || 9}px;box-sizing:border-box;">
    <div style="position:absolute;inset:0 0 auto;height:29%;background:${headerBackground};border-top:6px solid ${primary};border-bottom:${headerBorder};${headerLayout === 'double-band' ? `border-bottom:10px solid ${line};` : ''}${headerLayout === 'sidebar' ? `border-left:10px solid ${primary};` : ''}${headerLayout === 'boxed' ? `inset:2%;height:25%;border:1px solid ${line};border-radius:10px;` : ''}"></div>${design.watermark ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.06;transform:rotate(-25deg);font-size:64px;font-weight:800;color:#64748b;">${escapeHtml(design.watermark)}</div>` : ''}${logo}
    ${zone('company', `<strong>${escapeHtml(values.company)}</strong>`, 'font-size:1.18em;letter-spacing:.01em;')}
    ${zone('slogan', `<span style="opacity:.75">${escapeHtml(values.slogan)}</span>`, 'font-size:.78em;')}
    ${zone('fiscal', `<span style="opacity:.75;white-space:pre-line">${escapeHtml(values.fiscal)}</span>`, 'font-size:.72em;')}
    ${zone('documentTitle', `<strong>${escapeHtml(values.documentTitle)}</strong>`, `text-align:right;font-size:1.55em;letter-spacing:.08em;font-weight:800;color:${bannerHeader ? '#fff' : primary};`)}
    ${zone('documentNumber', `Nº: ${escapeHtml(values.documentNumber)}`, 'text-align:right;font-size:.82em;')}
    ${zone('date', `Fecha: ${escapeHtml(values.date)}`, 'text-align:right;font-size:.82em;')}
    ${zone('customer', `<strong style="display:block;color:${primary};font-size:.78em;letter-spacing:.12em;text-transform:uppercase;">Preparado para</strong><span style="display:block;margin-top:4px;font-size:1.12em;font-weight:700;">${escapeHtml(values.customer)}</span>`)}
    ${zone('address', escapeHtml(values.address), 'font-size:.78em;opacity:.75;')}
    ${zone('phone', escapeHtml(values.phone), 'font-size:.78em;opacity:.75;')}
    ${zone('email', escapeHtml(values.email), 'font-size:.78em;opacity:.75;')}
    ${zone('items', `<div style="overflow:hidden;border:${tableBorder};border-radius:${tableLayout === 'cards' ? 0 : 6}px;font-size:.78em;box-shadow:0 2px 10px rgba(15,23,42,.04);"><div style="display:grid;grid-template-columns:1fr 12% 18% 18%;gap:4px;padding:${tableLayout === 'compact' ? 6 : 10}px;background:${tableHeaderBackground};color:${tableHeaderColor};font-size:.92em;letter-spacing:.06em;text-transform:uppercase;font-weight:700;"><span>Descripción</span><span>Cant.</span><span>Precio</span><span>Total</span></div>${rows}</div>`, 'padding:0;')}
    ${zone('totals', totalsHtml)}
    ${zone('legal', escapeHtml(values.legal).replace(/\n/g, '<br />'), 'font-size:.68em;opacity:.75;')}
    ${zone('terms', escapeHtml(values.terms).replace(/\n/g, '<br />'), 'font-size:.68em;opacity:.75;')}
    ${zone('notes', escapeHtml(values.notes).replace(/\n/g, '<br />'), 'font-size:.68em;opacity:.75;')}
    ${zone('footer', escapeHtml(values.footer), `font-size:.68em;opacity:.7;border-top:1px solid ${line};padding-top:4px;`)}
    ${design.showPageNumber !== false ? `<div style="position:absolute;right:8%;bottom:3%;font-size:.65em;opacity:.6;">${escapeHtml(design.pageNumberFormat === 'number-only' ? '1' : design.pageNumberFormat === 'custom' ? String(design.pageNumberCustom || 'Página {page} de {pages}').replace('{page}', '1').replace('{pages}', '1') : 'Página 1 de 1')}</div>` : ''}
    ${design.showQr ? '<div style="position:absolute;right:8%;bottom:7%;width:36px;height:36px;border:1px solid #94a3b8;"></div>' : ''}${design.showBarcode ? '<div style="position:absolute;right:18%;bottom:7%;width:80px;height:36px;border:1px solid #94a3b8;"></div>' : ''}
  </div>`;
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-100000px;top:0;z-index:-1;background:#fff;';
  wrapper.innerHTML = pageHtml;
  document.body.appendChild(wrapper);
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      onclone: (clonedDoc) => sanitizeHtml2CanvasOklch('pdf-template-canvas', clonedDoc, primary),
    });
    const { format, orientation } = pdfDesignPaper(design);
    const doc = new jsPDF({ orientation, unit: 'mm', format });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    const blob = doc.output('blob');
    if (save) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${estimate.number || 'Documento'}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    return { doc, blob };
  } finally {
    wrapper.remove();
  }
}

interface PDFGeneratorParams {
  estimate: any; // El objeto localDoc/estimate a imprimir
  tenantName: string;
  formatAmount: (amount: number, currency: string, rate: number) => string;
  tenantLogo?: string;
  documentType?: 'estimate' | 'order' | 'invoice' | 'recurring' | 'payment' | 'return' | 'credit-note';
  save?: boolean;
  designOverride?: any;
}

export const generateEstimatePDF = async ({ estimate, tenantName, formatAmount, tenantLogo, documentType = 'estimate', save = true, designOverride }: PDFGeneratorParams): Promise<{ doc: jsPDF | null; blob: Blob }> => {
  const savedDesign = designOverride || await pdfDocumentDesignService.active(getPdfTemplateTarget(documentType).key).catch(() => null);
  const resolvedTenantLogo = tenantLogo || await getNovaHubLogoPng();
  if (savedDesign?.engine === 'HTML_TEMPLATE' || savedDesign?.sourceType === 'UPLOADED_PDF') {
    return generateHtmlTemplatePdf({ savedDesign, estimate, tenantName, formatAmount, tenantLogo: resolvedTenantLogo, documentType, save });
  }
  // Las plantillas cargadas se exportan con el mismo motor HTML-estructurado
  // que la vista previa. El PDF original queda como referencia, no como fondo
  // para evitar duplicar textos y datos dinámicos.
  const design: any = savedDesign?.settings || {};
  const { format, orientation } = pdfDesignPaper(design);
  const doc = new jsPDF({ orientation, unit: 'mm', format });
  
  // 1. Configuraciones iniciales y estilos base
  const primaryColor = pdfHexToRgb(design.primaryColor, [15, 118, 110]);
  const textColor = pdfHexToRgb(design.textColor, [30, 41, 59]);
  const lineColor = pdfHexToRgb(design.lineColor, [226, 232, 240]);
  const margin = Math.max(8, Math.min(28, Number(design.margins) || 14));
  const pageWidth = doc.internal.pageSize.getWidth();
  const rightEdge = pageWidth - margin;
  // jsPDF trae tres familias base; las opciones adicionales del diseñador
  // se agrupan en su equivalente PDF para conservar una salida consistente.
  const selectedFont = String(design.fontFamily || 'helvetica').toLowerCase();
  const serifFonts = ['times', 'times new roman', 'georgia', 'garamond', 'cambria', 'palatino linotype', 'bookman'];
  const monoFonts = ['courier', 'courier new', 'consolas', 'monaco'];
  const fontName = serifFonts.includes(selectedFont) ? 'times' : monoFonts.includes(selectedFont) ? 'courier' : 'helvetica';
  const baseFontSize = Math.max(7, Math.min(13, Number(design.fontSize) || 9));
  const companyDisplayName = design.showCompanyName === false ? '' : (design.companyName || tenantName || 'Nuestra Empresa');
  const logoPosition = design.logoPosition || 'left';
  const headerLayout = design.headerLayout || 'split';
  const logoMaxWidth = Math.max(18, Math.min(70, Number(design.logoSize) || 42));
  const logoMaxHeight = headerLayout === 'compact' ? 17 : 21;
  const designLogo = design.logoUrl || resolvedTenantLogo;
  const tableLayout = design.tableLayout || 'standard';
  const isBannerHeader = ['banner', 'ribbon', 'corner', 'double-band'].includes(headerLayout);
  const isCenteredHeader = ['centered', 'editorial'].includes(headerLayout);
  const headerTextColor: PdfRgb = isBannerHeader ? [255, 255, 255] : textColor;
  const headerHeight = isCenteredHeader ? 64 : headerLayout === 'compact' ? 42 : isBannerHeader ? 46 : 52;
  const companyHeaderColor: PdfRgb = isBannerHeader ? [255, 255, 255] : primaryColor;

  // La vista previa usa una banda real para el layout corporativo. Antes el
  // exportador solo tomaba el color de la tabla y dejaba el encabezado blanco,
  // por eso el PDF no coincidía con la configuración guardada por vista.
  if (isBannerHeader) {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
  }
  if (headerLayout === 'topline' || headerLayout === 'sidebar') {
    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(1.5);
    if (headerLayout === 'topline') doc.line(margin, 8, rightEdge, 8);
    if (headerLayout === 'sidebar') doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    if (headerLayout === 'sidebar') doc.rect(0, 0, 5, headerHeight, 'F');
  }
  if (headerLayout === 'boxed') {
    doc.setDrawColor(...lineColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin - 2, 8, pageWidth - (margin * 2) + 4, headerHeight - 12, 3, 3, 'S');
  }
  if (headerLayout === 'double-band') {
    doc.setFillColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.rect(0, headerHeight - 5, pageWidth, 5, 'F');
  }
  
  // 2. Encabezado: la distribución elegida en la biblioteca también controla
  // la posición real de la identidad y del título en el PDF.
  const logoSize = designLogo ? fitPdfImage(doc, designLogo, logoMaxWidth, logoMaxHeight) : { width: 0, height: 0 };
  const logoX = logoPosition === 'center' ? (pageWidth - logoSize.width) / 2 : logoPosition === 'right' ? rightEdge - logoSize.width : margin;
  const logoY = isBannerHeader ? 13 : 15;
  let docTypeStr = 'Cotización de Venta';
  if (documentType === 'order') docTypeStr = 'Orden de Venta';
  else if (documentType === 'invoice') docTypeStr = 'Factura';
  else if (documentType === 'recurring') docTypeStr = 'Factura Recurrente';
  else if (documentType === 'payment') docTypeStr = 'Comprobante de Pago';
  else if (documentType === 'return') docTypeStr = 'Nota de Crédito';
  else if (documentType === 'credit-note') docTypeStr = 'Crédito';
  if (isCenteredHeader) {
    const centerX = pageWidth / 2;
    const centeredLogoY = 8;
    if (designLogo) {
      try {
        doc.addImage(designLogo, 'PNG', (pageWidth - logoSize.width) / 2, centeredLogoY, logoSize.width, logoSize.height);
      } catch (error) {
        console.warn('No se pudo incrustar el logo en el PDF', error);
      }
    }
    let centeredY = centeredLogoY + (designLogo ? logoSize.height + 5 : 4);
    doc.setTextColor(companyHeaderColor[0], companyHeaderColor[1], companyHeaderColor[2]);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(designLogo ? 14 : 18);
    if (companyDisplayName) {
      doc.text(companyDisplayName, centerX, centeredY, { align: 'center' });
      centeredY += 6;
    }
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(isBannerHeader ? 235 : 100, isBannerHeader ? 245 : 116, isBannerHeader ? 240 : 139);
    if (design.slogan) { doc.text(String(design.slogan), centerX, centeredY, { align: 'center' }); centeredY += 5; }
    if (design.fiscalInfo) { doc.text(String(design.fiscalInfo), centerX, centeredY, { align: 'center' }); centeredY += 5; }
    doc.setFont(fontName, 'bold');
    doc.setFontSize(15);
    doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
    doc.text(docTypeStr, centerX, centeredY + 2, { align: 'center' });
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Nº ${estimate.number || 'N/A'} · ${estimate.date ? new Date(estimate.date).toLocaleDateString() : 'N/A'}`, centerX, centeredY + 8, { align: 'center' });
  } else {
    const identityX = logoPosition === 'left' ? logoX + logoSize.width + 6 : logoPosition === 'right' ? rightEdge : logoX;
    const identityAlign = logoPosition === 'right' ? 'right' : 'left';
    if (designLogo) {
      try {
        doc.addImage(designLogo, 'PNG', logoX, logoY, logoSize.width, logoSize.height);
      } catch (error) {
        console.warn('No se pudo incrustar el logo en el PDF', error);
      }
    }
    doc.setTextColor(companyHeaderColor[0], companyHeaderColor[1], companyHeaderColor[2]);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(designLogo ? 14 : 18);
    if (companyDisplayName) doc.text(companyDisplayName, identityX, logoY + 8, { align: identityAlign as any });
    doc.setFontSize(8.5);
    doc.setTextColor(isBannerHeader ? 235 : 100, isBannerHeader ? 245 : 116, isBannerHeader ? 240 : 139);
    doc.setFont(fontName, 'normal');
    if (design.slogan) doc.text(String(design.slogan), identityX, logoY + 14, { align: identityAlign as any });
    if (design.fiscalInfo) doc.text(String(design.fiscalInfo), identityX, logoY + 19, { align: identityAlign as any });
    doc.text(docTypeStr, identityX, logoY + (design.slogan || design.fiscalInfo ? 25 : 20), { align: identityAlign as any });

    // 3. Ficha documental alineada según el encabezado no centrado.
    doc.setFontSize(17);
    doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
    doc.setFont(fontName, 'bold');
    let titleStr = 'COTIZACIÓN';
    if (documentType === 'order') titleStr = 'ORDEN DE VENTA';
    else if (documentType === 'invoice') titleStr = 'FACTURA';
    else if (documentType === 'recurring') titleStr = 'FACTURA RECURRENTE';
    else if (documentType === 'payment') titleStr = 'PAGO RECIBIDO';
    else if (documentType === 'return') titleStr = 'NOTA DE CRÉDITO';
    else if (documentType === 'credit-note') titleStr = 'CRÉDITO';
    doc.text(titleStr, rightEdge, 22, { align: 'right' });
    doc.setFontSize(8.5);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Nº ${estimate.number || 'N/A'}`, rightEdge, 29, { align: 'right' });
    doc.text(`Fecha  ${estimate.date ? new Date(estimate.date).toLocaleDateString() : 'N/A'}`, rightEdge, 35, { align: 'right' });
    if (documentType === 'order') doc.text(`Entrega  ${estimate.expectedDelivery ? new Date(estimate.expectedDelivery).toLocaleDateString() : 'N/A'}`, rightEdge, 41, { align: 'right' });
    else doc.text(`Válida hasta  ${estimate.expiryDate ? new Date(estimate.expiryDate).toLocaleDateString() : 'N/A'}`, rightEdge, 41, { align: 'right' });
  }

  // 4. Separador
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.5);
  if (design.separator !== 'none' && !isBannerHeader) {
    if (design.separator === 'dashed') doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, headerHeight, rightEdge, headerHeight);
    doc.setLineDashPattern([], 0);
  }

  // 5. Tarjeta de cliente: una jerarquía clara antes del detalle.
  const customerBoxY = isCenteredHeader ? 70 : headerLayout === 'compact' ? 49 : 58;
  const customerBoxH = headerLayout === 'compact' ? 23 : 27;
  doc.setFillColor(247, 251, 249);
  doc.setDrawColor(...lineColor);
  doc.roundedRect(margin, customerBoxY, pageWidth - (margin * 2), customerBoxH, 2.5, 2.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('PREPARADO PARA', margin + 6, customerBoxY + 7);
  
  doc.setFontSize(10);
  doc.setFont(fontName, 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  const clienteNombre = estimate.customer?.name || 'Cliente sin registrar';
  const clienteEmail = estimate.customer?.email || '';
  const clienteTelf = estimate.customer?.phone || '';
  
  const customerY = customerBoxY + 14;
  doc.setFont(fontName, 'bold');
  doc.text(clienteNombre, margin + 6, customerY);
  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  const contact = [clienteEmail, clienteTelf].filter(Boolean).join('  ·  ');
  if (contact) doc.text(contact, rightEdge - 6, customerY, { align: 'right' });

  // 6. Configuración de ítems (Tabla)
  const tableData = (estimate.items || []).map((item: any) => [
    item.description || 'Producto Customizado',
    Number(item.quantity).toString(),
    formatAmount(Number(item.unitPrice), estimate.currency, estimate.exchangeRate),
    formatAmount(Number(item.total), estimate.currency, estimate.exchangeRate)
  ]);

  const tableTheme = tableLayout === 'striped' || tableLayout === 'ledger' ? 'striped' : tableLayout === 'minimal' ? 'plain' : 'grid';
  const lightTableHeader = tableLayout === 'minimal';
  autoTable(doc, {
    startY: isCenteredHeader ? 104 : headerLayout === 'compact' ? 79 : 92,
    head: [['Descripción', 'Cantidad', 'Precio U.', 'Total']],
    body: tableData,
    theme: tableTheme,
    headStyles: {
      fillColor: lightTableHeader ? [248, 250, 252] : primaryColor,
      textColor: lightTableHeader ? textColor : 255,
      fontSize: baseFontSize,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 4,
    },
    bodyStyles: {
      textColor: textColor,
      fontSize: baseFontSize
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: tableLayout === 'compact' ? 2.5 : tableLayout === 'cards' ? 4 : 4.5, lineWidth: tableLayout === 'minimal' ? 0 : 0.15, lineColor },
    tableLineWidth: tableLayout === 'minimal' ? 0 : 0.2,
    tableLineColor: lineColor,
    alternateRowStyles: tableLayout === 'striped' || tableLayout === 'ledger' || tableLayout === 'accent' ? { fillColor: [248, 250, 252] } : undefined,
  });

  // 7. Resumen Financiero
  const finalY = (doc as any).lastAutoTable.finalY || 90;
  const rightX = rightEdge;
  const summaryX = Math.max(margin + 82, rightEdge - 72);
  const summaryTop = finalY + 7;
  const additionalChargeLines = getSalesPdfAdditionalCharges(estimate);
  const summaryRows = 2 + (Number(estimate.discountAmount) > 0 ? 1 : 0) + (Number(estimate.taxAmount) > 0 ? 1 : 0) + additionalChargeLines.length;
  const summaryHeight = summaryRows * 6 + 14;
  doc.setFillColor(247, 251, 249);
  doc.setDrawColor(...lineColor);
  doc.roundedRect(summaryX - 6, summaryTop, rightEdge - summaryX + 12, summaryHeight, 2.5, 2.5, 'FD');
  const labelX = summaryX;
  let currentY = summaryTop + 8;
  
  doc.setFontSize(10);
  
  // Subtotal
  doc.setFont(fontName, 'normal');
  doc.text('Subtotal:', labelX, currentY);
  doc.text(formatAmount(Number(estimate.subtotal), estimate.currency, estimate.exchangeRate), rightX, currentY, { align: 'right' });
  currentY += 7;
  
  // Descuento
  if (Number(estimate.discountAmount) > 0) {
    doc.text('Descuento:', labelX, currentY);
    doc.setTextColor(239, 68, 68); // Red 500
    doc.text(`-${formatAmount(Number(estimate.discountAmount), estimate.currency, estimate.exchangeRate)}`, rightX, currentY, { align: 'right' });
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    currentY += 7;
  }
  
  // Impuesto
  if (Number(estimate.taxAmount) > 0) {
    doc.text('Impuesto (IVA):', labelX, currentY);
    doc.text(formatAmount(Number(estimate.taxAmount), estimate.currency, estimate.exchangeRate), rightX, currentY, { align: 'right' });
    currentY += 7;
  }

  additionalChargeLines.forEach((charge) => {
    doc.text(`${charge.label}:`, labelX, currentY);
    doc.text(formatAmount(charge.amount, estimate.currency, estimate.exchangeRate), rightX, currentY, { align: 'right' });
    currentY += 7;
  });
  
  // Total Line
  doc.setDrawColor(...lineColor);
  if (design.separator !== 'none') doc.line(labelX - 2, currentY - 3, rightX, currentY - 3);
  
  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL', labelX, currentY + 3);
  doc.text(formatAmount(Number(estimate.total), estimate.currency, estimate.exchangeRate), rightX, currentY + 3, { align: 'right' });

  // 8. Notas
  if (estimate.notes) {
     const notesY = Math.max(currentY + 20, finalY + 15);
     doc.setFontSize(10);
     doc.setFont(fontName, 'bold');
     doc.setTextColor(textColor[0], textColor[1], textColor[2]);
     doc.text('Notas:', margin, notesY);
     
     doc.setFontSize(9);
     doc.setFont(fontName, 'normal');
     doc.setTextColor(100, 116, 139);
     const splitNotes = doc.splitTextToSize(estimate.notes, 100);
     doc.text(splitNotes, margin, notesY + 6);
  }

  const extraText = [design.bankInfo && `Información bancaria: ${design.bankInfo}`, design.legalText && `Legal: ${design.legalText}`, design.terms && `Términos: ${design.terms}`, design.defaultNotes && `Observaciones: ${design.defaultNotes}`].filter(Boolean).join('\n');
  const pageHeight = doc.internal.pageSize.height;
  if (extraText) {
    const extraY = Math.min(pageHeight - 30, (doc as any).lastAutoTable.finalY + 42);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(doc.splitTextToSize(extraText, pageWidth - margin * 2), margin, extraY);
  }

  // Footer (Generado por)
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFont(fontName, 'italic');
  if (design.footerText) doc.text(String(design.footerText), margin, pageHeight - 16);
  doc.text(`Documento generado por ${tenantName}`, margin, pageHeight - 10);
  if (design.showPageNumber !== false) {
    const pageText = design.pageNumberFormat === 'number-only' ? '1' : design.pageNumberFormat === 'custom' ? String(design.pageNumberCustom || 'Página {page} de {pages}').replace('{page}', '1').replace('{pages}', '1') : 'Página 1 de 1';
    doc.text(pageText, rightEdge, pageHeight - 10, { align: 'right' });
  }

  const blob = doc.output('blob');
  if (save) {
    // Descargar mediante un enlace explícito evita que el botón quede bloqueado
    // cuando la tabla tiene varias acciones dentro de una celda con overflow.
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${estimate.number || 'Cotizacion'}.pdf`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return { doc, blob };
};

type SalesTransactionDocumentType = 'estimate' | 'order' | 'invoice' | 'recurring' | 'payment' | 'return' | 'credit-note';

const SALES_TRANSACTION_TITLES: Record<SalesTransactionDocumentType, string> = {
  estimate: 'COTIZACIÓN',
  order: 'ORDEN DE VENTA',
  invoice: 'FACTURA',
  recurring: 'FACTURA RECURRENTE',
  payment: 'PAGO RECIBIDO',
  return: 'NOTA DE CRÉDITO',
  'credit-note': 'CRÉDITO',
};

function savePdfBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getPaymentVoucherRows(transaction: any) {
  const rows = Array.isArray(transaction?.payments) && transaction.payments.length
    ? transaction.payments
    : [transaction];
  return rows.filter((row: any) => row && typeof row === 'object');
}

function getPaymentVoucherContext(transaction: any) {
  const isCreditLink = Boolean(transaction?.creditNote || transaction?.creditNoteId);
  const linkedDocument = isCreditLink
    ? transaction?.creditNote || transaction?.invoice || null
    : transaction?.invoice || transaction?.creditNote || null;
  const linkedDocumentType = isCreditLink
    ? 'Crédito'
    : transaction?.invoice || transaction?.invoiceId
      ? 'Factura'
      : 'Anticipo';
  const linkedDocumentNumber = linkedDocument?.number
    || transaction?.invoiceNumber
    || transaction?.creditNoteNumber
    || (linkedDocumentType === 'Anticipo' ? 'Sin documento' : 'Sin número');
  const explicitLabel = String(transaction?.paymentLabel || transaction?.operationLabel || '').trim();
  const linkedStatus = String(linkedDocument?.status || '').toUpperCase();
  const documentTotal = Number(linkedDocument?.total || 0);
  const financialDocument = transaction?.invoice || linkedDocument?.invoice || linkedDocument || null;
  const financialTotal = Number(financialDocument?.total || documentTotal || 0);
  const financialCurrency = String(financialDocument?.currency || linkedDocument?.currency || transaction?.currency || 'NIO').toUpperCase();
  const financialRate = Number(financialDocument?.exchangeRate || linkedDocument?.exchangeRate || transaction?.exchangeRate || 1) || 1;
  const financialRows = [
    { label: 'Subtotal', amount: Math.max(0, Number(financialDocument?.subtotal || 0)) },
    { label: 'Descuento', amount: Math.max(0, Number(financialDocument?.discountAmount || 0)), negative: true },
    { label: 'IVA', amount: Math.max(0, Number(financialDocument?.taxAmount || 0)) },
    ...getSalesPdfAdditionalCharges(financialDocument).map((charge) => ({ label: charge.label, amount: charge.amount })),
  ].filter((row) => row.amount > 0.001);
  const paymentRows = getPaymentVoucherRows(transaction);
  const linkedCurrency = String(linkedDocument?.currency || transaction?.currency || 'NIO').toUpperCase();
  const linkedRate = Number(linkedDocument?.exchangeRate || transaction?.exchangeRate || 1) || 1;
  const paidInLinkedCurrency = paymentRows.reduce((sum: number, row: any) => {
    const amount = Number(row.amount || 0);
    const rowCurrency = String(row.currency || transaction?.currency || linkedCurrency).toUpperCase();
    if (rowCurrency === linkedCurrency) return sum + amount;
    const baseAmount = Number(row.baseAmount ?? (rowCurrency === 'USD' ? amount * Number(row.exchangeRate || 1) : amount));
    return sum + (linkedCurrency === 'USD' ? baseAmount / linkedRate : baseAmount);
  }, 0);
  const explicitBalance = transaction?.remaining ?? transaction?.pendingBalance;
  const hasExplicitBalance = explicitBalance !== undefined && explicitBalance !== null && Number.isFinite(Number(explicitBalance));
  const reportedBalance = hasExplicitBalance
    ? Math.max(0, Number(explicitBalance))
    : Number(linkedDocument?.balance || 0);
  const linkedAmountPaid = Number(linkedDocument?.amountPaid);
  const accumulatedLinkedPayment = Number.isFinite(linkedAmountPaid) ? Math.max(0, linkedAmountPaid) : 0;
  const derivedBalance = documentTotal > 0
    ? Math.max(0, documentTotal - Math.max(paidInLinkedCurrency, accumulatedLinkedPayment))
    : 0;
  const effectiveBalance = hasExplicitBalance || reportedBalance > 0.01 ? reportedBalance : derivedBalance;
  const isCreditSettled = isCreditLink && effectiveBalance <= 0.01;
  const isPartial = !isCreditSettled && (
    effectiveBalance > 0.01
    || (!hasExplicitBalance && (/parcial|abono/i.test(explicitLabel)
      || linkedStatus === 'PARTIAL'
      || (documentTotal > 0 && paidInLinkedCurrency + 0.01 < documentTotal)))
  );
  const accumulatedPaid = financialTotal > 0
    ? Math.min(financialTotal, Math.max(0, financialTotal - effectiveBalance))
    : paidInLinkedCurrency;
  const operation = linkedDocument
    ? isPartial ? 'ABONO PARCIAL' : 'PAGO COMPLETO'
    : 'PAGO RECIBIDO';
  const settlementLabel = isCreditSettled
    ? 'Crédito cancelado'
    : isPartial
    ? (/parcial|abono/i.test(explicitLabel) ? explicitLabel : 'Pago parcial')
    : explicitLabel || (linkedDocument ? 'Pago completo' : 'Pago recibido');
  const statusLabel = isCreditSettled ? 'Cancelado' : isPartial ? 'Saldo pendiente' : linkedDocument ? 'Liquidado' : 'Registrado';

  return {
    linkedDocument,
    linkedDocumentType,
    linkedDocumentNumber,
    operation,
    settlementLabel,
    statusLabel,
    effectiveBalance,
    financialDocument,
    financialCurrency,
    financialRate,
    financialTotal,
    financialRows,
    accumulatedPaid,
    isCreditSettled,
  };
}

async function generateSalesPaymentVoucherPDF({
  document: transaction,
  tenantName,
  formatAmount,
  tenantLogo,
  format,
  settings,
  save = true,
}: {
  document: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  format: PdfDownloadFormat;
  settings: Record<string, any>;
  save?: boolean;
}) {
  const rows = getPaymentVoucherRows(transaction);
  const {
    linkedDocument,
    linkedDocumentType,
    linkedDocumentNumber,
    operation,
    settlementLabel,
    statusLabel,
    effectiveBalance,
    financialCurrency,
    financialRate,
    financialTotal,
    financialRows,
    accumulatedPaid,
  } = getPaymentVoucherContext(transaction);
  const linkedCurrency = linkedDocument?.currency || transaction?.currency || 'NIO';
  const linkedRate = Number(linkedDocument?.exchangeRate || transaction?.exchangeRate || 1);
  const voucherCurrency = transaction?.currency || linkedCurrency;
  const voucherRate = Number(transaction?.exchangeRate || linkedRate || 1);
  const voucherTotal = Number(transaction?.total ?? transaction?.amount ?? rows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0));
  const documentTotal = Number(linkedDocument?.total || 0);
  const pendingBalance = effectiveBalance;
  const changeAmount = Math.max(0, Number(transaction?.change ?? transaction?.changeAmount ?? 0));
  const currencyCode = (value: unknown) => String(value || voucherCurrency || 'NIO').toUpperCase() === 'USD' ? 'USD' : 'NIO';
  const money = (amount: unknown, currency = voucherCurrency, rate = voucherRate) => formatAmount(Number(amount || 0), currency, rate);
  const isRoll = format === 'roll-58' || format === 'roll-80';
  const primaryColor = isRoll ? [0, 0, 0] as PdfRgb : pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = isRoll ? [0, 0, 0] as PdfRgb : pdfDesignColor(settings.textColor, [31, 41, 55]);
  const lineColor = isRoll ? [0, 0, 0] as PdfRgb : pdfDesignColor(settings.lineColor, [203, 213, 225]);
  const selectedFont = String(settings.fontFamily || '').toLowerCase();
  const fontName = selectedFont.includes('serif') ? 'times' : selectedFont.includes('mono') || selectedFont.includes('courier') ? 'courier' : 'helvetica';
  const companyName = String(settings.companyName || tenantName || 'Nuestra Empresa');
  const logo = isRoll
    ? await toGrayscaleImageSource(settings.logoUrl || tenantLogo)
    : settings.logoUrl || tenantLogo;

  const methodRows = rows.map((row: any) => {
    const rowCurrency = currencyCode(row.currency || voucherCurrency);
    const reference = row.reference || transaction?.reference || 'Sin referencia';
    const bank = row.bankAccount?.bankName || transaction?.bankAccount?.bankName || '';
    return {
      method: paymentMethodLabel(String(row.method || transaction?.method || '').toUpperCase()),
      currency: rowCurrency,
      amount: Number(row.amount || 0),
      rate: Number(row.exchangeRate || voucherRate || 1),
      reference: String(reference),
      bank: String(bank),
    };
  });

  if (isRoll) {
    const width = format === 'roll-58' ? 58 : 80;
    const margin = width === 58 ? 3 : 4;
    const contentWidth = width - margin * 2;
    const probe = new jsPDF({ unit: 'mm', format: [width, 1000], orientation: 'portrait' });
    probe.setFont(fontName, 'normal');
    const countLines = (value: unknown, size: number, maxWidth = contentWidth) => {
      probe.setFontSize(size);
      return Math.max(1, probe.splitTextToSize(String(value || ''), maxWidth).length);
    };
    const logoSize = logo ? fitPdfImage(probe, logo, width === 58 ? 30 : 38, 16) : { width: 0, height: 0 };
    const customerName = transaction?.customer?.name || transaction?.customerName || 'Cliente general';
    const notes = String(transaction?.notes || '').trim();
    const headerHeight = logoSize.height + countLines(companyName, width === 58 ? 9 : 10) * 4 + (settings.slogan ? 4 : 0) + (settings.fiscalInfo ? 4 : 0) + 16;
    const metaHeight = 5 * 4.2 + countLines(customerName, 7.2) * 3.5 + 12;
    const detailHeight = 10 + methodRows.reduce((total: number, row: any) => total + 10 + countLines(`${row.method} · ${row.reference}${row.bank ? ` · ${row.bank}` : ''}`, 6.5) * 3.2, 0);
    const summaryHeight = 32 + financialRows.length * 4 + (changeAmount > 0.01 ? 4 : 0);
    const notesHeight = notes ? countLines(`Notas: ${notes}`, 6.5, contentWidth) * 3.2 + 6 : 0;
    const pageHeight = Math.max(150, margin + headerHeight + metaHeight + detailHeight + summaryHeight + notesHeight + 20);
    const doc = new jsPDF({ unit: 'mm', format: [width, pageHeight], orientation: 'portrait' });
    const primary = primaryColor;
    let y = margin;
    const drawRule = (color = lineColor, weight = 0.3) => {
      doc.setDrawColor(color[0], color[1], color[2]);
      doc.setLineWidth(weight);
      doc.line(margin, y, width - margin, y);
    };
    const drawRow = (label: string, value: string, bold = false) => {
      doc.setFont(fontName, bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 8.2 : 6.8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(label, margin, y);
      doc.text(value, width - margin, y, { align: 'right' });
      y += bold ? 5 : 4;
    };
    const drawFinancialRow = (row: { label: string; amount: number; negative?: boolean }) => {
      drawRow(row.label, `${row.negative ? '- ' : ''}${money(row.amount, financialCurrency, financialRate)}`);
    };

    if (logo) {
      try {
        doc.addImage(logo, 'PNG', (width - logoSize.width) / 2, y, logoSize.width, logoSize.height, undefined, 'FAST');
        y += logoSize.height + 3;
      } catch {
        // El comprobante continúa aunque el logo configurado no sea compatible.
      }
    }
    doc.setFont(fontName, 'bold');
    doc.setFontSize(width === 58 ? 9 : 10.5);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(doc.splitTextToSize(companyName, contentWidth), width / 2, y, { align: 'center' });
    y += countLines(companyName, width === 58 ? 9 : 10.5) * 4;
    if (settings.slogan) {
      doc.setFont(fontName, 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(doc.splitTextToSize(String(settings.slogan), contentWidth), width / 2, y, { align: 'center' });
      y += 4;
    }
    if (settings.fiscalInfo) {
      doc.setFontSize(5.8);
      doc.text(doc.splitTextToSize(String(settings.fiscalInfo), contentWidth), width / 2, y, { align: 'center' });
      y += 4;
    }
    drawRule(primary, 0.45);
    y += 4;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(width === 58 ? 8 : 9.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('COMPROBANTE DE PAGO', width / 2, y, { align: 'center' });
    y += 4;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(width === 58 ? 7.5 : 8.5);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(operation, width / 2, y, { align: 'center' });
    y += 4;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Nº ${transaction?.number || transaction?.id || 'Sin número'}`, width / 2, y, { align: 'center' });
    y += 3.8;
    doc.text(`Fecha ${transaction?.date ? new Date(transaction.date).toLocaleString('es-NI') : new Date().toLocaleString('es-NI')}`, width / 2, y, { align: 'center' });
    y += 5;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.5);
    doc.text('CLIENTE', margin, y);
    y += 3.3;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.2);
    doc.text(doc.splitTextToSize(String(customerName), contentWidth), margin, y);
    y += countLines(customerName, 7.2) * 3.5 + 2;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.5);
    doc.text(`${linkedDocumentType.toUpperCase()} APLICADO`, margin, y);
    y += 3.3;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.2);
    doc.text(doc.splitTextToSize(linkedDocumentNumber, contentWidth), margin, y);
    y += countLines(linkedDocumentNumber, 7.2) * 3.5 + 3;
    drawRule();
    y += 4;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.5);
    doc.text('DETALLE DEL COBRO', margin, y);
    y += 4;
    methodRows.forEach((row: any) => {
      doc.setFont(fontName, 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text(row.method, margin, y);
      doc.text(money(row.amount, row.currency, row.rate), width - margin, y, { align: 'right' });
      y += 3.5;
      doc.setFont(fontName, 'normal');
      doc.setFontSize(6.2);
      doc.text(`Moneda: ${row.currency} · ${row.reference}${row.bank ? ` · ${row.bank}` : ''}`, margin, y);
      y += countLines(`Moneda: ${row.currency} · ${row.reference}${row.bank ? ` · ${row.bank}` : ''}`, 6.2) * 3.1 + 3;
      drawRule();
      y += 3;
    });
    if (financialRows.length) {
      drawRule();
      y += 4;
      doc.setFont(fontName, 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      doc.text('RESUMEN DEL DOCUMENTO', margin, y);
      y += 4;
      financialRows.forEach(drawFinancialRow);
    }
    drawRow('Monto total', money(financialTotal || documentTotal || voucherTotal, financialTotal ? financialCurrency : linkedCurrency, financialTotal ? financialRate : linkedRate), true);
    drawRow('Este pago', money(voucherTotal, voucherCurrency, voucherRate));
    drawRow('Abonado', money(accumulatedPaid, financialCurrency, financialRate));
    drawRow('Saldo pendiente', money(pendingBalance, financialCurrency, financialRate));
    if (changeAmount > 0.01) drawRow('Cambio / vuelto', money(changeAmount, voucherCurrency, voucherRate));
    y += 2;
    doc.setFont(fontName, 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(`Estado: ${statusLabel}`, width / 2, y, { align: 'center' });
    y += 5;
    if (notes) {
      doc.setFont(fontName, 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      const noteLines = doc.splitTextToSize(`Notas: ${notes}`, contentWidth);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 3.2 + 3;
    }
    drawRule(primary, 0.45);
    y += 4;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(6);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(doc.splitTextToSize(String(settings.footerText || `Documento generado por ${tenantName}`), contentWidth), width / 2, y, { align: 'center' });
    const blob = doc.output('blob');
    if (save) savePdfBlob(blob, `${transaction?.number || 'Pago'}_${format}.pdf`);
    return { doc, blob };
  }

  const { format: paperFormat, orientation } = pdfDesignPaper(settings);
  const doc = new jsPDF({ orientation, unit: 'mm', format: paperFormat });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = Math.max(10, Math.min(24, Number(settings.margins) || 14));
  const rightEdge = pageWidth - margin;
  const paymentHeaderLayout = String(settings.headerLayout || 'split');
  const logoPosition = String(settings.logoPosition || 'left');
  const isBannerHeader = ['banner', 'ribbon', 'corner', 'double-band'].includes(paymentHeaderLayout);
  const isCenteredHeader = ['centered', 'editorial'].includes(paymentHeaderLayout);
  const headerHeight = isCenteredHeader ? 60 : isBannerHeader ? 43 : 40;
  if (isBannerHeader) {
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, pageWidth, headerHeight, 'F');
  }
  const logoSize = logo ? fitPdfImage(doc, logo, Math.min(48, pageWidth * 0.24), isBannerHeader ? 18 : 22) : { width: 0, height: 0 };
  const logoX = logoPosition === 'right' ? rightEdge - logoSize.width : logoPosition === 'center' ? (pageWidth - logoSize.width) / 2 : margin;
  const logoY = isBannerHeader ? 10 : 12;
  if (isCenteredHeader) {
    const centerX = pageWidth / 2;
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', (pageWidth - logoSize.width) / 2, 7, logoSize.width, logoSize.height, undefined, 'FAST');
      } catch {
        // El resto del comprobante debe seguir disponible aunque falle el logo.
      }
    }
    let centeredY = 7 + (logo ? logoSize.height + 5 : 5);
    doc.setFont(fontName, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(isBannerHeader ? 255 : textColor[0], isBannerHeader ? 255 : textColor[1], isBannerHeader ? 255 : textColor[2]);
    doc.text(companyName, centerX, centeredY, { align: 'center' });
    centeredY += 6;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(isBannerHeader ? 235 : 100, isBannerHeader ? 245 : 116, isBannerHeader ? 240 : 139);
    if (settings.slogan) { doc.text(String(settings.slogan), centerX, centeredY, { align: 'center' }); centeredY += 5; }
    if (settings.fiscalInfo) { doc.text(String(settings.fiscalInfo), centerX, centeredY, { align: 'center' }); centeredY += 5; }
    doc.setFont(fontName, 'bold');
    doc.setFontSize(15);
    doc.setTextColor(isBannerHeader ? 255 : primaryColor[0], isBannerHeader ? 255 : primaryColor[1], isBannerHeader ? 255 : primaryColor[2]);
    doc.text('COMPROBANTE DE PAGO', centerX, centeredY + 2, { align: 'center' });
    doc.setFontSize(8.5);
    doc.text(`${operation} · Nº ${transaction?.number || transaction?.id || 'Sin número'}`, centerX, centeredY + 8, { align: 'center' });
    doc.setFont(fontName, 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Fecha ${transaction?.date ? new Date(transaction.date).toLocaleString('es-NI') : new Date().toLocaleString('es-NI')}`, centerX, centeredY + 14, { align: 'center' });
  } else {
    if (logo) {
      try {
        doc.addImage(logo, 'PNG', logoX, logoY, logoSize.width, logoSize.height, undefined, 'FAST');
      } catch {
        // El resto del comprobante debe seguir disponible aunque falle el logo.
      }
    }
    const identityX = logoPosition === 'left' ? logoX + logoSize.width + 6 : logoPosition === 'right' ? rightEdge : pageWidth / 2;
    const identityAlign = logoPosition === 'center' ? 'center' : logoPosition === 'right' ? 'right' : 'left';
    doc.setFont(fontName, 'bold');
    doc.setFontSize(13);
    doc.setTextColor(isBannerHeader ? 255 : textColor[0], isBannerHeader ? 255 : textColor[1], isBannerHeader ? 255 : textColor[2]);
    doc.text(companyName, identityX, logoY + 7, { align: identityAlign as any });
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(isBannerHeader ? 235 : 100, isBannerHeader ? 245 : 116, isBannerHeader ? 240 : 139);
    if (settings.slogan) doc.text(String(settings.slogan), identityX, logoY + 13, { align: identityAlign as any });
    if (settings.fiscalInfo) doc.text(String(settings.fiscalInfo), identityX, logoY + 18, { align: identityAlign as any });
    doc.setFont(fontName, 'bold');
    doc.setFontSize(17);
    doc.setTextColor(isBannerHeader ? 255 : primaryColor[0], isBannerHeader ? 255 : primaryColor[1], isBannerHeader ? 255 : primaryColor[2]);
    doc.text('COMPROBANTE DE PAGO', rightEdge, 24, { align: 'right' });
    doc.setFontSize(9);
    doc.text(operation, rightEdge, 31, { align: 'right' });
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Nº ${transaction?.number || transaction?.id || 'Sin número'}`, rightEdge, 37, { align: 'right' });
    doc.text(`Fecha ${transaction?.date ? new Date(transaction.date).toLocaleString('es-NI') : new Date().toLocaleString('es-NI')}`, rightEdge, 42, { align: 'right' });
  }

  let currentY = Math.max(headerHeight + 8, 52);
  autoTable(doc, {
    startY: currentY,
    body: [
      ['Cliente', transaction?.customer?.name || transaction?.customerName || 'Cliente general'],
      [`${linkedDocumentType} aplicado`, linkedDocumentNumber],
      ['Tipo de cobro', settlementLabel],
      ['Estado', statusLabel],
    ],
    theme: 'plain',
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', textColor: primaryColor }, 1: { cellWidth: 'auto', textColor } },
    styles: { font: fontName, fontSize: 9, cellPadding: 3, overflow: 'linebreak' },
    tableWidth: pageWidth - margin * 2,
  });
  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 30) + 7;
  autoTable(doc, {
    startY: currentY,
    head: [['Método', 'Moneda', 'Referencia / banco', 'Monto']],
    body: methodRows.map((row: any) => [row.method, row.currency, `${row.reference}${row.bank ? ` · ${row.bank}` : ''}`, money(row.amount, row.currency, row.rate)]),
    theme: String(settings.tableLayout || 'standard') === 'minimal' ? 'plain' : ['striped', 'ledger'].includes(String(settings.tableLayout || 'standard')) ? 'striped' : 'grid',
    headStyles: { fillColor: String(settings.tableLayout || 'standard') === 'minimal' ? [248, 250, 252] : primaryColor, textColor: String(settings.tableLayout || 'standard') === 'minimal' ? textColor : 255, fontStyle: 'bold', fontSize: 8, halign: 'center' },
    bodyStyles: { textColor, fontSize: 8 },
    columnStyles: { 0: { cellWidth: 35 }, 1: { cellWidth: 22, halign: 'center' }, 2: { cellWidth: 'auto' }, 3: { cellWidth: 34, halign: 'right' } },
    styles: { font: fontName, cellPadding: String(settings.tableLayout || 'standard') === 'compact' ? 2 : 3.5, overflow: 'linebreak', lineColor, lineWidth: String(settings.tableLayout || 'standard') === 'minimal' ? 0 : 0.2 },
    alternateRowStyles: ['striped', 'ledger', 'accent'].includes(String(settings.tableLayout || 'standard')) ? { fillColor: [248, 250, 252] } : undefined,
    tableWidth: pageWidth - margin * 2,
  });
  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 20) + 7;
  if (financialRows.length) {
    autoTable(doc, {
      startY: currentY,
      body: financialRows.map((row) => [row.label, `${row.negative ? '- ' : ''}${money(row.amount, financialCurrency, financialRate)}`]),
      theme: 'plain',
      columnStyles: { 0: { cellWidth: 58, textColor }, 1: { cellWidth: 'auto', halign: 'right', textColor } },
      styles: { font: fontName, fontSize: 8, cellPadding: 2.2, overflow: 'linebreak' },
      tableWidth: Math.min(95, pageWidth - margin * 2),
      margin: { left: rightEdge - Math.min(95, pageWidth - margin * 2) },
    });
    currentY = ((doc as any).lastAutoTable?.finalY || currentY + financialRows.length * 5) + 5;
  }
  const summaryRows: string[][] = [
    ['Monto total', money(financialTotal || documentTotal || voucherTotal, financialTotal ? financialCurrency : linkedCurrency, financialTotal ? financialRate : linkedRate)],
    ['Este pago', money(voucherTotal, voucherCurrency, voucherRate)],
    ['Abonado', money(accumulatedPaid, financialCurrency, financialRate)],
    ['Saldo pendiente', money(pendingBalance, financialCurrency, financialRate)],
  ];
  if (changeAmount > 0.01) summaryRows.push(['Cambio / vuelto', money(changeAmount, voucherCurrency, voucherRate)]);
  if (currentY + summaryRows.length * 8 + 35 > pageHeight - margin) {
    doc.addPage();
    currentY = margin;
  }
  autoTable(doc, {
    startY: currentY,
    body: summaryRows,
    theme: 'plain',
    columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold', textColor: primaryColor }, 1: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold', textColor } },
    styles: { font: fontName, fontSize: 10, cellPadding: 3, overflow: 'linebreak' },
    tableWidth: Math.min(95, pageWidth - margin * 2),
    margin: { left: rightEdge - Math.min(95, pageWidth - margin * 2) },
  });
  currentY = ((doc as any).lastAutoTable?.finalY || currentY + 25) + 7;
  if (transaction?.notes) {
    doc.setFont(fontName, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text('Notas', margin, currentY);
    doc.setFont(fontName, 'normal');
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(String(transaction.notes), pageWidth - margin * 2), margin, currentY + 5);
  }
  doc.setFont(fontName, 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(String(settings.footerText || `Documento generado por ${tenantName}`), margin, pageHeight - 14);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Estado: ${statusLabel}`, rightEdge, pageHeight - 14, { align: 'right' });
  const blob = doc.output('blob');
  if (save) savePdfBlob(blob, `${transaction?.number || 'Pago'}_${format}.pdf`);
  return { doc, blob };
}

async function generateSalesTicketPDF({
  document: transaction,
  tenantName,
  formatAmount,
  tenantLogo,
  documentType,
  format,
  settings,
  save = true,
}: {
  document: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  documentType: SalesTransactionDocumentType;
  format: 'roll-58' | 'roll-80';
  settings: Record<string, any>;
  save?: boolean;
}) {
  const width = format === 'roll-58' ? 58 : 80;
  const margin = width === 58 ? 3 : 4;
  const contentWidth = width - margin * 2;
  const items = Array.isArray(transaction.items) && transaction.items.length
    ? transaction.items
    : [{ description: transaction.description || 'Sin líneas de detalle', quantity: 1, unitPrice: Number(transaction.total || 0), total: Number(transaction.total || 0) }];
  const additionalChargeLines = getSalesPdfAdditionalCharges(transaction);
  const estimatedItemHeight = items.reduce((height: number, item: any) => {
    const descriptionLines = Math.max(1, Math.ceil(String(item.description || item.name || 'Producto').length / (width === 58 ? 24 : 36)));
    return height + 8 + descriptionLines * 3.6;
  }, 0);
  const notesHeight = transaction.notes ? Math.min(24, Math.max(6, String(transaction.notes).length / (width === 58 ? 20 : 30) * 3.2)) : 0;
  const pageHeight = Math.max(140, 94 + estimatedItemHeight + additionalChargeLines.length * 3.5 + notesHeight);
  const doc = new jsPDF({ unit: 'mm', format: [width, pageHeight], orientation: 'portrait' });
  // Un rollo térmico debe ser monocromático independientemente de la paleta
  // configurada para los documentos normales.
  const primaryColor: PdfRgb = [0, 0, 0];
  const textColor: PdfRgb = [0, 0, 0];
  const lineColor: PdfRgb = [0, 0, 0];
  const selectedFont = String(settings.fontFamily || '').toLowerCase();
  const fontName = selectedFont.includes('serif') ? 'times' : selectedFont.includes('mono') || selectedFont.includes('courier') ? 'courier' : 'helvetica';
  const title = SALES_TRANSACTION_TITLES[documentType];
  const currency = transaction.currency;
  const rate = transaction.exchangeRate;
  const money = (value: unknown) => formatAmount(Number(value || 0), currency, rate);
  const logo = await toGrayscaleImageSource(settings.logoUrl || tenantLogo);
  const logoSize = logo ? fitPdfImage(doc, logo, width - margin * 2, width === 58 ? 16 : 20) : { width: 0, height: 0 };
  let y = margin;

  if (logo) {
    try {
      doc.addImage(logo, 'PNG', (width - logoSize.width) / 2, y, logoSize.width, logoSize.height, undefined, 'FAST');
      y += logoSize.height + 3;
    } catch {
      // Un logo no compatible no debe impedir la descarga del comprobante.
    }
  }

  doc.setFont(fontName, 'bold');
  doc.setFontSize(width === 58 ? 10 : 12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(String(settings.companyName || tenantName || 'Nuestra Empresa'), width / 2, y, { align: 'center' });
  y += 5;
  if (settings.slogan) {
    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(String(settings.slogan), width / 2, y, { align: 'center', maxWidth: contentWidth });
    y += 4;
  }
  if (settings.fiscalInfo) {
    doc.setFontSize(6);
    doc.text(String(settings.fiscalInfo), width / 2, y, { align: 'center', maxWidth: contentWidth });
    y += 4;
  }

  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, y, width - margin, y);
  y += 5;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(width === 58 ? 8.5 : 10);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(title, width / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(7);
  doc.text(`Nº ${transaction.number || transaction.id || 'N/A'}`, width / 2, y, { align: 'center' });
  y += 3.5;
  doc.text(`Fecha ${transaction.date ? new Date(transaction.date).toLocaleDateString('es-NI') : new Date().toLocaleDateString('es-NI')}`, width / 2, y, { align: 'center' });
  y += 5;

  const customerName = transaction.customer?.name || transaction.customerName || 'Cliente general';
  doc.setFont(fontName, 'bold');
  doc.setFontSize(6.5);
  doc.text('CLIENTE', margin, y);
  y += 3.5;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(7.5);
  doc.text(doc.splitTextToSize(String(customerName), contentWidth), margin, y);
  y += 5;
  doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
  doc.line(margin, y, width - margin, y);
  y += 4;

  doc.setFont(fontName, 'bold');
  doc.setFontSize(6.5);
  doc.text('DETALLE', margin, y);
  y += 4;
  items.forEach((item: any) => {
    const description = String(item.description || item.name || 'Producto');
    const descriptionLines = doc.splitTextToSize(description, contentWidth);
    doc.setFont(fontName, 'normal');
    doc.setFontSize(7.5);
    doc.text(descriptionLines, margin, y);
    y += descriptionLines.length * 3.6;
    doc.setFontSize(6.5);
    const quantity = Number(item.quantity || 0);
    const unitPrice = money(item.unitPrice);
    const total = money(item.total);
    doc.text(`${quantity} x ${unitPrice}`, margin, y);
    doc.setFont(fontName, 'bold');
    doc.text(total, width - margin, y, { align: 'right' });
    y += 4.5;
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.line(margin, y, width - margin, y);
    y += 3;
  });

  const drawTotal = (label: string, value: unknown, bold = false) => {
    doc.setFont(fontName, bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 8.5 : 7);
    doc.text(label, margin, y);
    doc.text(money(value), width - margin, y, { align: 'right' });
    y += bold ? 5 : 3.5;
  };
  drawTotal('Subtotal', transaction.subtotal ?? transaction.total);
  if (Number(transaction.discountAmount || 0) > 0) drawTotal('Descuento', -Number(transaction.discountAmount));
  if (Number(transaction.taxAmount || 0) > 0) drawTotal('IVA', transaction.taxAmount);
  additionalChargeLines.forEach((charge) => drawTotal(charge.label, charge.amount));
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.55);
  doc.line(margin, y, width - margin, y);
  y += 5;
  drawTotal('TOTAL', transaction.total, true);

  if (transaction.notes) {
    y += 2;
    doc.setFont(fontName, 'normal');
    doc.setFontSize(6.5);
    doc.text(doc.splitTextToSize(`Notas: ${transaction.notes}`, contentWidth), margin, y);
    y += notesHeight;
  }
  y += 4;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(6);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(String(settings.footerText || `Documento generado por ${tenantName}`), width / 2, y, { align: 'center', maxWidth: contentWidth });

  const blob = doc.output('blob');
  if (save) savePdfBlob(blob, `${transaction.number || 'Documento'}_${format}.pdf`);
  return { doc, blob };
}

function writePdfPreviewLoadingPage(previewWindow: Window, title: string) {
  previewWindow.document.write(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#111827;color:#f8fafc;font-family:Segoe UI,Arial,sans-serif">
  <p style="padding:24px;text-align:center">Preparando la previsualización…</p>
</body>
</html>`);
  previewWindow.document.close();
}

/** Genera el PDF con la configuración guardada y lo abre en el visor nativo del navegador. */
export async function previewSalesTransactionPDF({
  document: transaction,
  tenantName,
  formatAmount,
  tenantLogo,
  documentType = 'estimate',
  format = 'configured',
}: {
  document: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  documentType?: SalesTransactionDocumentType;
  format?: PdfDownloadFormat;
}) {
  const title = SALES_TRANSACTION_TITLES[documentType];
  const previewWindow = window.open('', '_blank', 'width=1000,height=850');
  if (!previewWindow) {
    throw new Error('No se pudo abrir la previsualización. Habilita las ventanas emergentes para NovaHub.');
  }

  writePdfPreviewLoadingPage(previewWindow, title);
  try {
    const { blob } = await generateSalesTransactionPDF({
      document: transaction,
      tenantName,
      formatAmount,
      tenantLogo,
      documentType,
      format,
      save: false,
    });
    const previewUrl = URL.createObjectURL(blob);
    previewWindow.location.href = previewUrl;
    // El visor necesita conservar el Blob mientras el usuario decide si lo descarga.
    window.setTimeout(() => URL.revokeObjectURL(previewUrl), 10 * 60 * 1000);
    return { blob, previewUrl };
  } catch (error) {
    previewWindow.close();
    throw error;
  }
}

export async function generateSalesTransactionPDF({
  document: transaction,
  tenantName,
  formatAmount,
  tenantLogo,
  documentType = 'estimate',
  format = 'configured',
  save = true,
  designOverride,
}: {
  document: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  tenantLogo?: string;
  documentType?: SalesTransactionDocumentType;
  format?: PdfDownloadFormat;
  save?: boolean;
  designOverride?: any;
}) {
  const target = getPdfTemplateTarget(documentType).key;
  const design = designOverride || await pdfDocumentDesignService.active(target).catch(() => null);
  if (documentType === 'payment') {
    const paymentDesign = format === 'configured' ? design : withPdfDownloadFormat(design, format);
    return generateSalesPaymentVoucherPDF({
      document: transaction,
      tenantName,
      formatAmount,
      tenantLogo,
      format,
      settings: paymentDesign?.settings || {},
      save,
    });
  }
  if (format === 'roll-58' || format === 'roll-80') {
    return generateSalesTicketPDF({ document: transaction, tenantName, formatAmount, tenantLogo, documentType, format, settings: design?.settings || {}, save });
  }
  return generateEstimatePDF({
    estimate: transaction,
    tenantName,
    formatAmount: formatAmount as any,
    tenantLogo,
    documentType,
    save,
    designOverride: withPdfDownloadFormat(design, format),
  });
}

export const generateSupplierHistoryPDF = async ({ supplier, items, tenantName, formatAmount, tenantLogo }: any) => {
  const settings = await getPdfDesignSettings('compras.supplier-history');
  const doc = new jsPDF(pdfDesignPaper(settings));
  
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);
  
  let titleY = 25;
  if (tenantLogo) {
    try {
      doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
      titleY = 38;
      doc.setFontSize(14);
    } catch (error) {
      doc.setFontSize(22);
    }
  } else {
    doc.setFontSize(22);
  }
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Historial de Compras (Productos y Servicios)', 14, titleY + 7);
  
  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('HISTORIAL', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Proveedor: ${supplier.name || 'N/A'}`, 196, 32, { align: 'right' });
  doc.text(`Fecha Emisión: ${new Date().toLocaleDateString()}`, 196, 38, { align: 'right' });
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 46, 196, 46);

  const tableData = items.map((item: any) => [
    item.date,
    item.type,
    item.docNumber,
    item.description || 'N/A',
    Number(item.quantity).toString(),
    formatAmount(Number(item.unitPrice), item.currency, item.exchangeRate),
    formatAmount(Number(item.total), item.currency, item.exchangeRate)
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Fecha', 'Tipo', 'Documento', 'Descripción', 'Cant.', 'Precio U.', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: textColor, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 'auto', halign: 'left' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: 3 }
  });

  const pageHeight = doc.internal.pageSize.height;
  
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Compras`, 14, pageHeight - 10);

  doc.save(`Historial_${supplier.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateExpensePDF = async ({
  expense,
  tenantName,
  formatAmount,
  targetKey = 'compras.expense',
}: {
  expense: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
  targetKey?: string;
}) => {
  const settings = await getPdfDesignSettings(targetKey);
  const doc = new jsPDF(pdfDesignPaper(settings));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Comprobante de Gasto', 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${expense.number || expense.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Fecha: ${expense.date ? new Date(expense.date).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Hora: ${expense.time || (expense.date ? new Date(expense.date).toLocaleTimeString() : 'N/A')}`, 196, 34, { align: 'right' });

  autoTable(doc, {
    startY: 45,
    head: [['Campo', 'Detalle']],
    body: [
      ['Descripción', expense.description || '-'],
      ['Categoría', expense.category === 'OTRO' ? (expense.categoryCustom || 'OTRO') : (expense.category || '-')],
      ['Monto', formatAmount(Number(expense.amount || 0), expense.currency, expense.exchangeRate)],
      ['Pagado a', expense.paidTo || '-'],
      ['Cuenta de origen', expense.paymentSource || '-'],
      ['Referencia', expense.reference || '-'],
      ['Estado', expense.status || '-'],
      ['Evidencia', expense.evidenceFileName || 'No adjunta'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak', lineWidth: 0.2, lineColor: [203, 213, 225] },
    tableLineWidth: 0.2,
    tableLineColor: [203, 213, 225],
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Compras`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${expense.number || expense.id || 'gasto'}.pdf`);
};

export const generatePurchaseOrderPDF = async ({
  order,
  tenantName,
  formatAmount,
}: {
  order: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
}) => {
  const settings = await getPdfDesignSettings('compras.purchase-order');
  const doc = new jsPDF(pdfDesignPaper(settings));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Orden de Compra', 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${order.number || order.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Fecha: ${order.date ? new Date(order.date).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Entrega: ${order.expectedDelivery ? new Date(order.expectedDelivery).toLocaleDateString() : 'N/A'}`, 196, 34, { align: 'right' });
  const orderStatusLabels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING: 'Pendiente',
    APPROVED: 'Aprobada',
    CANCELLED: 'Anulada',
  };
  const orderStatus = orderStatusLabels[String(order.status || '').toUpperCase()] || order.status || 'Sin estado';
  const orderOrigin = order.purchaseRequestNumber || order.purchaseRequestId
    ? `Desde solicitud de compra${order.purchaseRequestNumber ? ` ${order.purchaseRequestNumber}` : ''}`
    : 'Orden creada directamente';

  autoTable(doc, {
    startY: 45,
    head: [['Campo', 'Detalle']],
    body: [
      ['Proveedor', order.supplier?.name || '-'],
      ['Dirección', order.address || '-'],
      ['Estado', orderStatus],
      ['Origen', orderOrigin],
      ['Moneda', order.currency || '-'],
      ['Evidencia', order.evidenceFileName || 'No adjunta'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
  });

  const itemsRows = (order.items || []).map((item: any) => [
    item.code || '-',
    item.name || item.description || '-',
    item.category || '-',
    item.stockApplies ? Number(item.stock || 0).toString() : '-',
    Number(item.quantity || 0).toString(),
    formatAmount(Number(item.unitPrice || 0), order.currency, order.exchangeRate),
    formatAmount(Number(item.total || 0), order.currency, order.exchangeRate),
  ]);

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 45) + 8,
    head: [['Código', 'Nombre', 'Categoría', 'Stock', 'Cant.', 'Precio U.', 'Total']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'left' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 25, halign: 'left' },
      3: { cellWidth: 15, halign: 'right' },
      4: { cellWidth: 15, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
      6: { cellWidth: 25, halign: 'right' },
    },
    styles: { cellPadding: 3, overflow: 'linebreak', lineWidth: 0.2, lineColor: [203, 213, 225] },
    tableLineWidth: 0.2,
    tableLineColor: [203, 213, 225],
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const baseY = ((doc as any).lastAutoTable?.finalY || 140) + 10;
  const labelX = 140;
  const valueX = 196;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Subtotal:', labelX, baseY);
  doc.text(formatAmount(Number(order.subtotal || 0), order.currency, order.exchangeRate), valueX, baseY, { align: 'right' });
  doc.text(`IVA (${Number(order.taxRate || 0)}%):`, labelX, baseY + 7);
  doc.text(formatAmount(Number(order.taxAmount || 0), order.currency, order.exchangeRate), valueX, baseY + 7, { align: 'right' });
  doc.text(`Retención IR (${Number(order.withholdingRate || 0)}%):`, labelX, baseY + 14);
  doc.text(`-${formatAmount(Number(order.withholdingAmount || 0), order.currency, order.exchangeRate)}`, valueX, baseY + 14, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, baseY + 19, valueX, baseY + 19);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, baseY + 25);
  doc.text(formatAmount(Number(order.total || 0), order.currency, order.exchangeRate), valueX, baseY + 25, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Compras`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${order.number || order.id || 'orden_compra'}.pdf`);
};

export const generatePurchaseRequestPDF = async ({
  request,
  tenantName,
  formatAmount,
}: {
  request: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
}) => {
  const settings = await getPdfDesignSettings('compras.purchase-request');
  const doc = new jsPDF(pdfDesignPaper(settings));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);
  const statusLabels: Record<string, string> = {
    PENDING_APPROVAL: 'Pendiente',
    APPROVED: 'Aprobada',
    CANCELLED: 'Anulada',
  };
  const rawStatus = String(request.status || 'PENDING_APPROVAL').toUpperCase();
  const status = statusLabels[rawStatus] || (['REJECTED'].includes(rawStatus) ? 'Anulada' : 'Pendiente');
  const management = request.management?.[0];

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Solicitud de Compra', 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${request.number || request.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Fecha: ${request.date ? new Date(request.date).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Estado: ${status}`, 196, 34, { align: 'right' });

  autoTable(doc, {
    startY: 45,
    head: [['Campo', 'Detalle']],
    body: [
      ['Solicitante', request.requestedBy ? `${request.requestedBy.firstName || ''} ${request.requestedBy.lastName || ''}`.trim() : '-'],
      ['Bodega', request.warehouse?.name || '-'],
      ['Prioridad', request.priority || '-'],
      ['Fecha requerida', request.requiredDate ? new Date(request.requiredDate).toLocaleDateString() : '-'],
      ['Justificación', request.justification || '-'],
      ['Moneda de origen', management?.currency || '-'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
  });

  const itemsRows = (request.items || []).map((item: any) => {
    const managementItem = (management?.items || []).find((candidate: any) => (
      (candidate.productId && item.productId && candidate.productId === item.productId)
      || (candidate.description && item.description && candidate.description === item.description)
    ));
    return [
      item.product?.code || item.productId?.slice?.(0, 8) || '-',
      item.description || '-',
      Number(item.quantity || 0).toString(),
      Number(item.currentStock || 0).toString(),
      managementItem ? formatAmount(Number(managementItem.total || 0), management.currency, management.exchangeRate) : '-',
    ];
  });

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 45) + 8,
    head: [['Código', 'Descripción', 'Cantidad', 'Stock', 'Total']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 32, halign: 'right' },
    },
    styles: { cellPadding: 3, overflow: 'linebreak', lineWidth: 0.2, lineColor: [203, 213, 225] },
    tableLineWidth: 0.2,
    tableLineColor: [203, 213, 225],
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  if (request.notes) {
    const notesY = ((doc as any).lastAutoTable?.finalY || 140) + 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.text(`Notas: ${request.notes}`, 14, notesY, { maxWidth: 180 });
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName || 'Nova Hub'} - Módulo de Compras`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${request.number || request.id || 'solicitud_compra'}.pdf`);
};

export const generateRecurringInvoicePDF = async ({
  recurringInvoice,
  tenantName,
  formatAmount,
}: {
  recurringInvoice: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
}) => {
  const settings = await getPdfDesignSettings('ventas.recurring');
  const doc = new jsPDF(pdfDesignPaper(settings));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Factura Recurrente', 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${recurringInvoice.number || recurringInvoice.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Inicio: ${recurringInvoice.startDate ? new Date(recurringInvoice.startDate).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Próxima: ${recurringInvoice.nextInvoiceDate ? new Date(recurringInvoice.nextInvoiceDate).toLocaleDateString() : 'N/A'}`, 196, 34, { align: 'right' });

  const frequencyMap: Record<string, string> = {
    WEEKLY: 'Semanal',
    MONTHLY: 'Mensual',
    QUARTERLY: 'Trimestral',
    YEARLY: 'Anual',
  };
  const freqLabel = frequencyMap[String(recurringInvoice.frequency || '').toUpperCase()] || recurringInvoice.frequency || '-';

  autoTable(doc, {
    startY: 45,
    head: [['Campo', 'Detalle']],
    body: [
      ['Cliente', recurringInvoice.customer?.name || '-'],
      ['Frecuencia', freqLabel],
      ['Estado', String(recurringInvoice.status || '-').toUpperCase()],
      ['Moneda', recurringInvoice.currency || '-'],
      ['Fin', recurringInvoice.endDate ? new Date(recurringInvoice.endDate).toLocaleDateString() : 'Sin fin'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak', lineWidth: 0.2, lineColor: [203, 213, 225] },
    tableLineWidth: 0.2,
    tableLineColor: [203, 213, 225],
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const itemsRows = (recurringInvoice.items || []).map((item: any) => [
    String(item.itemType || (item.productId ? 'PRODUCT' : 'SERVICE')).toUpperCase() === 'SERVICE' ? 'Servicio' : 'Producto',
    item.description || item.serviceName || '-',
    Number(item.quantity || 0).toString(),
    formatAmount(Number(item.unitPrice || 0), recurringInvoice.currency, recurringInvoice.exchangeRate),
    formatAmount(Number(item.total || 0), recurringInvoice.currency, recurringInvoice.exchangeRate),
  ]);

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 45) + 8,
    head: [['Tipo', 'Concepto', 'Cant.', 'Precio U.', 'Total']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 24, halign: 'left' },
      1: { cellWidth: 'auto', halign: 'left' },
      2: { cellWidth: 16, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    styles: { cellPadding: 3, overflow: 'linebreak', lineWidth: 0.2, lineColor: [203, 213, 225] },
    tableLineWidth: 0.2,
    tableLineColor: [203, 213, 225],
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const baseY = ((doc as any).lastAutoTable?.finalY || 140) + 10;
  const labelX = 140;
  const valueX = 196;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Subtotal:', labelX, baseY);
  doc.text(formatAmount(Number(recurringInvoice.subtotal || 0), recurringInvoice.currency, recurringInvoice.exchangeRate), valueX, baseY, { align: 'right' });
  doc.text('Impuestos:', labelX, baseY + 7);
  doc.text(formatAmount(Number(recurringInvoice.taxAmount || 0), recurringInvoice.currency, recurringInvoice.exchangeRate), valueX, baseY + 7, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, baseY + 12, valueX, baseY + 12);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL CICLO:', labelX, baseY + 18);
  doc.text(formatAmount(Number(recurringInvoice.total || 0), recurringInvoice.currency, recurringInvoice.exchangeRate), valueX, baseY + 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Ventas`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${recurringInvoice.number || recurringInvoice.id || 'factura_recurrente'}.pdf`);
};

export const generateSupplierInvoicePDF = async ({
  invoice,
  tenantName,
  formatAmount,
}: {
  invoice: any;
  tenantName: string;
  formatAmount: (amount: number, currency?: string, rate?: number) => string;
}) => {
  const settings = await getPdfDesignSettings('compras.supplier-invoice');
  const doc = new jsPDF(pdfDesignPaper(settings));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);

  doc.setFontSize(20);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nova Hub', 14, 22);

  doc.setFontSize(12);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Factura de Proveedor', 14, 30);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`N°: ${invoice.number || invoice.id || 'N/A'}`, 196, 22, { align: 'right' });
  doc.text(`Emisión: ${invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}`, 196, 28, { align: 'right' });
  doc.text(`Vence: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}`, 196, 34, { align: 'right' });

  autoTable(doc, {
    startY: 45,
    head: [['Campo', 'Detalle']],
    body: [
      ['Proveedor', invoice.supplier?.name || '-'],
      ['Estado', invoice.status || '-'],
      ['Moneda', invoice.currency || '-'],
      ['Notas', invoice.notes || '-'],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold' },
    bodyStyles: { textColor },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
    styles: { fontSize: 10, cellPadding: 4, overflow: 'linebreak' },
  });

  const itemsRows = (invoice.items || []).map((item: any) => [
    item.description || '-',
    Number(item.quantity || 0).toString(),
    formatAmount(Number(item.unitPrice || 0), invoice.currency, invoice.exchangeRate),
    `${Number(item.taxRate || 0).toFixed(2)}%`,
    formatAmount(Number(item.total || 0), invoice.currency, invoice.exchangeRate),
  ]);

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 45) + 8,
    head: [['Descripción', 'Cant.', 'Precio U.', 'Imp. %', 'Total']],
    body: itemsRows.length > 0 ? itemsRows : [['-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 18, halign: 'right' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    styles: { cellPadding: 3, overflow: 'linebreak' },
  });

  const baseY = ((doc as any).lastAutoTable?.finalY || 140) + 10;
  const labelX = 140;
  const valueX = 196;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Subtotal:', labelX, baseY);
  doc.text(formatAmount(Number(invoice.subtotal || 0), invoice.currency, invoice.exchangeRate), valueX, baseY, { align: 'right' });
  doc.text('Impuesto:', labelX, baseY + 7);
  doc.text(formatAmount(Number(invoice.taxAmount || 0), invoice.currency, invoice.exchangeRate), valueX, baseY + 7, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(labelX, baseY + 12, valueX, baseY + 12);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, baseY + 18);
  doc.text(formatAmount(Number(invoice.total || 0), invoice.currency, invoice.exchangeRate), valueX, baseY + 18, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Compras`, 14, doc.internal.pageSize.height - 10);

  doc.save(`${invoice.number || invoice.id || 'factura_proveedor'}.pdf`);
};

export const generateSessionSummaryPDF = async ({
  session,
  logs,
  tenantName,
  tenantLogo,
  displayCurrency,
  isUSD,
  sessionRate,
  totals,
  hideSystemAmounts = false,
}: {
  session: any;
  logs: any[];
  tenantName: string;
  tenantLogo?: string;
  displayCurrency: string;
  isUSD: boolean;
  sessionRate: number;
  totals: {
    fondoInicial: number;
    ventas: number;
    gastos: number;
    esperado: number;
    contado: number;
    diferencia: number;
    hideSystemAmounts?: boolean;
  }
  hideSystemAmounts?: boolean;
}) => {
  const settings = await getPdfDesignSettings('ventas.cash-session');
  const doc = new jsPDF(pdfDesignPaper(settings));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);
  const symbol = isUSD ? '$' : 'C$';

  let titleY = 25;
  if (tenantLogo) {
    try {
      doc.addImage(tenantLogo, 'PNG', 14, 15, 30, 15);
      titleY = 38;
      doc.setFontSize(14);
    } catch (error) {
      doc.setFontSize(22);
    }
  } else {
    doc.setFontSize(22);
  }
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(tenantName || 'Nuestra Empresa', 14, titleY);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Resumen de Turno (Caja)', 14, titleY + 7);
  
  doc.setFontSize(18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('ARQUEO DE CAJA', 196, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sesión iniciada: ${new Date(session.openedAt).toLocaleString()}`, 196, 32, { align: 'right' });
  doc.text(`Generado: ${new Date().toLocaleString()}`, 196, 38, { align: 'right' });
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 46, 196, 46);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Resumen Financiero', 14, 55);

  autoTable(doc, {
    startY: 60,
    head: [['Concepto', `Monto (${displayCurrency})`]],
    body: hideSystemAmounts ? [
      ['Efectivo Contado', `${symbol} ${totals.contado.toFixed(2)}`],
    ] : [
      ['Fondo Inicial', `${symbol} ${totals.fondoInicial.toFixed(2)}`],
      ['Ventas Totales', `${symbol} ${totals.ventas.toFixed(2)}`],
      ['Gastos Registrados', `${symbol} ${totals.gastos.toFixed(2)}`],
      ['Saldo Esperado', `${symbol} ${totals.esperado.toFixed(2)}`],
      ['Efectivo Contado', `${symbol} ${totals.contado.toFixed(2)}`],
      ['Diferencia', `${symbol} ${totals.diferencia.toFixed(2)}`],
    ],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 9, fontStyle: 'bold' },
    bodyStyles: { textColor: textColor, fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 'auto', halign: 'right' }
    },
    styles: { cellPadding: 3, overflow: 'linebreak' }
  });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Transacciones del Turno', 14, (doc as any).lastAutoTable.finalY + 10);

  const tableData = logs.map((log: any) => {
    const logNIO = Number(log.amountNIO || 0);
    const logUSD = Number(log.amountUSD || 0);
    const logConverted = isUSD ? (logUSD + (logNIO / sessionRate)) : (logNIO + (logUSD * sessionRate));
    const sign = log.type === 'EXIT' ? '-' : '+';
    
    const row = [
      log.reference || (log.type === 'SALE' ? 'TKT-' + log.id.slice(0,4).toUpperCase() : 'GST-' + log.id.slice(0,4).toUpperCase()),
      log.type === 'SALE' ? 'VENTA' : log.type === 'EXIT' ? 'GASTO' : log.type === 'ENTRY' ? 'ENTRADA' : log.type === 'OPEN' ? 'APERTURA' : log.type,
      log.description || 'N/A',
      new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      `${sign}${symbol} ${logConverted.toFixed(2)}`
    ];
    return hideSystemAmounts ? row.slice(0, 4) : row;
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 15,
    head: [hideSystemAmounts ? ['Ref / Ticket', 'Tipo', 'Descripción', 'Hora'] : ['Ref / Ticket', 'Tipo', 'Descripción', 'Hora', `Monto (${displayCurrency})`]],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { textColor: textColor, fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 25, halign: 'center' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 'auto', halign: 'left' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'right' }
    },
    styles: { overflow: 'linebreak', cellPadding: 3 }
  });

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text(`Generado por ${tenantName} - Módulo de Caja POS`, 14, pageHeight - 10);

  doc.save(`Arqueo_Caja_${new Date().getTime()}.pdf`);
};

export const generateHistoricalCashReportPDF = async ({
  report,
  tenantName,
}: {
  report: { summary: any; items: any[]; filters?: any };
  tenantName: string;
}) => {
  const settings = await getPdfDesignSettings('ventas.cash-historical-report');
  const doc = new jsPDF(pdfDesignPaper({ ...settings, orientation: 'landscape' }));
  const primaryColor = pdfDesignColor(settings.primaryColor, [16, 185, 129]);
  const textColor = pdfDesignColor(settings.textColor, [51, 65, 85]);
  const summary = report.summary || {};
  const money = (value: any) => Number(value || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(tenantName || 'Nuestra Empresa', 14, 18);
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.setFontSize(14);
  doc.text('REPORTE HISTÓRICO DE CAJA', 14, 27);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const reportDate = (value: any) => value ? String(value).slice(0, 10) : '—';
  doc.text(`Periodo: ${reportDate(report.filters?.dateFrom)} al ${reportDate(report.filters?.dateTo)}`, 14, 34);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 283, 18, { align: 'right' });

  autoTable(doc, {
    startY: 42,
    head: [['Sesiones', 'Cerradas', 'Ventas NIO', 'Ventas USD', 'Diferencia NIO', 'Depósitos NIO']],
    body: [[
      String(summary.sessions || 0),
      String(summary.closedSessions || 0),
      `C$ ${money(summary.salesNIO)}`,
      `$ ${money(summary.salesUSD)}`,
      `C$ ${money(summary.differenceNIO)}`,
      `C$ ${money(summary.depositsNIO)}`,
    ]],
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { textColor, fontSize: 9 },
    styles: { cellPadding: 3, halign: 'center' },
  });

  const paymentRows = Object.entries(summary.byPaymentMethod || {}).map(([method, value]: [string, any]) => [
    method === 'CASH' ? 'Efectivo' : method === 'CARD' ? 'Tarjeta' : method === 'TRANSFER' ? 'Transferencia' : method === 'CHECK' ? 'Cheque' : 'Otro',
    String(value.count || 0),
    `C$ ${money(value.amountNIO)}`,
    `$ ${money(value.amountUSD)}`,
  ]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Forma de pago', 'Operaciones', 'Monto NIO', 'Monto USD']],
    body: paymentRows,
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { textColor, fontSize: 8 },
    styles: { cellPadding: 2.5 },
  });

  const sessionRows = (report.items || []).map((item: any) => [
    new Date(item.date).toLocaleDateString(),
    item.branch?.name || 'Sin sucursal',
    item.register ? `${item.register.code} · ${item.register.name}` : 'Sin caja',
    item.openedBy?.name || '—',
    item.status === 'CLOSED' ? 'CERRADA' : item.status === 'COUNTING' ? 'EN ARQUEO' : 'ABIERTA',
    String(item.saleCount || 0),
    `C$ ${money(item.salesNIO)}`,
    `$ ${money(item.salesUSD)}`,
    `C$ ${money(item.differenceNIO)}`,
    `C$ ${money(item.depositNIO)}`,
  ]);
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [['Fecha', 'Sucursal', 'Caja', 'Cajero', 'Estado', 'Ventas', 'Ventas NIO', 'Ventas USD', 'Dif. NIO', 'Depósito NIO']],
    body: sessionRows,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: 255, fontSize: 7, fontStyle: 'bold' },
    bodyStyles: { textColor, fontSize: 7 },
    styles: { cellPadding: 2, overflow: 'linebreak' },
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generado por ${tenantName || 'NovaHub'} - Reporte histórico de Caja`, 14, doc.internal.pageSize.height - 10);
  doc.save(`Reporte_Historico_Caja_${new Date().getTime()}.pdf`);
};
