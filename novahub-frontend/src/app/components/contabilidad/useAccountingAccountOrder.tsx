import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserViewPreferences } from '../../hooks/useUserViewPreferences';

type AccountOrderMap = Record<string, string[]>;
let activeDraggedAccountId: string | null = null;

export function setActiveDraggedAccountId(accountId: string | null) {
  activeDraggedAccountId = accountId;
  if (typeof document !== 'undefined') {
    document.querySelectorAll<HTMLElement>('[data-account-order-item="true"]').forEach((element) => {
      if (accountId !== null && element.dataset.accountOrderId === accountId) {
        element.dataset.accountOrderDragging = 'true';
        element.querySelector<HTMLElement>('[draggable="true"]')?.setAttribute('aria-grabbed', 'true');
      } else {
        delete element.dataset.accountOrderDragging;
        element.querySelector<HTMLElement>('[draggable="true"]')?.removeAttribute('aria-grabbed');
      }
      if (accountId === null) delete element.dataset.accountOrderDragOver;
    });
  }
}

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
  const viewPreferences = useUserViewPreferences(`accounting.account-order.${view}`, 'branch');
  const storageKey = useMemo(
    () => `novahub:accounting:account-order:v1:${encodeURIComponent(tenantId)}:${encodeURIComponent(userId)}:${view}`,
    [tenantId, userId, view],
  );
  const [saved, setSaved] = useState(() => ({ storageKey, orders: readOrder(storageKey) }));
  const currentOrders = useMemo(
    () => {
      if (viewPreferences.preferences.accountOrders) return viewPreferences.preferences.accountOrders;
      return saved.storageKey === storageKey ? saved.orders : readOrder(storageKey);
    },
    [saved, storageKey, viewPreferences.preferences.accountOrders],
  );

  useEffect(() => {
    if (viewPreferences.isLoading || viewPreferences.loadError || viewPreferences.hasSavedPreferences) return;
    const legacy = readOrder(storageKey);
    if (Object.keys(legacy).length > 0) void viewPreferences.importIfMissing({ accountOrders: legacy });
  }, [storageKey, viewPreferences.hasSavedPreferences, viewPreferences.importIfMissing, viewPreferences.isLoading, viewPreferences.loadError]);

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
    void viewPreferences.save({ accountOrders: { [section]: uniqueIds } });
  }, [saved, storageKey, viewPreferences.save]);

  const moveToIndex = useCallback((section: string, ids: string[], fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length || fromIndex === toIndex) return;
    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    if (next.every((id, index) => id === ids[index])) return;
    save(section, next);
  }, [save]);

  return useMemo(() => ({ sort, moveToIndex }), [sort, moveToIndex]);
}

export function accountOrderDropProps(
  targetId: string,
  accountIds: string[],
  onMoveIndex: (fromIndex: number, toIndex: number) => void,
) {
  const isAccountDrag = (event: DragEvent<HTMLElement>) =>
    activeDraggedAccountId !== null || Array.from(event.dataTransfer.types).includes('text/plain');

  const moveFromPointer = (event: DragEvent<HTMLElement>) => {
    const sourceId = event.dataTransfer.getData('text/plain') || activeDraggedAccountId || '';
    const sourceIndex = accountIds.indexOf(sourceId);
    const targetIndex = accountIds.indexOf(targetId);
    if (!sourceId || sourceIndex < 0 || targetIndex < 0 || sourceId === targetId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const placeAfter = event.clientY >= rect.top + rect.height / 2;
    let nextIndex = targetIndex + (placeAfter ? 1 : 0);
    if (sourceIndex < nextIndex) nextIndex -= 1;
    nextIndex = Math.max(0, Math.min(accountIds.length - 1, nextIndex));
    onMoveIndex(sourceIndex, nextIndex);
  };

  return {
    'data-account-order-item': 'true',
    'data-account-order-id': targetId,
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      if (isAccountDrag(event)) {
        event.currentTarget.dataset.accountOrderDragOver = 'true';
      }
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (isAccountDrag(event)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.dataset.accountOrderDragOver = 'true';
        moveFromPointer(event);
      }
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        delete event.currentTarget.dataset.accountOrderDragOver;
      }
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      moveFromPointer(event);
      delete event.currentTarget.dataset.accountOrderDragOver;
      setActiveDraggedAccountId(null);
    },
  };
}
