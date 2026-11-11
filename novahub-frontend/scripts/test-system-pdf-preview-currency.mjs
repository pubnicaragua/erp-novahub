import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
const previewPath = fileURLToPath(new URL('../src/app/utils/pdfBrowserPreview.ts', import.meta.url));
assert.ok(existsSync(previewPath), 'debe existir un helper compartido para previsualizar PDFs');
const preview = readFileSync(previewPath, 'utf8');
const pdfButton = source('../src/app/components/ui/PdfDownloadButton.tsx');
const exportMenu = source('../src/app/components/ui/ExportMenu.tsx');
const directPdfSinks = [
  '../src/app/utils/pdfGenerator.ts',
  '../src/app/utils/pdf-template-renderer.ts',
  '../src/app/utils/purchaseExports.ts',
  '../src/app/utils/managerQuotesExport.ts',
  '../src/app/utils/managerReportPdf.ts',
  '../src/app/utils/managerSalesExport.ts',
  '../src/app/utils/novaHubFormatPdf.ts',
  '../src/app/utils/novaHubCommercialFormatPdf.ts',
  '../src/app/utils/platformQuotePdf.ts',
  '../src/app/components/finanzas/FinanceBalanceView.tsx',
  '../src/app/components/finanzas/FinanceImportModal.tsx',
  '../src/app/components/finanzas/FinanceTableView.tsx',
  '../src/app/components/hr/ImportDataModal.tsx',
  '../src/app/components/hr/NominasView.tsx',
  '../src/app/components/reportes/CustomersReportTab.tsx',
  '../src/app/components/reportes/FinanceReportTab.tsx',
  '../src/app/components/reportes/HRReportTab.tsx',
  '../src/app/components/reportes/InventoryReportTab.tsx',
  '../src/app/components/reportes/ProvidersReportTab.tsx',
  '../src/app/components/reportes/PurchasesReportTab.tsx',
  '../src/app/components/reportes/SalesReportTab.tsx',
  '../src/app/components/TenantOverview.tsx',
];

assert.match(preview, /export function beginPdfBrowserPreview/);
assert.match(preview, /export function showPdfInBrowserPreview/);
assert.match(preview, /window\.open\(/);
assert.doesNotMatch(preview, /\.download\s*=/, 'el helper debe abrir el PDF en el navegador, no descargarlo directamente');
assert.match(pdfButton, /beginPdfBrowserPreview\(/, 'el menú debe abrir el visor durante el gesto del usuario');
assert.match(exportMenu, /beginPdfBrowserPreview\(/, 'las exportaciones comunes deben abrir el visor durante el gesto del usuario');

for (const relativePath of directPdfSinks) {
  const content = source(relativePath);
  assert.doesNotMatch(content, /\b(?:doc|pdf)\.save\s*\(/, `${relativePath} aún descarga el PDF sin pasar por el visor`);
}

const recurringSupplierInvoices = source('../src/app/components/compras/FacturasProveedorRecView.tsx');
const recurringExpenses = source('../src/app/components/compras/GastosRecurrentesView.tsx');
const purchasePayments = source('../src/app/components/compras/PagosRealizadosView.tsx');
assert.match(recurringSupplierInvoices, /formatConvertedAmount\(Number\(detailInvoice\.total[^\n]*detailInvoice\.exchangeRate\)/);
assert.match(recurringSupplierInvoices, /unitPriceLabel: formatConvertedAmount\(Number\(item\.unitPrice[^\n]*detailInvoice\.exchangeRate\)/);
assert.match(recurringExpenses, /totalLabel: formatConvertedAmount\(Number\(detailExpense\.amount[^\n]*detailExpense\.exchangeRate\)/);
assert.match(purchasePayments, /totalLabel: formatConvertedAmount\(Number\(detailPayment\.amount[^\n]*detailPayment\.exchangeRate\)/);
assert.match(purchasePayments, /unitPriceLabel: formatConvertedAmount\(Number\(payment\.amount[^\n]*payment\.exchangeRate/);

console.log('Cobertura del visor PDF del navegador y de paneles monetarios: correcta.');
