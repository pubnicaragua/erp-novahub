import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64Image } from './reportExportUtils';
import { getPdfDesignSettings, pdfDesignColor, pdfDesignPaper } from './pdfGenerator';
import { formatCurrencyDescriptor } from './currency';
import type { PdfDownloadFormat } from './pdfDownloadFormats';

type ManagerSalesExportOptions = {
  rows: Array<Record<string, unknown>>;
  tenantName: string;
  tenantLogo?: string | null;
  primaryColor?: string | null;
  title: string;
  fileBase: string;
  reportCurrency: string;
  filterSummary?: string;
  metrics?: Record<string, any>;
  extraSheets?: Array<{ name: string; rows: Array<Record<string, unknown>> }>;
  pdfFormat?: PdfDownloadFormat;
  /** Diseño resuelto para el tenant de la sucursal cuando se descarga un registro. */
  pdfDesign?: { settings?: Record<string, any> } | Record<string, any> | null;
};

function pdfPaperForFormat(settings: Record<string, any>, format?: PdfDownloadFormat) {
  if (!format || format === 'configured') return pdfDesignPaper(settings);
  if (format === 'roll-80') return { unit: 'mm' as const, format: [80, 220] as [number, number] };
  if (format === 'roll-58') return { unit: 'mm' as const, format: [58, 220] as [number, number] };
  return { unit: 'mm' as const, format: format === 'A4' ? 'a4' as const : format === 'legal' ? 'legal' as const : format === 'oficio' ? [216, 330] as [number, number] : 'letter' as const };
}

function safeHex(value: unknown, fallback = '#10b981') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : fallback;
}

function hexToArgb(value: string) {
  return `FF${value.replace('#', '').toUpperCase()}`;
}

function filteredContext(filterSummary?: string) {
  return filterSummary?.trim() ? `Filtros aplicados: ${filterSummary.trim()}` : 'Filtros aplicados: todos los registros del alcance seleccionado';
}

function normalizeCell(value: unknown) {
  if (value == null) return '—';
  return String(value);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function reportContext(options: ManagerSalesExportOptions) {
  const amount = options.metrics?.amount == null ? '' : ` · Monto: ${options.metrics.amount} ${options.metrics.amountCurrency || options.reportCurrency}`;
  const valuation = options.metrics?.valuationLabel ? ` · ${options.metrics.valuationLabel}` : '';
  return `Moneda de referencia: ${formatCurrencyDescriptor(options.reportCurrency)}${amount}${valuation}`;
}

export async function exportManagerSalesExcel(options: ManagerSalesExportOptions) {
  const primary = safeHex(options.primaryColor);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(options.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] });
  const keys = options.rows.length ? Object.keys(options.rows[0]) : ['Mensaje'];
  const labels = options.rows.length ? keys : ['Mensaje'];
  const endColumn = String.fromCharCode(65 + Math.max(0, labels.length - 1));
  worksheet.mergeCells(`A1:${endColumn}1`);
  worksheet.getCell('A1').value = options.title.toUpperCase();
  worksheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
  worksheet.getRow(1).height = 28;
  worksheet.mergeCells(`A2:${endColumn}2`);
  worksheet.getCell('A2').value = `${options.tenantName} · ${filteredContext(options.filterSummary)}`;
  worksheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.mergeCells(`A3:${endColumn}3`);
  worksheet.getCell('A3').value = `${reportContext(options)} · Registros: ${options.rows.length}`;
  worksheet.getCell('A3').font = { bold: true, color: { argb: hexToArgb(primary) } };
  worksheet.addRow(labels);
  const header = worksheet.getRow(4);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
  });
  if (options.rows.length) {
    options.rows.forEach((row, index) => {
      const excelRow = worksheet.addRow(keys.map((key) => normalizeCell(row[key])));
      excelRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
      const equivalenceIndex = keys.findIndex((key) => key.toLowerCase().includes('equivalencia'));
      if (equivalenceIndex >= 0) excelRow.getCell(equivalenceIndex + 1).font = { bold: true, color: { argb: hexToArgb(primary) } };
    });
  } else {
    worksheet.addRow(['Sin registros para el alcance seleccionado']);
  }
  worksheet.columns = labels.map((label) => ({ header: label, width: Math.min(32, Math.max(14, String(label).length + 5)) }));
  worksheet.autoFilter = { from: 'A4', to: `${endColumn}4` };
  (options.extraSheets || []).forEach((sheetData) => {
    const sheet = workbook.addWorksheet(sheetData.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] });
    const sheetKeys = sheetData.rows.length ? Object.keys(sheetData.rows[0]) : ['Mensaje'];
    const sheetEndColumn = String.fromCharCode(65 + Math.max(0, sheetKeys.length - 1));
    sheet.mergeCells(`A1:${sheetEndColumn}1`);
    sheet.getCell('A1').value = sheetData.name.toUpperCase();
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
    sheet.mergeCells(`A2:${sheetEndColumn}2`);
    sheet.getCell('A2').value = `${options.tenantName} · ${filteredContext(options.filterSummary)}`;
    sheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
    sheet.addRow(sheetKeys);
    const extraHeader = sheet.getRow(3);
    extraHeader.height = 22;
    extraHeader.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(primary) } };
    });
    if (sheetData.rows.length) sheetData.rows.forEach((row, index) => {
      const excelRow = sheet.addRow(sheetKeys.map((key) => normalizeCell(row[key])));
      excelRow.eachCell((cell) => { cell.alignment = { vertical: 'middle', wrapText: true }; if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
    });
    else sheet.addRow(['Sin registros para el alcance seleccionado']);
    sheet.columns = sheetKeys.map((label) => ({ header: label, width: Math.min(32, Math.max(14, String(label).length + 5)) }));
    sheet.autoFilter = { from: 'A3', to: `${sheetEndColumn}3` };
  });
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${options.fileBase}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function exportManagerSalesPdf(options: ManagerSalesExportOptions) {
  const configuredSettings = options.pdfDesign && typeof options.pdfDesign === 'object' && 'settings' in options.pdfDesign
    ? options.pdfDesign.settings
    : options.pdfDesign;
  const settings = (configuredSettings && typeof configuredSettings === 'object' ? configuredSettings : await getPdfDesignSettings('reportes.sales')) as Record<string, any>;
  const primary = pdfDesignColor(settings.primaryColor || options.primaryColor, [16, 185, 129]);
  const rollFormat = options.pdfFormat === 'roll-80' || options.pdfFormat === 'roll-58';
  const doc = new jsPDF({ ...pdfPaperForFormat(settings, options.pdfFormat), orientation: rollFormat ? 'portrait' : 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  let currentY = 15;
  const logo = options.tenantLogo ? await getBase64Image(options.tenantLogo) : null;
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, currentY, 20, 20, undefined, 'FAST'); currentY += 23; } catch { /* el reporte continúa sin logo incompatible */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(primary[0], primary[1], primary[2]);
  doc.text(options.tenantName || 'NovaHub', margin, currentY);
  currentY += 7;
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  doc.text(options.title, margin, currentY);
  currentY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(filteredContext(options.filterSummary), margin, currentY);
  currentY += 4;
  doc.text(`${reportContext(options)} · Generado: ${new Date().toLocaleString('es-NI')}`, margin, currentY);
  currentY += 6;
  const keys = options.rows.length ? Object.keys(options.rows[0]) : ['Mensaje'];
  autoTable(doc, {
    head: [keys],
    body: options.rows.length ? options.rows.map((row) => keys.map((key) => normalizeCell(row[key]))) : [['Sin registros para el alcance seleccionado']],
    startY: currentY,
    margin: { left: margin, right: margin, bottom: 14 },
    styles: { font: 'helvetica', fontSize: keys.length > 12 ? 5.8 : 7, cellPadding: 1.8, textColor: [51, 65, 85], overflow: 'linebreak' },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    didParseCell: (hook) => {
      if (hook.section === 'body' && String(keys[hook.column.index] || '').toLowerCase().includes('equivalencia')) hook.cell.styles.textColor = primary;
    },
  });
  let extraY = Number((doc as any).lastAutoTable?.finalY || currentY) + 8;
  for (const sheetData of options.extraSheets || []) {
    if (extraY > pageHeight - 42) { doc.addPage(); extraY = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primary[0], primary[1], primary[2]);
    doc.text(sheetData.name, margin, extraY);
    extraY += 4;
    const sheetKeys = sheetData.rows.length ? Object.keys(sheetData.rows[0]) : ['Mensaje'];
    autoTable(doc, {
      head: [sheetKeys],
      body: sheetData.rows.length ? sheetData.rows.map((row) => sheetKeys.map((key) => normalizeCell(row[key]))) : [['Sin registros para el alcance seleccionado']],
      startY: extraY,
      margin: { left: margin, right: margin, bottom: 14 },
      styles: { font: 'helvetica', fontSize: sheetKeys.length > 10 ? 5.8 : 7, cellPadding: 1.8, textColor: [51, 65, 85], overflow: 'linebreak' },
      headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    extraY = Number((doc as any).lastAutoTable?.finalY || extraY) + 8;
  }
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${options.tenantName || 'NovaHub'} · Página ${page} de ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
  }
  doc.save(`${options.fileBase}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
