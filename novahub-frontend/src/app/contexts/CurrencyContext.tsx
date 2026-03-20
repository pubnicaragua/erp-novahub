import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export type Currency = 'USD' | 'COR';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatAmount: (amount: number) => string;
  toggleCurrency: () => void;
  exchangeRate: number;
  refreshRate: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    const saved = localStorage.getItem('erp-currency');
    return (saved as Currency) || 'USD';
  });
  const [exchangeRate, setExchangeRate] = useState<number>(36.5);

  const refreshRate = async () => {
    try {
      const data = await api.get<{ rate: number }>('/tools/exchange-rate');
      if (data && data.rate) {
        setExchangeRate(data.rate);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  useEffect(() => {
    refreshRate();
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    localStorage.setItem('erp-currency', c);
  };

  const toggleCurrency = () => {
    const next = currency === 'USD' ? 'COR' : 'USD';
    setCurrency(next);
  };

  const formatAmount = (amount: number) => {
    const isCOR = currency === 'COR';
    const symbol = isCOR ? 'C$' : '$';
    const value = isCOR ? amount * exchangeRate : amount;
    return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatAmount, toggleCurrency, exchangeRate, refreshRate }}>
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
