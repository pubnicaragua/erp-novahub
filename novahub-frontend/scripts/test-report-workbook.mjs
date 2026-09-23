import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: 'silent',
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
});

try {
  const reports = await server.ssrLoadModule('/src/app/utils/reportWorkbook.ts');
  const workbook = await reports.buildReportWorkbook({
    fileName: 'resumen_gestion.xlsx',
    filters: { Período: '01/09/2026 - 22/09/2026', Sucursal: 'Tienda Centro' },
    sheets: [
      { name: 'Indicadores', rows: [{ Indicador: 'Facturas pagadas', Valor: 23 }, { Indicador: 'Ventas pagadas', Valor: 326429.93 }, { Indicador: 'Ticket de venta pagada', Valor: 14192.605 }] },
      { name: 'Tendencia', rows: [{ Fecha: '01/09/2026', Ventas: 14000, Gastos: 2350.25, Unidades: 8 }, { Fecha: '02/09/2026', Ventas: 0, Gastos: 0, Unidades: 0 }] },
    ],
  });

  assert.equal(workbook.worksheets.length, 1, 'Cada reporte debe exportarse en una sola hoja.');
  const [worksheet] = workbook.worksheets;
  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, row => rows.push({ number: row.number, values: row.values.slice(1) }));
  const flatValues = rows.flatMap(row => row.values).map(value => String(value ?? ''));
  for (const expected of ['Filtros aplicados', 'Período', 'Sucursal', 'Indicadores', 'Tendencia', 'Facturas pagadas', 'Ventas pagadas']) {
    assert.ok(flatValues.includes(expected), `Falta contenido exportado: ${expected}`);
  }

  const trendHeader = rows.find(row => row.values.includes('Ventas') && row.values.includes('Gastos') && row.values.includes('Unidades'))?.number;
  assert.ok(trendHeader, 'Debe conservar el encabezado del bloque de tendencia.');
  const firstTrendRow = worksheet.getRow(trendHeader + 1);
  assert.equal(firstTrendRow.getCell(2).value, 14000, 'Los montos deben seguir siendo valores numéricos utilizables.');
  assert.equal(firstTrendRow.getCell(3).value, 2350.25, 'Los decimales de montos deben conservarse.');
  assert.equal(firstTrendRow.getCell(4).value, 8, 'Las cantidades deben seguir siendo números enteros.');
  assert.match(firstTrendRow.getCell(2).numFmt, /\.00/, 'Los montos deben mostrarse con dos decimales.');
  assert.match(firstTrendRow.getCell(4).numFmt, /#,##0/, 'Los conteos deben usar formato entero.');

  const ticketRow = rows.find(row => row.values[0] === 'Ticket de venta pagada')?.number;
  assert.ok(ticketRow, 'Debe conservarse el KPI del ticket de venta.');
  assert.equal(worksheet.getRow(ticketRow).getCell(2).value, 14192.605, 'El monto fuente debe seguir siendo numérico.');
  assert.match(worksheet.getRow(ticketRow).getCell(2).numFmt, /\.00/, 'El KPI monetario en columna Valor debe mostrarse con dos decimales.');

  console.log('Validación Excel aprobada: una hoja, filtros, secciones, filas y formatos numéricos.');
} finally {
  await server.close();
}
