import { jsPDF } from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import type { PlatformQuote } from '../services/enterprise-groups.service';

const navy: [number, number, number] = [15, 23, 42];
const emerald: [number, number, number] = [5, 150, 105];
const gold: [number, number, number] = [214, 170, 72];
const ink: [number, number, number] = [30, 41, 59];
const muted: [number, number, number] = [100, 116, 139];

function money(value: number, currency: string) {
  return new Intl.NumberFormat('es-NI', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0));
}

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-NI') : '—';
}

export function downloadPlatformQuotePdf(quote: PlatformQuote) {
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' });
  const width = doc.internal.pageSize.getWidth();
  const margin = 15;

  doc.setFillColor(...navy);
  doc.rect(0, 0, width, 42, 'F');
  doc.setFillColor(...emerald);
  doc.rect(0, 39, width, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('TARIFAS ERP — NOVA', margin, 17);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Estructura de costos, implementación y servicios adicionales', margin, 25);
  doc.setTextColor(...gold);
  doc.setFont('helvetica', 'bold');
  doc.text(quote.number, width - margin, 17, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(`Emitida: ${date(quote.createdAt)} · Vigencia: ${date(quote.validUntil)}`, width - margin, 25, { align: 'right' });

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Preparada para', margin, 54);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(quote.prospectCompany, margin, 61);
  doc.setTextColor(...muted);
  doc.setFontSize(8.5);
  doc.text([quote.prospectName, quote.prospectEmail, quote.prospectPhone, quote.country].filter(Boolean).join(' · '), margin, 67);
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.text('Moneda', width - margin - 38, 54);
  doc.setFont('helvetica', 'normal');
  doc.text(quote.currency, width - margin, 54, { align: 'right' });

  const rows: RowInput[] = [];
  let currentSection = '';
  for (const item of quote.items || []) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      rows.push([{ content: currentSection, colSpan: 5, styles: { fillColor: [239, 232, 218], textColor: navy, fontStyle: 'bold' } }]);
    }
    rows.push([
      item.description + (item.isOptional ? ' (Opcional)' : ''),
      money(item.unitPrice, quote.currency),
      item.periodicity || '—',
      item.detail || '—',
      money(Number(item.amount ?? item.quantity * item.unitPrice), quote.currency),
    ]);
  }
  autoTable(doc, {
    startY: 76,
    margin: { left: margin, right: margin },
    head: [['Concepto', 'Precio', 'Periodicidad', 'Detalle', 'Importe']],
    body: rows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, textColor: ink, lineColor: [203, 213, 225], lineWidth: 0.15, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: emerald, textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 25, halign: 'right' }, 2: { cellWidth: 30, halign: 'center' }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 28, halign: 'right' } },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 76) + 10;
  if (y > 245) { doc.addPage(); y = 20; }
  const summaryX = width - margin - 70;
  const drawSummary = (label: string, value: number, color: [number, number, number] = ink) => {
    doc.setTextColor(...muted);
    doc.setFont('helvetica', 'normal');
    doc.text(label, summaryX, y);
    doc.setTextColor(...color);
    doc.setFont('helvetica', 'bold');
    doc.text(money(value, quote.currency), width - margin, y, { align: 'right' });
    y += 5.5;
  };
  drawSummary('Servicios base', quote.subtotal);
  drawSummary('Opcionales', quote.optionalSubtotal);
  if (quote.discountAmount > 0) drawSummary('Descuento', -quote.discountAmount, [220, 38, 38]);
  if (quote.taxAmount > 0) drawSummary(`Impuestos (${quote.taxRate}%)`, quote.taxAmount);
  doc.setDrawColor(...gold);
  doc.line(summaryX, y - 2, width - margin, y - 2);
  y += 5;
  doc.setTextColor(...navy);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL', summaryX, y);
  doc.setTextColor(...emerald);
  doc.text(money(quote.total, quote.currency), width - margin, y, { align: 'right' });

  if (quote.notes) {
    y += 13;
    doc.setTextColor(...ink);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Notas y condiciones', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...muted);
    doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(quote.notes, width - margin * 2);
    doc.text(noteLines, margin, y + 6);
  }
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 278, width, 19, 'F');
  doc.setTextColor(...muted);
  doc.setFontSize(7.5);
  doc.text('Los módulos y servicios adicionales son opcionales y se contratan por separado del ERP.', margin, 287);
  doc.text('Documento comercial generado por NOVA ERP', width - margin, 292, { align: 'right' });
  doc.save(`Cotizacion-${quote.number}.pdf`);
}
