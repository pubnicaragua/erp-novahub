export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Factura de cliente',
  PAID_INVOICE: 'Factura pagada',
  SUPPLIER_INVOICE: 'Factura de proveedor',
  PAYMENT: 'Pago recibido',
  PAYMENT_MADE: 'Pago a proveedor',
  CREDIT_NOTE: 'Nota de crédito',
  DEBIT_NOTE: 'Nota de débito',
  SALE_RETURN: 'Devolución de venta',
  PURCHASE_RECEIPT: 'Recepción de compra',
  PAYROLL: 'Devengado de nómina',
  PAYROLL_ACCRUAL: 'Devengado de nómina',
  PAYROLL_PAYMENT: 'Pago de nómina',
  EXPENSE: 'Gasto',
  FINANCIAL_INCOME: 'Ingreso financiero',
  FINANCIAL_EXPENSE: 'Gasto financiero',
  INVENTORY_ADJUSTMENT: 'Ajuste de inventario',
  CASH_REGISTER_SESSION: 'Cierre de caja',
  RECONCILIATION: 'Conciliación bancaria',
  EXCHANGE_DIFFERENCE: 'Diferencia cambiaria',
  OTHER: 'Otra operación',
};

export const REFERENCE_TYPES = Object.entries(REFERENCE_TYPE_LABELS).map(([value, label]) => ({ value, label }));

export function referenceTypeLabel(value?: string): string {
  if (!value) return '—';
  return REFERENCE_TYPE_LABELS[String(value).toUpperCase()] || 'Operación contable';
}
