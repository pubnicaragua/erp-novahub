import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../ui/button';

/** Menú de filtro de una columna: lista de valores con casillas, búsqueda y orden. */
export function SheetFilterMenu({ title, values, allowed, anchor, onApply, onSort, onClose }: {
  title: string;
  values: string[];
  /** Valores hoy visibles; null si la columna no está filtrada. */
  allowed: string[] | null;
  anchor: { left: number; top: number };
  onApply: (allowed: string[] | null) => void;
  onSort?: (asc: boolean) => void;
  onClose: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(allowed ?? values));
  const [search, setSearch] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => values.filter((v) => v.toLowerCase().includes(search.trim().toLowerCase())), [values, search]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    const onDown = (event: MouseEvent) => { if (box.current && !box.current.contains(event.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey); window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [onClose]);
  const toggle = (value: string) => setChecked((current) => { const next = new Set(current); if (next.has(value)) next.delete(value); else next.add(value); return next; });
  const allShownChecked = shown.length > 0 && shown.every((v) => checked.has(v));
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - 268)); const top = Math.min(anchor.top, Math.max(8, window.innerHeight - 380));
  return (
    <div ref={box} role="dialog" aria-label={`Filtrar ${title}`} style={{ left, top }} className="fixed z-50 w-64 space-y-2 rounded-xl border border-border bg-background p-3 shadow-xl">
      <p className="truncate text-[12px] font-semibold">Filtrar: {title}</p>
      {onSort && (
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { onSort(true); onClose(); }}>Ordenar A → Z</Button>
          <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => { onSort(false); onClose(); }}>Z → A</Button>
        </div>
      )}
      <input autoFocus aria-label="Buscar un valor" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-full rounded-md border border-border bg-background px-2 text-[13px]" />
      <label className="flex items-center gap-2 text-[12px] font-semibold">
        <input type="checkbox" checked={allShownChecked} onChange={() => setChecked((current) => { const next = new Set(current); shown.forEach((v) => { if (allShownChecked) next.delete(v); else next.add(v); }); return next; })} />
        (Seleccionar todo)
      </label>
      <ul className="max-h-52 space-y-0.5 overflow-y-auto" aria-label="Valores">
        {shown.map((value) => (
          <li key={value}><label className="flex items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-muted/60"><input type="checkbox" checked={checked.has(value)} onChange={() => toggle(value)} /><span className="min-w-0 truncate">{value}</span></label></li>
        ))}
        {!shown.length && <li className="px-1 py-2 text-[12px] text-muted-foreground">Sin resultados</li>}
      </ul>
      <div className="flex justify-between gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { onApply(null); onClose(); }}>Quitar filtro</Button>
        <Button type="button" size="sm" disabled={!checked.size} onClick={() => { onApply(checked.size === values.length ? null : values.filter((v) => checked.has(v))); onClose(); }}>Aplicar</Button>
      </div>
    </div>
  );
}
