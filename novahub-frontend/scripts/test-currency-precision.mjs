import assert from 'node:assert/strict';
import { formatCurrencyAmount, getCurrencyDecimalPlaces, getCurrencyInputStep, roundCurrencyNumber, setCurrencyDecimalPlaces } from '../src/app/utils/currency.ts';

setCurrencyDecimalPlaces(2);
assert.equal(formatCurrencyAmount(12.3, 'NIO'), 'C$ 12.30');
assert.equal(roundCurrencyNumber(0.1 + 0.2), 0.3);

setCurrencyDecimalPlaces(3);
assert.equal(formatCurrencyAmount(12.3, 'NIO'), 'C$ 12.300');
assert.equal(roundCurrencyNumber(1.23456), 1.235);

setCurrencyDecimalPlaces(4);
assert.equal(getCurrencyDecimalPlaces(), 4);
assert.equal(formatCurrencyAmount(12.3, 'NIO'), 'C$ 12.3000');

setCurrencyDecimalPlaces(6);
assert.equal(formatCurrencyAmount(0.123456, 'USD', true), '$ 0.123456 USD');
assert.equal(roundCurrencyNumber(0.1234567), 0.123457);

setCurrencyDecimalPlaces(7);
assert.equal(getCurrencyDecimalPlaces(), 2);
assert.equal(formatCurrencyAmount(12.3, 'NIO'), 'C$ 12.30');

setCurrencyDecimalPlaces(6);
assert.equal(getCurrencyInputStep(), 0.000001);

console.log('Cobertura de precisión monetaria: 11 aserciones correctas.');
