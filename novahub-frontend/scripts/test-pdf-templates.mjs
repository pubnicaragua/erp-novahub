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
  const catalog = await server.ssrLoadModule('/src/app/services/pdf-document-catalog.ts');
  const definitions = await server.ssrLoadModule('/src/app/services/pdf-template-definition.ts');
  const renderer = await server.ssrLoadModule('/src/app/utils/pdf-template-renderer.ts');
  const targets = catalog.PDF_TEMPLATE_TARGETS;

  const normalizedCompany = definitions.normalizePdfCompanySettings({
    slogan: 'Soluciones simples para crecer',
    fiscalInfo: 'RUC / Identificación fiscal',
    address: 'Dirección fiscal de la empresa',
    phone: '+505 0000-0000',
    email: 'contacto@empresa.com',
    website: 'www.empresa.com',
    bankInfo: 'Cuenta real de la empresa',
  });
  assert.deepEqual(
    [normalizedCompany.slogan, normalizedCompany.fiscalInfo, normalizedCompany.address, normalizedCompany.phone, normalizedCompany.email, normalizedCompany.website],
    ['', '', '', '', '', ''],
    'Los valores genéricos antiguos no deben aparecer como datos corporativos reales.',
  );
  assert.equal(normalizedCompany.bankInfo, 'Cuenta real de la empresa', 'La normalización debe conservar los otros ajustes del diseño.');
  assert.equal(definitions.SYSTEM_DEFAULT_PDF_SETTINGS.email, '', 'Las plantillas nuevas deben dejar vacíos los datos de empresa no configurados.');

  assert.equal(targets.length, 40, 'El catálogo debe incluir las 40 salidas activas.');
  assert.equal(new Set(targets.map(({ key }) => key)).size, targets.length, 'Las claves del catálogo deben ser únicas.');
  for (const key of ['contabilidad.journal', 'contabilidad.ledger', 'portal.customer-summary']) {
    assert.ok(targets.some(target => target.key === key), `Falta el destino ${key}.`);
  }
  assert.equal(catalog.getPdfTemplateTarget('ventas.cash-ticket').family, 'cash-ticket');
  assert.equal(catalog.getPdfTemplateTarget('inventario.product-labels').family, 'label');

  const labelSettings = definitions.createSystemDefaultPdfDesign('inventario.product-labels').settings;
  const labelDefinition = definitions.createDefaultTemplateDefinition('inventario.product-labels', labelSettings);
  const priceNode = labelDefinition.nodes.find(node => node.id === 'label-price');
  assert.ok(priceNode, 'La etiqueta debe incluir el precio.');
  assert.ok(priceNode.height >= 16, 'El precio de la etiqueta debe reservar altura suficiente.');
  assert.ok(priceNode.y + priceNode.height <= 80, 'El precio no debe invadir la línea de empresa.');

  for (const target of targets) {
    const sample = definitions.createPdfTemplateSampleData(target.key);
    const settings = definitions.createSystemDefaultPdfDesign(target.key).settings;
    const definition = definitions.createDefaultTemplateDefinition(target.key, settings);
    assert.ok(definition.nodes.length > 0, `${target.key} necesita una estructura canvas inicial.`);
    assert.ok(sample.document?.title, `${target.key} necesita un título de muestra.`);
    const hasRows = Boolean(sample.items?.length || sample.history?.length || sample.reportSections?.some(section => section.rows.length));
    const hasKpis = Boolean(sample.reportKpis?.length);
    const hasProductLabel = Boolean(sample.product?.barcode);
    assert.ok(hasRows || hasKpis || hasProductLabel, `${target.key} necesita contenido de muestra no vacío.`);
  }

  const dashboard = definitions.createPdfTemplateSampleData('dashboard.tenant-overview');
  const dashboardDefinition = definitions.createDefaultTemplateDefinition('dashboard.tenant-overview', definitions.createSystemDefaultPdfDesign('dashboard.tenant-overview').settings);
  const dashboardCharts = dashboardDefinition.nodes.filter(node => node.type === 'chart');
  assert.ok(dashboard.reportKpis.length >= 4);
  assert.deepEqual(new Set(dashboardCharts.map(node => node.chartType)), new Set(['area', 'bar', 'donut']));
  assert.ok(dashboardCharts.every(node => dashboard.dashboardCharts.some(chart => chart.id === node.token)));
  const sanitizedDashboard = definitions.sanitizeTemplateDefinition(dashboardDefinition, 'dashboard.tenant-overview', definitions.createSystemDefaultPdfDesign('dashboard.tenant-overview').settings);
  const sanitizedCharts = sanitizedDashboard.nodes.filter(node => node.type === 'chart');
  assert.deepEqual(new Set(sanitizedCharts.map(node => node.chartType)), new Set(['area', 'bar', 'donut']), 'La normalización debe conservar el tipo de cada gráfica.');

  const journal = definitions.createPdfTemplateSampleData('contabilidad.journal');
  const ledger = definitions.createPdfTemplateSampleData('contabilidad.ledger');
  assert.ok(journal.rows.length > 0, 'Libro Diario debe mostrar asientos de ejemplo.');
  assert.ok(ledger.rows.length > 0, 'Libro Mayor debe mostrar movimientos de ejemplo.');

  const sampleRows = Array.from({ length: 40 }, (_, index) => ({ description: `Movimiento ${index + 1} con una descripción suficientemente larga para ocupar varias líneas`, amount: index + 1 }));
  const pages = renderer.paginatePdfReportSections([{ id: 'long-report', title: 'Reporte largo', columns: [{ id: 'description', label: 'Descripción', token: 'description', width: 70 }, { id: 'amount', label: 'Monto', token: 'amount', width: 30 }], rows: sampleRows }]);
  assert.ok(pages.length > 1, 'Los reportes largos deben paginarse.');
  assert.equal(pages.flatMap(page => page.flatMap(section => section.rows)).length, sampleRows.length, 'La paginación debe conservar todas las filas.');

  console.log(`Validación PDF aprobada: ${targets.length} destinos, muestras por vista, gráficas y paginación.`);
} finally {
  await server.close();
}
