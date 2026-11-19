"use client";

import { useState } from 'react';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { CalendarDays } from 'lucide-react';
import { cn } from './utils';
import { es } from 'date-fns/locale';
import { toast } from '@/app/services/toast';

interface DateFieldProps {
  /** Valor en formato yyyy-mm-dd. */
  value?: string;
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
}

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateField({
  value,
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
}: DateFieldProps) {
  const [open, setOpen] = useState(false);

  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const display = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const isInvalid = Boolean(
    (minDate && value && value < minDate) ||
    (maxDate && value && value > maxDate)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          title={title}
          aria-label={ariaLabel}
          aria-required={ariaRequired || undefined}
          aria-invalid={ariaInvalid || isInvalid || undefined}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-start gap-2 px-3 text-xs font-normal transition-colors',
            !value && 'text-muted-foreground',
            isInvalid && 'border-rose-500/70 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10',
            className
          )}
        >
          <CalendarDays className={cn('size-4 shrink-0', isInvalid ? 'text-rose-500' : 'text-muted-foreground')} />
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
              onChange(iso);
              setOpen(false);
            }
          }}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

