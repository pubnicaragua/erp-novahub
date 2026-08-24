import { safeGetItem, safeSetItem } from '../services/safe-storage';

const ERP_THEME_MODE_KEY = 'erp-theme-mode';
const MANAGER_THEME_KEY = 'novahub:manager-theme';

/** Reads the one persisted light/dark preference used by every shell. */
export function readPersistedDarkMode(): boolean {
  const explicit = safeGetItem(ERP_THEME_MODE_KEY);
  if (explicit === 'dark') return true;
  if (explicit === 'light') return false;

  try {
    const managerTheme = JSON.parse(safeGetItem(MANAGER_THEME_KEY) || 'null') as { mode?: string } | null;
    if (managerTheme?.mode === 'dark') return true;
    if (managerTheme?.mode === 'light') return false;
  } catch {
    // A corrupt optional theme preference must never force dark mode.
  }

  return false;
}

/** Persists the mode shared by the normal shell and Manager shell. */
export function persistThemeMode(isDark: boolean): void {
  safeSetItem(ERP_THEME_MODE_KEY, isDark ? 'dark' : 'light');

  try {
    const saved = JSON.parse(safeGetItem(MANAGER_THEME_KEY) || 'null') as Record<string, unknown> | null;
    if (saved) safeSetItem(MANAGER_THEME_KEY, JSON.stringify({ ...saved, mode: isDark ? 'dark' : 'light' }));
  } catch {
    // Theme persistence is best effort and must not block navigation.
  }
}
