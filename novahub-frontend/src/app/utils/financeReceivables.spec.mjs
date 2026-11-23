import test from 'node:test';
import assert from 'node:assert/strict';
import { isOutstandingFinanceReceivable } from './financeReceivables.ts';

test('counts pending invoices, customer loans, and issued direct credits with a positive balance', () => {
  assert.equal(isOutstandingFinanceReceivable({ documentType: 'INVOICE', status: 'PENDING', balance: 100 }), true);
  assert.equal(isOutstandingFinanceReceivable({ documentType: 'CUSTOMER_LOAN', status: 'PARTIAL', balance: 40 }), true);
  assert.equal(isOutstandingFinanceReceivable({ documentType: 'CUSTOMER_CREDIT', status: 'ISSUED', balance: 75 }), true);
});

test('excludes drafts, settled documents, and zero balances from receivables', () => {
  assert.equal(isOutstandingFinanceReceivable({ documentType: 'INVOICE', status: 'DRAFT', balance: 100 }), false);
  assert.equal(isOutstandingFinanceReceivable({ documentType: 'INVOICE', status: 'PAID', balance: 0 }), false);
  assert.equal(isOutstandingFinanceReceivable({ documentType: 'CUSTOMER_CREDIT', status: 'ISSUED', balance: 0 }), false);
});
