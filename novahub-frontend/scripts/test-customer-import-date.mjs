import assert from 'node:assert/strict';
import { normalizeCustomerImportDate } from '../src/app/utils/customer-import-date.ts';

assert.deepEqual(normalizeCustomerImportDate(''), { value: '', invalid: false });
assert.deepEqual(normalizeCustomerImportDate(undefined), { value: '', invalid: false });
assert.deepEqual(normalizeCustomerImportDate(new Date(2024, 0, 15, 12)), { value: '2024-01-15', invalid: false });
assert.deepEqual(normalizeCustomerImportDate(45292), { value: '2024-01-01', invalid: false });
assert.deepEqual(normalizeCustomerImportDate('45292.75'), { value: '2024-01-01', invalid: false });
assert.deepEqual(normalizeCustomerImportDate('2024-01-15'), { value: '2024-01-15', invalid: false });
assert.deepEqual(normalizeCustomerImportDate('15/01/2024'), { value: '2024-01-15', invalid: false });
assert.deepEqual(normalizeCustomerImportDate('31/02/2024'), { value: '', invalid: true });
assert.deepEqual(normalizeCustomerImportDate('fecha desconocida'), { value: '', invalid: true });

console.log('La fecha de ingreso acepta celdas de Excel, números de serie, ISO y fechas dd/mm/aaaa; rechaza valores inválidos.');
