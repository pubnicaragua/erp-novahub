// Agrupa las tareas por categoría, en el orden en que la empresa las tiene definidas. Lógica pura, probada con
// `npm run test:task-category-groups`.
import type { ActivityCategoryItem } from '../../types/index';
import { NO_CATEGORY_KEY, categoryKeyOf, isOpenTask } from './taskCategoryStats.ts';

interface GroupableTask {
  id: string | number;
  categoryId?: string | null;
  status?: string | null;
}

export interface TaskCategoryGroup<T> {
  /** Clave de la categoría en mayúsculas, o `__none__` para «Sin categoría». */
  key: string;
  name: string;
  category: ActivityCategoryItem | null;
  tasks: T[];
  /** Tareas que no están completadas ni canceladas. */
  open: number;
}

const normalizeKey = (value: string) => String(value || '').trim().toUpperCase();

/**
 * Una sección por categoría que tenga tareas, sin mezclarlas:
 * 1. las categorías activas, en su orden;
 * 2. las archivadas que todavía tengan tareas (para que esas tareas no queden invisibles);
 * 3. las claves que ya no existen en la lista de categorías (datos antiguos);
 * 4. «Sin categoría», siempre al final.
 */
export function groupTasksByCategory<T extends GroupableTask>(tasks: T[], categories: ActivityCategoryItem[]): Array<TaskCategoryGroup<T>> {
  const byKey = new Map<string, T[]>();
  for (const task of tasks) {
    const key = categoryKeyOf(task);
    const bucket = byKey.get(key);
    if (bucket) bucket.push(task);
    else byKey.set(key, [task]);
  }

  const build = (key: string, name: string, category: ActivityCategoryItem | null): TaskCategoryGroup<T> => {
    const list = byKey.get(key) || [];
    return { key, name, category, tasks: list, open: list.filter((task) => isOpenTask(task)).length };
  };

  const groups: Array<TaskCategoryGroup<T>> = [];
  const used = new Set<string>();
  const known = [...categories];
  const ordered = [
    ...known.filter((category) => !category.isArchived),
    ...known.filter((category) => category.isArchived),
  ];
  for (const category of ordered) {
    const key = normalizeKey(category.key);
    if (used.has(key) || !byKey.has(key)) continue;
    used.add(key);
    groups.push(build(key, category.isArchived ? `${category.name} (archivada)` : category.name, category));
  }
  for (const key of byKey.keys()) {
    if (key === NO_CATEGORY_KEY || used.has(key)) continue;
    used.add(key);
    groups.push(build(key, key.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()), null));
  }
  if (byKey.has(NO_CATEGORY_KEY)) groups.push(build(NO_CATEGORY_KEY, 'Sin categoría', null));
  return groups;
}
