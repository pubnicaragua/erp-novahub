import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiErrorBody } from '../src/app/services/api-error.ts';

test('normalizes Nest HttpException payloads with business fields nested in message', () => {
  const normalized = normalizeApiErrorBody({
    statusCode: 409,
    message: {
      code: 'PRODUCT_SIMILAR_MATCH',
      message: 'Se encontró una posible coincidencia.',
      matches: [{ inputKey: 'SKU-NUEVO', matches: [] }],
    },
  });

  assert.equal(normalized?.code, 'PRODUCT_SIMILAR_MATCH');
  assert.equal(normalized?.message, 'Se encontró una posible coincidencia.');
  assert.deepEqual(normalized?.matches, [{ inputKey: 'SKU-NUEVO', matches: [] }]);
  assert.equal(normalized?.statusCode, 409);
});

test('preserves flat errors and non-object validation messages', () => {
  const flat = { statusCode: 409, code: 'SKU_CONFLICT', message: 'SKU repetido.' };
  assert.deepEqual(normalizeApiErrorBody(flat), flat);
  assert.deepEqual(normalizeApiErrorBody({ statusCode: 400, message: ['Falta el nombre.'] }), {
    statusCode: 400,
    message: ['Falta el nombre.'],
  });
});
