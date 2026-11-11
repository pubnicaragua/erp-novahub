export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  ACCOUNT_TRANSFER: 'Transferencia de cuenta',
  INVOICE: 'Factura de cliente',
  PAID_INVOICE: 'Factura pagada',
  PAID_INVOICE_REPAIR: 'Factura pagada',
  SUPPLIER_INVOICE: 'Factura de proveedor',
  SUPPLIER_INVOICE_PAYMENT: 'Pago de factura de proveedor',
  PAYMENT: 'Pago recibido',
  PAYMENT_MADE: 'Pago a proveedor',
  CREDIT_NOTE: 'Crédito',
  DEBIT_NOTE: 'Nota de débito',
  SALE_RETURN: 'Devolución de venta',
  PURCHASE_RECEIPT: 'Recepción de compra',
  PAYROLL: 'Devengado de nómina',
  PAYROLL_ACCRUAL: 'Devengado de nómina',
  PAYROLL_PAYMENT: 'Pago de nómina',
  EXPENSE: 'Gasto',
  FINANCIAL_INCOME: 'Ingreso financiero',
  FINANCIAL_EXPENSE: 'Gasto financiero',
  CUSTOMER_LOAN_DISBURSEMENT: 'Desembolso de préstamo',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
  TRANSFER: 'Transferencia de inventario',
  CASH_REGISTER_SESSION: 'Cierre de caja',
  CASH_REGISTER_DEPOSIT: 'Depósito a banco',
  RECONCILIATION: 'Conciliación bancaria',
  BANK_RECONCILIATION: 'Conciliación bancaria',
  FIXED_ASSET_DEPRECIATION: 'Depreciación de activo',
  FX_REVALUATION: 'Revaluación cambiaria',
  FX_REVALUATION_REVERSAL: 'Reversión cambiaria',
  EXCHANGE_DIFFERENCE: 'Diferencia cambiaria',
  OTHER: 'Otra operación',
  MANUAL: 'Asiento manual',
};

export const REFERENCE_TYPES = Object.entries(REFERENCE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function referenceTypeLabel(value?: string): string {
  if (!value) return '—';
  return REFERENCE_TYPE_LABELS[String(value).toUpperCase()] || 'Operación contable';
}

const ACCOUNTING_MODULE_ORIGIN_LABELS: Record<string, string> = {
  PAID_INVOICE: 'Ventas',
  INVOICE: 'Ventas',
  PAYMENT: 'Ventas',
  CREDIT_NOTE: 'Ventas',
  SALE_RETURN: 'Ventas',
  SUPPLIER_INVOICE: 'Compras',
  SUPPLIER_INVOICE_PAYMENT: 'Compras',
  PURCHASE_RECEIPT: 'Compras',
  PAYMENT_MADE: 'Compras',
  SUPPLIER_CREDIT: 'Compras',
  SUPPLIER_CREDIT_ISSUED: 'Compras',
  EXPENSE: 'Gastos',
  FINANCIAL_INCOME: 'Finanzas',
  FINANCIAL_EXPENSE: 'Finanzas',
  PAYROLL: 'RRHH',
  PAYROLL_ACCRUAL: 'RRHH',
  PAYROLL_PAYMENT: 'RRHH',
  INVENTORY_ADJUSTMENT: 'Inventario',
  TRANSFER: 'Inventario',
  CASH_REGISTER_SESSION: 'Caja',
  CASH_REGISTER_DEPOSIT: 'Caja',
  FIXED_ASSET_DEPRECIATION: 'Activos fijos',
  FX_REVALUATION: 'Diferencias cambiarias',
  FX_REVALUATION_REVERSAL: 'Diferencias cambiarias',
  BANK_RECONCILIATION: 'Contabilidad',
  MANUAL: 'Contabilidad',
};

export function accountingModuleOriginLabel(value?: string): string {
  if (!value) return 'Contabilidad';
  return ACCOUNTING_MODULE_ORIGIN_LABELS[String(value).toUpperCase()] || 'Contabilidad';
}

const ACCOUNTING_DESCRIPTION_LABELS: Record<string, string> = {
  ACCOUNT: 'Cuenta',
  ACCOUNT_TRANSFER: 'Transferencia de cuenta',
  CASH_REGISTER_DEPOSIT: 'Depósito de caja',
  CASH_REGISTER_SESSION: 'Cierre de caja',
  ADJUSTMENT: 'Ajuste',
  BANK: 'Banco',
  CARD: 'Tarjeta',
  CASH: 'Efectivo',
  CHECK: 'Cheque',
  CLOSING: 'Cierre',
  CREDIT: 'Crédito',
  CUSTOMER: 'Cliente',
  DEBIT: 'Débito',
  DEPOSIT: 'Depósito',
  DEPRECIATION: 'Depreciación',
  EXPENSE: 'Gasto',
  FINANCIAL_EXPENSE: 'Gasto financiero',
  FINANCIAL_INCOME: 'Ingreso financiero',
  FIXED_ASSET_DEPRECIATION: 'Depreciación de activo',
  FX_REVALUATION: 'Revaluación cambiaria',
  FX_REVALUATION_REVERSAL: 'Reversión cambiaria',
  INCOME: 'Ingreso',
  INVENTORY: 'Inventario',
  INVOICE: 'Factura',
  LOSS: 'Pérdida',
  MANUAL: 'Manual',
  MIXED: 'Mixto',
  OPENING: 'Apertura',
  PAYMENT: 'Pago',
  PAYMENT_MADE: 'Pago realizado',
  PAYMENT_RECEIVED: 'Pago recibido',
  PAYROLL: 'Nómina',
  PURCHASE_RECEIPT: 'Recepción de compra',
  PURCHASE: 'Compra',
  RECEIPT: 'Recepción',
  RECONCILIATION: 'Conciliación',
  RETURN: 'Devolución',
  REVERSAL: 'Reversión',
  SALE: 'Venta',
  SALE_RETURN: 'Devolución de venta',
  SALES_INVOICE: 'Factura de venta',
  SESSION: 'Sesión',
  SHORTAGE: 'Faltante',
  SUPPLIER: 'Proveedor',
  SUPPLIER_INVOICE: 'Factura de proveedor',
  TRANSFER: 'Transferencia',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
  INVENTORY_TRANSFER: 'Transferencia de inventario',
  CREDIT_NOTE: 'Nota de crédito',
  DEBIT_NOTE: 'Nota de débito',
  WASTE: 'Merma',
};

const ACCOUNTING_DESCRIPTION_PHRASES: Array<[RegExp, string]> = [
  [/\bopening balance\b/gi, 'Saldo inicial'],
  [/\bclosing balance\b/gi, 'Saldo final'],
  [/\binventory adjustment\b/gi, 'Ajuste de inventario'],
  [/\baccount transfer\b/gi, 'Transferencia de cuenta'],
  [/\bpayment received\b/gi, 'Pago recibido'],
  [/\bpayment made\b/gi, 'Pago realizado'],
  [/\bsupplier invoice\b/gi, 'Factura de proveedor'],
  [/\bsales invoice\b/gi, 'Factura de venta'],
  [/\bcredit note\b/gi, 'Nota de crédito'],
  [/\bdebit note\b/gi, 'Nota de débito'],
  [/\binventory transfer\b/gi, 'Transferencia de inventario'],
];

/** Traduce códigos y frases técnicas que pueden llegar en descripciones históricas. */
export function accountingDescriptionLabel(value?: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const inventoryAdjustment = raw.match(/^Ajuste(?:\s+de)?\s+Inventario\s+(#[^\s·•]+)(?:\s*[·•]\s*[A-Z][A-Z0-9_]*)?$/i);
  if (inventoryAdjustment) return `Ajuste de Inventario ${inventoryAdjustment[1]}`;
  const legacyLoanLineLabels: Record<string, string> = {
    'cuenta por cobrar del préstamo': 'Total a cobrar al cliente (principal + intereses)',
    'principal desembolsado': 'Efectivo entregado al cliente (solo principal)',
    'interés reconocido al desembolso': 'Ganancia por intereses del préstamo',
  };
  const legacyLoanLabel = legacyLoanLineLabels[raw.toLocaleLowerCase()];
  if (legacyLoanLabel) return legacyLoanLabel;
  const withPhrases = ACCOUNTING_DESCRIPTION_PHRASES.reduce(
    (description, [pattern, label]) => description.replace(pattern, label),
    raw,
  );
  return withPhrases.replace(/\b[A-Z][A-Z0-9_]*\b/g, (token) => {
    return ACCOUNTING_DESCRIPTION_LABELS[token.toUpperCase()] || token;
  });
}
