import assert from 'node:assert/strict';

const currencyUtils = await import('../src/app/utils/currency.ts');

assert.equal(typeof currencyUtils.convertCreditLimitAmount, 'function', 'credit limit currency conversion helper must be exported');
assert.equal(typeof currencyUtils.preserveCreditLimitCurrency, 'function', 'amount-only edits must preserve the stored limit currency');

currencyUtils.setCurrencyDecimalPlaces(2);
assert.equal(currencyUtils.convertCreditLimitAmount(365, 'NIO', 'USD', 'NIO', 36.5), 10);
assert.equal(currencyUtils.convertCreditLimitAmount(10, 'USD', 'NIO', 'NIO', 36.5), 365);
assert.equal(currencyUtils.convertCreditLimitAmount(12.34, 'USD', 'USD', 'NIO', 36.5), 12.34);
assert.equal(currencyUtils.preserveCreditLimitCurrency(undefined, 'USD'), 'USD');
assert.equal(currencyUtils.preserveCreditLimitCurrency('NIO', 'USD'), 'NIO');

console.log('Customer credit limit currency conversion and preservation checks passed.');
