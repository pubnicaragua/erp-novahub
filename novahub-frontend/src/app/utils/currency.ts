export type SupportedCurrency = 'NIO' | 'USD';

export const CURRENCY_METADATA: Record<SupportedCurrency, {
  code: SupportedCurrency;
  name: string;
  symbol: string;
}> = {
  NIO: { code: 'NIO', name: 'Córdoba nicaragüense', symbol: 'C$' },
  USD: { code: 'USD', name: 'Dólar estadounidense', symbol: '$' },
};

const DEFAULT_CURRENCY_DECIMAL_PLACES = 2;
let activeCurrencyDecimalPlaces = DEFAULT_CURRENCY_DECIMAL_PLACES;

function normalizeCurrencyDecimalPlaces(value: unknown): number {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 2 && parsed <= 6
    ? parsed
    : DEFAULT_CURRENCY_DECIMAL_PLACES;
}

export function getCurrencyDecimalPlaces() {
  return activeCurrencyDecimalPlaces;
}

export function getCurrencyInputStep() {
  return 10 ** -activeCurrencyDecimalPlaces;
}

export function roundCurrencyNumber(value: unknown, decimalPlaces = getCurrencyDecimalPlaces()) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;

  const digits = normalizeCurrencyDecimalPlaces(decimalPlaces);
  const factor = 10 ** digits;
  return Math.round((amount + Number.EPSILON * Math.sign(amount)) * factor) / factor;
}

export function setCurrencyDecimalPlaces(value: unknown) {
  activeCurrencyDecimalPlaces = normalizeCurrencyDecimalPlaces(value);
  return activeCurrencyDecimalPlaces;
}

export function formatCurrencyNumber(value: unknown, decimalPlaces = getCurrencyDecimalPlaces()) {
  const amount = Number(value || 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const digits = normalizeCurrencyDecimalPlaces(decimalPlaces);
  return new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safeAmount);
}

export function normalizeCurrency(value: unknown, fallback: SupportedCurrency = 'NIO'): SupportedCurrency {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'USD' || normalized === 'NIO' ? normalized : fallback;
}

export function convertCreditLimitAmount(
  amount: unknown,
  sourceCurrency: unknown,
  targetCurrency: unknown,
  baseCurrency: unknown,
  exchangeRate: unknown,
) {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) return 0;
  const base = normalizeCurrency(baseCurrency);
  const source = normalizeCurrency(sourceCurrency, base);
  const target = normalizeCurrency(targetCurrency, base);
  if (source === target) return roundCurrencyNumber(parsedAmount);

  const rawRate = Number(exchangeRate);
  const rate = Number.isFinite(rawRate) && rawRate > 0 ? rawRate : 1;
  const baseAmount = source === base
    ? parsedAmount
    : source === 'USD'
      ? parsedAmount * rate
      : parsedAmount / rate;
  const targetAmount = target === base
    ? baseAmount
    : target === 'USD'
      ? base === 'NIO' ? baseAmount / rate : baseAmount
      : base === 'USD' ? baseAmount * rate : baseAmount;
  return roundCurrencyNumber(targetAmount);
}

export function preserveCreditLimitCurrency(nextCurrency: unknown, storedCurrency: unknown): SupportedCurrency | undefined {
  if (nextCurrency === undefined || nextCurrency === null || String(nextCurrency).trim() === '') {
    return storedCurrency === undefined || storedCurrency === null || String(storedCurrency).trim() === ''
      ? undefined
      : normalizeCurrency(storedCurrency);
  }
  return normalizeCurrency(nextCurrency, normalizeCurrency(storedCurrency));
}

export function getCurrencyMetadata(value: unknown, fallback: SupportedCurrency = 'NIO') {
  return CURRENCY_METADATA[normalizeCurrency(value, fallback)];
}

export function formatCurrencyAmount(
  value: unknown,
  currency: unknown = 'NIO',
  includeCode = false,
  decimalPlaces = getCurrencyDecimalPlaces(),
) {
  const metadata = getCurrencyMetadata(currency);
  const formatted = formatCurrencyNumber(value, decimalPlaces);
  return includeCode
    ? `${metadata.symbol} ${formatted} ${metadata.code}`
    : `${metadata.symbol} ${formatted}`;
}

/**
 * Formatea una tasa de cambio para lectura humana sin reducir la precisión
 * numérica que se utiliza internamente para convertir importes.
 * `fractionDigits` se conserva por compatibilidad, pero nunca puede exceder 2.
 */
export function formatExchangeRate(value: unknown, fallback = 1, fractionDigits = 2) {
  const requestedDigits = Number(fractionDigits);
  const digits = Math.min(2, Math.max(0, Number.isFinite(requestedDigits) ? Math.trunc(requestedDigits) : 2));
  const numericValue = Number(value);
  const numericFallback = Number(fallback);
  const safeValue = Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : Number.isFinite(numericFallback) && numericFallback > 0
      ? numericFallback
      : 1;

  return safeValue.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatCurrencyDescriptor(currency: unknown) {
  const metadata = getCurrencyMetadata(currency);
  return `${metadata.symbol} · ${metadata.code} · ${metadata.name}`;
}

export interface CurrencyAmountSummary {
  currency: SupportedCurrency;
  amount: number;
  count: number;
}

/**
 * Resume importes sin mezclar monedas de origen. Esto es especialmente
 * importante para los KPI en modo Original: NIO y USD son magnitudes distintas
 * y solo deben sumarse después de una conversión explícita.
 */
export function summarizeAmountsByCurrency<T>(
  rows: T[],
  amountOf: (row: T) => unknown,
  currencyOf: (row: T) => unknown,
  fallback: SupportedCurrency = 'NIO',
): CurrencyAmountSummary[] {
  const summary = new Map<SupportedCurrency, CurrencyAmountSummary>();

  for (const row of rows) {
    const currency = normalizeCurrency(currencyOf(row), fallback);
    const amount = Number(amountOf(row));
    const current = summary.get(currency) || { currency, amount: 0, count: 0 };
    current.amount += Number.isFinite(amount) ? amount : 0;
    current.count += 1;
    summary.set(currency, current);
  }

  if (summary.size === 0) {
    return [{ currency: fallback, amount: 0, count: 0 }];
  }

  return (['NIO', 'USD'] as SupportedCurrency[])
    .filter((currency) => summary.has(currency))
    .map((currency) => summary.get(currency)!);
}
