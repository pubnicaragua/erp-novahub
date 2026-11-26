type FinanceReceivableCandidate = {
  documentType?: unknown;
  status?: unknown;
  balance?: unknown;
  balanceDue?: unknown;
  total?: unknown;
  amountPaid?: unknown;
};

const OPEN_INVOICE_STATUSES = new Set(['PENDING', 'OVERDUE', 'PARTIAL', 'CREDIT']);
const OPEN_DIRECT_CREDIT_STATUSES = new Set(['ACTIVE', 'ISSUED', 'PARTIAL']);

export function isOutstandingFinanceReceivable(document: FinanceReceivableCandidate): boolean {
  const isDirectCredit = String(document.documentType || '').trim().toUpperCase() === 'CUSTOMER_CREDIT';
  const status = String(document.status || '').trim().toUpperCase();
  const allowedStatuses = isDirectCredit ? OPEN_DIRECT_CREDIT_STATUSES : OPEN_INVOICE_STATUSES;
  if (!allowedStatuses.has(status)) return false;

  const amount = Number(document.balance ?? document.balanceDue ?? (Number(document.total || 0) - Number(document.amountPaid || 0)));
  return Number.isFinite(amount) && amount > 0.01;
}
