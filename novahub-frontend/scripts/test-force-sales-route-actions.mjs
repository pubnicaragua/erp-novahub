import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

class FakeRequest {
  result = undefined;
  onsuccess = null;
  onerror = null;
}

class FakeStore {
  constructor(transaction, store) {
    this.transaction = transaction;
    this.store = store;
  }

  add(value) {
    const request = new FakeRequest();
    this.transaction.enqueue(() => {
      const queueId = this.store.nextId++;
      const stored = { ...structuredClone(value), queueId };
      this.store.records.set(queueId, stored);
      request.result = queueId;
      request.onsuccess?.({ target: request });
    });
    return request;
  }

  get(key) {
    const request = new FakeRequest();
    this.transaction.enqueue(() => {
      request.result = structuredClone(this.store.records.get(key));
      request.onsuccess?.({ target: request });
    });
    return request;
  }

  put(value) {
    this.transaction.enqueue(() => this.store.records.set(value.queueId, structuredClone(value)));
    return new FakeRequest();
  }

  delete(key) {
    this.transaction.enqueue(() => this.store.records.delete(key));
    return new FakeRequest();
  }

  index(name) {
    assert.equal(name, 'byIdentity');
    return {
      getAll: (range) => {
        const request = new FakeRequest();
        this.transaction.enqueue(() => {
          request.result = [...this.store.records.values()]
            .filter((record) => record.identityKey === range.value)
            .sort((a, b) => a.queueId - b.queueId)
            .map((record) => structuredClone(record));
          request.onsuccess?.({ target: request });
        });
        return request;
      },
    };
  }
}

class FakeTransaction {
  operations = [];
  oncomplete = null;
  onabort = null;
  onerror = null;
  error = null;

  constructor(database, storeNames) {
    this.database = database;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    setTimeout(() => this.database.enqueueTransaction(this), 0);
  }

  objectStore(name) {
    assert.ok(this.storeNames.includes(name), `Store ${name} must belong to this transaction`);
    return new FakeStore(this, this.database.stores.get(name));
  }

  enqueue(operation) { this.operations.push(operation); }

  run() {
    while (this.operations.length) this.operations.shift()();
    this.oncomplete?.({ target: this });
  }
}

class FakeDatabase {
  stores = new Map();
  transactions = [];
  draining = false;

  constructor(name, version = 0) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = { contains: (storeName) => this.stores.has(storeName) };
  }

  createObjectStore(name, { keyPath, autoIncrement }) {
    this.stores.set(name, { keyPath, autoIncrement, nextId: 1, records: new Map() });
    return { createIndex: () => undefined };
  }

  transaction(names) { return new FakeTransaction(this, names); }
  close() {}

  enqueueTransaction(transaction) {
    this.transactions.push(transaction);
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => {
      try {
        while (this.transactions.length) this.transactions.shift().run();
      } finally {
        this.draining = false;
      }
    });
  }
}

const databases = new Map();
const indexedDB = {
  open(name, version) {
    const request = new FakeRequest();
    setTimeout(() => {
      let database = databases.get(name);
      if (!database) {
        database = new FakeDatabase(name);
        databases.set(name, database);
      }
      request.result = database;
      if (version > database.version) {
        const oldVersion = database.version;
        database.version = version;
        request.onupgradeneeded?.({ oldVersion, newVersion: version, target: request });
      }
      request.onsuccess?.({ target: request });
    }, 0);
    return request;
  },
};

const html = await readFile(new URL('../public/maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
const helperSource = html.match(/<script\s+id="nova-force-sales-route-action-queue">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(helperSource, 'El mapa debe incluir una cola persistente aislada para operaciones de ruta');

const sandbox = {
  window: { NovaForceSalesOfflineIdentity: {
    normalizedIdentity: (identity = {}) => ({ tenantId: String(identity?.tenantId || '').trim(), userId: String(identity?.userId || '').trim() }),
    scopeKey: (identity = {}) => identity?.tenantId && identity?.userId ? `${encodeURIComponent(identity.tenantId)}:${encodeURIComponent(identity.userId)}` : '',
  } },
  indexedDB,
  IDBKeyRange: { only: (value) => ({ value }) },
  structuredClone,
  Date,
  Promise,
  Map,
  Error,
  setTimeout,
  queueMicrotask,
};
vm.runInNewContext(helperSource, sandbox, { filename: 'force-sales-route-action-queue.js' });
const queue = sandbox.window.NovaForceSalesRouteActionQueue;
assert.ok(queue, 'La cola de acciones de ruta debe exponerse al mapa');

const identityA = { tenantId: 'tenant-1', userId: 'seller-1' };
const identityB = { tenantId: 'tenant-1', userId: 'seller-2' };
const identityOtherTenant = { tenantId: 'tenant-2', userId: 'seller-1' };
const startId = await queue.enqueue(identityA, {
  actionId: 'start-action', type: 'START_ROUTE', routeId: 'route-1',
  routeName: 'Ruta Centro', idempotencyKey: 'route-start-key', accessToken: 'must-not-persist',
  payload: { status: 'IN_PROGRESS', startedAt: '2026-11-03T16:00:00.000Z', accessToken: 'must-not-persist' },
});
const visitId = await queue.enqueue(identityA, {
  actionId: 'visit-action', type: 'COMPLETE_STOP', routeId: 'route-1', stopId: 'stop-1',
  routeName: 'Ruta Centro', stopName: 'Tienda Uno', idempotencyKey: 'route-visit-key',
  payload: { lat: 12.1, lng: -86.2, notes: 'Cliente atendido', occurredAt: '2026-11-03T16:10:00.000Z', accessToken: 'must-not-persist' },
});

assert.deepEqual(
  (await queue.list(identityA)).map((item) => item.actionId),
  ['start-action', 'visit-action'],
  'La cola debe conservar el orden de inicio y visitas',
);
assert.deepEqual(await queue.list(identityB), [], 'Otro usuario del tenant no puede leer la cola');
assert.deepEqual(await queue.list(identityOtherTenant), [], 'El mismo usuario en otro tenant no puede leer la cola');
assert.equal((await queue.list(identityA))[0].accessToken, undefined, 'La cola nunca conserva el bearer token');
assert.equal((await queue.list(identityA))[0].payload.startedAt, '2026-11-03T16:00:00.000Z', 'El inicio conserva su hora original mientras espera conexión');
assert.equal((await queue.list(identityA))[0].payload.accessToken, undefined, 'El payload de inicio descarta tokens');
assert.equal((await queue.list(identityA))[1].payload.accessToken, undefined, 'La cola descarta tokens aunque lleguen dentro del payload');
assert.equal((await queue.list(identityA))[1].payload.occurredAt, '2026-11-03T16:10:00.000Z', 'La visita conserva su hora original mientras espera conexión');
assert.equal((await queue.list(identityA))[1].routeName, 'Ruta Centro', 'La acción bloqueada conserva el nombre seguro de la ruta para verla después de una reasignación');
assert.equal((await queue.list(identityA))[1].stopName, 'Tienda Uno', 'La acción bloqueada conserva el nombre seguro de la parada');

await queue.markBlocked(identityA, visitId, 'La ruta ya no está asignada a este usuario.');
assert.equal((await queue.list(identityA))[1].status, 'BLOCKED', 'Los conflictos deben permanecer visibles para resolverlos');
await queue.retry(identityA, visitId);
assert.equal((await queue.list(identityA))[1].status, 'PENDING', 'La persona puede reintentar después de resolver el conflicto');

const routeToolsSource = html.match(/<script\s+id="nova-force-sales-route-tools">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(routeToolsSource, 'El mapa debe exponer funciones comprobables para navegación y siguiente parada');
const routeToolsSandbox = { window: {} };
vm.runInNewContext(routeToolsSource, routeToolsSandbox, { filename: 'force-sales-route-tools.js' });
const routeTools = routeToolsSandbox.window.NovaForceSalesRouteTools;
assert.equal(routeTools.nextPendingStopIndex([
  { id: 'stop-1', status: 'COMPLETED' },
  { id: 'stop-2', status: 'PENDING' },
  { id: 'stop-3', status: 'PENDING' },
], ['stop-2']), 2, 'El vendedor avanza más allá de visitas completadas localmente pendientes de sincronización');
assert.deepEqual(JSON.parse(JSON.stringify(routeTools.navigationUrls({
  name: 'Tienda Uno', address: 'Calle Central', lat: 12.1, lng: -86.2,
}))), {
  waze: 'https://waze.com/ul?ll=12.1%2C-86.2&navigate=yes&q=Tienda%20Uno%20Calle%20Central&utm_source=novahub',
  googleMaps: 'https://www.google.com/maps/dir/?api=1&destination=12.1%2C-86.2&travelmode=driving',
}, 'Ambos navegadores deben recibir las coordenadas exactas de la parada');
assert.deepEqual(JSON.parse(JSON.stringify(routeTools.navigationUrls({ name: 'Sin GPS', lat: null, lng: null }))), { waze: '', googleMaps: '' }, 'Sin GPS, la navegación se deshabilita en ambos proveedores');
assert.match(html, /id="routeStart"/, 'La ruta persistida debe ofrecer el inicio explícito');
assert.match(html, /id="routeOpenGoogleMaps"/, 'La parada siguiente debe poder abrirse en Google Maps');
assert.match(html, /startedAt/, 'El catálogo administrativo debe mostrar cuándo inició la ruta');
assert.match(html, /Idempotency-Key/, 'El replay offline debe conservar la clave idempotente del evento');
assert.match(html, /id="routeSyncNotice"/, 'Las acciones bloqueadas deben mostrarse fuera del catálogo de rutas');
assert.match(html, /ROUTE_VISIT_DRAFTS_STORAGE_KEY/, 'Las notas no enviadas se asocian al usuario, la ruta y la parada');
assert.match(html, /acciones pendientes/, 'El aviso global separa correctamente el plural de acción');
assert.match(html, /acciones requieren/, 'El aviso global usa el plural correcto para acciones bloqueadas');
assert.match(html, /occurredAt:new Date\(\)\.toISOString\(\)/, 'La hora de visita se captura al confirmar, antes de sincronizar');

await queue.remove(identityB, startId);
assert.equal((await queue.list(identityA)).length, 2, 'Otra identidad no puede eliminar una acción pendiente');
await queue.remove(identityA, startId);
assert.deepEqual((await queue.list(identityA)).map((item) => item.actionId), ['visit-action']);

console.log('force-sales route actions: ordered offline queue, tenant/user isolation, visible conflicts, and token-free persistence passed');
