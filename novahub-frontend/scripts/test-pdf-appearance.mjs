import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PDF_APPEARANCE_FONTS,
  PDF_APPEARANCE_FONT_GROUPS,
  inferLegacyPdfAppearanceOverrides,
  normalizePdfAppearanceProfile,
  resolvePdfDesignAppearance,
  resetPdfAppearanceOverride,
  resolvePdfAppearance,
  updatePdfAppearanceDraft,
  clearPdfAppearanceFallback,
} from '../src/app/services/pdf-appearance.ts';

const fallback = {
  headerComposition: 'company-left-logo-right',
  headerContentSpacing: 'small',
  fontFamily: 'Arial',
  fontSize: 9,
  presetId: 'light',
  tableStyle: 'light',
  palette: { primary: '#112233', text: '#334455' },
};

const [globalStylesheet, fontStylesheet] = await Promise.all([
  readFile(new URL('../src/styles/index.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles/fonts.css', import.meta.url), 'utf8'),
]);
const loadedFontStylesheet = `${globalStylesheet}\n${fontStylesheet}`;
for (const family of PDF_APPEARANCE_FONTS) {
  const packageName = family.toLowerCase().replaceAll(' ', '-');
  assert.ok(loadedFontStylesheet.includes(`@fontsource/${packageName}/`), `Debe cargarse localmente la fuente ${family} para que cambie en el PDF.`);
}

{
  const effective = resolvePdfAppearance(
    fallback,
    { fontFamily: 'Inter', headerContentSpacing: 'medium', palette: { primary: '#223344' } },
    { fontFamily: 'Lora', palette: { text: '#abcdef' } },
  );
  assert.equal(effective.fontFamily, 'Lora');
  assert.equal(effective.headerContentSpacing, 'medium');
  assert.deepEqual(effective.palette, { primary: '#223344', text: '#abcdef' });
}

{
  const effective = resolvePdfAppearance(fallback, { headerContentSpacing: 'large' }, { fontFamily: 'Roboto' });
  assert.equal(effective.headerContentSpacing, 'large');
  assert.equal(effective.fontFamily, 'Roboto');
  assert.equal(effective.headerComposition, fallback.headerComposition);
  assert.equal(effective.tableStyle, fallback.tableStyle);
}

{
  const overrides = { fontFamily: 'Lato', tableStyle: 'striped' };
  const reset = resetPdfAppearanceOverride(overrides, 'fontFamily');
  assert.deepEqual(reset, { tableStyle: 'striped' });
  assert.equal(resolvePdfAppearance(fallback, { fontFamily: 'Inter' }, reset).fontFamily, 'Inter');
  assert.equal(overrides.fontFamily, 'Lato');
}

{
  const overrides = inferLegacyPdfAppearanceOverrides('ventas.estimate', {
    fontFamily: 'helvetica',
    headerComposition: 'company-left-logo-right',
    headerContentSpacing: 'small',
    paperSize: 'A4',
    orientation: 'landscape',
  }, {
    metadata: { pdfStyleConfig: { fontFamily: 'Georgia', fontSize: 9, presetId: 'light', tableStyle: 'light' } },
  });
  assert.deepEqual(overrides, { fontFamily: 'Georgia' });
  assert.equal('paperSize' in overrides, false);
  assert.equal('orientation' in overrides, false);
}

{
  const overrides = inferLegacyPdfAppearanceOverrides('ventas.estimate', {
    fontFamily: 'Ancient ERP Font',
    headerContentSpacing: 'unexpected-spacing',
  }, {});
  assert.equal(overrides.fontFamily, 'Ancient ERP Font');
  assert.equal(overrides.headerContentSpacing, 'unexpected-spacing');
}

{
  const normalized = normalizePdfAppearanceProfile({ fontFamily: 'Not Packaged', fontSize: 30, palette: { primary: '#abcdef', other: '#000000' } });
  assert.deepEqual(normalized, { palette: { primary: '#abcdef' } });
  assert.ok(PDF_APPEARANCE_FONTS.length >= 70, 'El catálogo debe ofrecer una variedad amplia de tipografías, como un editor de documentos.');
  assert.ok(PDF_APPEARANCE_FONTS.includes('Inter'));
  assert.ok(PDF_APPEARANCE_FONTS.includes('JetBrains Mono'));
  assert.ok(PDF_APPEARANCE_FONT_GROUPS.some(group => group.label === 'Cursivas y manuscritas' && group.families.includes('Dancing Script')));
  assert.ok(PDF_APPEARANCE_FONT_GROUPS.some(group => group.label === 'Decorativas' && group.families.includes('Creepster')));
  assert.deepEqual(
    new Set(PDF_APPEARANCE_FONT_GROUPS.flatMap(group => group.families)),
    new Set(PDF_APPEARANCE_FONTS),
    'Todas las fuentes del catálogo deben aparecer agrupadas en el selector.',
  );
}

{
  const resolved = resolvePdfDesignAppearance(
    { headerComposition: 'company-left-logo-right', headerContentSpacing: 'small', fontFamily: 'Arial', appearanceOverrides: { fontFamily: 'Lora' }, paperSize: 'A4', orientation: 'landscape' },
    { metadata: { pdfStyleConfig: { fontFamily: 'Georgia', fontSize: 9, palette: { primary: '#123456' }, tableStyle: 'light' } } },
    { fontFamily: 'Inter', headerContentSpacing: 'large', palette: { primary: '#abcdef', tableHeader: '#234567' } },
  );
  assert.equal(resolved.settings.fontFamily, 'Lora', 'El override local debe prevalecer sobre el perfil y los estilos heredados.');
  assert.equal(resolved.settings.headerContentSpacing, 'large', 'Los valores no personalizados localmente deben heredar el perfil global.');
  assert.equal(resolved.settings.primaryColor, '#abcdef', 'La paleta global debe aplicarse por propiedad.');
  assert.equal(resolved.settings.tableHeaderColor, '#234567', 'La paleta de tabla global debe llegar al renderer.');
  assert.equal(resolved.settings.paperSize, 'A4', 'La apariencia no debe cambiar el papel del documento.');
  assert.equal(resolved.settings.orientation, 'landscape', 'La apariencia no debe cambiar la orientación del documento.');
}

{
  const reset = resolvePdfDesignAppearance(
    { fontFamily: 'Georgia', appearanceOverrides: {} },
    { metadata: { pdfStyleConfig: { fontFamily: 'Georgia' } } },
    { fontFamily: 'Inter' },
  );
  assert.equal(reset.settings.fontFamily, 'Inter', 'Un objeto local vacío explícito debe seguir heredando tras restablecer.');
  assert.deepEqual(reset.overrides, {});
}

{
  const legacyDefinition = { metadata: { pdfStyleConfig: { fontFamily: 'Lora', palette: { primary: '#123456' } } } };
  const legacySettings = { fontFamily: 'Lora', primaryColor: '#123456' };
  const clearedFont = clearPdfAppearanceFallback(legacySettings, legacyDefinition, 'fontFamily');
  const resetFont = resolvePdfDesignAppearance({ ...clearedFont.settings, appearanceOverrides: {} }, clearedFont.definition, {});
  assert.equal(resetFont.settings.fontFamily, 'Arial', 'Restablecer una fuente local sin perfil global debe volver a la fuente ERP por defecto.');
  assert.equal(legacySettings.fontFamily, 'Lora', 'Limpiar un override no debe mutar el diseño fuente.');

  const clearedPrimary = clearPdfAppearanceFallback(legacySettings, legacyDefinition, 'palette.primary');
  const resetPrimary = resolvePdfDesignAppearance({ ...clearedPrimary.settings, appearanceOverrides: {} }, clearedPrimary.definition, {});
  assert.equal(resetPrimary.settings.primaryColor, '#65536b', 'Restablecer un color local debe descartar el valor legado del estilo.');

  const clearedAll = clearPdfAppearanceFallback(
    { paperSize: 'A4', orientation: 'landscape', fontFamily: 'Lora', margins: 18 },
    { nodes: [{ id: 'items', type: 'table' }], metadata: { pdfStyleConfig: { fontFamily: 'Lora' } } },
  );
  assert.deepEqual([clearedAll.settings.paperSize, clearedAll.settings.orientation, clearedAll.settings.margins], ['A4', 'landscape', 18], 'Restablecer apariencia debe conservar papel y márgenes del PDF.');
  assert.deepEqual(clearedAll.definition.nodes, [{ id: 'items', type: 'table' }], 'Restablecer apariencia no debe alterar contenido del documento.');
}

{
  const branchDraft = updatePdfAppearanceDraft('branch', { fontFamily: 'Inter' }, { fontFamily: 'Lora' }, 'fontFamily', 'Roboto');
  assert.deepEqual(branchDraft.profile, { fontFamily: 'Roboto' }, 'La edición global solo debe cambiar el perfil de sucursal.');
  assert.deepEqual(branchDraft.overrides, { fontFamily: 'Lora' }, 'Editar global no debe mutar overrides locales.');
  const localDraft = updatePdfAppearanceDraft('document', { fontFamily: 'Inter' }, {}, 'palette.primary', '#abcdef');
  assert.deepEqual(localDraft.profile, { fontFamily: 'Inter' }, 'La edición local no debe mutar el perfil global.');
  assert.deepEqual(localDraft.overrides, { palette: { primary: '#abcdef' } });
  assert.deepEqual(resetPdfAppearanceOverride({ palette: { primary: '#abcdef', text: '#123456' } }, 'palette.primary'), { palette: { text: '#123456' } }, 'Restablecer un color debe conservar los demás overrides de la paleta.');
}

console.log('Validación PDF appearance aprobada: herencia, paleta, reset, legado y catálogo de fuentes.');
