import { useEffect, useState } from 'react';
import { cn } from './utils';
import { Button } from './button';
import { RotateCw } from 'lucide-react';
import { useUserViewPreferences } from '../../hooks/useUserViewPreferences';
import type { UserViewPreferenceScope } from '../../services/user-view-preferences.service';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

export type ViewLayoutMode = 'table' | 'cards' | 'kanban' | 'categories';
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
  /** Only views with a real Kanban renderer should expose this option. */
  showKanban?: boolean;
  /** Only views that group their records by category should expose this option. */
  showCategories?: boolean;
  ariaLabel?: string;
  className?: string;
  dataTour?: string;
  /** Stable id for cross-device preferences. */
  preferenceKey?: string;
  preferenceScope?: UserViewPreferenceScope;
  /** Code default used when this user has no saved preference. */
  defaultMode?: ViewLayoutMode;
}

export function ViewLayoutSelect({
  value,
  onChange,
  showKanban = false,
  showCategories = false,
  ariaLabel = 'Elegir distribución',
  className,
  dataTour,
  preferenceKey,
  preferenceScope = 'company',
  defaultMode = 'table',
}: ViewLayoutSelectProps) {
  const savedView = useUserViewPreferences(preferenceKey, preferenceScope);
  const normalizeMode = (mode: ViewLayoutMode): ViewLayoutMode =>
    ((!showKanban && mode === 'kanban') || (!showCategories && mode === 'categories')) ? 'table' : mode;
  const loadedPreference = preferenceKey && !savedView.isLoading && !savedView.loadError
    ? normalizeMode((savedView.preferences.layoutMode as ViewLayoutMode | undefined) || defaultMode)
    : value;
  const effectiveValue = normalizeMode(loadedPreference);

  useEffect(() => {
    if (!preferenceKey || savedView.isLoading || savedView.loadError) return;
    const nextMode = normalizeMode((savedView.preferences.layoutMode as ViewLayoutMode | undefined) || defaultMode);
    if (value !== nextMode) onChange(nextMode);
  }, [defaultMode, onChange, preferenceKey, savedView.isLoading, savedView.loadError, savedView.preferences.layoutMode, showCategories, showKanban, value]);

  return (
    <div className="inline-flex max-w-full items-center gap-1">
      <Select
        value={effectiveValue}
        disabled={Boolean(preferenceKey && savedView.isLoading)}
        onValueChange={(nextValue) => {
          const nextMode = nextValue as ViewLayoutMode;
          onChange(nextMode);
          if (preferenceKey) void savedView.save({ layoutMode: nextMode });
        }}
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
          {showKanban && <SelectItem value="kanban">Kanban</SelectItem>}
          {showCategories && <SelectItem value="categories">Por categoría</SelectItem>}
        </SelectContent>
      </Select>
      {preferenceKey && savedView.loadError && (
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Reintentar cargar preferencias" title="Reintentar cargar preferencias" onClick={() => void savedView.retry()}>
          <RotateCw className="size-4" />
        </Button>
      )}
    </div>
  );
}
