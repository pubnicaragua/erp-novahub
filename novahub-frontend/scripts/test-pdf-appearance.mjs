import assert from 'node:assert/strict';
import {
  PDF_APPEARANCE_FONTS,
  inferLegacyPdfAppearanceOverrides,
  normalizePdfAppearanceProfile,
  resetPdfAppearanceOverride,
  resolvePdfAppearance,
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
  assert.ok(PDF_APPEARANCE_FONTS.includes('Inter'));
  assert.ok(PDF_APPEARANCE_FONTS.includes('JetBrains Mono'));
}

console.log('Validación PDF appearance aprobada: herencia, paleta, reset, legado y catálogo de fuentes.');
