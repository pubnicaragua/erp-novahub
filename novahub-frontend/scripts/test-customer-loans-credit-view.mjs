import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const service = read('../src/app/services/ventas.service.ts');
const page = read('../src/app/components/VentasPage.tsx');
const creditsView = read('../src/app/components/ventas/NotasCreditoView.tsx');
const receiptDialog = read('../src/app/components/ventas/SalesPaymentReceiptDialog.tsx');
const loanPanel = read('../src/app/components/ventas/CustomerLoansPanel.tsx');
const types = read('../src/app/types/index.ts');

assert.match(service, /creditDocumentsService\s*=\s*\{[\s\S]*?getAll:[\s\S]*?\/sales\/credit-documents/,
  'Credits view should use the unified credit document endpoint');
assert.match(service, /customerLoansService\s*=\s*\{[\s\S]*?applyPayment:[\s\S]*?idempotentPost[\s\S]*?\/sales\/customer-loans\/\$\{id\}\/payments/,
  'Loan payments should use the loan endpoint with an idempotent POST');
assert.match(page, /creditDocumentsService\.getAll\(/,
  'Ventas should load mixed credit notes and loans');
assert.match(creditsView, /row\.kind\s*===\s*'CREDIT_NOTE'[\s\S]*?handleIssue/,
  'Credit-note-only actions should be hidden from loan rows');
assert.match(creditsView, /customerLoansService\.applyPayment\(/,
  'Loan payments should be routed to the customer-loan service');
assert.match(creditsView, /createIdempotencyKey\('customer-loan-payment'\)/,
  'Each loan payment should carry an explicit idempotency key');
assert.match(creditsView, /invoiceNumber:\s*paymentCredit\.kind\s*===\s*'CUSTOMER_LOAN'/,
  'Loan payment receipts should retain the linked invoice number');
assert.match(creditsView, /paymentCredit\.kind\s*===\s*'CUSTOMER_LOAN'[\s\S]*?CUSTOMER_BALANCE/,
  'Customer balance should not be offered for loan payments');
assert.match(receiptDialog, /payment\.invoiceNumber[\s\S]*?CUSTOMER_LOAN[\s\S]*?Factura del préstamo/,
  'The local payment receipt should identify the loan invoice');
assert.match(types, /frequency:\s*'DAILY'\s*\|\s*'WEEKLY'\s*\|\s*'BIWEEKLY'\s*\|\s*'MONTHLY'/,
  'Customer loan types should accept daily, weekly, biweekly, and monthly frequency values');
assert.match(loanPanel, /<SelectItem value="BIWEEKLY">Quincenal<\/SelectItem>/,
  'Loan creation should offer the biweekly cadence');
assert.match(loanPanel, /<SelectItem value="MONTHLY">Mensual<\/SelectItem>/,
  'Loan creation should offer the monthly cadence');
assert.match(loanPanel, /loan-due-date" type="date" required/,
  'Loan due date should remain required and manually entered');
assert.match(loanPanel, /BIWEEKLY:\s*'Quincenal'[\s\S]*MONTHLY:\s*'Mensual'/,
  'Saved loans should render the biweekly and monthly labels');

console.log('Customer loans in Credits contract checks passed.');
