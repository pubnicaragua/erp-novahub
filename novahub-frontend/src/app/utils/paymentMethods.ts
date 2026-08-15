const BANK_PAYMENT_METHODS = new Set(['CARD', 'TRANSFER']);

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CREDIT: 'Crédito',
  OTHER: 'Otro',
};

export function paymentMethodLabel(method?: string | null): string {
  const raw = String(method || '').trim();
  if (!raw) return '—';

  return PAYMENT_METHOD_LABELS[raw.toUpperCase()] || raw;
}

/** Traduce códigos de método dentro de textos generados sin cambiar el valor persistido. */
export function translatePaymentMethodText(value: unknown): string {
  if (value === null || value === undefined) return '';

  return String(value).replace(/\b(CASH|CARD|TRANSFER|CHECK|CREDIT|OTHER)\b/gi, (match) =>
    PAYMENT_METHOD_LABELS[match.toUpperCase()] || match,
  );
}

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
