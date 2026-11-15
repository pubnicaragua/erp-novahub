// El equivalente que muestran los formularios («Base estimada», «Equivalente estimado») no debe cambiar según
// cómo se abrió el formulario ni quedar igual al importe original (C$ 700 nunca puede verse como $ 700.00).
import assert from 'node:assert/strict';
import { DEFAULT_EXCHANGE_RATE, convertBetweenSupportedCurrencies, convertToBaseCurrency, equivalentInOtherCurrency, initialDocumentExchangeRate, resolveGlobalExchangeRate, setCurrencyDecimalPlaces } from '../src/app/utils/currency.ts';

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
assert.equal(equivalentInOtherCurrency(700, 'NIO', 1, 0).amount, 19.11); // sin tasa global válida usa la de respaldo (36.6243)

// Tasa oficial fija del BCN 2026.
assert.equal(DEFAULT_EXCHANGE_RATE, 36.6243);
assert.equal(resolveGlobalExchangeRate(undefined), 36.6243);
assert.equal(resolveGlobalExchangeRate(0), 36.6243);
assert.equal(resolveGlobalExchangeRate(-3), 36.6243);
assert.equal(resolveGlobalExchangeRate('abc'), 36.6243);
assert.equal(resolveGlobalExchangeRate(36.9), 36.9);

// Tasa inicial de un documento nuevo: 1 en la moneda base, la global en la otra, con base en córdobas o en dólares.
assert.equal(initialDocumentExchangeRate('NIO', 'NIO', GLOBAL), 1);
assert.equal(initialDocumentExchangeRate('USD', 'NIO', GLOBAL), GLOBAL);
assert.equal(initialDocumentExchangeRate('USD', 'USD', GLOBAL), 1);
assert.equal(initialDocumentExchangeRate('NIO', 'USD', GLOBAL), GLOBAL);
assert.equal(initialDocumentExchangeRate('NIO', 'NIO', undefined), 1);
assert.equal(initialDocumentExchangeRate('USD', 'NIO', undefined), 36.6243);

// Conversión directa en LOS DOS SENTIDOS.
assert.equal(convertBetweenSupportedCurrencies(100, 'USD', 'NIO', GLOBAL), 3663); // dólares → córdobas
assert.equal(convertBetweenSupportedCurrencies(3663, 'NIO', 'USD', GLOBAL), 100); // córdobas → dólares
assert.equal(convertBetweenSupportedCurrencies(100, 'USD', 'USD', GLOBAL), 100);
assert.equal(convertBetweenSupportedCurrencies(100, 'NIO', 'NIO', GLOBAL), 100);
assert.equal(convertBetweenSupportedCurrencies(0.01, 'NIO', 'USD', GLOBAL), 0); // un centavo de córdoba no llega al centavo de dólar
// Ida y vuelta con importes grandes y chicos: lo que vuelve nunca se aleja más de 1 centavo del original en moneda de origen×tasa.
for (const usd of [0.01, 1.15, 19.11, 100, 1234.56, 999999.99]) {
  const nio = convertBetweenSupportedCurrencies(usd, 'USD', 'NIO', GLOBAL);
  const back = convertBetweenSupportedCurrencies(nio, 'NIO', 'USD', GLOBAL);
  assert.ok(Math.abs(back - usd) <= 0.01, `ida y vuelta ${usd} → ${nio} → ${back}`);
}

// A la moneda base: empresa en córdobas...
assert.equal(convertToBaseCurrency(100, 'USD', 36.9, 'NIO', GLOBAL), 3690);   // dólares con su tasa
assert.equal(convertToBaseCurrency(100, 'USD', 1, 'NIO', GLOBAL), 3663);      // tasa 1 no es una tasa real: se usa la global
assert.equal(convertToBaseCurrency(700, 'NIO', 1, 'NIO', GLOBAL), 700);       // ya está en la base
// ...y empresa con base en dólares: un documento en córdobas se divide, uno en dólares queda igual.
assert.equal(convertToBaseCurrency(3663, 'NIO', GLOBAL, 'USD', GLOBAL), 100);
assert.equal(convertToBaseCurrency(100, 'USD', 36.9, 'USD', GLOBAL), 100);
assert.equal(convertToBaseCurrency('x', 'USD', 36.9, 'NIO', GLOBAL), 0);

console.log('test-currency-equivalent OK');
