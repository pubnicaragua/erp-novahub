'use client';

import * as React from 'react';
import { Filter, Search, X, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

export interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

/**
 * MultiSelectFilter
 * - Trigger: Button outline que muestra el label y un contador si hay selección.
 * - Popover con lista scrolleable de checkboxes.
 * - Búsqueda opcional dentro del popover.
 * - Footer con "Limpiar".
 */
export function MultiSelectFilter({
  options,
  selected,
  onChange,
  label,
  placeholder,
  searchable = false,
  className,
  align = 'start',
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const isSelected = React.useCallback(
    (value: string) => selected.includes(value),
    [selected],
  );

  const toggleValue = React.useCallback(
    (value: string) => {
      if (isSelected(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [isSelected, onChange, selected],
  );

  const handleClear = React.useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      onChange([]);
    },
    [onChange],
  );

  const filteredOptions = React.useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const handleSelectAll = React.useCallback(
    () => {
      const visible = filteredOptions.map((o) => o.value);
      const allSelected = visible.length > 0 && visible.every((v) => selected.includes(v));
      if (allSelected) {
        onChange(selected.filter((v) => !visible.includes(v)));
      } else {
        const merged = Array.from(new Set([...selected, ...visible]));
        onChange(merged);
      }
    },
    [filteredOptions, onChange, selected],
  );

  const triggerLabel = React.useMemo(() => {
    if (selected.length === 0) return label;
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label || label;
    }
    return `${label} (${selected.length})`;
  }, [label, options, selected]);

  const allVisibleSelected =
    filteredOptions.length > 0 && filteredOptions.every((opt) => isSelected(opt.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 gap-1 font-medium text-[11px] rounded px-1.5',
            selected.length > 0 && 'border-primary/50 bg-primary/5 text-primary',
            className,
          )}
          aria-label={`Filtrar por ${label}`}
        >
          <Filter className="size-3" />
          <span className="truncate max-w-[100px]">{triggerLabel}</span>
          {selected.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 px-1.5 text-[10px] font-black tabular-nums bg-primary text-primary-foreground"
            >
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[260px] p-0"
        onOpenAutoFocus={(e) => {
          // Evita que el foco se robe al abrir (search input es opcional)
          if (!searchable) e.preventDefault();
        }}
      >
        <div className="flex flex-col">
          {searchable && (
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder || `Buscar ${label.toLowerCase()}...`}
                  className="h-8 pl-8 pr-7 text-xs"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {filteredOptions.length > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {filteredOptions.length} {filteredOptions.length === 1 ? 'opción' : 'opciones'}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] uppercase tracking-widest font-bold text-primary hover:underline"
              >
                {allVisibleSelected ? 'Quitar visibles' : 'Seleccionar visibles'}
              </button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = isSelected(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs',
                      'hover:bg-muted/60 transition-colors',
                      checked && 'bg-primary/5',
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleValue(opt.value)}
                      aria-label={opt.label}
                    />
                    <span className="flex-1 truncate">{opt.label}</span>
                    {typeof opt.count === 'number' && (
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {opt.count}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-1 border-t p-2 bg-muted/20">
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {selected.length > 0 ? `${selected.length} seleccionados` : 'Sin selección'}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[11px] font-bold uppercase tracking-wider"
              onClick={handleClear}
              disabled={selected.length === 0}
            >
              <Check className="size-3 mr-1" />
              Limpiar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelectFilter;