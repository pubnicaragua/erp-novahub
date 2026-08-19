import React from 'react';
import type { Currency } from '../../contexts/CurrencyContext';

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
  rateDecimals = 4,
}: CurrencySelectorProps) {
  const selected = String(value || baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
  const base = String(baseCurrency).toUpperCase() === 'USD' ? 'USD' : 'NIO';
  const safeRate = Number(exchangeRate) > 0 ? Number(exchangeRate) : 36.5;
  const rateText = selected === base
    ? `${(1).toFixed(rateDecimals)} · moneda base`
    : base === 'NIO'
      ? `1 USD = ${safeRate.toFixed(rateDecimals)} NIO`
      : `1 NIO = ${(1 / safeRate).toFixed(rateDecimals)} USD`;

  return (
    <div className={className}>
      {!hideLabel && <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>}
      <select
        value={selected}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === 'USD' ? 'USD' : 'NIO')}
        className="h-9 w-full max-w-full rounded-lg border border-border bg-background px-2 text-xs font-bold uppercase outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="NIO">Córdoba (NIO)</option>
        <option value="USD">Dólar (USD)</option>
      </select>
      {!hideLabel && <p className="mt-1 text-[10px] text-muted-foreground">Tasa global aplicada: <span className="font-bold text-foreground">{rateText}</span></p>}
    </div>
  );
}
