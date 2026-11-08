// Versión de la aplicación en ejecución frente a la publicada.
//
// Cada despliegue de Vercel reemplaza los archivos de /assets/ del dominio de producción: una pestaña que
// siguió abierta con la versión anterior ya no encuentra sus módulos («Failed to fetch dynamically imported
// module»). Aquí se consulta /version.json (que se genera en cada compilación) para detectar esa diferencia
// a tiempo, avisar al usuario y permitir que la recuperación espere a que la versión nueva esté disponible.

const BUILD_ID = __NOVAHUB_BUILD_ID__;

export const VERSION_FILE_PATH = '/version.json';
export const VERSION_CHECK_INTERVAL_MS = 5 * 60_000;
export const VERSION_CHECK_MIN_GAP_MS = 60_000;
export const NEW_BUILD_WAIT_MS = 45_000;
export const NEW_BUILD_POLL_MS = 3_000;

export function currentBuildId(): string {
  return BUILD_ID;
}

/** Las compilaciones locales (`local-<fecha>`) no se publican, así que no tienen con qué compararse. */
export function isComparableBuildId(buildId: string): boolean {
  return Boolean(buildId) && !buildId.startsWith('local-');
}

/** Identificador de la versión publicada, o null si no se pudo consultar (sin red, archivo ausente, etc.). */
export async function fetchLatestBuildId(fetchImpl?: typeof fetch): Promise<string | null> {
  try {
    const request = fetchImpl ?? fetch;
    const response = await request(`${VERSION_FILE_PATH}?cb=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { buildId?: unknown };
    return typeof body.buildId === 'string' && body.buildId.trim() ? body.buildId.trim() : null;
  } catch {
    return null;
  }
}

interface WaitForNewBuildOptions {
  timeoutMs?: number;
  pollMs?: number;
  fetchLatest?: () => Promise<string | null>;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Espera a que se publique una versión distinta de la que corre esta pestaña. Sirve para el caso en que el
 * despliegue todavía se está propagando: recargar antes de tiempo traería otra vez el mismo documento.
 * Devuelve el identificador nuevo, o null si se agotó el tiempo.
 */
export async function waitForNewBuild(options: WaitForNewBuildOptions = {}): Promise<string | null> {
  const timeoutMs = options.timeoutMs ?? NEW_BUILD_WAIT_MS;
  const pollMs = options.pollMs ?? NEW_BUILD_POLL_MS;
  const fetchLatest = options.fetchLatest ?? (() => fetchLatestBuildId());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let waited = 0;
  for (;;) {
    const latest = await fetchLatest();
    if (latest && latest !== BUILD_ID) return latest;
    if (waited >= timeoutMs) return null;
    await sleep(pollMs);
    waited += pollMs;
  }
}

let availableBuildId: string | null = null;
const listeners = new Set<() => void>();

/** Versión publicada más reciente cuando es distinta de la que corre esta pestaña; null si está al día. */
export function getAvailableBuildId(): string | null {
  return availableBuildId;
}

export function subscribeAvailableBuild(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function checkForNewBuild(fetchLatest: () => Promise<string | null> = () => fetchLatestBuildId()): Promise<string | null> {
  if (!isComparableBuildId(BUILD_ID)) return null;
  const latest = await fetchLatest();
  // Si no se pudo consultar se conserva lo último que se supo: un fallo de red no borra un aviso vigente.
  if (latest === null) return availableBuildId;
  const next = latest !== BUILD_ID ? latest : null;
  if (next !== availableBuildId) {
    availableBuildId = next;
    listeners.forEach((listener) => listener());
  }
  return next;
}

/**
 * Consulta la versión publicada con poca frecuencia: cada 5 minutos con la pestaña visible, y al volver a ella
 * o recuperar la conexión (con un mínimo de un minuto entre consultas). Devuelve la función que lo detiene.
 */
export function startVersionWatcher(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !isComparableBuildId(BUILD_ID)) {
    return () => undefined;
  }

  let lastCheckAt = Date.now();
  const run = () => {
    if (document.visibilityState === 'hidden') return;
    const now = Date.now();
    if (now - lastCheckAt < VERSION_CHECK_MIN_GAP_MS) return;
    lastCheckAt = now;
    void checkForNewBuild();
  };

  const interval = window.setInterval(run, VERSION_CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', run);
  window.addEventListener('focus', run);
  window.addEventListener('online', run);
  return () => {
    window.clearInterval(interval);
    document.removeEventListener('visibilitychange', run);
    window.removeEventListener('focus', run);
    window.removeEventListener('online', run);
  };
}
