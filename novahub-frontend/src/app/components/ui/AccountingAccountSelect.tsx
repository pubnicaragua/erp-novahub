import { useEffect, useState } from 'react';
import { accountsService } from '../../services/finanzas.service';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

type AccountingAccountSelectProps = {
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  assetOnly?: boolean;
  disabled?: boolean;
};

export function AccountingAccountSelect({
  value,
  onChange,
  label = 'Cuenta contable',
  placeholder = 'Seleccionar cuenta contable',
  required = true,
  assetOnly = false,
  disabled = false,
}: AccountingAccountSelectProps) {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    accountsService.getAll({ page: 1, pageSize: 500 }).then((response: any) => {
      const items = response?.data ?? response?.items ?? response;
      if (!active) return;
      const normalized = Array.isArray(items) ? items : [];
      setAccounts(normalized.filter((account) => {
        if (!account.isActive || account.acceptsPostings === false) return false;
        if (!assetOnly) return true;
        return String(account.type || '').toUpperCase() === 'ASSET';
      }));
    }).catch(() => { if (active) setAccounts([]); });
    return () => { active = false; };
  }, [assetOnly]);

  return (
    <div>
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}{required && ' *'}
      </p>
      <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.code} · {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
