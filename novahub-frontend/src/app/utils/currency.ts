export type SupportedCurrency = 'NIO' | 'USD';

export const CURRENCY_METADATA: Record<SupportedCurrency, {
  code: SupportedCurrency;
  name: string;
  symbol: string;
}> = {
  NIO: { code: 'NIO', name: 'Córdoba nicaragüense', symbol: 'C$' },
  USD: { code: 'USD', name: 'Dólar estadounidense', symbol: '$' },
};

export function normalizeCurrency(value: unknown, fallback: SupportedCurrency = 'NIO'): SupportedCurrency {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'USD' || normalized === 'NIO' ? normalized : fallback;
}

export function getCurrencyMetadata(value: unknown, fallback: SupportedCurrency = 'NIO') {
  return CURRENCY_METADATA[normalizeCurrency(value, fallback)];
}

export function formatCurrencyAmount(value: unknown, currency: unknown = 'NIO', includeCode = false) {
  const metadata = getCurrencyMetadata(currency);
  const amount = Number(value || 0);
  const formatted = new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
  return includeCode
    ? `${metadata.symbol} ${formatted} ${metadata.code}`
    : `${metadata.symbol} ${formatted}`;
}

export function formatCurrencyDescriptor(currency: unknown) {
  const metadata = getCurrencyMetadata(currency);
  return `${metadata.symbol} · ${metadata.code} · ${metadata.name}`;
}
