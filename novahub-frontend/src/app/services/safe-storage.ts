const CACHE_PREFIX = 'nh-erp-';

function isCacheKey(key: string): boolean {
  return key.startsWith(CACHE_PREFIX);
}

function evictExpiredCaches(): number {
  let removed = 0;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || !isCacheKey(key)) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.expiry === 'number' && Date.now() > parsed.expiry) {
          localStorage.removeItem(key);
          removed++;
        }
      } catch {
        // Entrada corrupta: no tocar
      }
    }
  } catch {
    // Sin acceso a storage: ignorar
  }
  return removed;
}

function evictOldestCaches(keep: string | null): number {
  let removed = 0;
  try {
    const entries: { key: string; expiry: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !isCacheKey(key) || key === keep) continue;
      let expiry = 0;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        if (parsed && typeof parsed.expiry === 'number') expiry = parsed.expiry;
      } catch {
        // Sin fecha conocida: se trata como antigua
      }
      entries.push({ key, expiry });
    }
    entries.sort((a, b) => a.expiry - b.expiry);
    for (const { key } of entries) {
      try {
        localStorage.removeItem(key);
        removed++;
      } catch {
        break;
      }
    }
  } catch {
    // Sin acceso a storage: ignorar
  }
  return removed;
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    const isQuota = !!error && (error as DOMException).name === 'QuotaExceededError';
    if (!isQuota) return false;
    evictExpiredCaches();
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      evictOldestCaches(key);
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
  }
}

export function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeRemoveItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignorar
  }
}
