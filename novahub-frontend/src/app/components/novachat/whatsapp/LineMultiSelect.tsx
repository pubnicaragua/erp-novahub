import { Check, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { FALLBACK_LINE_COLOR } from './whatsappUi';

export interface LineOption { id: string; name: string; color: string | null; unread?: number; disconnected?: boolean }

interface Props {
  lines: LineOption[];
  /** Números elegidos. Vacío = todos. */
  value: string[];
  onChange: (ids: string[]) => void;
  allLabel?: string;
  className?: string;
}

/** Elige uno, varios o todos los números (por ejemplo, ver solo 2 de 5). */
export function LineMultiSelect({ lines, value, onChange, allLabel = 'Todos los números', className = '' }: Props) {
  const selected = value.filter((id) => lines.some((l) => l.id === id));
  const all = selected.length === 0 || selected.length === lines.length;
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    onChange(next.length === lines.length ? [] : next);
  };
  const label = all ? allLabel : selected.length === 1 ? lines.find((l) => l.id === selected[0])?.name || '1 número' : `${selected.length} de ${lines.length} números`;
  const totalUnread = lines.filter((l) => all || selected.includes(l.id)).reduce((s, l) => s + (l.unread || 0), 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Elegir números de WhatsApp" className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-background px-3 text-xs font-bold hover:bg-muted/40 ${className}`}>
          <span className="flex min-w-0 items-center gap-2">
            <span className="flex -space-x-1">
              {(all ? lines : lines.filter((l) => selected.includes(l.id))).slice(0, 4).map((l) => <span key={l.id} className="size-2.5 rounded-full ring-2 ring-background" style={{ backgroundColor: l.color || FALLBACK_LINE_COLOR }} />)}
            </span>
            <span className="truncate">{label}</span>
            {totalUnread > 0 && <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white">{totalUnread > 99 ? '99+' : totalUnread}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <button type="button" onClick={() => onChange([])} className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-black hover:bg-muted">
          {allLabel}{all && <Check className="size-4 text-emerald-600" />}
        </button>
        <div className="my-1 h-px bg-border/60" />
        <div className="max-h-64 overflow-y-auto">
          {lines.map((l) => {
            const on = !all && selected.includes(l.id);
            return (
              <button key={l.id} type="button" onClick={() => toggle(l.id)} role="checkbox" aria-checked={on} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-muted">
                <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border'}`}>{on && <Check className="size-3" />}</span>
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color || FALLBACK_LINE_COLOR }} />
                <span className="min-w-0 flex-1 truncate font-bold">{l.name}</span>
                {l.disconnected && <span className="shrink-0 text-[10px] font-bold text-amber-600">desconectado</span>}
                {l.unread ? <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white">{l.unread}</span> : null}
              </button>
            );
          })}
        </div>
        <p className="px-2.5 pb-1 pt-2 text-[10px] text-muted-foreground">Marca los números que quieres ver; sin marcar ninguno se muestran todos.</p>
      </PopoverContent>
    </Popover>
  );
}
