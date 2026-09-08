"use client";

import { useCallback, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Checkbox } from './checkbox';
import {
  ArrowDown10,
  ArrowDownAZ,
  ArrowUp01,
  ArrowUpAZ,
  ArrowUpDown,
  CalendarArrowDown,
  CalendarArrowUp,
  Filter,
  X,
} from 'lucide-react';
import { cn } from './utils';

export type ColumnSort = 'asc' | 'desc' | null;
export type ColumnSortType = 'text' | 'number' | 'date';

const normalizeSortText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

function inferSortType(label: string): ColumnSortType {
  const normalizedLabel = normalizeSortText(label);

  if (
    /fecha|venc|periodo/.test(normalizedLabel)
  ) {
    return 'date';
  }

  if (
    /total|saldo|monto|importe|precio|cantidad|stock|salario|costo|debito|credito|neto|subtotal|balance|disponible|limite|porcentaje|descuento|iva/.test(normalizedLabel)
  ) {
    return 'number';
  }

  return 'text';
}

function SortDirectionIcon({ sort, sortType, className }: { sort: Exclude<ColumnSort, null>; sortType: ColumnSortType; className?: string }) {
  if (sortType === 'date') {
    return sort === 'desc'
      ? <CalendarArrowDown className={className} />
      : <CalendarArrowUp className={className} />;
  }

  if (sortType === 'number') {
    return sort === 'desc'
      ? <ArrowDown10 className={className} />
      : <ArrowUp01 className={className} />;
  }

  return sort === 'desc'
    ? <ArrowDownAZ className={className} />
    : <ArrowUpAZ className={className} />;
}

export interface ColumnFilterMenuProps {
  label: string;
  options?: { value: string; label: string; count?: number }[];
  selected?: string[];
  onSelect?: (values: string[]) => void;
  sort?: ColumnSort;
  onSort?: (sort: ColumnSort) => void;
  sortOptions?: { value: ColumnSort; label: string; icon?: React.ReactNode }[];
  /** Permite fijar la semántica cuando el nombre de la columna no es suficiente. */
  sortType?: ColumnSortType;
  /** Presentación mínima para encabezados de tabla: solo ordenamiento. */
  compact?: boolean;
  /** Oculta el texto del trigger, mostrando solo el ícono. */
  hideLabel?: boolean;
}

export function ColumnFilterMenu({ label, options = [], selected = [], onSelect, sort, onSort, sortOptions, sortType, compact = false, hideLabel = false }: ColumnFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [tableContext, setTableContext] = useState(false);
  const isCompact = compact || tableContext;
  const active = Boolean(sort) || (!isCompact && selected.length > 0);
  const resolvedSortType = sortType || inferSortType(label);
  const firstSort: Exclude<ColumnSort, null> = resolvedSortType === 'text' ? 'asc' : 'desc';
  const secondSort: Exclude<ColumnSort, null> = firstSort === 'asc' ? 'desc' : 'asc';
  const defaultSortOptions: { value: ColumnSort; label: string; icon?: React.ReactNode }[] = [
    ...(resolvedSortType === 'text'
      ? [
          { value: 'asc' as const, label: 'A → Z / Orden alfabético', icon: <SortDirectionIcon sort="asc" sortType="text" className="size-3" /> },
          { value: 'desc' as const, label: 'Z → A / Orden alfabético inverso', icon: <SortDirectionIcon sort="desc" sortType="text" className="size-3" /> },
        ]
      : resolvedSortType === 'date'
        ? [
            { value: 'desc' as const, label: 'Más recientes', icon: <SortDirectionIcon sort="desc" sortType="date" className="size-3" /> },
            { value: 'asc' as const, label: 'Más antiguas', icon: <SortDirectionIcon sort="asc" sortType="date" className="size-3" /> },
          ]
        : [
            { value: 'desc' as const, label: 'Mayor a menor', icon: <SortDirectionIcon sort="desc" sortType="number" className="size-3" /> },
            { value: 'asc' as const, label: 'Menor a mayor', icon: <SortDirectionIcon sort="asc" sortType="number" className="size-3" /> },
          ]),
  ];
  const effectiveSortOptions = sortOptions || defaultSortOptions;
  const sortDirectionLabel = !sort
    ? 'sin orden'
    : resolvedSortType === 'date'
      ? sort === 'desc' ? 'más recientes' : 'más antiguas'
      : resolvedSortType === 'number'
        ? sort === 'desc' ? 'mayor a menor' : 'menor a mayor'
        : sort === 'desc' ? 'Z a A' : 'A a Z';

  const toggleValue = (value: string) => {
    if (!onSelect) return;
    onSelect(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const toggleTableSort = () => {
    if (!onSort) return;
    onSort(!sort ? firstSort : sort === firstSort ? secondSort : null);
  };

  const triggerClassName = cn(
    isCompact
      ? "column-filter-menu-trigger inline-flex size-4 shrink-0 translate-y-px items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground/70 transition-colors hover:bg-transparent hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
      : hideLabel
        ? "column-filter-menu-trigger inline-flex size-4 shrink-0 items-center justify-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground/70 transition-colors hover:bg-transparent hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
        : "column-filter-menu-trigger inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[10px] font-black uppercase tracking-wider transition-colors",
    isCompact
      ? active ? "text-primary" : "text-muted-foreground/70 hover:text-primary"
      : active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
  );

  const trigger = (
    <button
      type="button"
      title={isCompact ? `Ordenar ${label}: ${sortDirectionLabel}` : `Filtrar por ${label}`}
      aria-label={isCompact ? `Ordenar ${label}: ${sortDirectionLabel}` : `Filtrar por ${label}`}
      aria-pressed={isCompact ? Boolean(sort) : active}
      onClick={(e) => {
        e.stopPropagation();
        const isTableHeader = Boolean(e.currentTarget.closest('th,[role="columnheader"]'));
        if (isCompact || isTableHeader) {
          if (isTableHeader) setTableContext(true);
          toggleTableSort();
          return;
        }
        setOpen(!open);
      }}
      className={triggerClassName}
    >
      {isCompact && (
        <span key={`sort-icon-${sort || 'none'}`} className="column-sort-icon-swap inline-flex" aria-hidden="true">
          {sort === 'asc'
            ? <SortDirectionIcon sort="asc" sortType={resolvedSortType} className="column-sort-icon size-3.5" />
            : sort === 'desc'
              ? <SortDirectionIcon sort="desc" sortType={resolvedSortType} className="column-sort-icon size-3.5" />
              : <ArrowUpDown className="column-sort-icon size-3.5" />}
        </span>
      )}
      <Filter className={cn("column-filter-icon size-3.5 shrink-0", isCompact && "hidden")} />
      {!isCompact && !hideLabel && <span className="column-filter-menu-label min-w-0 truncate">Filtrar {label}</span>}
    </button>
  );

  return (
    <span className="column-filter-menu inline-flex items-center">
      {isCompact ? trigger : <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent align="start" side="bottom" className="w-64 p-2">
          <div className="flex items-center justify-between gap-2 border-b border-border/50 px-2 pb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filtros · {label}</p>
            {active && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase text-rose-500 hover:underline"
                onClick={() => { onSort?.(null); onSelect?.([]); }}
              >
                <X className="size-3" /> Quitar
              </button>
            )}
          </div>

          {onSort && (
            <div className="space-y-0.5 p-1.5">
              <p className="px-1.5 pb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Ordenar</p>
              <button
                type="button"
                onClick={() => onSort(null)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] font-bold",
                  !sort ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                Sin orden
              </button>
              {effectiveSortOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => onSort(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-[11px] font-bold",
                    sort === option.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {options.length > 0 && onSelect && (
            <div className="max-h-48 overflow-y-auto space-y-0.5 border-t border-border/40 p-1.5">
              <p className="px-1.5 pb-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Mostrar solo</p>
              {options.map((option) => {
                const checked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[11px] font-bold hover:bg-muted",
                      checked ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggleValue(option.value)} className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {typeof option.count === 'number' && <span className="text-[9px] text-muted-foreground/60">{option.count}</span>}
                  </label>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>}
    </span>
  );
}

export interface ColumnFiltersState {
  [key: string]: { sort?: ColumnSort; values?: string[] };
}

export function useColumnFilters() {
  const [state, setState] = useState<ColumnFiltersState>({});

  const setSort = useCallback((key: string, sort: ColumnSort) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], sort } }));
  }, []);

  const setValues = useCallback((key: string, values: string[]) => {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], values } }));
  }, []);

  const reset = useCallback((key: string) => {
    setState((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  const isActive = useCallback((key: string) => {
    const cfg = state[key];
    return Boolean(cfg && (cfg.sort || (cfg.values && cfg.values.length > 0)));
  }, [state]);

  const applyTo = useCallback(<T,>(rows: T[], getters: Record<string, (row: T) => string | number | null | undefined | { toString(): string }>): T[] => {
    const filterKeys = Object.keys(state);
    if (filterKeys.length === 0) return rows;

    const compare = (a: string | number, b: string | number): number => {
      const aNum = typeof a === 'number' ? a : Number(a);
      const bNum = typeof b === 'number' ? b : Number(b);
      if (typeof a === 'number' || typeof b === 'number' || (Number.isFinite(aNum) && Number.isFinite(bNum))) {
        return aNum - bNum;
      }
      return String(a).localeCompare(String(b), 'es');
    };

    return rows
      .filter((row) => {
        for (const key of filterKeys) {
          const cfg = state[key];
          const values = cfg?.values;
          if (!values || values.length === 0) continue;
          const getter = getters[key];
          const raw = getter ? getter(row) : (row as any)?.[key];
          const value = raw === null || raw === undefined || raw === '' ? '' : String(raw);
          const hasEmpty = values.includes('__empty__');
          if (hasEmpty && !value) continue;
          if (!values.includes(value)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        for (const key of filterKeys) {
          const cfg = state[key];
          const sort = cfg?.sort;
          if (!sort) continue;
          const getter = getters[key];
          const av = getter ? getter(a) : (a as any)?.[key];
          const bv = getter ? getter(b) : (b as any)?.[key];
          const cmp = compare(av === null || av === undefined ? '' : (av as any), bv === null || bv === undefined ? '' : (bv as any));
          if (cmp !== 0) return sort === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
  }, [state]);

  return { state, setSort, setValues, reset, isActive, applyTo };
}
