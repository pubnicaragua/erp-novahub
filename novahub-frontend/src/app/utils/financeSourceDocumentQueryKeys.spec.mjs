import test from 'node:test';
import assert from 'node:assert/strict';
import { financeSourceDocumentQueryKeys } from './financeSourceDocumentQueryKeys.ts';

test('dashboard balance summaries and source document lists use separate cache entries', () => {
  assert.deepEqual(
    financeSourceDocumentQueryKeys.summary('SALES', 'tenant-1'),
    ['finance', 'source-document-summary', 'SALES', 'tenant-1'],
  );
  assert.deepEqual(
    financeSourceDocumentQueryKeys.lookup('SALES', 'tenant-1'),
    ['finance', 'source-document-lookup', 'SALES', 'tenant-1'],
  );
  assert.notDeepEqual(
    financeSourceDocumentQueryKeys.summary('SALES', 'tenant-1'),
    financeSourceDocumentQueryKeys.lookup('SALES', 'tenant-1'),
  );
});

test('source-document forecasts have their own tenant-scoped cache entries', () => {
  assert.deepEqual(
    financeSourceDocumentQueryKeys.projection('PURCHASES', 'tenant-1'),
    ['finance', 'source-document-projection', 'PURCHASES', 'tenant-1'],
  );
  assert.notDeepEqual(
    financeSourceDocumentQueryKeys.summary('PURCHASES', 'tenant-1'),
    financeSourceDocumentQueryKeys.projection('PURCHASES', 'tenant-1'),
  );
});
