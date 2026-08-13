"use client";

import { useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Checkbox } from './checkbox';
import { ArrowDownAZ, ArrowUpAZ, Filter, X } from 'lucide-react';
import { cn } from './utils';

export type ColumnSort = 'asc' | 'desc' | null;

export interface ColumnFilterMenuProps {
  label: string;
  options?: { value: string; label: string; count?: number }[];
  selected?: string[];
  onSelect?: (values: string[]) => void;
  sort?: ColumnSort;
  onSort?: (sort: ColumnSort) => void;
  sortOptions?: { value: ColumnSort; label: string; icon?: React.ReactNode }[];
}

export function ColumnFilterMenu({ label, options = [], selected = [], onSelect, sort, onSort, sortOptions }: ColumnFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const active = Boolean(sort) || selected.length > 0;
  const defaultSortOptions: { value: ColumnSort; label: string; icon?: React.ReactNode }[] = [
    { value: 'asc', label: 'A → Z / Menor a mayor', icon: <ArrowUpAZ className="size-3" /> },
    { value: 'desc', label: 'Z → A / Mayor a menor', icon: <ArrowDownAZ className="size-3" /> },
  ];
  const effectiveSortOptions = sortOptions || defaultSortOptions;

  const toggleValue = (value: string) => {
    if (!onSelect) return;
    onSelect(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <span className="inline-flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={`Filtrar por ${label}`}
            onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
            className={cn(
              "inline-flex size-4 items-center justify-center rounded transition-colors",
              active
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground/40 hover:bg-muted hover:text-foreground"
            )}
          >
            <Filter className="size-3" />
          </button>
        </PopoverTrigger>
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
      </Popover>
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
