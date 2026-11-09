import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, BarChart3, Bold, Eraser, Filter, Grid3x3, Italic, Merge, MoreHorizontal, PaintBucket, Plus, Redo2, Trash2, Type, Underline, Undo2 } from 'lucide-react';
import { cn } from '../../ui/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { toast } from '../../../services/toast';
import { saveBlob } from '../../../services/org-documents.service';
import {
  DEFAULT_COL_WIDTH, emptySheet, sheetToCsv, workbookSearchText, workbookToXlsx,
  type CellFormat, type SheetCell, type SheetData, type WorkbookData,
} from './xlsx-convert';
import { SheetCharts } from './SheetCharts';
import { SheetFilterMenu } from './SheetFilterMenu';
import { Evaluator, FormulaError, cellKey, colToLetters, formatValue, looksLikeDate, parseCellKey, rewriteRefs, shiftFormula, type NumberFormat } from './sheet-formula';
import { chartData, displayText, filterHiddenRows, filterLastRow, parseRange, rangeText, regionAround, type Rect } from './sheet-tools';
import type { BuiltFile } from './useAutosave';
import './documentos.css';

export interface SheetEditorHandle { build: () => Promise<BuiltFile> }

interface Props {
  title: string;
  initial: WorkbookData;
  readOnly: boolean;
  onChange: () => void;
}

interface Sel { ac: number; ar: number; fc: number; fr: number }
interface Editing { col: number; row: number; value: string; fromBar?: boolean }
interface Clip { text: string; col: number; row: number; cells: Array<Array<SheetCell | null>> }

const ROW_H = 28;
const HEADER_W = 48;
const MAX_ROWS = 5000;
const MAX_COLS = 100;
const rectOf = (s: Sel) => ({ c0: Math.min(s.ac, s.fc), c1: Math.max(s.ac, s.fc), r0: Math.min(s.ar, s.fr), r1: Math.max(s.ar, s.fr) });
const quoteSheet = (name: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);

function withCell(sheet: SheetData, key: string, cell: SheetCell | null): SheetData {
  const cells = { ...sheet.cells };
  if (cell && (cell.v !== '' || (cell.f && Object.keys(cell.f).length))) cells[key] = cell; else delete cells[key];
  return { ...sheet, cells };
}

/** Reescribe las referencias a una hoja cuando se le cambia el nombre. */
function renameRefs(formula: string, from: string, to: string): string {
  if (!formula.startsWith('=')) return formula;
  const fromPattern = [`'${from.replace(/'/g, "''")}'`, from].filter((v, i, a) => a.indexOf(v) === i).map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return formula.replace(new RegExp(`(^|[^A-Za-z0-9_'])(?:${fromPattern})!`, 'g'), (_all, prefix: string) => `${prefix}${quoteSheet(to)}!`);
}

export const SheetEditor = forwardRef<SheetEditorHandle, Props>(function SheetEditor({ title, initial, readOnly, onChange }, ref) {
  const [wb, setWb] = useState<WorkbookData>(initial);
  const [tab, setTab] = useState(0);
  const [sel, setSel] = useState<Sel>({ ac: 0, ar: 0, fc: 0, fr: 0 });
  const [editing, setEditing] = useState<Editing | null>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 560 });
  const wbRef = useRef(wb); wbRef.current = wb;
  const history = useRef<{ undo: WorkbookData[]; redo: WorkbookData[] }>({ undo: [], redo: [] });
  const [, bump] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const clip = useRef<Clip | null>(null);
  const changeRef = useRef(onChange); changeRef.current = onChange;

  const sheet = wb.sheets[Math.min(tab, wb.sheets.length - 1)];
  const sheetIndex = wb.sheets.indexOf(sheet);
  const evaluator = useMemo(() => {
    const names = new Set(wb.sheets.map((s) => s.name));
    return new Evaluator((name, col, row) => wb.sheets.find((s) => s.name === name)?.cells[cellKey(col, row)]?.v ?? '', (name) => names.has(name));
  }, [wb]);

  useImperativeHandle(ref, () => ({
    build: async () => ({ blob: await workbookToXlsx(wbRef.current, title), searchText: workbookSearchText(wbRef.current) }),
  }), [title]);

  /** Aplica un cambio guardando el estado anterior para poder deshacerlo. */
  const commit = useCallback((next: WorkbookData) => {
    if (readOnly) return;
    history.current.undo.push(wbRef.current); if (history.current.undo.length > 100) history.current.undo.shift();
    history.current.redo = [];
    wbRef.current = next; setWb(next); changeRef.current(); bump((n) => n + 1);
  }, [readOnly]);
  const undo = () => { const prev = history.current.undo.pop(); if (!prev) return; history.current.redo.push(wbRef.current); wbRef.current = prev; setWb(prev); changeRef.current(); bump((n) => n + 1); };
  const redo = () => { const next = history.current.redo.pop(); if (!next) return; history.current.undo.push(wbRef.current); wbRef.current = next; setWb(next); changeRef.current(); bump((n) => n + 1); };
  const mapSheet = (fn: (s: SheetData) => SheetData) => commit({ ...wbRef.current, sheets: wbRef.current.sheets.map((s, i) => (i === sheetIndex ? fn(s) : s)) });

  const raw = (col: number, row: number) => sheet.cells[cellKey(col, row)]?.v ?? '';
  const formatAt = (col: number, row: number): CellFormat | undefined => sheet.cells[cellKey(col, row)]?.f;
  const rect = rectOf(sel);

  // ───────────── Edición ─────────────
  // No le quita el foco a una celda que ya se está editando (quien teclea rápido empieza a escribir enseguida).
  const focusGrid = () => window.setTimeout(() => { if (document.activeElement?.tagName !== 'INPUT') root.current?.focus({ preventScroll: true }); }, 0);
  const startEdit = (col: number, row: number, value?: string, fromBar = false) => {
    if (readOnly) return;
    setEditing({ col, row, value: value ?? raw(col, row), fromBar });
  };
  const endEdit = (save: boolean, move?: 'down' | 'right' | 'left') => {
    const current = editing;
    setEditing(null);
    if (current && save) {
      const key = cellKey(current.col, current.row);
      const existing = sheet.cells[key];
      if ((existing?.v ?? '') !== current.value) {
        // Una fecha escrita a mano se muestra como fecha, no como número de serie.
        const f = looksLikeDate(current.value) && !existing?.f?.nf ? { ...existing?.f, nf: 'date' as const } : existing?.f;
        mapSheet((s) => withCell(s, key, { v: current.value, ...(f ? { f } : {}) }));
      }
    }
    if (move) moveSel(move === 'down' ? 0 : move === 'right' ? 1 : -1, move === 'down' ? 1 : 0, false);
    focusGrid();
  };
  const moveSel = (dc: number, dr: number, extend: boolean) => {
    setSel((s) => {
      const fc = Math.min(sheet.colCount - 1, Math.max(0, s.fc + dc)); const fr = Math.min(sheet.rowCount - 1, Math.max(0, s.fr + dr));
      return extend ? { ...s, fc, fr } : { ac: fc, ar: fr, fc, fr };
    });
  };
  useEffect(() => {
    const key = cellKey(sel.fc, sel.fr);
    root.current?.querySelector<HTMLElement>(`[data-cell="${key}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [sel.fc, sel.fr]);

  const clearSelection = () => {
    mapSheet((s) => {
      let next = s;
      for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
        const key = cellKey(c, r); const cell = next.cells[key];
        if (cell && cell.v !== '') next = withCell(next, key, { ...cell, v: '' });
      }
      return next;
    });
  };

  const patchFormat = (patch: Partial<CellFormat>) => {
    mapSheet((s) => {
      let next = s;
      for (let r = rect.r0; r <= Math.min(rect.r1, s.rowCount - 1); r++) for (let c = rect.c0; c <= rect.c1; c++) {
        const key = cellKey(c, r); const cell = next.cells[key] ?? { v: '' };
        const f: CellFormat = { ...cell.f, ...patch };
        (Object.keys(f) as Array<keyof CellFormat>).forEach((k) => { if (f[k] === undefined || f[k] === false) delete f[k]; });
        next = withCell(next, key, { ...cell, f });
      }
      return next;
    });
  };
  const toggle = (k: 'b' | 'i' | 'u') => patchFormat({ [k]: !formatAt(sel.ac, sel.ar)?.[k] });

  // ───────────── Filas, columnas, orden y relleno ─────────────
  /** Inserta (count > 0) o borra (count < 0) filas o columnas en la hoja activa y ajusta fórmulas, anchos y combinaciones. */
  const restructure = (axis: 'row' | 'col', at: number, count: number) => {
    const cur = wbRef.current; const target = cur.sheets[sheetIndex];
    const limit = axis === 'row' ? MAX_ROWS : MAX_COLS;
    if (count > 0 && (axis === 'row' ? target.rowCount : target.colCount) + count > limit) { toast.error(axis === 'row' ? 'La hoja llegó al máximo de filas.' : 'La hoja llegó al máximo de columnas.'); return; }
    const remap = (idx: number): number | null => (count > 0 ? (idx >= at ? idx + count : idx) : idx >= at - count ? idx + count : idx >= at ? null : idx);
    commit({ sheets: cur.sheets.map((s, si) => {
      const cells: Record<string, SheetCell> = {};
      for (const [key, cell] of Object.entries(s.cells)) {
        const v = cell.v.startsWith('=') ? rewriteRefs(cell.v, s.name, target.name, axis, at, count) : cell.v;
        let nk = key;
        if (si === sheetIndex) {
          const pos = parseCellKey(key); if (!pos) continue;
          const moved = remap(axis === 'row' ? pos.row : pos.col); if (moved === null) continue;
          nk = axis === 'row' ? cellKey(pos.col, moved) : cellKey(moved, pos.row);
        }
        cells[nk] = v === cell.v ? cell : { ...cell, v };
      }
      if (si !== sheetIndex) return { ...s, cells };
      const next: SheetData = { ...s, cells };
      if (axis === 'row') next.rowCount = Math.max(20, s.rowCount + count);
      else {
        next.colCount = Math.max(5, s.colCount + count);
        next.colWidths = {};
        for (const [i, w] of Object.entries(s.colWidths)) { const moved = remap(Number(i)); if (moved !== null) next.colWidths[moved] = w; }
      }
      // Un rango (combinación, filtro, gráfico) se estira al insertar dentro y se encoge al borrar dentro.
      const edge = (idx: number, isEnd: boolean): number | null => {
        if (count > 0) return idx >= at ? idx + count : idx;
        const n = -count;
        return idx >= at + n ? idx - n : idx >= at ? (isEnd ? at - 1 : at) : idx;
      };
      const moveRect = (rc: Rect): Rect | null => {
        const lo = axis === 'row' ? rc.r0 : rc.c0; const hi = axis === 'row' ? rc.r1 : rc.c1;
        const a = edge(lo, false); const b = edge(hi, true);
        if (a === null || b === null || b < a) return null;
        return axis === 'row' ? { ...rc, r0: a, r1: b } : { ...rc, c0: a, c1: b };
      };
      if (s.merges) {
        next.merges = s.merges.flatMap((range) => { const rc = parseRange(range); const m = rc && moveRect(rc); return m && (m.c1 > m.c0 || m.r1 > m.r0) ? [rangeText(m)] : []; });
      }
      if (s.filter) {
        const m = moveRect({ c0: s.filter.c0, c1: s.filter.c1, r0: s.filter.row, r1: s.filter.row });
        next.filter = m ? { row: m.r0, c0: m.c0, c1: m.c1, rules: {} } : undefined; // al reorganizar, el filtro se limpia
      }
      if (s.charts) {
        next.charts = s.charts.flatMap((chart) => {
          const rc = parseRange(chart.range); const m = rc && moveRect(rc);
          return m ? [{ ...chart, range: rangeText(m) }] : [];
        });
      }
      return next;
    }) });
    setSel(axis === 'row' ? { ac: 0, ar: Math.min(at, Math.max(0, target.rowCount + count - 1)), fc: target.colCount - 1, fr: Math.min(at, Math.max(0, target.rowCount + count - 1)) } : { ac: Math.min(at, Math.max(0, target.colCount + count - 1)), ar: 0, fc: Math.min(at, Math.max(0, target.colCount + count - 1)), fr: target.rowCount - 1 });
  };
  const insertRows = () => restructure('row', rect.r0, rect.r1 - rect.r0 + 1);
  const deleteRows = () => { if (rect.r1 - rect.r0 + 1 >= sheet.rowCount) return; restructure('row', rect.r0, -(rect.r1 - rect.r0 + 1)); };
  const insertCols = () => restructure('col', rect.c0, rect.c1 - rect.c0 + 1);
  const deleteCols = () => { if (rect.c1 - rect.c0 + 1 >= sheet.colCount) return; restructure('col', rect.c0, -(rect.c1 - rect.c0 + 1)); };

  /** Copia hacia abajo (o a la derecha) la primera fila (columna) de la selección, o la de arriba (izquierda) si es una sola. */
  const fill = (dir: 'down' | 'right') => mapSheet((s) => {
    let next = s;
    if (dir === 'down') {
      const src = rect.r1 > rect.r0 ? rect.r0 : rect.r0 - 1; if (src < 0) return s;
      for (let r = Math.max(rect.r0, src + 1); r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
        const from = s.cells[cellKey(c, src)];
        next = withCell(next, cellKey(c, r), from ? { ...from, v: shiftFormula(from.v, 0, r - src) } : null);
      }
    } else {
      const src = rect.c1 > rect.c0 ? rect.c0 : rect.c0 - 1; if (src < 0) return s;
      for (let c = Math.max(rect.c0, src + 1); c <= rect.c1; c++) for (let r = rect.r0; r <= rect.r1; r++) {
        const from = s.cells[cellKey(src, r)];
        next = withCell(next, cellKey(c, r), from ? { ...from, v: shiftFormula(from.v, c - src, 0) } : null);
      }
    }
    return next;
  });

  /** Ordena las filas de la selección por la columna activa; con una sola celda ordena todos los datos (la fila de títulos queda arriba). */
  const sortRows = (asc: boolean) => mapSheet((s) => {
    let { c0, c1, r0, r1 } = rect; let auto = false;
    if (c0 === c1 && r0 === r1) {
      // Región actual: el bloque de datos contiguo que rodea a la celda activa (como en Excel).
      ({ c0, c1, r0, r1 } = regionAround(s, c0, r0));
      // La fila de totales (si la última empieza por «Total») se queda donde está.
      if (/^total/i.test(s.cells[cellKey(c0, r1)]?.v ?? '')) r1--;
      if (r1 <= r0) return s;
      auto = true;
    }
    const keyCol = sel.ac >= c0 && sel.ac <= c1 ? sel.ac : c0;
    const header = auto && Array.from({ length: c1 - c0 + 1 }, (_, i) => evaluator.value(s.name, c0 + i, r0)).every((v) => typeof v === 'string' && v !== '')
      && Array.from({ length: c1 - c0 + 1 }, (_, i) => evaluator.value(s.name, c0 + i, r0 + 1)).some((v) => typeof v === 'number');
    const start = header ? r0 + 1 : r0;
    const rows = Array.from({ length: r1 - start + 1 }, (_, i) => start + i).map((r) => ({ r, key: evaluator.value(s.name, keyCol, r) }));
    const rank = (v: unknown) => (v === null || v === '' ? 2 : typeof v === 'number' ? 0 : 1);
    rows.sort((a, b) => {
      const ra = rank(a.key); const rb = rank(b.key);
      if (ra !== rb || ra === 2) return ra - rb; // los vacíos siempre al final
      const order = ra === 0 ? (a.key as number) - (b.key as number) : String(a.key instanceof FormulaError ? a.key.code : a.key).localeCompare(String(b.key instanceof FormulaError ? b.key.code : b.key), 'es', { sensitivity: 'base' });
      return (asc ? order : -order) || a.r - b.r;
    });
    let next = s;
    rows.forEach((item, i) => {
      for (let c = c0; c <= c1; c++) {
        const from = s.cells[cellKey(c, item.r)];
        next = withCell(next, cellKey(c, start + i), from ? { ...from, v: shiftFormula(from.v, 0, start + i - item.r) } : null);
      }
    });
    return next;
  });

  /** Combina la selección en una sola celda; si la selección toca combinaciones existentes, las separa. */
  const toggleMerge = () => mapSheet((s) => {
    const touches = (range: string) => { const rc = parseRange(range); return !!rc && rc.c0 <= rect.c1 && rc.c1 >= rect.c0 && rc.r0 <= rect.r1 && rc.r1 >= rect.r0; };
    const current = s.merges ?? [];
    if (current.some(touches)) return { ...s, merges: current.filter((range) => !touches(range)) };
    if (rect.c0 === rect.c1 && rect.r0 === rect.r1) { toast.info('Selecciona dos o más celdas para combinarlas.'); return s; }
    let next: SheetData = s;
    for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) {
      if (r === rect.r0 && c === rect.c0) continue;
      const cell = next.cells[cellKey(c, r)]; if (cell?.v) next = withCell(next, cellKey(c, r), { ...cell, v: '' });
    }
    return { ...next, merges: [...current, rangeText(rect)] };
  });

  const exportCsv = () => {
    const csv = sheetToCsv(wbRef.current, sheetIndex);
    saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${title} - ${sheet.name}.csv`);
  };

  // ───────────── Copiar y pegar ─────────────
  const onCopy = (event: React.ClipboardEvent, cut = false) => {
    if (editing) return;
    event.preventDefault();
    const rows: string[] = []; const cells: Clip['cells'] = [];
    for (let r = rect.r0; r <= rect.r1; r++) {
      const line: string[] = []; const cellRow: Array<SheetCell | null> = [];
      for (let c = rect.c0; c <= rect.c1; c++) {
        const cell = sheet.cells[cellKey(c, r)] ?? null; cellRow.push(cell);
        const value = evaluator.value(sheet.name, c, r);
        line.push(value instanceof FormulaError ? value.code : formatValue(value, cell?.f?.nf));
      }
      rows.push(line.join('\t')); cells.push(cellRow);
    }
    const text = rows.join('\n');
    event.clipboardData.setData('text/plain', text);
    clip.current = { text, col: rect.c0, row: rect.r0, cells };
    if (cut) clearSelection();
  };
  const onPaste = (event: React.ClipboardEvent) => {
    if (editing || readOnly) return;
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    if (!text) return;
    const internal = clip.current && clip.current.text === text ? clip.current : null;
    const grid = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map((line) => line.split('\t'));
    mapSheet((s) => {
      let next = s;
      grid.forEach((line, dr) => line.forEach((value, dc) => {
        const col = rect.c0 + dc; const row = rect.r0 + dr;
        if (col >= s.colCount || row >= s.rowCount) return;
        const key = cellKey(col, row);
        if (internal) {
          const source = internal.cells[dr]?.[dc] ?? null;
          next = withCell(next, key, source ? { ...source, v: shiftFormula(source.v, col - (internal.col + dc), row - (internal.row + dr)) } : null);
        } else next = withCell(next, key, { ...next.cells[key], v: value });
      }));
      return next;
    });
    setSel({ ac: rect.c0, ar: rect.r0, fc: Math.min(sheet.colCount - 1, rect.c0 + (grid[0]?.length ?? 1) - 1), fr: Math.min(sheet.rowCount - 1, rect.r0 + grid.length - 1) });
  };

  // ───────────── Teclado ─────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'b' || k === 'i' || k === 'u') { e.preventDefault(); toggle(k); return; }
      if ((k === 'd' || k === 'r') && !readOnly) { e.preventDefault(); fill(k === 'd' ? 'down' : 'right'); return; }
      if (k === 'a') { e.preventDefault(); setSel({ ac: 0, ar: 0, fc: sheet.colCount - 1, fr: sheet.rowCount - 1 }); return; }
      return;
    }
    const jump = e.key === 'PageDown' ? 20 : e.key === 'PageUp' ? -20 : 0;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveSel(0, 1, e.shiftKey); return;
      case 'ArrowUp': e.preventDefault(); moveSel(0, -1, e.shiftKey); return;
      case 'ArrowLeft': e.preventDefault(); moveSel(-1, 0, e.shiftKey); return;
      case 'ArrowRight': e.preventDefault(); moveSel(1, 0, e.shiftKey); return;
      case 'PageDown': case 'PageUp': e.preventDefault(); moveSel(0, jump, e.shiftKey); return;
      case 'Tab': e.preventDefault(); moveSel(e.shiftKey ? -1 : 1, 0, false); return;
      case 'Enter': e.preventDefault(); if (readOnly) moveSel(0, 1, false); else startEdit(sel.fc, sel.fr); return;
      case 'F2': e.preventDefault(); startEdit(sel.fc, sel.fr); return;
      case 'Delete': case 'Backspace': e.preventDefault(); clearSelection(); return;
      case 'Escape': return;
      default:
        if (e.key.length === 1 && !e.altKey && !readOnly) { e.preventDefault(); startEdit(sel.fc, sel.fr, e.key); setSel({ ac: sel.fc, ar: sel.fr, fc: sel.fc, fr: sel.fr }); }
    }
  };

  // ───────────── Ratón ─────────────
  useEffect(() => {
    const up = () => { dragging.current = false; };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);
  const onCellDown = (e: React.MouseEvent, col: number, row: number) => {
    if (e.button !== 0) return;
    if (editing && !(editing.col === col && editing.row === row)) endEdit(true);
    if (editing && editing.col === col && editing.row === row) return;
    dragging.current = true;
    setSel((s) => (e.shiftKey ? { ...s, fc: col, fr: row } : { ac: col, ar: row, fc: col, fr: row }));
    focusGrid();
  };
  const startResize = (e: React.MouseEvent, col: number) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX; const startW = sheet.colWidths[col] ?? DEFAULT_COL_WIDTH;
    const move = (ev: MouseEvent) => {
      const width = Math.round(Math.min(600, Math.max(40, startW + ev.clientX - startX)));
      setWb((current) => ({ ...current, sheets: current.sheets.map((s, i) => (i === sheetIndex ? { ...s, colWidths: { ...s.colWidths, [col]: width } } : s)) }));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); changeRef.current(); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  };

  // ───────────── Hojas ─────────────
  const addSheet = () => {
    let n = wb.sheets.length + 1; while (wb.sheets.some((s) => s.name === `Hoja ${n}`)) n++;
    commit({ ...wb, sheets: [...wb.sheets, emptySheet(`Hoja ${n}`)] }); setTab(wb.sheets.length); setSel({ ac: 0, ar: 0, fc: 0, fr: 0 });
  };
  const renameSheet = (index: number) => {
    const current = wb.sheets[index];
    const name = window.prompt('Nombre de la hoja', current.name)?.trim().replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    if (!name || name === current.name) return;
    if (wb.sheets.some((s, i) => i !== index && s.name.toLowerCase() === name.toLowerCase())) { toast.error('Ya existe una hoja con ese nombre.'); return; }
    commit({ sheets: wb.sheets.map((s, i) => {
      const cells: Record<string, SheetCell> = {};
      for (const [k, cell] of Object.entries(s.cells)) cells[k] = cell.v.startsWith('=') ? { ...cell, v: renameRefs(cell.v, current.name, name) } : cell;
      return i === index ? { ...s, name, cells } : { ...s, cells };
    }) });
  };
  const removeSheet = (index: number) => {
    if (wb.sheets.length < 2) { toast.error('El libro necesita al menos una hoja.'); return; }
    if (!window.confirm(`¿Borrar la hoja «${wb.sheets[index].name}»? Las fórmulas que la usan mostrarán error.`)) return;
    commit({ sheets: wb.sheets.filter((_, i) => i !== index) }); setTab(Math.max(0, index - 1)); setSel({ ac: 0, ar: 0, fc: 0, fr: 0 });
  };

  // ───────────── Pintado ─────────────
  // Filas que oculta el filtro; la tabla se pinta solo con las visibles (y con la ventana de desplazamiento).
  const hiddenRows = useMemo(() => filterHiddenRows(sheet, evaluator), [sheet, evaluator]);
  const rowsList = useMemo(() => (hiddenRows.size ? Array.from({ length: sheet.rowCount }, (_, i) => i).filter((r) => !hiddenRows.has(r)) : null), [hiddenRows, sheet.rowCount]);
  const total = rowsList ? rowsList.length : sheet.rowCount;
  const rowAt = (p: number) => (rowsList ? rowsList[Math.max(0, Math.min(p, total - 1))] : p) ?? 0;
  const cols = Array.from({ length: sheet.colCount }, (_, c) => c);
  const widthOf = (c: number) => sheet.colWidths[c] ?? DEFAULT_COL_WIDTH;
  const tableWidth = HEADER_W + cols.reduce((sum, c) => sum + widthOf(c), 0);
  const inRange = (c: number, r: number) => c >= rect.c0 && c <= rect.c1 && r >= rect.r0 && r <= rect.r1;
  const activeKey = cellKey(sel.fc, sel.fr);
  const merged = useMemo(() => {
    const starts = new Map<string, { cols: number; r0: number; r1: number }>(); const covered = new Set<string>(); const rects: Rect[] = [];
    for (const range of sheet.merges ?? []) {
      const rc = parseRange(range); if (!rc) continue;
      rects.push(rc); starts.set(cellKey(rc.c0, rc.r0), { cols: rc.c1 - rc.c0 + 1, r0: rc.r0, r1: rc.r1 });
      for (let r = rc.r0; r <= rc.r1; r++) for (let c = rc.c0; c <= rc.c1; c++) if (r !== rc.r0 || c !== rc.c0) covered.add(cellKey(c, r));
    }
    return { starts, covered, rects };
  }, [sheet.merges]);
  // La ventana se amplía para no cortar una combinación vertical por la mitad.
  let rFirst = rowAt(Math.max(0, Math.floor(scroll.top / ROW_H) - 6));
  let rLast = rowAt(Math.min(total - 1, Math.ceil((scroll.top + scroll.height) / ROW_H) + 6));
  for (const m of merged.rects) {
    if (m.r0 < rFirst && m.r1 >= rFirst) rFirst = m.r0;
    if (m.r0 <= rLast && m.r1 > rLast) rLast = m.r1;
  }
  const frozen = Boolean(sheet.freezeRow);
  const pinned = frozen && rFirst > 0 && (!rowsList || rowsList[0] === 0); // la fila 1 fija se pinta aparte cuando el resto se desplazó
  const visibleRows: number[] = pinned ? [0] : [];
  for (let r = rFirst; r <= rLast && r < sheet.rowCount; r++) if (!hiddenRows.has(r) && !(pinned && r === 0)) visibleRows.push(r);
  const rowsBefore = rowsList ? rowsList.filter((r) => r < rFirst).length : rFirst;
  const rowsAfter = rowsList ? rowsList.filter((r) => r > rLast).length : Math.max(0, sheet.rowCount - 1 - rLast);
  const topSpacer = Math.max(0, rowsBefore - (pinned ? 1 : 0)) * ROW_H;
  const spanOf = (r0: number, r1: number) => { let n = r1 - r0 + 1; for (const h of hiddenRows) if (h >= r0 && h <= r1) n--; return Math.max(1, n); };
  const filter = sheet.filter;
  const [filterMenu, setFilterMenu] = useState<{ col: number; left: number; top: number } | null>(null);
  const filterValues = useMemo(() => {
    if (!filterMenu || !filter) return [];
    const seen = new Set<string>(); const last = filterLastRow(sheet);
    for (let r = filter.row + 1; r <= last && seen.size < 400; r++) seen.add(displayText(evaluator, sheet, filterMenu.col, r));
    return [...seen].sort((a, b) => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' }));
  }, [filterMenu, filter, sheet, evaluator]);
  const toggleFilter = () => mapSheet((s) => {
    if (s.filter) return { ...s, filter: undefined };
    const multi = rect.c1 > rect.c0;
    const region = multi ? { c0: rect.c0, c1: rect.c1, r0: rect.r0, r1: rect.r1 } : regionAround(s, sel.ac, sel.ar);
    if (region.c1 <= region.c0 && region.r1 <= region.r0) { toast.info('Elige una celda dentro de tus datos (con la fila de títulos arriba) para activar el filtro.'); return s; }
    return { ...s, filter: { row: region.r0, c0: region.c0, c1: region.c1, rules: {} } };
  });
  const applyFilter = (col: number, allowed: string[] | null) => mapSheet((s) => {
    if (!s.filter) return s;
    const rules = { ...s.filter.rules };
    if (allowed) rules[col] = allowed; else delete rules[col];
    return { ...s, filter: { ...s.filter, rules } };
  });
  const addChart = () => mapSheet((s) => {
    const multi = rect.c1 > rect.c0 || rect.r1 > rect.r0;
    const region = multi ? rect : regionAround(s, sel.ac, sel.ar);
    const range = rangeText(region);
    if (!chartData(evaluator, s, range)) { toast.info('Selecciona un rango con títulos y números para crear el gráfico.'); return s; }
    if ((s.charts?.length ?? 0) >= 20) { toast.error('Una hoja admite hasta 20 gráficos.'); return s; }
    return { ...s, charts: [...(s.charts ?? []), { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, type: 'bar', title: `Gráfico ${(s.charts?.length ?? 0) + 1}`, range }] };
  });

  const stats = useMemo(() => {
    if (rect.c0 === rect.c1 && rect.r0 === rect.r1) return '';
    let sum = 0; let count = 0;
    for (let r = rect.r0; r <= Math.min(rect.r1, rect.r0 + 2000); r++) for (let c = rect.c0; c <= rect.c1; c++) {
      const v = evaluator.value(sheet.name, c, r); if (typeof v === 'number') { sum += v; count++; }
    }
    return count ? `Suma ${formatValue(sum)} · Promedio ${formatValue(sum / count)} · Cuenta ${count}` : '';
  }, [evaluator, rect.c0, rect.c1, rect.r0, rect.r1, sheet.name]);

  const barValue = editing ? editing.value : raw(sel.fc, sel.fr);
  const active = formatAt(sel.ac, sel.ar);
  const btn = (label: string, icon: React.ReactNode, onClick: () => void, pressed?: boolean, disabled?: boolean) => (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled ?? readOnly} onMouseDown={(e) => e.preventDefault()} onClick={onClick}
      className={cn('inline-flex size-8 shrink-0 items-center justify-center rounded-md transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40', pressed && 'bg-primary/15 text-primary dark:text-accent')}>{icon}</button>
  );
  const colorInput = (label: string, icon: React.ReactNode, value: string | undefined, apply: (v: string) => void) => (
    <label title={label} className={cn('relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-muted', readOnly && 'pointer-events-none opacity-40')}>
      <span className="sr-only">{label}</span>{icon}
      <span aria-hidden="true" className="absolute inset-x-1.5 bottom-0.5 h-[3px] rounded" style={{ background: value ?? 'transparent', outline: value ? undefined : '1px solid var(--border)' }} />
      <input type="color" aria-label={label} disabled={readOnly} value={value ?? '#000000'} onChange={(e) => apply(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-2">
      <div role="toolbar" aria-label="Formato de la hoja" className="flex flex-wrap items-center gap-0.5 rounded-xl border border-border bg-card p-1.5">
        {btn('Deshacer', <Undo2 className="size-4" />, undo, undefined, readOnly || !history.current.undo.length)}
        {btn('Rehacer', <Redo2 className="size-4" />, redo, undefined, readOnly || !history.current.redo.length)}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {btn('Negrita', <Bold className="size-4" />, () => toggle('b'), !!active?.b)}
        {btn('Cursiva', <Italic className="size-4" />, () => toggle('i'), !!active?.i)}
        {btn('Subrayado', <Underline className="size-4" />, () => toggle('u'), !!active?.u)}
        {colorInput('Color del texto', <Type className="size-4" />, active?.fg, (v) => patchFormat({ fg: v }))}
        {colorInput('Color de fondo', <PaintBucket className="size-4" />, active?.bg, (v) => patchFormat({ bg: v }))}
        {btn('Quitar el formato', <Eraser className="size-4" />, () => mapSheet((s) => { let n = s; for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) { const k = cellKey(c, r); if (n.cells[k]) n = withCell(n, k, { v: n.cells[k].v }); } return n; }))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {btn('Alinear a la izquierda', <AlignLeft className="size-4" />, () => patchFormat({ al: 'left' }), active?.al === 'left')}
        {btn('Centrar', <AlignCenter className="size-4" />, () => patchFormat({ al: 'center' }), active?.al === 'center')}
        {btn('Alinear a la derecha', <AlignRight className="size-4" />, () => patchFormat({ al: 'right' }), active?.al === 'right')}
        <select aria-label="Formato de número" disabled={readOnly} value={active?.nf ?? 'general'} onChange={(e) => patchFormat({ nf: e.target.value === 'general' ? undefined : (e.target.value as NumberFormat) })}
          className="ml-1 h-8 rounded-md border border-border bg-background px-2 text-[12px] disabled:opacity-40">
          <option value="general">General</option><option value="integer">Entero (1,235)</option><option value="number">Número (1,234.50)</option><option value="currency">Moneda (C$)</option><option value="usd">Dólares ($)</option><option value="percent">Porcentaje</option><option value="date">Fecha</option>
        </select>
        {btn('Bordes', <Grid3x3 className="size-4" />, () => patchFormat({ bd: !active?.bd }), !!active?.bd)}
        {btn('Combinar o separar celdas', <Merge className="size-4" />, toggleMerge)}
        {btn(sheet.filter ? 'Quitar el filtro' : 'Activar el filtro por columnas', <Filter className="size-4" />, toggleFilter, !!sheet.filter)}
        {btn('Crear un gráfico con la selección', <BarChart3 className="size-4" />, addChart)}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Más opciones de la hoja" title="Más opciones de la hoja" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-[12px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"><MoreHorizontal className="size-4" />Más</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {!readOnly && (
              <>
                <DropdownMenuItem onSelect={insertRows}>Insertar fila(s) arriba</DropdownMenuItem>
                <DropdownMenuItem onSelect={deleteRows}>Eliminar fila(s)</DropdownMenuItem>
                <DropdownMenuItem onSelect={insertCols}>Insertar columna(s) a la izquierda</DropdownMenuItem>
                <DropdownMenuItem onSelect={deleteCols}>Eliminar columna(s)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => sortRows(true)}>Ordenar de A a Z (menor a mayor)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => sortRows(false)}>Ordenar de Z a A (mayor a menor)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fill('down')}>Rellenar hacia abajo (Ctrl+D)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fill('right')}>Rellenar a la derecha (Ctrl+R)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => mapSheet((s) => ({ ...s, freezeRow: !s.freezeRow }))}>{sheet.freezeRow ? 'Soltar la primera fila' : 'Inmovilizar la primera fila'}</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={exportCsv}>Descargar esta hoja como CSV</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button type="button" disabled={readOnly || sheet.rowCount >= MAX_ROWS} onClick={() => mapSheet((s) => ({ ...s, rowCount: Math.min(MAX_ROWS, s.rowCount + 100) }))} className="h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted disabled:opacity-40">+100 filas</button>
        <button type="button" disabled={readOnly || sheet.colCount >= MAX_COLS} onClick={() => mapSheet((s) => ({ ...s, colCount: Math.min(MAX_COLS, s.colCount + 5) }))} className="h-8 rounded-md px-2 text-[12px] font-semibold hover:bg-muted disabled:opacity-40">+5 columnas</button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1">
        <span className="w-14 shrink-0 text-center text-[12px] font-semibold text-muted-foreground" aria-label="Celda activa">{activeKey}</span>
        <span className="text-[12px] font-semibold text-muted-foreground" aria-hidden="true">fx</span>
        <input aria-label="Contenido de la celda (las fórmulas empiezan con =)" value={barValue} readOnly={readOnly} spellCheck={false}
          onFocus={() => { if (!editing && !readOnly) startEdit(sel.fc, sel.fr, undefined, true); }}
          onChange={(e) => setEditing((cur) => (cur ? { ...cur, value: e.target.value } : { col: sel.fc, row: sel.fr, value: e.target.value, fromBar: true }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); endEdit(true, 'down'); } else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); } }}
          className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none" />
      </div>

      <div ref={root} tabIndex={0} role="grid" aria-label={`Hoja ${sheet.name}`} aria-rowcount={total} aria-colcount={sheet.colCount} onKeyDown={onKeyDown} onCopy={(e) => onCopy(e)} onCut={(e) => onCopy(e, true)} onPaste={onPaste}
        className="min-w-0 rounded-xl border border-border bg-card outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
        <div ref={scroller} onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })}
          className="overflow-auto" style={{ height: 'min(62vh, 640px)', scrollPaddingTop: ROW_H, scrollPaddingLeft: HEADER_W }}>
          <table className="org-sheet-grid" style={{ width: tableWidth }}>
            <colgroup><col style={{ width: HEADER_W }} />{cols.map((c) => <col key={c} style={{ width: widthOf(c) }} />)}</colgroup>
            <thead>
              <tr>
                <th aria-label="Seleccionar todo" onClick={() => setSel({ ac: 0, ar: 0, fc: sheet.colCount - 1, fr: sheet.rowCount - 1 })} />
                {cols.map((c) => (
                  <th key={c} scope="col" aria-selected={c >= rect.c0 && c <= rect.c1} className={cn('relative', c >= rect.c0 && c <= rect.c1 && 'bg-primary/15 text-primary dark:text-accent')}
                    onClick={() => setSel({ ac: c, ar: 0, fc: c, fr: sheet.rowCount - 1 })}>
                    {colToLetters(c)}
                    {!readOnly && <span role="separator" aria-label={`Ajustar el ancho de la columna ${colToLetters(c)}`} onMouseDown={(e) => startResize(e, c)} onClick={(e) => e.stopPropagation()} className="absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-primary/40" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topSpacer > 0 && <tr aria-hidden="true" style={{ height: topSpacer }}><td colSpan={sheet.colCount + 1} style={{ padding: 0, border: 0 }} /></tr>}
              {visibleRows.map((r) => (
                <tr key={r} aria-rowindex={r + 1}>
                  <th scope="row" style={frozen && r === 0 ? { top: ROW_H, zIndex: 3 } : undefined} className={cn(r >= rect.r0 && r <= rect.r1 && 'bg-primary/15 text-primary dark:text-accent')} onClick={() => setSel({ ac: 0, ar: r, fc: sheet.colCount - 1, fr: r })}>{r + 1}</th>
                  {cols.map((c) => {
                    const key = cellKey(c, r); const cell = sheet.cells[key]; const f = cell?.f;
                    if (merged.covered.has(key)) return null;
                    const span = merged.starts.get(key);
                    const pin = frozen && r === 0;
                    const isActive = c === sel.fc && r === sel.fr; const isEditing = editing && editing.col === c && editing.row === r && !editing.fromBar;
                    const value = cell?.v ? evaluator.value(sheet.name, c, r) : null;
                    const isError = value instanceof FormulaError;
                    const align = f?.al ?? (typeof value === 'number' ? 'right' : isError ? 'center' : 'left');
                    return (
                      <td key={c} data-cell={key} role="gridcell" colSpan={span?.cols} rowSpan={span ? spanOf(span.r0, span.r1) : undefined} aria-selected={inRange(c, r)} onMouseDown={(e) => onCellDown(e, c, r)} onMouseEnter={() => { if (dragging.current) setSel((s) => ({ ...s, fc: c, fr: r })); }} onDoubleClick={() => startEdit(c, r)}
                        className={cn('cursor-cell', filter && r === filter.row && c >= filter.c0 && c <= filter.c1 && 'relative pr-7', inRange(c, r) && !isActive && 'bg-primary/10', isActive && 'outline outline-2 -outline-offset-2 outline-primary', isError && 'text-destructive')}
                        style={{ textAlign: align, fontWeight: f?.b ? 700 : undefined, fontStyle: f?.i ? 'italic' : undefined, textDecoration: f?.u ? 'underline' : undefined, color: isError ? undefined : f?.fg, backgroundColor: inRange(c, r) && !isActive ? undefined : f?.bg ?? (pin ? 'var(--card)' : undefined), padding: isEditing ? 0 : undefined, boxShadow: f?.bd ? 'inset 0 0 0 1px var(--foreground)' : undefined, ...(pin ? { position: 'sticky' as const, top: ROW_H, zIndex: 1 } : {}) }}>
                        {isEditing ? (
                          <input autoFocus value={editing.value} spellCheck={false} aria-label={`Editar ${key}`}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })} onBlur={() => endEdit(true)}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter') { e.preventDefault(); endEdit(true, 'down'); } else if (e.key === 'Tab') { e.preventDefault(); endEdit(true, e.shiftKey ? 'left' : 'right'); } else if (e.key === 'Escape') { e.preventDefault(); endEdit(false); }
                            }}
                            className="h-full w-full bg-background px-1.5 text-[13px] outline-none" style={{ textAlign: align }} />
                        ) : formatValue(value, f?.nf)}
                        {filter && r === filter.row && c >= filter.c0 && c <= filter.c1 && (
                          <button type="button" aria-label={`Filtrar la columna ${colToLetters(c)}`} aria-haspopup="dialog" onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { const box = e.currentTarget.getBoundingClientRect(); setFilterMenu({ col: c, left: box.left, top: box.bottom + 4 }); }}
                            className={cn('absolute right-0.5 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded text-foreground hover:bg-muted', filter.rules[c] && 'bg-primary text-primary-foreground hover:bg-primary')}>
                            <Filter className="size-3" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {rowsAfter > 0 && <tr aria-hidden="true" style={{ height: rowsAfter * ROW_H }}><td colSpan={sheet.colCount + 1} style={{ padding: 0, border: 0 }} /></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {filterMenu && filter && (
        <SheetFilterMenu title={displayText(evaluator, sheet, filterMenu.col, filter.row)} values={filterValues} allowed={filter.rules[filterMenu.col] ?? null} anchor={filterMenu}
          onApply={(allowed) => applyFilter(filterMenu.col, allowed)} onClose={() => setFilterMenu(null)}
          onSort={readOnly ? undefined : (asc) => { setSel({ ac: filterMenu.col, ar: filter.row + 1, fc: filterMenu.col, fr: filter.row + 1 }); window.setTimeout(() => sortRows(asc), 0); }} />
      )}
      {(sheet.charts?.length ?? 0) > 0 && <SheetCharts charts={sheet.charts ?? []} sheet={sheet} evaluator={evaluator} readOnly={readOnly} onChange={(charts) => mapSheet((x) => ({ ...x, charts }))} />}

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Hojas del libro" className="flex min-w-0 max-w-full gap-1 overflow-x-auto">
          {wb.sheets.map((s, i) => (
            <div key={`${s.name}-${i}`} className={cn('flex shrink-0 items-center rounded-lg border text-[12px] font-semibold', i === sheetIndex ? 'border-primary bg-primary/10 text-primary dark:text-accent' : 'border-border')}>
              <button type="button" role="tab" aria-selected={i === sheetIndex} onClick={() => { if (editing) endEdit(true); setTab(i); setSel({ ac: 0, ar: 0, fc: 0, fr: 0 }); }} onDoubleClick={() => !readOnly && renameSheet(i)} title={readOnly ? s.name : `${s.name} (doble clic para renombrar)`} className="max-w-40 truncate px-3 py-1.5">{s.name}</button>
              {!readOnly && i === sheetIndex && wb.sheets.length > 1 && <button type="button" aria-label={`Borrar la hoja ${s.name}`} onClick={() => removeSheet(i)} className="pr-2 text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>}
            </div>
          ))}
          {!readOnly && <button type="button" aria-label="Agregar una hoja" title="Agregar una hoja" onClick={addSheet} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-border hover:bg-muted"><Plus className="size-4" /></button>}
        </div>
        <p className="ml-auto min-w-0 text-[11px] text-muted-foreground" aria-live="polite">{stats || (readOnly ? 'Solo lectura' : 'Escribe = para una fórmula, por ejemplo =SUMA(A1:A5)')}</p>
      </div>
    </div>
  );
});
