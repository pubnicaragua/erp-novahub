const BUILD_ID = __NOVAHUB_BUILD_ID__;
const RECOVERY_QUERY_PARAM = '__asset_recovery';
const RECOVERY_STORAGE_KEY = `novahub:chunk-recovery:${BUILD_ID}`;
const INCIDENT_STORAGE_PREFIX = 'novahub:chunk-incident:';

const DYNAMIC_IMPORT_ERROR =
  /failed to fetch dynamically imported module|importing a module script failed|failed to load module script|unable to preload css|failed to preload css|chunkloaderror|loading chunk [\w-]+ failed/i;

export interface ChunkLoadIncident {
  buildId: string;
  moduleName: string;
  errorName: string;
  errorMessage: string;
  online: boolean | null;
  route: string;
  occurredAt: string;
}

export function isDynamicImportLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return DYNAMIC_IMPORT_ERROR.test(message);
}

function getSafeRoute(): string {
  try {
    const url = new URL(window.location.href);
    const safeParams = new URLSearchParams();
    for (const key of ['m', 'sm']) {
      const value = url.searchParams.get(key);
      if (value) safeParams.set(key, value);
    }
    const query = safeParams.toString();
    return `${url.pathname}${query ? `?${query}` : ''}`;
  } catch {
    return '/';
  }
}

function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown asset load error');
  return message
    .replace(/https?:\/\/[^\s"')]+/gi, (value) => {
      try {
        const url = new URL(value);
        return `${url.origin}${url.pathname}`;
      } catch {
        return '[asset-url]';
      }
    })
    .slice(0, 500);
}

export function createChunkLoadIncident(moduleName: string, error: unknown): ChunkLoadIncident {
  return {
    buildId: BUILD_ID,
    moduleName: moduleName.slice(0, 80),
    errorName: error instanceof Error ? error.name.slice(0, 80) : 'Error',
    errorMessage: sanitizeErrorMessage(error),
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    route: getSafeRoute(),
    occurredAt: new Date().toISOString(),
  };
}

export function storePendingChunkIncident(moduleName: string, error: unknown): boolean {
  try {
    const incident = createChunkLoadIncident(moduleName, error);
    sessionStorage.setItem(`${INCIDENT_STORAGE_PREFIX}${BUILD_ID}`, JSON.stringify(incident));
    return true;
  } catch {
    return false;
  }
}

export function flushPendingChunkIncident(report: (incident: ChunkLoadIncident) => void): boolean {
  let pending: Array<{ key: string; incident: ChunkLoadIncident }>;
  try {
    pending = [];
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (!key?.startsWith(INCIDENT_STORAGE_PREFIX)) continue;
      const value = sessionStorage.getItem(key);
      if (!value) continue;
      const incident = JSON.parse(value) as ChunkLoadIncident;
      if (!incident.buildId || !incident.moduleName || !incident.errorMessage) continue;
      pending.push({ key, incident });
    }

  } catch {
    return false;
  }

  for (const { key, incident } of pending) {
    try {
      report(incident);
      sessionStorage.removeItem(key);
    } catch {
      // Keep this incident queued if telemetry could not accept it.
      return false;
    }
  }
  return pending.length > 0;
}

export function recoverFromChunk(
  moduleName: string,
  error?: unknown,
  reportImmediately?: (incident: ChunkLoadIncident) => void,
): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  const url = new URL(window.location.href);
  const currentAttempt = url.searchParams.get(RECOVERY_QUERY_PARAM);
  if (currentAttempt === BUILD_ID || currentAttempt?.startsWith(`${BUILD_ID}:`)) return false;

  try {
    const previousAttempt = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (previousAttempt === BUILD_ID || previousAttempt?.startsWith(`${BUILD_ID}:`)) return false;
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, BUILD_ID);
  } catch {
    // The URL marker prevents a reload loop when browser storage is unavailable.
  }

  if (error !== undefined) {
    const incident = createChunkLoadIncident(moduleName, error);
    if (!storePendingChunkIncident(moduleName, error)) {
      try {
        reportImmediately?.(incident);
      } catch {
        // Telemetry must never block the recovery navigation.
      }
    }
  }

  url.searchParams.set(RECOVERY_QUERY_PARAM, BUILD_ID);
  window.location.replace(url.toString());
  return true;
}

export async function loadModuleWithChunkRecovery<T>(
  loader: () => Promise<T>,
  moduleName: string,
  reportImmediately?: (incident: ChunkLoadIncident) => void,
): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (!isDynamicImportLoadError(error)) throw error;

    const recovered = recoverFromChunk(moduleName, error, reportImmediately);
    if (!recovered) throw error;

    // Keep React.Suspense visible until the browser replaces this document.
    return await new Promise<T>(() => undefined);
  }
}
