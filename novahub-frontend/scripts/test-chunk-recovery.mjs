import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const recoverySource = await readFile(new URL('../src/app/utils/chunk-recovery.ts', import.meta.url), 'utf8');
const versionSource = await readFile(new URL('../src/app/utils/app-version.ts', import.meta.url), 'utf8');
const serviceWorkerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const transpile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const recoveryCode = transpile(recoverySource);
const versionCode = transpile(versionSource);

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

// Cada módulo se ejecuta dentro de una función para que sus constantes de nivel superior no choquen entre sí.
function runModule(code, context, requires = {}) {
  const exports = {};
  const wrapper = vm.runInContext(['(function (exports, require) {', code, '})'].join(String.fromCharCode(10)), context);
  wrapper(exports, (name) => {
    if (!(name in requires)) throw new Error(`Unexpected require: ${name}`);
    return requires[name];
  });
  return exports;
}

// Simula /version.json: cada llamada devuelve el siguiente identificador de la lista (el último se repite).
function createVersionFetch(sequence) {
  const calls = [];
  const queue = [...sequence];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    const buildId = queue.length > 1 ? queue.shift() : queue[0];
    if (buildId === null) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ buildId }) };
  };
  return { fetchImpl, calls };
}

function createRecoveryRuntime({
  storage,
  online = true,
  href = 'https://novahub.test/?m=ventas&sm=clientes',
  buildId = 'test-build-a',
  fetchImpl,
  cacheNames = [],
  registrations = 0,
} = {}) {
  const listeners = new Map();
  const navigations = [];
  const cacheDeletions = [];
  const unregistered = [];
  const windowEvents = new EventTarget();
  const session = storage || new Map();
  const sessionStorage = {
    get length() { return session.size; },
    getItem: (key) => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
    removeItem: (key) => session.delete(key),
    key: (index) => [...session.keys()][index] ?? null,
  };
  const window = {
    location: {
      href,
      pathname: '/',
      replace: (url) => {
        navigations.push(url);
        window.location.href = url;
      },
    },
    history: { state: null, replaceState() {} },
    caches: {
      keys: async () => [...cacheNames],
      delete: async (name) => { cacheDeletions.push(name); return true; },
    },
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
  };
  const navigator = {
    onLine: online,
    serviceWorker: {
      getRegistrations: async () => Array.from({ length: registrations }, (_unused, index) => ({
        unregister: async () => { unregistered.push(index); },
      })),
    },
  };
  const sandbox = {
    __NOVAHUB_BUILD_ID__: buildId,
    window,
    navigator,
    sessionStorage,
    URL,
    URLSearchParams,
    Event,
    Error,
    TypeError,
    console,
    // Las esperas de la recuperación no deben tardar segundos reales en la prueba.
    setTimeout: (callback) => { setImmediate(callback); },
    fetch: fetchImpl || (async () => { throw new TypeError('Failed to fetch'); }),
  };
  const context = vm.createContext(sandbox);
  const version = runModule(versionCode, context);
  const api = runModule(recoveryCode, context, { './app-version': version });
  return { api, version, listeners, navigations, session, sandbox, window, cacheDeletions, unregistered };
}

function recoveryMark(runtimeOrUrl) {
  const url = new URL(typeof runtimeOrUrl === 'string' ? runtimeOrUrl : runtimeOrUrl.navigations[0]);
  const [attempt, at, ...build] = (url.searchParams.get('__asset_recovery') || '').split(':');
  return { attempt, at: Number(at), build: build.join(':') };
}

function createServiceWorkerRuntime({ fetchResponse, onCachePut } = {}) {
  const listeners = new Map();
  const cacheContents = new Map();
  const cacheDeletions = [];
  const calls = { network: 0, skipWaiting: 0, claims: 0 };
  const caches = {
    async keys() { return [...cacheContents.keys()]; },
    async delete(name) { cacheDeletions.push(name); return cacheContents.delete(name); },
    async open(name) {
      if (!cacheContents.has(name)) cacheContents.set(name, new Map());
      const entries = cacheContents.get(name);
      return {
        async match(request) { return entries.get(request.url || request) ?? null; },
        async put(request, response) {
          if (onCachePut) await onCachePut(request, response);
          entries.set(request.url || request, response);
        },
        async delete(request) { return entries.delete(request.url || request); },
      };
    },
  };
  const sandbox = {
    URL,
    Response,
    Headers,
    fetch: async (...args) => {
      calls.network += 1;
      return fetchResponse(...args);
    },
    caches,
    setTimeout: (callback) => { setImmediate(callback); },
    self: {
      location: { href: 'https://novahub.test/sw.js?v=test-build-b', origin: 'https://novahub.test' },
      addEventListener: (type, listener) => listeners.set(type, listener),
      skipWaiting: async () => { calls.skipWaiting += 1; },
      clients: { claim: async () => { calls.claims += 1; } },
    },
  };
  vm.runInNewContext(serviceWorkerSource, sandbox, { filename: 'sw.js' });
  return { cacheContents, cacheDeletions, calls, listeners, sandbox };
}

function createBasicResponse(body, contentType, status = 200) {
  const headers = new Headers({ 'Content-Type': contentType });
  return {
    ok: status >= 200 && status < 300,
    status,
    type: 'basic',
    headers,
    body,
    clone() { return this; },
  };
}

test('Vite preserves the asset failure and recovery leaves its promise pending during navigation', async () => {
  const runtime = createRecoveryRuntime();
  let observedEvent;
  runtime.window.addEventListener('vite:preloadError', (event) => { observedEvent = event; });

  const originalError = new TypeError('Failed to fetch dynamically imported module: https://novahub.test/assets/VentasPage-old.js');
  const loading = runtime.api.loadModuleWithChunkRecovery(() => {
    const event = new Event('vite:preloadError', { cancelable: true });
    Object.defineProperty(event, 'payload', { value: originalError });
    runtime.window.dispatchEvent(event);
    if (!event.defaultPrevented) throw originalError;
    return Promise.resolve(undefined);
  }, 'ventas');
  let settlement = 'pending';
  loading.then(() => { settlement = 'resolved'; }, () => { settlement = 'rejected'; });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(observedEvent.defaultPrevented, false);
  assert.equal(runtime.navigations.length, 1);
  assert.equal(settlement, 'pending');
});

test('concurrent module failures in one document start a single recovery navigation', async () => {
  const runtime = createRecoveryRuntime();
  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  await runtime.api.loadModuleWithChunkRecovery(async () => ({ default: 'clientes' }), 'clientes');

  // Un segundo módulo que falla mientras la página se reemplaza se queda esperando, no recarga otra vez.
  assert.equal(runtime.api.recoverFromChunk('clientes'), true);
  assert.equal(runtime.navigations.length, 1);
});

test('the recovery marker keeps the current module and route intact', () => {
  const runtime = createRecoveryRuntime();
  runtime.api.recoverFromChunk('ventas');

  const target = new URL(runtime.navigations[0]);
  assert.equal(target.searchParams.get('m'), 'ventas');
  assert.equal(target.searchParams.get('sm'), 'clientes');
  const mark = recoveryMark(runtime);
  assert.equal(mark.attempt, '1');
  assert.ok(mark.at > 0);
  assert.equal(mark.build, 'test-build-a');
});

test('a blocked sessionStorage still stops after three attempts through the URL marker', async () => {
  const blocked = new Map();
  blocked.get = () => { throw new Error('Storage is blocked'); };
  blocked.set = () => { throw new Error('Storage is blocked'); };
  const newer = createVersionFetch(['test-build-b']);

  let href = 'https://novahub.test/?m=ventas&sm=clientes';
  const seen = [];
  for (let documentIndex = 0; documentIndex < 5; documentIndex += 1) {
    // Cada vuelta es un documento nuevo (la recarga) que conserva solo la dirección.
    const runtime = createRecoveryRuntime({ storage: blocked, href, fetchImpl: newer.fetchImpl });
    const started = runtime.api.recoverFromChunk('ventas');
    await settle();
    if (!started) { seen.push('stopped'); break; }
    href = runtime.navigations[0];
    seen.push(recoveryMark(runtime).attempt);
  }
  assert.deepEqual(seen, ['1', '2', '3', 'stopped']);
});

test('the attempt count survives in sessionStorage when the URL marker was removed', () => {
  const session = new Map([[
    'novahub:chunk-recovery',
    JSON.stringify({ buildId: 'test-build-a', attempt: 3, at: Date.now() }),
  ]]);
  const runtime = createRecoveryRuntime({ storage: session });

  assert.equal(runtime.api.recoverFromChunk('ventas'), false);
  assert.equal(runtime.navigations.length, 0);
});

test('a different build starts its own recovery from scratch', () => {
  const href = `https://novahub.test/?m=ventas&__asset_recovery=3:${Date.now()}:test-build-older`;
  const runtime = createRecoveryRuntime({ href });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  assert.equal(recoveryMark(runtime).attempt, '1');
});

test('an expired marker no longer counts against the build', () => {
  const longAgo = Date.now() - 6 * 60_000;
  const runtime = createRecoveryRuntime({ href: `https://novahub.test/?__asset_recovery=3:${longAgo}:test-build-a` });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  assert.equal(recoveryMark(runtime).attempt, '1');
});

test('a marker written by the previous version counts as the first attempt', async () => {
  const runtime = createRecoveryRuntime({ href: 'https://novahub.test/?m=ventas&__asset_recovery=test-build-a' });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  await settle();
  assert.equal(recoveryMark(runtime).attempt, '2');
});

test('the first recovery is an immediate reload that leaves caches and the service worker alone', async () => {
  const runtime = createRecoveryRuntime({ cacheNames: ['novahub-shell-test-build-a'], registrations: 1 });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  // La navegación ocurre de forma síncrona: no espera a ninguna promesa.
  assert.equal(runtime.navigations.length, 1);
  await settle();
  assert.deepEqual(runtime.cacheDeletions, []);
  assert.deepEqual(runtime.unregistered, []);
});

test('the second recovery clears the NovaHub caches but keeps the service worker and its push subscription', async () => {
  const href = `https://novahub.test/?m=ventas&__asset_recovery=1:${Date.now()}:test-build-a`;
  const runtime = createRecoveryRuntime({ href, cacheNames: ['novahub-shell-test-build-a', 'other-site-cache'], registrations: 1 });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  await settle();
  assert.deepEqual(runtime.cacheDeletions, ['novahub-shell-test-build-a']);
  assert.deepEqual(runtime.unregistered, []);
  assert.equal(runtime.navigations.length, 1);
  assert.equal(recoveryMark(runtime).attempt, '2');
});

test('the third recovery unregisters the worker and waits for a newer build before reloading', async () => {
  const href = `https://novahub.test/?m=ventas&__asset_recovery=2:${Date.now()}:test-build-a`;
  const version = createVersionFetch(['test-build-a', 'test-build-a', 'test-build-b']);
  const runtime = createRecoveryRuntime({ href, cacheNames: ['novahub-shell-test-build-a'], registrations: 2, fetchImpl: version.fetchImpl });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  await settle();
  assert.equal(version.calls.length, 3);
  assert.deepEqual(runtime.unregistered, [0, 1]);
  assert.deepEqual(runtime.cacheDeletions, ['novahub-shell-test-build-a']);
  assert.equal(runtime.navigations.length, 1);
  assert.equal(recoveryMark(runtime).attempt, '3');
});

test('the third recovery still reloads once the wait for a newer build runs out', async () => {
  const href = `https://novahub.test/?m=ventas&__asset_recovery=2:${Date.now()}:test-build-a`;
  const version = createVersionFetch(['test-build-a']);
  const runtime = createRecoveryRuntime({ href, fetchImpl: version.fetchImpl });

  runtime.api.recoverFromChunk('ventas');
  await settle();
  assert.equal(version.calls.length, 16);
  assert.equal(runtime.navigations.length, 1);
});

test('the incident reports which recovery attempt it started', () => {
  const runtime = createRecoveryRuntime();
  runtime.api.recoverFromChunk('ventas', new TypeError('Failed to fetch dynamically imported module: https://novahub.test/assets/VentasPage.js'));

  const stored = JSON.parse(runtime.session.get('novahub:chunk-incident:test-build-a'));
  assert.equal(stored.attempt, 1);
});

test('offline lazy imports do not start an automatic navigation', async () => {
  const runtime = createRecoveryRuntime({ online: false });
  const failure = new Error('Failed to fetch dynamically imported module');

  await assert.rejects(runtime.api.loadModuleWithChunkRecovery(() => Promise.reject(failure), 'ventas'), failure);
  assert.equal(runtime.navigations.length, 0);
});

test('the pending incident omits secrets and is sent once after the next bootstrap', () => {
  const runtime = createRecoveryRuntime();
  runtime.window.location.href = 'https://novahub.test/?m=ventas&sm=clientes&token=secret-token';
  const error = new TypeError('Failed to fetch dynamically imported module: https://novahub.test/assets/VentasPage.js?token=secret-token');

  runtime.api.storePendingChunkIncident('ventas', error);
  const [storedKey, storedValue] = [...runtime.session.entries()][0];
  const incident = JSON.parse(storedValue);
  assert.equal(storedKey, 'novahub:chunk-incident:test-build-a');
  assert.equal(incident.buildId, 'test-build-a');
  assert.equal(incident.moduleName, 'ventas');
  assert.equal(incident.online, true);
  assert.equal(incident.route, '/?m=ventas&sm=clientes');
  assert.equal(JSON.stringify(incident).includes('secret-token'), false);

  const reports = [];
  assert.equal(runtime.api.flushPendingChunkIncident((pending) => reports.push(pending)), true);
  assert.equal(runtime.api.flushPendingChunkIncident((pending) => reports.push(pending)), false);
  assert.equal(JSON.stringify(reports), JSON.stringify([incident]));
});

test('an incident remains queued if reporting throws during bootstrap', () => {
  const runtime = createRecoveryRuntime();
  runtime.api.storePendingChunkIncident('ventas', new Error('chunk failed'));

  assert.equal(runtime.api.flushPendingChunkIncident(() => { throw new Error('Sentry unavailable'); }), false);
  assert.equal(runtime.session.size, 1);
});

test('a missing deployment asset never falls through to the SPA HTML response', () => {
  const routes = vercelConfig.routes || [];
  const appRewrite = routes.find((route) => route.dest === '/index.html');
  const filesystemIndex = routes.findIndex((route) => route.handle === 'filesystem');
  const assetCacheIndex = routes.findIndex((route) => route.src === '/assets/(.*)');
  const assetCache = routes[assetCacheIndex];
  const missingAssetRoutes = routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => route.status === 404 && route.headers?.['Cache-Control'] === 'no-store');
  const indexHeaders = routes.find((route) => route.src?.startsWith('/index\\.html'));
  const serviceWorkerHeaders = routes.find((route) => route.src?.startsWith('/sw\\.js'));

  assert.ok(indexHeaders?.continue);
  assert.match(indexHeaders?.headers?.['Cache-Control'] || '', /no-store/);
  assert.ok(serviceWorkerHeaders?.continue);
  assert.match(serviceWorkerHeaders?.headers?.['Cache-Control'] || '', /no-store/);
  assert.ok(assetCache?.continue);
  assert.equal(assetCache?.headers?.['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.ok(assetCacheIndex < filesystemIndex);
  assert.ok(filesystemIndex >= 0);
  assert.ok(missingAssetRoutes.length >= 4);
  assert.ok(missingAssetRoutes.every(({ route }) => route.continue === false));
  assert.ok(missingAssetRoutes.every(({ index }) => index > filesystemIndex));
  assert.ok(routes.indexOf(appRewrite) > Math.max(...missingAssetRoutes.map(({ index }) => index)));
  assert.ok(appRewrite?.has?.some((rule) => rule.key === 'accept' && rule.value.includes('text/html')));
  const shouldReturnMissingAsset404 = (path) => missingAssetRoutes.some(({ route }) =>
    new RegExp(`^${route.src}$`).test(path),
  );
  assert.equal(shouldReturnMissingAsset404('/assets/VentasPage-missing.js'), true);
  assert.equal(shouldReturnMissingAsset404('/maps/missing-map.html'), true);
  assert.equal(shouldReturnMissingAsset404('/downloads/missing.pdf'), true);
  assert.equal(shouldReturnMissingAsset404('/ventas'), false);
  const shouldUseSpaFallback = new RegExp(`^${appRewrite.src}$`);
  assert.equal(shouldUseSpaFallback.test('/assets/VentasPage-missing.js'), false);
  assert.equal(shouldUseSpaFallback.test('/maps/missing-map.html'), false);
  assert.equal(shouldUseSpaFallback.test('/downloads/missing.pdf'), false);
  assert.equal(shouldUseSpaFallback.test('/ventas'), true);
});

test('a cache write failure does not reject a valid network script', async () => {
  const response = createBasicResponse('export default 1', 'text/javascript');
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async () => response,
    onCachePut: async () => { throw new Error('QuotaExceededError'); },
  });

  const result = await runtime.sandbox.cacheStatic({ url: 'https://novahub.test/assets/module.js', destination: 'script' });
  assert.equal(result.status, 200);
  assert.equal(runtime.calls.network, 1);
});

test('a cached HTML response is discarded and the network request bypasses the browser cache', async () => {
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async (_request, options) => {
      assert.equal(options.cache, 'reload');
      return createBasicResponse('export default 2', 'text/javascript');
    },
  });
  const cache = await runtime.sandbox.caches.open('novahub-shell-test-build-b');
  const url = 'https://novahub.test/assets/module.js';
  await cache.put(url, createBasicResponse('<div id="root"></div>', 'text/html'));

  const response = await runtime.sandbox.cacheStatic({ url, destination: 'script' });
  assert.equal(response.headers.get('content-type'), 'text/javascript');
  assert.equal(runtime.calls.network, 1);
  assert.equal(await cache.match(url), response);
});

test('a failed cache read still allows the network response', async () => {
  const response = createBasicResponse('export default 3', 'text/javascript');
  const runtime = createServiceWorkerRuntime({ fetchResponse: async () => response });
  runtime.sandbox.caches.open = async () => { throw new Error('Storage is unavailable'); };

  assert.equal(await runtime.sandbox.cacheStatic({ url: 'https://novahub.test/assets/module.js', destination: 'script' }), response);
});

test('a cache write failure does not return the previous HTML shell for fresh navigation', async () => {
  const networkShell = createBasicResponse('<div id="root">current build</div>', 'text/html');
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async (request) => {
      assert.equal(request.url, 'https://novahub.test/?m=ventas');
      return networkShell;
    },
    onCachePut: async () => { throw new Error('QuotaExceededError'); },
  });
  const previousShell = createBasicResponse('<div id="root">old build</div>', 'text/html');
  runtime.cacheContents.set('novahub-shell-test-build-b', new Map([['/index.html', previousShell]]));

  assert.equal(await runtime.sandbox.networkFirstNavigation({ url: 'https://novahub.test/?m=ventas' }), networkShell);
});

test('service worker updates wait for old clients before deleting their asset cache', async () => {
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async () => createBasicResponse('', 'text/html'),
  });
  runtime.cacheContents.set('novahub-shell-test-build-a', new Map());

  let activation;
  runtime.listeners.get('activate')({ waitUntil: (promise) => { activation = promise; } });
  await activation;

  assert.equal(runtime.calls.skipWaiting, 0);
  assert.deepEqual(runtime.cacheDeletions, ['novahub-shell-test-build-a']);
  assert.equal(runtime.calls.claims, 1);
});

test('installing an updated worker does not call skipWaiting', async () => {
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async () => createBasicResponse('<div id="root"></div>', 'text/html'),
  });
  let installation;
  runtime.listeners.get('install')({ waitUntil: (promise) => { installation = promise; } });
  await installation;

  assert.equal(runtime.calls.skipWaiting, 0);
});

test('ordinary missing-export errors are not classified as asset-load failures', () => {
  const runtime = createRecoveryRuntime();
  assert.equal(runtime.api.isDynamicImportLoadError(new TypeError("Cannot read properties of undefined (reading 'VentasPage')")), false);
});

test('a recovery navigation retries the network and never answers with the cached shell', async () => {
  const freshShell = createBasicResponse('<div id="root">current build</div>', 'text/html');
  let attempts = 0;
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async () => {
      attempts += 1;
      if (attempts < 3) throw new TypeError('Failed to fetch');
      return freshShell;
    },
  });
  const oldShell = createBasicResponse('<div id="root">old build</div>', 'text/html');
  runtime.cacheContents.set('novahub-shell-test-build-b', new Map([['/index.html', oldShell]]));

  const response = await runtime.sandbox.networkFirstNavigation({
    url: 'https://novahub.test/?m=ventas&__asset_recovery=1:1700000000000:test-build-a',
  });
  assert.equal(response, freshShell);
  assert.equal(attempts, 3);
});

test('a recovery navigation fails with a network error instead of repeating the old shell', async () => {
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async () => { throw new TypeError('Failed to fetch'); },
  });
  const oldShell = createBasicResponse('<div id="root">old build</div>', 'text/html');
  runtime.cacheContents.set('novahub-shell-test-build-b', new Map([['/index.html', oldShell]]));

  const response = await runtime.sandbox.networkFirstNavigation({
    url: 'https://novahub.test/?m=ventas&__asset_recovery=2:1700000000000:test-build-a',
  });
  assert.equal(response.type, 'error');
  assert.equal(runtime.calls.network, 3);
});

test('an ordinary navigation still opens the saved shell while offline', async () => {
  const runtime = createServiceWorkerRuntime({
    fetchResponse: async () => { throw new TypeError('Failed to fetch'); },
  });
  const savedShell = createBasicResponse('<div id="root">saved</div>', 'text/html');
  runtime.cacheContents.set('novahub-shell-test-build-b', new Map([['/index.html', savedShell]]));

  const response = await runtime.sandbox.networkFirstNavigation({ url: 'https://novahub.test/?m=ventas' });
  assert.equal(response, savedShell);
  assert.equal(runtime.calls.network, 1);
});

test('version.json is never cached so an open tab can detect a new deployment', () => {
  const routes = vercelConfig.routes || [];
  const versionRoute = routes.find((route) => route.src === '/version[.]json$');
  const filesystemIndex = routes.findIndex((route) => route.handle === 'filesystem');

  assert.ok(versionRoute?.continue);
  assert.match(versionRoute.headers['Cache-Control'], /no-store/);
  assert.ok(routes.indexOf(versionRoute) < filesystemIndex);
  assert.equal(new RegExp(versionRoute.src).test('/version.json'), true);
  assert.equal(new RegExp(versionRoute.src).test('/versionXjson'), false);
});

test('the published build id is read without caches and tolerates a missing or broken file', async () => {
  const ok = createVersionFetch(['test-build-b']);
  const runtime = createRecoveryRuntime({ fetchImpl: ok.fetchImpl });
  assert.equal(await runtime.version.fetchLatestBuildId(), 'test-build-b');
  assert.ok(ok.calls[0].url.startsWith('/version.json?cb='));
  assert.equal(ok.calls[0].init.cache, 'no-store');

  assert.equal(await runtime.version.fetchLatestBuildId(createVersionFetch([null]).fetchImpl), null);
  assert.equal(await runtime.version.fetchLatestBuildId(async () => { throw new TypeError('Failed to fetch'); }), null);
  assert.equal(await runtime.version.fetchLatestBuildId(async () => ({ ok: true, json: async () => { throw new SyntaxError('not json'); } })), null);
  assert.equal(await runtime.version.fetchLatestBuildId(async () => ({ ok: true, json: async () => ({ buildId: 42 }) })), null);
});

test('a newer published build is announced once and cleared when the tab catches up', async () => {
  const runtime = createRecoveryRuntime();
  let notifications = 0;
  runtime.version.subscribeAvailableBuild(() => { notifications += 1; });

  assert.equal(await runtime.version.checkForNewBuild(async () => 'test-build-a'), null);
  assert.equal(notifications, 0);

  assert.equal(await runtime.version.checkForNewBuild(async () => 'test-build-b'), 'test-build-b');
  assert.equal(await runtime.version.checkForNewBuild(async () => 'test-build-b'), 'test-build-b');
  assert.equal(runtime.version.getAvailableBuildId(), 'test-build-b');
  assert.equal(notifications, 1);

  // Un fallo de red no borra un aviso vigente.
  assert.equal(await runtime.version.checkForNewBuild(async () => null), 'test-build-b');
  assert.equal(notifications, 1);

  assert.equal(await runtime.version.checkForNewBuild(async () => 'test-build-a'), null);
  assert.equal(runtime.version.getAvailableBuildId(), null);
  assert.equal(notifications, 2);
});

test('local development builds are never compared with a published version', async () => {
  const runtime = createRecoveryRuntime({ buildId: 'local-1700000000000' });
  let consulted = false;

  assert.equal(await runtime.version.checkForNewBuild(async () => { consulted = true; return 'dpl_other'; }), null);
  assert.equal(consulted, false);
});
