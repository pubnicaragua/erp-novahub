import type { ComponentProps } from 'react';
import { Input } from './input';
import { Label } from './label';
import { isNicaraguanRucValid, NICARAGUAN_RUC_ERROR, NICARAGUAN_RUC_REQUIRED_ERROR, normalizeNicaraguanRuc } from '../../utils/nicaraguan-ruc';

type Props = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'required'> & {
  value: string | null | undefined;
  onChange: (value: string) => void;
  required?: boolean;
  label?: string;
  labelClassName?: string;
  showError?: boolean;
};

export function NicaraguanRucInput({
  id,
  value,
  onChange,
  required = false,
  label = 'RUC',
  labelClassName,
  showError = true,
  className,
  ...inputProps
}: Props) {
  const normalized = normalizeNicaraguanRuc(value);
  const error = showError
    ? required && !normalized
      ? NICARAGUAN_RUC_REQUIRED_ERROR
      : normalized && !isNicaraguanRucValid(normalized)
        ? NICARAGUAN_RUC_ERROR
        : ''
    : '';
  const describedBy = [inputProps['aria-describedby'], error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;

  return <div className="min-w-0 space-y-1.5">
    <Label htmlFor={id} className={labelClassName || 'text-[10px] font-black uppercase tracking-widest text-muted-foreground'}>
      {label} {required && <span className="text-destructive" aria-hidden="true">*</span>}
    </Label>
    <Input
      {...inputProps}
      id={id}
      type="text"
      required={required}
      value={normalized}
      onChange={(event) => onChange(normalizeNicaraguanRuc(event.target.value))}
      onPaste={(event) => {
        inputProps.onPaste?.(event);
        if (event.defaultPrevented) return;
        const input = event.currentTarget;
        const pasted = event.clipboardData.getData('text');
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const prefix = input.value.slice(0, start) + pasted;
        const next = normalizeNicaraguanRuc(prefix + input.value.slice(end)).slice(0, 14);
        event.preventDefault();
        onChange(next);
        const caret = Math.min(next.length, normalizeNicaraguanRuc(prefix).length);
        window.requestAnimationFrame(() => input.setSelectionRange(caret, caret));
      }}
      placeholder="J0310000007669"
      maxLength={14}
      aria-invalid={Boolean(error)}
      aria-describedby={describedBy}
      className={className || 'h-11 rounded-xl'}
    />
    {error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
  </div>;
}
