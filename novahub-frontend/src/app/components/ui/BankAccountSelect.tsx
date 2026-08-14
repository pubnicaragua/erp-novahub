import { useMemo } from 'react';
import { api } from '../../services/api';
import { accountingList, useAccountingQuery } from '../../hooks/useAccountingQuery';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

type BankAccountSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function BankAccountSelect({
  value,
  onChange,
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

  return (
    <div className={className}>
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}{required && ' *'}
      </p>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled || query.isLoading}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={query.isLoading ? 'Cargando bancos...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.bankName} · {account.accountNumber} · {account.currency || 'NIO'}
            </SelectItem>
          ))}
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
