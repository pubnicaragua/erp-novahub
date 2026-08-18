const BANK_PAYMENT_METHODS = new Set(['CARD', 'TRANSFER']);

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CREDIT: 'Crédito',
  OTHER: 'Otro',
  MIXED: 'Pago mixto',
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

export function isBankPaymentMethod(method?: string | null, includeCheck = false): boolean {
  const normalized = String(method || '').toUpperCase();
  return BANK_PAYMENT_METHODS.has(normalized) || (includeCheck && normalized === 'CHECK');
}

export function requiresPaymentReference(method?: string | null): boolean {
  return ['TRANSFER', 'CARD', 'CHECK'].includes(String(method || '').toUpperCase());
}

/**
 * Efectivo usa la cuenta configurada en Contabilidad. Tarjeta, transferencia
 * y, en ventas/compras/RR. HH., cheque se resuelven mediante el banco global.
 */
export function requiresManualPaymentAccount(method?: string | null): boolean {
  const normalized = String(method || '').toUpperCase();
  return !['CASH', 'CHECK'].includes(normalized) && !isBankPaymentMethod(normalized);
}
