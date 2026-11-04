const CACHE_PREFIX = 'novahub-shell-';
const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'unversioned';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);
const LOCATION_DB_NAME = 'novahub-force-sales-location-v1';
const LOCATION_SYNC_TAG = 'novahub-force-sales-location-points';
const LOCATION_EVENT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function contentType(response) {
  return (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
}

function isHtmlResponse(response) {
  return /^text\/html(?:$|;)/i.test(response.headers.get('content-type') || '');
}

function hasExpectedContentType(request, response) {
  const type = contentType(response);
  if (!type || type === 'text/html') return false;

  switch (request.destination) {
    case 'script':
      return /^(?:text|application)\/(?:x-)?(?:java|ecma)script$/.test(type);
    case 'style':
      return type === 'text/css';
    case 'image':
      return type.startsWith('image/');
    case 'font':
      return /^(?:font\/|application\/(?:font-|x-font-|vnd\.ms-fontobject|octet-stream))/.test(type);
    case 'manifest':
      return type === 'application/manifest+json' || type === 'application/json';
    default:
      return new URL(request.url).pathname.startsWith('/assets/') &&
        /^(?:application|text|image|font)\//.test(type);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetch('/index.html');
        if (response.ok && response.type === 'basic' && isHtmlResponse(response)) {
          await cache.put('/index.html', response);
        }
      })
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

// Allows a future Web Push provider to show a notification even when the PWA
// is backgrounded. In-app notifications continue to use the authenticated SSE
// channel and do not depend on this listener.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text?.() || '' }; }
  const title = data.title || 'NovaHub ERP';
  const options = {
    body: data.body || data.message || 'Tienes una actualización pendiente.',
    icon: data.icon || '/novahub-isotipo.png',
    badge: data.badge || '/novahub-isotipo.png',
    tag: data.tag || 'novahub-notification',
    data: { url: data.url || '/', notificationId: data.notificationId || null },
    vibrate: [180, 80, 180],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing && 'focus' in existing) {
      existing.postMessage({
        type: 'novahub-notification-click',
        notificationId: event.notification.data?.notificationId || null,
        url: targetUrl,
      });
      await existing.focus();
      if ('navigate' in existing && existing.url !== targetUrl) await existing.navigate(targetUrl);
      return;
    }
    await self.clients.openWindow(targetUrl);
  })());
});

function openLocationDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCATION_DB_NAME);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('points')) {
        const points = database.createObjectStore('points', { keyPath: 'key' });
        points.createIndex('byScope', 'scopeKey', { unique: false });
      }
      if (!database.objectStoreNames.contains('sessions')) {
        database.createObjectStore('sessions', { keyPath: 'scopeKey' });
      }
      if (!database.objectStoreNames.contains('trackingLeases')) {
        database.createObjectStore('trackingLeases', { keyPath: 'scopeKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Location queue is unavailable'));
  });
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Location queue read failed'));
  });
}

function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('Location queue write failed'));
    transaction.onerror = () => reject(transaction.error || new Error('Location queue write failed'));
  });
}

function createLocationEventId() {
  const bytes = new Uint8Array(16);
  if (self.crypto?.getRandomValues) self.crypto.getRandomValues(bytes);
  else bytes.forEach((_value, index) => { bytes[index] = Math.floor(Math.random() * 256); });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function normalizeLegacyEventIds(database, points) {
  const normalized = points.map((point) => ({ ...point }));
  if (!normalized.some((point) => !LOCATION_EVENT_UUID.test(String(point.eventId || '')))) return normalized;
  const transaction = database.transaction('points', 'readwrite');
  const store = transaction.objectStore('points');
  normalized.forEach((point, index) => {
    if (LOCATION_EVENT_UUID.test(String(point.eventId || ''))) return;
    const original = points[index];
    const eventId = createLocationEventId();
    store.delete(original.key);
    normalized[index] = { ...point, eventId, key: `${point.scopeKey}:${eventId}` };
    store.put(normalized[index]);
  });
  await idbTransactionDone(transaction);
  return normalized;
}

async function replayLocationPoints() {
  const database = await openLocationDatabase();
  try {
    const read = database.transaction(['points', 'sessions'], 'readonly');
    const sessionsPromise = idbRequest(read.objectStore('sessions').getAll());
    const pointsPromise = idbRequest(read.objectStore('points').getAll());
    const [sessions, points] = await Promise.all([sessionsPromise, pointsPromise]);
    for (const session of sessions) {
      if (!session.active || !session.accessToken) continue;
      const scopedPoints = points
        .filter((point) => point.scopeKey === session.scopeKey)
        .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
      if (!scopedPoints.length) continue;
      let remaining = scopedPoints.length;
      for (let offset = 0; offset < scopedPoints.length && offset < 1000; offset += 200) {
        const batch = await normalizeLegacyEventIds(database, scopedPoints.slice(offset, offset + 200));
        const response = await fetch(`${session.apiBase}/force-sales/location-points/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
          body: JSON.stringify({ points: batch.map(({ key: _key, scopeKey: _scope, storedAt: _stored, ...point }) => point) }),
          cache: 'no-store',
        });
        if (response.status === 401 || response.status === 403) {
          const write = database.transaction('sessions', 'readwrite');
          write.objectStore('sessions').put({ ...session, active: false, accessToken: null });
          await idbTransactionDone(write);
          break;
        }
        if (!response.ok) {
          const detail = await response.clone().json().catch(() => null);
          const serverMessage = Array.isArray(detail?.message) ? detail.message.join('; ') : detail?.message;
          const safeMessage = typeof serverMessage === 'string' ? serverMessage.slice(0, 240) : '';
          throw new Error(`Location sync failed with HTTP ${response.status}${safeMessage ? `: ${safeMessage}` : ''}`);
        }
        const payload = await response.json();
        const accepted = new Set(Array.isArray(payload.acceptedIds) ? payload.acceptedIds : []);
        if (!accepted.size) throw new Error('Location server did not confirm the batch');
        const write = database.transaction(['points', 'sessions'], 'readwrite');
        const pointStore = write.objectStore('points');
        for (const point of batch) if (accepted.has(point.eventId)) pointStore.delete(point.key);
        const sessionStore = write.objectStore('sessions');
        const sessionRequest = sessionStore.get(session.scopeKey);
        sessionRequest.onsuccess = () => {
          const current = sessionRequest.result;
          if (current?.active) sessionStore.put({ ...current, lastSyncedAt: new Date().toISOString() });
        };
        await idbTransactionDone(write);
        remaining -= accepted.size;
      }
      if (remaining > 0 && session.active && session.accessToken) {
        const registration = self.registration;
        if (registration.sync?.register) await registration.sync.register(LOCATION_SYNC_TAG);
      }
    }
  } finally {
    database.close();
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === LOCATION_SYNC_TAG) event.waitUntil(replayLocationPoints());
});

async function cacheStatic(request) {
  let cache;
  let cached;
  try {
    cache = await caches.open(CACHE_NAME);
    cached = await cache.match(request);
  } catch {
    // Storage is an optimization; a cache failure must not block the network.
  }

  let retryWithoutHttpCache = false;
  if (cached && hasExpectedContentType(request, cached)) return cached;
  if (cached) {
    retryWithoutHttpCache = true;
    try {
      await cache.delete(request);
    } catch {
      // Fetch below still bypasses the HTTP cache even if the stale entry remains.
    }
  }

  const response = retryWithoutHttpCache
    ? await fetch(request, { cache: 'reload' })
    : await fetch(request);
  if (cache && response.ok && response.type === 'basic' && hasExpectedContentType(request, response)) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // Do not turn a valid response into a failed module import when storage is full.
    }
  }
  return response;
}

async function networkFirstNavigation(request) {
  let response;
  try {
    response = await fetch(request);
  } catch {
    try {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match('/index.html')) || Response.error();
    } catch {
      return Response.error();
    }
  }

  if (response.ok && response.type === 'basic' && isHtmlResponse(response)) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', response.clone());
    } catch {
      // Keep the fresh network shell even if it cannot be stored offline.
    }
  }
  return response;
}

async function fetchForceSalesMap(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (!response.ok || !isHtmlResponse(response)) return response;

    const mapDocument = await response.clone().text();
    if (mapDocument.includes('id="sheet"') && mapDocument.includes('id="map"')) return response;

    return new Response('El documento del mapa comercial no está disponible.', {
      status: 404,
      statusText: 'Force Sales map document not found',
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Do not cache the map URL or its credential-bearing query. Reject the SPA
  // fallback when an old hashed map asset no longer exists after deployment.
  if (url.pathname.toLowerCase().includes('dise') && url.pathname.toLowerCase().endsWith('.html')) {
    event.respondWith(fetchForceSalesMap(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination) || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheStatic(request));
  }
});
