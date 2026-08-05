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
}: CurrencyValuationAmountProps) {
  const {
    baseCurrency,
    displayCurrency,
    valuationMode,
    valuationModeLabel,
    showValuationLegend,
    formatHistoricalAmount,
    formatCurrentAmount,
    convertAmount,
    convertCurrentAmount,
  } = useCurrency();

  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  const normalizedSource = normalizeCurrency(sourceCurrency || baseCurrency);
  const historicalValue = convertAmount(safeAmount, sourceCurrency, sourceExchangeRate);
  const currentValue = convertCurrentAmount(safeAmount, sourceCurrency);
  const difference = currentValue - historicalValue;
  const hasRevaluationDifference = normalizedSource !== baseCurrency
    && normalizedSource !== displayCurrency
    && Math.abs(difference) >= 0.005;
  const shouldShowLegend = showMode ?? showValuationLegend;

  return (
    <span className={cn('inline-flex min-w-0 flex-col tabular-nums', className)}>
      <span className="font-inherit">
        {valuationMode === 'CURRENT'
          ? formatCurrentAmount(safeAmount, sourceCurrency)
          : formatHistoricalAmount(safeAmount, sourceCurrency, sourceExchangeRate)}
      </span>
      {shouldShowLegend && (
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
          {valuationModeLabel}
          {showDifference && valuationMode === 'CURRENT' && hasRevaluationDifference && (
            <span className={cn('ml-1', difference > 0 ? 'text-orange-500' : 'text-emerald-500')}>
              · Δ {formatCurrentAmount(difference, displayCurrency)}
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
  const { displayCurrency, baseCurrency, exchangeRate, valuationMode, valuationModeLabel, showValuationLegend } = useCurrency();
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
          ? `${displayCurrency} · tasa ${exchangeRate.toFixed(4)}`
          : isCurrent
            ? `Saldos en ${displayCurrency} con tasa vigente ${exchangeRate.toFixed(4)}; no modifica documentos.`
            : `Importes con la tasa guardada en cada operación · ${displayCurrency} · base ${baseCurrency}.`}
      </span>
    </div>
  );
}
