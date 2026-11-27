import type { ViewLayoutMode } from '../ui/ViewLayoutSelect';

const TASK_LAYOUT_MODES: readonly ViewLayoutMode[] = ['table', 'cards', 'kanban', 'categories'];
const STORAGE_KEY_PREFIX = 'nh:activities:task-layout:';
const KANBAN_GROUPING_KEY_PREFIX = 'nh:activities:task-kanban-grouping:';
const LEGACY_KANBAN_GROUPING_KEY = 'nh-erp-activities-task-kanban-group-by-category';

type TaskLayoutStorage = Pick<Storage, 'getItem' | 'setItem'>;

function isViewLayoutMode(value: unknown): value is ViewLayoutMode {
  return typeof value === 'string' && TASK_LAYOUT_MODES.includes(value as ViewLayoutMode);
}

function getStorage(storage?: TaskLayoutStorage): TaskLayoutStorage | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function kanbanGroupingStorageKey(userId: string) {
  return `${KANBAN_GROUPING_KEY_PREFIX}${userId}`;
}

/** Lee la distribución preferida de la persona; el valor inicial es Lista. */
export function readTaskLayoutPreference(userId: string | null, storage?: TaskLayoutStorage): ViewLayoutMode {
  if (!userId) return 'table';

  try {
    const value = getStorage(storage)?.getItem(storageKey(userId));
    return isViewLayoutMode(value) ? value : 'table';
  } catch {
    return 'table';
  }
}

/** Guarda solo la distribución, con una clave distinta por cuenta. */
export function writeTaskLayoutPreference(userId: string | null, mode: ViewLayoutMode, storage?: TaskLayoutStorage): void {
  if (!userId || !isViewLayoutMode(mode)) return;

  try {
    getStorage(storage)?.setItem(storageKey(userId), mode);
  } catch {
    // Si el navegador bloquea localStorage, el estado en memoria sigue funcionando.
  }
}

/** Lee si el tablero se agrupa por categorías; conserva la preferencia previa global al migrar a una clave por usuario. */
export function readTaskKanbanGroupByCategoryPreference(userId: string | null, storage?: TaskLayoutStorage): boolean {
  if (!userId) return true;

  try {
    const target = getStorage(storage);
    const saved = target?.getItem(kanbanGroupingStorageKey(userId));
    if (saved === 'true' || saved === 'false') return saved === 'true';

    const legacy = target?.getItem(LEGACY_KANBAN_GROUPING_KEY);
    if (!legacy) return true;
    const parsed = JSON.parse(legacy);
    if (typeof parsed?.expiry === 'number' && Date.now() > parsed.expiry) return true;
    return typeof parsed?.value === 'boolean' ? parsed.value : true;
  } catch {
    return true;
  }
}

export type GroupableLayout = 'table' | 'cards';

const listGroupingKey = (userId: string, layout: GroupableLayout) => `nh:activities:task-${layout}-grouping:${userId}`;

/** Lista y Tarjetas agrupan por categoría salvo que la persona elija verlas juntas. */
export function readTaskGroupByCategoryPreference(userId: string | null, layout: GroupableLayout, storage?: TaskLayoutStorage): boolean {
  if (!userId) return true;
  try {
    return getStorage(storage)?.getItem(listGroupingKey(userId, layout)) !== 'false';
  } catch {
    return true;
  }
}

export function writeTaskGroupByCategoryPreference(userId: string | null, layout: GroupableLayout, groupByCategory: boolean, storage?: TaskLayoutStorage): void {
  if (!userId || typeof groupByCategory !== 'boolean') return;
  try {
    getStorage(storage)?.setItem(listGroupingKey(userId, layout), String(groupByCategory));
  } catch {
    // Si el navegador bloquea localStorage, el estado en memoria sigue funcionando.
  }
}

/** Guarda el agrupamiento del Kanban por cuenta y fuera del conjunto de cachés descartables. */
export function writeTaskKanbanGroupByCategoryPreference(userId: string | null, groupByCategory: boolean, storage?: TaskLayoutStorage): void {
  if (!userId || typeof groupByCategory !== 'boolean') return;

  try {
    getStorage(storage)?.setItem(kanbanGroupingStorageKey(userId), String(groupByCategory));
  } catch {
    // Si el navegador bloquea localStorage, el estado en memoria sigue funcionando.
  }
}
