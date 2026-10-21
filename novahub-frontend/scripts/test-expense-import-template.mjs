import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { downloadExpenseImportTemplate } from '../src/app/components/compras/expense-import-template.ts';

const downloads = [];
globalThis.document = {
  body: { appendChild: () => undefined },
  createElement: () => ({
    href: '',
    download: '',
    click() { downloads.push({ filename: this.download, blob: activeBlob }); },
    remove: () => undefined,
  }),
};

let activeBlob;
URL.createObjectURL = (blob) => { activeBlob = blob; return 'blob:expense-import-template-test'; };
URL.revokeObjectURL = () => undefined;

await downloadExpenseImportTemplate();
const download = downloads.at(-1);
assert.equal(download.filename, 'Plantilla_Gastos_Masiva.xlsx');

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(Buffer.from(await download.blob.arrayBuffer()));
assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Guía', 'Gastos']);
assert.match(String(workbook.getWorksheet('Guía').getCell('B1').value), /Gastos de Compras/);

const expenses = workbook.getWorksheet('Gastos');
assert.deepEqual(expenses.getRow(1).values.slice(1), [
  'Fecha', 'Descripción', 'Categoría', 'Categoría personalizada', 'Monto', 'Moneda',
  'Tasa de cambio', 'Estado', 'Método de pago', 'Pagado a', 'Referencia', 'Número de cuenta bancaria',
]);
assert.ok(expenses.getCell('A2').value instanceof Date);
assert.equal(expenses.getColumn(12).numFmt, '@');
assert.equal(expenses.getCell('L4').value, '001234560078');
assert.equal(expenses.getCell('E2').value, 1500);
assert.equal(expenses.getCell('G3').value, 36.5);
assert.deepEqual(expenses.getCell('C2').dataValidation.formulae, ['"OPERATIVO,ADMINISTRATIVO,VENTAS,FINANCIERO,OTRO"']);
assert.deepEqual(expenses.getCell('F5000').dataValidation.formulae, ['"NIO,USD"']);
assert.deepEqual(expenses.getCell('H5000').dataValidation.formulae, ['"DRAFT,PENDING,PAID"']);
assert.deepEqual(expenses.getCell('I5000').dataValidation.formulae, ['"EFECTIVO,TARJETA,TRANSFERENCIA,CHEQUE"']);
assert.equal(expenses.getCell('E5000').dataValidation.operator, 'greaterThan');
assert.equal(expenses.getCell('G5000').dataValidation.operator, 'greaterThan');
assert.equal(expenses.getCell('F5001').dataValidation, undefined);
assert.equal(expenses.views[0].state, 'frozen');
assert.equal(expenses.views[0].ySplit, 1);

console.log('La plantilla de gastos conserva las hojas, columnas, valores de ejemplo, filtros y validaciones.');
