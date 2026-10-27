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

const DATABASE_NAME = 'novahub-force-sales-location-v1';
const DATABASE_VERSION = 1;
const POINTS_STORE = 'points';
const SESSIONS_STORE = 'sessions';
const SYNC_TAG = 'novahub-force-sales-location-points';
const OFFLINE_ROUTE_KEY = 'novaForceSalesOfflineRouteV1';
const OFFLINE_ROUTE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BATCH_SIZE = 200;
const flushes = new Map<string, Promise<boolean>>();
const retryAttempts = new Map<string, number>();

export function locationScopeKey(identity: LocationQueueIdentity) {
  return `${identity.tenantId}:${identity.userId}`;
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

export async function saveLocationPoint(identity: LocationQueueIdentity, point: LocationQueuePoint) {
  const database = await openDatabase();
  try {
    const scopeKey = locationScopeKey(identity);
    const transaction = database.transaction([POINTS_STORE, SESSIONS_STORE], 'readwrite');
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
    await transactionDone(transaction);
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
    const pointsRequest = transaction.objectStore(POINTS_STORE).index('byScope').getAll(IDBKeyRange.only(scopeKey));
    const sessionRequest = transaction.objectStore(SESSIONS_STORE).get(scopeKey);
    const [records, session] = await Promise.all([
      requestResult(pointsRequest) as Promise<QueueRecord[]>,
      requestResult(sessionRequest) as Promise<SessionRecord | undefined>,
    ]);
    return {
      pending: records.length,
      lastCapturedAt: session?.lastCapturedAt || records.reduce<string | null>((latest, item) => !latest || item.capturedAt > latest ? item.capturedAt : latest, null),
      lastSyncedAt: session?.lastSyncedAt || null,
    };
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

async function sendBatch(session: SessionRecord, points: QueueRecord[]) {
  if (!session.accessToken || !session.active) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${session.apiBase}/force-sales/location-points/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
      body: JSON.stringify({ points: points.map(({ key: _key, scopeKey: _scope, storedAt: _stored, ...point }) => point) }),
      signal: controller.signal,
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      await deactivateLocationQueueSession({ userId: session.userId, tenantId: session.tenantId });
      return false;
    }
    if (!response.ok) throw new Error(`El servidor rechazó la sincronización (${response.status}).`);
    const result = await response.json() as { acceptedIds?: string[] };
    const accepted = new Set(Array.isArray(result.acceptedIds) ? result.acceptedIds : []);
    if (!accepted.size) throw new Error('El servidor no confirmó los puntos guardados.');

    const database = await openDatabase();
    try {
      const transaction = database.transaction([POINTS_STORE, SESSIONS_STORE], 'readwrite');
      const pointStore = transaction.objectStore(POINTS_STORE);
      for (const point of points) if (accepted.has(point.eventId)) pointStore.delete(point.key);
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

export function flushLocationQueue(identity: LocationQueueIdentity): Promise<boolean> {
  const scopeKey = locationScopeKey(identity);
  const existingFlush = flushes.get(scopeKey);
  if (existingFlush) return existingFlush;
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
    points.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
    const sent = await sendBatch(session, points.slice(0, MAX_BATCH_SIZE));
    if (sent) retryAttempts.delete(scopeKey);
    registerBackgroundSync();
    return sent;
  })().catch((error) => {
    registerBackgroundSync();
    const attempt = Math.min((retryAttempts.get(scopeKey) || 0) + 1, 8);
    retryAttempts.set(scopeKey, attempt);
    const delay = Math.min(30000 * 2 ** (attempt - 1), 15 * 60 * 1000);
    window.setTimeout(() => { void flushLocationQueue(identity); }, delay);
    throw error;
  }).finally(() => flushes.delete(scopeKey));
  flushes.set(scopeKey, flush);
  return flush;
}
