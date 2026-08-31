export type PaymentSettlementLine = {
  method?: string | null;
  amount: number | string | null | undefined;
};

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
