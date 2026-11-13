import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  type CustomerCreditFrequency,
  type CustomerCreditManualInstallmentDraft,
  type CustomerCreditPlanCalculationMode,
  type CustomerCreditPlanEstimate,
} from '../../utils/customerCreditInstallmentPlan';
import { CustomerCreditInstallmentSchedule } from './CustomerCreditInstallmentSchedule';

interface CustomerCreditPlanEditorProps {
  idPrefix: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  calculationMode: CustomerCreditPlanCalculationMode;
  onCalculationModeChange: (mode: CustomerCreditPlanCalculationMode) => void;
  frequency: CustomerCreditFrequency;
  onFrequencyChange: (frequency: CustomerCreditFrequency) => void;
  firstInstallmentDate: string;
  onFirstInstallmentDateChange: (date: string) => void;
  installmentAmount: string;
  onInstallmentAmountChange: (amount: string) => void;
  estimate: CustomerCreditPlanEstimate | null;
  currency: string;
  formatAmount: (amount: number) => string;
  manualInstallments: CustomerCreditManualInstallmentDraft[];
  onManualInstallmentChange: (index: number, field: keyof CustomerCreditManualInstallmentDraft, value: string) => void;
  onAddManualInstallment: () => void;
  onRemoveManualInstallment: (index: number) => void;
  manualInterestEditable?: boolean;
  description?: string;
  onPrint?: () => void;
}

export function CustomerCreditPlanEditor({
  idPrefix,
  enabled,
  onEnabledChange,
  calculationMode,
  onCalculationModeChange,
  frequency,
  onFrequencyChange,
  firstInstallmentDate,
  onFirstInstallmentDateChange,
  installmentAmount,
  onInstallmentAmountChange,
  estimate,
  currency,
  formatAmount,
  manualInstallments,
  onManualInstallmentChange,
  onAddManualInstallment,
  onRemoveManualInstallment,
  manualInterestEditable = true,
  description,
  onPrint,
}: CustomerCreditPlanEditorProps) {
  const minDate = new Date().toISOString().split('T')[0];

  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-border/50 p-3 sm:p-4" aria-label="Configuración del plan de abonos">
      <div className={`grid min-w-0 gap-3 border-b border-border/40 pb-3 ${enabled ? 'sm:grid-cols-[minmax(0,1fr)_minmax(210px,260px)] sm:items-center' : ''}`}>
        <div className="flex min-w-0 items-start gap-2">
          <input
            id={`${idPrefix}-plan-enabled`}
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <div className="min-w-0">
            <Label htmlFor={`${idPrefix}-plan-enabled`} className="cursor-pointer text-xs font-semibold">Definir un plan de abonos</Label>
            {enabled && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{calculationMode === 'MANUAL' ? 'Define la fecha y el monto total de cada abono.' : 'Elige cómo calcular las cuotas del crédito.'}</p>}
          </div>
        </div>
        {enabled && <div className="min-w-0 space-y-1.5">
          <Label htmlFor={`${idPrefix}-plan-mode`} className="text-xs font-semibold">Método de cálculo</Label>
          <Select value={calculationMode} onValueChange={(value) => onCalculationModeChange(value as CustomerCreditPlanCalculationMode)}>
            <SelectTrigger id={`${idPrefix}-plan-mode`} className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="AMOUNT">Monto por abono</SelectItem>
              <SelectItem value="DEADLINE">Fecha de vencimiento</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>}
      </div>
      {description && <p className="text-[10px] leading-relaxed text-muted-foreground">{description}</p>}

      {enabled && <>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {calculationMode !== 'MANUAL' && <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${idPrefix}-frequency`} className="text-xs font-semibold">Frecuencia</Label>
            <Select value={frequency} onValueChange={(value) => onFrequencyChange(value as CustomerCreditFrequency)}>
              <SelectTrigger id={`${idPrefix}-frequency`} className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Diaria</SelectItem>
                <SelectItem value="WEEKLY">Semanal</SelectItem>
                <SelectItem value="BIWEEKLY">Cada 15 días</SelectItem>
                <SelectItem value="MONTHLY">Mensual</SelectItem>
              </SelectContent>
            </Select>
          </div>}
          {calculationMode !== 'MANUAL' && <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${idPrefix}-first-installment`} className="text-xs font-semibold">Fecha del primer abono</Label>
            <Input id={`${idPrefix}-first-installment`} type="date" min={minDate} value={firstInstallmentDate} onChange={(event) => onFirstInstallmentDateChange(event.target.value)} className="max-w-full" />
          </div>}
          {calculationMode === 'AMOUNT' && <div className="min-w-0 space-y-1.5">
            <Label htmlFor={`${idPrefix}-installment-amount`} className="text-xs font-semibold">Monto por abono</Label>
            <Input id={`${idPrefix}-installment-amount`} type="number" min="0.01" step="0.01" value={installmentAmount} onChange={(event) => onInstallmentAmountChange(event.target.value)} currencyPrecision className="max-w-full" />
          </div>}
        </div>

        {estimate && <div className="min-w-0">
          <CustomerCreditInstallmentSchedule
            installments={estimate.schedule}
            currency={currency}
            formatAmount={formatAmount}
            principalAmount={estimate.principalAmount}
            interestAmount={estimate.interestAmount}
            totalAmount={estimate.totalAmount}
            installmentAmount={estimate.installmentAmount}
            finalDueDate={estimate.finalDueDate}
            frequencyLabel={calculationMode === 'MANUAL' ? undefined : ({ DAILY: 'Diaria', WEEKLY: 'Semanal', BIWEEKLY: 'Cada 15 días', MONTHLY: 'Mensual' } as const)[frequency]}
            manualInstallments={calculationMode === 'MANUAL' ? manualInstallments : undefined}
            manualValidation={calculationMode === 'MANUAL' ? estimate : undefined}
            onManualInstallmentChange={calculationMode === 'MANUAL' ? onManualInstallmentChange : undefined}
            onAddManualInstallment={calculationMode === 'MANUAL' ? onAddManualInstallment : undefined}
            onRemoveManualInstallment={calculationMode === 'MANUAL' ? onRemoveManualInstallment : undefined}
            manualInterestEditable={manualInterestEditable}
            onPrint={onPrint}
          />
        </div>}
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {calculationMode === 'MANUAL'
            ? `Define cada fecha y monto en ${currency}. La suma de los abonos debe coincidir con el total del crédito.`
            : 'El monto y la frecuencia estiman el vencimiento final; si indicas la fecha final, se calcula el monto aproximado por abono.'}
        </p>
      </>}
    </section>
  );
}
