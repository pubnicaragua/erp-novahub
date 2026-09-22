const CACHE_PREFIX = 'novahub-shell-';
const BUILD_ID = new URL(self.location.href).searchParams.get('v') || 'unversioned';
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_ID}`;
const STATIC_DESTINATIONS = new Set(['script', 'style', 'image', 'font', 'manifest']);

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
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))),
    ).then(() => self.clients.claim()),
  );
});

async function cacheStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === 'basic' && hasExpectedContentType(request, response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && isHtmlResponse(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    const cache = await caches.open(CACHE_NAME);
    return cache.match('/index.html');
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
