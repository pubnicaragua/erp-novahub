import { waitForNewBuild } from './app-version';

const BUILD_ID = __NOVAHUB_BUILD_ID__;
const RECOVERY_QUERY_PARAM = '__asset_recovery';
const RECOVERY_STORAGE_KEY = 'novahub:chunk-recovery';
const INCIDENT_STORAGE_PREFIX = 'novahub:chunk-incident:';

// La recuperación avanza por etapas dentro de una misma versión (BUILD_ID) y una ventana corta:
//   1) recargar la página con una marca nueva en la dirección;
//   2) borrar las cachés de NovaHub (el service worker puede estar sirviendo un documento viejo) y recargar;
//   3) además desregistrar el service worker, esperar a que la versión publicada cambie y recargar.
// Superadas las tres, ya no se recarga sola (evita bucles) y la pantalla de error sigue vigilando la versión.
// Una versión distinta de la que falló cuenta como éxito: su recuperación empieza de cero.
export const RECOVERY_MAX_ATTEMPTS = 3;
export const RECOVERY_WINDOW_MS = 5 * 60_000;

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
  /** Etapa de recuperación que se inicia con este incidente (1 a 3). */
  attempt?: number;
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

export function createChunkLoadIncident(moduleName: string, error: unknown, attempt?: number): ChunkLoadIncident {
  return {
    buildId: BUILD_ID,
    moduleName: moduleName.slice(0, 80),
    errorName: error instanceof Error ? error.name.slice(0, 80) : 'Error',
    errorMessage: sanitizeErrorMessage(error),
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    route: getSafeRoute(),
    occurredAt: new Date().toISOString(),
    ...(attempt === undefined ? {} : { attempt }),
  };
}

export function storePendingChunkIncident(moduleName: string, error: unknown, attempt?: number): boolean {
  try {
    const incident = createChunkLoadIncident(moduleName, error, attempt);
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

interface RecoveryMark {
  buildId: string;
  attempt: number;
  at: number;
}

function parseRecoveryMark(raw: string | null | undefined, now: number): RecoveryMark | null {
  if (!raw) return null;
  const [attemptText, atText, ...buildParts] = raw.split(':');
  const attempt = Number(attemptText);
  const at = Number(atText);
  if (Number.isInteger(attempt) && attempt > 0 && Number.isFinite(at) && buildParts.length > 0) {
    return { buildId: buildParts.join(':'), attempt, at };
  }
  // Marca de versiones anteriores: solo el identificador de la versión que falló, equivalente a un intento.
  return { buildId: raw.split(':')[0], attempt: 1, at: now };
}

/** Intentos de recuperación ya gastados por esta versión en la ventana vigente (dirección y sessionStorage). */
function recoveryAttemptsUsed(url: URL, now: number): number {
  const marks: RecoveryMark[] = [];
  const fromUrl = parseRecoveryMark(url.searchParams.get(RECOVERY_QUERY_PARAM), now);
  if (fromUrl) marks.push(fromUrl);
  try {
    const stored = JSON.parse(sessionStorage.getItem(RECOVERY_STORAGE_KEY) || 'null') as Partial<RecoveryMark> | null;
    if (stored && typeof stored.buildId === 'string' && Number.isInteger(stored.attempt) && Number.isFinite(stored.at)) {
      marks.push({ buildId: stored.buildId, attempt: stored.attempt as number, at: stored.at as number });
    }
  } catch {
    // Sin almacenamiento, la marca de la dirección es la única guarda contra un bucle de recargas.
  }
  return marks
    .filter((mark) => mark.buildId === BUILD_ID && now - mark.at <= RECOVERY_WINDOW_MS)
    .reduce((highest, mark) => Math.max(highest, mark.attempt), 0);
}

function rememberRecoveryAttempt(attempt: number, now: number): void {
  try {
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({ buildId: BUILD_ID, attempt, at: now }));
  } catch {
    // The URL marker prevents a reload loop when browser storage is unavailable.
  }
}

/**
 * Quita lo que el navegador guardó de la aplicación: las cachés de NovaHub y, si se pide, el service worker.
 * Nunca toca localStorage ni la sesión. Desregistrar el service worker también cancela la suscripción push de
 * este dispositivo (se vuelve a crear al cargar), por eso solo se hace en la última etapa o por acción manual.
 */
export async function clearClientCaches(options: { unregisterWorkers?: boolean } = {}): Promise<void> {
  const unregisterWorkers = options.unregisterWorkers ?? true;
  try {
    if (unregisterWorkers && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // La recuperación no debe fallar por una API de Service Worker limitada.
  }

  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames
        .filter((name) => name.startsWith('novahub-'))
        .map((name) => window.caches.delete(name)));
    }
  } catch {
    // La caché es opcional.
  }
}

async function replaceWithFreshDocument(target: URL, attempt: number): Promise<void> {
  try {
    if (attempt >= 2) await clearClientCaches({ unregisterWorkers: attempt >= RECOVERY_MAX_ATTEMPTS });
    // Si el servidor aún sirve la misma versión que falló, recargar traería el mismo documento: se espera a que
    // el despliegue termine de propagarse (hasta 45 s) antes de la última recarga automática.
    if (attempt >= RECOVERY_MAX_ATTEMPTS) await waitForNewBuild();
  } catch {
    // Nada de lo anterior puede impedir la recarga.
  }
  window.location.replace(target.toString());
}

// Varios módulos pueden fallar a la vez (vistas y subvistas de la misma pantalla): solo el primero inicia la
// recarga; los demás la reconocen y esperan a que el documento sea reemplazado.
let recoveryInProgress = false;

export function recoverFromChunk(
  moduleName: string,
  error?: unknown,
  reportImmediately?: (incident: ChunkLoadIncident) => void,
): boolean {
  if (recoveryInProgress) return true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;

  const url = new URL(window.location.href);
  const now = Date.now();
  const used = recoveryAttemptsUsed(url, now);
  if (used >= RECOVERY_MAX_ATTEMPTS) return false;

  const attempt = used + 1;
  recoveryInProgress = true;
  rememberRecoveryAttempt(attempt, now);

  if (error !== undefined) {
    const incident = createChunkLoadIncident(moduleName, error, attempt);
    if (!storePendingChunkIncident(moduleName, error, attempt)) {
      try {
        reportImmediately?.(incident);
      } catch {
        // Telemetry must never block the recovery navigation.
      }
    }
  }

  const target = new URL(url.toString());
  target.searchParams.set(RECOVERY_QUERY_PARAM, `${attempt}:${now}:${BUILD_ID}`);
  void replaceWithFreshDocument(target, attempt);
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
