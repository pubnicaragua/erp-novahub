import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../src/app/utils/customerCreditInstallmentPlan.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
  logLevel: 'silent',
});
const source = bundle.outputFiles[0].text;
const { calculateCustomerCreditPlanEstimate } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);

const validPlan = calculateCustomerCreditPlanEstimate({
  principal: 100,
  interest: 20,
  calculationMode: 'MANUAL',
  manualInstallments: [
    { dueDate: '2026-12-01', totalAmount: '30', interestAmount: '10' },
    { dueDate: '2026-12-12', totalAmount: '40', interestAmount: '5' },
    { dueDate: '2027-01-03', totalAmount: '50', interestAmount: '5' },
  ],
});
assert.equal(validPlan?.isValid, true);
assert.deepEqual(validPlan?.schedule.map(({ dueDate, totalAmount, interestAmount, principalAmount }) => ({
  dueDate, totalAmount, interestAmount, principalAmount,
})), [
  { dueDate: '2026-12-01', totalAmount: 30, interestAmount: 10, principalAmount: 20 },
  { dueDate: '2026-12-12', totalAmount: 40, interestAmount: 5, principalAmount: 35 },
  { dueDate: '2027-01-03', totalAmount: 50, interestAmount: 5, principalAmount: 45 },
]);

const mismatchedPlan = calculateCustomerCreditPlanEstimate({
  principal: 100,
  interest: 20,
  calculationMode: 'MANUAL',
  manualInstallments: [{ dueDate: '2026-12-01', totalAmount: '119', interestAmount: '20' }],
});
assert.equal(mismatchedPlan?.isValid, false);
assert.equal(mismatchedPlan?.totalDifference, 1);

const tinyRoundedPlan = calculateCustomerCreditPlanEstimate({
  principal: 100,
  calculationMode: 'MANUAL',
  manualInstallments: [
    { dueDate: '2026-12-01', totalAmount: '100', interestAmount: '0' },
    { dueDate: '2026-12-02', totalAmount: '0.004', interestAmount: '0' },
  ],
});
assert.equal(tinyRoundedPlan?.isValid, false, 'an amount that rounds to zero must not be accepted');

console.log('Customer manual credit plan checks passed.');
