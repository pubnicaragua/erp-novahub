import { safeGetItem, safeRemoveItem, safeSetItem } from './safe-storage';

export const SALES_EDITOR_DRAFT_PREFIX = 'novahub:sales-draft:';

export type SalesEditorDraftSnapshot<T> = {
  version: 1;
  savedAt: number;
  editingId: string | null;
  isCreating?: boolean;
  document: T | null;
  metadata?: Record<string, unknown>;
};

export function getSalesEditorDraftKey(
  moduleName: string,
  tenantId?: string | null,
  userId?: string | null,
) {
  if (!tenantId || !userId) return null;
  return `${SALES_EDITOR_DRAFT_PREFIX}${moduleName}:${tenantId}:${userId}`;
}

export function readSalesEditorDraft<T>(key: string | null): SalesEditorDraftSnapshot<T> | null {
  if (!key) return null;
  try {
    const parsed = JSON.parse(safeGetItem(key) || 'null');
    if (!parsed || parsed.version !== 1 || typeof parsed.savedAt !== 'number') return null;
    return parsed as SalesEditorDraftSnapshot<T>;
  } catch {
    return null;
  }
}

export function writeSalesEditorDraft<T>(key: string | null, snapshot: Omit<SalesEditorDraftSnapshot<T>, 'version' | 'savedAt'>) {
  if (!key) return false;
  return safeSetItem(key, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    ...snapshot,
  }));
}

export function clearSalesEditorDraft(key: string | null) {
  if (key) safeRemoveItem(key);
}
