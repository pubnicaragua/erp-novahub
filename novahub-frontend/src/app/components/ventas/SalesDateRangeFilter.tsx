import { X } from 'lucide-react';
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
        <span className="pointer-events-none absolute -top-3 left-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desde</span>
        <Input type="date" value={dateFrom} onChange={(event) => onChange(event.target.value, dateTo)} className="h-10 w-[150px]" aria-label="Fecha desde" />
      </label>
      <label className="relative flex h-10 items-center">
        <span className="pointer-events-none absolute -top-3 left-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Hasta</span>
        <Input type="date" value={dateTo} onChange={(event) => onChange(dateFrom, event.target.value)} className="h-10 w-[150px]" aria-label="Fecha hasta" />
      </label>
      {hasFilters && (
        <button
          type="button"
          onClick={() => onChange('', '')}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-dashed border-border/60 px-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:bg-rose-500/5 hover:text-rose-500"
        >
          <X className="size-3" /> Limpiar
        </button>
      )}
    </div>
  );
}
