export type CustomerBalanceState = 'FAVOR' | 'DEBT' | 'CLEAR';

type CustomerBalanceRecord = {
  balance?: unknown;
  balanceDue?: unknown;
  balanceFavor?: unknown;
  availableCredit?: unknown;
  creditLimit?: unknown;
};

const BALANCE_TOLERANCE = 0.005;

export const normalizeCustomerBalance = (value: unknown): number => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || Math.abs(amount) <= BALANCE_TOLERANCE) return 0;
  return amount;
};

export const getCustomerBalanceState = (value: unknown): CustomerBalanceState => {
  const amount = normalizeCustomerBalance(value);
  if (amount > 0) return 'FAVOR';
  if (amount < 0) return 'DEBT';
  return 'CLEAR';
};

export const getCustomerBalancePresentation = (value: unknown) => {
  const state = getCustomerBalanceState(value);

  if (state === 'FAVOR') {
    return {
      state,
      label: 'Saldo a favor',
      detail: 'Disponible para aplicar',
      amountClassName: 'text-emerald-600 dark:text-emerald-400',
      softClassName: 'border-emerald-500/20 bg-emerald-500/10',
    };
  }

  if (state === 'DEBT') {
    return {
      state,
      label: 'Saldo en contra',
      detail: 'Pendiente por cobrar',
      amountClassName: 'text-rose-600 dark:text-rose-400',
      softClassName: 'border-rose-500/20 bg-rose-500/10',
    };
  }

  return {
    state,
    label: 'Saldo al día',
    detail: 'Sin saldo pendiente',
    amountClassName: 'text-muted-foreground',
    softClassName: 'border-border/50 bg-muted/10',
  };
};

export const formatCustomerBalance = (
  value: unknown,
  formatAmount: (amount: number) => string,
): string => {
  const amount = normalizeCustomerBalance(value);
  const formatted = formatAmount(Math.abs(amount));
  if (amount > 0) return `+${formatted}`;
  if (amount < 0) return `-${formatted}`;
  return formatted;
};

export const getCustomerDebt = (value: unknown): number => Math.max(0, -normalizeCustomerBalance(value));
export const getCustomerFavor = (value: unknown): number => Math.max(0, normalizeCustomerBalance(value));

/**
 * `balance` es el saldo neto histórico. Para cobros se deben usar estos
 * importes separados, porque una deuda y un saldo a favor pueden coexistir.
 */
export const getCustomerDebtAmount = (customer?: CustomerBalanceRecord | null): number => {
  const explicit = Number(customer?.balanceDue);
  return Number.isFinite(explicit) ? Math.max(0, explicit) : getCustomerDebt(customer?.balance);
};

export const getCustomerFavorAmount = (customer?: CustomerBalanceRecord | null): number => {
  const explicit = Number(customer?.balanceFavor);
  return Number.isFinite(explicit) ? Math.max(0, explicit) : getCustomerFavor(customer?.balance);
};

export const getCustomerAvailableCreditAmount = (customer?: CustomerBalanceRecord | null): number => {
  const explicit = Number(customer?.availableCredit);
  if (Number.isFinite(explicit)) return Math.max(0, explicit);
  return Math.max(0, Number(customer?.creditLimit || 0) - getCustomerDebtAmount(customer));
};

/**
 * El saldo a favor solo puede cubrir lo que todavía falta del documento,
 * descontando los demás medios de pago que ya están capturados.
 */
export const getMaximumCustomerFavorToApply = (
  favorBase: number,
  documentBalanceBase: number,
  otherPaymentsBase: number,
): number => Number(Math.max(
  0,
  Math.min(
    Math.max(0, Number(favorBase) || 0),
    Math.max(0, (Number(documentBalanceBase) || 0) - (Number(otherPaymentsBase) || 0)),
  ),
).toFixed(2));
