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
  incomeOnly?: boolean;
  disabled?: boolean;
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Capital',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
};

export function AccountingAccountSelect({
  value,
  onChange,
  label = 'Cuenta contable',
  placeholder = 'Seleccionar cuenta contable',
  required = true,
  assetOnly = false,
  incomeOnly = false,
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
        const type = String(account.type || '').toUpperCase();
        if (assetOnly) return type === 'ASSET';
        if (incomeOnly) return type === 'INCOME';
        return true;
      }));
    }).catch(() => { if (active) setAccounts([]); });
    return () => { active = false; };
  }, [assetOnly, incomeOnly]);

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
          {accounts.map((account) => {
            const type = String(account.type || '').toUpperCase();
            const isUsable = account.isActive !== false
              && account.acceptsPostings !== false
              && account.allowManualEntry !== false;
            const statusLabel = account.isActive === false ? 'Inactiva' : 'Activa';
            const usabilityLabel = isUsable ? '' : ' · No acepta registros';

            return (
              <SelectItem key={account.id} value={account.id} disabled={!isUsable}>
                {account.code} · {account.name} · {ACCOUNT_TYPE_LABELS[type] || type || 'Sin tipo'} · {statusLabel}{usabilityLabel}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
