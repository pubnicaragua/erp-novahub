/**
 * Redondeo de dinero IDÉNTICO al del backend (Prisma.Decimal con ROUND_HALF_CEIL sobre el valor decimal visible).
 *
 * Por qué no `Math.round(x * 100) / 100`: en binario 1264.725 es 1264.72499999…, así que esa fórmula da 1264.72 mientras
 * el servidor, que trabaja con decimales exactos, guarda 1264.73. Esa diferencia deja «centavitos sueltos» entre lo que
 * se ve en pantalla y lo que queda guardado. Aquí el número se toma como el decimal más corto que lo representa, se
 * desplaza la coma con notación exponencial (sin multiplicar en coma flotante) y los empates suben (hacia +∞).
 */
export function roundDecimal(value: unknown, places = 2): number {
  const number = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
  if (!Number.isFinite(number)) return 0;
  const digits = Math.min(10, Math.max(0, Math.trunc(places)));
  if (number === 0) return 0;
  const negative = number < 0;
  const text = String(Math.abs(number));
  if (/e/i.test(text)) {
    const factor = 10 ** digits;
    return Math.round(number * factor) / factor;
  }
  const shifted = Number(`${text}e${digits}`);
  const floor = Math.floor(shifted);
  const isTie = shifted - floor === 0.5;
  // ROUND_HALF_CEIL: un empate sube hacia +∞ (en negativos, hacia cero).
  const magnitude = isTie ? (negative ? floor : floor + 1) : Math.round(shifted);
  const result = Number(`${magnitude}e-${digits}`);
  return negative ? (result === 0 ? 0 : -result) : result;
}

export type SupportedCurrency = 'NIO' | 'USD';

/**
 * Tasa de respaldo (córdobas por dólar) cuando una empresa todavía no tiene una configurada: la tasa oficial del BCN,
 * fija durante todo 2026 (deslizamiento 0 %). Es la ÚNICA constante del frontend: no escribir 36.5 ni otra a mano.
 * El backend tiene la suya (`DEFAULT_EXCHANGE_RATE` en `common/currency-math.ts`) y deben coincidir.
 */
export const DEFAULT_EXCHANGE_RATE = 36.6243;

/** Tasa global válida (mayor que cero) o la de respaldo. */
export function resolveGlobalExchangeRate(globalRate: unknown): number {
  const parsed = Number(globalRate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXCHANGE_RATE;
}

/**
 * Tasa con la que arranca un documento nuevo: 1 cuando está en la moneda base de la empresa y la tasa global cuando
 * está en la otra. Es la misma regla del selector de moneda; usarla en vez de `exchangeRate: globalRate`.
 */
export function initialDocumentExchangeRate(documentCurrency: unknown, baseCurrency: unknown, globalRate: unknown): number {
  return normalizeCurrency(documentCurrency) === normalizeCurrency(baseCurrency) ? 1 : resolveGlobalExchangeRate(globalRate);
}

/**
 * Pasa un importe de una moneda a la otra (USD ↔ NIO) con una tasa expresada en córdobas por dólar. No depende de cuál
 * sea la moneda base: solo de hacia dónde se convierte. Mismas monedas → el mismo importe.
 */
export function convertBetweenSupportedCurrencies(amount: unknown, fromCurrency: unknown, toCurrency: unknown, nioPerUsd: unknown): number {
  const parsed = Number(amount);
  const safeAmount = Number.isFinite(parsed) ? parsed : 0;
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);
  if (from === to) return roundCurrencyNumber(safeAmount);
  const rate = resolveGlobalExchangeRate(nioPerUsd);
  return roundCurrencyNumber(from === 'USD' ? safeAmount * rate : safeAmount / rate);
}

/**
 * Lleva el importe de un documento a la moneda BASE de la empresa. A diferencia de «si es USD multiplica por la tasa»,
 * respeta una base en dólares: un documento en córdobas se divide y uno en dólares queda igual.
 * La tasa del documento solo vale si es real (> 1); si el documento quedó con tasa 1 o vacía se usa la global.
 */
export function convertToBaseCurrency(
  amount: unknown,
  documentCurrency: unknown,
  documentRate: unknown,
  baseCurrency: unknown,
  globalRate: unknown,
): number {
  const base = normalizeCurrency(baseCurrency);
  const parsedRate = Number(documentRate);
  const rate = Number.isFinite(parsedRate) && parsedRate > 1 ? parsedRate : resolveGlobalExchangeRate(globalRate);
  return convertBetweenSupportedCurrencies(amount, documentCurrency, base, rate);
}

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

  return roundDecimal(amount, normalizeCurrencyDecimalPlaces(decimalPlaces));
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
 * Equivalente de un importe en la OTRA moneda (USD ↔ NIO), para las vistas previas de los formularios
 * («Base estimada», «Equivalente estimado», «≈ …»).
 *
 * Antes cada formulario dividía por `doc.exchangeRate`, pero un documento en moneda base guarda tasa 1: un gasto
 * de C$ 700 mostraba «$ 700.00» o «$ 19.11» según si el formulario se abría nuevo o después de cambiar la moneda.
 * Aquí la regla es una sola: dólares → córdobas con la tasa del documento (si es una tasa real, mayor que 1; si no, la
 * global) y córdobas → dólares siempre con la tasa global vigente.
 */
export function equivalentInOtherCurrency(
  amount: unknown,
  sourceCurrency: unknown,
  documentRate: unknown,
  globalRate: unknown,
): { amount: number; currency: SupportedCurrency } {
  const parsedAmount = Number(amount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const global = resolveGlobalExchangeRate(globalRate);
  if (normalizeCurrency(sourceCurrency) === 'USD') {
    const parsedDocument = Number(documentRate);
    const rate = Number.isFinite(parsedDocument) && parsedDocument > 1 ? parsedDocument : global;
    return { amount: roundCurrencyNumber(safeAmount * rate), currency: 'NIO' };
  }
  return { amount: roundCurrencyNumber(safeAmount / global), currency: 'USD' };
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
