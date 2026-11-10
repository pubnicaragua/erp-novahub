export type CurrencyDisplayModeValue = 'DEFAULT' | 'ORIGINAL' | 'USD' | 'NIO';
export type CurrencyValuationModeValue = 'CURRENT' | 'HISTORICAL';

interface ResolveDisplayCurrencyAmountOptions {
  amount: number;
  sourceCurrency?: string;
  sourceExchangeRate?: number;
  displayMode: CurrencyDisplayModeValue;
  valuationMode: CurrencyValuationModeValue;
  displayCurrency: string;
  lockedDisplayCurrency: string;
  convertBetweenCurrencies: (
    amount: number,
    sourceCurrency?: string,
    targetCurrency?: string,
    sourceExchangeRate?: number,
    targetExchangeRate?: number,
  ) => number;
  convertCurrentAmount: (amount: number, sourceCurrency?: string) => number;
}

export function resolveDisplayCurrencyAmount({
  amount,
  sourceCurrency,
  sourceExchangeRate,
  displayMode,
  valuationMode,
  displayCurrency,
  lockedDisplayCurrency,
  convertBetweenCurrencies,
  convertCurrentAmount,
}: ResolveDisplayCurrencyAmountOptions): number {
  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  if (displayMode === 'ORIGINAL') return safeAmount;

  const parsedRate = Number(sourceExchangeRate);
  const historicalRate = Number.isFinite(parsedRate) && parsedRate > 1 ? parsedRate : undefined;
  if (displayMode === 'DEFAULT') {
    return valuationMode === 'CURRENT'
      ? convertBetweenCurrencies(safeAmount, sourceCurrency, lockedDisplayCurrency)
      : convertBetweenCurrencies(safeAmount, sourceCurrency, lockedDisplayCurrency, historicalRate, historicalRate);
  }

  return valuationMode === 'CURRENT'
    ? convertCurrentAmount(safeAmount, sourceCurrency)
    : convertBetweenCurrencies(safeAmount, sourceCurrency, displayCurrency, historicalRate, historicalRate);
}
