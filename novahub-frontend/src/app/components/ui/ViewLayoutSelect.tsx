import { cn } from './utils';

export type ViewLayoutMode = 'table' | 'cards';

interface ViewLayoutSelectProps {
  value: ViewLayoutMode;
  onChange: (value: ViewLayoutMode) => void;
  ariaLabel?: string;
  className?: string;
}

export function ViewLayoutSelect({
  value,
  onChange,
  ariaLabel = 'Elegir distribución',
  className,
}: ViewLayoutSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as ViewLayoutMode)}
      aria-label={ariaLabel}
      className={cn(
        'h-10 w-32 rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary',
        className,
      )}
    >
      <option value="table">Lista</option>
      <option value="cards">Tarjetas</option>
    </select>
  );
}
