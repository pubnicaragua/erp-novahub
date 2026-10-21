import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getFinancingStatusTransitions } from './financingWorkflow.ts';

test('Financiamiento exposes only the next business actions for each application status', () => {
  assert.deepEqual(getFinancingStatusTransitions('PENDING').map(({ status, permission }) => [status, permission]), [
    ['IN_REVIEW', 'startReview'],
    ['REJECTED', 'reject'],
  ]);
  assert.deepEqual(getFinancingStatusTransitions('IN_REVIEW').map(({ status, permission }) => [status, permission]), [
    ['APPROVED', 'approve'],
    ['REJECTED', 'reject'],
  ]);
  assert.deepEqual(getFinancingStatusTransitions('APPROVED').map(({ status, permission }) => [status, permission]), [
    ['DISBURSED', 'disburse'],
  ]);
  assert.deepEqual(getFinancingStatusTransitions('REJECTED').map(({ status, permission }) => [status, permission]), [
    ['PENDING', 'reopen'],
  ]);
  assert.deepEqual(getFinancingStatusTransitions('DISBURSED'), []);
});
