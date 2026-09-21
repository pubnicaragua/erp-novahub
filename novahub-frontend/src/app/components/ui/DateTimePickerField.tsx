"use client";

import { useState } from 'react';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { CalendarDays, Clock, X } from 'lucide-react';
import { cn } from './utils';
import { es } from 'date-fns/locale';
import { format, parseISO, isValid } from 'date-fns';
import { toast } from 'sonner';

interface DateTimePickerFieldProps {
  /** Valor en formato ISO o YYYY-MM-DDTHH:mm. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  id?: string;
}

const HOURS_12 = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function DateTimePickerField({
  value,
  onChange,
  placeholder = 'Seleccione fecha y hora',
  className,
  align = 'start',
  disabled,
  minDate,
  maxDate,
  id,
}: DateTimePickerFieldProps) {
  const [open, setOpen] = useState(false);

  // Parse current value
  let initialDate: Date | undefined = undefined;
  let initialHour = '09';
  let initialMinute = '00';
  let initialPeriod: 'AM' | 'PM' = 'AM';

  if (value) {
    try {
      const parsed = typeof value === 'string' ? parseISO(value) : new Date(value);
      if (isValid(parsed)) {
        initialDate = parsed;
        const h24 = parsed.getHours();
        initialPeriod = h24 >= 12 ? 'PM' : 'AM';
        const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
        initialHour = String(h12).padStart(2, '0');
        initialMinute = String(parsed.getMinutes()).padStart(2, '0');
      }
    } catch {
      // fallback
    }
  }

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate || new Date());
  const [selectedHour, setSelectedHour] = useState<string>(initialHour);
  const [selectedMinute, setSelectedMinute] = useState<string>(initialMinute);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(initialPeriod);
  const [mobileTab, setMobileTab] = useState<'date' | 'time'>('date');

  const checkLimitViolation = (isoStr: string): 'before-min' | 'after-max' | null => {
    if (minDate && isoStr < minDate) return 'before-min';
    if (maxDate && isoStr > maxDate) return 'after-max';
    return null;
  };

  const applySelection = (d: Date | undefined, h: string, m: string, p: 'AM' | 'PM') => {
    if (!d) return;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    let hourNum = parseInt(h, 10);
    if (p === 'PM' && hourNum < 12) hourNum += 12;
    if (p === 'AM' && hourNum === 12) hourNum = 0;

    const formattedHour = String(hourNum).padStart(2, '0');
    const formattedMinute = String(parseInt(m, 10) || 0).padStart(2, '0');

    const isoString = `${year}-${month}-${day}T${formattedHour}:${formattedMinute}`;
    const violation = checkLimitViolation(isoString);
    if (violation === 'before-min') {
      toast.error('La fecha y hora de finalización no puede ser anterior al inicio');
      return;
    }
    if (violation === 'after-max') {
      toast.error('La fecha y hora no puede ser posterior a la fecha límite');
      return;
    }

    onChange(isoString);
  };

  const handleDateSelect = (d: Date | undefined) => {
    if (!d) return;
    setSelectedDate(d);
    applySelection(d, selectedHour, selectedMinute, selectedPeriod);
  };

  const handleHourSelect = (h: string) => {
    setSelectedHour(h);
    applySelection(selectedDate, h, selectedMinute, selectedPeriod);
  };

  const handleMinuteSelect = (m: string) => {
    setSelectedMinute(m);
    applySelection(selectedDate, selectedHour, m, selectedPeriod);
  };

  const handlePeriodSelect = (p: 'AM' | 'PM') => {
    setSelectedPeriod(p);
    applySelection(selectedDate, selectedHour, selectedMinute, p);
  };

  const handleQuickNow = () => {
    const now = new Date();
    const h24 = now.getHours();
    const p = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const hStr = String(h12).padStart(2, '0');
    const mStr = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0');
    const isoNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${h24 < 10 ? '0' + h24 : h24}:${mStr}`;
    const violation = checkLimitViolation(isoNow);
    if (violation) {
      toast.error(violation === 'before-min' ? 'No puede ser anterior a la fecha inicial' : 'No puede ser posterior a la fecha final');
      return;
    }
    setSelectedDate(now);
    setSelectedHour(hStr);
    setSelectedMinute(mStr);
    setSelectedPeriod(p);
    applySelection(now, hStr, mStr, p);
  };

  const handleQuickTomorrow = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isoTom = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T09:00`;
    const violation = checkLimitViolation(isoTom);
    if (violation) {
      toast.error(violation === 'before-min' ? 'No puede ser anterior a la fecha inicial' : 'No puede ser posterior a la fecha final');
      return;
    }
    setSelectedDate(tomorrow);
    setSelectedHour('09');
    setSelectedMinute('00');
    setSelectedPeriod('AM');
    applySelection(tomorrow, '09', '00', 'AM');
  };

  const isInvalid = Boolean((minDate && value && value < minDate) || (maxDate && value && value > maxDate));

  // Display text formatted cleanly
  let displayValue = '';
  if (value) {
    try {
      const parsed = parseISO(value);
      if (isValid(parsed)) {
        displayValue = format(parsed, "EEE, d 'de' MMM yyyy · hh:mm a", { locale: es });
      }
    } catch {
      displayValue = value;
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          id={id}
          disabled={disabled}
          className={cn(
            'h-11 w-full justify-start gap-2.5 rounded-xl border border-input bg-background px-3.5 text-xs font-medium transition-all hover:bg-muted/40 hover:border-primary/50 text-left',
            !value && 'text-muted-foreground',
            isInvalid && 'border-rose-500/70 text-rose-500 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500',
            className
          )}
        >
          <CalendarDays className={cn('size-4 shrink-0', isInvalid ? 'text-rose-500' : value ? 'text-primary' : 'text-muted-foreground')} />
          <span className="flex-1 truncate capitalize">
            {displayValue || placeholder}
          </span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="rounded-full p-1 text-muted-foreground/60 hover:bg-muted hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
            >
              <X className="size-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[calc(100vw-2rem)] sm:w-auto p-0 rounded-2xl border-border/60 bg-popover shadow-2xl backdrop-blur-md max-h-[85vh] overflow-y-auto overscroll-contain"
      >
        {/* En móvil: Selector de pestaña Fecha / Hora para no apilar verticalmente y desbordar la pantalla */}
        <div className="flex sm:hidden border-b border-border/40 p-1.5 bg-muted/30">
          <button
            type="button"
            onClick={() => setMobileTab('date')}
            className={cn(
              'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
              mobileTab === 'date'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground'
            )}
          >
            <CalendarDays className="size-3.5" />
            Fecha
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('time')}
            className={cn(
              'flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5',
              mobileTab === 'time'
                ? 'bg-background text-foreground shadow-xs'
                : 'text-muted-foreground'
            )}
          >
            <Clock className="size-3.5" />
            Hora ({selectedHour}:{selectedMinute} {selectedPeriod})
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:divide-x divide-border/50">
          {/* Lado izquierdo: Calendario mensual */}
          <div className={cn('p-2.5 sm:p-3 flex flex-col items-center sm:items-stretch', mobileTab !== 'date' && 'hidden sm:flex')}>
            <Calendar
              mode="single"
              locale={es}
              selected={selectedDate}
              onSelect={handleDateSelect}
              minDate={minDate}
              maxDate={maxDate}
              className="rounded-xl w-full max-w-[280px]"
            />

            {/* Accesos rápidos */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2 px-1 w-full max-w-[280px]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleQuickNow}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Ahora
                </button>
                <button
                  type="button"
                  onClick={handleQuickTomorrow}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Mañana 9am
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMobileTab('time')}
                  className="sm:hidden rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted/80 flex items-center gap-1"
                >
                  Hora →
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  Listo
                </button>
              </div>
            </div>
          </div>

          {/* Lado derecho: Selector de Hora, Minuto y Período */}
          <div className={cn('flex flex-col p-3 sm:p-3.5 bg-muted/15 sm:w-[320px]', mobileTab !== 'time' && 'hidden sm:flex')}>
            {/* Header del selector horario */}
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/40">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Clock className="size-3.5 text-primary" />
                Hora del evento
              </span>
              <span className="text-xs font-mono font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">
                {selectedHour}:{selectedMinute} {selectedPeriod}
              </span>
            </div>

            {/* Selector de Período AM / PM */}
            <div className="grid grid-cols-2 gap-1 mb-3 bg-muted/60 p-1 rounded-xl border border-border/40">
              {(['AM', 'PM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodSelect(p)}
                  className={cn(
                    'py-1.5 text-xs font-black rounded-lg transition-all',
                    selectedPeriod === p
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Grids directos sin necesidad de scroll interno */}
            <div className="grid grid-cols-2 gap-3 flex-1">
              {/* Horas (3 columnas x 4 filas = 12 horas 100% visibles) */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 text-center">
                  Hora
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {HOURS_12.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourSelect(h)}
                      className={cn(
                        'h-8.5 py-1 text-center rounded-lg text-xs font-bold transition-all flex items-center justify-center',
                        selectedHour === h
                          ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                          : 'bg-background hover:bg-muted text-foreground/85 border border-border/40'
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              {/* Minutos (3 columnas x 4 filas = 12 intervalos 100% visibles) */}
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 text-center">
                  Minutos
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteSelect(m)}
                      className={cn(
                        'h-8.5 py-1 text-center rounded-lg text-xs font-bold transition-all flex items-center justify-center',
                        selectedMinute === m
                          ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary'
                          : 'bg-background hover:bg-muted text-foreground/85 border border-border/40'
                      )}
                    >
                      :{m}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Acciones de cierre / confirmación */}
            <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileTab('date')}
                className="sm:hidden flex-1 rounded-xl border border-border/60 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted"
              >
                ← Volver a fecha
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

