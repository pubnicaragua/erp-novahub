/**
 * Conversión entre el modelo de la hoja de cálculo del editor y archivos .xlsx (exceljs). Se conservan valores,
 * fórmulas (con nombres en inglés para que Excel las entienda), varias hojas, negrita/cursiva/subrayado, color de
 * texto y de fondo, alineación, formato de número y ancho de columnas.
 */
import ExcelJS from 'exceljs';
import { Evaluator, FormulaError, cellKey, parseCellKey, toExcelFormula, type NumberFormat } from './sheet-formula';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface CellFormat {
  b?: boolean; i?: boolean; u?: boolean;
  al?: 'left' | 'center' | 'right';
  bg?: string; fg?: string;
  nf?: NumberFormat;
}
export interface SheetCell { v: string; f?: CellFormat }
export interface SheetData {
  name: string;
  /** Celdas con contenido o formato, por referencia («B3»). El texto que empieza con «=» es una fórmula. */
  cells: Record<string, SheetCell>;
  colWidths: Record<number, number>;
  rowCount: number;
  colCount: number;
}
export interface WorkbookData { sheets: SheetData[] }

export const DEFAULT_ROWS = 100;
export const DEFAULT_COLS = 26;
export const DEFAULT_COL_WIDTH = 104;
const MAX_ROWS = 5000;
const MAX_COLS = 100;
const MAX_CELLS = 60_000;

export function emptySheet(name = 'Hoja 1'): SheetData {
  return { name, cells: {}, colWidths: {}, rowCount: DEFAULT_ROWS, colCount: DEFAULT_COLS };
}
export function emptyWorkbook(): WorkbookData { return { sheets: [emptySheet()] }; }

const argbToHex = (argb: string | undefined) => (argb && /^[0-9a-f]{8}$/i.test(argb) && argb.slice(0, 2).toUpperCase() !== '00' ? `#${argb.slice(2).toLowerCase()}` : undefined);
const hexToArgb = (hex: string | undefined) => (hex && /^#[0-9a-f]{6}$/i.test(hex) ? `FF${hex.slice(1).toUpperCase()}` : undefined);

function numFmtToFormat(fmt: string | undefined): NumberFormat | undefined {
  if (!fmt || fmt === 'General') return undefined;
  if (fmt.includes('%')) return 'percent';
  if (/[dy]/i.test(fmt.replace(/"[^"]*"|\[[^\]]*\]/g, '')) && /[dmy]/i.test(fmt) && !/0\.0|#/.test(fmt)) return 'date';
  if (/[$€£]|C\$|NIO|USD/i.test(fmt)) return 'currency';
  if (/[0#]/.test(fmt) && /[.,]/.test(fmt)) return 'number';
  return undefined;
}
const NUM_FMT: Record<Exclude<NumberFormat, 'general'>, string> = {
  number: '#,##0.00', currency: '"C$"#,##0.00', percent: '0.00%', date: 'dd/mm/yyyy',
};
const dateToSerial = (d: Date) => d.getTime() / 86_400_000 + 25_569;
const serialToDate = (n: number) => new Date(Math.round((n - 25_569) * 86_400_000));

function cellText(value: ExcelJS.CellValue): { v: string; date?: boolean } | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return { v: String(value) };
  if (typeof value === 'boolean') return { v: value ? 'TRUE' : 'FALSE' };
  if (typeof value === 'string') return { v: value };
  if (value instanceof Date) return { v: String(Math.round(dateToSerial(value) * 1e6) / 1e6), date: true };
  const obj = value as unknown as Record<string, unknown>;
  if (typeof obj.formula === 'string') return { v: `=${obj.formula}` };
  if (typeof obj.sharedFormula === 'string') return obj.result !== undefined ? cellText(obj.result as ExcelJS.CellValue) : null;
  if (Array.isArray(obj.richText)) return { v: (obj.richText as Array<{ text: string }>).map((r) => r.text).join('') };
  if (typeof obj.text === 'string') return { v: obj.text };
  if (typeof obj.error === 'string') return { v: obj.error };
  return null;
}

export async function xlsxToWorkbook(source: Blob): Promise<{ data: WorkbookData; searchText: string; truncated: boolean }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await source.arrayBuffer());
  const sheets: SheetData[] = [];
  let total = 0; let truncated = false;
  const words: string[] = [];
  wb.eachSheet((ws) => {
    if (ws.state === 'hidden' || ws.state === 'veryHidden') return;
    const sheet = emptySheet(ws.name.slice(0, 60) || `Hoja ${sheets.length + 1}`);
    let maxRow = 0; let maxCol = 0;
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS) { truncated = true; return; }
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber > MAX_COLS) { truncated = true; return; }
        if (total >= MAX_CELLS) { truncated = true; return; }
        const text = cellText(cell.value);
        const f: CellFormat = {};
        if (cell.font?.bold) f.b = true;
        if (cell.font?.italic) f.i = true;
        if (cell.font?.underline) f.u = true;
        const fg = argbToHex(cell.font?.color?.argb); if (fg && fg !== '#000000') f.fg = fg;
        const fill = cell.fill as ExcelJS.FillPattern | undefined;
        const bg = fill?.type === 'pattern' ? argbToHex(fill.fgColor?.argb) : undefined; if (bg && bg !== '#ffffff') f.bg = bg;
        const al = cell.alignment?.horizontal; if (al === 'left' || al === 'center' || al === 'right') f.al = al;
        const nf = text?.date ? 'date' : numFmtToFormat(cell.numFmt); if (nf) f.nf = nf;
        if (!text && !Object.keys(f).length) return;
        sheet.cells[cellKey(colNumber - 1, rowNumber - 1)] = { v: text?.v ?? '', ...(Object.keys(f).length ? { f } : {}) };
        if (text?.v && !text.v.startsWith('=') && words.join(' ').length < 20_000) words.push(text.v);
        total++; maxRow = Math.max(maxRow, rowNumber); maxCol = Math.max(maxCol, colNumber);
      });
    });
    ws.columns?.forEach((column, index) => { if (column?.width && index < MAX_COLS) sheet.colWidths[index] = Math.round(Math.min(600, Math.max(30, column.width * 7 + 5))); });
    sheet.rowCount = Math.max(DEFAULT_ROWS, maxRow + 20);
    sheet.colCount = Math.max(DEFAULT_COLS, maxCol + 2);
    sheets.push(sheet);
  });
  if (!sheets.length) sheets.push(emptySheet());
  return { data: { sheets }, searchText: words.join(' ').slice(0, 20_000), truncated };
}

export async function workbookToXlsx(data: WorkbookData, title: string): Promise<Blob> {
  const names = new Set(data.sheets.map((s) => s.name));
  const ev = new Evaluator(
    (sheetName, col, row) => data.sheets.find((s) => s.name === sheetName)?.cells[cellKey(col, row)]?.v ?? '',
    (name) => names.has(name),
  );
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NovaHub'; wb.title = title;
  const used = new Set<string>();
  for (const sheet of data.sheets) {
    let name = sheet.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Hoja';
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${used.size + 1}`;
    used.add(name.toLowerCase());
    const ws = wb.addWorksheet(name);
    Object.entries(sheet.colWidths).forEach(([index, px]) => { ws.getColumn(Number(index) + 1).width = Math.max(4, (px - 5) / 7); });
    for (const [key, cell] of Object.entries(sheet.cells)) {
      const pos = parseCellKey(key);
      if (!pos) continue;
      const target = ws.getCell(pos.row + 1, pos.col + 1);
      const isFormula = cell.v.startsWith('=') && cell.v.length > 1;
      const result = ev.value(sheet.name, pos.col, pos.row);
      const format = cell.f?.nf;
      if (isFormula) {
        target.value = { formula: toExcelFormula(cell.v.slice(1)), result: result instanceof FormulaError ? { error: result.code } as ExcelJS.CellErrorValue : (result ?? undefined) } as ExcelJS.CellFormulaValue;
      } else if (result === null) {
        target.value = null;
      } else if (typeof result === 'number' && format === 'date') {
        target.value = serialToDate(result);
      } else {
        target.value = result as ExcelJS.CellValue;
      }
      const f = cell.f;
      if (f) {
        if (f.b || f.i || f.u || f.fg) target.font = { bold: f.b, italic: f.i, underline: f.u, color: f.fg ? { argb: hexToArgb(f.fg) } : undefined };
        if (f.bg) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hexToArgb(f.bg) } };
        if (f.al) target.alignment = { horizontal: f.al };
        if (format && format !== 'general') target.numFmt = NUM_FMT[format];
      }
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME });
}

/** Texto de las celdas para la búsqueda por contenido. */
export function workbookSearchText(data: WorkbookData): string {
  const parts: string[] = [];
  for (const sheet of data.sheets) for (const cell of Object.values(sheet.cells)) if (cell.v && !cell.v.startsWith('=')) parts.push(cell.v);
  return parts.join(' ').slice(0, 20_000);
}
