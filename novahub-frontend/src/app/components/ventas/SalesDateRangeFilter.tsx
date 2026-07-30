import { Filter, X } from 'lucide-react';
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
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        <Filter className="size-3.5" /> Filtros
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Desde</span>
        <Input type="date" value={dateFrom} onChange={(event) => onChange(event.target.value, dateTo)} className="h-9 w-[150px]" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Hasta</span>
        <Input type="date" value={dateTo} onChange={(event) => onChange(dateFrom, event.target.value)} className="h-9 w-[150px]" />
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
