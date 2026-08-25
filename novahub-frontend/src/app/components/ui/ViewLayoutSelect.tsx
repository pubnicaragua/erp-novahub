import { useEffect, useState } from 'react';
import { cn } from './utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export type ViewLayoutMode = 'table' | 'cards' | 'kanban';
export const TABLE_LAYOUT_BREAKPOINT = 1280;

function readCompactTableViewport() {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(`(max-width: ${TABLE_LAYOUT_BREAKPOINT - 1}px)`).matches;
}

/** Shared breakpoint used by every list/card surface in the ERP. */
export function useCardsOnlyBelowTableBreakpoint() {
  const [isCompact, setIsCompact] = useState(readCompactTableViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(`(max-width: ${TABLE_LAYOUT_BREAKPOINT - 1}px)`);
    const handleChange = () => setIsCompact(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isCompact;
}

interface ViewLayoutSelectProps {
  value: ViewLayoutMode;
  onChange: (value: ViewLayoutMode) => void;
  ariaLabel?: string;
  className?: string;
  dataTour?: string;
}

export function ViewLayoutSelect({
  value,
  onChange,
  ariaLabel = 'Elegir distribución',
  className,
  dataTour,
}: ViewLayoutSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as ViewLayoutMode)}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        data-tour={dataTour}
        data-toolbar-role="layout"
        className={cn(
          'erp-filter-select erp-view-layout-select inline-flex h-10 min-w-[5.25rem] max-w-full rounded-xl border border-border/50 bg-background/50 px-3 text-[10px] font-black uppercase tracking-widest outline-none focus:border-primary',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="table">Lista</SelectItem>
        <SelectItem value="cards">Tarjetas</SelectItem>
        <SelectItem value="kanban">Kanban</SelectItem>
      </SelectContent>
    </Select>
  );
}
