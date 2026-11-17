import assert from 'node:assert/strict';
import test from 'node:test';
import { nextChildAccountCode } from '../src/app/components/contabilidad/accountCodes.ts';

test('sigue el consecutivo de las hijas con el mismo formato (caso de la captura de Clientes Locales)', () => {
  const siblings = ['1-01-04-001-001', '1-01-04-001-002', '1-01-04-001-003'];
  assert.equal(nextChildAccountCode('1-01-04-001-000', siblings, siblings), '1-01-04-001-004');
});

test('toma la mayor aunque las hijas estén desordenadas o con huecos', () => {
  const siblings = ['1-01-04-001-010', '1-01-04-001-002'];
  assert.equal(nextChildAccountCode('1-01-04-001-000', siblings, siblings), '1-01-04-001-011');
});

test('compara como número: 9 antes que 10', () => {
  const siblings = ['1-01-001-009', '1-01-001-010'];
  assert.equal(nextChildAccountCode('1-01-001-000', siblings, siblings), '1-01-001-011');
});

test('sin hijas y padre terminado en ceros, la primera es 001', () => {
  assert.equal(nextChildAccountCode('1-01-04-001-000', [], ['1-01-04-001-000']), '1-01-04-001-001');
});

test('sin hijas y padre con otro final, agrega un tramo nuevo de tres cifras', () => {
  assert.equal(nextChildAccountCode('1-01-04', [], ['1-01-04']), '1-01-04-001');
});

test('códigos sin guiones conservan la costumbre de agregar 001', () => {
  assert.equal(nextChildAccountCode('1100', [], ['1100']), '1100001');
  assert.equal(nextChildAccountCode('1100', ['1100001', '1100002'], ['1100', '1100001', '1100002']), '1100003');
});

test('si el siguiente ya lo usa otra cuenta de la empresa, salta al próximo libre', () => {
  const siblings = ['1-01-04-001-001'];
  const all = ['1-01-04-001-000', '1-01-04-001-001', '1-01-04-001-002', '1-01-04-001-003'];
  assert.equal(nextChildAccountCode('1-01-04-001-000', siblings, all), '1-01-04-001-004');
});

test('mantiene el ancho al pasar de 99 a 100 y no se rompe con espacios', () => {
  assert.equal(nextChildAccountCode('1-01-000', [' 1-01-099 '], []), '1-01-100');
});
