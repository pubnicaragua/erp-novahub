import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';
import { buildCustomerAcquisitionSeries, buildCustomerComposition, acquisitionPeriodLabel, buildCustomerAcquisitionSection } from '../src/app/utils/customer-acquisition-report.ts';

const customer = (createdAt, status = 'ACTIVE') => ({ createdAt, status });

test('counts inclusive Managua calendar days regardless of status at UTC boundaries', () => {
  const rows = [customer('2026-01-01T05:59:59.999Z'), customer('2026-01-01T06:00:00Z', 'INACTIVE'), customer('2026-01-02T05:59:59.999Z'), customer('2026-01-02T06:00:00Z')];
  assert.deepEqual(buildCustomerAcquisitionSeries(rows, 'month', '2026-01-01', '2026-01-01'), [{ period: 'Ene 2026', count: 2 }]);
});

test('uses complete history, calendar groups and zero buckets', () => {
  assert.deepEqual(buildCustomerAcquisitionSeries([customer('2024-12-31'), customer('2026-01-01'), customer('invalid')]), [{ period: '2024', count: 1 }, { period: '2025', count: 0 }, { period: '2026', count: 1 }]);
  for (const [group, labels] of [
    ['month', ['Ene 2026', 'Feb 2026', 'Mar 2026', 'Abr 2026', 'May 2026', 'Jun 2026', 'Jul 2026', 'Ago 2026', 'Sep 2026', 'Oct 2026', 'Nov 2026', 'Dic 2026']],
    ['quarter', ['T1 2026', 'T2 2026', 'T3 2026', 'T4 2026']],
    ['four-month', ['C1 2026', 'C2 2026', 'C3 2026']],
    ['semester', ['S1 2026', 'S2 2026']], ['year', ['2026']],
  ]) assert.deepEqual(buildCustomerAcquisitionSeries([], group, '2026-01-01', '2026-12-31').map(row => row.period), labels);
  assert.deepEqual(buildCustomerAcquisitionSeries([customer('2026-04-01'), customer('2026-05-01'), customer('2026-07-01')], 'four-month'), [{ period: 'C1 2026', count: 1 }, { period: 'C2 2026', count: 2 }]);
  assert.deepEqual(buildCustomerAcquisitionSeries([customer('2026-03-31'), customer('2026-04-01')], 'quarter'), [{ period: 'T1 2026', count: 1 }, { period: 'T2 2026', count: 1 }]);
  assert.deepEqual(buildCustomerAcquisitionSeries([customer('2026-06-30'), customer('2026-07-01')], 'semester'), [{ period: 'S1 2026', count: 1 }, { period: 'S2 2026', count: 1 }]);
});

test('handles empty, invalid and inverted ranges and one-sided bounds', () => {
  assert.deepEqual(buildCustomerAcquisitionSeries([]), []);
  assert.deepEqual(buildCustomerAcquisitionSeries([customer(null), customer('invalid')]), []);
  assert.deepEqual(buildCustomerAcquisitionSeries([], 'year', '2026-02-30'), []);
  assert.deepEqual(buildCustomerAcquisitionSeries([], 'year', '2027-01-01', '2026-12-31'), []);
  assert.deepEqual(buildCustomerAcquisitionSeries([customer('2024-01-01')], 'year', '2026-01-01'), [{ period: '2026', count: 0 }]);
  assert.deepEqual(buildCustomerAcquisitionSeries([customer('2026-01-01')], 'year', '', '2024-12-31'), [{ period: '2024', count: 0 }]);
  assert.equal(acquisitionPeriodLabel('year', '', ''), 'Historial completo · Año · America/Managua');
  assert.equal(acquisitionPeriodLabel('quarter', '2026-01-01', '2026-12-31'), '2026-01-01 a 2026-12-31 (inclusive) · Trimestre · America/Managua');
});

test('keeps both market slices visible with counts and safe percentages', () => {
  assert.deepEqual(buildCustomerComposition([]), [{ name: 'Activos', count: 0, share: 0 }, { name: 'Inactivos', count: 0, share: 0 }]);
  assert.deepEqual(buildCustomerComposition([customer('', 'active'), customer('', 'INACTIVE'), customer('', 'OTHER'), customer('')]), [{ name: 'Activos', count: 2, share: 50 }, { name: 'Inactivos', count: 2, share: 50 }]);
});

test('exports numeric period rows with the independent scope and a stable appended section id', () => {
  assert.deepEqual(buildCustomerAcquisitionSection([{ period: '2026', count: 0 }], 'year', '', ''), {
    id: 'customers-acquisition', title: 'Altas de clientes · Historial completo · Año · America/Managua',
    headers: ['Período', 'Clientes nuevos'], rows: [['2026', 0]],
  });
});

test('appends the PDF section without shifting existing indices or rewriting saved visibility preferences', async () => {
  const server = await createServer({ configFile: false, root: process.cwd(), logLevel: 'silent', optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, watch: null }, appType: 'custom' });
  try {
    const definitions = await server.ssrLoadModule('/src/app/services/pdf-template-definition.ts');
    const sample = definitions.createPdfTemplateSampleData('reportes.customers');
    assert.deepEqual(sample.reportSections.map(section => section.id), ['customers-growth', 'customers-operations', 'customers-market', 'customers-balance', 'customers-billing-leaders', 'customers-products', 'customers-acquisition']);
    const legacy = definitions.createDefaultTemplateDefinition('reportes.customers');
    const sectionNode = legacy.nodes.find(node => node.type === 'report-sections');
    sectionNode.reportSectionVisibility = { '0': false, '2': true, '5': false };
    const restored = definitions.sanitizeTemplateDefinition(legacy, 'reportes.customers');
    const preferences = restored.nodes.find(node => node.type === 'report-sections').reportSectionVisibility;
    assert.deepEqual(preferences, { '0': false, '2': true, '5': false });
    assert.equal(preferences['6'], undefined, 'Legacy templates keep index 6 unspecified, so the renderer displays it by default.');
    sectionNode.reportSectionVisibility['6'] = false;
    assert.equal(definitions.sanitizeTemplateDefinition(legacy, 'reportes.customers').nodes.find(node => node.type === 'report-sections').reportSectionVisibility['6'], false);
  } finally { await server.close(); }
});
