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
  const styles = await server.ssrLoadModule('/src/app/services/pdf-document-style.ts');
  const generator = await server.ssrLoadModule('/src/app/utils/pdfGenerator.ts');
  const targets = catalog.PDF_TEMPLATE_TARGETS;

  assert.equal(definitions.resolveTemplateToken('supplier.name', { party: { name: 'Proveedor de prueba' } }), 'Proveedor de prueba', 'Las plantillas de Compras deben leer el proveedor del alias compartido party usado por sus exportadores.');
  assert.equal(definitions.resolveTemplateToken('customer.name', { party: { name: 'Cliente de prueba' } }), 'Cliente de prueba', 'Las plantillas de Ventas deben aceptar los datos de contraparte que llegan bajo party.');
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

  assert.deepEqual(styles.PDF_STYLE_PRESETS.map(item => item.id), ['light', 'boxed', 'bold', 'striped', 'bubble', 'wave', 'folder'], 'El editor debe ofrecer los siete estilos del piloto.');
  const styleSource = definitions.createDefaultTemplateDefinition('ventas.estimate', definitions.createSystemDefaultPdfDesign('ventas.estimate').settings);
  const sourceTable = styleSource.nodes.find(node => node.type === 'table');
  assert.ok(sourceTable, 'La cotización de ejemplo debe incluir su tabla.');
  const styleConfig = styles.createDefaultPdfStyleConfig('ventas.estimate');
  const stripedPreset = styles.PDF_STYLE_PRESETS.find(item => item.id === 'striped');
  const styledDefinition = styles.applyPdfStyleToDefinition(styleSource, { ...styleConfig, presetId: 'striped', palette: stripedPreset.palette, fontFamily: 'Georgia', fontSize: 10 });
  const styledTable = styledDefinition.nodes.find(node => node.id === sourceTable.id);
  const styledHeaderRule = styledDefinition.nodes.find(node => node.id === 'header-accent');
  assert.deepEqual(
    styledDefinition.nodes.map(({ id, x, y, width, height, page }) => ({ id, x, y, width, height, page })),
    styleSource.nodes.map(({ id, x, y, width, height, page }) => ({ id, x, y, width, height, page })),
    'Aplicar un estilo no debe mover ni cambiar las dimensiones de los elementos.'
  );
  assert.deepEqual(
    styledTable.columns.map(({ id, width, align }) => ({ id, width, align })),
    sourceTable.columns.map(({ id, width, align }) => ({ id, width, align })),
    'El estilo no debe cambiar el orden ni los anchos de las columnas.'
  );
  assert.equal(styledTable.tableStripeColor, stripedPreset.palette.tableStripe);
  assert.equal(styledTable.fontFamily, 'Georgia', 'La fuente elegida se debe aplicar al contenido.');
  assert.ok(styledHeaderRule, 'La composición predeterminada representa el encabezado con un divisor, no con una sección de fondo.');
  assert.equal(styledHeaderRule.backgroundColor, undefined, 'El divisor del encabezado no debe convertirse en un bloque de fondo.');
  assert.equal(styledHeaderRule.borderColor, stripedPreset.palette.primary, 'El estilo de encabezado debe aplicarse al divisor visible.');
  assert.equal(styles.resolvePdfTableRowBackground('striped', stripedPreset.palette, 1), stripedPreset.palette.tableStripe, 'Las filas impares deben mostrar el color alterno del estilo.');
  assert.equal(styles.resolvePdfTableRowBackground('striped', stripedPreset.palette, 0), stripedPreset.palette.tableRow, 'Las filas pares deben mantener el color base.');
  assert.notEqual(styles.getPdfTablePresentation('boxed').rowGap, styles.getPdfTablePresentation('bubble').rowGap, 'Los estilos de tabla deben cambiar su presentación, no solo los colores.');
  const ledgerSettings = definitions.createSystemDefaultPdfDesign('contabilidad.ledger').settings;
  const ledgerDefinition = definitions.createDefaultTemplateDefinition('contabilidad.ledger', ledgerSettings);
  const reportTable = { id: 'report-style-sample', type: 'report-sections', label: 'Muestra de reporte', x: 5, y: 20, width: 90, height: 50, reportSectionStyles: { '__test': { rowColor: '#ffffff' } } };
  const reportStyleDefinition = { ...ledgerDefinition, nodes: [...ledgerDefinition.nodes, reportTable] };
  const stripedReport = styles.applyPdfStyleToDefinition(reportStyleDefinition, { ...styleConfig, presetId: 'striped', tableStyle: 'striped', palette: stripedPreset.palette });
  const styledReportTable = stripedReport.nodes.find(node => node.id === reportTable.id);
  assert.ok(Object.values(styledReportTable.reportSectionStyles || {}).every(section => !section.rowColor), 'Los reportes deben permitir que el estilo de franjas pinte las filas alternas.');
  assert.ok(styles.isPdfFrameHeaderNode({ id: 'company-logo' }));
  assert.ok(styles.isPdfFrameHeaderNode({ id: 'header-band' }));
  assert.ok(styles.isPdfFrameFooterNode({ id: 'footer-page' }));
  assert.equal(styles.isPdfFrameHeaderNode({ id: 'items-table' }), false, 'El marco HTML no debe ocultar el contenido del ERP.');
  assert.throws(() => styles.sanitizePdfTemplateCss('.pdf-header { background-image: url(https://example.com/x); }'), /recurso externo|CSS no permitido/i);
  assert.match(styles.sanitizePdfTemplateCss('.pdf-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; } .pdf-header .company-brand { display: flex; align-items: center; gap: 10px; } .pdf-header .company-copy p { font-size: 9px; }'), /display: flex/i, 'El marco debe permitir una distribución segura del encabezado y sus componentes.');
  assert.throws(() => styles.sanitizePdfTemplateCss('.pdf-content { display: flex; }'), /solo puede seleccionar el encabezado o el pie/i, 'El HTML importado no debe cambiar la distribución del cuerpo del ERP.');
  assert.equal(styles.normalizePdfFontFamily('Mystery Font'), 'Arial', 'Las fuentes importadas fuera del catálogo deben asignarse a una fuente admitida.');
  for (const maliciousHtml of [
    '<script>alert(1)</script>',
    '<iframe src="https://example.com"></iframe>',
    '<img src="https://example.com/logo.png" onerror="alert(1)">',
  ]) assert.throws(() => styles.parsePdfHtmlShell(maliciousHtml), /scripts|recursos remotos|etiquetas no admitidas/i, 'El importador debe rechazar scripts, iframes, eventos y recursos remotos.');

  assert.equal(targets.length, 81, 'El catálogo debe incluir todas las salidas PDF activas encontradas en los módulos.');
  assert.equal(new Set(targets.map(({ key }) => key)).size, targets.length, 'Las claves del catálogo deben ser únicas.');
  assert.ok(targets.some(target => target.key === 'contabilidad.balance-sheet'), 'El balance general de Contabilidad debe tener un destino propio.');
  assert.ok(targets.some(target => target.key === 'restaurante.menu'), 'La carta del Restaurante debe tener un destino propio.');
  for (const target of targets) {
    const fixed = target.templateMode === 'fixed';
    assert.equal(definitions.isStandardPdfLayoutTarget(target.key), !fixed, `${target.key} debe heredar el patrón global salvo formatos físicos.`);
    if (fixed) continue;
    const settings = definitions.createSystemDefaultPdfDesign(target.key).settings;
    const definition = definitions.createDefaultTemplateDefinition(target.key, settings);
    const byId = new Map(definition.nodes.map(node => [node.id, node]));
    assert.equal(byId.get('header-accent')?.y, 4, `${target.key} debe conservar la regla superior común.`);
    assert.equal(byId.get('company-name')?.x, 5, `${target.key} debe alinear los datos de empresa al margen útil izquierdo.`);
    assert.equal(byId.get('company-logo')?.x, 75, `${target.key} debe alinear el logo al margen útil derecho.`);
    assert.ok(byId.get('document-title')?.y >= 20, `${target.key} debe ubicar el título después del bloque de identidad.`);
    assert.equal(byId.get('footer-divider')?.y, 95.35, `${target.key} debe usar la franja de pie común.`);
    assert.equal(byId.has('notes') || byId.has('document-notes'), false, `${target.key} no debe incluir el bloque de notas del documento.`);
  }
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
    if (definitions.isStandardPdfLayoutTarget(target.key)) {
      assert.ok(definitions.hasCurrentStandardPdfLayout(target.key, definition), `${target.key} debe usar la versión predeterminada vigente.`);
      assert.equal(definition.nodes.some(node => ['notes', 'document-notes'].includes(node.id)), false, `${target.key} no debe imprimir el bloque de notas del documento.`);
    }
    assert.ok(sample.document?.title, `${target.key} necesita un título de muestra.`);
    const hasRows = Boolean(sample.items?.length || sample.history?.length || sample.reportSections?.some(section => section.rows.length));
    const hasKpis = Boolean(sample.reportKpis?.length);
    const hasProductLabel = Boolean(sample.product?.barcode);
    assert.ok(hasRows || hasKpis || hasProductLabel, `${target.key} necesita contenido de muestra no vacío.`);
    if (target.templateMode === 'fixed') {
      assert.ok(['LABEL', 'ROLL-80'].includes(settings.paperSize), `${target.key} debe conservar su papel físico.`);
    } else {
      assert.equal(settings.paperSize, 'LETTER', `${target.key} debe iniciar en Carta.`);
      assert.equal(settings.orientation, target.key === 'ventas.customers' ? 'landscape' : 'portrait', `${target.key} debe iniciar en la orientación que conserva la lectura de sus columnas.`);
      const paper = generator.pdfDesignPaper({ paperSize: 'A4', orientation: 'landscape' });
      assert.equal(paper.format, 'letter', 'La política estándar debe normalizar A4 a Carta.');
      assert.equal(paper.orientation, 'portrait', 'La política estándar debe normalizar horizontal a vertical.');
      const customerListPaper = generator.pdfDesignPaper({ paperSize: 'LETTER', orientation: 'landscape' }, 'ventas.customers');
      assert.equal(customerListPaper.orientation, 'landscape', 'El listado de clientes debe conservar el formato horizontal incluso en la ruta rápida de exportación.');
      const pdf = new jsPDF(paper);
      assert.equal(Math.round(pdf.internal.pageSize.getWidth()), 216, 'Carta debe medir 216 mm de ancho.');
      assert.equal(Math.round(pdf.internal.pageSize.getHeight()), 279, 'Carta debe medir 279 mm de alto.');
    }
  }

  const customerHistoryDefinition = definitions.createDefaultTemplateDefinition('ventas.customer-history', definitions.createSystemDefaultPdfDesign('ventas.customer-history').settings);
  const customerHistoryTitle = customerHistoryDefinition.nodes.find(node => node.id === 'document-title');
  const customerHistoryPartyName = customerHistoryDefinition.nodes.find(node => node.id === 'history-customer-name');
  assert.equal(customerHistoryTitle.x, 55, 'El título del historial del cliente debe ocupar la banda derecha.');
  assert.equal(customerHistoryTitle.align, 'right', 'El título del historial debe alinearse a la derecha, frente al nombre de la entidad.');
  assert.equal(customerHistoryPartyName.x, 5, 'El nombre del cliente debe iniciar a la izquierda en la misma banda que el título.');

  const customerListDefinition = definitions.createDefaultTemplateDefinition('ventas.customers', definitions.createSystemDefaultPdfDesign('ventas.customers').settings);
  const customerListSections = customerListDefinition.nodes.find(node => node.id === 'report-sections');
  assert.equal(customerListSections.x, 5, 'El listado de clientes debe usar el margen de la zona útil.');
  assert.equal(customerListSections.width, 90, 'El listado de clientes debe ocupar todo el ancho útil.');
  assert.equal(customerListSections.backgroundColor, 'transparent', 'El listado de clientes no debe usar una tarjeta exterior.');
  assert.equal(customerListSections.borderColor, 'transparent', 'El listado de clientes no debe usar un recuadro exterior.');
  assert.deepEqual(customerListSections.columns.map(column => column.width), [10, 18, 12, 16, 24, 12, 8], 'El listado de clientes debe reservar espacio suficiente para tipo y contacto.');

  const purchaseListDefinition = definitions.createDefaultTemplateDefinition('compras.list', definitions.createSystemDefaultPdfDesign('compras.list').settings);
  const purchaseListTable = purchaseListDefinition.nodes.find(node => node.id === 'items-table');
  assert.equal(purchaseListTable.y, 27.5, 'El listado de compras debe acercar la tabla al título cuando no hay metadatos.');
  assert.equal(purchaseListTable.width, 90, 'El listado de compras debe usar todo el ancho útil.');

  const cashSessionSettings = definitions.createSystemDefaultPdfDesign('ventas.cash-session').settings;
  const cashSessionDefinition = definitions.applyPdfHeaderComposition(
    definitions.createDefaultTemplateDefinition('ventas.cash-session', cashSessionSettings),
    'company-left-logo-right',
    'ventas.cash-session',
  );
  assert.ok(cashSessionDefinition.nodes.find(node => node.id === 'document-title').y < 20, 'El título del resumen de sesión debe quedar próximo al bloque de empresa.');
  assert.ok(cashSessionDefinition.nodes.find(node => node.id === 'cash-report-sections').y < 40, 'Las tablas del resumen de sesión deben iniciar después de metadatos compactos.');
  assert.equal(renderer.getPdfReportSectionTableGap('ventas.cash-historical-report'), 6, 'Los títulos de sección deben separarse de sus tablas con un espacio corto y visible.');
  assert.equal(renderer.getPdfTableCellVerticalAlignment('header'), 'middle', 'Los encabezados deben alinearse al centro vertical.');
  assert.equal(renderer.getPdfTableCellVerticalAlignment('body'), 'middle', 'El cuerpo debe alinearse al centro vertical incluso con descripciones multilínea.');
  assert.equal(renderer.getPdfTableCellVerticalAlignment('footer'), 'middle', 'Los pies y totales deben alinearse al centro vertical.');
  assert.deepEqual(
    renderer.fitPdfImageInsideSlot({ x: 10, y: 20, width: 30, height: 10 }, 200, 100),
    { x: 15, y: 20, width: 20, height: 10 },
    'La marca añadida al PDF debe conservar la proporción y centrarse en su caja sin deformarla.',
  );
  assert.deepEqual(
    renderer.fitPdfImageInsideSlot({ x: 10, y: 20, width: 30, height: 10 }, 100, 200),
    { x: 22.5, y: 20, width: 5, height: 10 },
    'Los logos verticales también deben conservar su proporción dentro de la misma caja.',
  );
  let imageDecodeStarted = false;
  let imageDecodeFinished = false;
  let releaseImageDecode;
  const pendingImageDecode = new Promise(resolve => { releaseImageDecode = resolve; });
  const imageDecode = renderer.waitForPdfImageDecode({ decode: () => { imageDecodeStarted = true; return pendingImageDecode; } }).then(() => { imageDecodeFinished = true; });
  await Promise.resolve();
  assert.equal(imageDecodeStarted, true, 'La captura debe pedir al navegador que decodifique el logo antes de rasterizar la página.');
  assert.equal(imageDecodeFinished, false, 'La captura debe esperar a que termine la decodificación del logo.');
  releaseImageDecode();
  await imageDecode;
  assert.equal(imageDecodeFinished, true, 'La espera de decodificación debe continuar después de que la imagen esté lista.');
  assert.deepEqual(renderer.getPdfTableHeaderCellLayout(true, true), { padding: '2px 5px', lineHeight: '1.25', contentDisplay: 'flex', contentAlignItems: 'center', contentMinHeight: '1.25em' }, 'El rótulo debe centrarse dentro de un contenedor propio para que el rasterizador no lo empuje contra el borde inferior de la celda.');
  assert.equal(renderer.getPdfStandardContinuationY(13.5), 16, 'La tabla de continuación debe comenzar poco después del logo y el marco que se repiten.');
  assert.equal(renderer.getPdfStandardContinuationY(21), 23.5, 'La continuación debe respetar el encabezado repetible de diseños que usan una banda más alta.');
  assert.equal(renderer.shouldRenderPdfNodeOnPage('company-logo', true, 2), true, 'El logo debe repetirse aunque un diseño antiguo lo haya marcado como solo primera página.');
  assert.equal(renderer.shouldRenderPdfNodeOnPage('company-name', true, 2), false, 'La información de empresa no debe repetirse al pasar de página.');
  const customCashDefinition = {
    ...cashSessionDefinition,
    metadata: { ...cashSessionDefinition.metadata, preset: 'sales-custom' },
    nodes: cashSessionDefinition.nodes.map(node => ({
      ...node,
      ...(node.id === 'document-title' ? { y: 27 } : {}),
      ...(node.id === 'cash-report-sections' ? { y: 58 } : {}),
    })),
  };
  const composedCustomCashDefinition = definitions.applyPdfHeaderComposition(customCashDefinition, 'logo-left-company-right', 'ventas.cash-session');
  assert.equal(composedCustomCashDefinition.nodes.find(node => node.id === 'document-title').y, 27, 'Cambiar la composición empresarial no debe mover el título de un diseño personalizado.');
  assert.equal(composedCustomCashDefinition.nodes.find(node => node.id === 'cash-report-sections').y, 58, 'Cambiar la composición empresarial no debe mover las tablas guardadas por el usuario.');

  const supplierHistoryDefinition = definitions.createDefaultTemplateDefinition('compras.supplier-history', definitions.createSystemDefaultPdfDesign('compras.supplier-history').settings);
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'document-title').x, 55, 'El título del historial de proveedor debe ocupar la banda derecha.');
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'party-name').x, 5, 'El nombre del proveedor debe ocupar el lado izquierdo de la banda del título.');
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'party-name').width, 44, 'El nombre del proveedor debe dejar libre la banda derecha para el título.');

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
  assert.equal(renderer.isPdfFirstPageOnlyInfoNode('document-generated'), true, 'La fecha de generación aparece solo en la primera página.');
  assert.equal(renderer.isPdfFirstPageOnlyInfoNode('document-title'), true, 'El título del documento no debe repetirse en páginas continuas.');
  assert.equal(renderer.isPdfFirstPageOnlyInfoNode('company-summary'), true, 'Los datos de empresa no deben repetirse en páginas continuas.');
  assert.equal(renderer.isPdfFirstPageOnlyInfoNode('company-logo'), false, 'El logo sí se conserva en páginas continuas.');
  const reportDefinition = definitions.createDefaultTemplateDefinition('reportes.sales', definitions.createSystemDefaultPdfDesign('reportes.sales').settings);
  const reportMeta = reportDefinition.nodes.find(node => node.id === 'report-meta');
  assert.ok(reportMeta, 'Los reportes deben reservar una línea compacta para período, filtros y generación.');
  const reportGenerated = reportDefinition.nodes.find(node => node.id === 'document-generated');
  assert.equal(reportMeta.width, 60, 'El período debe reservar su columna izquierda en el renglón de metadatos.');
  assert.equal(reportGenerated?.x, 67, 'La fecha de generación debe reservar la columna derecha del renglón de metadatos.');
  assert.equal(reportGenerated?.y, reportMeta.y, 'El período y la fecha de generación deben compartir una sola línea.');
  const sanitizedReportDefinition = definitions.sanitizeTemplateDefinition(reportDefinition, 'reportes.sales', definitions.createSystemDefaultPdfDesign('reportes.sales').settings);
  const sanitizedGeneratedNodes = sanitizedReportDefinition.nodes.filter(node => node.enabled !== false && node.type === 'field' && node.token === 'document.generated');
  assert.equal(sanitizedGeneratedNodes.length, 1, 'El diseño predeterminado conserva una sola columna explícita para la fecha de generación.');
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

  const historicalCashSections = [
    {
      id: 'cash-summary', title: 'Resumen general',
      columns: ['sessions', 'closedSessions', 'salesNio', 'salesUsd', 'differenceNio', 'depositsNio'].map(token => ({ id: token, label: token, token, width: 16 })),
      rows: [{ sessions: '1', closedSessions: '0', salesNio: 'C$ 417,444.03', salesUsd: '$ 0.00', differenceNio: 'C$ -394,636.41', depositsNio: 'C$ 0.00' }],
    },
    {
      id: 'cash-payment-methods', title: 'Formas de pago',
      columns: ['method', 'operations', 'amountNio', 'amountUsd'].map(token => ({ id: token, label: token, token, width: 25 })),
      rows: ['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque', 'Otro'].map((method, index) => ({ method, operations: String([13, 1, 2, 0, 0][index]), amountNio: 'C$ 0.00', amountUsd: '$ 0.00' })),
    },
    {
      id: 'cash-sessions', title: 'Detalle de sesiones',
      columns: ['date', 'register', 'cashier', 'salesCount', 'salesAmounts', 'differenceDeposit'].map(token => ({ id: token, label: token, token, width: 16 })),
      rows: [{ date: '24/9/2026', register: 'Caja 1', cashier: 'Gabriel Tinoco', salesCount: '16', salesAmounts: 'C$ 417,444.03\n$ 0.00', differenceDeposit: 'C$ -394,636.41\nC$ 0.00' }],
    },
  ];
  assert.deepEqual(renderer.getPdfReportPagination('ventas.cash-historical-report'), { firstPageCapacity: 20, continuationPageCapacity: 24 });
  const historicalCashPages = renderer.paginatePdfReportSections(
    historicalCashSections,
    renderer.getPdfReportPagination('ventas.cash-historical-report'),
  );
  assert.equal(historicalCashPages.length, 1, 'Un reporte histórico con una sesión y sus cinco formas de pago debe caber en una página, sin separar la última fila de su sección.');

  console.log(`Validación PDF aprobada: ${targets.length} destinos, muestras por vista, gráficas y paginación.`);
} finally {
  await server.close();
}
