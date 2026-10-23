import ExcelJS from 'exceljs';
import { generateConfiguredReportSectionsPDF, isVirtualSystemDefaultDesign } from './pdfGenerator';
import { createSystemDefaultPdfDesign } from '../services/pdf-template-definition';
import { buildDateFilteredDownloadFileName, buildDateFilteredPdfFileName } from './exportFileNames';
import { buildManagerReportModel, formatManagerReportValue } from './managerReportModel';
import type { ManagerReportModel, ManagerReportOptions } from './managerReportModel';
import { resolveManagerPdfRender } from './managerPdfRender';

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

export async function exportManagerReportPdf(options: ManagerReportOptions) {
  const model = buildManagerReportModel(options);
  const targetKey = options.targetKey || (options.groupId ? 'manager.reports.overview.pdf' : 'reportes.finance');
  const managerConfig = options.groupId ? await resolveManagerPdfRender(options.groupId, targetKey) : null;
  const design = managerConfig?.design || createSystemDefaultPdfDesign(targetKey);
  const tenantName = managerConfig?.tenantName || model.tenantName;
  const tenantLogo = managerConfig?.tenantLogo || model.tenantLogo;
  const settings = { ...(design?.settings || {}) };
  const virtualDefault = isVirtualSystemDefaultDesign(design);
  const defaultDefinition = design?.layoutZones?.definition;
  const reportDesign = virtualDefault && defaultDefinition
    ? {
      ...design,
      settings,
      layoutZones: {
        ...design.layoutZones,
        definition: {
          ...defaultDefinition,
          nodes: defaultDefinition.nodes
            .filter((node: { id?: string }) => !/^report-kpi-(?:card|label|value|detail)-/.test(String(node.id || '')))
            .map((node: Record<string, unknown>) => node.type === 'report-sections' ? { ...node, y: 35.3, height: 59.7 } : node),
        },
      },
    }
    : design ? { ...design, settings } : undefined;

  const sections = [
    {
      id: 'manager-context',
      title: 'Alcance y filtros',
      headers: ['Dato', 'Detalle'],
      rows: [
        ['Alcance', model.scopeSummary],
        ['Filtros', model.filterSummary],
        ...(model.currency ? [['Moneda de referencia', model.currency] as Array<string>] : []),
      ],
      widths: [24, 76],
    },
    ...(model.metrics.length ? [{
      id: 'manager-metrics',
      title: 'Indicadores',
      headers: ['Indicador', 'Valor'],
      rows: model.metrics.map((item) => [item.label, item.value]),
      widths: [58, 42],
    }] : []),
    ...(model.rows.length ? [{
      id: 'manager-detail',
      title: 'Detalle',
      headers: model.columns.map((column) => column.label),
      rows: model.rows.map((row) => model.columns.map((column) => formatManagerReportValue(row[column.key]) || '—')),
    }] : []),
    ...model.extraSheets.map((sheet, index) => ({
      id: `manager-extra-${index + 1}`,
      title: sheet.name,
      headers: sheet.columns.map((column) => column.label),
      rows: sheet.rows.map((row) => sheet.columns.map((column) => formatManagerReportValue(row[column.key]) || '—')),
    })),
    ...(!model.metrics.length && !model.rows.length && !model.extraSheets.length ? [{
      id: 'manager-empty',
      title: 'Resultado',
      headers: ['Mensaje'],
      rows: [[model.emptyMessage || 'Sin registros para el alcance seleccionado']],
    }] : []),
  ];

  await generateConfiguredReportSectionsPDF({
    targetKey,
    title: model.title,
    tenantName,
    tenantLogo,
    sections,
    fileName: buildDateFilteredPdfFileName([model.fileBase], options.pdfFormat || 'configured', options.dateFrom, options.dateTo),
    periodLabel: model.dateRange,
    branchName: model.scopeSummary,
    designOverride: reportDesign,
    format: options.pdfFormat || 'configured',
  });
}
