import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { safeSetItem } from '../services/safe-storage';
import { useAuth } from './AuthContext';

export type Currency = 'USD' | 'NIO';
export type ValuationMode = 'HISTORICAL' | 'CURRENT';
type MonetarySourceCurrency = string | undefined;
type DisplayCurrency = 'USD' | 'NIO';

const STORAGE_CURRENCY_KEY = 'erp-currency';
const STORAGE_CURRENCY_SWITCH_ENABLED_KEY = 'erp-currency-switch-enabled';
const STORAGE_LOCKED_DISPLAY_CURRENCY_KEY = 'erp-locked-display-currency';
const STORAGE_BASE_CURRENCY_KEY = 'erp-base-currency';
const STORAGE_VALUATION_MODE_KEY = 'erp-valuation-mode';
const STORAGE_VALUATION_LEGEND_KEY = 'erp-currency-show-valuation-legend';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  valuationMode: ValuationMode;
  setValuationMode: (mode: ValuationMode) => void;
  valuationModeLabel: string;
  valuationModeSuffix: string;
  showValuationLegend: boolean;
  setShowValuationLegend: (show: boolean) => void;
  displayCurrency: DisplayCurrency;
  baseCurrency: DisplayCurrency;
  lockedDisplayCurrency: DisplayCurrency;
  currencyInteractionEnabled: boolean;
  formatAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => string;
  formatHistoricalAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => string;
  formatCurrentAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency) => string;
  convertAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => number;
  convertCurrentAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency) => number;
  convertBetweenCurrencies: (amount: number, sourceCurrency: MonetarySourceCurrency, targetCurrency: MonetarySourceCurrency, sourceExchangeRate?: number, targetExchangeRate?: number) => number;
  toBaseAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => number;
  toCurrentBaseAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency) => number;
  formatConvertedAmount: (amount: number, sourceCurrency?: MonetarySourceCurrency, sourceExchangeRate?: number) => string;
  toggleCurrency: () => void;
  exchangeRate: number;
  refreshRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  // Un Manager global no tiene una sucursal activa. La tasa de cambio es
  // configuración de una sucursal, por lo que no debe consultarse desde el
  // contexto consolidado del grupo.
  const activeTenantId = user?.clientTenantId || user?.tenantId || '';
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = (localStorage.getItem(STORAGE_CURRENCY_KEY) || '').toUpperCase();
    if (saved === 'COR') return 'NIO';
    return saved === 'USD' ? 'USD' : 'NIO';
  });
  const [exchangeRate, setExchangeRate] = useState<number>(36.5);
  const [baseCurrency, setBaseCurrency] = useState<DisplayCurrency>(() => {
    const saved = (localStorage.getItem(STORAGE_BASE_CURRENCY_KEY) || '').toUpperCase();
    return saved === 'USD' ? 'USD' : 'NIO';
  });
  const [currencyInteractionEnabled, setCurrencyInteractionEnabled] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_CURRENCY_SWITCH_ENABLED_KEY) !== 'false';
  });
  const [lockedDisplayCurrency, setLockedDisplayCurrency] = useState<DisplayCurrency>(() => {
    const saved = (localStorage.getItem(STORAGE_LOCKED_DISPLAY_CURRENCY_KEY) || '').toUpperCase();
    return saved === 'USD' ? 'USD' : 'NIO';
  });
  const [valuationMode, setValuationModeState] = useState<ValuationMode>(() => {
    return localStorage.getItem(STORAGE_VALUATION_MODE_KEY) === 'CURRENT' ? 'CURRENT' : 'HISTORICAL';
  });
  const [showValuationLegend, setShowValuationLegendState] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_VALUATION_LEGEND_KEY) === 'true';
  });

  useEffect(() => {
    // These values are session state, not a source of truth for another
    // tenant/user. Reset the in-memory copy whenever the identity changes;
    // AuthContext clears the persisted values before the next login.
    const syncSessionCurrency = () => {
      const savedCurrency = (localStorage.getItem(STORAGE_CURRENCY_KEY) || '').toUpperCase();
      const savedBaseCurrency = (localStorage.getItem(STORAGE_BASE_CURRENCY_KEY) || '').toUpperCase();
      const savedLockedCurrency = (localStorage.getItem(STORAGE_LOCKED_DISPLAY_CURRENCY_KEY) || '').toUpperCase();
      setCurrencyState(savedCurrency === 'USD' ? 'USD' : 'NIO');
      setBaseCurrency(savedBaseCurrency === 'USD' ? 'USD' : 'NIO');
      setLockedDisplayCurrency(savedLockedCurrency === 'USD' ? 'USD' : 'NIO');
      setCurrencyInteractionEnabled(localStorage.getItem(STORAGE_CURRENCY_SWITCH_ENABLED_KEY) !== 'false');
      setValuationModeState(localStorage.getItem(STORAGE_VALUATION_MODE_KEY) === 'CURRENT' ? 'CURRENT' : 'HISTORICAL');
      setShowValuationLegendState(localStorage.getItem(STORAGE_VALUATION_LEGEND_KEY) === 'true');
      setExchangeRate(36.5);
    };
    const timer = window.setTimeout(syncSessionCurrency, 0);
    return () => window.clearTimeout(timer);
  }, [activeTenantId, user?.id, user?.userType]);

  const normalizeDisplayCurrency = (value?: string): DisplayCurrency => {
    return (value || '').toUpperCase() === 'USD' ? 'USD' : 'NIO';
  };

  const toAppCurrency = (display: DisplayCurrency): Currency => {
    return display === 'USD' ? 'USD' : 'NIO';
  };

  const refreshRate = async () => {
    if (!activeTenantId) return;

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

        const nextBaseCurrency = normalizeDisplayCurrency(data.baseCurrency);
        setBaseCurrency(nextBaseCurrency);
        safeSetItem(STORAGE_BASE_CURRENCY_KEY, nextBaseCurrency);

        const nextLockedDisplayCurrency = normalizeDisplayCurrency(data.displayCurrency || nextBaseCurrency);
        setLockedDisplayCurrency(nextLockedDisplayCurrency);
        safeSetItem(STORAGE_LOCKED_DISPLAY_CURRENCY_KEY, nextLockedDisplayCurrency);

        const allowCurrencySwitch = data.allowCurrencySwitch !== false;
        setCurrencyInteractionEnabled(allowCurrencySwitch);
        safeSetItem(STORAGE_CURRENCY_SWITCH_ENABLED_KEY, allowCurrencySwitch ? 'true' : 'false');

        // Aplicar la moneda global definida por configuración del tenant.
        const configuredCurrency = toAppCurrency(nextLockedDisplayCurrency);
        setCurrencyState(configuredCurrency);
        safeSetItem(STORAGE_CURRENCY_KEY, configuredCurrency);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !activeTenantId) return;
    Promise.resolve().then(refreshRate);
  }, [isAuthenticated, activeTenantId]);

  const setCurrency = (c: Currency) => {
    if (!currencyInteractionEnabled) return;
    setCurrencyState(c);
    safeSetItem(STORAGE_CURRENCY_KEY, c);
  };

  const toggleCurrency = () => {
    if (!currencyInteractionEnabled) return;
    const next = currency === 'USD' ? 'NIO' : 'USD';
    setCurrency(next);
  };

  const normalizeCurrency = (value?: MonetarySourceCurrency): DisplayCurrency => {
    const normalized = (value || '').toUpperCase();
    if (normalized === 'USD') return 'USD';
    if (normalized === 'NIO' || normalized === 'COR' || normalized === 'C$') return 'NIO';
    return baseCurrency;
  };

  const resolveRate = (sourceCurrency: DisplayCurrency, sourceExchangeRate?: number): number => {
    const rate = Number(sourceExchangeRate);

    // Si la moneda de origen es extranjera frente a la moneda funcional,
    // conserva la tasa histórica de la operación. Si coincide con la base,
    // la tasa guardada no debe reinterpretarse (los registros antiguos de NIO
    // podían conservar 36.5 aunque NIO fuera la moneda funcional).
    if (sourceCurrency !== baseCurrency && Number.isFinite(rate) && rate > 0) {
      return rate;
    }

    return exchangeRate > 0 ? exchangeRate : 36.5;
  };

  const displayCurrency: DisplayCurrency = currency === 'USD' ? 'USD' : 'NIO';

  const valuationModeLabel = valuationMode === 'CURRENT' ? 'Actual' : 'Histórico';
  const valuationModeSuffix = showValuationLegend ? ` · ${valuationModeLabel}` : '';

  const convertAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
    sourceExchangeRate?: number,
  ): number => {
    const parsedAmount = Number(amount);
    const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const from = normalizeCurrency(sourceCurrency);
    const to = displayCurrency;

    if (from === to) return safeAmount;

    const rate = resolveRate(from, sourceExchangeRate);
    return from === 'USD' ? safeAmount * rate : safeAmount / rate;
  };

  const convertCurrentAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
  ): number => {
    const parsedAmount = Number(amount);
    const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const from = normalizeCurrency(sourceCurrency);
    if (from === displayCurrency) return safeAmount;

    const rate = exchangeRate > 0 ? exchangeRate : 36.5;
    return from === 'USD' ? safeAmount * rate : safeAmount / rate;
  };

  const toBaseAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
    sourceExchangeRate?: number,
  ): number => {
    const parsedAmount = Number(amount);
    const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const from = normalizeCurrency(sourceCurrency);
    if (from === baseCurrency) return safeAmount;

    const rate = resolveRate(from, sourceExchangeRate);
    return from === 'USD' ? safeAmount * rate : safeAmount / rate;
  };

  const toCurrentBaseAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
  ): number => {
    const parsedAmount = Number(amount);
    const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const from = normalizeCurrency(sourceCurrency);
    if (from === baseCurrency) return safeAmount;

    const rate = exchangeRate > 0 ? exchangeRate : 36.5;
    return from === 'USD' ? safeAmount * rate : safeAmount / rate;
  };

  const convertBetweenCurrencies = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
    targetCurrency?: MonetarySourceCurrency,
    sourceExchangeRate?: number,
    targetExchangeRate?: number,
  ): number => {
    const parsedAmount = Number(amount);
    const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const source = normalizeCurrency(sourceCurrency);
    const target = normalizeCurrency(targetCurrency);
    if (source === target) return safeAmount;

    const baseAmount = toBaseAmount(safeAmount, source, sourceExchangeRate);
    if (target === baseCurrency) return baseAmount;

    const targetRate = resolveRate(target, targetExchangeRate);
    const baseRate = baseCurrency === 'USD' ? 1 / targetRate : targetRate;
    return baseRate > 0 ? baseAmount / baseRate : baseAmount;
  };

  const formatHistoricalAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
    sourceExchangeRate?: number,
  ): string => {
    const converted = convertAmount(amount, sourceCurrency, sourceExchangeRate);
    const symbol = displayCurrency === 'USD' ? '$' : 'C$';
    return `${symbol} ${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCurrentAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
  ): string => {
    const converted = convertCurrentAmount(amount, sourceCurrency);
    const symbol = displayCurrency === 'USD' ? '$' : 'C$';
    return `${symbol} ${converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatConvertedAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
    sourceExchangeRate?: number,
  ): string => valuationMode === 'CURRENT'
    ? formatCurrentAmount(amount, sourceCurrency)
    : formatHistoricalAmount(amount, sourceCurrency, sourceExchangeRate);

  const formatAmount = (
    amount: number,
    sourceCurrency?: MonetarySourceCurrency,
    sourceExchangeRate?: number,
  ) => {
    return formatConvertedAmount(amount, sourceCurrency, sourceExchangeRate);
  };

  const setValuationMode = (mode: ValuationMode) => {
    setValuationModeState(mode);
    safeSetItem(STORAGE_VALUATION_MODE_KEY, mode);
  };

  const setShowValuationLegend = (show: boolean) => {
    setShowValuationLegendState(show);
    safeSetItem(STORAGE_VALUATION_LEGEND_KEY, show ? 'true' : 'false');
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        valuationMode,
        setValuationMode,
        valuationModeLabel,
        valuationModeSuffix,
        showValuationLegend,
        setShowValuationLegend,
        displayCurrency,
        baseCurrency,
        lockedDisplayCurrency,
        currencyInteractionEnabled,
        formatAmount,
        formatHistoricalAmount,
        formatCurrentAmount,
        convertAmount,
        convertCurrentAmount,
        convertBetweenCurrencies,
        toBaseAmount,
        toCurrentBaseAmount,
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
