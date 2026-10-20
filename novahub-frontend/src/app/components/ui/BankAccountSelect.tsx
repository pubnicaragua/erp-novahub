import { useMemo } from 'react';
import { api, getApiErrorMessage } from '../../services/api';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

export type BankAccountOption = {
  id: string;
  bankName: string;
  accountNumber: string;
  currency?: string;
  cardCommissionPercent?: number;
  cardCommissionAccountId?: string;
};

type BankAccountSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  onAccountSelect?: (account: BankAccountOption | null) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  allowUnlinked?: boolean;
  disabled?: boolean;
  className?: string;
  endpoint?: string;
  currency?: string;
  valueMode?: 'id' | 'accountNumber';
  showUnavailableOptions?: boolean;
};

export function BankAccountSelect({
  value,
  onChange,
  onAccountSelect,
  label = 'Banco de destino',
  placeholder = 'Seleccionar banco',
  required = true,
  allowUnlinked = false,
  disabled = false,
  className,
  endpoint = '/bank-accounts',
  currency,
  valueMode = 'id',
  showUnavailableOptions = false,
}: BankAccountSelectProps) {
  const normalizedCurrency = String(currency || '').trim().toUpperCase() || undefined;
  const requestCurrency = showUnavailableOptions ? undefined : normalizedCurrency;
  const query = useAccountingQuery<any[]>(['bank-accounts', endpoint, 'payment-options', requestCurrency, showUnavailableOptions], async (signal) =>
    accountingList(await api.get(endpoint, { params: requestCurrency ? { currency: requestCurrency } : undefined, signal })),
  );
  const accounts = useMemo(() => (query.data || [])
    .filter((account) => account.isActive !== false && (showUnavailableOptions || allowUnlinked || account.accountId))
    .sort((a, b) => `${a.bankName} ${a.accountNumber}`.localeCompare(`${b.bankName} ${b.accountNumber}`)), [allowUnlinked, query.data, showUnavailableOptions]);
  const isCurrencyCompatible = (account: any) => !normalizedCurrency || String(account.currency || 'NIO').trim().toUpperCase() === normalizedCurrency;
  const isSelectable = (account: any) => isCurrencyCompatible(account) && (allowUnlinked || Boolean(account.accountId));
  const selectedAccountListed = accounts.some((account) => (valueMode === 'accountNumber' ? account.accountNumber : account.id) === value);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (onAccountSelect) {
      const found = accounts.find((a) => (valueMode === 'accountNumber' ? a.accountNumber : a.id) === newValue) || null;
      onAccountSelect(found ? { id: found.id, bankName: found.bankName, accountNumber: found.accountNumber, currency: found.currency, cardCommissionPercent: Number(found.cardCommissionPercent || 0), cardCommissionAccountId: found.cardCommissionAccountId || undefined } : null);
    }
  };

  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}{required && ' *'}
      </p>
      <Select value={value || ''} onValueChange={handleChange} disabled={disabled || query.isLoading}>
        <SelectTrigger aria-label={label} className="h-8 text-xs">
          <SelectValue placeholder={query.isLoading ? 'Cargando bancos...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {valueMode === 'accountNumber' && value && !selectedAccountListed && (
            <SelectItem value={value} disabled>Cuenta importada no disponible: {value}</SelectItem>
          )}
          {accounts.map((account) => {
            const commission = Number(account.cardCommissionPercent || 0);
            const reasons = [
              !isCurrencyCompatible(account) ? `Moneda incompatible con ${normalizedCurrency}` : '',
              !allowUnlinked && !account.accountId ? 'Sin cuenta contable vinculada' : '',
            ].filter(Boolean);
            return (
              <SelectItem key={account.id} value={valueMode === 'accountNumber' ? account.accountNumber : account.id} disabled={!isSelectable(account)}>
                {account.bankName} · {account.accountNumber} · {account.currency || 'NIO'}{commission > 0 ? ` · ${commission.toFixed(2)}%` : ''}{reasons.length > 0 ? ` · ${reasons.join(' · ')}` : ''}
              </SelectItem>
            );
          })}
          {!query.isLoading && !query.isError && accounts.length === 0 && (
            <SelectItem value="__no_bank_accounts__" disabled>
              {allowUnlinked
                ? normalizedCurrency ? `No hay cuentas bancarias activas en ${normalizedCurrency}.` : 'No hay cuentas bancarias activas.'
                : normalizedCurrency ? `No hay cuentas bancarias activas en ${normalizedCurrency} con cuenta contable hija vinculada.` : 'No hay cuentas bancarias activas con cuenta contable hija vinculada.'}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {showUnavailableOptions && normalizedCurrency && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Se muestran las cuentas activas de esta sucursal. Solo se pueden seleccionar las de {normalizedCurrency}{allowUnlinked ? '.' : ' con cuenta contable vinculada.'}
        </p>
      )}
      {query.isError && (
        <p className="mt-1 text-[10px] font-medium text-destructive">
          {getApiErrorMessage(query.error, 'No se pudieron cargar los bancos disponibles para el pago.')}
        </p>
      )}
    </div>
  );
}
