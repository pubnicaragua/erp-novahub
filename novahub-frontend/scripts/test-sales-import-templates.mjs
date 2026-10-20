import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { downloadSalesImportTemplate } from '../src/app/components/ventas/importacion/sales-import-template.ts';

const downloads = [];
globalThis.document = {
  body: { appendChild: () => undefined },
  createElement: () => ({
    href: '',
    download: '',
    click() {
      downloads.push({ filename: this.download, blob: activeBlob });
    },
    remove: () => undefined,
  }),
};

let activeBlob;
URL.createObjectURL = (blob) => {
  activeBlob = blob;
  return 'blob:sales-import-template-test';
};
URL.revokeObjectURL = () => undefined;

for (const [kind, expectedFilename, documentTitle] of [
  ['INVOICE', 'Plantilla_Facturas_Masivas.xlsx', 'Facturas'],
  ['POS', 'Plantilla_Caja_Masiva.xlsx', 'Ventas de Caja'],
]) {
  await downloadSalesImportTemplate(kind);
  const download = downloads.at(-1);
  assert.equal(download.filename, expectedFilename);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await download.blob.arrayBuffer()));
  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    kind === 'INVOICE'
      ? ['Guía', 'Documentos', 'Detalle', 'Cargos']
      : ['Guía', 'Documentos', 'Detalle'],
  );
  assert.match(String(workbook.getWorksheet('Guía').getCell('B1').value), new RegExp(documentTitle));
  assert.equal(
    workbook.getWorksheet('Guía').getCell('B8').value,
    'Deja vacío o escribe EXENTO para no aplicar IVA. Escribe GRAVADO para aplicar la tasa configurada en el producto. Los servicios no llevan IVA.',
  );

  const documents = workbook.getWorksheet('Documentos');
  assert.deepEqual(documents.getRow(1).values.slice(1), [
    'Referencia de factura',
    'Fecha',
    'Código de cliente',
    'Moneda',
    'Método de pago',
    ...(kind === 'INVOICE' ? ['Referencia de pago'] : []),
    'Observación',
  ]);
  assert.equal(documents.getCell('E2').value, 'EFECTIVO');
  assert.equal(documents.getCell('C2').value, '');
  assert.deepEqual(
    documents.getCell('E2').dataValidation.formulae,
    [kind === 'INVOICE' ? '"EFECTIVO,TARJETA,TRANSFERENCIA,CHEQUE"' : '"EFECTIVO"'],
  );

  const detail = workbook.getWorksheet('Detalle');
  assert.deepEqual(detail.getRow(1).values.slice(1), [
    'Referencia de factura',
    'Código/SKU del producto o variante',
    'Nombre de lista de precios',
    'Cantidad',
    'Nombre exacto de bodega',
    'Descuento (%)',
    'IVA',
  ]);
  assert.equal(detail.getCell('B2').value, 'SKU-EJEMPLO');
  assert.equal(detail.getCell('D2').value, 1);
  assert.deepEqual(detail.getCell('G2').dataValidation.formulae, ['"GRAVADO,EXENTO"']);

  if (kind === 'INVOICE') {
    const charges = workbook.getWorksheet('Cargos');
    assert.deepEqual(charges.getRow(1).values.slice(1), [
      'Referencia de factura',
      'Tipo de cargo',
      'Descripción',
      'Monto',
    ]);
    assert.deepEqual(charges.getCell('B2').dataValidation.formulae, ['"EXTRA,DELIVERY"']);
    assert.equal(charges.getCell('C2').value, 'Instalación de ejemplo');
    assert.equal(charges.getCell('B3').value, 'DELIVERY');
    assert.equal(charges.getCell('D3').value, 150);
    assert.equal(charges.getCell('D2').dataValidation.operator, 'greaterThan');
    assert.ok(
      workbook.getWorksheet('Guía').getColumn(1).values.some((value) => value === 'Servicios'),
    );
  }
}

console.log('Las plantillas de Facturas y Caja conservan sus hojas, encabezados, ejemplos y validaciones acordados.');
