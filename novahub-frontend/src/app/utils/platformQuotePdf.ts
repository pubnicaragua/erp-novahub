import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { PlatformQuote } from '../services/enterprise-groups.service';
import { getNovaHubLogoPng } from './novahubBrand';
import { buildPdfFileName } from './exportFileNames';

type Rgb = [number, number, number];

const brandGreen: Rgb = [34, 197, 94];
const darkGreen: Rgb = [22, 163, 74];
const forest: Rgb = [23, 74, 58];
const ink: Rgb = [15, 23, 42];
const slate: Rgb = [71, 85, 105];
const muted: Rgb = [100, 116, 139];
const line: Rgb = [226, 232, 240];
const mint: Rgb = [239, 250, 244];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('es-NI', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function quantity(value: number) {
  return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function date(value?: string | null) {
  return value
    ? new Date(value).toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' })
    : '-';
}

function dateShort(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-NI') : '-';
}

function periodicityLabel(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('mens')) return 'Mensual';
  if (normalized.includes('anual') || normalized.includes('year')) return 'Anual';
  if (normalized.includes('únic') || normalized.includes('unic') || normalized.includes('one')) return 'Pago único';
  return String(value || '-').trim() || '-';
}

function currencyLabel(currency: PlatformQuote['currency']) {
  return currency === 'USD' ? 'Dólares estadounidenses' : 'Córdobas nicaragüenses';
}

function amountOf(item: PlatformQuote['items'][number]) {
  return Math.max(0, Number(item.quantity || 0)) * Math.max(0, Number(item.unitPrice || 0));
}

function isIncludedItem(item: PlatformQuote['items'][number]) {
  const detail = String(item.detail || '').toLowerCase();
  return Number(item.unitPrice || 0) <= 0 && (!item.isOptional || /incluido|valor agregado|sin costo/.test(detail));
}

export function calculatePlatformQuoteTotals(quote: PlatformQuote) {
  const items = quote.items || [];
  const charged = items.filter((item) => !isIncludedItem(item));
  const isBase = (item: PlatformQuote['items'][number]) => String(item.section || '').trim().toLowerCase() === '1. contratación inicial';
  const subtotal = charged.filter((item) => isBase(item) && !item.isOptional).reduce((sum, item) => sum + amountOf(item), 0);
  const optionalSubtotal = charged.filter((item) => !isBase(item) || item.isOptional).reduce((sum, item) => sum + amountOf(item), 0);
  const gross = subtotal + optionalSubtotal;
  const discount = Math.min(gross, Math.max(0, Number(quote.discountAmount || 0)));
  const taxable = Math.max(0, gross - discount);
  const taxAmount = taxable * Math.max(0, Number(quote.taxRate || 0)) / 100;
  return { subtotal, optionalSubtotal, referenceTotal: gross, discount, commercialSubtotal: taxable, taxAmount, total: taxable + taxAmount };
}

function itemPriceLabel(item: PlatformQuote['items'][number], currency: PlatformQuote['currency']) {
  return isIncludedItem(item) ? 'Incluido' : money(item.unitPrice, currency);
}

function itemBillingLabel(item: PlatformQuote['items'][number]) {
  return isIncludedItem(item) ? 'Valor agregado' : periodicityLabel(item.periodicity);
}

export interface PdfOptions {
  mode?: 'quote' | 'invoice';
  paymentDate?: string | null;
}

export interface CommercialReportOptions {
  commissionRecipient: string;
  commissionAmount: number;
  pricePreferential: boolean;
  specialPrice: boolean;
  reason: string;
}

export async function downloadPlatformQuotePdf(quote: PlatformQuote, options: PdfOptions = {}) {
  const { mode = 'quote', paymentDate } = options;
  const isInvoice = mode === 'invoice';
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = width - margin * 2;

  const drawFooter = () => {
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(margin, height - 16, width - margin, height - 16);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      isInvoice ? 'Factura - NovaHub ERP' : 'Propuesta comercial confidencial - NovaHub ERP',
      margin,
      height - 10,
    );
    doc.text(`Página ${doc.getNumberOfPages()}`, width - margin, height - 10, { align: 'right' });
  };

  const logo = await getNovaHubLogoPng();
  const drawHeader = (compact = false) => {
    const headerHeight = compact ? 31 : 38;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, width, headerHeight, 'F');

    try {
      doc.addImage(
        logo,
        'PNG',
        margin,
        compact ? 7 : 9,
        compact ? 45 : 52,
        compact ? 12.5 : 14.5,
        undefined,
        'FAST',
      );
    } catch {
      // El titulo conserva la legibilidad aunque el logo no pueda decodificarse.
    }

    if (isInvoice) {
      doc.setTextColor(...forest);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(compact ? 14 : 18);
      doc.text('FACTURA', compact ? 68 : 74, compact ? 15 : 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(compact ? 7 : 8);
      doc.setTextColor(...slate);
      doc.text('Documento de venta', compact ? 68 : 74, compact ? 21 : 24);
    }

    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(quote.number, width - margin, compact ? 10 : 11, { align: 'right' });
    doc.text(`Emisión: ${dateShort(quote.createdAt)}`, width - margin, compact ? 17 : 18, { align: 'right' });
    doc.setTextColor(...darkGreen);
    doc.setFont('helvetica', 'bold');
    doc.text(
      isInvoice && paymentDate ? `Pago: ${dateShort(paymentDate)}` : `Válida hasta: ${dateShort(quote.validUntil)}`,
      width - margin,
      compact ? 24 : 28,
      { align: 'right' },
    );

    doc.setDrawColor(...brandGreen);
    doc.setLineWidth(0.55);
    doc.line(margin, headerHeight, width - margin, headerHeight);
  };

  drawHeader();

  let y = 47;
  doc.setFillColor(...mint);
  doc.roundedRect(margin, y, contentWidth, 27, 3, 3, 'F');
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CLIENTE / PROSPECTO', margin + 6, y + 8);
  doc.setTextColor(...ink);
  doc.setFontSize(11);
  doc.text(quote.prospectCompany || 'Sin empresa', margin + 6, y + 15);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const contactLine = [
    quote.prospectName && `Contacto: ${quote.prospectName}`,
    quote.prospectEmail,
    quote.prospectPhone,
    quote.country,
  ]
    .filter(Boolean)
    .join('  -  ');
  const contactLines = doc.splitTextToSize(contactLine || '-', contentWidth - 54).slice(0, 2);
  doc.text(contactLines, margin + 6, y + 21);

  const currencyX = width - margin - 6;
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MONEDA DE COTIZACIÓN', currencyX, y + 8, { align: 'right' });
  doc.setTextColor(...ink);
  doc.setFontSize(10);
  doc.text(quote.currency, currencyX, y + 15, { align: 'right' });
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.text(currencyLabel(quote.currency), currencyX, y + 21, { align: 'right' });
  y += 35;

  if (isInvoice) {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');
    doc.setTextColor(...darkGreen);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DOCUMENTO DE VENTA', margin + 5, y + 6);
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`Emitida: ${date(quote.createdAt)}  -  Pagada: ${date(paymentDate)}`, margin + 52, y + 6);
    y += 14;
  }

  const items = quote.items || [];
  const totals = calculatePlatformQuoteTotals(quote);
  const includedCount = items.filter(isIncludedItem).length;
  const rows: RowInput[] = [];
  let currentSection = '';
  let lineNumber = 0;
  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section || 'Conceptos';
      rows.push([
        {
          content: currentSection,
          colSpan: 6,
          styles: { fillColor: [225, 245, 233], textColor: forest, fontStyle: 'bold', fontSize: 7.5 },
        },
      ]);
    }
    lineNumber += 1;
    rows.push([
      String(lineNumber),
      item.description || 'Concepto',
      quantity(item.quantity),
      itemPriceLabel(item, quote.currency),
      itemBillingLabel(item),
      item.detail?.trim() || (isIncludedItem(item) ? 'Valor agregado incluido sin costo adicional.' : '-'),
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { top: 39, left: margin, right: margin, bottom: 22 },
    head: [['#', 'Concepto', 'Cantidad', 'Precio unit.', 'Cobro', 'Descripción / alcance']],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 6.9,
      textColor: ink,
      lineColor: line,
      lineWidth: 0.15,
      cellPadding: 1.65,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: forest,
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.25,
      fontSize: 6.9,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 35 },
      2: { cellWidth: 17, halign: 'center' },
      3: { cellWidth: 27, halign: 'right' },
      4: { cellWidth: 28, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      const sectionRow = Array.isArray(data.row.raw) && data.row.raw.length === 1;
      if (sectionRow) return;
      if (data.section === 'body' && data.column.index === 4) {
        const value = String(data.cell.raw || '').toLowerCase();
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = value.includes('valor')
          ? darkGreen
          : value.includes('mens')
            ? [21, 128, 61]
            : value.includes('anual')
              ? [30, 64, 175]
              : slate;
        data.cell.styles.fillColor = value.includes('valor')
          ? [230, 250, 237]
          : value.includes('mens')
            ? [229, 247, 235]
            : value.includes('anual')
              ? [235, 242, 255]
              : [248, 250, 252];
      }
      if (data.section === 'body' && data.column.index === 3 && String(data.cell.raw || '') === 'Incluido') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = darkGreen;
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) drawHeader(true);
    },
    didDrawPage: () => drawFooter(),
  });

  y = ((doc as any).lastAutoTable?.finalY || y + 30) + 10;
  const noteLines = quote.notes ? doc.splitTextToSize(quote.notes, 91).slice(0, 3) : [];
  const summaryRows = 1 + (totals.optionalSubtotal > 0 ? 1 : 0) + (totals.discount > 0 ? 1 : 0) + (totals.taxAmount > 0 ? 1 : 0);
  const summaryHeight = Math.max(
    isInvoice ? 60 : 45,
    24 + summaryRows * 5,
    noteLines.length ? Math.min(3, noteLines.length) * 3.8 + 27 : 0,
  );
  const signatureSpace = 22;

  const startNewPage = () => {
    doc.addPage();
    drawHeader(true);
    y = 41;
  };

  if (y + summaryHeight + signatureSpace > height - 21) startNewPage();

  doc.setFillColor(250, 252, 251);
  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentWidth, summaryHeight, 3, 3, 'FD');
  doc.setTextColor(...forest);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESUMEN DE LA PROPUESTA', margin + 6, y + 9);

  const totalsX = width - margin - 66;
  let totalY = y + 17;
  const drawTotalLine = (label: string, value: number, color: Rgb = slate) => {
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label, totalsX, totalY);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(money(value, quote.currency), width - margin - 6, totalY, { align: 'right' });
    totalY += 5.5;
  };
  drawTotalLine('Servicios base', totals.subtotal);
  if (totals.optionalSubtotal > 0) drawTotalLine('Servicios adicionales', totals.optionalSubtotal);
  if (totals.discount > 0) drawTotalLine('Descuento aplicado', -totals.discount, [220, 38, 38]);
  if (totals.taxAmount > 0) drawTotalLine(`IVA / impuestos (${quote.taxRate}%)`, totals.taxAmount);
  doc.setDrawColor(...brandGreen);
  doc.setLineWidth(0.55);
  doc.line(totalsX, totalY - 2, width - margin - 6, totalY - 2);
  totalY += 6;
  doc.setTextColor(...forest);
  doc.setFontSize(11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', totalsX, totalY);
  doc.setTextColor(...darkGreen);
  doc.text(money(totals.total, quote.currency), width - margin - 6, totalY, { align: 'right' });

  doc.setTextColor(...forest);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ALCANCE Y CONDICIONES', margin + 6, y + 19);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  let detailY = y + 25;
  if (includedCount > 0) {
    doc.setTextColor(...darkGreen);
    doc.setFont('helvetica', 'bold');
    doc.text(`${includedCount} valor(es) agregado(s) incluido(s) sin costo adicional.`, margin + 6, detailY);
    detailY += 5;
  }
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  if (noteLines.length) {
    doc.text(noteLines, margin + 6, detailY);
  } else {
    doc.text(`Moneda: ${currencyLabel(quote.currency)}`, margin + 6, detailY);
    doc.text('La modalidad y el alcance se detallan por concepto.', margin + 6, detailY + 5);
  }
  if (isInvoice) {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(totalsX - 2, totalY + 7, width - margin - totalsX, 9, 2, 2, 'F');
    doc.setTextColor(...darkGreen);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('PAGADO', totalsX + 2, totalY + 13);
    doc.text(dateShort(paymentDate), width - margin - 7, totalY + 13, { align: 'right' });
  }

  y += summaryHeight + 10;
  // Las firmas son un cierre del mismo documento: no crear una segunda página
  // vacía solo porque la tabla haya consumido el espacio disponible.
  if (y + 20 > height - 21) y = height - 39;
  doc.setDrawColor(...line);
  doc.setLineWidth(0.3);
  doc.line(margin + 8, y, margin + 68, y);
  doc.line(width - margin - 68, y, width - margin - 8, y);
  y += 5;
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('EL PROVEEDOR', margin + 38, y, { align: 'center' });
  doc.text(isInvoice ? 'EL CLIENTE' : 'EL CLIENTE / PROSPECTO', width - margin - 38, y, { align: 'center' });

  drawFooter();
  doc.save(buildPdfFileName([isInvoice ? 'factura' : 'cotizacion', quote.number || 'sin_numero']));
}

export async function downloadPlatformQuoteCommercialReport(
  quote: PlatformQuote,
  report: CommercialReportOptions,
) {
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = width - margin * 2;
  const hasCondition = report.pricePreferential || report.specialPrice;
  const totals = calculatePlatformQuoteTotals(quote);
  const condition = [report.pricePreferential && 'Precio preferencial', report.specialPrice && 'Condición especial']
    .filter(Boolean)
    .join(' - ');
  const logo = await getNovaHubLogoPng();

  const drawFooter = () => {
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(margin, height - 16, width - margin, height - 16);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Reporte comercial interno - NovaHub ERP', margin, height - 10);
    doc.text(`Página ${doc.getNumberOfPages()}`, width - margin, height - 10, { align: 'right' });
  };

  const drawHeader = () => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, width, 34, 'F');
    try { doc.addImage(logo, 'PNG', margin, 8, 48, 13, undefined, 'FAST'); } catch { /* el reporte conserva el contenido sin logo */ }
    doc.setTextColor(...forest);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('CONTROL COMERCIAL', margin + 57, 15);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Cotización y condiciones autorizadas', margin + 57, 21);
    doc.text(quote.number, width - margin, 12, { align: 'right' });
    doc.text(`Emitida: ${dateShort(quote.createdAt)}`, width - margin, 18, { align: 'right' });
    doc.setDrawColor(...brandGreen);
    doc.setLineWidth(0.55);
    doc.line(margin, 34, width - margin, 34);
  };

  drawHeader();
  let y = 42;
  doc.setFillColor(...mint);
  doc.roundedRect(margin, y, contentWidth, 23, 3, 3, 'F');
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CLIENTE / PROSPECTO', margin + 6, y + 8);
  doc.setTextColor(...ink);
  doc.setFontSize(10.5);
  doc.text(quote.prospectCompany || 'Sin empresa', margin + 6, y + 15);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const contactLine = [quote.prospectName, quote.prospectEmail, quote.prospectPhone, quote.country].filter(Boolean).join('  -  ');
  doc.text(doc.splitTextToSize(contactLine || '-', contentWidth - 65).slice(0, 1), margin + 6, y + 20);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MONEDA', width - margin - 6, y + 8, { align: 'right' });
  doc.setTextColor(...ink);
  doc.setFontSize(10);
  doc.text(quote.currency, width - margin - 6, y + 15, { align: 'right' });
  y += 31;

  doc.setFillColor(255, 247, 237);
  doc.setDrawColor(254, 215, 170);
  doc.roundedRect(margin, y, contentWidth, 29, 3, 3, 'FD');
  doc.setTextColor(...[194, 65, 12] as Rgb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CONDICIONES INTERNAS', margin + 6, y + 8);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('Comisión para:', margin + 6, y + 16);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text(report.commissionRecipient.trim() || 'Sin asignar', margin + 31, y + 16);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.text('Monto:', width - margin - 65, y + 16);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text(money(report.commissionAmount, quote.currency), width - margin - 6, y + 16, { align: 'right' });
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.text(`Condición: ${condition || 'Sin condición especial'}`, margin + 6, y + 23);
  y += 37;

  const rows: RowInput[] = [];
  let currentSection = '';
  let lineNumber = 0;
  for (const item of quote.items || []) {
    if (item.section !== currentSection) {
      currentSection = item.section || 'Conceptos';
      rows.push([{ content: currentSection, colSpan: hasCondition ? 7 : 6, styles: { fillColor: [225, 245, 233], textColor: forest, fontStyle: 'bold', fontSize: 7.2 } }]);
    }
    lineNumber += 1;
    const row: RowInput = [
      String(lineNumber),
      item.description || 'Concepto',
      quantity(item.quantity),
      itemPriceLabel(item, quote.currency),
      itemBillingLabel(item),
      item.detail?.trim() || (isIncludedItem(item) ? 'Valor agregado incluido sin costo adicional.' : '-'),
    ];
    if (hasCondition) row.push(condition || '-');
    rows.push(row);
  }

  autoTable(doc, {
    startY: y,
    margin: { top: 38, left: margin, right: margin, bottom: 22 },
    head: [hasCondition
      ? ['#', 'Concepto', 'Cant.', 'Precio unit.', 'Cobro', 'Descripción / alcance', 'Condición comercial']
      : ['#', 'Concepto', 'Cant.', 'Precio unit.', 'Cobro', 'Descripción / alcance']],
    body: rows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.8, textColor: ink, lineColor: line, lineWidth: 0.15, cellPadding: 1.9, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: forest, textColor: 255, fontStyle: 'bold', halign: 'center', cellPadding: 2.5, fontSize: 6.7 },
    columnStyles: hasCondition
      ? { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 30 }, 2: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 23, halign: 'right' }, 4: { cellWidth: 22, halign: 'center' }, 5: { cellWidth: 40 }, 6: { cellWidth: 38 } }
      : { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: 34 }, 2: { cellWidth: 12, halign: 'center' }, 3: { cellWidth: 24, halign: 'right' }, 4: { cellWidth: 24, halign: 'center' }, 5: { cellWidth: 'auto' } },
    didParseCell: (data) => {
      const sectionRow = Array.isArray(data.row.raw) && data.row.raw.length === 1;
      if (sectionRow) return;
      const conditionColumn = hasCondition ? 6 : -1;
      if (data.section === 'body' && data.column.index === conditionColumn) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = [194, 65, 12];
        data.cell.styles.fillColor = [255, 247, 237];
      }
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = data.cell.raw === 'Valor agregado' ? darkGreen : slate;
      }
    },
    willDrawPage: (data) => { if (data.pageNumber > 1) drawHeader(); },
    didDrawPage: () => drawFooter(),
  });

  y = ((doc as any).lastAutoTable?.finalY || y + 30) + 9;
  const summaryHeight = report.reason.trim() ? 67 : 48;
  if (y + summaryHeight > height - 22) { doc.addPage(); drawHeader(); y = 42; }
  doc.setFillColor(250, 252, 251);
  doc.setDrawColor(...line);
  doc.roundedRect(margin, y, contentWidth, summaryHeight, 3, 3, 'FD');
  doc.setTextColor(...forest);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESUMEN PARA GERENCIA', margin + 6, y + 9);
  const reportLine = (label: string, value: number, offset: number, valueColor: Rgb = slate) => {
    doc.setTextColor(...slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label, margin + 6, y + offset);
    doc.setTextColor(...valueColor);
    doc.setFont('helvetica', 'bold');
    doc.text(money(value, quote.currency), width - margin - 6, y + offset, { align: 'right' });
  };
  reportLine('Precio referencial', totals.referenceTotal, 18);
  reportLine('Descuento aplicado', -totals.discount, 24, totals.discount > 0 ? [220, 38, 38] : slate);
  reportLine('Subtotal después del descuento', totals.commercialSubtotal, 30);
  reportLine(`Impuestos (${quote.taxRate || 0}%)`, totals.taxAmount, 36);
  doc.setDrawColor(...brandGreen);
  doc.setLineWidth(0.55);
  doc.line(margin + 6, y + 39, width - margin - 6, y + 39);
  doc.setTextColor(...darkGreen);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL FINAL', margin + 6, y + 46);
  doc.text(money(totals.total, quote.currency), width - margin - 6, y + 46, { align: 'right' });
  if (report.reason.trim()) {
    doc.setTextColor(...forest);
    doc.setFontSize(7.5);
    doc.text('Motivo registrado', margin + 6, y + 55);
    doc.setTextColor(...slate);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text(doc.splitTextToSize(report.reason.trim(), contentWidth - 12).slice(0, 2), margin + 6, y + 61);
  }
  drawFooter();
  doc.save(`Reporte-Comercial-${quote.number}.pdf`);
}
