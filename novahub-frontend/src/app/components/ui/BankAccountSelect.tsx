import { useMemo } from 'react';
import { api } from '../../services/api';
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
  disabled?: boolean;
  className?: string;
};

export function BankAccountSelect({
  value,
  onChange,
  onAccountSelect,
  label = 'Banco de destino',
  placeholder = 'Seleccionar banco',
  required = true,
  disabled = false,
  className,
}: BankAccountSelectProps) {
  const query = useAccountingQuery<any[]>(['bank-accounts', 'payment-options'], async (signal) =>
    accountingList(await api.get('/bank-accounts', { signal })),
  );
  const accounts = useMemo(() => (query.data || [])
    .filter((account) => account.isActive !== false && account.accountId)
    .sort((a, b) => `${a.bankName} ${a.accountNumber}`.localeCompare(`${b.bankName} ${b.accountNumber}`)), [query.data]);

  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return accounts.find((a) => a.id === value) || null;
  }, [value, accounts]);

  const handleChange = (newValue: string) => {
    onChange(newValue);
    if (onAccountSelect) {
      const found = accounts.find((a) => a.id === newValue) || null;
      onAccountSelect(found ? { id: found.id, bankName: found.bankName, accountNumber: found.accountNumber, currency: found.currency, cardCommissionPercent: Number(found.cardCommissionPercent || 0), cardCommissionAccountId: found.cardCommissionAccountId || undefined } : null);
    }
  };

  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}{required && ' *'}
      </p>
      <Select value={value || ''} onValueChange={handleChange} disabled={disabled || query.isLoading}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={query.isLoading ? 'Cargando bancos...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => {
            const commission = Number(account.cardCommissionPercent || 0);
            return (
              <SelectItem key={account.id} value={account.id}>
                {account.bankName} · {account.accountNumber} · {account.currency || 'NIO'}{commission > 0 ? ` · ${commission.toFixed(2)}%` : ''}
              </SelectItem>
            );
          })}
          {!query.isLoading && accounts.length === 0 && (
            <SelectItem value="__no_bank_accounts__" disabled>
              No hay cuentas bancarias activas con cuenta contable hija vinculada.
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
