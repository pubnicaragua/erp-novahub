import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CostCenterSelect } from '../contabilidad/CostCenterSelect';
import type { LineIncomeAccount } from '../../hooks/useSalesLineIncome';

const DEFAULT = '__default__';

/** Cuenta de ingreso y centro de costo de una línea de factura (solo si la empresa lo activó). */
export function InvoiceLineIncomeFields({
  incomeAccountId, costCenterId, options, disabled, onChange,
}: {
  incomeAccountId?: string | null; costCenterId?: string | null; options: LineIncomeAccount[]; disabled?: boolean
  onChange: (patch: { incomeAccountId?: string; costCenterId?: string }) => void
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-item-role="line-income">
      <div className="min-w-0 space-y-1">
        <span className="text-[10px] font-bold uppercase text-muted-foreground">Cuenta de ingreso</span>
        <Select value={incomeAccountId || DEFAULT} disabled={disabled} onValueChange={(value) => onChange({ incomeAccountId: value === DEFAULT ? '' : value })}>
          <SelectTrigger className="h-8 rounded-md text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>Cuenta predeterminada de Ventas</SelectItem>
            {options.map((account) => <SelectItem key={account.id} value={account.id} className="text-xs">{account.code} · {account.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 space-y-1">
        <span className="text-[10px] font-bold uppercase text-muted-foreground">Centro de costo (área)</span>
        <CostCenterSelect value={costCenterId} onChange={(id) => onChange({ costCenterId: id })} className="h-8 rounded-md text-xs" />
      </div>
    </div>
  );
}
