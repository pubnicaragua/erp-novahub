import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveMissingRucCreditDecision } from '../src/app/utils/customer-credit-confirmation.ts';

const baseCase = {
  rucRequired: true,
  ruc: '',
  previousCreditLimit: 0,
  nextCreditLimit: 1000,
  previousCreditLimitCurrency: 'NIO',
  nextCreditLimitCurrency: 'NIO',
};

assert.equal(resolveMissingRucCreditDecision(baseCase), 'confirm', 'Granting a positive credit limit without a required RUC should ask for confirmation');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, previousCreditLimit: 1000, nextCreditLimit: 1200 }), 'confirm', 'Changing an existing positive credit limit without RUC should ask again');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, nextCreditLimit: 0 }), 'block', 'A customer without an existing limit should still require RUC when no positive limit is granted');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, previousCreditLimit: 1000, nextCreditLimit: 1000 }), 'allow', 'Unrelated edits must not ask again for an unchanged approved limit');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, previousRuc: 'J0310000000000', previousCreditLimit: 1000, nextCreditLimit: 1000 }), 'block', 'Removing a required RUC must not inherit an earlier credit-limit exception');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, previousCreditLimit: 1000, nextCreditLimit: 0 }), 'allow', 'Removing an existing credit limit must remain possible without RUC');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, ruc: 'J0310000000000' }), 'allow', 'A customer with RUC must not receive the warning');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, rucRequired: false }), 'allow', 'Countries and customer types where RUC is optional must not receive the warning');
assert.equal(resolveMissingRucCreditDecision({ ...baseCase, previousCreditLimit: 1000, previousCreditLimitCurrency: 'USD', nextCreditLimit: 1000, nextCreditLimitCurrency: 'NIO' }), 'confirm', 'Changing the currency of a positive credit limit without RUC should ask for confirmation');

const clientsView = readFileSync(new URL('../src/app/components/ventas/ClientesView.tsx', import.meta.url), 'utf8');
assert.match(clientsView, /resolveMissingRucCreditDecision/, 'Customer edit flow should use the tested RUC decision');
assert.match(clientsView, /confirmMissingRuc:\s*true/, 'The confirmed edit should send explicit confirmation to the API');
assert.match(clientsView, /title="Guardar límite sin RUC"/, 'The edit flow should show the missing-RUC confirmation dialog');

console.log('Customer credit limit missing-RUC confirmation checks passed.');
