"use client";

import { useRef, useState } from 'react';
import type * as React from 'react';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { CalendarDays } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { es } from 'date-fns/locale';
import { toast } from '@/app/services/toast';

interface DateFieldProps {
  /** Valor en formato yyyy-mm-dd. */
  value?: string;
  defaultValue?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
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

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateField({
  value,
  defaultValue,
  onChange,
  placeholder = 'Seleccione fecha',
  className,
  align = 'start',
  disabled,
  minDate,
  maxDate,
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
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [requiredInvalid, setRequiredInvalid] = useState(false);
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || '');
  const internalButtonRef = useRef<HTMLButtonElement>(null);

  const currentValue = value === undefined ? uncontrolledValue : value;
  const selected = currentValue ? new Date(`${currentValue}T12:00:00`) : undefined;
  const display = currentValue
    ? new Date(`${currentValue}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const isInvalid = Boolean(
    (minDate && currentValue && currentValue < minDate) ||
    (maxDate && currentValue && currentValue > maxDate)
  );
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
            aria-invalid={ariaInvalid || isInvalid || isRequiredInvalid || undefined}
            aria-describedby={ariaDescribedBy}
            disabled={disabled}
            className={cn(
              'h-9 min-w-0 justify-start gap-2 px-3 text-xs font-normal transition-colors',
              clearable ? 'flex-1 w-auto' : 'w-full',
              !currentValue && 'text-muted-foreground',
              (isInvalid || isRequiredInvalid) && 'border-rose-500/70 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10',
              className,
              clearable && 'min-w-0 flex-1 w-auto'
            )}
          >
            <CalendarDays className={cn('size-4 shrink-0', isInvalid || isRequiredInvalid ? 'text-rose-500' : 'text-muted-foreground')} />
            <span className="truncate">{display || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align={align} sideOffset={4} className="w-auto p-0 max-w-[calc(100vw-32px)]">
          <Calendar
            mode="single"
            locale={es}
            selected={selected}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={(d) => {
              if (d) {
                const iso = localISO(d);
                if (minDate && iso < minDate) {
                  toast.error('La fecha no puede ser anterior a la fecha inicial.');
                  return;
                }
                if (maxDate && iso > maxDate) {
                  toast.error('La fecha no puede ser posterior a la fecha final.');
                  return;
                }
                setRequiredInvalid(false);
                if (value === undefined) setUncontrolledValue(iso);
                onChange(iso);
                setOpen(false);
              }
            }}
            initialFocus
            disabled={disabled}
          />
        </PopoverContent>
      </Popover>
      {clearable && currentValue && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          aria-label="Limpiar fecha"
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
          type="date"
          name={name}
          form={form}
          value={currentValue || ''}
          min={minDate}
          max={maxDate}
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

