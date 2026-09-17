export type PaymentSettlementLine = {
  method?: string | null;
  amount: number | string | null | undefined;
  currency?: string | null;
  exchangeRate?: number | string | null;
};

export type PaymentCurrencyConverter = (
  amount: number,
  sourceCurrency?: string,
  targetCurrency?: string,
  sourceExchangeRate?: number,
  targetExchangeRate?: number,
) => number;

export function getPaymentLineDocumentAmount<T extends PaymentSettlementLine>(
  line: T,
  documentCurrency: string,
  documentExchangeRate: number | string | null | undefined,
  baseCurrency: string,
  convertBetweenCurrencies: PaymentCurrencyConverter,
) {
  const sourceCurrency = String(line.currency || baseCurrency).toUpperCase();
  const targetCurrency = String(documentCurrency || baseCurrency).toUpperCase();
  const sourceRate = sourceCurrency === String(baseCurrency).toUpperCase() ? 1 : Number(line.exchangeRate || 1);
  const targetRate = targetCurrency === String(baseCurrency).toUpperCase() ? 1 : Number(documentExchangeRate || 1);
  return Number(convertBetweenCurrencies(Number(line.amount || 0), sourceCurrency, targetCurrency, sourceRate, targetRate).toFixed(2));
}

export function getPaymentLinesDocumentAmount<T extends PaymentSettlementLine>(
  lines: T[],
  documentCurrency: string,
  documentExchangeRate: number | string | null | undefined,
  baseCurrency: string,
  convertBetweenCurrencies: PaymentCurrencyConverter,
) {
  return Number(lines.reduce(
    (total, line) => total + getPaymentLineDocumentAmount(line, documentCurrency, documentExchangeRate, baseCurrency, convertBetweenCurrencies),
    0,
  ).toFixed(2));
}

export function getPaymentCurrencies<T extends PaymentSettlementLine>(lines: T[]) {
  return [...new Set(lines.map((line) => String(line.currency || '').toUpperCase()).filter(Boolean))];
}

const isCashLine = (line: PaymentSettlementLine) => String(line.method || '').toUpperCase() === 'CASH';

export function getPaymentTotalBase<T extends PaymentSettlementLine>(
  lines: T[],
  getBaseAmount: (line: T) => number,
) {
  return lines.reduce((total, line) => {
    const amount = Number(getBaseAmount(line));
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

/**
 * Treats a foreign-currency payment as a full settlement when its amount is
 * exactly the rounded amount required by the document. Without this rule a
 * value such as USD 82.33 can convert back to NIO 3,015.28 and leave a false
 * NIO 0.02 balance, even though 82.33 is the smallest payable USD amount
 * displayed to the user for the document.
 */
export function getPaymentTotalBaseForSettlement<T extends PaymentSettlementLine>(
  lines: T[],
  balanceBase: number,
  documentCurrency: string,
  baseCurrency: string,
  convertBetweenCurrencies: PaymentCurrencyConverter,
  getBaseAmount: (line: T) => number,
) {
  const normalizedBalance = Number(Math.max(0, Number(balanceBase) || 0).toFixed(2));
  const rawTotalBase = getPaymentTotalBase(lines, getBaseAmount);
  if (normalizedBalance <= 0 || rawTotalBase >= normalizedBalance - 0.005) return rawTotalBase;

  const normalizedDocumentCurrency = String(documentCurrency || baseCurrency).toUpperCase();
  const normalizedBaseCurrency = String(baseCurrency || '').toUpperCase();
  const currencies = [...new Set(lines.map((line) => String(line.currency || normalizedDocumentCurrency).toUpperCase()))];
  if (currencies.length !== 1 || currencies[0] === normalizedDocumentCurrency) return rawTotalBase;

  const paymentCurrency = currencies[0];
  const firstLine = lines[0];
  const paymentRate = paymentCurrency === normalizedBaseCurrency ? 1 : Number(firstLine?.exchangeRate || 1);
  if (!Number.isFinite(paymentRate) || paymentRate <= 0) return rawTotalBase;

  const enteredAmount = Number(lines.reduce((total, line) => total + Number(line.amount || 0), 0).toFixed(2));
  const requiredAmount = Number(convertBetweenCurrencies(
    normalizedBalance,
    normalizedBaseCurrency,
    paymentCurrency,
    1,
    paymentRate,
  ).toFixed(2));

  return enteredAmount + 0.0001 >= requiredAmount ? normalizedBalance : rawTotalBase;
}

export function getPaymentCashBase<T extends PaymentSettlementLine>(
  lines: T[],
  getBaseAmount: (line: T) => number,
) {
  return getPaymentTotalBase(lines.filter(isCashLine), getBaseAmount);
}

export function getPaymentChangeBase<T extends PaymentSettlementLine>(
  lines: T[],
  balanceBase: number,
  getBaseAmount: (line: T) => number,
) {
  return Math.max(0, getPaymentTotalBase(lines, getBaseAmount) - Math.max(0, Number(balanceBase) || 0));
}

/**
 * Applies non-cash lines first and cash lines last, regardless of their visual
 * order. This guarantees that any excess is taken from cash and can therefore
 * be returned as change without changing the order shown to the cashier.
 */
export function allocatePaymentLinesToBalance<T extends PaymentSettlementLine>(
  lines: T[],
  balanceBase: number,
  getBaseAmount: (line: T) => number,
  fromBaseAmount: (baseAmount: number, line: T) => number | string,
) {
  let remainingBase = Math.max(0, Number(balanceBase) || 0);
  const appliedByIndex = new Array<number>(lines.length).fill(0);
  const allocationOrder = lines
    .map((line, index) => ({ index, cash: isCashLine(line) }))
    .sort((left, right) => Number(left.cash) - Number(right.cash) || left.index - right.index);

  for (const { index } of allocationOrder) {
    if (remainingBase <= 0.005) break;
    const requestedBase = Number(getBaseAmount(lines[index]));
    if (!Number.isFinite(requestedBase) || requestedBase <= 0) continue;
    const appliedBase = Math.min(requestedBase, remainingBase);
    appliedByIndex[index] = appliedBase;
    remainingBase = Math.max(0, remainingBase - appliedBase);
  }

  return lines.flatMap((line, index) => {
    const appliedBase = appliedByIndex[index];
    if (appliedBase <= 0.005) return [];
    return [{ ...line, amount: fromBaseAmount(appliedBase, line) } as T];
  });
}

export function cashCoversPaymentChange<T extends PaymentSettlementLine>(
  lines: T[],
  balanceBase: number,
  getBaseAmount: (line: T) => number,
  tolerance = 0.01,
) {
  const changeBase = getPaymentChangeBase(lines, balanceBase, getBaseAmount);
  return getPaymentCashBase(lines, getBaseAmount) + tolerance >= changeBase;
}
