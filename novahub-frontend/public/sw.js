const CACHE_NAME = 'novahub-shell-v1';
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add('/index.html'))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

async function cacheStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const copy = response.clone();
    await caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const copy = response.clone();
      await caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
    }
    return response;
  } catch {
    return caches.match('/index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // The map iframe carries runtime query parameters and Google tiles/scripts
  // must remain online; never cache that URL or its credential-bearing query.
  if (url.pathname.includes('dise') && url.pathname.endsWith('.html')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (STATIC_DESTINATIONS.has(request.destination) || url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheStatic(request));
  }
});
