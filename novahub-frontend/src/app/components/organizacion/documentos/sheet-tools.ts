/** Utilidades de la hoja sin dependencias de React: región de datos, filtros por columna y datos de gráficos. */
import { Evaluator, FormulaError, cellKey, formatValue, parseCellKey } from './sheet-formula.ts';
import type { SheetData } from './xlsx-convert.ts';

export const BLANK_LABEL = '(vacías)';

export interface Rect { c0: number; c1: number; r0: number; r1: number }

export function parseRange(range: string): Rect | null {
  const [a, b] = range.split(':'); const pa = parseCellKey(a ?? ''); const pb = parseCellKey(b ?? a ?? '');
  if (!pa || !pb) return null;
  return { c0: Math.min(pa.col, pb.col), c1: Math.max(pa.col, pb.col), r0: Math.min(pa.row, pb.row), r1: Math.max(pa.row, pb.row) };
}
export const rangeText = (r: Rect) => `${cellKey(r.c0, r.r0)}:${cellKey(r.c1, r.r1)}`;

const filled = (sheet: SheetData, c: number, r: number) => (sheet.cells[cellKey(c, r)]?.v ?? '') !== '';

/** Bloque de datos contiguo que rodea a una celda (como la «región actual» de Excel). */
export function regionAround(sheet: SheetData, col: number, row: number): Rect {
  let { c0, c1, r0, r1 } = { c0: col, c1: col, r0: row, r1: row };
  const rowHas = (r: number) => { if (r < 0 || r >= sheet.rowCount) return false; for (let c = Math.max(0, c0 - 1); c <= c1 + 1; c++) if (filled(sheet, c, r)) return true; return false; };
  const colHas = (c: number) => { if (c < 0 || c >= sheet.colCount) return false; for (let r = Math.max(0, r0 - 1); r <= r1 + 1; r++) if (filled(sheet, c, r)) return true; return false; };
  for (let grown = true; grown;) {
    grown = false;
    if (rowHas(r0 - 1)) { r0--; grown = true; }
    if (rowHas(r1 + 1)) { r1++; grown = true; }
    if (colHas(c0 - 1)) { c0--; grown = true; }
    if (colHas(c1 + 1)) { c1++; grown = true; }
  }
  return { c0, c1, r0, r1 };
}

/** Texto que se ve en una celda (para listar y comparar valores en los filtros). */
export function displayText(ev: Evaluator, sheet: SheetData, col: number, row: number): string {
  const cell = sheet.cells[cellKey(col, row)];
  const value = cell?.v ? ev.value(sheet.name, col, row) : null;
  const text = value instanceof FormulaError ? value.code : formatValue(value, cell?.f?.nf);
  return text === '' ? BLANK_LABEL : text;
}

/** Última fila con datos dentro de las columnas del filtro. */
export function filterLastRow(sheet: SheetData): number {
  const f = sheet.filter; if (!f) return -1;
  let last = f.row;
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const p = parseCellKey(key);
    if (p && cell.v !== '' && p.col >= f.c0 && p.col <= f.c1 && p.row > last) last = p.row;
  }
  return last;
}

/** Filas que el filtro oculta: las que no cumplen alguna de las columnas con valores elegidos. */
export function filterHiddenRows(sheet: SheetData, ev: Evaluator): Set<number> {
  const hidden = new Set<number>(); const f = sheet.filter;
  if (!f) return hidden;
  const rules = Object.entries(f.rules).map(([col, allowed]) => ({ col: Number(col), allowed: new Set(allowed) })).filter((r) => r.col >= f.c0 && r.col <= f.c1);
  if (!rules.length) return hidden;
  const last = filterLastRow(sheet);
  for (let r = f.row + 1; r <= last; r++) if (rules.some((rule) => !rule.allowed.has(displayText(ev, sheet, rule.col, r)))) hidden.add(r);
  return hidden;
}

// ───────────── Gráficos ─────────────
export interface ChartData { categories: string[]; series: Array<{ name: string; values: number[] }> }

/** Datos de un gráfico a partir de un rango: primera fila = nombres de series y primera columna = categorías, si hay texto. */
export function chartData(ev: Evaluator, sheet: SheetData, range: string): ChartData | null {
  const rect = parseRange(range); if (!rect) return null;
  const value = (c: number, r: number) => (sheet.cells[cellKey(c, r)]?.v ? ev.value(sheet.name, c, r) : null);
  const isText = (v: unknown) => typeof v === 'string' && v.trim() !== '' && Number.isNaN(Number(v));
  const width = rect.c1 - rect.c0 + 1;
  const header = Array.from({ length: width }, (_, i) => value(rect.c0 + i, rect.r0)).some((v, i) => i > 0 && isText(v)) || (width === 1 && isText(value(rect.c0, rect.r0)));
  const first = header ? rect.r0 + 1 : rect.r0;
  if (first > rect.r1) return null;
  const rows = Array.from({ length: rect.r1 - first + 1 }, (_, i) => first + i).slice(0, 200);
  const labelled = width > 1 && rows.some((r) => isText(value(rect.c0, r)));
  const categories = rows.map((r, i) => (labelled ? String(formatValue(value(rect.c0, r) ?? '', 'general') || i + 1) : String(i + 1)));
  const series: ChartData['series'] = [];
  for (let c = labelled ? rect.c0 + 1 : rect.c0; c <= rect.c1; c++) {
    const values = rows.map((r) => { const v = value(c, r); return typeof v === 'number' ? v : 0; });
    if (!rows.some((r) => typeof value(c, r) === 'number')) continue;
    const name = header ? String(formatValue(value(c, rect.r0) ?? '', 'general') || `Serie ${series.length + 1}`) : `Serie ${series.length + 1}`;
    series.push({ name, values });
  }
  return series.length ? { categories, series } : null;
}
