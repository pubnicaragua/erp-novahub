import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getPdfDesign, getPdfDesignSettings, pdfDesignColor, pdfDesignPaper } from './pdfGenerator';
import { renderPdfTemplateToPdf } from './pdf-template-renderer';
import { sanitizeTemplateDefinition, type PdfTemplateData } from '../services/pdf-template-definition';
import type { PdfDownloadFormat } from './pdfDownloadFormats';
import { buildPdfFileName } from './exportFileNames';

type PdfRgb = [number, number, number];

export interface PurchasePdfField {
  label: string;
  value?: unknown;
}

export interface PurchasePdfLine {
  description: string;
  quantity?: number | string;
  unitPrice?: string;
  total?: string;
  secondary?: string;
}

export interface PurchasePdfDocument {
  title: string;
  number: string;
  date?: string;
  status?: string;
  supplier?: string;
  fields?: PurchasePdfField[];
  lines?: PurchasePdfLine[];
  totals?: PurchasePdfField[];
  total?: string;
  totalLabel?: string;
  notes?: string;
}

export interface PurchasePdfListColumn {
  label: string;
  value: (row: any) => unknown;
  align?: 'left' | 'center' | 'right';
}

const standardPaper = (format: PdfDownloadFormat) => {
  if (format === 'A4') return 'A4';
  if (format === 'legal') return 'LEGAL';
  if (format === 'oficio') return 'OFICIO';
  return 'LETTER';
};

const withPaperFormat = (settings: Record<string, any>, format: PdfDownloadFormat) => format === 'configured'
  ? settings
  : { ...settings, paperSize: standardPaper(format), orientation: 'portrait' };

const valueText = (value: unknown) => String(value ?? '—');
const purchaseLineDescription = (line: PurchasePdfLine) => line.secondary ? `${line.description}\n${line.secondary}` : line.description;
const isRoll = (format: PdfDownloadFormat) => format === 'roll-58' || format === 'roll-80';

const countLines = (doc: jsPDF, value: unknown, size: number, width: number) => {
  doc.setFontSize(size);
  return Math.max(1, doc.splitTextToSize(valueText(value), width).length);
};

function renderRollPdf({ document, tenantName, format, settings }: { document: PurchasePdfDocument; tenantName: string; format: PdfDownloadFormat; settings: Record<string, any> }) {
  const width = format === 'roll-58' ? 58 : 80;
  const margin = width === 58 ? 3 : 4;
  const contentWidth = width - margin * 2;
  const probe = new jsPDF({ unit: 'mm', format: [width, 1000], orientation: 'portrait' });
  const lines = document.lines || [];
  const fieldLines = (document.fields || []).reduce((sum, field) => sum + countLines(probe, `${field.label}: ${valueText(field.value)}`, 6.4, contentWidth), 0);
  const itemLines = lines.reduce((sum, line) => sum + countLines(probe, purchaseLineDescription(line), 7.2, contentWidth) + 3, 0);
  const notesLines = document.notes ? countLines(probe, `Notas: ${document.notes}`, 6.4, contentWidth) : 0;
  const totalRows = (document.totals || []).length + (document.total ? 2 : 0);
  const pageHeight = Math.max(145, 62 + fieldLines * 3.2 + itemLines * 3.5 + totalRows * 4 + notesLines * 3.2);
  const doc = new jsPDF({ unit: 'mm', format: [width, pageHeight], orientation: 'portrait' });
  const black: PdfRgb = [0, 0, 0];
  const fontName = String(settings.fontFamily || '').toLowerCase().includes('mono') ? 'courier' : 'helvetica';
  const moneyLine = (label: string, value: string, bold = false) => {
    doc.setFont(fontName, bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 8.2 : 6.8);
    doc.text(label, margin, y);
    doc.text(value, width - margin, y, { align: 'right' });
    y += bold ? 5 : 4;
  };
  let y = margin;
  const rule = () => { doc.setDrawColor(...black); doc.setLineWidth(0.3); doc.line(margin, y, width - margin, y); y += 4; };

  doc.setTextColor(...black);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(width === 58 ? 10 : 12);
  doc.text(doc.splitTextToSize(String(settings.companyName || tenantName || 'Nuestra Empresa'), contentWidth), width / 2, y, { align: 'center' });
  y += 6;
  if (settings.slogan) { doc.setFont(fontName, 'normal'); doc.setFontSize(6.2); doc.text(doc.splitTextToSize(String(settings.slogan), contentWidth), width / 2, y, { align: 'center' }); y += 4; }
  rule();
  doc.setFont(fontName, 'bold');
  doc.setFontSize(width === 58 ? 8.5 : 10);
  doc.text(document.title.toUpperCase(), width / 2, y, { align: 'center' });
  y += 4;
  doc.setFont(fontName, 'normal');
  doc.setFontSize(6.8);
  doc.text(`Nº ${document.number || 'Sin número'}`, width / 2, y, { align: 'center' });
  y += 3.5;
  doc.text(`Fecha ${document.date || 'Sin fecha'}`, width / 2, y, { align: 'center' });
  y += 5;
  if (document.supplier) { doc.setFont(fontName, 'bold'); doc.setFontSize(6.5); doc.text('PROVEEDOR', margin, y); y += 3.3; doc.setFont(fontName, 'normal'); doc.setFontSize(7.2); doc.text(doc.splitTextToSize(document.supplier, contentWidth), margin, y); y += countLines(doc, document.supplier, 7.2, contentWidth) * 3.3 + 2; }
  for (const field of document.fields || []) moneyLine(field.label, valueText(field.value));
  if (document.status) moneyLine('Estado', document.status, true);
  if (lines.length) {
    rule();
    doc.setFont(fontName, 'bold'); doc.setFontSize(6.5); doc.text('DETALLE', margin, y); y += 4;
    for (const line of lines) {
      doc.setFont(fontName, 'normal'); doc.setFontSize(7.2);
      const descriptionLines = doc.splitTextToSize(purchaseLineDescription(line), contentWidth);
      doc.text(descriptionLines, margin, y); y += descriptionLines.length * 3.5;
      const quantity = line.quantity == null ? '' : `${line.quantity}${line.unitPrice ? ` × ${line.unitPrice}` : ''}`;
      if (quantity) { doc.setFontSize(6.4); doc.text(quantity, margin, y); }
      if (line.total) { doc.setFont(fontName, 'bold'); doc.text(line.total, width - margin, y, { align: 'right' }); }
      y += 4;
      doc.setDrawColor(...black); doc.line(margin, y, width - margin, y); y += 3;
    }
  }
  if ((document.totals || []).length || document.total) {
    rule();
    for (const total of document.totals || []) moneyLine(total.label, valueText(total.value));
    if (document.total) moneyLine(document.totalLabel || 'Total', document.total, true);
  }
  if (document.notes) { y += 2; doc.setFont(fontName, 'normal'); doc.setFontSize(6.4); doc.text(doc.splitTextToSize(`Notas: ${document.notes}`, contentWidth), margin, y); y += notesLines * 3.2; }
  y += 4; rule(); doc.setFont(fontName, 'normal'); doc.setFontSize(5.8); doc.text(doc.splitTextToSize(String(settings.footerText || `Documento generado por ${tenantName}`), contentWidth), width / 2, y, { align: 'center' });
  return doc;
}

export async function generatePurchaseRecordPDF({ document, tenantName, format = 'configured', targetKey = 'compras.purchase-record' }: { document: PurchasePdfDocument; tenantName: string; format?: PdfDownloadFormat; targetKey?: string }) {
  const configuredDesign = await getPdfDesign(targetKey);
  const settings = await getPdfDesignSettings(targetKey);
  if (!isRoll(format) && configuredDesign?.layoutZones?.definition) {
    const paperSettings = withPaperFormat(settings, format);
    const fieldData = Object.fromEntries((document.fields || []).map(field => [field.label.toLowerCase().replace(/\s+/g, '_'), valueText(field.value)]));
    const totalsData = Object.fromEntries((document.totals || []).map(field => [field.label.toLowerCase().replace(/\s+/g, '_'), valueText(field.value)]));
    if (document.total) totalsData.total = document.total;
    const data: PdfTemplateData = {
      company: { name: tenantName },
      document: { title: document.title, number: document.number, date: document.date, status: document.status, notes: document.notes || '' },
      supplier: { name: document.supplier || '' },
      party: { name: document.supplier || '' },
      items: (document.lines || []).map(line => ({ description: purchaseLineDescription(line), quantity: line.quantity || '', unitPrice: line.unitPrice || '', total: line.total || '' })),
      rows: (document.lines || []).map(line => ({ description: purchaseLineDescription(line), quantity: line.quantity || '', unitPrice: line.unitPrice || '', total: line.total || '' })),
      totals: { subtotal: totalsData.subtotal || '', tax: totalsData.tax || totalsData.impuesto || '', discount: totalsData.discount || totalsData.descuento || '', total: totalsData.total || '' },
      ...fieldData,
    };
    const rendered = await renderPdfTemplateToPdf({ definition: sanitizeTemplateDefinition(configuredDesign.layoutZones.definition, targetKey, paperSettings), settings: paperSettings, targetKey, data, fileName: buildPdfFileName([document.title, document.number || 'sin_numero'], format), save: true });
    return rendered.doc;
  }
  const doc = isRoll(format)
    ? renderRollPdf({ document, tenantName, format, settings })
    : new jsPDF(pdfDesignPaper(withPaperFormat(settings, format)));
  if (!isRoll(format)) {
    const paperSettings = withPaperFormat(settings, format);
    const primary = pdfDesignColor(paperSettings.primaryColor, [16, 185, 129]);
    const text = pdfDesignColor(paperSettings.textColor, [51, 65, 85]);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = Math.max(12, Math.min(20, Number(paperSettings.margins) || 14));
    doc.setTextColor(...primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(tenantName || 'Nova Hub', margin, 22);
    doc.setTextColor(...text); doc.setFontSize(12); doc.text(document.title, margin, 30);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(`Nº: ${document.number || 'N/A'}`, pageWidth - margin, 22, { align: 'right' }); doc.text(`Fecha: ${document.date || 'N/A'}`, pageWidth - margin, 28, { align: 'right' });
    if (document.status) doc.text(`Estado: ${document.status}`, pageWidth - margin, 34, { align: 'right' });
    const fields = [{ label: 'Proveedor', value: document.supplier || '—' }, ...(document.fields || [])].filter((field, index, all) => field.value !== undefined && (index === 0 || `${field.label}:${field.value}` !== `${all[index - 1].label}:${all[index - 1].value}`));
    autoTable(doc, { startY: 45, head: [['Campo', 'Detalle']], body: fields.map((field) => [field.label, valueText(field.value)]), theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold' }, bodyStyles: { textColor: text }, columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } }, styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' } });
    let currentY = ((doc as any).lastAutoTable?.finalY || 45) + 8;
    if (document.lines?.length) {
      autoTable(doc, { startY: currentY, head: [['Descripción', 'Cant.', 'Precio U.', 'Total']], body: document.lines.map((line) => [purchaseLineDescription(line), valueText(line.quantity), line.unitPrice || '—', line.total || '—']), theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold', halign: 'center' }, bodyStyles: { textColor: text, fontSize: 8 }, columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 20, halign: 'right' }, 2: { cellWidth: 34, halign: 'right' }, 3: { cellWidth: 34, halign: 'right' } }, styles: { cellPadding: 3, overflow: 'linebreak' } });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 8;
    }
    if ((document.totals || []).length || document.total) {
      const totalRows = [...(document.totals || []), ...(document.total ? [{ label: document.totalLabel || 'Total', value: document.total }] : [])];
      autoTable(doc, { startY: currentY, body: totalRows.map((field) => [field.label, valueText(field.value)]), theme: 'plain', columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold', textColor: primary }, 1: { cellWidth: 'auto', halign: 'right', textColor: text, fontStyle: 'bold' } }, styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak' } });
      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + 5;
    }
    if (document.notes) { doc.setTextColor(...text); doc.setFontSize(8); doc.text(doc.splitTextToSize(`Notas: ${document.notes}`, pageWidth - margin * 2), margin, currentY); }
    doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.text(`Generado por ${tenantName || 'Nova Hub'} - Módulo de Compras`, margin, pageHeight - 10);
  }
  doc.save(buildPdfFileName([document.title, document.number || 'sin_numero'], format));
  return doc;
}

export async function generatePurchaseListPDF({ title, rows, columns, tenantName, format = 'configured', targetKey = 'compras.list' }: { title: string; rows: any[]; columns: PurchasePdfListColumn[]; tenantName: string; format?: PdfDownloadFormat; targetKey?: string }) {
  if (isRoll(format)) throw new Error('Los reportes generales solo están disponibles en tamaños de página PDF.');
  const configuredDesign = await getPdfDesign(targetKey);
  const settings = await getPdfDesignSettings(targetKey);
  const paperSettings = withPaperFormat(settings, format === 'configured' ? 'configured' : format);
  if (configuredDesign?.layoutZones?.definition) {
    const mappedRows = rows.map(row => {
      const mapped: Record<string, unknown> = { description: columns[0] ? valueText(columns[0].value(row)) : '', quantity: columns[1] ? valueText(columns[1].value(row)) : '', unitPrice: columns[2] ? valueText(columns[2].value(row)) : '', total: columns[3] ? valueText(columns[3].value(row)) : '' };
      columns.forEach((column, index) => { mapped[`column-${index}`] = valueText(column.value(row)); mapped[column.label.toLowerCase().replace(/\s+/g, '_')] = valueText(column.value(row)); });
      return mapped;
    });
    const data: PdfTemplateData = { company: { name: tenantName }, document: { title, number: `${rows.length} registro(s)` }, rows: mappedRows, items: mappedRows };
    const rendered = await renderPdfTemplateToPdf({ definition: sanitizeTemplateDefinition(configuredDesign.layoutZones.definition, targetKey, paperSettings), settings: paperSettings, targetKey, data, fileName: buildPdfFileName([title], format), save: true });
    return rendered.doc;
  }
  const doc = new jsPDF(pdfDesignPaper(paperSettings));
  const primary = pdfDesignColor(paperSettings.primaryColor, [16, 185, 129]);
  const text = pdfDesignColor(paperSettings.textColor, [51, 65, 85]);
  const margin = Math.max(10, Math.min(18, Number(paperSettings.margins) || 14));
  doc.setTextColor(...primary); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(tenantName || 'Nova Hub', margin, 20);
  doc.setTextColor(...text); doc.setFontSize(12); doc.text(title, margin, 28);
  autoTable(doc, { startY: 38, head: [columns.map((column) => column.label)], body: rows.length ? rows.map((row) => columns.map((column) => valueText(column.value(row)))) : [columns.map(() => '—')], theme: 'grid', headStyles: { fillColor: primary, textColor: 255, fontStyle: 'bold', halign: 'center' }, bodyStyles: { textColor: text, fontSize: 8 }, columnStyles: Object.fromEntries(columns.map((column, index) => [index, { halign: column.align || 'left' }])), styles: { cellPadding: 3, overflow: 'linebreak' } });
  doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.text(`${rows.length} registro(s) · Generado por ${tenantName || 'Nova Hub'}`, margin, doc.internal.pageSize.getHeight() - 10);
  doc.save(buildPdfFileName([title], format));
  return doc;
}
