import { useId } from 'react';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { formatCreditTermDate, getCreditTermDeadline, getCreditTermExtensionDays } from '../../utils/creditTerms';

interface CreditTermDateFieldProps {
  issueDate?: string | Date | null;
  creditDays?: number | null;
  savedDeadline?: string | Date | null;
  value: string;
  onChange: (value: string) => void;
  overrideConfirmed: boolean;
  onOverrideConfirmedChange: (confirmed: boolean) => void;
  label?: string;
  minDate?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export function CreditTermDateField({
  issueDate,
  creditDays,
  savedDeadline,
  value,
  onChange,
  overrideConfirmed,
  onOverrideConfirmedChange,
  label = 'Fecha de pago',
  minDate,
  disabled = false,
  readOnly = false,
}: CreditTermDateFieldProps) {
  const id = useId();
  const deadline = getCreditTermDeadline(issueDate, creditDays, savedDeadline);
  const extensionDays = getCreditTermExtensionDays(value, deadline);

  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={`${id}-date`} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <Input
        id={`${id}-date`}
        type={readOnly ? 'text' : 'date'}
        min={readOnly ? undefined : minDate}
        value={readOnly ? formatCreditTermDate(value) : value}
        disabled={disabled}
        readOnly={readOnly}
        aria-readonly={readOnly || undefined}
        onChange={(event) => {
          onOverrideConfirmedChange(false);
          onChange(event.target.value);
        }}
      />
      {deadline && (
        <p className="text-[10px] leading-4 text-muted-foreground">
          Fecha pactada según el plazo: <span className="font-bold text-foreground">{formatCreditTermDate(deadline)}</span>.
        </p>
      )}
      {extensionDays > 0 && (
        <div role="alert" className="space-y-2 rounded-xl border border-warning/30 bg-warning/[0.07] p-3 text-xs text-warning">
          <p>
            Esta fecha aplaza el pago <strong>{extensionDays} {extensionDays === 1 ? 'día' : 'días'}</strong> respecto al plazo pactado ({formatCreditTermDate(deadline!)}).
          </p>
          <label htmlFor={`${id}-confirm`} className="flex cursor-pointer items-start gap-2 font-semibold leading-5">
            <Checkbox
              id={`${id}-confirm`}
              checked={overrideConfirmed}
              disabled={disabled}
              onCheckedChange={(checked) => onOverrideConfirmedChange(checked === true)}
              className="mt-0.5"
            />
            <span>Confirmo el aplazamiento de la fecha de pago como excepción.</span>
          </label>
        </div>
      )}
    </div>
  );
}
