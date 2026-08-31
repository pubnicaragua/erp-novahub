import React from 'react';
import type { Currency } from '../../contexts/CurrencyContext';
import { formatExchangeRate } from '../../utils/currency';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

interface CurrencySelectorProps {
  value?: string;
  onChange: (currency: Currency) => void;
  baseCurrency?: string;
  exchangeRate?: number;
  label?: string;
  disabled?: boolean;
  className?: string;
  hideLabel?: boolean;
  rateDecimals?: number;
}

/** Selector operativo: la tasa solo se consulta desde la configuración global. */
export function CurrencySelector({
  value,
  onChange,
  baseCurrency = 'NIO',
  exchangeRate = 36.5,
  label = 'Moneda',
  disabled = false,
  className = '',
  hideLabel = false,
  rateDecimals = 2,
}: CurrencySelectorProps) {
  const selected = String(value || baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
  const base = String(baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
  const safeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 36.5;
  const rateText = selected === base
    ? `${formatExchangeRate(1, 1, rateDecimals)} · moneda base`
    : base === 'NIO'
      ? `1 USD = ${formatExchangeRate(safeRate, 36.5, rateDecimals)} NIO`
      : `1 NIO = ${formatExchangeRate(1 / safeRate, 1, rateDecimals)} USD`;

  return (
    <div className={className}>
      {!hideLabel && <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>}
      <Select
        value={selected}
        onValueChange={(nextValue) => onChange(nextValue === 'USD' ? 'USD' : 'NIO')}
      >
        <SelectTrigger size="sm" disabled={disabled} className="h-9 w-full max-w-full rounded-lg border-border bg-background px-2 text-xs font-bold uppercase">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NIO">Córdoba (NIO)</SelectItem>
          <SelectItem value="USD">Dólar (USD)</SelectItem>
        </SelectContent>
      </Select>
      {!hideLabel && <p className="mt-1 text-[10px] text-muted-foreground">Tasa global aplicada: <span className="font-bold text-foreground">{rateText}</span></p>}
    </div>
  );
}
