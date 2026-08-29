const BANK_PAYMENT_METHODS = new Set(['CARD', 'TRANSFER']);

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  CHECK: 'Cheque',
  CREDIT: 'Crédito',
  CUSTOMER_BALANCE: 'Saldo a favor',
  OTHER: 'Otro',
  MIXED: 'Pago mixto',
};

const CREDIT_HISTORY_STATUSES = new Set(['ISSUED', 'PARTIAL', 'APPLIED', 'PAID']);

/**
 * Separa la modalidad comercial de la forma en que se liquidó una factura.
 * Una factura puede haber recibido un abono directo y luego cobrarse mediante
 * un crédito, por lo que paymentMethod por sí solo no alcanza para pintarla.
 */
export function getInvoicePaymentPresentation(invoice: {
  paymentModality?: string | null;
  paymentMethod?: string | null;
  paymentMethodSummary?: string | null;
  paymentMethods?: string[];
  payments?: Array<{ method?: string | null }>;
  creditNotes?: Array<{ status?: string | null; payments?: Array<{ method?: string | null }> }>;
}) {
  const relatedCredits = invoice.creditNotes || [];
  const hasCreditHistory = String(invoice.paymentModality || '').toUpperCase() === 'CREDIT'
    || String(invoice.paymentMethod || '').toUpperCase() === 'CREDIT'
    || relatedCredits.some((credit) => CREDIT_HISTORY_STATUSES.has(String(credit.status || '').toUpperCase()));
  const collectedMethods = [
    ...(invoice.paymentMethods || []),
    ...(invoice.payments || []).map((payment) => payment.method),
    ...relatedCredits.flatMap((credit) => (credit.payments || []).map((payment) => payment.method)),
  ]
    .map((method) => String(method || '').toUpperCase())
    .filter((method) => method && method !== 'CREDIT');
  const uniqueMethods = [...new Set(collectedMethods)];
  const method = invoice.paymentMethodSummary
    ? String(invoice.paymentMethodSummary).toUpperCase()
    : uniqueMethods.length > 1
      ? 'MIXED'
      : uniqueMethods[0] || (String(invoice.paymentMethod || '').toUpperCase() !== 'CREDIT' ? String(invoice.paymentMethod || '').toUpperCase() : null);

  return {
    isCredit: hasCreditHistory,
    modalityLabel: hasCreditHistory ? 'A crédito' : 'Contado',
    method,
    methodLabel: method ? paymentMethodLabel(method) : null,
  };
}

export function paymentMethodLabel(method?: string | null): string {
  const raw = String(method || '').trim();
  if (!raw) return '—';

  return PAYMENT_METHOD_LABELS[raw.toUpperCase()] || raw;
}

/** Traduce códigos de método dentro de textos generados sin cambiar el valor persistido. */
export function translatePaymentMethodText(value: unknown): string {
  if (value === null || value === undefined) return '';

  return String(value).replace(/\b(CASH|CARD|TRANSFER|CHECK|CREDIT|CUSTOMER_BALANCE|OTHER)\b/gi, (match) =>
    PAYMENT_METHOD_LABELS[match.toUpperCase()] || match,
  );
}

export function isBankPaymentMethod(method?: string | null, _includeCheck = false): boolean {
  const normalized = String(method || '').toUpperCase();
  return BANK_PAYMENT_METHODS.has(normalized) || normalized === 'CHECK';
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
  return normalized !== 'CUSTOMER_BALANCE'
    && !['CASH', 'CHECK'].includes(normalized)
    && !isBankPaymentMethod(normalized);
}

/** Indica si el método de pago es exclusivamente tarjeta. */
export function isCardPaymentMethod(method?: string | null): boolean {
  return String(method || '').toUpperCase() === 'CARD';
}

/** Calcula el monto de comisión por tarjeta. */
export function calculateCardCommission(amount: number, commissionPercent: number): number {
  if (!commissionPercent || commissionPercent <= 0 || !amount || amount <= 0) return 0;
  return Number((amount * commissionPercent / 100).toFixed(2));
}

/** Formatea el porcentaje de comisión para mostrar. */
export function formatCommissionPercent(percent?: number | null): string {
  if (percent === null || percent === undefined) return '0.00%';
  return `${Number(percent).toFixed(2)}%`;
}
