import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { pdfDocumentDesignService } from '../services/pdf-document-design.service';
import { getPdfTemplateTarget } from '../services/pdf-document-catalog';
import { sanitizeHtml2CanvasOklch } from './export-utils';

type PdfRgb = [number, number, number];

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
  return {
    format: settings.paperSize === 'A4' ? 'a4' : settings.paperSize === 'LEGAL' ? 'legal' : 'letter',
    orientation: settings.orientation === 'landscape' ? 'landscape' : 'portrait',
  } as const;
}

function htmlSafeColor(value: unknown, fallback: string) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const color = value.trim();
  return /oklch\(|oklab\(|color\(|lch\(|lab\(/i.test(color) ? fallback : color;
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

function htmlFieldStyle(field: any) {
  return `position:absolute;left:${Number(field.x) || 0}%;top:${Number(field.y) || 0}%;width:${Number(field.width) || 30}%;min-height:${Number(field.height) || 7}%;`;
}

async function generateHtmlTemplatePdf({ savedDesign, estimate, tenantName, formatAmount, tenantLogo, documentType, save }: { savedDesign: any; estimate: any; tenantName: string; formatAmount: (amount: number, currency: string, rate: number) => string; tenantLogo?: string; documentType: string; save: boolean }): Promise<{ doc: jsPDF; blob: Blob }> {
  const design = savedDesign.settings || {};
  const fields = Array.isArray(savedDesign.layoutZones?.fields) ? savedDesign.layoutZones.fields : [];
  const field = (id: string, fallback: any) => fields.find((item: any) => item.id === id) || { id, x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height, enabled: true };
  const titleMap: Record<string, string> = { estimate: 'COTIZACIÓN', order: 'ORDEN DE VENTA', invoice: 'FACTURA', recurring: 'FACTURA RECURRENTE', payment: 'PAGO RECIBIDO', return: 'DEVOLUCIÓN', 'credit-note': 'NOTA DE CRÉDITO' };
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
  const pageWidthPx = design.orientation === 'landscape' ? 1123 : 794;
  const pageHeightPx = design.orientation === 'landscape' ? 794 : 1123;
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
  const headerBackground = bannerHeader ? primary : '#fff';
  const headerBorder = bannerHeader ? 'none' : `1px solid ${line}`;
  const logoSource = design.logoUrl || tenantLogo;
  const logo = logoSource ? `<img src="${escapeHtml(logoSource)}" style="position:absolute;left:${design.logoPosition === 'right' ? '78%' : design.logoPosition === 'center' ? '42%' : '8%'};top:5%;width:${Math.min(Number(design.logoSize) || 34, 70) / 2}%;max-height:9%;object-fit:contain;" />` : '';
  const pageHtml = `<div id="pdf-template-canvas" style="position:relative;width:${pageWidthPx}px;height:${pageHeightPx}px;overflow:hidden;background:#fff;color:${text};font-family:${escapeHtml(design.fontFamily || 'Arial')};font-size:${Number(design.fontSize) || 9}px;box-sizing:border-box;">
    <div style="position:absolute;inset:0 0 auto;height:29%;background:${headerBackground};border-bottom:${headerBorder};${headerLayout === 'double-band' ? `border-bottom:10px solid ${line};` : ''}${headerLayout === 'sidebar' ? `border-left:10px solid ${primary};` : ''}${headerLayout === 'boxed' ? `inset:2%;height:25%;border:1px solid ${line};border-radius:10px;` : ''}"></div>${design.watermark ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.1;transform:rotate(-25deg);font-size:64px;font-weight:800;color:#64748b;">${escapeHtml(design.watermark)}</div>` : ''}${logo}
    ${zone('company', `<strong>${escapeHtml(values.company)}</strong>`)}
    ${zone('slogan', `<span style="opacity:.75">${escapeHtml(values.slogan)}</span>`, 'font-size:.78em;')}
    ${zone('fiscal', `<span style="opacity:.75;white-space:pre-line">${escapeHtml(values.fiscal)}</span>`, 'font-size:.72em;')}
    ${zone('documentTitle', `<strong>${escapeHtml(values.documentTitle)}</strong>`, `text-align:right;font-size:1.35em;font-weight:800;`)}
    ${zone('documentNumber', `Nº: ${escapeHtml(values.documentNumber)}`, 'text-align:right;font-size:.82em;')}
    ${zone('date', `Fecha: ${escapeHtml(values.date)}`, 'text-align:right;font-size:.82em;')}
    ${zone('customer', `<strong style="display:block;color:${primary};font-size:.78em;text-transform:uppercase;">Preparado para</strong><span>${escapeHtml(values.customer)}</span>`)}
    ${zone('address', escapeHtml(values.address), 'font-size:.78em;opacity:.75;')}
    ${zone('phone', escapeHtml(values.phone), 'font-size:.78em;opacity:.75;')}
    ${zone('email', escapeHtml(values.email), 'font-size:.78em;opacity:.75;')}
    ${zone('items', `<div style="overflow:hidden;border:${tableBorder};border-radius:${tableLayout === 'cards' ? 0 : 5}px;font-size:.78em;"><div style="display:grid;grid-template-columns:1fr 12% 18% 18%;gap:4px;padding:${tableLayout === 'compact' ? 6 : 9}px;background:${tableHeaderBackground};color:${tableHeaderColor};font-weight:700;"><span>Descripción</span><span>Cant.</span><span>Precio</span><span>Total</span></div>${rows}</div>`, 'padding:0;')}
    ${zone('totals', `<div style="font-size:.78em;text-align:right;"><div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${escapeHtml(formatAmount(Number(estimate.subtotal || 0), estimate.currency, estimate.exchangeRate))}</span></div><div style="display:flex;justify-content:space-between;"><span>Impuesto</span><span>${escapeHtml(formatAmount(Number(estimate.taxAmount || 0), estimate.currency, estimate.exchangeRate))}</span></div><div style="display:flex;justify-content:space-between;border-top:1px solid ${line};padding-top:4px;color:${primary};font-weight:700;"><span>TOTAL</span><span>${escapeHtml(total)}</span></div></div>`)}
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
    const format = design.paperSize === 'A4' ? 'a4' : design.paperSize === 'LEGAL' ? 'legal' : 'letter';
    const orientation = design.orientation === 'landscape' ? 'landscape' : 'portrait';
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
  if (savedDesign?.engine === 'HTML_TEMPLATE' || savedDesign?.sourceType === 'UPLOADED_PDF') {
    return generateHtmlTemplatePdf({ savedDesign, estimate, tenantName, formatAmount, tenantLogo, documentType, save });
  }
  // Las plantillas cargadas se exportan con el mismo motor HTML-estructurado
  // que la vista previa. El PDF original queda como referencia, no como fondo
  // para evitar duplicar textos y datos dinámicos.
  const design: any = savedDesign?.settings || {};
  const format = design.paperSize === 'A4' ? 'a4' : design.paperSize === 'LEGAL' ? 'legal' : 'letter';
  const orientation = design.orientation === 'landscape' ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format });
  
  // 1. Configuraciones iniciales y estilos base
  const primaryColor = pdfHexToRgb(design.primaryColor, [16, 185, 129]);
  const textColor = pdfHexToRgb(design.textColor, [51, 65, 85]);
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
  const logoWidth = Math.max(18, Math.min(70, Number(design.logoSize) || 30));
  const logoHeight = logoWidth * 0.5;
  const designLogo = design.logoUrl || tenantLogo;
  const headerLayout = design.headerLayout || 'split';
  const tableLayout = design.tableLayout || 'standard';
  const isBannerHeader = ['banner', 'ribbon', 'corner', 'double-band'].includes(headerLayout);
  const headerTextColor: PdfRgb = isBannerHeader ? [255, 255, 255] : textColor;
  const headerHeight = headerLayout === 'compact' ? 42 : isBannerHeader ? 46 : 52;
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
  
  // 2. Head - Top Left (Logo y Nombre de la Institución/Tenant)
  let titleY = 25;
  const logoX = logoPosition === 'center' ? (pageWidth - logoWidth) / 2 : logoPosition === 'right' ? rightEdge - logoWidth : margin;
  if (designLogo) {
    try {
      doc.addImage(designLogo, 'PNG', logoX, 15, logoWidth, logoHeight);
      titleY = 15 + logoHeight + 8;
      doc.setFontSize(14); // Texto más pequeño si existe un logo
    } catch (error) {
      console.warn('No se pudo incrustar el logo en el PDF', error);
      doc.setFontSize(22);
    }
  } else {
    doc.setFontSize(22);
  }
  doc.setTextColor(companyHeaderColor[0], companyHeaderColor[1], companyHeaderColor[2]);
  doc.setFont(fontName, 'bold');
  // Representación del Nombre de la Empresa en el encabezado izquierdo
  if (companyDisplayName) doc.text(companyDisplayName, logoPosition === 'right' ? rightEdge : margin, titleY, { align: logoPosition === 'right' ? 'right' : 'left' });
  
  // Subtítulo / Identificadores de Empresa
  doc.setFontSize(10);
  doc.setTextColor(isBannerHeader ? 235 : 100, isBannerHeader ? 245 : 116, isBannerHeader ? 240 : 139);
  doc.setFont(fontName, 'normal');
  if (design.slogan) doc.text(String(design.slogan), margin, titleY + 5);
  if (design.fiscalInfo) doc.text(String(design.fiscalInfo), margin, titleY + 10);
  let docTypeStr = 'Cotización de Venta';
  if (documentType === 'order') docTypeStr = 'Orden de Venta';
  else if (documentType === 'invoice') docTypeStr = 'Factura';
  else if (documentType === 'recurring') docTypeStr = 'Factura Recurrente';
  else if (documentType === 'payment') docTypeStr = 'Comprobante de Pago';
  else if (documentType === 'return') docTypeStr = 'Devolución de Venta';
  else if (documentType === 'credit-note') docTypeStr = 'Nota de Crédito';
  doc.text(docTypeStr, margin, titleY + (design.slogan || design.fiscalInfo ? 15 : 7));
  
  // 3. Head - Top Right (Info de la Cotización)
  doc.setFontSize(18);
  doc.setTextColor(headerTextColor[0], headerTextColor[1], headerTextColor[2]);
  doc.setFont(fontName, 'bold');
  let titleStr = 'COTIZACIÓN';
  if (documentType === 'order') titleStr = 'ORDEN DE VENTA';
  else if (documentType === 'invoice') titleStr = 'FACTURA';
  else if (documentType === 'recurring') titleStr = 'FACTURA RECURRENTE';
  else if (documentType === 'payment') titleStr = 'PAGO RECIBIDO';
  else if (documentType === 'return') titleStr = 'DEVOLUCIÓN';
  else if (documentType === 'credit-note') titleStr = 'NOTA DE CRÉDITO';
  doc.text(titleStr, rightEdge, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont(fontName, 'normal');
  doc.text(`Nº: ${estimate.number || 'N/A'}`, rightEdge, headerLayout === 'compact' ? 28 : 32, { align: 'right' });
  doc.text(`Fecha: ${estimate.date ? new Date(estimate.date).toLocaleDateString() : 'N/A'}`, rightEdge, headerLayout === 'compact' ? 34 : 38, { align: 'right' });
  
  if (documentType === 'order') {
    doc.text(`Entrega: ${estimate.expectedDelivery ? new Date(estimate.expectedDelivery).toLocaleDateString() : 'N/A'}`, rightEdge, headerLayout === 'compact' ? 40 : 44, { align: 'right' });
  } else {
    doc.text(`Validez: ${estimate.expiryDate ? new Date(estimate.expiryDate).toLocaleDateString() : 'N/A'}`, rightEdge, headerLayout === 'compact' ? 40 : 44, { align: 'right' });
  }

  // 4. Separador
  doc.setDrawColor(...lineColor);
  doc.setLineWidth(0.5);
  if (design.separator !== 'none' && !isBannerHeader) {
    if (design.separator === 'dashed') doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, headerHeight, rightEdge, headerHeight);
    doc.setLineDashPattern([], 0);
  }

  // 5. Cliente Info
  doc.setFontSize(headerLayout === 'compact' ? 10 : 11);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text('Preparado para:', margin, headerLayout === 'compact' ? 54 : 62);
  
  doc.setFontSize(10);
  doc.setFont(fontName, 'normal');
  const clienteNombre = estimate.customer?.name || 'Cliente sin registrar';
  const clienteEmail = estimate.customer?.email || '';
  const clienteTelf = estimate.customer?.phone || '';
  
  const customerY = headerLayout === 'compact' ? 60 : 68;
  doc.text(clienteNombre, margin, customerY);
  if (clienteEmail) doc.text(clienteEmail, margin, customerY + 5);
  if (clienteTelf) doc.text(clienteTelf, margin, customerY + 10);

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
    startY: headerLayout === 'compact' ? 78 : 90,
    head: [['Descripción', 'Cantidad', 'Precio U.', 'Total']],
    body: tableData,
    theme: tableTheme,
    headStyles: {
      fillColor: lightTableHeader ? [248, 250, 252] : primaryColor,
      textColor: lightTableHeader ? textColor : 255,
      fontSize: baseFontSize + 1,
      fontStyle: 'bold',
      halign: 'center'
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
    styles: { overflow: 'linebreak', cellPadding: tableLayout === 'compact' ? 2.5 : tableLayout === 'cards' ? 4 : 5, lineWidth: tableLayout === 'minimal' ? 0 : 0.2, lineColor },
    tableLineWidth: tableLayout === 'minimal' ? 0 : 0.2,
    tableLineColor: lineColor,
    alternateRowStyles: tableLayout === 'striped' || tableLayout === 'ledger' || tableLayout === 'accent' ? { fillColor: [248, 250, 252] } : undefined,
  });

  // 7. Resumen Financiero
  const finalY = (doc as any).lastAutoTable.finalY || 90;
  
  const rightX = rightEdge;
  const labelX = 140;
  let currentY = finalY + 10;
  
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

  // IR: se muestra únicamente el monto retenido, nunca el nombre ni el porcentaje.
  if (Number((estimate as any).irAmount || 0) > 0) {
    doc.text('IR:', labelX, currentY);
    doc.text(`-${formatAmount(Number((estimate as any).irAmount), estimate.currency, estimate.exchangeRate)}`, rightX, currentY, { align: 'right' });
    currentY += 7;
  }
  
  // Total Line
  doc.setDrawColor(...lineColor);
  if (design.separator !== 'none') doc.line(labelX, currentY - 3, rightX, currentY - 3);
  
  // Total
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('TOTAL:', labelX, currentY + 3);
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
