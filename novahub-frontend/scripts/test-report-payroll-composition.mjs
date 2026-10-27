import assert from 'node:assert/strict';
import { payrollComposition } from '../src/app/components/reportes/payroll-composition.ts';

const previous = { salario: 80, horasExtra: 1, comisiones: 2, prestaciones: 3, cargas: 20, deducciones: 10, total: 106 };
const current = { salario: 100, horasExtra: 10, comisiones: 20, prestaciones: 30, cargas: 40, deducciones: 5, total: 200 };
const rows = payrollComposition(current, previous);
assert.deepEqual(rows.map(row => row.key), ['salario', 'variables', 'cargas', 'deducciones']);
assert.deepEqual(rows.map(row => row.value), [100, 60, 40, 5]);
assert.deepEqual(rows.map(row => row.pct), [50, 30, 20, 2.5], 'Use existing payroll cost denominator, including for deductions');
assert.equal(rows[1].prev, 6, 'Previous Variables must use the same aggregation');
assert.equal(rows[1].name, 'Variables (extra, comisiones, prestaciones)');
const empty = Object.fromEntries(Object.keys(current).map(key => [key, 0]));
assert.deepEqual(payrollComposition(empty, previous), [], 'Zero segments are not plotted');
const partial = payrollComposition({ ...empty, prestaciones: 12, deducciones: -2 }, previous);
assert.equal(partial.length, 1, 'Retain positive segments only, as the existing pie does');
assert.equal(partial[0].key, 'variables');
assert.equal(partial[0].pct, 0, 'Guard a zero cost denominator');
console.log('Payroll composition: aggregation, prior period, denominator, zero and filtered segments passed');
