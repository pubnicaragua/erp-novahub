const BUILD_ID = __NOVAHUB_BUILD_ID__;
const RECOVERY_QUERY_PARAM = '__asset_recovery';
const RECOVERY_STORAGE_KEY_PREFIX = 'novahub:chunk-recovery:';
const RECOVERY_STORAGE_KEY = `${RECOVERY_STORAGE_KEY_PREFIX}${BUILD_ID}`;
const RECOVERY_TOKEN_PREFIX = `${BUILD_ID}:`;

const DYNAMIC_IMPORT_ERROR =
  /failed to fetch dynamically imported module|importing a module script failed|failed to load module script|unable to preload css|failed to preload css|chunkloaderror|loading chunk [\w-]+ failed/i;

export function isDynamicImportLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return DYNAMIC_IMPORT_ERROR.test(message);
}

export function recoverFromChunk(moduleName: string): boolean {
  const url = new URL(window.location.href);
  const currentAttempt = url.searchParams.get(RECOVERY_QUERY_PARAM);

  if (currentAttempt?.startsWith(RECOVERY_TOKEN_PREFIX)) return false;

  let storageAvailable = false;
  try {
    if (sessionStorage.getItem(RECOVERY_STORAGE_KEY)) return false;
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, `${RECOVERY_TOKEN_PREFIX}${moduleName}`);
    storageAvailable = sessionStorage.getItem(RECOVERY_STORAGE_KEY) === `${RECOVERY_TOKEN_PREFIX}${moduleName}`;
  } catch {
    // The URL marker still prevents a reload loop if browser storage is unavailable.
  }

  if (!storageAvailable) {
    url.searchParams.set(RECOVERY_QUERY_PARAM, `${RECOVERY_TOKEN_PREFIX}${moduleName}`);
  }
  window.location.replace(url.toString());
  return true;
}

export function clearChunkRecovery(): void {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(RECOVERY_STORAGE_KEY_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // Storage is optional; successful module loading must not depend on it.
  }

  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RECOVERY_QUERY_PARAM)) return;

    url.searchParams.delete(RECOVERY_QUERY_PARAM);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
  } catch {
    // URL cleanup is best-effort and must not turn a successful import into a failure.
  }
}

export async function loadModuleWithChunkRecovery<T>(loader: () => Promise<T>, moduleName: string): Promise<T> {
  try {
    const module = await loader();
    clearChunkRecovery();
    return module;
  } catch (error) {
    if (isDynamicImportLoadError(error)) recoverFromChunk(moduleName);
    throw error;
  }
}

export function installVitePreloadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (recoverFromChunk('vite-preload')) event.preventDefault();
  });
}
