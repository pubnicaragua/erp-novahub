import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Clock, LayoutGrid, List, Plus, Settings2, Star, UserX, Users } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { cn } from '../ui/utils';
import type { ActivityCategoryItem, Task } from '../../types';
import { TaskProgressCell } from './TaskProgressCell';
import { getCategoryColor, getCategoryIcon } from './categoryStyle';
import {
  NO_CATEGORY_KEY, categoryKeyOf, countByCategory, countByPerson, countTasks, isOverdueTask, taskAssignees, taskCountLabel,
  type CountSet,
} from './taskCategoryStats';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  IN_PROGRESS: { label: 'En progreso', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  WAITING_APPROVAL: { label: 'Por aprobar', className: 'bg-primary/10 text-primary' },
  COMPLETED: { label: 'Completada', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  CANCELLED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
  OVERDUE: { label: 'Vencida', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

const PRIORITY_LABEL: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', URGENT: 'Urgente' };

const ALL_KEY = '__all__';

const openHint = (count: number): string | undefined => (count > 0 ? `${count} ${count === 1 ? 'abierta' : 'abiertas'}` : undefined);

interface PersonOption {
  id: string;
  name: string;
}

interface TareasCategoriasViewProps {
  /** Tareas ya filtradas por la búsqueda y los filtros de la vista. */
  tasks: Task[];
  categories: ActivityCategoryItem[];
  favoriteIds: Set<string>;
  onToggleFavorite: (task: Task) => void;
  togglingFavoriteId?: string | null;
  onOpenTask: (task: Task) => void;
  /** Abre el formulario de nueva tarea con esa categoría elegida. */
  onCreateInCategory?: (categoryKey: string | null) => void;
  onManageCategories?: () => void;
  people: PersonOption[];
  now?: Date;
  loading?: boolean;
}

function CountPill({ value, label, tone }: { value: number; label: string; tone?: 'alert' | 'muted' }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/60 px-3 py-2">
      <p className={cn('text-xl font-black tabular-nums leading-none', tone === 'alert' && value > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{value}</p>
      <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function dueLabel(task: Task): string {
  if (!task.dueDate) return 'Sin fecha';
  const date = new Date(task.dueDate);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : format(date, 'dd/MM/yy HH:mm');
}

function AssigneesText({ task }: { task: Task }) {
  const people = taskAssignees(task as never);
  if (people.length === 0) {
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400"><UserX className="size-3.5" />Sin asignar</span>;
  }
  const shown = people.slice(0, 2).map((person) => person.name).join(', ');
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-muted-foreground" title={people.map((person) => person.name).join(', ')}>
      <Users className="size-3.5 shrink-0 text-primary" />
      <span className="truncate">{shown}{people.length > 2 ? ` +${people.length - 2}` : ''}</span>
    </span>
  );
}

function TaskCard({ task, layout, favorite, toggling, onToggleFavorite, onOpen, now }: {
  task: Task; layout: 'gallery' | 'list'; favorite: boolean; toggling: boolean;
  onToggleFavorite: (task: Task) => void; onOpen: (task: Task) => void; now: Date;
}) {
  const overdue = isOverdueTask(task as never, now);
  const rawStatus = String(task.status || 'PENDING').toUpperCase();
  const status = STATUS_LABEL[overdue && rawStatus !== 'WAITING_APPROVAL' ? 'OVERDUE' : rawStatus] || STATUS_LABEL.PENDING;
  const priority = PRIORITY_LABEL[String(task.priority || '').toUpperCase()];
  const star = (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? `Quitar «${task.title}» de favoritas` : `Marcar «${task.title}» como favorita`}
      title={favorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
      disabled={toggling}
      onClick={(event) => { event.stopPropagation(); onToggleFavorite(task); }}
      className={cn('shrink-0 rounded-lg p-1.5 transition-colors hover:bg-primary/10 disabled:opacity-50', favorite ? 'text-amber-500' : 'text-muted-foreground/50 hover:text-foreground')}
    >
      <Star className={cn('size-4', favorite && 'fill-current')} />
    </button>
  );

  if (layout === 'list') {
    return (
      <li>
        <div
          role="button"
          tabIndex={0}
          onClick={() => onOpen(task)}
          onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(task); } }}
          className="flex min-w-0 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border/40 bg-card px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/[0.03]"
        >
          {star}
          <p className="min-w-0 flex-1 basis-56 break-words text-sm font-bold leading-5 text-foreground [overflow-wrap:anywhere]">{task.title}</p>
          <Badge variant="outline" className={cn('shrink-0 border-transparent px-2 py-0.5 text-[9px] font-black uppercase', status.className)}>{status.label}</Badge>
          <div className="min-w-0 basis-40"><AssigneesText task={task} /></div>
          <span className={cn('inline-flex shrink-0 items-center gap-1 text-xs font-medium', overdue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}><Clock className="size-3.5" />{dueLabel(task)}</span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(task)}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(task); } }}
        className="flex h-full min-w-0 cursor-pointer flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 flex-1 break-words text-sm font-bold leading-5 text-foreground [overflow-wrap:anywhere]">{task.title}</p>
          {star}
        </div>
        {task.description && <p className="line-clamp-3 min-w-0 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{task.description}</p>}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className={cn('border-transparent px-2 py-0.5 text-[9px] font-black uppercase', status.className)}>{status.label}</Badge>
          {priority && <Badge variant="outline" className="px-2 py-0.5 text-[9px] font-black uppercase">{priority}</Badge>}
        </div>
        <TaskProgressCell task={task} />
        <div className="mt-auto flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <AssigneesText task={task} />
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium', overdue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}><Clock className="size-3.5" />{dueLabel(task)}</span>
        </div>
      </div>
    </li>
  );
}

/**
 * Vista «Por categoría» (estilo Notion): categorías a la izquierda con su cantidad de tareas y, a la derecha,
 * las tareas agrupadas por categoría, con el resumen del equipo (quién tiene qué y qué nadie ha tomado).
 */
export function TareasCategoriasView({
  tasks, categories, favoriteIds, onToggleFavorite, togglingFavoriteId, onOpenTask, onCreateInCategory, onManageCategories, people, now, loading,
}: TareasCategoriasViewProps) {
  const [selected, setSelected] = useState<string>(ALL_KEY);
  const [layout, setLayout] = useState<'gallery' | 'list'>('gallery');
  const [showTeam, setShowTeam] = useState(true);
  const [showFreePeople, setShowFreePeople] = useState(false);
  const clock = useMemo(() => now ?? new Date(), [now]);

  const stats = useMemo(() => countByCategory(tasks as never[], clock), [tasks, clock]);
  const global = useMemo(() => countTasks(tasks as never[], clock), [tasks, clock]);
  const scopedTasks = useMemo(
    () => (selected === ALL_KEY ? tasks : tasks.filter((task) => categoryKeyOf(task as never) === selected)),
    [tasks, selected],
  );
  const scoped: CountSet = useMemo(() => countTasks(scopedTasks as never[], clock), [scopedTasks, clock]);
  const team = useMemo(() => countByPerson(scopedTasks as never[], people, clock), [scopedTasks, people, clock]);
  const busyPeople = useMemo(() => team.filter((person) => person.open > 0), [team]);
  const freePeople = useMemo(() => team.filter((person) => person.open === 0), [team]);

  const activeCategories = categories.filter((category) => !category.isArchived);
  // Una categoría archivada con tareas sigue apareciendo, para que esas tareas no queden invisibles.
  const archivedWithTasks = categories.filter((category) => category.isArchived && (stats.get(category.key)?.total || 0) > 0);
  const knownKeys = new Set(categories.map((category) => category.key));
  const orphanKeys = [...stats.keys()].filter((key) => key !== NO_CATEGORY_KEY && !knownKeys.has(key));
  const railCategories: ActivityCategoryItem[] = [
    ...activeCategories,
    ...archivedWithTasks,
    ...orphanKeys.map((key, index) => ({ id: key, key, name: key, description: null, icon: null, color: null, position: 1000 + index, isArchived: true, isDefault: false })),
  ];
  const noCategoryCount = stats.get(NO_CATEGORY_KEY)?.total || 0;

  const groups: Array<{ key: string; category: ActivityCategoryItem | null; tasks: Task[] }> = useMemo(() => {
    const byKey = new Map<string, Task[]>();
    for (const task of scopedTasks) {
      const key = categoryKeyOf(task as never);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(task);
    }
    const ordered: Array<{ key: string; category: ActivityCategoryItem | null; tasks: Task[] }> = railCategories
      .filter((category) => selected === ALL_KEY ? (!category.isArchived || byKey.has(category.key)) : category.key === selected)
      .map((category) => ({ key: category.key, category, tasks: byKey.get(category.key) || [] }));
    if (selected === ALL_KEY ? byKey.has(NO_CATEGORY_KEY) : selected === NO_CATEGORY_KEY) {
      ordered.push({ key: NO_CATEGORY_KEY, category: null, tasks: byKey.get(NO_CATEGORY_KEY) || [] });
    }
    return ordered;
    // railCategories se recalcula en cada render a partir de estas mismas entradas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedTasks, categories, selected, stats]);

  const selectedCategory = railCategories.find((category) => category.key === selected) || null;
  const scopeTitle = selected === ALL_KEY ? 'Todas las categorías' : selected === NO_CATEGORY_KEY ? 'Sin categoría' : selectedCategory?.name || 'Categoría';

  const railButton = (key: string, label: string, count: number, Icon: ReturnType<typeof getCategoryIcon>, colorKey: string | null, hint?: string) => {
    const active = selected === key;
    const color = getCategoryColor(colorKey);
    return (
      <button
        key={key}
        type="button"
        aria-pressed={active}
        onClick={() => setSelected(key)}
        className={cn(
          'flex min-w-0 shrink-0 items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors lg:w-full',
          active ? cn('shadow-sm', color.ring, 'bg-primary/[0.04]') : 'border-border/40 hover:border-primary/30',
        )}
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', color.chip)}><Icon className="size-[18px]" /></span>
        <span className="min-w-0">
          <span className="block max-w-[11rem] break-words text-sm font-bold leading-4 text-foreground lg:max-w-none">{label}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{taskCountLabel(count)}{hint ? ` · ${hint}` : ''}</span>
        </span>
      </button>
    );
  };

  return (
    <div className="grid min-w-0 gap-4 p-3 sm:p-4 lg:grid-cols-[17rem_minmax(0,1fr)]" data-testid="activities-task-categories-view">
      <aside className="min-w-0 space-y-2 lg:self-start" aria-label="Categorías">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categorías</p>
          {onManageCategories && (
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg px-2 text-[10px] font-black uppercase tracking-widest" onClick={onManageCategories} data-testid="activities-manage-categories">
              <Settings2 className="size-3.5" /> Gestionar
            </Button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {railButton(ALL_KEY, 'Todas', global.total, LayoutGrid, null, openHint(global.open))}
          {railCategories.map((category) => railButton(
            category.key,
            category.isArchived ? `${category.name} (archivada)` : category.name,
            stats.get(category.key)?.total || 0,
            getCategoryIcon(category.icon),
            category.color,
            openHint(stats.get(category.key)?.open || 0),
          ))}
          {noCategoryCount > 0 && railButton(NO_CATEGORY_KEY, 'Sin categoría', noCategoryCount, List, null)}
        </div>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-base font-black text-foreground">{scopeTitle}</h3>
            {selectedCategory?.description && <p className="break-words text-xs text-muted-foreground">{selectedCategory.description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="inline-flex rounded-xl border border-border/50 bg-background/50 p-0.5" role="group" aria-label="Distribución de las tareas">
              <button type="button" aria-pressed={layout === 'gallery'} onClick={() => setLayout('gallery')} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest', layout === 'gallery' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}><LayoutGrid className="size-3.5" />Galería</button>
              <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')} className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest', layout === 'list' ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}><List className="size-3.5" />Lista</button>
            </div>
            {onCreateInCategory && selected !== ALL_KEY && (
              <Button type="button" size="sm" className="h-9 rounded-xl px-3 text-xs font-black uppercase tracking-widest" onClick={() => onCreateInCategory(selected === NO_CATEGORY_KEY ? null : selected)}>
                <Plus className="mr-1.5 size-4" /> Nueva tarea
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label={`Resumen de ${scopeTitle}`}>
          <CountPill value={scoped.total} label="Tareas" />
          <CountPill value={scoped.open} label="Abiertas" />
          <CountPill value={scoped.overdue} label="Vencidas" tone="alert" />
          <CountPill value={scoped.unassigned} label="Sin asignar" tone="alert" />
          <CountPill value={scoped.notStarted} label="Sin tomar" tone="alert" />
        </div>
        {selected !== ALL_KEY && (
          <p className="text-[11px] text-muted-foreground">
            En toda la empresa hay {global.open} {global.open === 1 ? 'tarea abierta' : 'tareas abiertas'}, {global.unassigned} sin asignar y {global.notStarted} asignadas que nadie ha tomado todavía.
          </p>
        )}

        <Card className="min-w-0 rounded-2xl border-border/50 bg-card/70 shadow-none">
          <button type="button" className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left" aria-expanded={showTeam} onClick={() => setShowTeam((value) => !value)}>
            <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-foreground"><Users className="size-4 text-primary" />Quién tiene qué</span>
            {showTeam ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
          </button>
          {showTeam && (
            <div className="overflow-x-auto border-t border-border/40 px-2 pb-2" data-table-content-sized="true">
              <table className="w-full min-w-[28rem] text-left text-xs">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <th className="px-2 py-2">Persona</th>
                    <th className="px-2 py-2 text-right">Abiertas</th>
                    <th className="px-2 py-2 text-right">En progreso</th>
                    <th className="px-2 py-2 text-right">Sin tomar</th>
                    <th className="px-2 py-2 text-right">Vencidas</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border/30">
                    <td className="px-2 py-2 font-bold text-foreground">Sin asignar</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{scoped.unassigned}</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">—</td>
                    <td className="px-2 py-2 text-right text-muted-foreground">—</td>
                  </tr>
                  {[...busyPeople, ...(showFreePeople ? freePeople : [])].map((person) => (
                    <tr key={person.id} className="border-t border-border/30">
                      <td className="max-w-[14rem] truncate px-2 py-2 font-semibold text-foreground" title={person.name}>
                        {person.name}
                        {person.open === 0 && <span className="ml-2 text-[10px] font-medium text-muted-foreground">libre</span>}
                      </td>
                      <td className="px-2 py-2 text-right font-bold tabular-nums">{person.open}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{person.inProgress}</td>
                      <td className={cn('px-2 py-2 text-right tabular-nums', person.notStarted > 0 && 'font-bold text-amber-600 dark:text-amber-400')}>{person.notStarted}</td>
                      <td className={cn('px-2 py-2 text-right tabular-nums', person.overdue > 0 && 'font-bold text-rose-600 dark:text-rose-400')}>{person.overdue}</td>
                    </tr>
                  ))}
                  {freePeople.length > 0 && (
                    <tr className="border-t border-border/30">
                      <td colSpan={5} className="px-2 py-2">
                        <button type="button" className="text-[11px] font-bold text-primary hover:underline" aria-expanded={showFreePeople} onClick={() => setShowFreePeople((value) => !value)}>
                          {showFreePeople ? 'Ocultar a quienes no tienen tareas abiertas' : `Mostrar ${freePeople.length} ${freePeople.length === 1 ? 'persona sin tareas abiertas' : 'personas sin tareas abiertas'}`}
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="px-2 pb-1 pt-2 text-[11px] text-muted-foreground">
                «Sin tomar»: tiene responsable pero sigue en Pendiente. «Abiertas» es todo lo que no está completado ni cancelado, vencidas incluidas.
              </p>
            </div>
          )}
        </Card>

        {loading && tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">Cargando tareas…</p>
        ) : groups.length === 0 || (selected === ALL_KEY && tasks.length === 0) ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">No hay tareas con estos filtros.</p>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => {
              const Icon = getCategoryIcon(group.category?.icon);
              const color = getCategoryColor(group.category?.color);
              const name = group.category ? group.category.name : 'Sin categoría';
              return (
                <div key={group.key} className="space-y-3" data-testid={`activities-category-group-${group.key}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg', color.chip)}><Icon className="size-4" /></span>
                    <h4 className="min-w-0 break-words text-sm font-black text-foreground">{name}</h4>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-black tabular-nums text-muted-foreground">{group.tasks.length}</span>
                    {onCreateInCategory && (
                      <button type="button" aria-label={`Nueva tarea en ${name}`} title={`Nueva tarea en ${name}`} onClick={() => onCreateInCategory(group.category ? group.key : null)} className="ml-auto shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary">
                        <Plus className="size-4" />
                      </button>
                    )}
                  </div>
                  {group.tasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/50 px-4 py-3 text-xs text-muted-foreground">Aún no hay tareas en esta categoría.</p>
                  ) : (
                    <ul className={cn(layout === 'gallery' ? 'grid gap-3 sm:grid-cols-2 2xl:grid-cols-3' : 'space-y-2')}>
                      {group.tasks.map((task) => (
                        <TaskCard
                          key={String(task.id)}
                          task={task}
                          layout={layout}
                          favorite={favoriteIds.has(String(task.id))}
                          toggling={togglingFavoriteId === String(task.id)}
                          onToggleFavorite={onToggleFavorite}
                          onOpen={onOpenTask}
                          now={clock}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {scoped.overdue > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400"><AlertTriangle className="size-3.5" />Hay {scoped.overdue} {scoped.overdue === 1 ? 'tarea vencida' : 'tareas vencidas'} en esta vista.</p>
        )}
      </section>
    </div>
  );
}
