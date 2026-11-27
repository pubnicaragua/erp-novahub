import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserViewPreferences,
  importUserViewPreferences,
  saveUserViewPreferences,
  type UserViewPreferenceScope,
  type UserViewPreferenceValues,
} from '../services/user-view-preferences.service';

const CACHE_TTL_MS = 15_000;
const CACHE_EVENT = 'novahub:user-view-preference-updated';
type CacheEntry = { preferences: UserViewPreferenceValues; hasSavedPreferences: boolean; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<CacheEntry>>();

function mergePreferences(base: UserViewPreferenceValues, patch: UserViewPreferenceValues): UserViewPreferenceValues {
  return {
    ...base,
    ...patch,
    ...(patch.accountOrders
      ? { accountOrders: { ...(base.accountOrders || {}), ...patch.accountOrders } }
      : {}),
    ...(patch.itemPositions
      ? { itemPositions: { ...(base.itemPositions || {}), ...patch.itemPositions } }
      : {}),
  };
}

function publish(key: string, entry: CacheEntry) {
  cache.set(key, entry);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CACHE_EVENT, { detail: { key, entry } }));
  }
}

export function useUserViewPreferences(
  viewKey: string | undefined,
  scope: UserViewPreferenceScope = 'company',
) {
  const { user } = useAuth();
  const resolvedScope: UserViewPreferenceScope = user?.clientTenantId ? scope : scope === 'company' ? 'personal' : scope;
  const identityKey = user?.id && (user?.clientTenantId || resolvedScope === 'personal')
    ? `${user.id}:${user.clientTenantId || 'personal'}:${resolvedScope}:${viewKey || ''}`
    : '';
  const [stateIdentityKey, setStateIdentityKey] = useState('');
  const [preferences, setPreferencesState] = useState<UserViewPreferenceValues>({});
  const [hasSavedPreferences, setHasSavedPreferences] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(identityKey && viewKey));
  const [loadError, setLoadError] = useState(false);
  const [lastSaveError, setLastSaveError] = useState(false);
  const hasCurrentIdentity = Boolean(identityKey && stateIdentityKey === identityKey);
  const currentPreferences = hasCurrentIdentity ? preferences : {};
  const currentHasSavedPreferences = hasCurrentIdentity && hasSavedPreferences;
  const currentIsLoading = Boolean(identityKey && (!hasCurrentIdentity || isLoading));
  const currentLoadError = hasCurrentIdentity && loadError;

  const load = useCallback(async (force = false) => {
    if (!identityKey || !viewKey) {
      setIsLoading(false);
      return;
    }
    const existing = cache.get(identityKey);
    if (!force && existing && Date.now() - existing.fetchedAt < CACHE_TTL_MS) {
      setStateIdentityKey(identityKey);
      setPreferencesState(existing.preferences);
      setHasSavedPreferences(existing.hasSavedPreferences);
      setLoadError(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(false);
    let request = pending.get(identityKey);
    if (!request) {
      request = getUserViewPreferences(viewKey, resolvedScope).then((response) => {
        const entry: CacheEntry = {
          preferences: response?.preferences && typeof response.preferences === 'object' ? response.preferences : {},
          hasSavedPreferences: Boolean(response?.hasSavedPreferences),
          fetchedAt: Date.now(),
        };
        cache.set(identityKey, entry);
        return entry;
      }).finally(() => pending.delete(identityKey));
      pending.set(identityKey, request);
    }
    try {
      const entry = await request;
      setStateIdentityKey(identityKey);
      setPreferencesState(entry.preferences);
      setHasSavedPreferences(entry.hasSavedPreferences);
    } catch {
      setStateIdentityKey(identityKey);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [identityKey, resolvedScope, viewKey]);

  useEffect(() => {
    void load();
    if (!identityKey || typeof window === 'undefined') return undefined;
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; entry: CacheEntry }>).detail;
      if (detail?.key !== identityKey || !detail.entry) return;
      setPreferencesState(detail.entry.preferences);
      setStateIdentityKey(identityKey);
      setHasSavedPreferences(detail.entry.hasSavedPreferences);
      setIsLoading(false);
    };
    const onFocus = () => void load(true);
    window.addEventListener(CACHE_EVENT, onUpdated);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener(CACHE_EVENT, onUpdated);
      window.removeEventListener('focus', onFocus);
    };
  }, [identityKey, load]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const clear = () => { cache.clear(); pending.clear(); };
    window.addEventListener('auth-session-reset', clear);
    return () => window.removeEventListener('auth-session-reset', clear);
  }, []);

  const save = useCallback(async (patch: UserViewPreferenceValues) => {
    // Never write defaults after a failed/incomplete read: retry the read first.
    if (!identityKey || !viewKey || currentIsLoading || currentLoadError) return false;
    const current = cache.get(identityKey) || {
      preferences: currentPreferences,
      hasSavedPreferences: currentHasSavedPreferences,
      fetchedAt: Date.now(),
    };
    const optimistic: CacheEntry = {
      preferences: mergePreferences(current.preferences, patch),
      hasSavedPreferences: true,
      fetchedAt: Date.now(),
    };
    publish(identityKey, optimistic);
    setStateIdentityKey(identityKey);
    setPreferencesState(optimistic.preferences);
    setHasSavedPreferences(true);
    setLastSaveError(false);
    try {
      const response = await saveUserViewPreferences(viewKey, resolvedScope, patch);
      const latest = cache.get(identityKey) || optimistic;
      const entry: CacheEntry = {
        preferences: mergePreferences(response?.preferences || {}, latest.preferences),
        hasSavedPreferences: true,
        fetchedAt: Date.now(),
      };
      publish(identityKey, entry);
      setPreferencesState(entry.preferences);
      return true;
    } catch {
      setLastSaveError(true);
      return false;
    }
  }, [currentHasSavedPreferences, currentIsLoading, currentLoadError, currentPreferences, identityKey, resolvedScope, scope, viewKey]);

  const importIfMissing = useCallback(async (candidate: UserViewPreferenceValues) => {
    if (!identityKey || !viewKey || currentIsLoading || currentLoadError || currentHasSavedPreferences) return false;
    try {
      const response = await importUserViewPreferences(viewKey, resolvedScope, candidate);
      const entry: CacheEntry = {
        preferences: mergePreferences(response?.preferences || {}, cache.get(identityKey)?.preferences || {}),
        hasSavedPreferences: true,
        fetchedAt: Date.now(),
      };
      publish(identityKey, entry);
      setStateIdentityKey(identityKey);
      setPreferencesState(entry.preferences);
      setHasSavedPreferences(true);
      return Boolean(response?.imported);
    } catch {
      setLastSaveError(true);
      return false;
    }
  }, [currentHasSavedPreferences, currentIsLoading, currentLoadError, identityKey, resolvedScope, scope, viewKey]);

  return useMemo(() => ({
    preferences: currentPreferences,
    hasSavedPreferences: currentHasSavedPreferences,
    isLoading: currentIsLoading,
    loadError: currentLoadError,
    lastSaveError,
    save,
    importIfMissing,
    retry: () => load(true),
  }), [currentPreferences, currentHasSavedPreferences, currentIsLoading, currentLoadError, lastSaveError, save, importIfMissing, load]);
}
