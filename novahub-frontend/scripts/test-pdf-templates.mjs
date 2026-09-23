import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { jsPDF } from 'jspdf';

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
  const generator = await server.ssrLoadModule('/src/app/utils/pdfGenerator.ts');
  const targets = catalog.PDF_TEMPLATE_TARGETS;

  assert.equal(definitions.formatPdfPageNumber('page-of', '', 2.8, 7.9), 'Página 2 de 7', 'La numeración normal debe usar enteros.');
  assert.equal(definitions.formatPdfPageNumber('number-only', '', 3.2, 8), '3', 'La numeración simple debe usar enteros.');
  assert.equal(definitions.formatPdfPageNumber('custom', 'Página {page}.0 de {pages},00', 4.6, 12.4), 'Página 4 de 12', 'La numeración personalizada y su previsualización deben eliminar decimales de página.');

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

  assert.equal(targets.length, 76, 'El catálogo debe incluir las 76 salidas activas montadas.');
  assert.equal(new Set(targets.map(({ key }) => key)).size, targets.length, 'Las claves del catálogo deben ser únicas.');
  for (const key of ['contabilidad.journal', 'contabilidad.ledger', 'portal.customer-summary']) {
    assert.ok(targets.some(target => target.key === key), `Falta el destino ${key}.`);
  }
  assert.equal(catalog.getPdfTemplateTarget('ventas.cash-ticket').family, 'cash-ticket');
  assert.equal(catalog.getPdfTemplateTarget('inventario.product-labels').family, 'label');
  for (const target of targets) {
    assert.ok(target.viewId, `${target.key} necesita una vista montada.`);
    assert.ok(target.adapterId, `${target.key} necesita un adaptador semántico.`);
    assert.ok(target.capabilities?.exportPdf, `${target.key} necesita capacidad PDF.`);
    if (target.templateMode === 'fixed') {
      assert.equal(target.capabilities?.editableCanvas, false, `${target.key} no debe aparecer como canvas editable.`);
      assert.equal(target.capabilities?.exportExcel, false, `${target.key} físico no debe ofrecer Excel.`);
    }
  }

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
    if (target.templateMode === 'fixed') {
      assert.ok(['LABEL', 'ROLL-80'].includes(settings.paperSize), `${target.key} debe conservar su papel físico.`);
    } else {
      assert.equal(settings.paperSize, 'LETTER', `${target.key} debe iniciar en Carta.`);
      assert.equal(settings.orientation, 'portrait', `${target.key} debe iniciar en orientación vertical.`);
      const paper = generator.pdfDesignPaper({ paperSize: 'A4', orientation: 'landscape' });
      assert.equal(paper.format, 'letter', 'La política estándar debe normalizar A4 a Carta.');
      assert.equal(paper.orientation, 'portrait', 'La política estándar debe normalizar horizontal a vertical.');
      const pdf = new jsPDF(paper);
      assert.equal(Math.round(pdf.internal.pageSize.getWidth()), 216, 'Carta debe medir 216 mm de ancho.');
      assert.equal(Math.round(pdf.internal.pageSize.getHeight()), 279, 'Carta debe medir 279 mm de alto.');
    }
  }

  const dashboard = definitions.createPdfTemplateSampleData('dashboard.tenant-overview');
  const dashboardDefinition = definitions.createDefaultTemplateDefinition('dashboard.tenant-overview', definitions.createSystemDefaultPdfDesign('dashboard.tenant-overview').settings);
  const dashboardCharts = dashboardDefinition.nodes.filter(node => node.type === 'chart');
  assert.ok(dashboard.reportKpis.length >= 4);
  assert.ok(!String(dashboard.document.meta || '').includes('Sucursal:'), 'Los metadatos de muestra no deben inyectar sucursal.');
  assert.deepEqual(new Set(dashboardCharts.map(node => node.chartType)), new Set(['area', 'bar', 'donut']));
  assert.ok(dashboardCharts.every(node => dashboard.dashboardCharts.some(chart => chart.id === node.token)));
  assert.equal(dashboardCharts.find(node => node.id === 'chart-trend')?.height, 42, 'La tendencia debe tener altura suficiente en la página de resumen.');
  assert.ok(dashboardCharts.every(node => node.firstPageOnly !== true), 'Las gráficas del dashboard se colocan mediante páginas de resumen y detalle.');
  const generatedHeader = dashboardDefinition.nodes.find(node => node.id === 'document-generated');
  assert.equal(generatedHeader?.token, 'document.generated');
  assert.equal(generatedHeader?.firstPageOnly, true, 'La fecha de generación aparece solo en la primera página.');
  const reportDefinition = definitions.createDefaultTemplateDefinition('reportes.sales', definitions.createSystemDefaultPdfDesign('reportes.sales').settings);
  const reportMeta = reportDefinition.nodes.find(node => node.id === 'report-meta');
  assert.ok(reportMeta, 'Los reportes deben reservar una línea compacta para período, filtros y generación.');
  assert.equal(reportMeta.width, 84, 'El período y la generación deben compartir el renglón completo del encabezado.');
  const sanitizedReportDefinition = definitions.sanitizeTemplateDefinition(reportDefinition, 'reportes.sales', definitions.createSystemDefaultPdfDesign('reportes.sales').settings);
  const sanitizedGeneratedNodes = sanitizedReportDefinition.nodes.filter(node => node.enabled !== false && node.type === 'field' && node.token === 'document.generated');
  assert.equal(sanitizedGeneratedNodes.length, 0, 'El diseño predeterminado usa un solo metadato para evitar duplicar la generación.');
  const firstPageMetadata = renderer.normalizeReportDocumentMetadata({
    meta: 'Período: septiembre · Sucursal: filtro seleccionado · Generado: 22/09/2026 10:00',
    generated: 'Generado: 22/09/2026 10:00',
  }, 1);
  assert.equal(firstPageMetadata.meta, 'Período: septiembre · Sucursal: filtro seleccionado', 'Debe conservar filtros explícitos, eliminando la duplicación de generado en los metadatos.');
  assert.equal(firstPageMetadata.generated, 'Generado: 22/09/2026 10:00', 'La fecha generada debe quedar disponible en la primera página.');
  const continuationMetadata = renderer.normalizeReportDocumentMetadata({
    period: 'Período: septiembre',
    meta: 'Período: septiembre · Generado: 22/09/2026 10:00',
    generated: 'Generado: 22/09/2026 10:00',
  }, 2);
  assert.equal(continuationMetadata.meta, '', 'Las páginas siguientes no deben repetir período, filtros ni fecha de generación.');
  assert.equal(continuationMetadata.period, '', 'El período independiente tampoco debe repetirse en las páginas siguientes.');
  assert.equal(continuationMetadata.generated, '', 'El token de generación debe quedar vacío en páginas siguientes.');
  const fallbackMetadata = renderer.normalizeReportDocumentMetadata({
    meta: 'Período: septiembre · Generado: 22/09/2026 10:00',
    generated: 'Generado: 22/09/2026 10:00',
    generatedInMetaFallback: true,
  }, 1);
  assert.equal(fallbackMetadata.meta, 'Período: septiembre · Generado: 22/09/2026 10:00', 'Diseños sin campo propio de generación deben mostrarla una sola vez en el metadato.');
  assert.equal(renderer.normalizeReportDocumentMetadata(fallbackMetadata, 2).meta, '', 'El metadato de respaldo tampoco repite período ni generación al continuar.');
  const sanitizedDashboard = definitions.sanitizeTemplateDefinition(dashboardDefinition, 'dashboard.tenant-overview', definitions.createSystemDefaultPdfDesign('dashboard.tenant-overview').settings);
  const sanitizedCharts = sanitizedDashboard.nodes.filter(node => node.type === 'chart');
  assert.deepEqual(new Set(sanitizedCharts.map(node => node.chartType)), new Set(['area', 'bar', 'donut']), 'La normalización debe conservar el tipo de cada gráfica.');
  const legacyDashboard = definitions.sanitizeTemplateDefinition({ ...dashboardDefinition, page: { ...dashboardDefinition.page, paperSize: 'A4', orientation: 'landscape' } }, 'dashboard.tenant-overview', { paperSize: 'A4', orientation: 'landscape' });
  assert.equal(legacyDashboard.page.paperSize, 'LETTER', 'Los diseños Dashboard antiguos deben pasar a Carta.');
  assert.equal(legacyDashboard.page.orientation, 'portrait', 'Los diseños Dashboard antiguos deben pasar a vertical.');

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
