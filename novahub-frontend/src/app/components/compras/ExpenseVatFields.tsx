import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export type ExpenseTaxMode = 'NONE' | 'INCLUDED_15' | 'MANUAL_INCLUDED';

export const calculateIncludedVat = (total: number) =>
  Math.round((Math.max(0, total) * 15 / 115 + Number.EPSILON) * 100) / 100;

interface ExpenseVatFieldsProps {
  idPrefix: string;
  amount: number;
  taxAmount: number;
  mode: ExpenseTaxMode;
  disabled?: boolean;
  attempted?: boolean;
  onChange: (mode: ExpenseTaxMode, taxAmount: number) => void;
  onTaxAmountChange: (taxAmount: number) => void;
}

export function ExpenseVatFields({
  idPrefix,
  amount,
  taxAmount,
  mode,
  disabled = false,
  attempted = false,
  onChange,
  onTaxAmountChange,
}: ExpenseVatFieldsProps) {
  const modeId = `${idPrefix}-tax-mode`;
  const amountId = `${idPrefix}-tax-amount`;

  return (
    <div className="space-y-3 border-b border-border/50 pb-4">
      <Label htmlFor={modeId} className="text-[10px] text-muted-foreground">Tratamiento del IVA</Label>
      <Select
        value={mode}
        disabled={disabled}
        onValueChange={(value) => {
          const nextMode = value as ExpenseTaxMode;
          onChange(nextMode, nextMode === 'NONE' ? 0 : nextMode === 'INCLUDED_15' ? calculateIncludedVat(amount) : taxAmount);
        }}
      >
        <SelectTrigger id={modeId} className="h-9 w-full text-xs">
          <SelectValue placeholder="Selecciona cómo calcular el IVA" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">Sin IVA</SelectItem>
          <SelectItem value="INCLUDED_15">Con IVA 15%</SelectItem>
          <SelectItem value="MANUAL_INCLUDED">IVA con monto</SelectItem>
        </SelectContent>
      </Select>
      {mode === 'MANUAL_INCLUDED' && (
        <div className="space-y-1">
          <Label htmlFor={amountId} className="text-[10px] text-muted-foreground">Monto total del IVA</Label>
          <Input
            id={amountId}
            disabled={disabled}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={taxAmount > 0 ? taxAmount : ''}
            onChange={(event) => onTaxAmountChange(Number(event.target.value || 0))}
            aria-invalid={attempted && (taxAmount > amount || !Number.isFinite(taxAmount))}
            className="h-9 text-right text-sm"
            placeholder="0.00"
          />
          {attempted && taxAmount > amount && (
            <p role="alert" className="text-[10px] text-destructive">El IVA no puede superar el monto del gasto.</p>
          )}
        </div>
      )}
    </div>
  );
}
