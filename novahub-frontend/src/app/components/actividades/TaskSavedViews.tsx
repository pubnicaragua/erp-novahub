import { useEffect, useState } from 'react';
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/** Filtros de la lista de tareas que se pueden guardar como «vista». */
export interface TaskViewFilters {
  status: string;
  priority: string;
  assigned: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  mine: boolean;
}

export const EMPTY_TASK_FILTERS: TaskViewFilters = { status: 'ALL', priority: 'ALL', assigned: 'ALL', category: 'ALL', dateFrom: '', dateTo: '', search: '', mine: false };

interface SavedView { id: string; name: string; filters: TaskViewFilters }

/** Vistas listas para usar: no se guardan ni se borran. */
const PRESET_VIEWS: SavedView[] = [
  { id: 'preset-mine', name: 'Mis tareas', filters: { ...EMPTY_TASK_FILTERS, mine: true } },
  { id: 'preset-overdue', name: 'Vencidas', filters: { ...EMPTY_TASK_FILTERS, status: 'OVERDUE' } },
  { id: 'preset-approval', name: 'Por aprobar', filters: { ...EMPTY_TASK_FILTERS, status: 'WAITING_APPROVAL' } },
  { id: 'preset-urgent', name: 'Urgentes sin cerrar', filters: { ...EMPTY_TASK_FILTERS, priority: 'URGENT' } },
];

const MAX_SAVED_VIEWS = 12;
const storageKey = (userId: string | null) => `nh:activities:task-views:${userId || 'anon'}`;

/** Lee las vistas guardadas; el almacenamiento puede estar bloqueado o traer datos dañados, y nunca debe romper la lista. */
export function readSavedTaskViews(userId: string | null): SavedView[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((view) => view && typeof view.id === 'string' && typeof view.name === 'string' && view.filters && typeof view.filters === 'object')
      .map((view) => ({ id: view.id, name: String(view.name).slice(0, 40), filters: { ...EMPTY_TASK_FILTERS, ...view.filters } }))
      .slice(0, MAX_SAVED_VIEWS);
  } catch {
    return [];
  }
}

function writeSavedTaskViews(userId: string | null, views: SavedView[]) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(views));
  } catch {
    /* sin almacenamiento disponible: la vista sigue funcionando en esta sesión */
  }
}

interface TaskSavedViewsProps {
  userId: string | null;
  current: TaskViewFilters;
  onApply: (filters: TaskViewFilters) => void;
}

/** «Vistas»: atajos de filtros (los de siempre y los que cada persona guarda en este navegador). */
export function TaskSavedViews({ userId, current, onApply }: TaskSavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { setViews(readSavedTaskViews(userId)); }, [userId]);

  const save = () => {
    const trimmed = name.trim().slice(0, 40);
    if (!trimmed) return;
    const next = [{ id: `view-${Date.now()}`, name: trimmed, filters: current }, ...views.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_SAVED_VIEWS);
    setViews(next);
    writeSavedTaskViews(userId, next);
    setName('');
  };

  const remove = (id: string) => {
    const next = views.filter((view) => view.id !== id);
    setViews(next);
    writeSavedTaskViews(userId, next);
  };

  const apply = (filters: TaskViewFilters) => {
    onApply(filters);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" data-toolbar-role="filters" data-testid="activities-task-views" className="h-10 gap-2 rounded-xl px-3 text-xs font-bold">
          <Bookmark className="size-3.5 text-primary" /> Vistas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 rounded-2xl p-3">
        <div className="space-y-1">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vistas rápidas</p>
          {PRESET_VIEWS.map((view) => (
            <button key={view.id} type="button" onClick={() => apply(view.filters)} className="block w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted">{view.name}</button>
          ))}
        </div>
        <div className="space-y-1 border-t border-border/50 pt-2">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Mis vistas guardadas</p>
          {views.length === 0 ? (
            <p className="px-1 text-[11px] text-muted-foreground">Guarda tus filtros actuales para volver a ellos con un clic.</p>
          ) : views.map((view) => (
            <div key={view.id} className="flex items-center gap-1">
              <button type="button" onClick={() => apply(view.filters)} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted">{view.name}</button>
              <button type="button" aria-label={`Eliminar la vista ${view.name}`} onClick={() => remove(view.id)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
          ))}
        </div>
        <form className="flex items-center gap-2 border-t border-border/50 pt-2" onSubmit={(event) => { event.preventDefault(); save(); }}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Nombre de la vista" aria-label="Nombre de la vista" className="h-9 rounded-lg text-xs" />
          <Button type="submit" size="icon" className="size-9 shrink-0 rounded-lg" disabled={!name.trim()} title="Guardar filtros actuales" aria-label="Guardar filtros actuales"><BookmarkPlus className="size-4" /></Button>
        </form>
        <p className="px-1 text-[10px] text-muted-foreground">Se guardan en este navegador.</p>
      </PopoverContent>
    </Popover>
  );
}
