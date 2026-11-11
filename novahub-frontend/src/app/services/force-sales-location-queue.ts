import { normalizeApiErrorMessage } from './api';

export type LocationQueueIdentity = {
  userId: string;
  tenantId: string;
};

export type LocationQueuePoint = {
  eventId: string;
  capturedAt: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
};

export type LocationQueueStatus = {
  pending: number;
  lastCapturedAt: string | null;
  lastSyncedAt: string | null;
};

type QueueRecord = LocationQueuePoint & { key: string; scopeKey: string; storedAt: string };
type SessionRecord = {
  scopeKey: string;
  userId: string;
  tenantId: string;
  apiBase: string;
  accessToken: string | null;
  active: boolean;
  lastCapturedAt: string | null;
  lastSyncedAt: string | null;
};

type TrackingLeaseRecord = {
  scopeKey: string;
  ownerId: string;
  expiresAt: number;
};

const DATABASE_NAME = 'novahub-force-sales-location-v1';
const DATABASE_VERSION = 2;
const POINTS_STORE = 'points';
const SESSIONS_STORE = 'sessions';
const TRACKING_LEASES_STORE = 'trackingLeases';
const TRACKING_LEASE_TTL_MS = 30_000;
const SYNC_TAG = 'novahub-force-sales-location-points';
const OFFLINE_ROUTE_KEY = 'novaForceSalesOfflineRouteV1';
const OFFLINE_ROUTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BATCH_SIZE = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const flushes = new Map<string, Promise<boolean>>();
const retryAttempts = new Map<string, number>();
/** Un solo temporizador de reintento por sesión: antes cada fallo agregaba uno nuevo y los anteriores seguían vivos. */
const retryTimers = new Map<string, number>();
const nextAttemptAt = new Map<string, number>();
export const MAX_LOCATION_ACCURACY_METERS = 10_000;
/** Tope de puntos pendientes por sesión y antigüedad máxima: una cola atascada no puede crecer sin límite en el teléfono. */
export const MAX_QUEUED_POINTS = 5_000;
export const MAX_QUEUED_POINT_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const BASE_RETRY_MS = 30_000;
const MAX_RETRY_MS = 15 * 60 * 1000;

/**
 * Deja solo los campos que el servidor acepta y descarta el punto si nunca podría guardarse (coordenadas o fecha
 * inválidas). Una precisión fuera de rango (GPS por IP de decenas de kilómetros) no invalida el punto: solo se omite.
 */
export function sanitizeLocationPoint(value: unknown): LocationQueuePoint | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const eventId = String(raw.eventId ?? '');
  const capturedMs = new Date(String(raw.capturedAt ?? '')).getTime();
  const lat = typeof raw.lat === 'number' ? raw.lat : Number.NaN;
  const lng = typeof raw.lng === 'number' ? raw.lng : Number.NaN;
  if (!UUID_PATTERN.test(eventId) || !Number.isFinite(capturedMs)) return null;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return null;
  const { accuracy, heading } = raw;
  return {
    eventId,
    capturedAt: new Date(capturedMs).toISOString(),
    lat,
    lng,
    ...(typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MAX_LOCATION_ACCURACY_METERS ? { accuracy } : {}),
    ...(typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? { heading } : {}),
  };
}

/** Espera antes del siguiente reintento: 30 s, 60 s, 2 min… hasta 15 min, con ±20 % de variación para no sincronizar equipos. */
export function retryDelayMs(attempt: number, random: () => number = Math.random): number {
  const base = Math.min(BASE_RETRY_MS * 2 ** (Math.max(1, attempt) - 1), MAX_RETRY_MS);
  return Math.round(base * (0.8 + random() * 0.4));
}

/** Qué puntos sobran de una cola: los demasiado viejos y, si aún son demasiados, los más antiguos. */
export function selectPointsToPrune<T extends { key: string; capturedAt: string }>(points: T[], now = Date.now()): string[] {
  const sorted = [...points].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const stale = new Set(sorted.filter((point) => now - Date.parse(point.capturedAt) > MAX_QUEUED_POINT_AGE_MS).map((point) => point.key));
  const fresh = sorted.filter((point) => !stale.has(point.key));
  const overflow = fresh.slice(0, Math.max(0, fresh.length - MAX_QUEUED_POINTS)).map((point) => point.key);
  return [...stale, ...overflow];
}

export function createLocationEventId() {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(bytes);
  else bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function locationScopeKey(identity: LocationQueueIdentity) {
  return `${identity.tenantId}:${identity.userId}`;
}

export async function acquireLocationTrackingLease(
  identity: LocationQueueIdentity,
  ownerId: string,
  now = Date.now(),
) {
  if (!ownerId) return false;
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction(TRACKING_LEASES_STORE, 'readwrite');
    const store = transaction.objectStore(TRACKING_LEASES_STORE);
    const request = store.get(scopeKey);
    let acquired = false;
    request.onsuccess = () => {
      const existing = request.result as TrackingLeaseRecord | undefined;
      if (existing && existing.ownerId !== ownerId && existing.expiresAt > now) return;
      store.put({ scopeKey, ownerId, expiresAt: now + TRACKING_LEASE_TTL_MS } satisfies TrackingLeaseRecord);
      acquired = true;
    };
    await transactionDone(transaction);
    return acquired;
  } finally {
    database.close();
  }
}

export async function renewLocationTrackingLease(
  identity: LocationQueueIdentity,
  ownerId: string,
  now = Date.now(),
) {
  if (!ownerId) return false;
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction(TRACKING_LEASES_STORE, 'readwrite');
    const store = transaction.objectStore(TRACKING_LEASES_STORE);
    const request = store.get(scopeKey);
    let renewed = false;
    request.onsuccess = () => {
      const existing = request.result as TrackingLeaseRecord | undefined;
      if (!existing || existing.ownerId !== ownerId || existing.expiresAt <= now) return;
      store.put({ ...existing, expiresAt: now + TRACKING_LEASE_TTL_MS });
      renewed = true;
    };
    await transactionDone(transaction);
    return renewed;
  } finally {
    database.close();
  }
}

export async function releaseLocationTrackingLease(identity: LocationQueueIdentity, ownerId: string) {
  if (!ownerId) return;
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction(TRACKING_LEASES_STORE, 'readwrite');
    const store = transaction.objectStore(TRACKING_LEASES_STORE);
    const request = store.get(scopeKey);
    request.onsuccess = () => {
      const existing = request.result as TrackingLeaseRecord | undefined;
      if (existing?.ownerId === ownerId) store.delete(scopeKey);
    };
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export function persistOfflineRouteEligibility(identity: LocationQueueIdentity) {
  try {
    const previous = JSON.parse(localStorage.getItem(OFFLINE_ROUTE_KEY) || 'null') as (LocationQueueIdentity & { startedAt?: number; expiresAt?: number }) | null;
    const sameIdentity = previous?.userId === identity.userId && previous?.tenantId === identity.tenantId;
    localStorage.setItem(OFFLINE_ROUTE_KEY, JSON.stringify({
      ...identity,
      startedAt: sameIdentity ? previous?.startedAt || Date.now() : Date.now(),
      expiresAt: Date.now() + OFFLINE_ROUTE_MAX_AGE_MS,
    }));
  } catch {
    // La elegibilidad solo permite abrir el capturador restringido tras un corte.
    // Si localStorage no está disponible, el seguimiento autenticado sigue funcionando.
  }
}

export function getOfflineRouteEligibility(): LocationQueueIdentity | null {
  try {
    const record = JSON.parse(localStorage.getItem(OFFLINE_ROUTE_KEY) || 'null') as (LocationQueueIdentity & { expiresAt?: number }) | null;
    if (!record?.userId || !record?.tenantId || !Number.isFinite(record.expiresAt) || Number(record.expiresAt) < Date.now()) {
      localStorage.removeItem(OFFLINE_ROUTE_KEY);
      return null;
    }
    return { userId: record.userId, tenantId: record.tenantId };
  } catch {
    return null;
  }
}

export function clearOfflineRouteEligibility(identity?: LocationQueueIdentity) {
  try {
    if (!identity) {
      localStorage.removeItem(OFFLINE_ROUTE_KEY);
      return;
    }
    const current = getOfflineRouteEligibility();
    if (current && locationScopeKey(current) === locationScopeKey(identity)) localStorage.removeItem(OFFLINE_ROUTE_KEY);
  } catch {
    // Ignore unavailable localStorage; no authenticated session is granted here.
  }
}
function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo leer IndexedDB.'));
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar en IndexedDB.'));
    transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar en IndexedDB.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) return Promise.reject(new Error('Este navegador no permite guardar la ruta sin conexión.'));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(POINTS_STORE)) {
        const points = database.createObjectStore(POINTS_STORE, { keyPath: 'key' });
        points.createIndex('byScope', 'scopeKey', { unique: false });
      }
      if (!database.objectStoreNames.contains(SESSIONS_STORE)) {
        database.createObjectStore(SESSIONS_STORE, { keyPath: 'scopeKey' });
      }
      if (!database.objectStoreNames.contains(TRACKING_LEASES_STORE)) {
        database.createObjectStore(TRACKING_LEASES_STORE, { keyPath: 'scopeKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas de NovaHub para actualizar el almacenamiento local.'));
  });
}

export async function requestLocationStoragePersistence() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // El navegador puede rechazar la persistencia; IndexedDB sigue funcionando
    // mientras el espacio de almacenamiento asignado no sea desalojado.
  }
}

export async function activateLocationQueueSession(
  identity: LocationQueueIdentity,
  apiBase: string,
  accessToken: string,
) {
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction([SESSIONS_STORE, POINTS_STORE], 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.get(scopeKey);
    const pointsRequest = transaction.objectStore(POINTS_STORE).index('byScope').getAll(IDBKeyRange.only(scopeKey));
    let existing: SessionRecord | undefined;
    let queuedPoints: QueueRecord[] = [];
    let hasExisting = false;
    let hasQueuedPoints = false;
    const persistSession = () => {
      if (!hasExisting || !hasQueuedPoints) return;
      const latestQueuedCapture = queuedPoints.reduce<string | null>(
        (latest, point) => !latest || point.capturedAt > latest ? point.capturedAt : latest,
        null,
      );
      store.put({
        scopeKey,
        ...identity,
        apiBase: apiBase.replace(/\/$/, ''),
        accessToken,
        active: true,
        lastCapturedAt: existing?.lastCapturedAt || latestQueuedCapture,
        lastSyncedAt: existing?.lastSyncedAt || null,
      } satisfies SessionRecord);
    };
    request.onsuccess = () => {
      existing = request.result as SessionRecord | undefined;
      hasExisting = true;
      persistSession();
    };
    pointsRequest.onsuccess = () => {
      queuedPoints = pointsRequest.result as QueueRecord[];
      hasQueuedPoints = true;
      persistSession();
    };
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function deactivateLocationQueueSession(identity: LocationQueueIdentity, clearToken = true) {
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction(SESSIONS_STORE, 'readwrite');
    const store = transaction.objectStore(SESSIONS_STORE);
    const request = store.get(scopeKey);
    request.onsuccess = () => {
      const existing = request.result as SessionRecord | undefined;
      if (existing) store.put({ ...existing, active: false, accessToken: clearToken ? null : existing.accessToken });
    };
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function saveLocationPoint(
  identity: LocationQueueIdentity,
  rawPoint: LocationQueuePoint,
  leaseOwnerId?: string,
  isCurrent?: () => boolean,
) {
  // Un punto que el servidor nunca podría guardar no entra a la cola (atascaría todos los siguientes).
  const point = sanitizeLocationPoint(rawPoint);
  if (!point) return;
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const stores = leaseOwnerId
      ? [POINTS_STORE, SESSIONS_STORE, TRACKING_LEASES_STORE]
      : [POINTS_STORE, SESSIONS_STORE];
    const transaction = database.transaction(stores, 'readwrite');
    let rejectedLease = false;
    const persistPoint = () => {
      transaction.objectStore(POINTS_STORE).put({
        ...point,
        key: `${scopeKey}:${point.eventId}`,
        scopeKey,
        storedAt: new Date().toISOString(),
      } satisfies QueueRecord);
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      const sessionRequest = sessionStore.get(scopeKey);
      sessionRequest.onsuccess = () => {
        const session = sessionRequest.result as SessionRecord | undefined;
        if (session && (!session.lastCapturedAt || point.capturedAt > session.lastCapturedAt)) {
          sessionStore.put({ ...session, lastCapturedAt: point.capturedAt });
        }
      };
    };
    if (leaseOwnerId) {
      const leaseRequest = transaction.objectStore(TRACKING_LEASES_STORE).get(scopeKey);
      leaseRequest.onsuccess = () => {
        const lease = leaseRequest.result as TrackingLeaseRecord | undefined;
        if (isCurrent?.() === false || !lease || lease.ownerId !== leaseOwnerId || lease.expiresAt <= Date.now()) {
          rejectedLease = true;
          transaction.abort();
          return;
        }
        persistPoint();
      };
    } else {
      persistPoint();
    }
    try {
      await transactionDone(transaction);
    } catch (error) {
      if (rejectedLease) throw new Error('La captura perdió vigencia o la lease del seguimiento; no se guardó el punto.', { cause: error });
      throw error;
    }
  } finally {
    database.close();
  }
  registerBackgroundSync();
}

export async function getLocationQueueStatus(identity: LocationQueueIdentity): Promise<LocationQueueStatus> {
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction([POINTS_STORE, SESSIONS_STORE], 'readonly');
    // Se cuenta con el índice en vez de leer todos los puntos: este estado se consulta tras cada punto guardado.
    const countRequest = transaction.objectStore(POINTS_STORE).index('byScope').count(IDBKeyRange.only(scopeKey));
    const sessionRequest = transaction.objectStore(SESSIONS_STORE).get(scopeKey);
    const [pending, session] = await Promise.all([
      requestResult(countRequest) as Promise<number>,
      requestResult(sessionRequest) as Promise<SessionRecord | undefined>,
    ]);
    let lastCapturedAt = session?.lastCapturedAt || null;
    if (!lastCapturedAt && pending > 0) {
      const records = await requestResult(database.transaction(POINTS_STORE, 'readonly').objectStore(POINTS_STORE).index('byScope').getAll(IDBKeyRange.only(scopeKey))) as QueueRecord[];
      lastCapturedAt = records.reduce<string | null>((latest, item) => !latest || item.capturedAt > latest ? item.capturedAt : latest, null);
    }
    return { pending, lastCapturedAt, lastSyncedAt: session?.lastSyncedAt || null };
  } finally {
    database.close();
  }
}

function registerBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  void navigator.serviceWorker.ready.then((registration) => {
    const syncRegistration = registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } };
    return syncRegistration.sync?.register(SYNC_TAG);
  }).catch(() => undefined);
}

async function deleteQueuedPoints(keys: string[]) {
  if (!keys.length) return;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(POINTS_STORE, 'readwrite');
    const store = transaction.objectStore(POINTS_STORE);
    for (const key of keys) store.delete(key);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

async function sendBatch(session: SessionRecord, points: QueueRecord[]) {
  if (!session.accessToken || !session.active) return false;
  const normalizedPoints = await normalizeLegacyEventIds(points);
  // Lo que el servidor nunca podría guardar se descarta aquí: un solo punto inválido atascaba la cola para siempre.
  const sendable: Array<{ record: QueueRecord; clean: LocationQueuePoint }> = [];
  const impossible: QueueRecord[] = [];
  for (const record of normalizedPoints) {
    const clean = sanitizeLocationPoint(record);
    if (clean) sendable.push({ record, clean });
    else impossible.push(record);
  }
  if (impossible.length) await deleteQueuedPoints(impossible.map((record) => record.key));
  if (!sendable.length) return true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${session.apiBase}/force-sales/location-points/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ points: sendable.map(({ clean }) => clean) }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      await deactivateLocationQueueSession({ userId: session.userId, tenantId: session.tenantId });
      clearRetry(session.scopeKey);
      return false;
    }
    if (!response.ok) {
      const detail = await response.clone().json().catch(() => null) as { message?: unknown } | null;
      const serverMessage = Array.isArray(detail?.message) ? detail.message.join('; ') : detail?.message;
      const safeMessage = typeof serverMessage === 'string' ? serverMessage.slice(0, 240) : '';
      throw new Error(normalizeApiErrorMessage(safeMessage, response.status, 'sincronizar los puntos de ubicación'));
    }
    const result = await response.json() as { acceptedIds?: string[]; rejectedIds?: string[] };
    const accepted = new Set(Array.isArray(result.acceptedIds) ? result.acceptedIds : []);
    // Los puntos que el servidor rechazó por inválidos tampoco se reintentan: reenviarlos solo repetiría el rechazo.
    const rejected = new Set(Array.isArray(result.rejectedIds) ? result.rejectedIds : []);
    if (!accepted.size && !rejected.size) throw new Error('El servidor no confirmó los puntos guardados.');

    const database = await openDatabase();
    try {
      const transaction = database.transaction([POINTS_STORE, SESSIONS_STORE], 'readwrite');
      const pointStore = transaction.objectStore(POINTS_STORE);
      for (const { record } of sendable) if (accepted.has(record.eventId) || rejected.has(record.eventId)) pointStore.delete(record.key);
      const sessionStore = transaction.objectStore(SESSIONS_STORE);
      const sessionRequest = sessionStore.get(session.scopeKey);
      sessionRequest.onsuccess = () => {
        const current = sessionRequest.result as SessionRecord | undefined;
        if (current?.active) sessionStore.put({ ...current, lastSyncedAt: new Date().toISOString() });
      };
      await transactionDone(transaction);
    } finally {
      database.close();
    }
    return true;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function normalizeLegacyEventIds(points: QueueRecord[]) {
  const normalized = points.map((point) => ({ ...point }));
  const changed = normalized.some((point) => !UUID_PATTERN.test(String(point.eventId || '')));
  if (!changed) return normalized;
  const database = await openDatabase();
  try {
    const transaction = database.transaction(POINTS_STORE, 'readwrite');
    const store = transaction.objectStore(POINTS_STORE);
    normalized.forEach((point, index) => {
      if (UUID_PATTERN.test(String(point.eventId || ''))) return;
      const original = points[index];
      const eventId = createLocationEventId();
      store.delete(original.key);
      normalized[index] = { ...point, eventId, key: `${point.scopeKey}:${eventId}` };
      store.put(normalized[index]);
    });
    await transactionDone(transaction);
    return normalized;
  } finally {
    database.close();
  }
}

function clearRetry(scopeKey: string) {
  const timer = retryTimers.get(scopeKey);
  if (timer !== undefined) window.clearTimeout(timer);
  retryTimers.delete(scopeKey);
  nextAttemptAt.delete(scopeKey);
  retryAttempts.delete(scopeKey);
}

/** Programa el siguiente reintento reemplazando al anterior: nunca hay más de un temporizador por sesión. */
function scheduleRetry(identity: LocationQueueIdentity, scopeKey: string, delay: number) {
  const previous = retryTimers.get(scopeKey);
  if (previous !== undefined) window.clearTimeout(previous);
  nextAttemptAt.set(scopeKey, Date.now() + delay);
  retryTimers.set(scopeKey, window.setTimeout(() => {
    retryTimers.delete(scopeKey);
    void flushLocationQueue(identity, { force: true }).catch(() => undefined);
  }, delay));
}

/**
 * Envía los puntos pendientes. Mientras haya una espera por un fallo anterior, los avisos periódicos, de visibilidad o
 * de punto nuevo no insisten; `force` (el temporizador de reintento o la vuelta de la conexión) sí intenta.
 */
export function flushLocationQueue(identity: LocationQueueIdentity, options: { force?: boolean } = {}): Promise<boolean> {
  const scopeKey = locationScopeKey(identity);
  const existingFlush = flushes.get(scopeKey);
  if (existingFlush) return existingFlush;
  if (!options.force && Date.now() < (nextAttemptAt.get(scopeKey) ?? 0)) return Promise.resolve(false);
  const flush = (async () => {
    const database = await openDatabase();
    let session: SessionRecord | undefined;
    let points: QueueRecord[];
    try {
      const transaction = database.transaction([POINTS_STORE, SESSIONS_STORE], 'readonly');
      const pointRequest = transaction.objectStore(POINTS_STORE).index('byScope').getAll(IDBKeyRange.only(scopeKey));
      const sessionRequest = transaction.objectStore(SESSIONS_STORE).get(scopeKey);
      [points, session] = await Promise.all([
        requestResult(pointRequest) as Promise<QueueRecord[]>,
        requestResult(sessionRequest) as Promise<SessionRecord | undefined>,
      ]);
    } finally {
      database.close();
    }
    if (!navigator.onLine || !session?.active || !session.accessToken || !points.length) return false;
    const prune = selectPointsToPrune(points);
    if (prune.length) {
      await deleteQueuedPoints(prune);
      const pruned = new Set(prune);
      points = points.filter((point) => !pruned.has(point.key));
      if (!points.length) return false;
    }
    points.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const sent = await sendBatch(session, points.slice(0, MAX_BATCH_SIZE));
    if (sent) clearRetry(scopeKey);
    registerBackgroundSync();
    return sent;
  })().catch((error) => {
    registerBackgroundSync();
    const attempt = Math.min((retryAttempts.get(scopeKey) || 0) + 1, 8);
    retryAttempts.set(scopeKey, attempt);
    scheduleRetry(identity, scopeKey, retryDelayMs(attempt));
    throw error;
  }).finally(() => flushes.delete(scopeKey));
  flushes.set(scopeKey, flush);
  return flush;
}
