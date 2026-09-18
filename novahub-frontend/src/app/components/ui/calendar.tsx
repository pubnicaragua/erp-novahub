"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "./utils";
import { Button } from "./button";

export interface CalendarProps {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  initialFocus?: boolean;
  disabled?: boolean | ((date: Date) => boolean);
  minDate?: Date | string;
  maxDate?: Date | string;
  locale?: any;
  className?: string;
}

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const MONTH_SHORT_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
];

function normalizeDate(d: Date | string | undefined): Date | undefined {
  if (!d) return undefined;
  if (d instanceof Date) {
    return isNaN(d.getTime()) ? undefined : new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const parts = d.split("T")[0].split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(y, m, day);
  }
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? undefined : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function Calendar({
  selected,
  onSelect,
  disabled,
  minDate,
  maxDate,
  className,
}: CalendarProps) {
  const [viewDate, setViewDate] = React.useState<Date>(() => selected || new Date());
  const [currentView, setCurrentView] = React.useState<"days" | "months" | "years">("days");

  const normalizedMin = React.useMemo(() => normalizeDate(minDate), [minDate]);
  const normalizedMax = React.useMemo(() => normalizeDate(maxDate), [maxDate]);

  React.useEffect(() => {
    if (selected && !isNaN(selected.getTime())) {
      setViewDate(selected);
    }
  }, [selected]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Bloque de 12 años para la vista de años
  const [yearPageStart, setYearPageStart] = React.useState<number>(() => Math.floor(year / 12) * 12);

  React.useEffect(() => {
    setYearPageStart(Math.floor(year / 12) * 12);
  }, [year]);

  const handlePrev = () => {
    if (disabled) return;
    if (currentView === "days") {
      setViewDate(new Date(year, month - 1, 1));
    } else if (currentView === "months") {
      setViewDate(new Date(year - 1, month, 1));
    } else if (currentView === "years") {
      setYearPageStart((prev) => prev - 12);
    }
  };

  const handleNext = () => {
    if (disabled) return;
    if (currentView === "days") {
      setViewDate(new Date(year, month + 1, 1));
    } else if (currentView === "months") {
      setViewDate(new Date(year + 1, month, 1));
    } else if (currentView === "years") {
      setYearPageStart((prev) => prev + 12);
    }
  };

  const checkDateDisabled = React.useCallback(
    (d: Date): { isDisabled: boolean; reason?: "before-min" | "after-max" | "custom" } => {
      if (disabled === true) return { isDisabled: true, reason: "custom" };
      if (typeof disabled === "function" && disabled(d)) return { isDisabled: true, reason: "custom" };

      const dayNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (normalizedMin && dayNorm < normalizedMin) {
        return { isDisabled: true, reason: "before-min" };
      }
      if (normalizedMax && dayNorm > normalizedMax) {
        return { isDisabled: true, reason: "after-max" };
      }

      return { isDisabled: false };
    },
    [disabled, normalizedMin, normalizedMax]
  );

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
      isDisabled: boolean;
      disabledReason?: "before-min" | "after-max" | "custom";
    }> = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i, 12, 0, 0);
      const status = checkDateDisabled(d);
      days.push({
        date: d,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: status.isDisabled,
        disabledReason: status.reason,
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
      const status = checkDateDisabled(d);
      days.push({
        date: d,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dStr === todayStr,
        isSelected: dStr === selectedStr,
        isDisabled: status.isDisabled,
        disabledReason: status.reason,
      });
    }

    // Completar el final de la cuadrícula a múltiplo de 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i, 12, 0, 0);
      const status = checkDateDisabled(d);
      days.push({
        date: d,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: false,
        isSelected: false,
        isDisabled: status.isDisabled,
        disabledReason: status.reason,
      });
    }

    return days;
  }, [year, month, selected, checkDateDisabled]);

  const handleDayClick = (item: (typeof calendarDays)[0]) => {
    if (item.isDisabled) {
      if (item.disabledReason === "before-min") {
        toast.error("No se puede filtrar a una fecha anterior a la fecha inicial");
      } else if (item.disabledReason === "after-max") {
        toast.error("No se puede filtrar a una fecha posterior a la fecha final");
      }
      return;
    }
    if (onSelect) {
      onSelect(item.date);
    }
  };

  const handleTodayClick = () => {
    const today = new Date();
    const status = checkDateDisabled(today);
    if (status.isDisabled) {
      if (status.reason === "before-min") {
        toast.error("No se puede filtrar a una fecha anterior a la fecha inicial");
      } else if (status.reason === "after-max") {
        toast.error("No se puede filtrar a una fecha posterior a la fecha final");
      }
      return;
    }
    setViewDate(today);
    setCurrentView("days");
    if (onSelect) {
      onSelect(today);
    }
  };

  const today = new Date();

  return (
    <div
      className={cn(
        "p-3 select-none w-[280px] max-w-full font-sans bg-popover text-popover-foreground",
        className
      )}
    >
      {/* Header de navegación con selector de Mes y Año interactivos */}
      <div className="flex items-center justify-between gap-1 pb-2.5 mb-1 border-b border-border/40">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handlePrev}
          disabled={disabled}
          className="size-7 h-7 w-7 p-0 rounded-md border border-border/60 hover:bg-muted/80 shrink-0"
          aria-label="Anterior"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {currentView === "days" ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentView("months")}
              className="px-2 py-1 rounded-md text-xs font-bold text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Cambiar mes"
            >
              <span>{MONTH_NAMES[month]}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentView("years")}
              className="px-2 py-1 rounded-md text-xs font-bold text-foreground hover:bg-muted/80 transition-colors flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              title="Cambiar año"
            >
              <span>{year}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </button>
          </div>
        ) : currentView === "months" ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentView("years")}
              className="px-2.5 py-1 rounded-md text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1"
              title="Cambiar año"
            >
              <span>{year}</span>
              <ChevronDown className="size-3" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentView("days")}
              className="text-[10px] text-muted-foreground hover:text-foreground underline pl-1"
            >
              Días
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-foreground">
              {yearPageStart} - {yearPageStart + 11}
            </span>
            <button
              type="button"
              onClick={() => setCurrentView("days")}
              className="text-[10px] text-muted-foreground hover:text-foreground underline pl-1"
            >
              Días
            </button>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleNext}
          disabled={disabled}
          className="size-7 h-7 w-7 p-0 rounded-md border border-border/60 hover:bg-muted/80 shrink-0"
          aria-label="Siguiente"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Vista 1: DÍAS (por defecto) */}
      {currentView === "days" && (
        <>
          {/* Días de la semana */}
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

          {/* Días del mes */}
          <div
            style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
            className="gap-1"
          >
            {calendarDays.map((item, idx) => {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleDayClick(item)}
                  style={{ borderRadius: "0.375rem" }}
                  className={cn(
                    "h-8 w-full flex items-center justify-center text-xs transition-colors font-medium cursor-pointer",
                    !item.isCurrentMonth && "text-muted-foreground/35 hover:text-muted-foreground/60",
                    item.isCurrentMonth && !item.isSelected && !item.isDisabled && "text-foreground hover:bg-muted/70",
                    item.isToday && !item.isSelected && "border border-primary/40 font-bold bg-accent/30",
                    item.isSelected &&
                      "bg-primary text-primary-foreground hover:bg-primary font-bold shadow-xs",
                    item.isDisabled &&
                      "opacity-30 cursor-not-allowed bg-muted/15 text-muted-foreground line-through hover:bg-rose-500/10 hover:text-rose-500"
                  )}
                >
                  {item.dayNumber}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Vista 2: MESES (Grid de 3x4) */}
      {currentView === "months" && (
        <div className="grid grid-cols-3 gap-2 py-2">
          {MONTH_SHORT_NAMES.map((name, idx) => {
            const isSelectedMonth = selected && selected.getFullYear() === year && selected.getMonth() === idx;
            const isCurrentMonthOfToday = today.getFullYear() === year && today.getMonth() === idx;

            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setViewDate(new Date(year, idx, 1));
                  setCurrentView("days");
                }}
                className={cn(
                  "h-10 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center",
                  isSelectedMonth
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : isCurrentMonthOfToday
                    ? "border border-primary/40 font-bold bg-accent/30 text-foreground hover:bg-muted/80"
                    : "text-foreground hover:bg-muted/80"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      {/* Vista 3: AÑOS (Grid de 3x4 de 12 años) */}
      {currentView === "years" && (
        <div className="grid grid-cols-3 gap-2 py-2">
          {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map((y) => {
            const isSelectedYear = selected && selected.getFullYear() === y;
            const isCurrentYear = today.getFullYear() === y;

            return (
              <button
                key={y}
                type="button"
                onClick={() => {
                  setViewDate(new Date(y, month, 1));
                  setCurrentView("days");
                }}
                className={cn(
                  "h-10 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center font-mono",
                  isSelectedYear
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : isCurrentYear
                    ? "border border-primary/40 font-bold bg-accent/30 text-foreground hover:bg-muted/80"
                    : "text-foreground hover:bg-muted/80"
                )}
              >
                {y}
              </button>
            );
          })}
        </div>
      )}

      {/* Footer con acceso rápido a "Hoy" */}
      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/40 text-[11px]">
        <button
          type="button"
          onClick={handleTodayClick}
          className="text-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
        >
          Hoy
        </button>

        {currentView !== "days" && (
          <button
            type="button"
            onClick={() => setCurrentView("days")}
            className="text-muted-foreground hover:text-foreground text-[10px] font-medium"
          >
            Ver calendario
          </button>
        )}
      </div>
    </div>
  );
}

