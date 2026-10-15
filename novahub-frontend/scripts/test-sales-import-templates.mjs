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
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Guía', 'Documentos', 'Detalle']);
  assert.match(String(workbook.getWorksheet('Guía').getCell('B1').value), new RegExp(documentTitle));

  const documents = workbook.getWorksheet('Documentos');
  assert.deepEqual(documents.getRow(1).values.slice(1), [
    'Referencia de factura',
    'Fecha',
    'Código de cliente',
    'Código de lista de precios',
    'Moneda',
    'Método de pago',
    'Observación',
  ]);
  assert.equal(documents.getCell('F2').value, 'EFECTIVO');
  assert.equal(documents.getCell('C2').value, '');
  assert.deepEqual(documents.getCell('F2').dataValidation.formulae, ['"EFECTIVO"']);

  const detail = workbook.getWorksheet('Detalle');
  assert.deepEqual(detail.getRow(1).values.slice(1), [
    'Referencia de factura',
    'Código/SKU del producto o variante',
    'Cantidad',
    'Nombre exacto de bodega',
    'Descuento (%)',
    'IVA',
  ]);
  assert.equal(detail.getCell('B2').value, 'SKU-EJEMPLO');
  assert.equal(detail.getCell('C2').value, 1);
  assert.deepEqual(detail.getCell('F2').dataValidation.formulae, ['"GRAVADO,EXENTO"']);
}

console.log('Las dos plantillas conservan las hojas, encabezados, ejemplos y validaciones acordados.');
