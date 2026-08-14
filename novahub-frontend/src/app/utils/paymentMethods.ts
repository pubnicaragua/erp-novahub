const BANK_PAYMENT_METHODS = new Set(['CARD', 'TRANSFER']);

export function isBankPaymentMethod(method?: string | null): boolean {
  return BANK_PAYMENT_METHODS.has(String(method || '').toUpperCase());
}

/**
 * Efectivo y cheque usan la cuenta configurada en Contabilidad. Tarjeta y
 * transferencia se resuelven mediante el banco global seleccionado.
 */
export function requiresManualPaymentAccount(method?: string | null): boolean {
  const normalized = String(method || '').toUpperCase();
  return !['CASH', 'CHECK'].includes(normalized) && !isBankPaymentMethod(normalized);
}
