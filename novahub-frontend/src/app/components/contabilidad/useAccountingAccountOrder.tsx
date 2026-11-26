import { useCallback, useMemo, useState, type DragEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

type AccountOrderMap = Record<string, string[]>;

function readOrder(key: string): AccountOrderMap {
  if (typeof window === 'undefined') return {};
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].every((id) => typeof id === 'string')),
    );
  } catch {
    return {};
  }
}

export function useAccountingAccountOrder(view: string) {
  const { user } = useAuth();
  const tenantId = user?.clientTenantId || user?.tenantId || 'current';
  const userId = user?.id || 'anonymous';
  const storageKey = useMemo(
    () => `novahub:accounting:account-order:v1:${encodeURIComponent(tenantId)}:${encodeURIComponent(userId)}:${view}`,
    [tenantId, userId, view],
  );
  const [saved, setSaved] = useState(() => ({ storageKey, orders: readOrder(storageKey) }));
  const currentOrders = useMemo(
    () => saved.storageKey === storageKey ? saved.orders : readOrder(storageKey),
    [saved, storageKey],
  );

  const sort = useCallback(<T,>(section: string, items: T[], getId: (item: T) => string): T[] => {
    const saved = currentOrders[section] || [];
    if (!saved.length || items.length < 2) return items;
    const rank = new Map(saved.map((id, index) => [id, index]));
    return items
      .map((item, index) => ({ item, index, rank: rank.get(getId(item)) }))
      .sort((a, b) => {
        if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
        if (a.rank !== undefined) return -1;
        if (b.rank !== undefined) return 1;
        return a.index - b.index;
      })
      .map(({ item }) => item);
  }, [currentOrders]);

  const save = useCallback((section: string, ids: string[]) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    const base = saved.storageKey === storageKey ? saved.orders : readOrder(storageKey);
    const next = { ...base, [section]: uniqueIds };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Keep the in-memory order if the browser blocks storage.
    }
    setSaved({ storageKey, orders: next });
  }, [saved, storageKey]);

  const moveToIndex = useCallback((section: string, ids: string[], fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length || fromIndex === toIndex) return;
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    save(section, next);
  }, [save]);

  const moveBefore = useCallback((section: string, ids: string[], sourceId: string, targetId: string) => {
    const fromIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || targetIndex < 0 || fromIndex === targetIndex) return;
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(next.indexOf(targetId), 0, moved);
    save(section, next);
  }, [save]);

  return useMemo(() => ({ sort, moveToIndex, moveBefore }), [sort, moveToIndex, moveBefore]);
}

export function accountOrderDropProps(
  targetId: string,
  onMoveBefore: (sourceId: string, targetId: string) => void,
) {
  return {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (Array.from(event.dataTransfer.types).includes('text/plain')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      const sourceId = event.dataTransfer.getData('text/plain');
      if (!sourceId || sourceId === targetId) return;
      event.preventDefault();
      onMoveBefore(sourceId, targetId);
    },
  };
}
