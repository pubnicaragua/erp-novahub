import { useState } from 'react';
import { Label } from './label';
import { cn } from './utils';

interface RequiredReasonFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  attempted?: boolean;
  placeholder?: string;
  errorMessage?: string;
  minLength?: number;
  rows?: number;
  maxLength?: number;
  disabled?: boolean;
}

export function RequiredReasonField({
  id,
  label,
  value,
  onChange,
  attempted = false,
  placeholder = 'Escribe el motivo…',
  errorMessage,
  minLength = 1,
  rows = 3,
  maxLength,
  disabled = false,
}: RequiredReasonFieldProps) {
  const [touched, setTouched] = useState(false);
  const invalidValue = value.trim().length < minLength;
  const invalid = invalidValue && (touched || attempted);
  const message = errorMessage || (minLength > 1
    ? `Indica un motivo de al menos ${minLength} caracteres.`
    : 'Indica el motivo para continuar.');

  return (
    <div className="mt-4 space-y-1.5 text-left">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label} <span className="text-destructive" aria-hidden="true">*</span>
      </Label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => setTouched(true)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        required
        aria-required="true"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        disabled={disabled}
        className={cn(
          'w-full max-w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60',
          invalid && 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/40',
        )}
      />
      {invalid && (
        <p id={`${id}-error`} role="alert" aria-live="polite" className="text-xs font-medium text-destructive">
          {message}
        </p>
      )}
    </div>
  );
}
