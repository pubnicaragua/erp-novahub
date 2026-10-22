export function shouldSubmitExistingDraftBeforePayment(
  invoiceId: string | null | undefined,
  originalStatus: string | null | undefined,
): boolean {
  return Boolean(String(invoiceId || '').trim())
    && String(originalStatus || '').toUpperCase() === 'DRAFT';
}

export function canShowInvoiceSubmitAction(
  status: string | null | undefined,
  canSubmit: boolean,
): boolean {
  return Boolean(canSubmit) && String(status || '').toUpperCase() === 'DRAFT';
}

export function getInvoicePaymentBalance(
  invoice: { status?: string | null; total?: number | null; amountPaid?: number | null; balance?: number | null },
  currentBalance?: number,
): number {
  if (String(invoice.status || '').toUpperCase() === 'DRAFT') {
    const total = Number(invoice.total || 0);
    const amountPaid = Number(invoice.amountPaid || 0);
    return Number.isFinite(total) && Number.isFinite(amountPaid)
      ? Math.max(0, Number((total - amountPaid).toFixed(2)))
      : 0;
  }
  const balance = Number(currentBalance ?? invoice.balance ?? 0);
  return Number.isFinite(balance) ? Math.max(0, balance) : 0;
}
