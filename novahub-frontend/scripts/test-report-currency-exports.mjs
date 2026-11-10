import assert from 'node:assert/strict';
import { resolveDisplayCurrencyAmount } from '../src/app/utils/currency-display.ts';

const betweenCalls = [];
const currentCalls = [];
const convertBetweenCurrencies = (amount, sourceCurrency, targetCurrency, sourceRate, targetRate) => {
  betweenCalls.push({ amount, sourceCurrency, targetCurrency, sourceRate, targetRate });
  if (sourceCurrency === targetCurrency) return amount;
  if (targetCurrency === 'USD') return amount / (targetRate || 1);
  if (targetCurrency === 'NIO') return amount * (sourceRate || 36.5);
  return amount;
};
const convertCurrentAmount = (amount, sourceCurrency) => {
  currentCalls.push({ amount, sourceCurrency });
  return sourceCurrency === 'NIO' ? amount / 36.5 : amount * 36.5;
};

const defaults = {
  amount: 1000,
  sourceCurrency: 'NIO',
  sourceExchangeRate: 40,
  valuationMode: 'HISTORICAL',
  displayCurrency: 'USD',
  lockedDisplayCurrency: 'NIO',
  convertBetweenCurrencies,
  convertCurrentAmount,
};

assert.equal(resolveDisplayCurrencyAmount({ ...defaults, displayMode: 'USD' }), 25);
assert.deepEqual(betweenCalls.at(-1), {
  amount: 1000,
  sourceCurrency: 'NIO',
  targetCurrency: 'USD',
  sourceRate: 40,
  targetRate: 40,
});

assert.equal(resolveDisplayCurrencyAmount({ ...defaults, valuationMode: 'CURRENT', displayMode: 'USD', amount: 365 }), 10);
assert.deepEqual(currentCalls.at(-1), { amount: 365, sourceCurrency: 'NIO' });

assert.equal(resolveDisplayCurrencyAmount({ ...defaults, sourceCurrency: 'USD', displayMode: 'DEFAULT', valuationMode: 'CURRENT' }), 36500);
assert.deepEqual(betweenCalls.at(-1), {
  amount: 1000,
  sourceCurrency: 'USD',
  targetCurrency: 'NIO',
  sourceRate: undefined,
  targetRate: undefined,
});

const callCount = betweenCalls.length + currentCalls.length;
assert.equal(resolveDisplayCurrencyAmount({ ...defaults, displayMode: 'ORIGINAL' }), 1000);
assert.equal(betweenCalls.length + currentCalls.length, callCount, 'Original conserva el importe sin pedir conversión');
assert.equal(resolveDisplayCurrencyAmount({ ...defaults, amount: Number.NaN, displayMode: 'ORIGINAL' }), 0);

console.log('Cobertura de conversión monetaria para reportes: 5 aserciones correctas.');
