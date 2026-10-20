import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import { jsPDF } from 'jspdf';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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
  const designService = await server.ssrLoadModule('/src/app/services/pdf-document-design.service.ts');
  const generator = await server.ssrLoadModule('/src/app/utils/pdfGenerator.ts');
  const appearance = await server.ssrLoadModule('/src/app/services/pdf-appearance.ts');
  const { PdfAppearanceSettingsPanel } = await server.ssrLoadModule('/src/app/components/configuracion/PdfAppearanceSettingsPanel.tsx');
  const targets = catalog.PDF_TEMPLATE_TARGETS;

  for (const reportFile of [
    'CustomersReportTab.tsx', 'ProvidersReportTab.tsx', 'SalesReportTab.tsx',
    'PurchasesReportTab.tsx', 'FinanceReportTab.tsx', 'InventoryReportTab.tsx', 'HRReportTab.tsx',
  ]) {
    const source = await readFile(new URL(`../src/app/components/reportes/${reportFile}`, import.meta.url), 'utf8');
    const pdfStart = source.indexOf('exportPDF: async');
    const excelStart = source.indexOf('exportExcel: async', pdfStart);
    assert.ok(pdfStart >= 0 && excelStart > pdfStart, `${reportFile} debe conservar un exportador PDF y uno de Excel identificables.`);
    const pdfExport = source.slice(pdfStart, excelStart);
    assert.match(pdfExport, /drawReportKpiCards\([\s\S]*?primaryColor:\s*pdfSettings\.primaryColor[\s\S]*?secondaryColor:\s*pdfSettings\.secondaryColor/, `${reportFile} debe tomar los colores KPI de la paleta PDF.`);
    assert.match(pdfExport, /drawReportTable\([\s\S]*?color:\s*rgbPrimary/, `${reportFile} debe pintar sus tablas con el color principal del perfil PDF.`);
    assert.doesNotMatch(pdfExport, /themeConfig\.colors\.primary/, `${reportFile} no debe usar el tema de interfaz como paleta del PDF.`);
  }

  assert.ok(appearance.PDF_APPEARANCE_FONTS.length >= 30, 'El selector debe ofrecer al menos treinta fuentes locales.');
  for (const family of ['Poppins', 'Source Sans 3', 'Source Serif 4', 'Fira Code']) {
    assert.ok(appearance.PDF_APPEARANCE_FONTS.includes(family), `El catálogo debe incluir ${family}.`);
  }
  const appearancePanel = renderToStaticMarkup(React.createElement(PdfAppearanceSettingsPanel, {
    scope: 'document', profile: {}, overrides: {},
    effective: { headerComposition: 'company-left-logo-right', headerContentSpacing: 2, fontFamily: 'Inter', fontSize: 9 },
    canEditBranch: true, canEditDocument: true, hasBranchProfile: false, isSavingBranch: false,
    onScopeChange: () => {}, onChange: () => {}, onReset: () => {}, onResetAll: () => {}, onSaveBranch: () => {},
  }));
  assert.equal(appearancePanel.includes('Estilo de tabla'), false, 'El panel no debe mostrar ajustes de estilo de tabla por ahora.');
  assert.equal(appearancePanel.includes('type="color"'), true, 'La paleta de colores del PDF debe seguir configurable independientemente del tema de interfaz.');
  assert.ok(appearancePanel.includes('Fuente del documento'), 'La fuente del documento debe seguir configurable.');
  assert.ok(appearancePanel.includes('Buscar tipografía'), 'El selector debe poder buscar entre las familias disponibles.');
  assert.ok(appearancePanel.includes('data-font-family-picker'), 'La fuente debe presentarse en un selector visual, no en un select nativo.');
  assert.ok(appearancePanel.includes('pdf-font-family-scrollarea'), 'La lista de fuentes debe tener una barra de desplazamiento explícita.');
  assert.ok(appearancePanel.includes('Dancing Script'), 'El selector debe mostrar muestras manuscritas/cursivas.');

  const defaultTemplateSettings = definitions.createSystemDefaultPdfSettings();
  assert.deepEqual(
    [defaultTemplateSettings.fontFamily, defaultTemplateSettings.fontSize, defaultTemplateSettings.primaryColor, defaultTemplateSettings.secondaryColor, defaultTemplateSettings.lineColor, defaultTemplateSettings.paletteMode],
    ['Arial', 9, '#01422c', '#01422c', '#01422c', 'independent'],
    'La apariencia base debe usar la marca PDF de la sucursal y no el tema de interfaz.',
  );

  const templateAppearanceProfile = {
    templateId: 'default-v1', templateVersion: 1,
    headerComposition: 'company-left-logo-right', headerContentSpacing: 2,
    fontFamily: 'Arial', fontSize: 9, presetId: 'light', tableStyle: 'light',
    palette: { primary: '#01422c', secondary: '#01422c', text: '#334155', line: '#01422c', tableHeader: '#01422c', tableHeaderText: '#ffffff', tableRow: '#ffffff', tableStripe: '#f8fafc', tableBorder: '#d7dee7' },
  };
  const customerKpiSettings = definitions.createSystemDefaultPdfDesign('ventas.customers').settings;
  const customerKpiDefinition = definitions.createDefaultTemplateDefinition('ventas.customers', customerKpiSettings);
  const customerKpiAppearance = appearance.resolvePdfDesignAppearance(customerKpiSettings, customerKpiDefinition, templateAppearanceProfile);
  const customerKpiStyleConfig = renderer.resolvePdfStyleConfigForRender(customerKpiDefinition.metadata?.pdfStyleConfig, customerKpiAppearance.settings);
  const styledCustomerKpis = styles.applyPdfStyleToDefinition(customerKpiDefinition, customerKpiStyleConfig);
  for (const index of [0, 1, 2, 3, 4]) {
    const card = styledCustomerKpis.nodes.find(node => node.id === `report-kpi-card-${index}`);
    const label = styledCustomerKpis.nodes.find(node => node.id === `report-kpi-label-${index}`);
    assert.equal(card?.backgroundColor, '#01422c', `El KPI ${index + 1} debe usar la paleta configurada para el PDF.`);
    assert.equal(label?.color, '#ffffff', `El texto del KPI ${index + 1} debe contrastar con el fondo de marca.`);
  }

  const directKpiPdf = new jsPDF();
  const fillCalls = [];
  const textColorCalls = [];
  const originalSetFillColor = directKpiPdf.setFillColor.bind(directKpiPdf);
  const originalSetTextColor = directKpiPdf.setTextColor.bind(directKpiPdf);
  directKpiPdf.setFillColor = (...color) => { fillCalls.push(color); return originalSetFillColor(...color); };
  directKpiPdf.setTextColor = (...color) => { textColorCalls.push(color); return originalSetTextColor(...color); };
  generator.drawReportKpiCards({
    doc: directKpiPdf,
    kpis: [
      { label: 'Uno', value: '1', detail: 'Primer KPI', color: [16, 185, 129] },
      { label: 'Dos', value: '2', detail: 'Segundo KPI', color: [59, 130, 246] },
    ],
    marginX: 10, contentWidth: 190, currentY: 20, columns: 2,
    primaryColor: '#01422c', secondaryColor: '#ffffff',
  });
  assert.deepEqual(fillCalls, [[1, 66, 44], [255, 255, 255]], 'Los KPI nativos deben usar los colores del PDF y no los colores incluidos por el reporte.');
  assert.deepEqual(textColorCalls, [[255, 255, 255], [31, 41, 55]], 'El texto de los KPI nativos debe conservar contraste con colores claros y oscuros.');

  assert.equal(renderer.browserFontFamily('Inter'), '"Inter", sans-serif', 'La familia elegida debe conservarse en el render final en vez de colapsar a Arial.');
  assert.equal(renderer.browserFontFamily('Merriweather'), '"Merriweather", serif', 'Las fuentes serif deben conservar su familia local y fallback correcto.');
  assert.equal(renderer.browserFontFamily('JetBrains Mono'), '"JetBrains Mono", monospace', 'Las fuentes monoespaciadas deben conservar su familia local y fallback correcto.');
  assert.equal(renderer.browserFontFamily('Source Serif 4'), '"Source Serif 4", serif', 'Las nuevas fuentes serif deben conservar su fallback correcto.');
  assert.equal(renderer.browserFontFamily('Fira Code'), '"Fira Code", monospace', 'Las nuevas fuentes monoespaciadas deben conservar su fallback correcto.');
  assert.equal(renderer.browserFontFamily('Dancing Script'), '"Dancing Script", cursive', 'Las fuentes manuscritas deben conservar el fallback cursivo.');
  assert.equal(renderer.browserFontFamily('Press Start 2P'), '"Press Start 2P", fantasy', 'Las fuentes decorativas deben conservar un fallback display.');
  assert.equal(renderer.browserFontFamily('Bad Script'), '"Bad Script", cursive', 'Las fuentes cursivas del final de la lista deben conservar su familia y fallback.');
  assert.equal(renderer.isPdfFontFaceRule({ type: 5 }), true, 'El renderer debe reconocer las fuentes aunque el navegador no exponga CSSFontFaceRule como constructor.');
  assert.equal(renderer.isPdfFontFaceRule({ type: 1 }), false, 'Las reglas de estilo comunes no deben tratarse como archivos de fuente.');
  const fontSourceDefinition = {
    nodes: [{ id: 'font-sample', type: 'text', fontFamily: 'Georgia', fontWeight: 700, italic: true, fontSize: 12, align: 'right' }],
  };
  const selectedFontDefinition = renderer.applyPdfDocumentFontFamily(fontSourceDefinition, 'Inter');
  assert.equal(selectedFontDefinition.nodes[0].fontFamily, 'Inter', 'La tipografía global debe reemplazar la familia guardada en cada nodo.');
  assert.deepEqual(
    ['fontWeight', 'italic', 'fontSize', 'align'].map(key => selectedFontDefinition.nodes[0][key]),
    [700, true, 12, 'right'],
    'La tipografía global debe preservar peso, cursiva, tamaño relativo y alineación del nodo.'
  );
  assert.equal(fontSourceDefinition.nodes[0].fontFamily, 'Georgia', 'Aplicar la tipografía global no debe mutar la definición guardada.');
  const effectiveImportedStyle = renderer.resolvePdfStyleConfigForRender(
    { fontFamily: 'Georgia', fontSize: 12, presetId: 'boxed', tableStyle: 'boxed', palette: { primary: '#112233', tableHeader: '#223344' } },
    { fontFamily: 'Inter', fontSize: 10, pdfStylePreset: 'striped', pdfTableStyle: 'striped', primaryColor: '#abcdef', tableHeaderColor: '#fedcba' },
  );
  assert.equal(effectiveImportedStyle.fontFamily, 'Inter', 'Un estilo HTML importado no debe reemplazar la fuente compartida seleccionada.');
  assert.equal(effectiveImportedStyle.fontSize, 10);
  assert.equal(effectiveImportedStyle.tableStyle, 'striped');
  assert.equal(effectiveImportedStyle.palette.primary, '#abcdef');
  assert.equal(effectiveImportedStyle.palette.tableHeader, '#fedcba');
  const globalReportSettings = generator.getGlobalReportSettings({
    fontFamily: 'Inter', fontSize: 10, headerComposition: 'centered-stack', headerContentSpacing: 8,
    pdfTableStyle: 'striped', tableHeaderColor: '#123456', pdfAppearancePalette: { tableHeader: '#123456' },
  }, 'NovaHub');
  assert.equal(globalReportSettings.fontFamily, 'Inter', 'Los reportes con estructura propia deben conservar la apariencia de fuente resuelta.');
  assert.equal(globalReportSettings.headerComposition, 'centered-stack');
  assert.equal(globalReportSettings.headerContentSpacing, 8);
  assert.equal(globalReportSettings.pdfTableStyle, 'striped');
  assert.equal(globalReportSettings.tableHeaderColor, '#123456');
  const repairedLegacyLayout = generator.resolvePdfDesignForRender('ventas.estimate', {
    settings: { paperSize: 'LETTER', orientation: 'portrait', fontFamily: 'Lora', headerContentSpacing: 8, pdfStylePreset: 'striped', primaryColor: '#123456' },
    layoutZones: { definition: { nodes: [] } },
    appearance: { profile: { fontFamily: 'Lora' } },
  });
  assert.equal(repairedLegacyLayout.settings.fontFamily, 'Lora', 'Actualizar la estructura vieja no debe descartar la fuente global resuelta.');
  assert.equal(repairedLegacyLayout.settings.headerContentSpacing, 8);
  assert.equal(repairedLegacyLayout.settings.pdfStylePreset, 'striped');
  assert.equal(repairedLegacyLayout.settings.primaryColor, '#123456');
  assert.equal(repairedLegacyLayout.appearance.profile.fontFamily, 'Lora');
  assert.equal(catalog.isPdfTemplateFixed('ventas.cash-ticket'), true, 'Los tickets físicos deben permanecer fuera de la apariencia global.');
  assert.equal(catalog.isPdfTemplateFixed('inventario.product-labels'), true, 'Las etiquetas físicas deben permanecer fuera de la apariencia global.');
  {
    const service = designService.pdfDocumentDesignService;
    const originalActive = service.active;
    const originalGetProfile = service.getAppearanceProfile;
    let profileReads = 0;
    service.active = async () => null;
    service.getAppearanceProfile = async () => {
      profileReads += 1;
      return { fontFamily: 'Inter', headerComposition: 'logo-left-company-right', headerContentSpacing: 5 };
    };
    try {
      generator.clearPdfDesignCache();
      const resolvedDesign = await generator.getPdfDesign('auditoria.logs');
      assert.equal(resolvedDesign.settings.fontFamily, 'Inter', 'El diseño efectivo debe heredar la fuente del perfil de sucursal.');
      assert.equal(resolvedDesign.settings.headerComposition, 'logo-left-company-right');
      assert.equal(resolvedDesign.settings.headerContentSpacing, 5);
      assert.equal(profileReads, 1, 'El perfil de apariencia debe quedar cacheado con el diseño de la sucursal.');
      generator.clearPdfDesignCache();
      await generator.getPdfDesign('inventario.product-labels');
      assert.equal(profileReads, 1, 'Los formatos físicos fijos no deben cargar el perfil visual.');
    } finally {
      service.active = originalActive;
      service.getAppearanceProfile = originalGetProfile;
      generator.clearPdfDesignCache();
    }
  }

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
  assert.equal(definitions.SYSTEM_DEFAULT_PDF_SETTINGS.headerContentSpacing, 2, 'Los diseños nuevos deben usar dos milímetros después del encabezado.');
  assert.equal(definitions.normalizePdfCompanySettings({}).headerContentSpacing, 2, 'Los diseños guardados sin valor deben usar el espacio predeterminado.');
  assert.equal(definitions.normalizePdfCompanySettings({ headerContentSpacing: 'large' }).headerContentSpacing, 8, 'Los valores antiguos deben convertirse a su equivalente en milímetros.');
  assert.equal(definitions.normalizePdfCompanySettings({ headerContentSpacing: 'invalid' }).headerContentSpacing, 2, 'Un valor desconocido debe volver al espacio predeterminado compatible.');
  const independentlyConfiguredDesign = definitions.normalizePdfCompanySettings({ headerContentSpacing: 8 });
  const untouchedDesign = definitions.normalizePdfCompanySettings({});
  assert.equal(independentlyConfiguredDesign.headerContentSpacing, 8, 'El espacio configurado debe pertenecer al diseño seleccionado.');
  assert.equal(untouchedDesign.headerContentSpacing, 2, 'El espacio de otro diseño debe permanecer en el valor predeterminado.');
  const cssPixelsPerMillimeter = 96 / 25.4;
  assert.equal(renderer.resolvePdfHeaderContentGap(5, 1000, 2), 2 * cssPixelsPerMillimeter, 'El número ingresado se interpreta en milímetros.');
  assert.equal(renderer.resolvePdfHeaderContentGap(5, 1000, 5), 5 * cssPixelsPerMillimeter, 'Los valores personalizados conservan la separación física.');
  assert.equal(renderer.resolvePdfHeaderContentGap(5, 1000, 8), 8 * cssPixelsPerMillimeter, 'La separación no depende de la orientación o dimensión de página.');
  assert.equal(renderer.resolvePdfHeaderContentGap(5, 1000, 'medium'), 5 * cssPixelsPerMillimeter, 'Los valores guardados anteriores siguen siendo compatibles.');
  assert.equal(renderer.resolvePdfHeaderContentTop(40, 100, 5, 1000, 2, false), 40 + 2 * cssPixelsPerMillimeter, 'Los PDF predeterminados deben iniciar a la misma distancia medida desde el encabezado, aunque sus posiciones base difieran.');
  assert.equal(renderer.resolvePdfHeaderContentTop(40, 220, 5, 1000, 2, false), 40 + 2 * cssPixelsPerMillimeter, 'Una posición heredada más baja no debe conservar un hueco adicional por PDF.');
  assert.equal(renderer.resolvePdfHeaderContentTop(40, 100, 5, 1000, 5, true), 100 + 3 * cssPixelsPerMillimeter, 'El espacio global debe incrementar la distancia física sin perder la posición personalizada.');
  assert.equal(renderer.resolvePdfHeaderContentTop(40, 100, 5, 1000, 8, true), 100 + 6 * cssPixelsPerMillimeter, 'El espacio mayor debe incrementar la distancia más que el anterior.');
  assert.equal(renderer.resolvePdfHeaderContentTop(150, 100, 5, 1000, 5, false), 150 + 5 * cssPixelsPerMillimeter, 'Un encabezado alto debe mantener su distancia física uniforme respecto al contenido.');
  assert.equal(renderer.resolvePdfCompactTableTop(100), 100 + 5 * cssPixelsPerMillimeter, 'Las tablas de listados deben seguir el último dato visible con un margen compacto.');

  const supplierHistoryDefault = definitions.createSystemDefaultPdfDesign('compras.supplier-history');
  assert.deepEqual(
    [supplierHistoryDefault.settings.paperSize, supplierHistoryDefault.settings.orientation],
    ['LETTER', 'portrait'],
    'El historial de proveedor debe usar Carta vertical como los demás documentos estándar de una entidad.',
  );

  const generatedFallback = renderer.normalizeReportDocumentMetadata({
    period: 'Periodo: agosto 2026',
    generated: 'Generado: 08/09/2026 10:30',
    meta: 'Generado: 08/09/2026 10:30',
    generatedInMetaFallback: true,
  }, 1);
  assert.equal(generatedFallback.generated, '', 'Cuando Generado se lleva a metadatos, no debe quedar el campo independiente.');
  assert.equal(generatedFallback.meta, 'Generado: 08/09/2026 10:30', 'Generado debe aparecer una sola vez en metadatos.');
  const generatedFallbackContinuation = renderer.normalizeReportDocumentMetadata({
    period: 'Periodo: agosto 2026', generated: 'Generado: 08/09/2026 10:30',
    meta: 'Generado: 08/09/2026 10:30', generatedInMetaFallback: true,
  }, 2);
  assert.equal(generatedFallbackContinuation.generated, '', 'Generado no debe repetirse en páginas de continuación.');
  assert.equal(generatedFallbackContinuation.meta, '', 'Los metadatos de portada no deben repetirse en páginas siguientes.');

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
  assert.equal(customerHistoryPartyName.y, customerHistoryTitle.y, 'El nombre del cliente y el título del historial deben compartir la misma banda.');
  const customerHistoryNode = id => customerHistoryDefinition.nodes.find(node => node.id === id);
  assert.ok(customerHistoryNode('party-tax-id').y > customerHistoryNode('document-status').y, 'Los datos del cliente deben quedar debajo del encabezado y sus metadatos.');
  assert.ok(customerHistoryNode('items-table').y > customerHistoryNode('party-balance-summary').y, 'La tabla del historial debe comenzar después del último dato real del cliente.');

  const customerListDefinition = definitions.createDefaultTemplateDefinition('ventas.customers', definitions.createSystemDefaultPdfDesign('ventas.customers').settings);
  const customerListSections = customerListDefinition.nodes.find(node => node.id === 'report-sections');
  assert.equal(customerListSections.x, 5, 'El listado de clientes debe usar el margen de la zona útil.');
  assert.equal(customerListSections.width, 90, 'El listado de clientes debe ocupar todo el ancho útil.');
  assert.equal(customerListSections.backgroundColor, 'transparent', 'El listado de clientes no debe usar una tarjeta exterior.');
  assert.equal(customerListSections.borderColor, 'transparent', 'El listado de clientes no debe usar un recuadro exterior.');
  assert.deepEqual(customerListSections.columns.map(column => column.width), [10, 18, 12, 16, 24, 12, 8], 'El listado de clientes debe reservar espacio suficiente para tipo y contacto.');

  assert.equal(
    renderer.resolvePdfHeaderAnchoredTop(80, 160, 6, false),
    86,
    'La posición predeterminada de la información comercial debe seguir el contenido real del encabezado, aunque la coordenada base sea más baja.',
  );
  assert.equal(
    renderer.resolvePdfHeaderAnchoredTop(170, 160, 6, false),
    176,
    'Un encabezado más alto debe empujar la información comercial hacia abajo sin superponerla.',
  );
  assert.equal(
    renderer.resolvePdfHeaderAnchoredTop(80, 160, 6, true),
    160,
    'Una plantilla personalizada debe conservar su posición configurada cuando deja más espacio que el encabezado.',
  );
  assert.equal(
    renderer.resolvePdfHeaderAnchoredTop(170, 160, 6, true),
    176,
    'Una plantilla personalizada solo se desplaza cuando el encabezado renderizado alcanza su contenido.',
  );
  assert.equal(
    renderer.resolvePdfHistoryInfoTop(160, 210, 6),
    216,
    'Los datos del cliente deben comenzar debajo del encabezado o del nombre si este ocupa varias líneas.',
  );
  assert.equal(
    renderer.resolvePdfReportTableBorderColor('ventas.customers', 'transparent', '#cbd5e1'),
    '#cbd5e1',
    'El listado de clientes debe usar el color de línea configurado para separar filas aunque el nodo no tenga borde exterior.',
  );
  assert.equal(
    renderer.resolvePdfReportTableBorderColor('reportes.customers', 'transparent', '#cbd5e1'),
    'transparent',
    'La corrección de bordes del listado de clientes no debe cambiar otras tablas.',
  );

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

  const cashHistoryDefinition = definitions.createDefaultTemplateDefinition('ventas.cash-historical-report', definitions.createSystemDefaultPdfDesign('ventas.cash-historical-report').settings);
  const rightAlignedCashIdentity = definitions.applyPdfHeaderComposition(cashHistoryDefinition, 'logo-left-company-right', 'ventas.cash-historical-report');
  const rightAlignedCashSummary = rightAlignedCashIdentity.nodes.find(node => node.id === 'company-summary');
  assert.deepEqual(
    [rightAlignedCashSummary?.x, rightAlignedCashSummary?.width, rightAlignedCashSummary?.align],
    [41, 54, 'right'],
    'Al invertir el encabezado de un reporte, el eslogan, dirección e identificación deben moverse y alinearse con el nombre de empresa.',
  );
  const centeredCashIdentity = definitions.applyPdfHeaderComposition(cashHistoryDefinition, 'centered-stack', 'ventas.cash-historical-report');
  const centeredCashSummary = centeredCashIdentity.nodes.find(node => node.id === 'company-summary');
  assert.deepEqual(
    [centeredCashSummary?.x, centeredCashSummary?.width, centeredCashSummary?.align],
    [5, 90, 'center'],
    'Al centrar el encabezado de un reporte, todas las líneas de datos empresariales deben ocupar y alinearse al centro.',
  );

  const supplierHistoryDefinition = definitions.createDefaultTemplateDefinition('compras.supplier-history', definitions.createSystemDefaultPdfDesign('compras.supplier-history').settings);
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'document-title').x, 55, 'El título del historial de proveedor debe ocupar la banda derecha.');
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'party-name').x, 5, 'El nombre del proveedor debe ocupar el lado izquierdo de la banda del título.');
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'party-name').width, 44, 'El nombre del proveedor debe dejar libre la banda derecha para el título.');
  assert.equal(supplierHistoryDefinition.nodes.find(node => node.id === 'party-name').y, supplierHistoryDefinition.nodes.find(node => node.id === 'document-title').y, 'El nombre del proveedor y el título del historial deben compartir la misma banda.');
  assert.ok(supplierHistoryDefinition.nodes.find(node => node.id === 'party-tax-id').y > supplierHistoryDefinition.nodes.find(node => node.id === 'report-meta').y, 'Los datos del proveedor deben quedar debajo de los metadatos del historial.');
  assert.ok(supplierHistoryDefinition.nodes.find(node => node.id === 'items-table').y > supplierHistoryDefinition.nodes.find(node => node.id === 'party-balance-summary').y, 'La tabla del proveedor debe comenzar después del último dato real.');

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
