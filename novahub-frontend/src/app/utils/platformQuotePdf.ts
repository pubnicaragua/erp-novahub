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
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-NI', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

function dateShort(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-NI') : '—';
}

function periodicityLabel(value: unknown) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('mens')) return 'Mensual';
  if (normalized.includes('anual') || normalized.includes('year')) return 'Anual';
  if (normalized.includes('únic') || normalized.includes('unic') || normalized.includes('one')) return 'Pago único';
  return String(value || '—').trim() || '—';
}

function amountOf(item: PlatformQuote['items'][number]) {
  return Number(item.amount ?? Number(item.quantity || 0) * Number(item.unitPrice || 0));
}

export interface PdfOptions {
  mode?: 'quote' | 'invoice';
  paymentDate?: string | null;
}

export async function downloadPlatformQuotePdf(quote: PlatformQuote, options: PdfOptions = {}) {
  const { mode = 'quote', paymentDate } = options;
  const isInvoice = mode === 'invoice';

  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 16;

  const drawFooter = (pageOffset: number = 0) => {
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(margin, height - 16, width - margin, height - 16);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      isInvoice
        ? 'Factura electrónica · NovaHub ERP Platform'
        : 'Propuesta comercial confidencial · NovaHub ERP Platform',
      margin, height - 10
    );
    doc.text(`Página ${doc.getNumberOfPages()}`, width - margin, height - 10, { align: 'right' });
  };

  /* ─── HEADER ─── */
  doc.setFillColor(...forest);
  doc.rect(0, 0, width, 52, 'F');
  doc.setFillColor(...brandGreen);
  doc.rect(0, 52, width, 2.5, 'F');

  try {
    doc.addImage(await getNovaHubLogoPng(), 'PNG', margin, 10, 50, 16);
  } catch { /* skip */ }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(isInvoice ? 'FACTURA' : 'COTIZACIÓN', 78, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(187, 229, 207);
  doc.text(isInvoice ? 'Documento de venta · NovaHub ERP' : 'Propuesta comercial · NovaHub ERP', 78, 26);

  doc.setTextColor(...brandGreen);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(quote.number, width - margin, 14, { align: 'right' });

  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Emitida ${dateShort(quote.createdAt)}`, width - margin, 21, { align: 'right' });

  if (isInvoice && paymentDate) {
    doc.setTextColor(...brandGreen);
    doc.setFont('helvetica', 'bold');
    doc.text(`Pagada ${dateShort(paymentDate)}`, width - margin, 28, { align: 'right' });
  } else {
    doc.text(`Válida hasta ${dateShort(quote.validUntil)}`, width - margin, 28, { align: 'right' });
  }

  /* Status badge */
  const statusMap: Record<string, { label: string; color: Rgb; bg: Rgb }> = {
    DRAFT: { label: 'BORRADOR', color: [120, 113, 108], bg: [245, 245, 244] },
    SENT: { label: 'ENVIADA', color: [37, 99, 235], bg: [239, 246, 255] },
    ACCEPTED: { label: 'ACEPTADA', color: [22, 163, 74], bg: [240, 253, 244] },
    REJECTED: { label: 'RECHAZADA', color: [220, 38, 38], bg: [254, 242, 242] },
    EXPIRED: { label: 'VENCIDA', color: [234, 88, 12], bg: [255, 247, 237] },
  };
  const st = statusMap[quote.status] || statusMap.DRAFT;
  doc.setFillColor(...st.bg);
  doc.roundedRect(margin, 58, 32, 8, 2, 2, 'F');
  doc.setTextColor(...st.color);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(st.label, margin + 16, 63, { align: 'center' });

  /* ─── CLIENT INFO ─── */
  let y = 72;
  doc.setFillColor(...mint);
  doc.roundedRect(margin, y, width - margin * 2, 26, 3, 3, 'F');

  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('CLIENTE', margin + 6, y + 8);
  doc.setTextColor(...ink);
  doc.setFontSize(11);
  doc.text(quote.prospectCompany || 'Sin empresa', margin + 6, y + 15);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const contactLine = [quote.prospectName, quote.prospectEmail, quote.prospectPhone, quote.country].filter(Boolean).join(' · ');
  doc.text(contactLine || '—', margin + 6, y + 21);

  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('MONEDA', width - margin - 38, y + 8);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(quote.currency, width - margin - 6, y + 15, { align: 'right' });

  y += 34;

  /* ─── PAYMENT INFO (invoice mode) ─── */
  if (isInvoice) {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, y, width - margin * 2, 10, 2, 2, 'F');
    doc.setTextColor(...darkGreen);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DOCUMENTO DE VENTA', margin + 5, y + 6);
    doc.setTextColor(...ink);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha de emisión: ${date(quote.createdAt)}  ·  Fecha de pago: ${date(paymentDate)}`, margin + 50, y + 6);
    y += 14;
  }

  /* ─── PERIODICITY BAR ─── */
  const items = quote.items || [];
  const recurring = Array.from(new Set(items.map((item) => periodicityLabel(item.periodicity)).filter((v) => v !== '—')));
  doc.setFillColor(247, 252, 249);
  doc.roundedRect(margin, y, width - margin * 2, 10, 2, 2, 'F');
  doc.setTextColor(...brandGreen);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MODALIDAD DE COBRO', margin + 5, y + 6);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'normal');
  doc.text(recurring.length ? recurring.join('  ·  ') : 'Por definir', margin + 50, y + 6);
  y += 14;

  /* ─── ITEMS TABLE ─── */
  const rows: RowInput[] = [];
  let currentSection = '';
  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      rows.push([{ content: currentSection, colSpan: 5, styles: { fillColor: [225, 245, 233], textColor: forest, fontStyle: 'bold', fontSize: 7.5 } }]);
    }
    rows.push([
      item.description || 'Concepto',
      money(item.unitPrice, quote.currency),
      periodicityLabel(item.periodicity),
      item.detail || '—',
      money(amountOf(item), quote.currency),
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 22 },
    head: [['Concepto', 'Precio unit.', 'Cobro', 'Detalle', 'Importe']],
    body: rows,
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 7.8, textColor: ink, lineColor: line,
      lineWidth: 0.15, cellPadding: 2.8, overflow: 'linebreak', valign: 'middle',
    },
    headStyles: {
      fillColor: forest, textColor: 255, fontStyle: 'bold',
      halign: 'center', cellPadding: 3.2, fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: 26, halign: 'right' },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 'auto' },
      4: { cellWidth: 28, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 2 || (Array.isArray(data.row.raw) && data.row.raw.length === 1)) return;
      const value = String(data.cell.raw || '').toLowerCase();
      data.cell.styles.fontStyle = 'bold';
      data.cell.styles.textColor = value.includes('mens') ? [21, 128, 61] : value.includes('anual') ? [30, 64, 175] : slate;
      data.cell.styles.fillColor = value.includes('mens') ? [229, 247, 235] : value.includes('anual') ? [235, 242, 255] : [248, 250, 252];
    },
    didDrawPage: drawFooter,
  });

  y = ((doc as any).lastAutoTable?.finalY || 120) + 10;

  /* ─── RESUMEN COMERCIAL ─── */
  if (y > height - 60) { doc.addPage(); y = 22; }
  const summaryX = width - margin - 78;
  const drawSummary = (label: string, value: number, color: Rgb = ink, bold = false) => {
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(label, summaryX, y);
    doc.setTextColor(...color);
    doc.setFont('helvetica', bold ? 'bold' : 'bold');
    doc.text(money(value, quote.currency), width - margin, y, { align: 'right' });
    y += 5.5;
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...forest);
  doc.text('RESUMEN', summaryX, y);
  y += 5;

  drawSummary('Servicios base', quote.subtotal);
  if (quote.optionalSubtotal > 0) drawSummary('Adicionales', quote.optionalSubtotal);
  if (quote.discountAmount > 0) drawSummary('Descuento', -quote.discountAmount, [220, 38, 38]);
  if (quote.taxAmount > 0) drawSummary(`Impuestos (${quote.taxRate}%)`, quote.taxAmount);

  doc.setDrawColor(...brandGreen);
  doc.setLineWidth(0.6);
  doc.line(summaryX, y - 2, width - margin, y - 2);
  y += 6;

  doc.setTextColor(...forest);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', summaryX, y);
  doc.setTextColor(...brandGreen);
  doc.text(money(quote.total, quote.currency), width - margin, y, { align: 'right' });

  if (isInvoice) {
    y += 8;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(summaryX - 2, y - 4, width - margin - summaryX + 4, 10, 2, 2, 'F');
    doc.setTextColor(...darkGreen);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PAGADO', summaryX + 2, y + 2);
    doc.text(dateShort(paymentDate), width - margin - 2, y + 2, { align: 'right' });
  }

  /* ─── PERIODICITY REFERENCE ─── */
  const periodTotals = items.reduce<Record<string, number>>((totals, item) => {
    const label = periodicityLabel(item.periodicity);
    totals[label] = (totals[label] || 0) + amountOf(item);
    return totals;
  }, {});
  const periodEntries = ['Mensual', 'Anual', 'Pago único'].filter((label) => periodTotals[label] > 0);
  if (periodEntries.length) {
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...forest);
    doc.text('DETALLE POR PERIODICIDAD', summaryX, y);
    y += 5;
    periodEntries.forEach((label) => drawSummary(label, periodTotals[label], label === 'Mensual' ? [21, 128, 61] : ink));
  }

  /* ─── NOTES ─── */
  if (quote.notes) {
    y += 6;
    if (y > height - 40) { doc.addPage(); y = 22; }
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin, y - 3, width - margin * 2, 22, 2, 2, 'F');
    doc.setTextColor(...forest);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('TÉRMINOS Y CONDICIONES', margin + 5, y + 3);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate);
    doc.setFontSize(7.5);
    const noteLines = doc.splitTextToSize(quote.notes, width - margin * 2 - 10);
    doc.text(noteLines.slice(0, 4), margin + 5, y + 9);
    y += 24;
  }

  /* ─── SIGNATURES ─── */
  if (y > height - 50) { doc.addPage(); y = 22; }
  y += 6;
  doc.setDrawColor(...line);
  doc.setLineWidth(0.3);
  doc.line(margin + 6, y, margin + 66, y);
  doc.line(width - margin - 66, y, width - margin - 6, y);
  y += 5;
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('EL PROVEEDOR', margin + 36, y, { align: 'center' });
  doc.text(isInvoice ? 'EL CLIENTE' : 'EL CLIENTE / PROSPECTO', width - margin - 36, y, { align: 'center' });

  drawFooter();
  doc.save(buildPdfFileName([isInvoice ? 'factura' : 'cotizacion', quote.number || 'sin_numero']));
}
