"use client";

import { useRef, useState } from 'react';
import type * as React from 'react';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { CalendarDays, X } from 'lucide-react';
import { cn } from './utils';

interface MonthFieldProps {
  value?: string;
  defaultValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minMonth?: string;
  maxMonth?: string;
  id?: string;
  title?: string;
  ariaLabel?: string;
  ariaRequired?: boolean;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  name?: string;
  form?: string;
  required?: boolean;
  clearable?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>;
  onInvalid?: React.FormEventHandler<HTMLInputElement>;
}

const monthStart = (month?: string) => month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : undefined;
const monthEnd = (month?: string) => month && /^\d{4}-\d{2}$/.test(month)
  ? `${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`
  : undefined;

export function MonthField({
  value,
  defaultValue,
  onChange,
  placeholder = 'Seleccione mes',
  className,
  disabled,
  minMonth,
  maxMonth,
  id,
  title,
  ariaLabel,
  ariaRequired,
  ariaInvalid,
  ariaDescribedBy,
  name,
  form,
  required,
  clearable,
  buttonRef,
  buttonProps,
  onInvalid,
}: MonthFieldProps) {
  const [open, setOpen] = useState(false);
  const [requiredInvalid, setRequiredInvalid] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
  const internalButtonRef = useRef<HTMLButtonElement>(null);
  const currentValue = value === undefined ? uncontrolledValue : value;
  const selected = currentValue && /^\d{4}-\d{2}$/.test(currentValue)
    ? new Date(`${currentValue}-01T12:00:00`)
    : undefined;
  const display = selected && !Number.isNaN(selected.getTime())
    ? selected.toLocaleDateString('es', { month: 'long', year: 'numeric' })
    : '';
  const isRequiredInvalid = Boolean(required && requiredInvalid && !currentValue);

  return (
    <div className="relative flex min-w-0 w-full items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...buttonProps}
            ref={(node) => {
              internalButtonRef.current = node;
              if (typeof buttonRef === 'function') buttonRef(node);
              else if (buttonRef) (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
            }}
            type="button"
            variant="outline"
            id={id}
            title={title}
            aria-label={ariaLabel}
            aria-required={ariaRequired || required || undefined}
            aria-invalid={ariaInvalid || isRequiredInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={cn(
              'h-9 min-w-0 justify-start gap-2 px-3 text-xs font-normal transition-colors',
              clearable ? 'flex-1 w-auto' : 'w-full',
              !currentValue && 'text-muted-foreground',
              isRequiredInvalid && 'border-rose-500/70 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10',
              className,
              clearable && 'min-w-0 flex-1 w-auto'
            )}
          >
            <CalendarDays className={cn('size-4 shrink-0', isRequiredInvalid ? 'text-rose-500' : 'text-muted-foreground')} />
            <span className="truncate capitalize">{display || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} className="w-auto p-0 max-w-[calc(100vw-32px)]">
          <Calendar
            selectionMode="month"
            selected={selected}
            minDate={monthStart(minMonth)}
            maxDate={monthEnd(maxMonth)}
            disabled={disabled}
            onMonthSelect={(month) => {
              setRequiredInvalid(false);
              if (value === undefined) setUncontrolledValue(month);
              onChange(month);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && currentValue && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Limpiar mes"
          onClick={() => {
            setRequiredInvalid(Boolean(required));
            if (value === undefined) setUncontrolledValue('');
            onChange('');
          }}
        >
          <X className="size-4" />
        </Button>
      )}
      {(name || required) && (
        <input
          type="month"
          name={name}
          form={form}
          value={currentValue || ''}
          min={minMonth}
          max={maxMonth}
          required={required}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            setRequiredInvalid(Boolean(required));
            internalButtonRef.current?.focus();
            onInvalid?.(event);
          }}
          className="pointer-events-none absolute left-0 top-0 size-px opacity-0"
        />
      )}
    </div>
  );
}
