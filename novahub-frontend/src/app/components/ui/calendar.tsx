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
  minDate?: string;
  maxDate?: string;
  locale?: any;
  className?: string;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

export function Calendar({
  selected,
  onSelect,
  disabled,
  minDate,
  maxDate,
  className,
}: CalendarProps) {
  const [viewMode, setViewMode] = React.useState<"days" | "months" | "years">("days");
  const [viewDate, setViewDate] = React.useState<Date>(() => selected || new Date());

  React.useEffect(() => {
    if (selected && !isNaN(selected.getTime())) {
      setViewDate(selected);
    }
  }, [selected]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const minYear = minDate ? Number(minDate.slice(0, 4)) : 1000;
  const maxYear = maxDate ? Number(maxDate.slice(0, 4)) : 9999;

  const isMonthInRange = (candidateYear: number, candidateMonth: number) => {
    if (candidateYear < minYear || candidateYear > maxYear) return false;
    const monthStart = `${candidateYear}-${String(candidateMonth + 1).padStart(2, "0")}-01`;
    const monthEndDay = new Date(candidateYear, candidateMonth + 1, 0).getDate();
    const monthEnd = `${candidateYear}-${String(candidateMonth + 1).padStart(2, "0")}-${String(monthEndDay).padStart(2, "0")}`;
    return !((minDate && monthEnd < minDate) || (maxDate && monthStart > maxDate));
  };

  const isYearInRange = (candidateYear: number) =>
    candidateYear >= minYear &&
    candidateYear <= maxYear &&
    Array.from({ length: 12 }, (_, monthIndex) => isMonthInRange(candidateYear, monthIndex)).some(Boolean);

  const decadeStart = Math.floor(year / 10) * 10;
  const yearOptions = Array.from({ length: 12 }, (_, index) => decadeStart - 1 + index);
  const hasYearInDecade = (anchorYear: number) => {
    const start = Math.floor(anchorYear / 10) * 10;
    return Array.from({ length: 12 }, (_, index) => start - 1 + index).some(isYearInRange);
  };
  const months = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("es", { month: "long" }).format(new Date(2020, index, 1))),
    []
  );

  const prevMonth = () => {
    if (disabled || !isMonthInRange(year, month - 1)) return;
    setViewDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    if (disabled || !isMonthInRange(year, month + 1)) return;
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
      {viewMode === "years" ? (
        <>
          <div className="flex items-center justify-between gap-1 pb-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setViewMode("months")}
              disabled={disabled}
              className="size-7 h-7 w-7 shrink-0 rounded-md border border-border/60 p-0 hover:bg-muted/80"
              aria-label="Volver a seleccionar mes"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setViewDate(new Date(year - 10, month, 1))}
                disabled={disabled || !hasYearInDecade(year - 10)}
                className="size-7 h-7 w-7 shrink-0 rounded-md border border-border/60 p-0 hover:bg-muted/80"
                aria-label="Década anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-16 text-center text-sm font-semibold tracking-wide text-foreground" aria-live="polite">
                {decadeStart}–{decadeStart + 9}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setViewDate(new Date(year + 10, month, 1))}
                disabled={disabled || !hasYearInDecade(year + 10)}
                className="size-7 h-7 w-7 shrink-0 rounded-md border border-border/60 p-0 hover:bg-muted/80"
                aria-label="Década siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Seleccionar año">
            {yearOptions.map((yearOption) => {
              const canSelectYear = isYearInRange(yearOption);
              const outsideDecade = yearOption < decadeStart || yearOption > decadeStart + 9;
              return (
                <button
                  key={yearOption}
                  type="button"
                  disabled={disabled || !canSelectYear}
                  aria-pressed={yearOption === year}
                  onClick={() => {
                    if (!canSelectYear) return;
                    setViewDate(new Date(yearOption, month, 1));
                    setViewMode("months");
                  }}
                  className={cn(
                    "h-9 rounded-md px-2 text-xs font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    yearOption === year && "bg-primary text-primary-foreground font-semibold hover:bg-primary",
                    outsideDecade && yearOption !== year && "text-muted-foreground",
                    (!canSelectYear || disabled) && "cursor-not-allowed opacity-40"
                  )}
                >
                  {yearOption}
                </button>
              );
            })}
          </div>
        </>
      ) : viewMode === "months" ? (
        <>
          <div className="flex items-center justify-between gap-2 pb-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setViewMode("days")}
              disabled={disabled}
              className="size-7 h-7 w-7 shrink-0 rounded-md border border-border/60 p-0 hover:bg-muted/80"
              aria-label="Volver a seleccionar día"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setViewMode("years")}
              disabled={disabled}
              className="rounded-md px-2 py-1 text-sm font-semibold tracking-wide text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Elegir año, actualmente ${year}`}
              title="Elegir año"
            >
              {year}
            </button>
            <span className="w-7 shrink-0" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Seleccionar mes">
            {months.map((monthName, monthIndex) => {
              const canSelectMonth = isMonthInRange(year, monthIndex);
              return (
                <button
                  key={monthName}
                  type="button"
                  disabled={disabled || !canSelectMonth}
                  aria-pressed={monthIndex === month}
                  onClick={() => {
                    if (!canSelectMonth) return;
                    setViewDate(new Date(year, monthIndex, 1));
                    setViewMode("days");
                  }}
                  className={cn(
                    "h-9 rounded-md px-2 text-xs capitalize font-medium transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    monthIndex === month && "bg-primary text-primary-foreground font-semibold hover:bg-primary",
                    (!canSelectMonth || disabled) && "cursor-not-allowed opacity-40"
                  )}
                >
                  {monthName}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Encabezado: permite abrir la selección directa de mes y año. */}
          <div className="flex items-center justify-between gap-1 pb-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={prevMonth}
              disabled={disabled || !isMonthInRange(year, month - 1)}
              className="size-7 h-7 w-7 shrink-0 rounded-md border border-border/60 p-0 hover:bg-muted/80"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => {
                setViewMode("months");
              }}
              disabled={disabled}
              className="rounded-md px-2 py-1 text-sm font-semibold capitalize tracking-wide text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Elegir mes y año, actualmente ${monthLabel}`}
              title="Elegir mes y año"
            >
              {monthLabel}
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={nextMonth}
              disabled={disabled || !isMonthInRange(year, month + 1)}
              className="size-7 h-7 w-7 shrink-0 rounded-md border border-border/60 p-0 hover:bg-muted/80"
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
              const dateValue = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, "0")}-${String(item.date.getDate()).padStart(2, "0")}`;
              const outsideDateRange = Boolean((minDate && dateValue < minDate) || (maxDate && dateValue > maxDate));
              const dayDisabled = Boolean(disabled || outsideDateRange);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={dayDisabled}
                  onClick={() => {
                    if (onSelect && !dayDisabled) {
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
                    dayDisabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {item.dayNumber}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
