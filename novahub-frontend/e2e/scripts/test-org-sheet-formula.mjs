// Pruebas del motor de fórmulas de Organización > Documentos (hojas de cálculo). Uso: npm run test:org-sheet-formula
import assert from 'node:assert/strict';
import test from 'node:test';
import { Evaluator, FormulaError, cellKey, colToLetters, formatValue, lettersToCol, parseCellKey, shiftFormula } from '../../src/app/components/organizacion/documentos/sheet-formula.ts';

function sheets(data) {
  const raw = (sheet, col, row) => data[sheet]?.[cellKey(col, row)] ?? '';
  return new Evaluator(raw, (name) => name in data);
}
const calc = (cells, key = 'Z99', sheet = 'Hoja1') => {
  const ev = sheets(typeof cells === 'object' && !('Hoja1' in cells) ? { Hoja1: cells } : cells);
  const ref = parseCellKey(key);
  return ev.value(sheet, ref.col, ref.row);
};
const show = (v) => (v instanceof FormulaError ? v.code : v);

test('referencias y letras de columna', () => {
  assert.equal(colToLetters(0), 'A'); assert.equal(colToLetters(25), 'Z'); assert.equal(colToLetters(26), 'AA');
  assert.equal(lettersToCol('AB'), 27);
  assert.deepEqual(parseCellKey('$C$12'), { col: 2, row: 11 });
  assert.equal(parseCellKey('12C'), null);
});

test('aritmética con precedencia, potencia, porcentaje y concatenación', () => {
  assert.equal(show(calc({ Z99: '=2+3*4' })), 14);
  assert.equal(show(calc({ Z99: '=(2+3)*4' })), 20);
  assert.equal(show(calc({ Z99: '=2^3^2' })), 64);
  assert.equal(show(calc({ Z99: '=-2^2' })), 4);
  assert.equal(show(calc({ Z99: '=50%+1' })), 1.5);
  assert.equal(show(calc({ Z99: '="Hola "&"mundo"' })), 'Hola mundo');
  assert.equal(show(calc({ Z99: '=10/4' })), 2.5);
});

test('referencias, rangos y funciones en español e inglés', () => {
  const data = { A1: '10', A2: '20', A3: '30', B1: 'x', B2: '=A1+A2', B3: '=SUMA(A1:A3)' };
  assert.equal(show(calc(data, 'B2')), 30);
  assert.equal(show(calc(data, 'B3')), 60);
  assert.equal(show(calc({ ...data, Z99: '=AVERAGE(A1:A3)' })), 20);
  assert.equal(show(calc({ ...data, Z99: '=PROMEDIO(A1:A3;100)' })), 40);
  assert.equal(show(calc({ ...data, Z99: '=MAX(A1:A3)-MIN(A1:A3)' })), 20);
  assert.equal(show(calc({ ...data, Z99: '=COUNT(A1:B3)' })), 5);
  assert.equal(show(calc({ ...data, Z99: '=COUNTA(A1:B3)' })), 6);
  assert.equal(show(calc({ ...data, Z99: '=SUM(A1:A3, 5, "7")' })), 72);
});

test('condicionales, comparaciones y texto', () => {
  assert.equal(show(calc({ A1: '5', Z99: '=SI(A1>3,"alto","bajo")' })), 'alto');
  assert.equal(show(calc({ A1: '1', Z99: '=IF(A1>3,"alto","bajo")' })), 'bajo');
  assert.equal(show(calc({ A1: 'a', Z99: '=A1="A"' })), true);
  assert.equal(show(calc({ Z99: '=AND(1<2,2<3)' })), true);
  assert.equal(show(calc({ Z99: '=OR(1>2,2>3)' })), false);
  assert.equal(show(calc({ Z99: '=UPPER("abc")&LEN("hola")' })), 'ABC4');
  assert.equal(show(calc({ Z99: '=IFERROR(1/0,"n/a")' })), 'n/a');
  assert.equal(show(calc({ Z99: '=ROUND(2.345,2)' })), 2.35);
  assert.equal(show(calc({ Z99: '=ROUNDDOWN(2.999,1)' })), 2.9);
  assert.equal(show(calc({ Z99: '=MOD(-7,3)' })), 2);
});

test('SUMAR.SI y CONTAR.SI', () => {
  const data = { A1: 'a', A2: 'b', A3: 'a', B1: '1', B2: '2', B3: '4' };
  assert.equal(show(calc({ ...data, Z99: '=SUMIF(A1:A3,"a",B1:B3)' })), 5);
  assert.equal(show(calc({ ...data, Z99: '=COUNTIF(B1:B3,">1")' })), 2);
  assert.equal(show(calc({ ...data, Z99: '=SUMAR.SI(B1:B3,"<=2")' })), 3);
});

test('errores: división por cero, nombre, referencia, valor y circular', () => {
  assert.equal(show(calc({ Z99: '=1/0' })), '#DIV/0!');
  assert.equal(show(calc({ Z99: '=FOO(1)' })), '#NAME?');
  assert.equal(show(calc({ Z99: '="a"+1' })), '#VALUE!');
  assert.equal(show(calc({ Z99: '=Nada!A1' })), '#REF!');
  assert.equal(show(calc({ Z99: '=1+' })), '#ERROR!');
  assert.equal(show(calc({ A1: '=B1', B1: '=A1' }, 'A1')), '#CIRC!');
  assert.equal(show(calc({ A1: '=A1+1' }, 'A1')), '#CIRC!');
  assert.equal(show(calc({ A1: '=1/0', Z99: '=A1+1' })), '#DIV/0!');
});

test('referencias entre hojas', () => {
  const data = { Hoja1: { A1: "='Ventas 2026'!B2*2" }, 'Ventas 2026': { B2: '21' } };
  assert.equal(show(calc(data, 'A1')), 42);
  assert.equal(show(calc({ ...data, Hoja1: { A1: '=SUM(\'Ventas 2026\'!B2:B3)' } }, 'A1')), 21);
});

test('formato de números y copia de fórmulas', () => {
  assert.equal(formatValue(0.5, 'percent').replace(/\s/g, ''), '50%');
  assert.equal(formatValue(1234.5, 'number').replace(/\s/g, '').length > 0, true);
  assert.equal(formatValue(new FormulaError('#DIV/0!')), '#DIV/0!');
  assert.equal(formatValue(true), 'VERDADERO');
  assert.equal(formatValue(null), '');
  assert.equal(shiftFormula('=A1+B$2+$C3', 1, 1), '=B2+C$2+$C4');
  assert.equal(shiftFormula('=SUM(A1:A3)&"A1"', 0, 1), '=SUM(A2:A4)&"A1"');
  assert.equal(shiftFormula('=A1', -1, 0), '=#REF!');
  assert.equal(shiftFormula('texto A1', 1, 1), 'texto A1');
});

test('fórmula hacia Excel: nombres en inglés y comas', async () => {
  const { toExcelFormula } = await import('../../src/app/components/organizacion/documentos/sheet-formula.ts');
  assert.equal(toExcelFormula('SUMA(A1:A3;SI(B1>0;"a;b";PROMEDIO(C1:C2)))'), 'SUM(A1:A3,IF(B1>0,"a;b",AVERAGE(C1:C2)))');
  assert.equal(toExcelFormula('A1+B2'), 'A1+B2');
});
