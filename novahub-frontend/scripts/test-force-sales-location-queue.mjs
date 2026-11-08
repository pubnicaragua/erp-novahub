import assert from 'node:assert/strict';

// ───────────── IndexedDB mínimo en memoria ─────────────
class FakeRequest { result = undefined; onsuccess = null; onerror = null; }
class FakeObjectStore {
  constructor(transaction, store) { this.transaction = transaction; this.store = store; }
  get(key) {
    const request = new FakeRequest();
    this.transaction.enqueue(() => { request.result = structuredClone(this.store.records.get(key)); request.onsuccess?.({ target: request }); });
    return request;
  }
  put(value) { this.transaction.enqueue(() => this.store.records.set(value[this.store.keyPath], structuredClone(value))); return new FakeRequest(); }
  delete(key) { this.transaction.enqueue(() => this.store.records.delete(key)); return new FakeRequest(); }
  getAll() {
    const request = new FakeRequest();
    this.transaction.enqueue(() => { request.result = [...this.store.records.values()].map((value) => structuredClone(value)); request.onsuccess?.({ target: request }); });
    return request;
  }
  index() {
    const select = (keyRange) => [...this.store.records.values()].filter((value) => value.scopeKey === keyRange.value);
    return {
      getAll: (keyRange) => {
        const request = new FakeRequest();
        this.transaction.enqueue(() => { request.result = select(keyRange).map((value) => structuredClone(value)); request.onsuccess?.({ target: request }); });
        return request;
      },
      count: (keyRange) => {
        const request = new FakeRequest();
        this.transaction.enqueue(() => { request.result = select(keyRange).length; request.onsuccess?.({ target: request }); });
        return request;
      },
    };
  }
}
class FakeTransaction {
  operations = []; error = null; aborted = false; oncomplete = null; onabort = null; onerror = null;
  constructor(database, storeNames) {
    this.database = database;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    setTimeout(() => this.database.enqueueTransaction(this), 0);
  }
  objectStore(name) { return new FakeObjectStore(this, this.database.stores.get(name)); }
  enqueue(operation) { this.operations.push(operation); }
  abort() { this.aborted = true; this.error = new Error('abortada'); this.onabort?.({ target: this }); }
  run() {
    while (this.operations.length && !this.aborted) this.operations.shift()();
    if (!this.aborted) this.oncomplete?.({ target: this });
  }
}
class FakeDatabase {
  stores = new Map(); pending = []; draining = false;
  constructor(name) { this.name = name; this.version = 0; this.objectStoreNames = { contains: (storeName) => this.stores.has(storeName) }; }
  createObjectStore(name, { keyPath }) { this.stores.set(name, { keyPath, records: new Map() }); return { createIndex: () => undefined }; }
  transaction(storeNames) { return new FakeTransaction(this, storeNames); }
  close() {}
  enqueueTransaction(transaction) {
    this.pending.push(transaction);
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => {
      try { while (this.pending.length) this.pending.shift().run(); } finally { this.draining = false; }
    });
  }
}
const databases = new Map();
globalThis.indexedDB = {
  open(name, version) {
    const request = new FakeRequest();
    setTimeout(() => {
      let database = databases.get(name);
      if (!database) { database = new FakeDatabase(name); databases.set(name, database); }
      request.result = database;
      if (version > database.version) { database.version = version; request.onupgradeneeded?.({ target: request }); }
      request.onsuccess?.({ target: request });
    }, 0);
    return request;
  },
};
globalThis.IDBKeyRange = { only: (value) => ({ value }) };

// ───────────── Navegador, reloj y temporizadores controlables ─────────────
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
let clock = Date.parse('2026-11-08T12:00:00Z');
Date.now = () => clock;
const timers = new Map();
let timerSeq = 0;
globalThis.window = {
  setTimeout: (fn, delay) => { timerSeq += 1; timers.set(timerSeq, { fn, delay }); return timerSeq; },
  clearTimeout: (id) => { timers.delete(id); },
};
const retryTimers = () => [...timers.values()].filter((timer) => timer.delay !== 15000);
const fireRetryTimer = async () => {
  const [id, timer] = [...timers.entries()].find(([, item]) => item.delay !== 15000);
  timers.delete(id);
  await timer.fn();
  // El IndexedDB simulado usa un temporizador real por operación: se espera a que el intento termine de verdad.
  for (let spins = 0; spins < 200 && retryTimers().length === 0; spins += 1) await new Promise((resolve) => setTimeout(resolve, 5));
  await new Promise((resolve) => setTimeout(resolve, 10));
};

let responses = [];
const requests = [];
globalThis.fetch = async (url, init) => {
  requests.push({ url, body: JSON.parse(init.body) });
  const next = responses.shift() ?? { status: 200, body: { acceptedIds: [] } };
  return { ok: next.status >= 200 && next.status < 300, status: next.status, clone() { return this; }, json: async () => next.body };
};

const queue = await import('../src/app/services/force-sales-location-queue.ts');
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const identity = { userId: 'user-adm', tenantId: 'client-demo-001' };
const scopeKey = queue.locationScopeKey(identity);
const point = (n, over = {}) => ({ eventId: uuid(n), capturedAt: new Date(clock - (1000 - n) * 1000).toISOString(), lat: 12.13, lng: -86.25, accuracy: 20, ...over });
const stored = () => [...databases.get('novahub-force-sales-location-v1').stores.get('points').records.values()];
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

// ───────────── Funciones puras ─────────────
const valid = point(1, { heading: 90 });
assert.deepEqual(queue.sanitizeLocationPoint(valid), { eventId: uuid(1), capturedAt: valid.capturedAt, lat: 12.13, lng: -86.25, accuracy: 20, heading: 90 });
assert.equal('accuracy' in queue.sanitizeLocationPoint(point(2, { accuracy: 25_000 })), false, 'La precisión de GPS por IP se omite pero el punto se conserva');
assert.equal(queue.sanitizeLocationPoint(point(2, { accuracy: 10_000 })).accuracy, 10_000);
assert.equal('heading' in queue.sanitizeLocationPoint(point(2, { heading: 400 })), false);
assert.equal('accuracy' in queue.sanitizeLocationPoint(point(2, { accuracy: Number.NaN })), false);
assert.deepEqual(Object.keys(queue.sanitizeLocationPoint({ ...valid, key: 'k', scopeKey: 's', storedAt: 'x', extra: 1 })).sort(), ['accuracy', 'capturedAt', 'eventId', 'heading', 'lat', 'lng']);
for (const bad of [null, 'x', point(3, { lat: 91 }), point(3, { lng: -181 }), point(3, { lat: Number.NaN }), point(3, { lat: '12.1' }), point(3, { capturedAt: 'no es fecha' }), point(3, { eventId: 'abc' })]) {
  assert.equal(queue.sanitizeLocationPoint(bad), null, `Debe descartar ${JSON.stringify(bad)}`);
}
assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((attempt) => queue.retryDelayMs(attempt, () => 0.5)), [30_000, 60_000, 120_000, 240_000, 480_000, 900_000, 900_000, 900_000]);
assert.equal(queue.retryDelayMs(3, () => 0), 96_000);
assert.equal(queue.retryDelayMs(3, () => 1), 144_000);
const old = (n) => ({ key: `k${n}`, capturedAt: new Date(clock - 15 * 86_400_000 + n).toISOString() });
const fresh = (n) => ({ key: `f${n}`, capturedAt: new Date(clock - 3_000_000 + n).toISOString() });
assert.deepEqual(queue.selectPointsToPrune([old(1), fresh(1), old(2)]).sort(), ['k1', 'k2'], 'Los puntos de más de 14 días se descartan');
const crowd = Array.from({ length: 5_003 }, (_, n) => fresh(n));
assert.deepEqual(queue.selectPointsToPrune(crowd).sort(), ['f0', 'f1', 'f2'], 'Pasado el tope se descartan los más antiguos');

// ───────────── Cola real: lote rechazado, un solo temporizador, espera respetada ─────────────
await queue.activateLocationQueueSession(identity, 'https://api.test/api', 'token');
await queue.saveLocationPoint(identity, point(10, { accuracy: 25_000 }));
await queue.saveLocationPoint(identity, point(11));
await queue.saveLocationPoint(identity, point(12, { lat: 200 })); // nunca entra a la cola
assert.equal((await queue.getLocationQueueStatus(identity)).pending, 2, 'Un punto inválido no entra a la cola y el estado se cuenta sin leer todos los puntos');

responses = [{ status: 400, body: { message: ['points.0.accuracy must not be greater than 10000'] } }];
await assert.rejects(queue.flushLocationQueue(identity), /rechaz/i);
assert.equal(requests.length, 1);
assert.equal('accuracy' in requests[0].body.points.find((p) => p.eventId === uuid(10)), false, 'La precisión fuera de rango no viaja');
assert.deepEqual(Object.keys(requests[0].body.points.find((p) => p.eventId === uuid(11))).sort(), ['accuracy', 'capturedAt', 'eventId', 'lat', 'lng'], 'Solo viajan los campos del contrato');
assert.deepEqual(Object.keys(requests[0].body.points.find((p) => p.eventId === uuid(10))).sort(), ['capturedAt', 'eventId', 'lat', 'lng']);
assert.equal(retryTimers().length, 1, 'Un fallo programa un solo reintento');

// Muchos avisos periódicos, de visibilidad o de punto nuevo durante la espera: ni peticiones ni temporizadores nuevos
for (let i = 0; i < 200; i += 1) assert.equal(await queue.flushLocationQueue(identity), false);
assert.equal(requests.length, 1, 'Durante la espera no se insiste');
assert.equal(retryTimers().length, 1, 'Nunca hay más de un temporizador por sesión');

// El temporizador de reintento sí intenta; si vuelve a fallar sigue habiendo uno solo, con espera mayor
responses = [{ status: 400, body: { message: 'x' } }];
const firstDelay = retryTimers()[0].delay;
clock += firstDelay;
await fireRetryTimer();
assert.equal(requests.length, 2);
assert.equal(retryTimers().length, 1);
assert.ok(retryTimers()[0].delay > firstDelay * 1.2, 'La espera crece en cada fallo');
for (let round = 0; round < 12; round += 1) {
  responses = [{ status: 500, body: {} }];
  clock += retryTimers()[0].delay;
  await fireRetryTimer();
  assert.equal(retryTimers().length, 1, 'Tras muchos fallos sigue habiendo un solo temporizador');
}
assert.ok(retryTimers()[0].delay <= 900_000 * 1.2, 'La espera tiene tope de 15 minutos');

// Cuando el servidor acepta (y rechaza lo inválido) la cola se vacía y el temporizador desaparece
const before = requests.length;
responses = [{ status: 200, body: { acceptedIds: [uuid(10)], rejectedIds: [uuid(11)] } }];
clock += 900_000 * 2;
assert.equal(await queue.flushLocationQueue(identity, { force: true }), true);
assert.equal(requests.length, before + 1);
assert.equal(stored().length, 0, 'Lo aceptado y lo rechazado salen de la cola');
assert.equal(retryTimers().length, 0, 'El éxito cancela el reintento');
assert.equal(await queue.flushLocationQueue(identity), false, 'Sin puntos no hay petición');
assert.equal(requests.length, before + 1);

// ───────────── Puntos viejos inválidos guardados por versiones anteriores ─────────────
const store = databases.get('novahub-force-sales-location-v1').stores.get('points').records;
const legacy = (n, over) => ({ ...point(n, over), key: `${scopeKey}:${uuid(n)}`, scopeKey, storedAt: new Date(clock).toISOString() });
for (const record of [legacy(20, { lat: 999 }), legacy(21), legacy(22, { capturedAt: 'basura' })]) store.set(record.key, record);
responses = [{ status: 200, body: { acceptedIds: [uuid(21)] } }];
assert.equal(await queue.flushLocationQueue(identity), true);
assert.equal(requests.at(-1).body.points.length, 1, 'Los puntos imposibles de guardar no se envían');
assert.equal(stored().length, 0, 'Y tampoco se quedan atascando la cola');

// ───────────── Tope de la cola ─────────────
for (let n = 0; n < 5_010; n += 1) store.set(`${scopeKey}:${uuid(1000 + n)}`, { ...point(1000 + n), capturedAt: new Date(clock - (6000 - n) * 1000).toISOString(), key: `${scopeKey}:${uuid(1000 + n)}`, scopeKey, storedAt: '' });
responses = [{ status: 200, body: { acceptedIds: Array.from({ length: 200 }, (_, n) => uuid(1010 + n)) } }];
assert.equal(await queue.flushLocationQueue(identity), true);
assert.equal(requests.at(-1).body.points.length, 200);
assert.equal(requests.at(-1).body.points[0].eventId, uuid(1010), 'Se descartaron los 10 más antiguos antes de enviar');
assert.equal(stored().length, 5_000 - 200, 'La cola queda en el tope menos lo enviado');

// ───────────── Sesión cerrada por el servidor (401): se apaga y no reintenta ─────────────
await settle();
store.clear();
await queue.saveLocationPoint(identity, point(30));
responses = [{ status: 401, body: {} }];
assert.equal(await queue.flushLocationQueue(identity, { force: true }), false);
assert.equal(retryTimers().length, 0, 'Una sesión cerrada no programa reintentos');
assert.equal(await queue.flushLocationQueue(identity, { force: true }), false, 'La sesión quedó inactiva: no envía');

// ───────────── Reconexión del SSE con variación aleatoria ─────────────
const { streamReconnectDelayMs } = await import('../src/app/utils/stream-reconnect.ts');
assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map((attempt) => streamReconnectDelayMs(attempt, () => 0.5)), [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]);
assert.equal(streamReconnectDelayMs(0, () => 0), 500);
assert.equal(streamReconnectDelayMs(0, () => 1), 1_500);
assert.equal(streamReconnectDelayMs(5, () => 1), 45_000);
const spread = new Set(Array.from({ length: 200 }, () => streamReconnectDelayMs(0)));
assert.ok(spread.size > 50, 'Clientes distintos reconectan en instantes distintos');

console.log('force-sales location queue: sanitización, temporizador único con espera respetada, descarte de puntos imposibles, rejectedIds, tope de cola y sesión cerrada pasaron');
