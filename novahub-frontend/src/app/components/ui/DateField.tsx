"use client";

import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { CalendarDays } from 'lucide-react';
import { cn } from './utils';
import { es } from 'date-fns/locale';

interface DateFieldProps {
  /** Valor en formato yyyy-mm-dd. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
  id?: string;
  title?: string;
}

const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function DateField({ value, onChange, placeholder = 'Seleccione fecha', className, align = 'start', disabled, id, title }: DateFieldProps) {
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  const display = value
    ? new Date(`${value}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          title={title}
          disabled={disabled}
          className={cn('h-9 w-full justify-start gap-2 px-3 text-xs font-normal', !value && 'text-muted-foreground', className)}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{display || placeholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} sideOffset={4} className="w-auto p-0">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          onSelect={(d) => {
            if (d) onChange(localISO(d));
          }}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
