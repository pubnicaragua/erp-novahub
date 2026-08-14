const BANK_PAYMENT_METHODS = new Set(['CARD', 'TRANSFER']);

export function isBankPaymentMethod(method?: string | null): boolean {
  return BANK_PAYMENT_METHODS.has(String(method || '').toUpperCase());
}

/**
 * Efectivo usa la cuenta configurada en Contabilidad. Solo otros medios
 * manuales (por ejemplo cheque u otro) requieren seleccionar una cuenta.
 */
export function requiresManualPaymentAccount(method?: string | null): boolean {
  const normalized = String(method || '').toUpperCase();
  return normalized !== 'CASH' && !isBankPaymentMethod(normalized);
}
