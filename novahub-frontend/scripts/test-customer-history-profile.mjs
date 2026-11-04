import assert from 'node:assert/strict';
import { buildCustomerHistoryTemplateHeaders, DEFAULT_CUSTOMER_HISTORY_PROFILE, normalizeCustomerHistoryProfile } from '../src/app/utils/customer-history-profile.ts';

const invercredit = normalizeCustomerHistoryProfile({
  configured: true,
  activityType: 'Préstamos',
  recordCountLabel: 'Número de préstamos',
  measureLabel: null,
  measureUnit: null,
});
assert.equal(invercredit.activityType, 'Préstamos');
assert.equal(invercredit.recordCountLabel, 'Número de préstamos');
assert.equal(buildCustomerHistoryTemplateHeaders(invercredit)[3], 'Medida', 'branches without an optional measure use a neutral column name');

const hotel = normalizeCustomerHistoryProfile({
  configured: true,
  activityType: 'Estadías',
  recordCountLabel: 'Estadías',
  measureLabel: 'Noches',
  measureUnit: 'noches',
});
assert.deepEqual(buildCustomerHistoryTemplateHeaders(hotel), [
  'Nombre', 'Identificación', 'Total', 'Noches', 'Número de documento', 'Moneda', 'TipoActividad',
]);
assert.deepEqual(buildCustomerHistoryTemplateHeaders(DEFAULT_CUSTOMER_HISTORY_PROFILE), [
  'Nombre', 'Identificación', 'Total', 'Medida', 'Número de documento', 'Moneda', 'TipoActividad',
]);
assert.equal(normalizeCustomerHistoryProfile({ activityType: 'Préstamos', recordCountLabel: 'Préstamos', measureUnit: 'unidades' }).configured, false);

process.stdout.write('customer history profile checks passed\n');
