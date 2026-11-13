import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '../ui/utils';
import { getCategoryColor, getCategoryIcon } from './categoryStyle';
import type { TaskCategoryGroup } from './taskCategoryGroups';
import { taskCountLabel } from './taskCategoryStats';

interface CategoryGroupedSectionsProps<T> {
  groups: Array<TaskCategoryGroup<T>>;
  /** Claves de las secciones contraídas. Vive en el padre para que cambiar de vista o de filtros no las reabra. */
  collapsed: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onToggleAll: (collapseAll: boolean) => void;
  /** Cómo se dibujan las tareas de una categoría en la vista actual (lista, tarjetas o Kanban). */
  children: (group: TaskCategoryGroup<T>) => ReactNode;
}

/**
 * Cada categoría con su encabezado (nombre y cantidad) y, justo debajo, solo sus tareas.
 * Se usa con «Todas las categorías» en Lista, Tarjetas y Kanban para que nunca se mezclen.
 */
export function CategoryGroupedSections<T>({ groups, collapsed, onToggle, onToggleAll, children }: CategoryGroupedSectionsProps<T>) {
  const allCollapsed = groups.length > 0 && groups.every((group) => collapsed.has(group.key));
  return (
    <div className="min-w-0 divide-y divide-border/40" data-testid="activities-category-sections">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <p className="text-[11px] font-semibold text-muted-foreground">
          {groups.length} {groups.length === 1 ? 'categoría' : 'categorías'} con tareas. Cada una se muestra por separado.
        </p>
        <button
          type="button"
          onClick={() => onToggleAll(!allCollapsed)}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-primary/10 hover:text-primary"
          data-testid="activities-category-sections-toggle-all"
        >
          {allCollapsed ? <ChevronsUpDown className="size-3.5" /> : <ChevronsDownUp className="size-3.5" />}
          {allCollapsed ? 'Expandir todas' : 'Contraer todas'}
        </button>
      </div>
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const Icon = getCategoryIcon(group.category?.icon);
        const color = getCategoryColor(group.category?.color);
        const panelId = `activities-category-section-${group.key}`;
        return (
          <section key={group.key} className="min-w-0" data-testid={panelId} aria-label={`Categoría ${group.name}`}>
            <button
              type="button"
              onClick={() => onToggle(group.key)}
              aria-expanded={!isCollapsed}
              aria-controls={`${panelId}-body`}
              className="flex w-full min-w-0 items-center gap-3 bg-muted/[0.18] px-4 py-3 text-left transition-colors hover:bg-muted/30"
            >
              {isCollapsed ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
              <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', color.chip)}><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-black text-foreground">{group.name}</span>
                <span className="block text-[11px] font-medium text-muted-foreground">
                  {taskCountLabel(group.tasks.length)}{group.open > 0 ? ` · ${group.open} ${group.open === 1 ? 'abierta' : 'abiertas'}` : ''}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-black tabular-nums text-foreground shadow-sm" aria-hidden="true">{group.tasks.length}</span>
            </button>
            {!isCollapsed && (
              <div id={`${panelId}-body`} className="min-w-0">
                {children(group)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
