import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export type ExpenseTaxMode = 'NONE' | 'INCLUDED_15' | 'ADDED_15' | 'MANUAL_ADDED';

const roundExpenseMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

export const calculateIncludedVat = (total: number) =>
  roundExpenseMoney(Math.max(0, total) * 15 / 115);

export const calculateAddedVat = (baseAmount: number) =>
  roundExpenseMoney(Math.max(0, baseAmount) * 0.15);

export function resolveExpenseTaxMode(total: number, taxAmount: number, storedMode?: string): ExpenseTaxMode {
  const mode = String(storedMode || '').toUpperCase();
  if (mode === 'NONE' || mode === 'INCLUDED_15' || mode === 'ADDED_15' || mode === 'MANUAL_ADDED') return mode;
  // Los registros anteriores guardaban el total con el IVA manual incluido.
  // Se abren como base + IVA manual, conservando el mismo total al guardar.
  if (mode === 'MANUAL_INCLUDED') return 'MANUAL_ADDED';
  if (taxAmount <= 0) return 'NONE';
  return Math.abs(taxAmount - calculateIncludedVat(total)) < 0.01 ? 'INCLUDED_15' : 'MANUAL_ADDED';
}

export function getExpenseTaxBreakdown(amount: number, taxAmount: number, mode: ExpenseTaxMode) {
  const enteredAmount = roundExpenseMoney(Math.max(0, Number(amount) || 0));
  if (mode === 'INCLUDED_15') {
    const tax = calculateIncludedVat(enteredAmount);
    return { baseAmount: roundExpenseMoney(enteredAmount - tax), taxAmount: tax, totalAmount: enteredAmount };
  }
  if (mode === 'ADDED_15') {
    const tax = calculateAddedVat(enteredAmount);
    return { baseAmount: enteredAmount, taxAmount: tax, totalAmount: roundExpenseMoney(enteredAmount + tax) };
  }
  if (mode === 'MANUAL_ADDED') {
    const tax = roundExpenseMoney(Math.max(0, Number(taxAmount) || 0));
    return { baseAmount: enteredAmount, taxAmount: tax, totalAmount: roundExpenseMoney(enteredAmount + tax) };
  }
  return { baseAmount: enteredAmount, taxAmount: 0, totalAmount: enteredAmount };
}

export function getExpenseEntryAmount(totalAmount: number, taxAmount: number, mode: ExpenseTaxMode) {
  if (mode === 'ADDED_15' || mode === 'MANUAL_ADDED') {
    return roundExpenseMoney(Math.max(0, Number(totalAmount || 0) - Number(taxAmount || 0)));
  }
  return Number(totalAmount || 0);
}

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
          onChange(nextMode, nextMode === 'NONE'
            ? 0
            : nextMode === 'INCLUDED_15'
              ? calculateIncludedVat(amount)
              : nextMode === 'ADDED_15'
                ? calculateAddedVat(amount)
                : taxAmount);
        }}
      >
        <SelectTrigger id={modeId} className="h-9 w-full text-xs">
          <SelectValue placeholder="Selecciona cómo calcular el IVA" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NONE">Sin IVA</SelectItem>
          <SelectItem value="INCLUDED_15">Ya incluye IVA (extraer 15%)</SelectItem>
          <SelectItem value="ADDED_15">Agregar IVA 15%</SelectItem>
          <SelectItem value="MANUAL_ADDED">IVA con monto</SelectItem>
        </SelectContent>
      </Select>
      {mode === 'MANUAL_ADDED' && (
        <div className="space-y-1">
          <Label htmlFor={amountId} className="text-[10px] text-muted-foreground">Monto del IVA que se agregará</Label>
          <Input
            id={amountId}
            disabled={disabled}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={taxAmount > 0 ? taxAmount : ''}
            onChange={(event) => onTaxAmountChange(Number(event.target.value || 0))}
            aria-invalid={attempted && (taxAmount < 0 || !Number.isFinite(taxAmount))}
            className="h-9 text-right text-sm"
            placeholder="0.00"
          />
          {attempted && (taxAmount < 0 || !Number.isFinite(taxAmount)) && (
            <p role="alert" className="text-[10px] text-destructive">Ingresa un monto de IVA válido e igual o mayor que cero.</p>
          )}
        </div>
      )}
    </div>
  );
}
