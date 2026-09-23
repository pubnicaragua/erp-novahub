import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { downloadExcelWorkbook } from './reportExportUtils';

export interface ReportWorkbookSheet {
  name: string;
  rows: Array<Record<string, unknown>> | unknown[][];
  columns?: Array<{ key: string; width?: number }>;
}

export interface ReportWorkbookOptions {
  fileName: string;
  sheets: ReportWorkbookSheet[];
  filters?: Record<string, unknown>;
  emptyMessage?: string;
  /** Mantiene el formato heredado de varias hojas para exportaciones fuera de sucursal. */
  singleSheet?: boolean;
}

const EMPTY_MESSAGE = 'Sin registros para el alcance seleccionado';
const BRAND_GREEN = '39AD85';
const NAVY = '173B63';
const LIGHT_GREEN = 'EAF5F1';
const STRIPE = 'F4F7FA';

function toLegacyWorksheet(rows: ReportWorkbookSheet['rows'], emptyMessage: string) {
  if (!rows || rows.length === 0) return XLSX.utils.json_to_sheet([{ Mensaje: emptyMessage }]);
  return Array.isArray(rows[0])
    ? XLSX.utils.aoa_to_sheet(rows as unknown[][])
    : XLSX.utils.json_to_sheet(rows as Array<Record<string, unknown>>);
}

function formatFilters(filters: Record<string, unknown>) {
  return Object.entries(filters).map(([filter, value]) => [filter, value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : value]);
}

function getColumnFormat(header: string) {
  const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(cantidad|unidades|operaciones|facturas|conteo|registros|pagina|dias|edad|stock|existencia|cantidad|items)\b/.test(normalized)) {
    return '#,##0;[Red]-#,##0;0';
  }
  if (/\b(monto|total|ticket|venta|ventas|ingreso|gasto|costo|precio|saldo|utilidad|margen|pago|pagado|subtotal|impuesto|descuento|balance|debe|haber|deuda|capital|efectivo)\b/.test(normalized)) {
    return '#,##0.00;[Red]-#,##0.00;0.00';
  }
  return undefined;
}

function getSectionRows(section: ReportWorkbookSheet, emptyMessage: string) {
  const rows = section.rows || [];
  if (!rows.length) return { headers: ['Mensaje'], values: [[emptyMessage]] };
  if (Array.isArray(rows[0])) {
    const aoa = rows as unknown[][];
    const headers = (aoa[0] || []).map((value, index) => String(value ?? `Columna ${index + 1}`));
    return { headers: headers.length ? headers : ['Mensaje'], values: aoa.length > 1 ? aoa.slice(1) : [[emptyMessage]] };
  }
  const records = rows as Array<Record<string, unknown>>;
  const headers = section.columns?.length
    ? section.columns.map(column => column.key)
    : [...new Set(records.flatMap(record => Object.keys(record || {})))];
  if (!headers.length) return { headers: ['Mensaje'], values: [[emptyMessage]] };
  return { headers, values: records.map(record => headers.map(header => record?.[header])) };
}

function safeSheetTitle(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base ? base.replace(/\b\w/g, character => character.toUpperCase()) : 'Reporte';
}

function applyTableFormatting(worksheet: ExcelJS.Worksheet, headerRow: number, headers: string[], startRow: number, endRow: number) {
  const header = worksheet.getRow(headerRow);
  header.height = 24;
  header.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: NAVY } } };
  });

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    row.height = 20;
    row.eachCell((cell, columnIndex) => {
      if (rowIndex % 2 === startRow % 2) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } };
      cell.alignment = { vertical: 'top', horizontal: typeof cell.value === 'number' ? 'right' : 'left', wrapText: true };
      if (typeof cell.value === 'number') {
        const headerName = headers[columnIndex - 1] || '';
        const directFormat = getColumnFormat(headerName);
        const normalizedHeader = headerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const descriptorIndex = headers.findIndex(header => /^(indicador|metrica|concepto|kpi)$/.test(header.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
        const descriptorFormat = !directFormat && descriptorIndex >= 0 && /^(valor|resultado)$/.test(normalizedHeader)
          ? getColumnFormat(String(row.getCell(descriptorIndex + 1).value ?? ''))
          : undefined;
        cell.numFmt = directFormat || descriptorFormat || '#,##0.##';
      }
      cell.border = { bottom: { style: 'hair', color: { argb: 'DCE4EA' } } };
    });
  }
}

export async function buildReportWorkbook({ fileName, sheets, filters, emptyMessage = EMPTY_MESSAGE }: ReportWorkbookOptions) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'NovaHub ERP';
  workbook.created = new Date();
  workbook.modified = new Date();
  const worksheet = workbook.addWorksheet('Reporte', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape', paperSize: 9 },
  });
  worksheet.properties.defaultRowHeight = 20;
  worksheet.getColumn(1).width = 28;
  worksheet.getColumn(2).width = 22;

  const title = safeSheetTitle(fileName);
  const safeSections = sheets.length ? sheets : [{ name: 'Reporte', rows: [] }];
  const sectionColumnCount = Math.max(6, ...safeSections.map(section => getSectionRows(section, emptyMessage).headers.length));
  worksheet.mergeCells(1, 1, 1, sectionColumnCount);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  worksheet.getRow(1).height = 32;
  worksheet.getCell(2, 1).value = 'Generado';
  worksheet.getCell(2, 2).value = new Date();
  worksheet.getCell(2, 2).numFmt = 'dd/mm/yyyy hh:mm';
  worksheet.getRow(2).font = { italic: true, color: { argb: '64748B' }, size: 9 };

  let rowIndex = 4;
  if (filters && Object.keys(filters).length) {
    worksheet.mergeCells(rowIndex, 1, rowIndex, 2);
    const filterTitle = worksheet.getCell(rowIndex, 1);
    filterTitle.value = 'Filtros aplicados';
    filterTitle.font = { bold: true, color: { argb: NAVY }, size: 11 };
    filterTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
    rowIndex += 1;
    const filterHeader = worksheet.getRow(rowIndex);
    filterHeader.values = ['Filtro', 'Valor'];
    [1, 2].forEach(column => {
      const cell = worksheet.getCell(rowIndex, column);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } };
    });
    rowIndex += 1;
    for (const [filter, value] of formatFilters(filters)) {
      worksheet.getCell(rowIndex, 1).value = filter;
      worksheet.getCell(rowIndex, 2).value = value as ExcelJS.CellValue;
      rowIndex += 1;
    }
    rowIndex += 1;
  }

  for (const section of safeSections) {
    worksheet.mergeCells(rowIndex, 1, rowIndex, sectionColumnCount);
    const sectionCell = worksheet.getCell(rowIndex, 1);
    sectionCell.value = section.name || 'Datos';
    sectionCell.font = { bold: true, color: { argb: NAVY }, size: 12 };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
    sectionCell.alignment = { vertical: 'middle' };
    worksheet.getRow(rowIndex).height = 24;
    rowIndex += 1;

    const { headers, values } = getSectionRows(section, emptyMessage);
    const headerRow = rowIndex;
    headers.forEach((header, columnIndex) => { worksheet.getCell(headerRow, columnIndex + 1).value = header; });
    rowIndex += 1;
    const firstDataRow = rowIndex;
    for (const valuesForRow of values) {
      valuesForRow.forEach((value, columnIndex) => {
        const cellValue = value ?? null;
        worksheet.getCell(rowIndex, columnIndex + 1).value = cellValue && typeof cellValue === 'object' && !(cellValue instanceof Date)
          ? JSON.stringify(cellValue)
          : cellValue as ExcelJS.CellValue;
      });
      rowIndex += 1;
    }
    applyTableFormatting(worksheet, headerRow, headers, firstDataRow, rowIndex - 1);

    headers.forEach((header, columnIndex) => {
      const configuredWidth = section.columns?.find(column => column.key === header)?.width;
      const currentWidth = worksheet.getColumn(columnIndex + 1).width || 12;
      const headerWidth = Math.min(44, Math.max(12, String(header).length + 3));
      worksheet.getColumn(columnIndex + 1).width = Math.max(currentWidth, Number(configuredWidth) || headerWidth);
    });
    rowIndex += 2;
  }

  worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(worksheet.columnCount).letter}${Math.max(1, worksheet.rowCount)}`;
  return workbook;
}

/**
 * Exporta todas las secciones en una hoja, conservando encabezados, filtros y
 * tipos numéricos. Las secciones se apilan para evitar una pestaña por bloque.
 */
export function createReportWorkbook(options: ReportWorkbookOptions): void {
  if (options.singleSheet === false) {
    const workbook = XLSX.utils.book_new();
    const safeSheets = options.sheets.length ? options.sheets : [{ name: 'Reporte', rows: [] }];
    safeSheets.forEach(({ name, rows, columns }) => {
      const worksheet = toLegacyWorksheet(rows, options.emptyMessage || EMPTY_MESSAGE);
      if (columns?.length) worksheet['!cols'] = columns.map(column => ({ wch: column.width || Math.max(12, column.key.length + 2) }));
      XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31) || 'Reporte');
    });
    if (options.filters && Object.keys(options.filters).length) {
      const filterRows = Object.entries(options.filters).map(([Filtro, Valor]) => ({ Filtro, Valor: Valor == null || Valor === '' ? '—' : String(Valor) }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filterRows), 'Filtros');
    }
    XLSX.writeFile(workbook, options.fileName);
    return;
  }

  void buildReportWorkbook(options).then(workbook => downloadExcelWorkbook(workbook, options.fileName)).catch(error => {
    console.error('No se pudo crear el libro de reportes:', error);
  });
}

export function createTransactionWorkbook(options: {
  fileName: string;
  documentRows: Array<Record<string, unknown>>;
  detailRows: Array<Record<string, unknown>>;
  totalsRows: Array<Record<string, unknown>>;
  filters?: Record<string, unknown>;
}): void {
  createReportWorkbook({
    fileName: options.fileName,
    filters: options.filters,
    sheets: [
      { name: 'Documento', rows: options.documentRows },
      { name: 'Detalle', rows: options.detailRows },
      { name: 'Totales', rows: options.totalsRows },
    ],
  });
}
