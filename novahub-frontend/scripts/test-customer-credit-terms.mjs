import assert from 'node:assert/strict';

const creditTerms = await import('../src/app/utils/creditTerms.ts');

assert.equal(typeof creditTerms.addCreditDays, 'function', 'credit term date helper must be exported');
assert.equal(typeof creditTerms.getCreditTermDeadline, 'function', 'credit term deadline helper must be exported');
assert.equal(typeof creditTerms.getCreditTermExtensionDays, 'function', 'credit term extension helper must be exported');

assert.equal(creditTerms.addCreditDays('2026-11-01', 0), '2026-11-01');
assert.equal(creditTerms.addCreditDays('2026-11-01', 10), '2026-11-11');
assert.equal(creditTerms.getCreditTermDeadline('2026-11-01', null), null);
assert.equal(creditTerms.getCreditTermDeadline('2026-11-01', 10), '2026-11-11');
assert.equal(creditTerms.getCreditTermDeadline('2026-11-01', 30, '2026-11-11'), '2026-11-11');
assert.equal(creditTerms.getCreditTermExtensionDays('2026-11-09', '2026-11-11'), 0);
assert.equal(creditTerms.getCreditTermExtensionDays('2026-11-15', '2026-11-11'), 4);

console.log('Customer credit term date calculations passed.');
