import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import { ViewGuide } from '../organizacion/ViewGuide';
import {
  FORCE_SALES_MODE_GUIDES,
  FORCE_SALES_MODE_LABELS,
  type ForceSalesModeId,
  type ForceSalesSummary,
} from './forceSalesModes';

interface ForceSalesMapHeaderProps {
  modes: readonly ForceSalesModeId[];
  activeMode: ForceSalesModeId;
  onModeChange: (mode: ForceSalesModeId) => void;
  summary: ForceSalesSummary | null;
  onSearch: (query: string, submit: boolean) => void;
  onPrimaryAction: () => void;
}

/**
 * Parte superior del mapa: título con «?», modos habilitados, indicadores y la barra con el buscador a la izquierda
 * y la acción principal a la derecha. El mapa (iframe) publica el resumen; este componente solo lo dibuja.
 */
export function ForceSalesMapHeader({ modes, activeMode, onModeChange, summary, onSearch, onPrimaryAction }: ForceSalesMapHeaderProps) {
  const [query, setQuery] = useState('');
  const timer = useRef<number | null>(null);
  const label = FORCE_SALES_MODE_LABELS[activeMode] || summary?.title || activeMode;
  const guide = FORCE_SALES_MODE_GUIDES[activeMode];

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const changeQuery = (value: string) => {
    setQuery(value);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onSearch(value, false), 250);
  };

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5" data-tour="page-title">
          <h1 className="nh-module-title truncate text-primary dark:text-foreground">{label}</h1>
          {guide && <ViewGuide guide={guide} />}
        </div>
        {modes.length > 1 && (
          <div role="tablist" aria-label="Modo del mapa" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-1">
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={mode === activeMode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  'min-h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mode === activeMode ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {FORCE_SALES_MODE_LABELS[mode] || mode}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2" data-tour="force-sales-toolbar">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              if (timer.current !== null) window.clearTimeout(timer.current);
              onSearch(query, true);
            }}
            placeholder={summary?.searchPlaceholder || 'Buscar…'}
            aria-label={summary?.searchPlaceholder || 'Buscar en el mapa'}
            className="h-10 w-full rounded-xl border-border/50 bg-background/50 pl-9 text-sm"
          />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {summary?.primaryAction && (
            <Button type="button" onClick={onPrimaryAction} disabled={summary.primaryAction.disabled} className="h-10 rounded-xl px-4 text-sm font-bold">
              {summary.primaryAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
