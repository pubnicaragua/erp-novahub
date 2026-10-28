import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const recoverySource = await readFile(new URL('../src/app/utils/chunk-recovery.ts', import.meta.url), 'utf8');
const serviceWorkerSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const recoveryCode = ts.transpileModule(recoverySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function createRecoveryRuntime({ storage, online = true } = {}) {
  const listeners = new Map();
  const navigations = [];
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
      href: 'https://novahub.test/?m=ventas&sm=clientes',
      pathname: '/',
      replace: (url) => {
        navigations.push(url);
        window.location.href = url;
      },
    },
    history: { state: null, replaceState() {} },
    addEventListener: windowEvents.addEventListener.bind(windowEvents),
    dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
  };
  const exports = {};
  const sandbox = {
    exports,
    __NOVAHUB_BUILD_ID__: 'test-build-a',
    window,
    navigator: { onLine: online },
    sessionStorage,
    URL,
    URLSearchParams,
    Event,
    Error,
    TypeError,
    console,
  };
  vm.runInNewContext(recoveryCode, sandbox);
  return { api: exports, listeners, navigations, session, sandbox, window };
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

test('an unrelated successful import does not reset the build recovery limit', async () => {
  const runtime = createRecoveryRuntime();
  runtime.api.recoverFromChunk('ventas');
  await runtime.api.loadModuleWithChunkRecovery(async () => ({ default: 'clientes' }), 'clientes');

  assert.equal(runtime.api.recoverFromChunk('ventas'), false);
  assert.equal(runtime.navigations.length, 1);
});

test('the recovery marker keeps the current module and route intact', () => {
  const runtime = createRecoveryRuntime();
  runtime.api.recoverFromChunk('ventas');

  const target = new URL(runtime.navigations[0]);
  assert.equal(target.searchParams.get('m'), 'ventas');
  assert.equal(target.searchParams.get('sm'), 'clientes');
  assert.equal(target.searchParams.get('__asset_recovery'), 'test-build-a');
});

test('a blocked sessionStorage uses the URL guard without looping', () => {
  const blocked = new Map();
  blocked.get = () => { throw new Error('Storage is blocked'); };
  blocked.set = () => { throw new Error('Storage is blocked'); };
  const runtime = createRecoveryRuntime({ storage: blocked });

  assert.equal(runtime.api.recoverFromChunk('ventas'), true);
  assert.equal(runtime.api.recoverFromChunk('ventas'), false);
  assert.equal(new URL(runtime.navigations[0]).searchParams.get('__asset_recovery'), 'test-build-a');
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
  const missingAssetIndex = routes.findIndex((route) =>
    route.status === 404 && route.headers?.['Cache-Control'] === 'no-store',
  );
  const indexHeaders = routes.find((route) => route.src?.startsWith('/index\\.html'));
  const serviceWorkerHeaders = routes.find((route) => route.src?.startsWith('/sw\\.js'));

  assert.ok(indexHeaders?.continue);
  assert.match(indexHeaders?.headers?.['Cache-Control'] || '', /no-store/);
  assert.ok(serviceWorkerHeaders?.continue);
  assert.match(serviceWorkerHeaders?.headers?.['Cache-Control'] || '', /no-store/);
  assert.ok(filesystemIndex >= 0);
  assert.ok(missingAssetIndex > filesystemIndex);
  assert.ok(routes.indexOf(appRewrite) > missingAssetIndex);
  assert.ok(appRewrite?.has?.some((rule) => rule.key === 'accept' && rule.value.includes('text/html')));
  const shouldReturnMissingAsset404 = new RegExp(`^${routes[missingAssetIndex].src}$`);
  assert.equal(shouldReturnMissingAsset404.test('/assets/VentasPage-missing.js'), true);
  assert.equal(shouldReturnMissingAsset404.test('/maps/missing-map.html'), true);
  assert.equal(shouldReturnMissingAsset404.test('/downloads/missing.pdf'), true);
  assert.equal(shouldReturnMissingAsset404.test('/ventas'), false);
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
