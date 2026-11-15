// El equivalente que muestran los formularios («Base estimada», «Equivalente estimado») no debe cambiar según
// cómo se abrió el formulario ni quedar igual al importe original (C$ 700 nunca puede verse como $ 700.00).
import assert from 'node:assert/strict';
import { equivalentInOtherCurrency, setCurrencyDecimalPlaces } from '../src/app/utils/currency.ts';

setCurrencyDecimalPlaces(2);
const GLOBAL = 36.63;

// Córdobas: igual con la tasa guardada en 1 (moneda base), con la global o con una antigua.
for (const documentRate of [1, GLOBAL, 36.5, undefined, null, 0, NaN]) {
  const result = equivalentInOtherCurrency(700, 'NIO', documentRate, GLOBAL);
  assert.equal(result.currency, 'USD');
  assert.equal(result.amount, 19.11, `NIO con tasa ${documentRate}`);
}

// Dólares: usa la tasa real del documento y, si no hay, la global.
assert.deepEqual(equivalentInOtherCurrency(100, 'USD', 36.9, GLOBAL), { amount: 3690, currency: 'NIO' });
assert.deepEqual(equivalentInOtherCurrency(100, 'USD', 1, GLOBAL), { amount: 3663, currency: 'NIO' });
assert.deepEqual(equivalentInOtherCurrency(100, 'USD', undefined, GLOBAL), { amount: 3663, currency: 'NIO' });

// Ida y vuelta: pasar a dólares y regresar a córdobas no cambia lo que se ve.
const first = equivalentInOtherCurrency(700, 'NIO', 1, GLOBAL);
const again = equivalentInOtherCurrency(700, 'NIO', GLOBAL, GLOBAL);
assert.equal(first.amount, again.amount);

// Entradas inválidas no producen NaN.
assert.equal(equivalentInOtherCurrency('', 'NIO', 1, GLOBAL).amount, 0);
assert.equal(equivalentInOtherCurrency(undefined, 'USD', 1, GLOBAL).amount, 0);
assert.equal(equivalentInOtherCurrency(700, 'NIO', 1, 0).amount, 19.18); // sin tasa global válida usa 36.5

console.log('test-currency-equivalent OK');
