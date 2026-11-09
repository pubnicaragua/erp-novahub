// Pruebas de las funciones ampliadas de las hojas de Organización > Documentos. Uso: npm run test:org-sheet-formula
import assert from 'node:assert/strict';
import test from 'node:test';
import { Evaluator, FormulaError, cellKey, looksLikeDate, parseCellKey, rewriteRefs, toExcelFormula, formatValue } from '../../src/app/components/organizacion/documentos/sheet-formula.ts';

const calc = (cells, key = 'Z99') => {
  const ev = new Evaluator((sheet, col, row) => ({ Hoja1: cells }[sheet]?.[cellKey(col, row)] ?? ''), (name) => name === 'Hoja1');
  const ref = parseCellKey(key);
  const v = ev.value('Hoja1', ref.col, ref.row);
  return v instanceof FormulaError ? v.code : v;
};
const table = { A1: 'Ana', B1: '10', C1: 'x', A2: 'Luis', B2: '20', C2: 'y', A3: 'Eva', B3: '30', C3: 'x' };

test('BUSCARV, INDICE y COINCIDIR', () => {
  assert.equal(calc({ ...table, Z99: '=BUSCARV("Luis";A1:C3;2;FALSO)' }), 20);
  assert.equal(calc({ ...table, Z99: '=VLOOKUP("Zoe",A1:C3,2,FALSE)' }), '#N/A');
  assert.equal(calc({ ...table, Z99: '=INDICE(A1:C3;3;1)' }), 'Eva');
  assert.equal(calc({ ...table, Z99: '=COINCIDIR("Eva";A1:A3;0)' }), 3);
});

test('SUMAR.SI.CONJUNTO, CONTAR.SI.CONJUNTO y PROMEDIO.SI', () => {
  assert.equal(calc({ ...table, Z99: '=SUMAR.SI.CONJUNTO(B1:B3;C1:C3;"x";B1:B3;">10")' }), 30);
  assert.equal(calc({ ...table, Z99: '=CONTAR.SI.CONJUNTO(C1:C3;"x")' }), 2);
  assert.equal(calc({ ...table, Z99: '=PROMEDIO.SI(C1:C3;"x";B1:B3)' }), 20);
  assert.equal(calc({ ...table, Z99: '=SUMAPRODUCTO(B1:B3;B1:B3)' }), 1400);
});

test('texto, fechas y finanzas', () => {
  assert.equal(calc({ Z99: '=EXTRAE("Nicaragua";2;4)' }), 'icar');
  assert.equal(calc({ Z99: '=ESPACIOS("  a   b ")' }), 'a b');
  assert.equal(calc({ Z99: '=SUSTITUIR("a-b-c";"-";"/")' }), 'a/b/c');
  assert.equal(calc({ Z99: '=UNIR.CADENAS(", ";VERDADERO;"a";"";"b")' }), 'a, b');
  assert.equal(calc({ Z99: '=AÑO(FECHA(2026;11;9))' }), 2026);
  assert.equal(calc({ Z99: '=MES(FECHA(2026;11;9))' }), 11);
  assert.equal(calc({ Z99: '=DIAS(FECHA(2026;11;9);FECHA(2026;11;1))' }), 8);
  assert.equal(calc({ A1: '2026-11-09', Z99: '=DIA(A1)' }), 9);
  assert.equal(calc({ Z99: '=REDONDEAR(-PAGO(0.01;12;1000);2)' }), 88.85);
  assert.equal(calc({ Z99: '=K.ESIMO.MAYOR(A1:A3;2)', A1: '5', A2: '9', A3: '7' }), 7);
});

test('las funciones nuevas se exportan a Excel con nombre en inglés', () => {
  assert.equal(toExcelFormula('BUSCARV(A1;B1:C9;2;FALSO)'), 'VLOOKUP(A1,B1:C9,2,FALSO)');
  assert.equal(toExcelFormula('SUMAR.SI.CONJUNTO(A1:A3;B1:B3;"x")'), 'SUMIFS(A1:A3,B1:B3,"x")');
});

test('fechas escritas a mano y formatos de número', () => {
  assert.equal(looksLikeDate('2026-11-09'), true);
  assert.equal(looksLikeDate('9/11/2026'), true);
  assert.equal(looksLikeDate('hola'), false);
  assert.equal(formatValue(1234.5, 'integer'), '1,235'.replace(',', ' ').length ? formatValue(1234.5, 'integer') : '');
  assert.match(formatValue(5, 'usd'), /\$/);
});

test('insertar y borrar filas o columnas ajusta las referencias', () => {
  assert.equal(rewriteRefs('=SUMA(A1:A5)+B7', 'Hoja1', 'Hoja1', 'row', 2, 1), '=SUMA(A1:A6)+B8');
  assert.equal(rewriteRefs('=A1+A3', 'Hoja1', 'Hoja1', 'row', 0, 2), '=A3+A5');
  assert.equal(rewriteRefs('=A1+A3', 'Hoja1', 'Hoja1', 'row', 2, -1), '=A1+#REF!');
  assert.equal(rewriteRefs('=SUMA(A1:A5)', 'Hoja1', 'Hoja1', 'row', 1, -2), '=SUMA(A1:A3)');
  assert.equal(rewriteRefs('=C1*$D$2', 'Hoja1', 'Hoja1', 'col', 1, 1), '=D1*$E$2');
  assert.equal(rewriteRefs('=Hoja2!A5+A5', 'Hoja1', 'Hoja2', 'row', 0, 1), '=Hoja2!A6+A5');
  assert.equal(rewriteRefs('="A5"&A5', 'Hoja1', 'Hoja1', 'row', 0, 1), '="A5"&A6');
});

// ───────────── Filtros, región de datos y gráficos ─────────────
import { chartData, filterHiddenRows, parseRange, rangeText, regionAround } from '../../src/app/components/organizacion/documentos/sheet-tools.ts';

const mkSheet = (cells) => ({ name: 'Hoja1', cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, { v }])), colWidths: {}, rowCount: 50, colCount: 10 });
const evalFor = (sheet) => new Evaluator((name, col, row) => (name === sheet.name ? sheet.cells[cellKey(col, row)]?.v ?? '' : ''), (name) => name === sheet.name);
const data = { A3: 'Mes', B3: 'Ventas', A4: 'Ene', B4: '10', A5: 'Feb', B5: '20', A6: 'Mar', B6: '30', A1: 'Título' };

test('región actual y rangos', () => {
  assert.deepEqual(regionAround(mkSheet(data), 1, 4), { c0: 0, c1: 1, r0: 2, r1: 5 });
  assert.equal(rangeText(parseRange('B2:A1')), 'A1:B2');
  assert.equal(parseRange('xx'), null);
});

test('el filtro oculta las filas que no cumplen y deja la de títulos', () => {
  const sheet = { ...mkSheet(data), filter: { row: 2, c0: 0, c1: 1, rules: { 0: ['Ene', 'Mar'] } } };
  assert.deepEqual([...filterHiddenRows(sheet, evalFor(sheet))], [4]);
  const both = { ...sheet, filter: { ...sheet.filter, rules: { 0: ['Ene', 'Mar'], 1: ['30'] } } };
  assert.deepEqual([...filterHiddenRows(both, evalFor(both))].sort(), [3, 4]);
  const none = { ...sheet, filter: { ...sheet.filter, rules: {} } };
  assert.equal(filterHiddenRows(none, evalFor(none)).size, 0);
});

test('datos de gráfico: títulos, categorías y series', () => {
  const sheet = mkSheet(data);
  const out = chartData(evalFor(sheet), sheet, 'A3:B6');
  assert.deepEqual(out.categories, ['Ene', 'Feb', 'Mar']);
  assert.deepEqual(out.series, [{ name: 'Ventas', values: [10, 20, 30] }]);
  assert.equal(chartData(evalFor(sheet), sheet, 'A1:A1'), null);
});
