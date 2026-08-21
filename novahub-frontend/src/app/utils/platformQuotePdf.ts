import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { PlatformQuote } from '../services/enterprise-groups.service';
import { getNovaHubLogoPng } from './novahubBrand';

type Rgb = [number, number, number];

const brandBlack: Rgb = [10, 10, 10];
const brandGreen: Rgb = [34, 197, 94];
const ink: Rgb = [15, 23, 42];
const slate: Rgb = [71, 85, 105];
const muted: Rgb = [100, 116, 139];
const line: Rgb = [214, 226, 220];
const mint: Rgb = [239, 250, 244];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));
}

function date(value?: string | null) {
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

export async function downloadPlatformQuotePdf(quote: PlatformQuote) {
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 14;

  const drawFooter = () => {
    doc.setDrawColor(...line);
    doc.setLineWidth(0.25);
    doc.line(margin, height - 15, width - margin, height - 15);
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text('Propuesta comercial confidencial · NovaHub ERP Platform', margin, height - 9);
    doc.text(`Página ${doc.getNumberOfPages()}`, width - margin, height - 9, { align: 'right' });
  };

  doc.setFillColor(...brandBlack);
  doc.rect(0, 0, width, 47, 'F');
  doc.setFillColor(...brandGreen);
  doc.rect(0, 44, width, 3, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 8, 57, 18, 2.5, 2.5, 'F');
  try {
    doc.addImage(await getNovaHubLogoPng(), 'PNG', margin + 2, 9.5, 53, 15);
  } catch {
    // A blocked canvas should not prevent the commercial PDF from downloading.
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('COTIZACIÓN DE PLATAFORMA', 78, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Estructura de costos, implementación y servicios adicionales', 78, 23);
  doc.setTextColor(...brandGreen);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(quote.number, width - margin, 14, { align: 'right' });
  doc.setTextColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text(`Emitida ${date(quote.createdAt)}`, width - margin, 21, { align: 'right' });
  doc.text(`Válida hasta ${date(quote.validUntil)}`, width - margin, 27, { align: 'right' });

  doc.setFillColor(...mint);
  doc.roundedRect(margin, 55, width - margin * 2, 25, 3, 3, 'F');
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PREPARADA PARA', margin + 6, 63);
  doc.setTextColor(...ink);
  doc.setFontSize(12);
  doc.text(quote.prospectCompany || 'Prospecto', margin + 6, 70);
  doc.setTextColor(...slate);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.text([quote.prospectName, quote.prospectEmail, quote.prospectPhone, quote.country].filter(Boolean).join(' · '), margin + 6, 76);
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.text('MONEDA', width - margin - 38, 63);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(quote.currency, width - margin - 6, 70, { align: 'right' });

  const items = quote.items || [];
  const recurring = Array.from(new Set(items.map((item) => periodicityLabel(item.periodicity)).filter((value) => value !== '—')));
  doc.setFillColor(247, 252, 249);
  doc.roundedRect(margin, 84, width - margin * 2, 9, 2, 2, 'F');
  doc.setTextColor(...brandGreen);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MODALIDAD DE COBRO', margin + 5, 89.5);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'normal');
  doc.text(recurring.length ? recurring.join('  ·  ') : 'Por definir', margin + 49, 89.5);

  const rows: RowInput[] = [];
  let currentSection = '';
  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      rows.push([{ content: currentSection, colSpan: 5, styles: { fillColor: [225, 245, 233], textColor: brandBlack, fontStyle: 'bold' } }]);
    }
    rows.push([
      `${item.description || 'Concepto'}${item.isOptional ? '  ·  Opcional' : ''}`,
      money(item.unitPrice, quote.currency),
      periodicityLabel(item.periodicity),
      item.detail || '—',
      money(amountOf(item), quote.currency),
    ]);
  }

  autoTable(doc, {
    startY: 98,
    margin: { left: margin, right: margin, bottom: 22 },
    head: [['Concepto', 'Precio unit.', 'Cobro', 'Detalle', 'Importe']],
    body: rows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.7, textColor: ink, lineColor: line, lineWidth: 0.15, cellPadding: 2.6, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: brandBlack, textColor: 255, fontStyle: 'bold', halign: 'center', cellPadding: 3.1 },
    columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 27, halign: 'right' }, 2: { cellWidth: 27, halign: 'center' }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 29, halign: 'right' } },
    didParseCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 2 || data.row.raw?.length === 1) return;
      const value = String(data.cell.raw || '').toLowerCase();
      data.cell.styles.fontStyle = 'bold';
      data.cell.styles.textColor = value.includes('mens') ? [21, 128, 61] : value.includes('anual') ? [30, 64, 175] : slate;
      data.cell.styles.fillColor = value.includes('mens') ? [229, 247, 235] : value.includes('anual') ? [235, 242, 255] : [248, 250, 252];
    },
    didDrawPage: drawFooter,
  });

  let y = ((doc as any).lastAutoTable?.finalY || 98) + 9;
  if (y > height - 57) { doc.addPage(); y = 22; }
  const summaryX = width - margin - 72;
  const drawSummary = (label: string, value: number, color: Rgb = ink) => {
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(label, summaryX, y);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(money(value, quote.currency), width - margin, y, { align: 'right' });
    y += 5.5;
  };
  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('RESUMEN COMERCIAL', summaryX, y);
  y += 5;
  drawSummary('Servicios base', quote.subtotal);
  drawSummary('Opcionales', quote.optionalSubtotal);
  if (quote.discountAmount > 0) drawSummary('Descuento', -quote.discountAmount, [220, 38, 38]);
  if (quote.taxAmount > 0) drawSummary(`Impuestos (${quote.taxRate}%)`, quote.taxAmount);
  doc.setDrawColor(...brandGreen);
  doc.setLineWidth(0.5);
  doc.line(summaryX, y - 2, width - margin, y - 2);
  y += 5;
  doc.setTextColor(...brandBlack);
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', summaryX, y);
  doc.setTextColor(...brandGreen);
  doc.text(money(quote.total, quote.currency), width - margin, y, { align: 'right' });

  const periodTotals = items.reduce<Record<string, number>>((totals, item) => {
    const label = periodicityLabel(item.periodicity);
    totals[label] = (totals[label] || 0) + amountOf(item);
    return totals;
  }, {});
  const periodEntries = ['Mensual', 'Anual', 'Pago único'].filter((label) => periodTotals[label] > 0);
  if (periodEntries.length) {
    y += 10;
    doc.setTextColor(...muted);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text('REFERENCIA POR PERIODICIDAD', summaryX, y);
    y += 4.5;
    periodEntries.forEach((label) => drawSummary(label, periodTotals[label], label === 'Mensual' ? [21, 128, 61] : ink));
  }

  if (quote.notes) {
    y += 5;
    if (y > height - 34) { doc.addPage(); y = 22; }
    doc.setTextColor(...ink);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas y condiciones', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.setFontSize(7.8);
    const noteLines = doc.splitTextToSize(quote.notes, width - margin * 2);
    doc.text(noteLines, margin, y + 5.5);
  }
  drawFooter();
  doc.save(`Cotizacion-${quote.number}.pdf`);
}
