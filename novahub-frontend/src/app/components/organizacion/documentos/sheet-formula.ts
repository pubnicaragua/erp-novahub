/**
 * Motor de fórmulas de las hojas de cálculo de Organización > Documentos. Sin dependencias ni acceso a React,
 * para poder probarlo aparte. Soporta operadores (+ - * / ^ & % y comparaciones), referencias (A1, $A$1, A1:B5,
 * 'Otra hoja'!A1) y las funciones más usadas (SUMA/SUM, PROMEDIO/AVERAGE, SI/IF, etc.; nombres en español o inglés).
 */

export type CellValue = string | number | boolean | null;
export class FormulaError {
  readonly code: string;
  constructor(code: string) { this.code = code; }
  toString() { return this.code; }
}
export type Evaluated = CellValue | FormulaError;

/** Lectura del contenido crudo de una celda: texto escrito (las fórmulas empiezan con «=»). */
export type RawReader = (sheet: string, col: number, row: number) => string;

// ───────────── Referencias ─────────────
export function colToLetters(col: number): string {
  let n = col + 1; let out = '';
  while (n > 0) { const r = (n - 1) % 26; out = String.fromCharCode(65 + r) + out; n = Math.floor((n - 1) / 26); }
  return out;
}
export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export const cellKey = (col: number, row: number) => `${colToLetters(col)}${row + 1}`;
export function parseCellKey(key: string): { col: number; row: number } | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,6})$/.exec(key.trim());
  return m ? { col: lettersToCol(m[1]), row: Number(m[2]) - 1 } : null;
}

// ───────────── Léxico ─────────────
type Tok =
  | { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'bool'; v: boolean }
  | { t: 'ref'; sheet?: string; a: string; b?: string } | { t: 'name'; v: string }
  | { t: 'op'; v: string } | { t: 'lp' } | { t: 'rp' } | { t: 'sep' };

function tokenize(src: string): Tok[] {
  const out: Tok[] = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let j = i + 1; let s = '';
      while (j < src.length && !(src[j] === '"' && src[j + 1] !== '"')) { if (src[j] === '"') { s += '"'; j += 2; } else s += src[j++]; }
      if (j >= src.length) throw new FormulaError('#ERROR!');
      out.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    const sheetMatch = /^(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_.]*))!/.exec(src.slice(i));
    let sheet: string | undefined; let rest = i;
    if (sheetMatch) { sheet = (sheetMatch[1] ?? sheetMatch[2]).replace(/''/g, "'"); rest = i + sheetMatch[0].length; }
    const refMatch = /^(\$?[A-Za-z]{1,3}\$?\d{1,6})(?::(\$?[A-Za-z]{1,3}\$?\d{1,6}))?(?![A-Za-z0-9_(])/.exec(src.slice(rest));
    if (refMatch && (sheet !== undefined || !/^[A-Za-z]+\d+$/.test('') )) {
      out.push({ t: 'ref', sheet, a: refMatch[1], b: refMatch[2] }); i = rest + refMatch[0].length; continue;
    }
    if (sheet !== undefined) throw new FormulaError('#REF!');
    const num = /^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: 'num', v: Number(num[0]) }); i += num[0].length; continue; }
    const name = /^[A-Za-zÁÉÍÓÚÑáéíóúñ_][A-Za-z0-9ÁÉÍÓÚÑáéíóúñ_.]*/.exec(src.slice(i));
    if (name) {
      const upper = name[0].toUpperCase();
      if ((upper === 'TRUE' || upper === 'VERDADERO') && src[i + name[0].length] !== '(') out.push({ t: 'bool', v: true });
      else if ((upper === 'FALSE' || upper === 'FALSO') && src[i + name[0].length] !== '(') out.push({ t: 'bool', v: false });
      else out.push({ t: 'name', v: upper });
      i += name[0].length; continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&%=<>'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
    if (c === '(') { out.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { out.push({ t: 'rp' }); i++; continue; }
    if (c === ',' || c === ';') { out.push({ t: 'sep' }); i++; continue; }
    throw new FormulaError('#ERROR!');
  }
  return out;
}

// ───────────── Sintaxis ─────────────
type Node =
  | { k: 'num'; v: number } | { k: 'str'; v: string } | { k: 'bool'; v: boolean }
  | { k: 'ref'; sheet?: string; a: string; b?: string }
  | { k: 'un'; op: string; x: Node } | { k: 'pct'; x: Node } | { k: 'bin'; op: string; l: Node; r: Node }
  | { k: 'fn'; name: string; args: Node[] };

function parse(tokens: Tok[]): Node {
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (...ops: string[]) => { const t = tokens[p]; return t?.t === 'op' && ops.includes(t.v); };
  const cmp = (): Node => {
    let l = concat();
    while (isOp('=', '<>', '<', '>', '<=', '>=')) { const op = (tokens[p++] as { v: string }).v; l = { k: 'bin', op, l, r: concat() }; }
    return l;
  };
  const concat = (): Node => { let l = add(); while (isOp('&')) { p++; l = { k: 'bin', op: '&', l, r: add() }; } return l; };
  const add = (): Node => { let l = mul(); while (isOp('+', '-')) { const op = (tokens[p++] as { v: string }).v; l = { k: 'bin', op, l, r: mul() }; } return l; };
  const mul = (): Node => { let l = pow(); while (isOp('*', '/')) { const op = (tokens[p++] as { v: string }).v; l = { k: 'bin', op, l, r: pow() }; } return l; };
  const pow = (): Node => { let l = unary(); while (isOp('^')) { p++; l = { k: 'bin', op: '^', l, r: unary() }; } return l; };
  const unary = (): Node => {
    if (isOp('-', '+')) { const op = (tokens[p++] as { v: string }).v; return { k: 'un', op, x: unary() }; }
    return postfix();
  };
  const postfix = (): Node => { let x = primary(); while (isOp('%')) { p++; x = { k: 'pct', x }; } return x; };
  const primary = (): Node => {
    const t = peek();
    if (!t) throw new FormulaError('#ERROR!');
    p++;
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'str') return { k: 'str', v: t.v };
    if (t.t === 'bool') return { k: 'bool', v: t.v };
    if (t.t === 'ref') return { k: 'ref', sheet: t.sheet, a: t.a, b: t.b };
    if (t.t === 'lp') { const e = cmp(); if (tokens[p++]?.t !== 'rp') throw new FormulaError('#ERROR!'); return e; }
    if (t.t === 'name') {
      if (tokens[p]?.t !== 'lp') throw new FormulaError('#NAME?');
      p++;
      const args: Node[] = [];
      if (tokens[p]?.t === 'rp') { p++; return { k: 'fn', name: t.v, args }; }
      for (;;) {
        args.push(cmp());
        const next = tokens[p++];
        if (next?.t === 'rp') break;
        if (next?.t !== 'sep') throw new FormulaError('#ERROR!');
      }
      return { k: 'fn', name: t.v, args };
    }
    throw new FormulaError('#ERROR!');
  };
  const root = cmp();
  if (p < tokens.length) throw new FormulaError('#ERROR!');
  return root;
}

// ───────────── Evaluación ─────────────
const ALIASES: Record<string, string> = {
  SUMA: 'SUM', PROMEDIO: 'AVERAGE', MAX: 'MAX', MIN: 'MIN', CONTAR: 'COUNT', CONTARA: 'COUNTA', SI: 'IF', 'SI.ERROR': 'IFERROR', Y: 'AND', O: 'OR', NO: 'NOT',
  REDONDEAR: 'ROUND', ABS: 'ABS', RAIZ: 'SQRT', POTENCIA: 'POWER', RESIDUO: 'MOD', ENTERO: 'INT', LARGO: 'LEN', MAYUSC: 'UPPER', MINUSC: 'LOWER',
  CONCATENAR: 'CONCAT', CONCATENATE: 'CONCAT', HOY: 'TODAY', 'SUMAR.SI': 'SUMIF', 'CONTAR.SI': 'COUNTIF', PRODUCTO: 'PRODUCT', MEDIANA: 'MEDIAN',
  AHORA: 'NOW', 'REDONDEAR.MAS': 'ROUNDUP', 'REDONDEAR.MENOS': 'ROUNDDOWN', TEXTO: 'TEXT', IZQUIERDA: 'LEFT', DERECHA: 'RIGHT', ESBLANCO: 'ISBLANK',
};

interface Range { values: Evaluated[] }
const isRange = (v: unknown): v is Range => typeof v === 'object' && v !== null && 'values' in (v as object);

export interface EvalContext {
  read: RawReader;
  sheet: string;
  /** Hojas existentes (para validar referencias entre hojas). */
  hasSheet?: (name: string) => boolean;
}

export class Evaluator {
  private cache = new Map<string, Evaluated>();
  private stack = new Set<string>();
  private parsed = new Map<string, Node | FormulaError>();
  private readonly read: RawReader;
  private readonly hasSheet: (name: string) => boolean;
  constructor(read: RawReader, hasSheet: (name: string) => boolean = () => true) { this.read = read; this.hasSheet = hasSheet; }

  /** Valor calculado de una celda (los textos que parecen números se convierten). */
  value(sheet: string, col: number, row: number): Evaluated {
    const id = `${sheet}\u0000${col},${row}`;
    if (this.cache.has(id)) return this.cache.get(id)!;
    if (this.stack.has(id)) return new FormulaError('#CIRC!');
    this.stack.add(id);
    let result: Evaluated;
    try {
      const raw = this.read(sheet, col, row);
      result = raw.startsWith('=') && raw.length > 1 ? this.formula(raw.slice(1), sheet) : literal(raw);
    } finally { this.stack.delete(id); }
    this.cache.set(id, result);
    return result;
  }

  private formula(src: string, sheet: string): Evaluated {
    let node = this.parsed.get(src);
    if (!node) {
      try { node = parse(tokenize(src)); } catch (e) { node = e instanceof FormulaError ? e : new FormulaError('#ERROR!'); }
      this.parsed.set(src, node);
    }
    if (node instanceof FormulaError) return node;
    try {
      const out = this.eval(node, sheet);
      if (isRange(out)) return out.values[0] ?? null;
      return out;
    } catch (e) { return e instanceof FormulaError ? e : new FormulaError('#ERROR!'); }
  }

  private range(ref: Extract<Node, { k: 'ref' }>, sheet: string): Range | Evaluated {
    const target = ref.sheet ?? sheet;
    if (!this.hasSheet(target)) throw new FormulaError('#REF!');
    const a = parseCellKey(ref.a); const b = ref.b ? parseCellKey(ref.b) : a;
    if (!a || !b) throw new FormulaError('#REF!');
    if (!ref.b) return this.value(target, a.col, a.row);
    const values: Evaluated[] = [];
    const c0 = Math.min(a.col, b.col); const c1 = Math.max(a.col, b.col); const r0 = Math.min(a.row, b.row); const r1 = Math.max(a.row, b.row);
    if ((c1 - c0 + 1) * (r1 - r0 + 1) > 200_000) throw new FormulaError('#VALUE!');
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) values.push(this.value(target, c, r));
    return { values };
  }

  private eval(node: Node, sheet: string): Evaluated | Range {
    switch (node.k) {
      case 'num': case 'str': case 'bool': return node.v;
      case 'ref': return this.range(node, sheet);
      case 'pct': return num(this.scalar(node.x, sheet)) / 100;
      case 'un': { const v = num(this.scalar(node.x, sheet)); return node.op === '-' ? -v : v; }
      case 'bin': {
        const l = this.scalar(node.l, sheet); const r = this.scalar(node.r, sheet);
        if (node.op === '&') return text(l) + text(r);
        if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) return compare(node.op, l, r);
        const a = num(l); const b = num(r);
        switch (node.op) {
          case '+': return a + b; case '-': return a - b; case '*': return a * b;
          case '/': if (b === 0) throw new FormulaError('#DIV/0!'); return a / b;
          case '^': { const v = a ** b; if (!Number.isFinite(v)) throw new FormulaError('#NUM!'); return v; }
        }
        throw new FormulaError('#ERROR!');
      }
      case 'fn': return this.call(node, sheet);
    }
  }

  private scalar(node: Node, sheet: string): CellValue {
    const v = this.eval(node, sheet);
    const one = isRange(v) ? v.values[0] ?? null : v;
    if (one instanceof FormulaError) throw one;
    return one;
  }

  private flat(args: Node[], sheet: string, onlyNumbers = true): number[] {
    const out: number[] = [];
    for (const arg of args) {
      const v = this.eval(arg, sheet);
      const items = isRange(v) ? v.values : [v];
      const fromRange = isRange(v);
      for (const item of items) {
        if (item instanceof FormulaError) throw item;
        if (typeof item === 'number') out.push(item);
        else if (!fromRange && typeof item === 'boolean') out.push(item ? 1 : 0);
        else if (!fromRange && typeof item === 'string' && item.trim() !== '' && !Number.isNaN(Number(item))) out.push(Number(item));
        else if (!fromRange && typeof item === 'string' && onlyNumbers && item.trim() !== '') throw new FormulaError('#VALUE!');
      }
    }
    return out;
  }

  private call(node: Extract<Node, { k: 'fn' }>, sheet: string): Evaluated | Range {
    const name = ALIASES[node.name] ?? node.name;
    const args = node.args;
    const need = (min: number, max = min) => { if (args.length < min || args.length > max) throw new FormulaError('#ERROR!'); };
    const s = (i: number) => this.scalar(args[i], sheet);
    switch (name) {
      case 'SUM': return this.flat(args, sheet).reduce((a, b) => a + b, 0);
      case 'PRODUCT': return this.flat(args, sheet).reduce((a, b) => a * b, 1);
      case 'AVERAGE': { const v = this.flat(args, sheet); if (!v.length) throw new FormulaError('#DIV/0!'); return v.reduce((a, b) => a + b, 0) / v.length; }
      case 'MEDIAN': { const v = this.flat(args, sheet).sort((a, b) => a - b); if (!v.length) throw new FormulaError('#NUM!'); const m = Math.floor(v.length / 2); return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; }
      case 'MIN': { const v = this.flat(args, sheet); return v.length ? Math.min(...v) : 0; }
      case 'MAX': { const v = this.flat(args, sheet); return v.length ? Math.max(...v) : 0; }
      case 'COUNT': return this.flat(args, sheet, false).length;
      case 'COUNTA': {
        let n = 0;
        for (const arg of args) { const v = this.eval(arg, sheet); for (const item of isRange(v) ? v.values : [v]) if (item !== null && item !== '') n++; }
        return n;
      }
      case 'IF': { need(2, 3); const cond = truthy(s(0)); return cond ? this.eval(args[1], sheet) : args[2] ? this.eval(args[2], sheet) : false; }
      case 'IFERROR': { need(2); try { const v = this.eval(args[0], sheet); const one = isRange(v) ? v.values[0] : v; if (one instanceof FormulaError) throw one; return v; } catch { return this.eval(args[1], sheet); } }
      case 'AND': return args.every((_, i) => truthy(s(i)));
      case 'OR': return args.some((_, i) => truthy(s(i)));
      case 'NOT': need(1); return !truthy(s(0));
      case 'ROUND': { need(1, 2); return round(num(s(0)), args[1] ? num(s(1)) : 0, 'half'); }
      case 'ROUNDUP': { need(1, 2); return round(num(s(0)), args[1] ? num(s(1)) : 0, 'up'); }
      case 'ROUNDDOWN': { need(1, 2); return round(num(s(0)), args[1] ? num(s(1)) : 0, 'down'); }
      case 'ABS': need(1); return Math.abs(num(s(0)));
      case 'INT': need(1); return Math.floor(num(s(0)));
      case 'SQRT': { need(1); const v = num(s(0)); if (v < 0) throw new FormulaError('#NUM!'); return Math.sqrt(v); }
      case 'POWER': need(2); return num(s(0)) ** num(s(1));
      case 'MOD': { need(2); const d = num(s(1)); if (d === 0) throw new FormulaError('#DIV/0!'); const n = num(s(0)); return n - d * Math.floor(n / d); }
      case 'LEN': need(1); return text(s(0)).length;
      case 'UPPER': need(1); return text(s(0)).toUpperCase();
      case 'LOWER': need(1); return text(s(0)).toLowerCase();
      case 'LEFT': need(1, 2); return text(s(0)).slice(0, args[1] ? num(s(1)) : 1);
      case 'RIGHT': { need(1, 2); const t = text(s(0)); const n = args[1] ? num(s(1)) : 1; return n <= 0 ? '' : t.slice(-n); }
      case 'CONCAT': return args.map((_, i) => text(s(i))).join('');
      case 'TEXT': need(1, 2); return text(s(0));
      case 'ISBLANK': need(1); return s(0) === null || s(0) === '';
      case 'TODAY': return Math.floor(Date.now() / 86_400_000) + 25_569;
      case 'NOW': return Date.now() / 86_400_000 + 25_569;
      case 'SUMIF': case 'COUNTIF': {
        need(2, 3);
        const criteria = this.scalar(args[1], sheet);
        const test = this.eval(args[0], sheet); const sum = args[2] ? this.eval(args[2], sheet) : test;
        const tests = isRange(test) ? test.values : [test]; const sums = isRange(sum) ? sum.values : [sum];
        let total = 0; let count = 0;
        tests.forEach((value, i) => {
          if (value instanceof FormulaError || !matches(value, criteria)) return;
          count++; const add = sums[i]; if (typeof add === 'number') total += add;
        });
        return name === 'COUNTIF' ? count : total;
      }
      default: throw new FormulaError('#NAME?');
    }
  }
}

function literal(raw: string): Evaluated {
  if (raw === '') return null;
  const t = raw.trim();
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
  if (/^-?(\d+\.?\d*|\.\d+)%$/.test(t)) return Number(t.slice(0, -1)) / 100;
  if (t.toUpperCase() === 'TRUE' || t.toUpperCase() === 'VERDADERO') return true;
  if (t.toUpperCase() === 'FALSE' || t.toUpperCase() === 'FALSO') return false;
  return raw;
}
function num(v: CellValue): number {
  if (v === null || v === '') return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(v.trim());
  if (Number.isNaN(n)) throw new FormulaError('#VALUE!');
  return n;
}
const text = (v: CellValue) => (v === null ? '' : typeof v === 'boolean' ? (v ? 'VERDADERO' : 'FALSO') : String(v));
const truthy = (v: CellValue) => (typeof v === 'string' ? v.toUpperCase() === 'TRUE' || v.toUpperCase() === 'VERDADERO' : Boolean(v));
function compare(op: string, l: CellValue, r: CellValue): boolean {
  const both = typeof l === 'string' && typeof r === 'string';
  const a = both ? l.toLowerCase() : typeof l === 'string' || typeof r === 'string' ? text(l).toLowerCase() : num(l);
  const b = both ? (r as string).toLowerCase() : typeof l === 'string' || typeof r === 'string' ? text(r).toLowerCase() : num(r);
  switch (op) { case '=': return a === b; case '<>': return a !== b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; default: return a >= b; }
}
function round(v: number, digits: number, mode: 'half' | 'up' | 'down'): number {
  const f = 10 ** Math.trunc(digits); const x = v * f;
  const r = mode === 'half' ? Math.sign(x) * Math.round(Math.abs(x) + 1e-9) : mode === 'up' ? Math.sign(x) * Math.ceil(Math.abs(x) - 1e-9) : Math.sign(x) * Math.floor(Math.abs(x) + 1e-9);
  return r / f;
}
function matches(value: Evaluated, criteria: CellValue): boolean {
  if (typeof criteria === 'string') {
    const m = /^(<=|>=|<>|<|>|=)(.*)$/.exec(criteria);
    if (m) { const rhs = literal(m[2]) as CellValue; if (value === null) return false; try { return compare(m[1], value as CellValue, rhs); } catch { return false; } }
    return text(value as CellValue).toLowerCase() === criteria.toLowerCase();
  }
  return value === criteria;
}

// ───────────── Presentación ─────────────
export type NumberFormat = 'general' | 'number' | 'currency' | 'percent' | 'date';

export function formatValue(value: Evaluated, format: NumberFormat = 'general'): string {
  if (value instanceof FormulaError) return value.code;
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'VERDADERO' : 'FALSO';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '#NUM!';
  switch (format) {
    case 'number': return new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    case 'currency': return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', currencyDisplay: 'narrowSymbol' }).format(value);
    case 'percent': return new Intl.NumberFormat('es-NI', { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
    case 'date': { const d = new Date(Math.round((value - 25_569) * 86_400_000)); return Number.isNaN(d.getTime()) ? String(value) : new Intl.DateTimeFormat('es-NI', { timeZone: 'UTC', dateStyle: 'short' }).format(d); }
    default: return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 10, useGrouping: false }).format(value);
  }
}

/** Mueve las referencias relativas de una fórmula al copiarla/pegarla (A1 → B2 al bajar y avanzar una celda). */
export function shiftFormula(formula: string, dCol: number, dRow: number): string {
  if (!formula.startsWith('=')) return formula;
  return formula.replace(/("[^"]*")|('(?:[^']|'')+'!|[A-Za-z_][A-Za-z0-9_.]*!)?(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})(?![A-Za-z0-9_(])/g,
    (_all, str, sheet, absC, letters, absR, row) => {
      if (str) return str;
      const col = absC ? lettersToCol(letters) : lettersToCol(letters) + dCol;
      const r = absR ? Number(row) : Number(row) + dRow;
      if (col < 0 || r < 1) return '#REF!';
      return `${sheet ?? ''}${absC}${colToLetters(col)}${absR}${r}`;
    });
}

/** Fórmula con nombres de función en inglés y comas, que es lo que entiende Excel al abrir el .xlsx. */
export function toExcelFormula(src: string): string {
  return src.replace(/("(?:[^"]|"")*")|([A-Za-zÁÉÍÓÚÑ_][A-Za-z0-9ÁÉÍÓÚÑ_.]*)(?=\()|;/g, (_all, str: string | undefined, fn: string | undefined) => {
    if (str) return str;
    if (!fn) return ',';
    const upper = fn.toUpperCase();
    return ALIASES[upper] ?? upper;
  });
}
