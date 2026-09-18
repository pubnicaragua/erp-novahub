"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { es } from "date-fns/locale";
import { cn } from "./utils";
import { Button } from "./button";

export interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
  disabled?: boolean;
  locale?: any;
  className?: string;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

export function Calendar({
  selected,
  onSelect,
  disabled,
  className,
}: CalendarProps) {
  const [viewDate, setViewDate] = React.useState<Date>(() => selected || new Date());

  React.useEffect(() => {
    if (selected && !isNaN(selected.getTime())) {
      setViewDate(selected);
    }
  }, [selected]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const prevMonth = () => {
    if (disabled) return;
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    if (disabled) return;
    setViewDate(new Date(year, month + 1, 1));
  };

  const monthLabel = React.useMemo(() => {
    return new Intl.DateTimeFormat("es", { month: "long", year: "numeric" }).format(
      new Date(year, month, 1)
    );
  }, [year, month]);

  const calendarDays = React.useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // En español la semana empieza en Lunes (0 = Lunes, 6 = Domingo)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i, 12, 0, 0);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
      });
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const selectedStr = selected
      ? `${selected.getFullYear()}-${selected.getMonth()}-${selected.getDate()}`
      : null;

    for (let dayNum = 1; dayNum <= lastDayOfMonth.getDate(); dayNum++) {
      const d = new Date(year, month, dayNum, 12, 0, 0);
      const dStr = `${year}-${month}-${dayNum}`;
      days.push({
        date: d,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedStr,
      });
    }

    // Completar el final de la cuadrícula a múltiplo de 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i, 12, 0, 0);
      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
      });
    }

    return days;
  }, [year, month, selected]);

  return (
    <div
      className={cn(
        "p-3 select-none w-[280px] max-w-full font-sans bg-popover text-popover-foreground",
        className
      )}
    >
      {/* Header de navegación */}
      <div className="flex items-center justify-between gap-1 pb-3 relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={prevMonth}
          disabled={disabled}
          className="size-7 h-7 w-7 p-0 rounded-md border border-border/60 hover:bg-muted/80 shrink-0"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <span className="text-sm font-semibold capitalize tracking-wide text-foreground">
          {monthLabel}
        </span>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={nextMonth}
          disabled={disabled}
          className="size-7 h-7 w-7 p-0 rounded-md border border-border/60 hover:bg-muted/80 shrink-0"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Días de la semana (Grid de 7 columnas estricto) */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        className="gap-1 mb-1 text-center"
      >
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="h-8 flex items-center justify-center text-[11px] font-bold text-muted-foreground uppercase"
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Días del mes (Grid de 7 columnas estricto) */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        className="gap-1"
      >
        {calendarDays.map((item, idx) => {
          return (
            <button
              key={idx}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (onSelect) {
                  onSelect(item.date);
                }
              }}
              style={{ borderRadius: "0.375rem" }}
              className={cn(
                "h-8 w-full flex items-center justify-center text-xs transition-colors font-medium",
                !item.isCurrentMonth && "text-muted-foreground/35 hover:text-muted-foreground/60",
                item.isCurrentMonth && !item.isSelected && "text-foreground hover:bg-muted/70",
                item.isToday && !item.isSelected && "border border-primary/40 font-bold bg-accent/30",
                item.isSelected &&
                  "bg-primary text-primary-foreground hover:bg-primary font-bold shadow-xs",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {item.dayNumber}
            </button>
          );
        })}
      </div>
    </div>
  );
}
