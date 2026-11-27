import { useCallback, useEffect, useState } from 'react';
import { useUserViewPreferences } from './useUserViewPreferences';
import type { SavedLayoutMode, UserViewPreferenceScope } from '../services/user-view-preferences.service';

export type UserSelectableLayoutMode = 'table' | 'cards';

export function useUserViewLayoutMode(
  viewKey: string | undefined,
  scope: UserViewPreferenceScope = 'company',
  defaultMode: UserSelectableLayoutMode = 'table',
) {
  const preferences = useUserViewPreferences(viewKey, scope);
  const [mode, setMode] = useState<UserSelectableLayoutMode>(defaultMode);

  useEffect(() => {
    if (preferences.isLoading || preferences.loadError) return;
    setMode(preferences.preferences.layoutMode === 'cards' ? 'cards' : defaultMode);
  }, [defaultMode, preferences.isLoading, preferences.loadError, preferences.preferences.layoutMode]);

  const updateMode = useCallback((nextMode: UserSelectableLayoutMode | SavedLayoutMode) => {
    const normalized: UserSelectableLayoutMode = nextMode === 'cards' ? 'cards' : 'table';
    setMode(normalized);
    void preferences.save({ layoutMode: normalized });
  }, [preferences.save]);

  return {
    mode: preferences.isLoading || preferences.loadError ? defaultMode : mode,
    setMode: updateMode,
    preferences,
  };
}
