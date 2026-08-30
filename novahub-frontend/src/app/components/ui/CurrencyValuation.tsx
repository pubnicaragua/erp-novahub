import { Clock3, TrendingUp } from 'lucide-react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { cn } from './utils';

interface CurrencyValuationAmountProps {
  amount: number;
  sourceCurrency?: string;
  sourceExchangeRate?: number;
  className?: string;
  showDifference?: boolean;
  showMode?: boolean;
  showRate?: boolean;
}

const normalizeCurrency = (value: string | undefined) => {
  const currency = String(value || '').toUpperCase();
  if (currency === 'USD') return 'USD';
  if (currency === 'NIO' || currency === 'COR' || currency === 'C$') return 'NIO';
  return currency;
};

/**
 * Importe de lectura que conserva la trazabilidad de la tasa de la operación.
 * No escribe ni recalcula el documento; solo presenta histórico/actual y su delta.
 */
export function CurrencyValuationAmount({
  amount,
  sourceCurrency,
  sourceExchangeRate,
  className,
  showDifference = true,
  showMode,
  showRate = false,
}: CurrencyValuationAmountProps) {
  const {
    baseCurrency,
    displayCurrency,
    valuationMode,
    valuationModeLabel,
    showValuationLegend,
    convertAmount,
    convertCurrentAmount,
    formatConvertedAmount,
    formatSelectedAmount,
    displayMode,
    displayModeLabel,
    exchangeRate,
  } = useCurrency();

  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const normalizedSource = normalizeCurrency(sourceCurrency || baseCurrency);
  const historicalValue = convertAmount(safeAmount, sourceCurrency, sourceExchangeRate);
  const currentValue = convertCurrentAmount(safeAmount, sourceCurrency);
  const difference = currentValue - historicalValue;
  const hasRevaluationDifference = normalizedSource !== baseCurrency
    && normalizedSource !== displayCurrency
    && displayMode !== 'ORIGINAL'
    && Math.abs(difference) >= 0.005;
  const shouldShowLegend = showMode ?? showValuationLegend;
  const rateValue = Number(sourceExchangeRate);
  const hasHistoricalRate = Number.isFinite(rateValue) && rateValue > 0;

  return (
    <span className={cn('inline-flex min-w-0 flex-col tabular-nums', className)}>
      <span className="font-inherit">
        {formatConvertedAmount(safeAmount, sourceCurrency, sourceExchangeRate)}
      </span>
      {showRate && (
        <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-semibold text-muted-foreground">
          <Clock3 className="size-3 shrink-0" />
          Tasa histórica: {hasHistoricalRate ? rateValue.toFixed(4) : `${exchangeRate.toFixed(4)} (vigente)`}
        </span>
      )}
      {shouldShowLegend && (
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {`${displayModeLabel} · ${valuationModeLabel}`}
          {showDifference && valuationMode === 'CURRENT' && hasRevaluationDifference && (
            <span className={cn('ml-1', difference > 0 ? 'text-orange-500' : 'text-emerald-500')}>
              · Δ {formatSelectedAmount(difference, displayCurrency)}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

interface CurrencyValuationBannerProps {
  className?: string;
  compact?: boolean;
}

export function CurrencyValuationBanner({ className, compact = false }: CurrencyValuationBannerProps) {
  const { displayCurrency, baseCurrency, exchangeRate, valuationMode, valuationModeLabel, displayMode, displayModeLabel, showValuationLegend } = useCurrency();
  const isCurrent = valuationMode === 'CURRENT';

  if (!showValuationLegend) return null;

  return (
    <div className={cn(
      'flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold',
      isCurrent
        ? 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300'
        : 'border-primary/15 bg-primary/5 text-primary',
      className,
    )} role="status" aria-label={`Vista ${valuationModeLabel}`}>
      {isCurrent ? <TrendingUp className="size-3.5 shrink-0" /> : <Clock3 className="size-3.5 shrink-0" />}
      <span className="shrink-0 uppercase tracking-wider">{valuationModeLabel}</span>
      <span className="min-w-0 truncate font-medium text-muted-foreground">
        {compact
          ? `${displayModeLabel}${displayMode === 'ORIGINAL' ? '' : ` · ${displayCurrency}`} · tasa ${exchangeRate.toFixed(4)}`
          : isCurrent
            ? `${displayMode === 'ORIGINAL' ? 'Moneda original' : `Importes en ${displayCurrency}`} con tasa vigente ${exchangeRate.toFixed(4)}; no modifica documentos.`
            : `${displayMode === 'ORIGINAL' ? 'Moneda original' : `Importes en ${displayCurrency}`} · base ${baseCurrency}.`}
      </span>
    </div>
  );
}

interface CurrencyRateDetailsProps {
  sourceCurrency?: string;
  sourceExchangeRate?: number;
  className?: string;
}

/** Metadato reutilizable para paneles: hace visible la tasa capturada sin mutar la transacción. */
export function CurrencyRateDetails({ sourceCurrency, sourceExchangeRate, className }: CurrencyRateDetailsProps) {
  const { baseCurrency, exchangeRate } = useCurrency();
  const normalizedSource = normalizeCurrency(sourceCurrency || baseCurrency);
  const parsedRate = Number(sourceExchangeRate);
  const hasHistoricalRate = Number.isFinite(parsedRate) && parsedRate > 0;

  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider">
        <Clock3 className="size-3 shrink-0" />
        {hasHistoricalRate ? 'Tasa histórica' : 'Tasa de referencia'}
      </span>
      <span className="font-mono tabular-nums">
        {hasHistoricalRate ? parsedRate.toFixed(4) : `${exchangeRate.toFixed(4)} vigente`}
      </span>
      <span>· origen {normalizedSource} · base {baseCurrency}</span>
    </div>
  );
}

interface CurrencyDisplayAmountProps {
  amount: number;
  sourceCurrency?: string;
  sourceExchangeRate?: number;
  /** Valor ya convertido por una consulta consolidada para la moneda seleccionada. */
  selectedAmount?: number | null;
  selectedCurrency?: string;
  className?: string;
  showRate?: boolean;
}

/**
 * Puente para agregados consolidados: conserva la moneda configurada
 * internamente; en Original conserva la moneda de la operación; al elegir
 * una moneda consume el total ya convertido sin volver a convertirlo.
 */
export function CurrencyDisplayAmount({
  amount,
  sourceCurrency,
  sourceExchangeRate,
  selectedAmount,
  selectedCurrency,
  className,
  showRate = false,
}: CurrencyDisplayAmountProps) {
  const { displayMode, formatConvertedAmount } = useCurrency();
  const value = displayMode === 'DEFAULT' || displayMode === 'ORIGINAL' || selectedAmount == null
    ? formatConvertedAmount(amount, sourceCurrency, sourceExchangeRate)
    : formatConvertedAmount(selectedAmount, selectedCurrency || displayMode, sourceExchangeRate);

  return (
    <span className={cn('inline-flex min-w-0 flex-col tabular-nums', className)}>
      <span>{value}</span>
      {showRate && <CurrencyRateDetails sourceCurrency={sourceCurrency} sourceExchangeRate={sourceExchangeRate} />}
    </span>
  );
}
