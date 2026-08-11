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
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex h-10 items-center">
        <span className="pointer-events-none absolute -top-3 left-1 text-[9px] font-black uppercase tracking-widest text-foreground/75">Desde</span>
        <Input type="date" value={dateFrom} onChange={(event) => onChange(event.target.value, dateTo)} className="h-10 w-[170px] pr-10 text-foreground font-semibold [&::-webkit-calendar-picker-indicator]:opacity-0" aria-label="Fecha desde" />
        <CalendarDays className="pointer-events-none absolute right-3 size-4 text-primary" aria-hidden="true" />
      </label>
      <label className="relative flex h-10 items-center">
        <span className="pointer-events-none absolute -top-3 left-1 text-[9px] font-black uppercase tracking-widest text-foreground/75">Hasta</span>
        <Input type="date" value={dateTo} onChange={(event) => onChange(dateFrom, event.target.value)} className="h-10 w-[170px] pr-10 text-foreground font-semibold [&::-webkit-calendar-picker-indicator]:opacity-0" aria-label="Fecha hasta" />
        <CalendarDays className="pointer-events-none absolute right-3 size-4 text-primary" aria-hidden="true" />
      </label>
      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-border/60 px-4 text-[10px] font-black uppercase tracking-widest text-foreground/75 transition-all hover:bg-rose-500/5 hover:text-rose-500"
        >
          <X className="size-3" /> Limpiar
        </button>
      )}
    </div>
  );
}
