import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export type Currency = 'USD' | 'NIO';
type MonetarySourceCurrency = string | undefined;
type DisplayCurrency = 'USD' | 'NIO';

const STORAGE_CURRENCY_KEY = 'erp-currency';
const STORAGE_CURRENCY_SWITCH_ENABLED_KEY = 'erp-currency-switch-enabled';
const STORAGE_LOCKED_DISPLAY_CURRENCY_KEY = 'erp-locked-display-currency';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  displayCurrency: DisplayCurrency;
  lockedDisplayCurrency: DisplayCurrency;
  currencyInteractionEnabled: boolean;
  formatAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => string;
  convertAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => number;
  formatConvertedAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => string;
  toggleCurrency: () => void;
  exchangeRate: number;
  refreshRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = (localStorage.getItem(STORAGE_CURRENCY_KEY) || '').toUpperCase();
    if (saved === 'COR') return 'NIO';
    return saved === 'USD' ? 'USD' : 'NIO';
  });
  const [exchangeRate, setExchangeRate] = useState<number>(36.5);
  const [currencyInteractionEnabled, setCurrencyInteractionEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_CURRENCY_SWITCH_ENABLED_KEY) !== 'false';
  });
  const [lockedDisplayCurrency, setLockedDisplayCurrency] = useState<DisplayCurrency>(() => {
    const saved = (localStorage.getItem(STORAGE_LOCKED_DISPLAY_CURRENCY_KEY) || '').toUpperCase();
    return saved === 'USD' ? 'USD' : 'NIO';
  });

  const normalizeDisplayCurrency = (value?: string): DisplayCurrency => {
    return (value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO';
  };

  const toAppCurrency = (display: DisplayCurrency): Currency => {
    return display === 'USD' ? 'USD' : 'NIO';
  };

  const refreshRate = async () => {
    try {
      const data = await api.get<{
        rate: number;
        displayCurrency?: DisplayCurrency;
        baseCurrency?: DisplayCurrency;
        allowCurrencySwitch?: boolean;
      }>('/tools/exchange-rate');

      if (data) {
        if (typeof data.rate === 'number' && Number.isFinite(data.rate) && data.rate > 0) {
          setExchangeRate(data.rate);
        }

        const nextLockedDisplayCurrency = normalizeDisplayCurrency(data.displayCurrency || data.baseCurrency);
        setLockedDisplayCurrency(nextLockedDisplayCurrency);
        localStorage.setItem(STORAGE_LOCKED_DISPLAY_CURRENCY_KEY, nextLockedDisplayCurrency);

        const allowCurrencySwitch = data.allowCurrencySwitch !== false;
        setCurrencyInteractionEnabled(allowCurrencySwitch);
        localStorage.setItem(STORAGE_CURRENCY_SWITCH_ENABLED_KEY, allowCurrencySwitch ? 'true' : 'false');

        // Aplicar la moneda global definida por configuración del tenant.
        const configuredCurrency = toAppCurrency(nextLockedDisplayCurrency);
        setCurrencyState(configuredCurrency);
        localStorage.setItem(STORAGE_CURRENCY_KEY, configuredCurrency);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  useEffect(() => {
    refreshRate();
  }, []);

  const setCurrency = (c: Currency) => {
    if (!currencyInteractionEnabled) return;
    setCurrencyState(c);
    localStorage.setItem(STORAGE_CURRENCY_KEY, c);
  };

  const toggleCurrency = () => {
    if (!currencyInteractionEnabled) return;
    const next = currency === 'USD' ? 'NIO' : 'USD';
    setCurrency(next);
  };

  const normalizeCurrency = (value?: MonetarySourceCurrency): DisplayCurrency => {
    const normalized = (value || '').toUpperCase();
    if (normalized === 'USD') return 'USD';
    return 'NIO';
  };

  const resolveRate = (sourceExchangeRate?: number): number => {
    const rate = Number(sourceExchangeRate);
    if (Number.isFinite(rate) && rate > 0) return rate;
    return exchangeRate > 0 ? exchangeRate : 36.5;
  };

  const displayCurrency: DisplayCurrency = currency === 'USD' ? 'USD' : 'NIO';

  const convertAmount = (
    amount: number,
    sourceCurrency: MonetarySourceCurrency = 'USD',
    sourceExchangeRate?: number,
  ): number => {
    const safeAmount = Number(amount || 0);
    const from = normalizeCurrency(sourceCurrency);
    const to = displayCurrency;

    if (from === to) return safeAmount;

    const rate = resolveRate(sourceExchangeRate);
    return from === 'USD' ? safeAmount * rate : safeAmount / rate;
  };

  const formatConvertedAmount = (
    amount: number,
    sourceCurrency: MonetarySourceCurrency = 'USD',
    sourceExchangeRate?: number,
  ): string => {
    const converted = convertAmount(amount, sourceCurrency, sourceExchangeRate);
    const symbol = displayCurrency === 'USD' ? '$' : 'C$';
    return `${symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatAmount = (
    amount: number,
    sourceCurrency: MonetarySourceCurrency = 'USD',
    sourceExchangeRate?: number,
  ) => {
    return formatConvertedAmount(amount, sourceCurrency, sourceExchangeRate);
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        displayCurrency,
        lockedDisplayCurrency,
        currencyInteractionEnabled,
        formatAmount,
        convertAmount,
        formatConvertedAmount,
        toggleCurrency,
        exchangeRate,
        refreshRate,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
