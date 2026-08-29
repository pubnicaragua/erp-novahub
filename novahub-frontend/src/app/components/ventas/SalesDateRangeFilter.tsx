import { CalendarDays, X } from 'lucide-react';
import { Input } from '../ui/input';

interface SalesDateRangeFilterProps {
  dateFrom?: string;
  dateTo?: string;
  onChange: (dateFrom: string, dateTo: string) => void;
}

/** Filtro de fechas compartido por las tablas transaccionales de Ventas. */
export function SalesDateRangeFilter({ dateFrom = '', dateTo = '', onChange }: SalesDateRangeFilterProps) {
  const hasFilters = Boolean(dateFrom || dateTo);

  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-3 pt-0 sm:items-center sm:gap-2" data-toolbar-role="filters">
      <label className="relative flex w-full min-w-0 flex-col gap-1 sm:h-10 sm:w-auto sm:flex-row sm:items-center sm:gap-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-foreground/75 sm:pointer-events-none sm:absolute sm:-top-3 sm:left-1">Desde</span>
        <Input type="date" value={dateFrom} onChange={(event) => onChange(event.target.value, dateTo)} className="h-10 w-full pr-10 text-foreground font-semibold [&::-webkit-calendar-picker-indicator]:opacity-0 sm:w-[170px]" aria-label="Fecha desde" />
        <CalendarDays className="pointer-events-none absolute right-3 top-[calc(50%+0.4rem)] size-4 -translate-y-1/2 text-primary sm:top-1/2" aria-hidden="true" />
      </label>
      <label className="relative flex w-full min-w-0 flex-col gap-1 sm:h-10 sm:w-auto sm:flex-row sm:items-center sm:gap-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-foreground/75 sm:pointer-events-none sm:absolute sm:-top-3 sm:left-1">Hasta</span>
        <Input type="date" value={dateTo} onChange={(event) => onChange(dateFrom, event.target.value)} className="h-10 w-full pr-10 text-foreground font-semibold [&::-webkit-calendar-picker-indicator]:opacity-0 sm:w-[170px]" aria-label="Fecha hasta" />
        <CalendarDays className="pointer-events-none absolute right-3 top-[calc(50%+0.4rem)] size-4 -translate-y-1/2 text-primary sm:top-1/2" aria-hidden="true" />
      </label>
      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/60 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/75 transition-colors hover:bg-rose-500/5 hover:text-rose-500 sm:w-auto"
        >
          <X className="size-3" /> Limpiar
        </button>
      )}
    </div>
  );
}
