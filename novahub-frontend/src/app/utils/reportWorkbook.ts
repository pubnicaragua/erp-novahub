import * as XLSX from 'xlsx';

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
}

const EMPTY_MESSAGE = 'Sin registros para el alcance seleccionado';

function toWorksheet(rows: ReportWorkbookSheet['rows'], emptyMessage: string) {
  if (!rows || rows.length === 0) {
    return XLSX.utils.json_to_sheet([{ Mensaje: emptyMessage }]);
  }
  return Array.isArray(rows[0])
    ? XLSX.utils.aoa_to_sheet(rows as unknown[][])
    : XLSX.utils.json_to_sheet(rows as Array<Record<string, unknown>>);
}

/**
 * Genera el libro de reportes con una hoja por bloque y una hoja de filtros.
 * Todas las vistas exportables deben pasar por este helper para que un
 * resultado vacío siga siendo un XLSX válido y para que los filtros usados
 * queden auditables junto con los datos.
 */
export function createReportWorkbook({ fileName, sheets, filters, emptyMessage = EMPTY_MESSAGE }: ReportWorkbookOptions): void {
  const workbook = XLSX.utils.book_new();
  const safeSheets = sheets.length ? sheets : [{ name: 'Reporte', rows: [] }];

  safeSheets.forEach(({ name, rows, columns }) => {
    const worksheet = toWorksheet(rows, emptyMessage);
    if (columns?.length) {
      worksheet['!cols'] = columns.map(column => ({ wch: column.width || Math.max(12, column.key.length + 2) }));
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31) || 'Reporte');
  });

  if (filters && Object.keys(filters).length > 0) {
    const filterRows = Object.entries(filters).map(([Filtro, Valor]) => ({ Filtro, Valor: Valor == null || Valor === '' ? '—' : String(Valor) }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(filterRows), 'Filtros');
  }

  XLSX.writeFile(workbook, fileName);
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

