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
  BUSCARV: 'VLOOKUP', BUSCARH: 'HLOOKUP', INDICE: 'INDEX', COINCIDIR: 'MATCH', 'SUMAR.SI.CONJUNTO': 'SUMIFS', 'CONTAR.SI.CONJUNTO': 'COUNTIFS',
  'PROMEDIO.SI': 'AVERAGEIF', 'AÑO': 'YEAR', MES: 'MONTH', DIA: 'DAY', DIAS: 'DAYS', FECHA: 'DATE', EXTRAE: 'MID', ESPACIOS: 'TRIM', SUSTITUIR: 'SUBSTITUTE',
  VALOR: 'VALUE', 'K.ESIMO.MAYOR': 'LARGE', 'K.ESIMO.MENOR': 'SMALL', 'CONTAR.BLANCO': 'COUNTBLANK', ESNUMERO: 'ISNUMBER', ESTEXTO: 'ISTEXT',
  'UNIR.CADENAS': 'TEXTJOIN', TRUNCAR: 'TRUNC', SUMAPRODUCTO: 'SUMPRODUCT', PAGO: 'PMT', 'SI.ND': 'IFNA', ENCONTRAR: 'FIND', NOMPROPIO: 'PROPER',
  SIGNO: 'SIGN', 'MES.FIN': 'EOMONTH', 'DIAS.LAB': 'NETWORKDAYS', 'O.EXCLUSIVO': 'XOR', REPETIR: 'REPT',
};

interface Range { values: Evaluated[]; cols: number }
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
    return { values, cols: c1 - c0 + 1 };
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
      default: return this.callMore(name, args, sheet);
    }
  }

  private table(node: Node, sheet: string): { cells: Evaluated[]; cols: number; rows: number } {
    const v = this.eval(node, sheet);
    if (!isRange(v)) return { cells: [v], cols: 1, rows: 1 };
    return { cells: v.values, cols: v.cols, rows: Math.ceil(v.values.length / Math.max(1, v.cols)) };
  }

  private pairs(args: Node[], sheet: string, from: number): Array<{ cells: Evaluated[]; criteria: CellValue }> {
    const out: Array<{ cells: Evaluated[]; criteria: CellValue }> = [];
    for (let i = from; i + 1 < args.length; i += 2) out.push({ cells: this.table(args[i], sheet).cells, criteria: this.scalar(args[i + 1], sheet) });
    return out;
  }

  private callMore(name: string, args: Node[], sheet: string): Evaluated | Range {
    const need = (min: number, max = min) => { if (args.length < min || args.length > max) throw new FormulaError('#ERROR!'); };
    const s = (i: number) => this.scalar(args[i], sheet);
    const values = (i: number): Evaluated[] => this.table(args[i], sheet).cells;
    switch (name) {
      case 'VLOOKUP': case 'HLOOKUP': {
        need(3, 4);
        const key = s(0); const t = this.table(args[1], sheet); const idx = Math.trunc(num(s(2)));
        const exact = args[3] ? !truthy(s(3)) : false;
        const horizontal = name === 'HLOOKUP';
        const lines = horizontal ? t.cols : t.rows; const width = horizontal ? t.rows : t.cols;
        if (idx < 1 || idx > width) throw new FormulaError('#REF!');
        const at = (line: number, k: number) => (horizontal ? t.cells[k * t.cols + line] : t.cells[line * t.cols + k]);
        let found = -1;
        for (let line = 0; line < lines; line++) {
          const cell = at(line, 0);
          if (cell instanceof FormulaError) continue;
          if (exact) { if (cell !== null && key !== null && compare('=', cell, key)) { found = line; break; } } else if (cell !== null && key !== null && typeof cell === typeof key && compare('<=', cell, key)) found = line;
        }
        if (found < 0) throw new FormulaError('#N/A');
        const out = at(found, idx - 1); if (out instanceof FormulaError) throw out;
        return out ?? null;
      }
      case 'INDEX': {
        need(2, 3);
        const t = this.table(args[0], sheet); const a = Math.trunc(num(s(1)));
        const oneRow = t.rows === 1 && !args[2];
        const row = oneRow ? 1 : a; const col = oneRow ? a : (args[2] ? Math.trunc(num(s(2))) || 1 : 1);
        if (row < 1 || row > t.rows || col < 1 || col > t.cols) throw new FormulaError('#REF!');
        const out = t.cells[(row - 1) * t.cols + (col - 1)]; if (out instanceof FormulaError) throw out;
        return out ?? null;
      }
      case 'MATCH': {
        need(2, 3);
        const key = s(0); const cells = values(1); const mode = args[2] ? num(s(2)) : 1;
        let found = -1;
        cells.forEach((cell, i) => {
          if (cell instanceof FormulaError || cell === null || key === null) return;
          if (mode === 0) { if (found < 0 && compare('=', cell, key)) found = i; } else if (typeof cell === typeof key && compare('<=', cell, key)) found = i;
        });
        if (found < 0) throw new FormulaError('#N/A');
        return found + 1;
      }
      case 'SUMIFS': case 'COUNTIFS': {
        const isSum = name === 'SUMIFS';
        const sums = isSum ? values(0) : [];
        const conds = this.pairs(args, sheet, isSum ? 1 : 0);
        if (!conds.length) throw new FormulaError('#ERROR!');
        const size = isSum ? sums.length : conds[0].cells.length;
        let total = 0; let count = 0;
        for (let i = 0; i < size; i++) {
          if (!conds.every((c) => { const v = c.cells[i]; return v !== undefined && !(v instanceof FormulaError) && matches(v, c.criteria); })) continue;
          count++; const add = sums[i]; if (typeof add === 'number') total += add;
        }
        return isSum ? total : count;
      }
      case 'AVERAGEIF': {
        need(2, 3);
        const crit = s(1); const test = values(0); const avg = args[2] ? values(2) : test;
        let total = 0; let count = 0;
        test.forEach((v, i) => { const x = avg[i]; if (!(v instanceof FormulaError) && matches(v, crit) && typeof x === 'number') { total += x; count++; } });
        if (!count) throw new FormulaError('#DIV/0!');
        return total / count;
      }
      case 'SUMPRODUCT': {
        const lists = args.map((_, i) => values(i));
        const n = lists[0]?.length ?? 0;
        if (!lists.length || lists.some((l) => l.length !== n)) throw new FormulaError('#VALUE!');
        let total = 0;
        for (let i = 0; i < n; i++) total += lists.reduce((acc, l) => { const x = l[i]; return acc * (typeof x === 'number' ? x : 0); }, 1);
        return total;
      }
      case 'LARGE': case 'SMALL': {
        need(2); const k = Math.trunc(num(s(1)));
        const v = values(0).filter((x): x is number => typeof x === 'number').sort((a, b) => (name === 'LARGE' ? b - a : a - b));
        if (k < 1 || k > v.length) throw new FormulaError('#NUM!');
        return v[k - 1];
      }
      case 'COUNTBLANK': return values(0).filter((v) => v === null || v === '').length;
      case 'ISNUMBER': need(1); return typeof s(0) === 'number';
      case 'ISTEXT': { need(1); const v = s(0); return typeof v === 'string' && v !== ''; }
      case 'IFNA': { need(2); try { const v = this.eval(args[0], sheet); const one = isRange(v) ? v.values[0] : v; if (one instanceof FormulaError) throw one; return v; } catch { return this.eval(args[1], sheet); } }
      case 'XOR': return args.filter((_, i) => truthy(s(i))).length % 2 === 1;
      case 'PI': return Math.PI;
      case 'SIGN': need(1); return Math.sign(num(s(0)));
      case 'TRUNC': { need(1, 2); const f = 10 ** Math.trunc(args[1] ? num(s(1)) : 0); return Math.trunc(num(s(0)) * f) / f; }
      case 'MID': { need(3); const start = Math.trunc(num(s(1))); const len = Math.trunc(num(s(2))); if (start < 1 || len < 0) throw new FormulaError('#VALUE!'); return text(s(0)).slice(start - 1, start - 1 + len); }
      case 'TRIM': need(1); return text(s(0)).trim().replace(/\s+/g, ' ');
      case 'PROPER': need(1); return text(s(0)).toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_a, p: string, c: string) => p + c.toUpperCase());
      case 'REPT': { need(2); const n = Math.trunc(num(s(1))); if (n < 0 || n > 1000) throw new FormulaError('#VALUE!'); return text(s(0)).repeat(n); }
      case 'FIND': { need(2, 3); const at = text(s(1)).indexOf(text(s(0)), args[2] ? Math.trunc(num(s(2))) - 1 : 0); if (at < 0) throw new FormulaError('#VALUE!'); return at + 1; }
      case 'SUBSTITUTE': { need(3); const from = text(s(1)); return from === '' ? text(s(0)) : text(s(0)).split(from).join(text(s(2))); }
      case 'VALUE': { need(1); const v = s(0); if (typeof v === 'number') return v; const t = text(v).trim(); const n = Number(t.replace(/%$/, '')); if (Number.isNaN(n)) throw new FormulaError('#VALUE!'); return t.endsWith('%') ? n / 100 : n; }
      case 'TEXTJOIN': {
        need(3, 255); const sep = text(s(0)); const skip = truthy(s(1)); const parts: string[] = [];
        for (let i = 2; i < args.length; i++) for (const v of values(i)) { if (v instanceof FormulaError) throw v; if (skip && (v === null || v === '')) continue; parts.push(text(v)); }
        return parts.join(sep);
      }
      case 'YEAR': case 'MONTH': case 'DAY': {
        need(1); const d = serialToUtc(num(s(0)));
        return name === 'YEAR' ? d.getUTCFullYear() : name === 'MONTH' ? d.getUTCMonth() + 1 : d.getUTCDate();
      }
      case 'DATE': { need(3); return Date.UTC(Math.trunc(num(s(0))), Math.trunc(num(s(1))) - 1, Math.trunc(num(s(2)))) / 86_400_000 + 25_569; }
      case 'DAYS': need(2); return Math.trunc(num(s(0))) - Math.trunc(num(s(1)));
      case 'EOMONTH': { need(2); const d = serialToUtc(num(s(0))); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.trunc(num(s(1))) + 1, 0) / 86_400_000 + 25_569; }
      case 'NETWORKDAYS': {
        need(2); let a = Math.trunc(num(s(0))); const b = Math.trunc(num(s(1))); const step = a <= b ? 1 : -1; let n = 0;
        if (Math.abs(b - a) > 36_600) throw new FormulaError('#NUM!');
        for (;;) { const wd = serialToUtc(a).getUTCDay(); if (wd !== 0 && wd !== 6) n++; if (a === b) break; a += step; }
        return step === 1 ? n : -n;
      }
      case 'PMT': {
        need(3, 5); const rate = num(s(0)); const n = num(s(1)); const pv = num(s(2)); const fv = args[3] ? num(s(3)) : 0; const type = args[4] ? num(s(4)) : 0;
        if (n === 0) throw new FormulaError('#NUM!');
        if (rate === 0) return -(pv + fv) / n;
        const f = (1 + rate) ** n;
        return -(rate * (pv * f + fv)) / ((1 + rate * type) * (f - 1));
      }
      default: throw new FormulaError('#NAME?');
    }
  }
}

const serialToUtc = (serial: number) => new Date(Math.round((serial - 25_569) * 86_400_000));

function literal(raw: string): Evaluated {
  if (raw === '') return null;
  const t = raw.trim();
  if (/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return Number(t);
  if (/^-?(\d+\.?\d*|\.\d+)%$/.test(t)) return Number(t.slice(0, -1)) / 100;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) / 86_400_000 + 25_569;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (dmy) return Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) / 86_400_000 + 25_569;
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
export type NumberFormat = 'general' | 'integer' | 'number' | 'currency' | 'usd' | 'percent' | 'date';

/** ¿El texto escrito es una fecha (para aplicar el formato de fecha automáticamente)? */
export const looksLikeDate = (text: string) => /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(text.trim());

export function formatValue(value: Evaluated, format: NumberFormat = 'general'): string {
  if (value instanceof FormulaError) return value.code;
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'VERDADERO' : 'FALSO';
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '#NUM!';
  switch (format) {
    case 'integer': return new Intl.NumberFormat('es-NI', { maximumFractionDigits: 0 }).format(value);
    case 'usd': return new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol' }).format(value);
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

/**
 * Ajusta las referencias de una fórmula cuando se insertan (count > 0) o borran (count < 0) filas o columnas.
 * `target` es la hoja donde ocurre el cambio y `home` la hoja que contiene la fórmula
 * (las referencias sin hoja apuntan a `home`).
 */
export function rewriteRefs(formula: string, home: string, target: string, axis: 'row' | 'col', at: number, count: number): string {
  if (!formula.startsWith('=')) return formula;
  const re = /("[^"]*")|('(?:[^']|'')+'!|[A-Za-z_][A-Za-z0-9_.]*!)?(\$?[A-Za-z]{1,3}\$?\d{1,6})(?::(\$?[A-Za-z]{1,3}\$?\d{1,6}))?(?![A-Za-z0-9_(])/g;
  const move = (ref: string, isEnd: boolean, ranged: boolean): string => {
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,6})$/.exec(ref);
    if (!m) return ref;
    let col = lettersToCol(m[2]); let row = Number(m[4]) - 1;
    const v = axis === 'row' ? row : col;
    let nv = v;
    if (count > 0) { if (v >= at) nv = v + count; } else {
      const n = -count;
      if (v >= at + n) nv = v - n;
      else if (v >= at) { if (!ranged) return '#REF!'; nv = isEnd ? at - 1 : at; }
    }
    if (nv < 0) return '#REF!';
    if (axis === 'row') row = nv; else col = nv;
    return m[1] + colToLetters(col) + m[3] + String(row + 1);
  };
  return formula.replace(re, (all: string, str: string | undefined, sheet: string | undefined, a: string, b: string | undefined) => {
    if (str) return str;
    const name = sheet ? sheet.slice(0, -1).replace(/^'|'$/g, '').replace(/''/g, "'") : home;
    if (name !== target) return all;
    const first = move(a, false, Boolean(b)); const second = b ? move(b, true, true) : undefined;
    if (first === '#REF!' || second === '#REF!') return '#REF!';
    if (second !== undefined) {
      const pa = parseCellKey(first); const pb = parseCellKey(second);
      if (pa && pb && (pb.row < pa.row || pb.col < pa.col)) return '#REF!';
    }
    return (sheet ?? '') + first + (second ? ':' + second : '');
  });
}
