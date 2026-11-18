import type { ViewLayoutMode } from '../ui/ViewLayoutSelect';

const TASK_LAYOUT_MODES: readonly ViewLayoutMode[] = ['table', 'cards', 'kanban', 'categories'];
const STORAGE_KEY_PREFIX = 'nh:activities:task-layout:';

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
