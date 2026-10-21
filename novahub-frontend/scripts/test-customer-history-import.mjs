import assert from 'node:assert/strict';
import { aggregateCustomerHistory } from '../src/app/utils/customer-history-import.ts';

const consolidated = aggregateCustomerHistory([
  { rowNumber: 2, name: 'Ana Pérez', identifier: '001-010190-1000A', amount: 100, measure: 2, currency: 'NIO' },
  { rowNumber: 3, name: 'Ana Pérez', identifier: '001 010190 1000a', amount: 50, measure: 1, currency: 'NIO' },
  { rowNumber: 4, name: 'Ana Pérez', identifier: '001-010190-1000A', amount: 20, measure: 1, currency: 'USD' },
], {
  activityType: 'Estadías',
  measureLabel: 'Noches',
  measureUnit: 'noches',
  fallbackCurrency: null,
});

assert.equal(consolidated.customers.length, 1, 'identifiers are grouped after removing punctuation and case');
assert.equal(consolidated.customers[0].summaries.length, 2, 'currencies remain separate');
assert.deepEqual(consolidated.customers[0].summaries.map((summary) => ({
  recordCount: summary.recordCount,
  measureValue: summary.measureValue,
  amount: summary.amount,
  currency: summary.currency,
})), [
  { recordCount: 2, measureValue: 3, amount: 150, currency: 'NIO' },
  { recordCount: 1, measureValue: 1, amount: 20, currency: 'USD' },
]);

const uniqueDocuments = aggregateCustomerHistory([
  { rowNumber: 2, name: 'Hotel Sol', identifier: 'ID-1', amount: '100.00', document: 'F-001', currency: 'USD' },
  { rowNumber: 3, name: 'Hotel Sol', identifier: 'id 1', amount: '100.00', document: 'f-001', currency: 'USD' },
], {
  activityType: 'Facturas',
  documentColumnSelected: true,
  fallbackCurrency: null,
});
assert.equal(uniqueDocuments.customers[0].summaries[0].recordCount, 1, 'count unique documents when a document column is mapped');
assert.equal(uniqueDocuments.customers[0].summaries[0].amount, 100, 'a repeated document total is included once');

const mappedActivityTypes = aggregateCustomerHistory([
  { rowNumber: 2, name: 'Hotel Sol', identifier: 'ID-1', amount: 100, currency: 'USD', activityType: 'Estadías' },
  { rowNumber: 3, name: 'Hotel Sol', identifier: 'ID-1', amount: 30, currency: 'USD', activityType: 'Restaurante' },
], {
  activityType: '',
  activityTypeColumnSelected: true,
  fallbackCurrency: null,
});
assert.deepEqual(mappedActivityTypes.customers[0].summaries.map((summary) => summary.activityType), ['Estadías', 'Restaurante']);

const invalid = aggregateCustomerHistory([
  { rowNumber: 2, name: 'Sin ID', identifier: '', amount: 10, currency: 'NIO' },
  { rowNumber: 3, name: 'Monto inválido', identifier: 'ID-2', amount: 'no-numérico', currency: 'NIO' },
  { rowNumber: 4, name: 'Moneda faltante', identifier: 'ID-3', amount: 10, currency: '' },
  { rowNumber: 5, name: 'Símbolo ambiguo', identifier: 'ID-4', amount: 10, currency: '$' },
], {
  activityType: 'Facturas',
  fallbackCurrency: null,
});
assert.match(invalid.customers[0].errors.join(' '), /identificación/i);
assert.match(invalid.customers[1].errors.join(' '), /importe/i);
assert.match(invalid.customers[2].errors.join(' '), /moneda/i);
assert.match(invalid.customers[3].errors.join(' '), /moneda/i);

const explicitlySelectedDollarCurrency = aggregateCustomerHistory([
  { rowNumber: 2, name: 'Moneda seleccionada', identifier: 'ID-5', amount: 10, currency: '$' },
], { activityType: 'Facturas', fallbackCurrency: 'USD' });
assert.equal(explicitlySelectedDollarCurrency.customers[0].errors.length, 0, 'a selected fallback currency explicitly resolves a bare dollar symbol');
assert.equal(explicitlySelectedDollarCurrency.customers[0].summaries[0].currency, 'USD');

const ambiguousName = aggregateCustomerHistory([
  { rowNumber: 2, name: 'Hotel Sol', identifier: 'ID-9', amount: 100, currency: 'USD' },
  { rowNumber: 3, name: 'Hotel Solaris', identifier: 'ID 9', amount: 50, currency: 'USD' },
], { activityType: 'Facturas', fallbackCurrency: null });
assert.match(ambiguousName.customers[0].warnings.join(' '), /nombres distintos/i);

console.log('customer history import aggregation checks passed');
