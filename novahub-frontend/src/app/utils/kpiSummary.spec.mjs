import test from 'node:test';
import assert from 'node:assert/strict';
import { getKpiSummaryRows } from './kpiSummary.ts';

test('does not expose summary rows while loading, even if stale rows exist', () => {
  assert.equal(getKpiSummaryRows({ data: [{ id: 'old' }], isLoading: true }), null);
});

test('does not expose summary rows after a failed summary request', () => {
  assert.equal(getKpiSummaryRows({ data: [{ id: 'page-only' }], isError: true }), null);
});

test('returns the complete successful result, including an empty result', () => {
  assert.deepEqual(getKpiSummaryRows({ data: [{ id: 'all-rows' }] }), [{ id: 'all-rows' }]);
  assert.deepEqual(getKpiSummaryRows({ data: [] }), []);
});
