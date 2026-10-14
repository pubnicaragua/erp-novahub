import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManagerCsv, buildManagerReportModel } from './managerReportModel.ts';
import { fetchAllReportPages } from './reportPagination.ts';

test('keeps labelled metrics when detail rows are empty', () => {
  const report = buildManagerReportModel({
    title: 'Resumen de ventas',
    rows: [],
    metrics: { invoices: 12, revenue: 3490.5 },
    metricLabels: { invoices: 'Facturas', revenue: 'Ventas netas' },
  });

  assert.deepEqual(report.metrics, [
    { label: 'Facturas', value: '12' },
    { label: 'Ventas netas', value: '3490.5' },
  ]);
  assert.equal(report.rows.length, 0);
  assert.equal(report.emptyMessage, undefined);
});

test('renders an explicit empty state when neither metrics nor rows exist', () => {
  const report = buildManagerReportModel({ title: 'Inventario', rows: [], metrics: {} });

  assert.equal(report.metrics.length, 0);
  assert.equal(report.emptyMessage, 'Sin registros para el alcance seleccionado');
});

test('keeps scalar KPIs and leaves structured breakdowns for detail sheets', () => {
  const report = buildManagerReportModel({
    title: 'Cajas',
    rows: [],
    metrics: { sessions: 4, registerSummary: [{ name: 'Caja 1', total: 8 }] },
    extraSheets: [{ name: 'Resumen por caja', rows: [{ Caja: 'Caja 1', Total: 8 }] }],
  });

  assert.deepEqual(report.metrics, [{ label: 'Sesiones', value: '4' }]);
  assert.equal(report.emptyMessage, undefined);
  assert.equal(report.extraSheets[0].rows.length, 1);
});

test('exports array-valued KPI breakdowns as labelled detail sheets', () => {
  const report = buildManagerReportModel({
    title: 'Resumen financiero',
    rows: [],
    metrics: { income: 1250, incomeOriginalCurrencyBreakdown: [{ currency: 'USD', amount: 25 }] },
  });

  assert.deepEqual(report.metrics, [{ label: 'Ingresos', value: '1250' }]);
  assert.equal(report.extraSheets[0].name, 'Desglose de indicadores');
  assert.deepEqual(report.extraSheets[0].rows, [{ Indicador: 'Ingresos por moneda original', Moneda: 'USD', Monto: 25 }]);
});

test('serializes UTF-8 CSV fields safely with a BOM', () => {
  const csv = buildManagerCsv([{ nombre: 'José; Jr', comentario: 'Dijo "sí"\ny confirmó' }], ';');

  assert.ok(csv.startsWith('\uFEFF'));
  assert.equal(csv, '\uFEFFnombre;comentario\r\n"José; Jr";"Dijo ""sí""\ny confirmó"');
});

test('fetches every page with the same filters', async () => {
  const calls = [];
  const rows = await fetchAllReportPages(async (filters) => {
    calls.push({ ...filters });
    const page = filters.page;
    return {
      data: [{ id: page }],
      meta: { total: 3, page, pageSize: 1, totalPages: 3 },
    };
  }, { status: 'PAID', branchId: 'branch-1', pageSize: 1 });

  assert.deepEqual(rows, [{ id: 1 }, { id: 2 }, { id: 3 }]);
  assert.deepEqual(calls, [1, 2, 3].map((page) => ({ status: 'PAID', branchId: 'branch-1', pageSize: 1, page })));
});
