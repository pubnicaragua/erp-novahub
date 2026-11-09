/**
 * Conversión entre el modelo de la hoja de cálculo del editor y archivos .xlsx (exceljs). Se conservan valores,
 * fórmulas (con nombres en inglés para que Excel las entienda), varias hojas, negrita/cursiva/subrayado, color de
 * texto y de fondo, alineación, formato de número y ancho de columnas.
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { filterHiddenRows, filterLastRow, parseRange } from './sheet-tools';
import { Evaluator, FormulaError, cellKey, formatValue, parseCellKey, toExcelFormula, type NumberFormat } from './sheet-formula';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface CellFormat {
  b?: boolean; i?: boolean; u?: boolean;
  al?: 'left' | 'center' | 'right';
  bg?: string; fg?: string;
  nf?: NumberFormat;
  /** Borde fino alrededor de la celda. */
  bd?: boolean;
}
export interface SheetCell { v: string; f?: CellFormat }
export interface SheetData {
  name: string;
  /** Celdas con contenido o formato, por referencia («B3»). El texto que empieza con «=» es una fórmula. */
  cells: Record<string, SheetCell>;
  colWidths: Record<number, number>;
  rowCount: number;
  colCount: number;
  /** Celdas combinadas («A1:C3»). */
  merges?: string[];
  /** Deja la primera fila fija al desplazarse. */
  freezeRow?: boolean;
  /** Filtro por columnas: `row` es la fila de títulos y `rules` los valores visibles de cada columna filtrada. */
  filter?: SheetFilter;
  /** Gráficos de la hoja (se guardan dentro del .xlsx, en una parte propia). */
  charts?: SheetChart[];
}
export interface SheetFilter { row: number; c0: number; c1: number; rules: Record<number, string[]> }
export interface SheetChart { id: string; type: 'bar' | 'line' | 'pie'; title: string; range: string }
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
  if (/C\$|NIO/i.test(fmt)) return 'currency';
  if (/[$€£]|USD/i.test(fmt)) return 'usd';
  if (/[0#]/.test(fmt) && /\.0/.test(fmt)) return 'number';
  if (/#,##0|0,0/.test(fmt)) return 'integer';
  if (/[0#]/.test(fmt) && /[.,]/.test(fmt)) return 'number';
  return undefined;
}
const NUM_FMT: Record<Exclude<NumberFormat, 'general'>, string> = {
  integer: '#,##0', number: '#,##0.00', currency: '"C$"#,##0.00', usd: '"$"#,##0.00', percent: '0.00%', date: 'dd/mm/yyyy',
};
const THIN: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
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
        const bd = cell.border; if (bd && (bd.top || bd.left || bd.bottom || bd.right)) f.bd = true;
        if (!text && !Object.keys(f).length) return;
        sheet.cells[cellKey(colNumber - 1, rowNumber - 1)] = { v: text?.v ?? '', ...(Object.keys(f).length ? { f } : {}) };
        if (text?.v && !text.v.startsWith('=') && words.join(' ').length < 20_000) words.push(text.v);
        total++; maxRow = Math.max(maxRow, rowNumber); maxCol = Math.max(maxCol, colNumber);
      });
    });
    ws.columns?.forEach((column, index) => { if (column?.width && index < MAX_COLS) sheet.colWidths[index] = Math.round(Math.min(600, Math.max(30, column.width * 7 + 5))); });
    const merges = ((ws.model as { merges?: string[] }).merges ?? []).filter((range) => {
      const [a, b] = range.split(':'); const pa = parseCellKey(a); const pb = b ? parseCellKey(b) : null;
      return pa && pb && pb.col < MAX_COLS && pb.row < MAX_ROWS && (pb.col > pa.col || pb.row > pa.row);
    });
    if (merges.length) sheet.merges = merges;
    const auto = ws.autoFilter as unknown;
    const autoRange = typeof auto === 'string' ? parseRange(auto) : auto && typeof auto === 'object' && 'from' in auto && 'to' in auto
      ? parseRange(`${cellKey(Number((auto as { from: { column: number } }).from.column) - 1, Number((auto as { from: { row: number } }).from.row) - 1)}:${cellKey(Number((auto as { to: { column: number } }).to.column) - 1, Number((auto as { to: { row: number } }).to.row) - 1)}`) : null;
    if (autoRange && autoRange.c1 < MAX_COLS) sheet.filter = { row: autoRange.r0, c0: autoRange.c0, c1: autoRange.c1, rules: {} };
    if (ws.views?.some((view) => view.state === 'frozen' && (view.ySplit ?? 0) >= 1)) sheet.freezeRow = true;
    sheet.rowCount = Math.max(DEFAULT_ROWS, maxRow + 20);
    sheet.colCount = Math.max(DEFAULT_COLS, maxCol + 2);
    sheets.push(sheet);
  });
  if (!sheets.length) sheets.push(emptySheet());
  const extra = await readExtra(source);
  for (const sheet of sheets) {
    const saved = extra[sheet.name];
    if (saved?.charts?.length) sheet.charts = saved.charts.slice(0, 20);
    if (saved?.filter && sheet.filter && saved.filter.row === sheet.filter.row) sheet.filter = saved.filter;
  }
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
        if (f.bd) target.border = THIN;
      }
    }
    for (const range of sheet.merges ?? []) { try { ws.mergeCells(range); } catch { /* combinación inválida: se omite */ } }
    if (sheet.freezeRow) ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (sheet.filter) {
      const last = Math.max(sheet.filter.row + 1, filterLastRow(sheet));
      ws.autoFilter = `${cellKey(sheet.filter.c0, sheet.filter.row)}:${cellKey(sheet.filter.c1, last)}`;
      for (const row of filterHiddenRows(sheet, ev)) ws.getRow(row + 1).hidden = true;
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  const extra: Record<string, SheetExtra> = {};
  for (const sheet of data.sheets) if (sheet.charts?.length || sheet.filter) extra[sheet.name] = { charts: sheet.charts, filter: sheet.filter };
  return Object.keys(extra).length ? embedExtra(buffer as ArrayBuffer, extra) : new Blob([buffer], { type: XLSX_MIME });
}

// ───────────── Gráficos y filtros dentro del .xlsx ─────────────
// exceljs no guarda gráficos, así que se incluyen en una parte propia del archivo (Excel la ignora). Si alguien guarda el
// archivo desde Excel, esa parte se pierde y los gráficos desaparecen; los datos no.
const EXTRA_PATH = 'novahub/sheets.json';
interface SheetExtra { charts?: SheetChart[]; filter?: SheetFilter }

async function embedExtra(buffer: ArrayBuffer, extra: Record<string, SheetExtra>): Promise<Blob> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const types = await zip.file('[Content_Types].xml')?.async('string');
    if (!types) return new Blob([buffer], { type: XLSX_MIME });
    zip.file(EXTRA_PATH, JSON.stringify({ v: 1, sheets: extra }));
    zip.file('[Content_Types].xml', types.replace('</Types>', `<Override PartName="/${EXTRA_PATH}" ContentType="application/json"/></Types>`));
    return await zip.generateAsync({ type: 'blob', mimeType: XLSX_MIME, compression: 'DEFLATE' });
  } catch { return new Blob([buffer], { type: XLSX_MIME }); }
}

async function readExtra(source: Blob): Promise<Record<string, SheetExtra>> {
  try {
    const zip = await JSZip.loadAsync(await source.arrayBuffer());
    const raw = await zip.file(EXTRA_PATH)?.async('string');
    const parsed = raw ? JSON.parse(raw) as { v?: number; sheets?: Record<string, SheetExtra> } : null;
    return parsed?.v === 1 && parsed.sheets ? parsed.sheets : {};
  } catch { return {}; }
}

/** Texto de las celdas para la búsqueda por contenido. */
export function workbookSearchText(data: WorkbookData): string {
  const parts: string[] = [];
  for (const sheet of data.sheets) for (const cell of Object.values(sheet.cells)) if (cell.v && !cell.v.startsWith('=')) parts.push(cell.v);
  return parts.join(' ').slice(0, 20_000);
}

/** Contenido de una hoja como CSV (UTF-8 con BOM para que Excel respete las tildes), con los valores ya calculados. */
export function sheetToCsv(data: WorkbookData, sheetIndex: number): string {
  const names = new Set(data.sheets.map((s) => s.name));
  const sheet = data.sheets[sheetIndex];
  const ev = new Evaluator((name, col, row) => data.sheets.find((s) => s.name === name)?.cells[cellKey(col, row)]?.v ?? '', (name) => names.has(name));
  let maxRow = -1; let maxCol = -1;
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const pos = parseCellKey(key);
    if (pos && cell.v !== '') { maxRow = Math.max(maxRow, pos.row); maxCol = Math.max(maxCol, pos.col); }
  }
  const lines: string[] = [];
  for (let r = 0; r <= maxRow; r++) {
    const fields: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.cells[cellKey(c, r)];
      const value = cell?.v ? ev.value(sheet.name, c, r) : null;
      // Los números van sin formato (1234.5) para que se puedan importar en otros programas; las fechas sí se escriben legibles.
      let text = value instanceof FormulaError ? value.code : typeof value === 'number' && cell?.f?.nf !== 'date' ? String(value) : formatValue(value, cell?.f?.nf);
      if (/^[=+\-@]/.test(text) && typeof value === 'string') text = `'${text}`; // evita fórmulas al abrir el CSV
      fields.push(/[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
    }
    lines.push(fields.join(','));
  }
  return String.fromCharCode(0xfeff) + lines.join('\r\n');
}
