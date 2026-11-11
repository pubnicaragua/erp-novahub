import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const receiptView = source('../src/app/components/compras/RecepcionesCompraView.tsx');
const purchaseExports = source('../src/app/utils/purchaseExports.ts');

assert.match(
  receiptView,
  /unitPriceLabel:\s*formatConvertedAmount\(Number\(item\.unitPrice \|\| 0\), receipt\.currency \|\| operationCurrency, receipt\.exchangeRate \|\| receipt\.purchaseOrder\?\.exchangeRate\)/,
  'El detalle del panel debe convertir el precio unitario a la moneda de visualización.',
);
assert.match(
  receiptView,
  /totalLabel:\s*formatConvertedAmount\(lineTotal, receipt\.currency \|\| operationCurrency, receipt\.exchangeRate \|\| receipt\.purchaseOrder\?\.exchangeRate\)/,
  'El detalle del panel debe convertir el total de cada línea a la moneda de visualización.',
);
assert.match(receiptView, /label:\s*'Moneda de operación'/, 'El panel debe identificar la moneda original de la recepción.');
assert.match(receiptView, /label:\s*'Moneda de visualización'/, 'El panel debe identificar la moneda activa del Topbar.');
assert.match(receiptView, /await previewPurchaseRecordPDF\(receiptPdfParams\(receipt, format\)\)/, 'La acción existente de descarga debe abrir el visor antes de guardar.');
assert.match(purchaseExports, /export async function previewPurchaseRecordPDF/, 'El generador de compras debe abrir el documento en el navegador.');
assert.match(purchaseExports, /save\s*=\s*true/, 'La descarga directa debe conservarse como opción explícita.');
assert.match(purchaseExports, /generatePurchaseRecordPDF\(\{ \.\.\.options, save: false \}\)/, 'La vista previa debe generar el PDF sin descargarlo automáticamente.');
assert.match(purchaseExports, /previewWindow\.location\.replace\(previewUrl\)/, 'El PDF debe abrirse dentro del visor del navegador.');
assert.match(receiptView, /unitPrice:\s*formatConvertedAmount\(Number\(item\.unitPrice \|\| 0\), operationCurrency, operationExchangeRate\)/, 'El PDF debe convertir el precio unitario.');
assert.match(receiptView, /total:\s*formatConvertedAmount\(totalDetails\.amount, totalDetails\.currency, totalDetails\.exchangeRate\)/, 'El PDF debe convertir el total.');
assert.match(receiptView, /\{ label: 'Subtotal', value: formatConvertedAmount\(/, 'El PDF debe convertir el subtotal.');
assert.match(receiptView, /\{ label: 'Impuestos', value: formatConvertedAmount\(/, 'El PDF debe convertir los impuestos.');
assert.match(receiptView, /\{ label: 'Retención', value: formatConvertedAmount\(/, 'El PDF debe convertir la retención.');
const previewStart = purchaseExports.indexOf('export async function previewPurchaseRecordPDF');
const openWindow = purchaseExports.indexOf("window.open('', '_blank'", previewStart);
const generatePdf = purchaseExports.indexOf('await generatePurchaseRecordPDF', openWindow);
assert.ok(previewStart >= 0 && openWindow > previewStart && generatePdf > openWindow, 'La pestaña debe abrirse de inmediato para evitar el bloqueo de ventanas emergentes.');

console.log('Cobertura de moneda y vista previa de recepción: 15 aserciones correctas.');
