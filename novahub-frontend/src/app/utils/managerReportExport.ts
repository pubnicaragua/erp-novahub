import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getBase64Image } from './reportExportUtils';
import { getPdfDesignSettings, getPdfTemplateLogo, pdfDesignColor, pdfDesignPaper } from './pdfGenerator';
import { buildDateFilteredDownloadFileName, buildDateFilteredPdfFileName } from './exportFileNames';
import { buildManagerReportModel, formatManagerReportValue } from './managerReportModel';
import type { ManagerReportModel, ManagerReportOptions } from './managerReportModel';

export { buildManagerCsv, buildManagerReportModel } from './managerReportModel';
export type { ManagerReportColumn, ManagerReportOptions } from './managerReportModel';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeColor(value: unknown) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : '#14532d';
}

function colorArgb(value: string) {
  return `FF${value.replace('#', '').toUpperCase()}`;
}

function styleExcelHeader(row: ExcelJS.Row, color: string) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb(color) } };
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  });
}

function addExcelSummary(sheet: ExcelJS.Worksheet, model: ManagerReportModel, color: string) {
  sheet.mergeCells('A1:B1');
  sheet.getCell('A1').value = model.title;
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorArgb(color) } };
  sheet.getCell('A1').alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;
  const metadata: Array<[string, string]> = [
    ['Empresa / grupo', model.tenantName],
    ['Alcance', model.scopeSummary],
    ['Filtros', model.filterSummary],
    ['Período', model.dateRange],
    ...(model.currency ? [['Moneda', model.currency] as [string, string]] : []),
    ['Generado', model.createdAt.toLocaleString('es-NI')],
  ];
  metadata.forEach(([label, value], index) => {
    const row = sheet.getRow(index + 2);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: true, color: { argb: colorArgb(color) } };
    row.getCell(2).value = value;
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });
  const headingRow = metadata.length + 3;
  sheet.getRow(headingRow).values = ['Indicador', 'Valor'];
  styleExcelHeader(sheet.getRow(headingRow), color);
  if (model.metrics.length) model.metrics.forEach(({ label, value }) => sheet.addRow([label, value]));
  else sheet.addRow([model.emptyMessage || 'Indicadores', model.emptyMessage ? '' : 'Sin indicadores disponibles']);
  sheet.columns = [{ width: 34 }, { width: 72 }];
}

function addExcelDetailSheet(workbook: ExcelJS.Workbook, name: string, columns: ManagerReportModel['columns'], rows: ManagerReportModel['rows'], color: string) {
  if (!rows.length) return;
  const sheet = workbook.addWorksheet(name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(columns.map((column) => column.label));
  styleExcelHeader(sheet.getRow(1), color);
  rows.forEach((row, index) => {
    const excelRow = sheet.addRow(columns.map((column) => formatManagerReportValue(row[column.key]) || '—'));
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: 'top', wrapText: true };
      if (index % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  });
  sheet.columns = columns.map((column) => ({ header: column.label, width: Math.min(40, Math.max(14, column.label.length + 5)) }));
  if (columns.length) sheet.autoFilter = { from: 'A1', to: `${sheet.getColumn(columns.length).letter}1` };
}

export async function exportManagerReportExcel(options: ManagerReportOptions) {
  const model = buildManagerReportModel(options);
  const color = safeColor(model.primaryColor);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub';
  workbook.created = model.createdAt;
  const summary = workbook.addWorksheet('Resumen', { views: [{ state: 'frozen', ySplit: 1 }] });
  addExcelSummary(summary, model, color);
  addExcelDetailSheet(workbook, 'Detalle', model.columns, model.rows, color);
  model.extraSheets.forEach((sheet) => addExcelDetailSheet(workbook, sheet.name, sheet.columns, sheet.rows, color));
  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), buildDateFilteredDownloadFileName([model.fileBase], 'xlsx', options.dateFrom, options.dateTo));
}

function wrapText(doc: jsPDF, value: string, width: number) {
  return doc.splitTextToSize(value, width) as string[];
}

export async function exportManagerReportPdf(options: ManagerReportOptions) {
  const model = buildManagerReportModel(options);
  let settings: Record<string, any> = {};
  try {
    settings = await getPdfDesignSettings('reportes.finance');
  } catch {
    // Use the renderer defaults when local PDF settings are unavailable.
  }
  if (model.primaryColor) settings = { ...settings, primaryColor: model.primaryColor };
  const color = pdfDesignColor(settings.primaryColor, [20, 83, 45]);
  const doc = new jsPDF(pdfDesignPaper(settings));
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const logo = await getBase64Image(getPdfTemplateLogo(settings, model.tenantLogo, 'reportes.finance'));
  let y = margin;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', margin, y, 18, 18, undefined, 'FAST');
      y += 22;
    } catch {
      // El reporte sigue siendo legible si el formato del logo no es compatible.
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(color[0], color[1], color[2]);
  const tenantLines = wrapText(doc, model.tenantName, contentWidth);
  doc.text(tenantLines, margin, y);
  y += tenantLines.length * 7 + 2;
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  const titleLines = wrapText(doc, model.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 6 + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const metadata = [
    `Alcance: ${model.scopeSummary}`,
    `Filtros: ${model.filterSummary}`,
    `Período: ${model.dateRange}${model.currency ? ` · Moneda: ${model.currency}` : ''}`,
    `Generado: ${model.createdAt.toLocaleString('es-NI')}`,
  ];
  metadata.forEach((line) => {
    const lines = wrapText(doc, line, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 1;
  });
  if (model.metrics.length) {
    autoTable(doc, {
      head: [['Indicador', 'Valor']],
      body: model.metrics.map((item) => [item.label, item.value]),
      startY: y + 2,
      margin: { left: margin, right: margin, bottom: 16 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: color, textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: contentWidth * 0.55 }, 1: { cellWidth: contentWidth * 0.45 } },
    });
    y = Number((doc as any).lastAutoTable?.finalY || y) + 6;
  } else if (model.emptyMessage) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(model.emptyMessage, margin, y + 3);
    y += 10;
  }
  let nextTableY = y;
  if (model.rows.length) {
    const columns = model.columns;
    if (y + 12 > pageHeight - 20) {
      doc.addPage();
      y = margin;
    }
    autoTable(doc, {
      head: [columns.map((column) => column.label)],
      body: model.rows.map((row) => columns.map((column) => formatManagerReportValue(row[column.key]) || '—')),
      startY: y + 2,
      margin: { left: margin, right: margin, bottom: 16 },
      styles: { font: 'helvetica', fontSize: columns.length > 10 ? 5.5 : columns.length > 7 ? 6.5 : 7.5, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: color, textColor: [255, 255, 255], halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      horizontalPageBreak: columns.length > 9,
      horizontalPageBreakRepeat: [0],
    });
    nextTableY = Number((doc as any).lastAutoTable?.finalY || y) + 8;
  }
  for (const extra of model.extraSheets) {
    if (nextTableY + 16 > pageHeight - 20) {
      doc.addPage();
      nextTableY = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(extra.name, margin, nextTableY + 3);
    autoTable(doc, {
      head: [extra.columns.map((column) => column.label)],
      body: extra.rows.map((row) => extra.columns.map((column) => formatManagerReportValue(row[column.key]) || '—')),
      startY: nextTableY + 6,
      margin: { left: margin, right: margin, bottom: 16 },
      styles: { font: 'helvetica', fontSize: extra.columns.length > 9 ? 5.8 : 7, cellPadding: 1.8, overflow: 'linebreak', valign: 'top' },
      headStyles: { fillColor: color, textColor: [255, 255, 255], halign: 'left' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      horizontalPageBreak: extra.columns.length > 9,
      horizontalPageBreakRepeat: [0],
    });
    nextTableY = Number((doc as any).lastAutoTable?.finalY || nextTableY) + 8;
  }
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`${model.tenantName} · Página ${page} de ${pageCount}`, pageWidth / 2, pageHeight - 7, { align: 'center' });
  }
  doc.save(buildDateFilteredPdfFileName([model.fileBase], options.pdfFormat || 'configured', options.dateFrom, options.dateTo));
}
