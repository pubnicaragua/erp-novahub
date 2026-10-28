import assert from 'node:assert/strict';

class FakeRequest {
  result = undefined;
  onsuccess = null;
  onerror = null;
}

class FakeObjectStore {
  constructor(transaction, name, store) {
    this.transaction = transaction;
    this.name = name;
    this.store = store;
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
    this.transaction.enqueue(() => this.store.records.set(value[this.store.keyPath], structuredClone(value)));
    return new FakeRequest();
  }

  delete(key) {
    this.transaction.enqueue(() => this.store.records.delete(key));
    return new FakeRequest();
  }

  getAll() {
    const request = new FakeRequest();
    this.transaction.enqueue(() => {
      request.result = [...this.store.records.values()].map((value) => structuredClone(value));
      request.onsuccess?.({ target: request });
    });
    return request;
  }

  index(name) {
    assert.equal(name, 'byScope');
    return {
      getAll: (keyRange) => {
        const request = new FakeRequest();
        this.transaction.enqueue(() => {
          request.result = [...this.store.records.values()]
            .filter((value) => value.scopeKey === keyRange.value)
            .map((value) => structuredClone(value));
          request.onsuccess?.({ target: request });
        });
        return request;
      },
    };
  }
}

class FakeTransaction {
  operations = [];
  error = null;
  aborted = false;
  oncomplete = null;
  onabort = null;
  onerror = null;

  constructor(database, storeNames) {
    this.database = database;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    setTimeout(() => this.database.enqueueTransaction(this), 0);
  }

  objectStore(name) {
    assert.ok(this.storeNames.includes(name), `Store ${name} must belong to this transaction`);
    return new FakeObjectStore(this, name, this.database.stores.get(name));
  }

  enqueue(operation) {
    this.operations.push(operation);
  }

  abort() {
    this.aborted = true;
    this.error = new Error('Fake IndexedDB transaction aborted');
    this.onabort?.({ target: this });
  }

  run() {
    while (this.operations.length && !this.aborted) this.operations.shift()();
    if (!this.aborted) this.oncomplete?.({ target: this });
  }
}

class FakeDatabase {
  stores = new Map();
  pendingTransactions = [];
  draining = false;

  constructor(name, version = 0) {
    this.name = name;
    this.version = version;
    this.objectStoreNames = { contains: (storeName) => this.stores.has(storeName) };
  }

  createObjectStore(name, { keyPath }) {
    const store = { keyPath, records: new Map() };
    this.stores.set(name, store);
    return { createIndex: () => undefined };
  }

  transaction(storeNames) {
    return new FakeTransaction(this, storeNames);
  }

  close() {}

  enqueueTransaction(transaction) {
    this.pendingTransactions.push(transaction);
    if (this.draining) return;
    this.draining = true;
    queueMicrotask(() => {
      try {
        while (this.pendingTransactions.length) this.pendingTransactions.shift().run();
      } finally {
        this.draining = false;
        if (this.pendingTransactions.length) this.enqueueTransaction(this.pendingTransactions.shift());
      }
    });
  }
}

const databases = new Map();
globalThis.indexedDB = {
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
globalThis.IDBKeyRange = { only: (value) => ({ value }) };
const localStorageValues = new Map();
globalThis.localStorage = {
  getItem: (key) => localStorageValues.get(key) ?? null,
  setItem: (key, value) => localStorageValues.set(key, String(value)),
  removeItem: (key) => localStorageValues.delete(key),
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { onLine: false },
});

const queue = await import('../src/app/services/force-sales-location-queue.ts');
const identity = { userId: 'seller-1', tenantId: 'tenant-1' };
const otherTenant = { userId: 'seller-1', tenantId: 'tenant-2' };
const now = Date.now();
const owners = ['tab-a', 'tab-b'];
const concurrent = await Promise.all(owners.map((owner) => queue.acquireLocationTrackingLease(identity, owner, now)));
assert.equal(concurrent.filter(Boolean).length, 1, 'Only one tab owns the same user/tenant lease');
const firstOwner = owners[concurrent.indexOf(true)];
const nextOwner = owners.find((owner) => owner !== firstOwner);
assert.equal(await queue.acquireLocationTrackingLease(identity, nextOwner, now + 1000), false, 'A second tab cannot take an unexpired lease');
assert.equal(await queue.renewLocationTrackingLease(identity, nextOwner, now + 1000), false, 'Only the owner can renew a lease');
assert.equal(await queue.acquireLocationTrackingLease(identity, nextOwner, now + 30_001), true, 'A tab can take an expired lease');
assert.equal(await queue.renewLocationTrackingLease(identity, firstOwner, now + 30_002), false, 'A previous owner cannot renew after takeover');
assert.equal(await queue.renewLocationTrackingLease(identity, nextOwner, now + 30_002), true, 'The current owner can renew before expiry');
await queue.releaseLocationTrackingLease(identity, firstOwner);
assert.equal(await queue.acquireLocationTrackingLease(identity, firstOwner, now + 30_003), false, 'An old owner cannot release another tab\'s lease');
assert.equal(await queue.acquireLocationTrackingLease(otherTenant, 'tab-c', now), true, 'A separate tenant has an independent lease');

const point = {
  eventId: '56dc3c4d-ace7-40e8-ad03-234458b9dca1',
  capturedAt: '2026-10-28T16:00:00.000Z',
  lat: 12.1234,
  lng: -86.2345,
};
await assert.rejects(
  queue.saveLocationPoint(identity, point, firstOwner),
  /lease|tracking|seguimiento/i,
  'A callback from a previous tab cannot store a point after lease takeover',
);
assert.equal((await queue.getLocationQueueStatus(identity)).pending, 0, 'Rejected stale callback leaves the queue unchanged');
await queue.saveLocationPoint(identity, point, nextOwner);
await queue.saveLocationPoint(identity, point, nextOwner);
const status = await queue.getLocationQueueStatus(identity);
assert.equal(status.pending, 1, 'Repeated event IDs remain deduplicated in the local queue');
assert.equal(status.lastCapturedAt, point.capturedAt, 'The original GPS timestamp is preserved');
const invalidatedPoint = { ...point, eventId: '7e1f1df1-1d4c-47d3-95d7-7d7bf3a69c3c' };
await assert.rejects(
  queue.saveLocationPoint(identity, invalidatedPoint, nextOwner, () => false),
  /lease|vigencia|seguimiento/i,
  'A point whose tracking epoch was invalidated before the IndexedDB write cannot be committed',
);
assert.equal((await queue.getLocationQueueStatus(identity)).pending, 1, 'An invalidated callback leaves the outbox unchanged');

const trackerModule = await import('../src/app/services/force-sales-location-tracker.ts');
const { createForceSalesLocationTracker, isFreshLocationTimestamp } = trackerModule;
const freshnessNow = 1_798_300_000_000;
assert.equal(isFreshLocationTimestamp(new Date(freshnessNow - 90_000).toISOString(), freshnessNow), true, 'A capture exactly 90 seconds old is still recent');
assert.equal(isFreshLocationTimestamp(new Date(freshnessNow - 90_001).toISOString(), freshnessNow), false, 'A capture older than 90 seconds is stale');
assert.equal(isFreshLocationTimestamp(new Date(freshnessNow + 1).toISOString(), freshnessNow), false, 'A future GPS timestamp is never recent');
assert.equal(isFreshLocationTimestamp('not-a-date', freshnessNow), false, 'An invalid GPS timestamp is never recent');

function makeBrowser({ now = freshnessNow, online = false, visible = true, permission = 'granted' } = {}) {
  let clock = now;
  let isVisible = visible;
  let isOnline = online;
  let geolocationPermission = permission;
  let permissionQueries = 0;
  let nextWatchId = 1;
  let nextTimerId = 1;
  const watches = new Map();
  const timers = new Map();
  const listeners = new Set();
  return {
    now: () => clock,
    isVisible: () => isVisible,
    isOnline: () => isOnline,
    queryPermission: async () => { permissionQueries += 1; return geolocationPermission; },
    watchPosition: (onPosition, onError, options) => {
      const id = nextWatchId++;
      watches.set(id, { onPosition, onError, options });
      return id;
    },
    clearWatch: (id) => watches.delete(id),
    subscribeLifecycle: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    setInterval: (handler, milliseconds) => { const id = nextTimerId++; timers.set(id, { handler, milliseconds }); return id; },
    clearInterval: (id) => timers.delete(id),
    get watchCount() { return nextWatchId - 1; },
    get activeWatchCount() { return watches.size; },
    get permissionQueries() { return permissionQueries; },
    get activeCallbacks() { return [...watches.values()].at(-1); },
    setPermission: (value) => { geolocationPermission = value; },
    setVisible: (value) => { isVisible = value; },
    setOnline: (value) => { isOnline = value; },
    async emitLifecycle(event) { await Promise.all([...listeners].map((listener) => listener(event))); },
    async advance(milliseconds) {
      clock += milliseconds;
      await Promise.all([...timers.values()].map(({ handler }) => handler()));
    },
    get clock() { return clock; },
  };
}

function makeQueue({ initialStatus = { pending: 0, lastCapturedAt: null, lastSyncedAt: null }, leaseAvailable = true } = {}) {
  let status = { ...initialStatus };
  let leaseOwner = leaseAvailable ? null : 'another-tab';
  let leaseAvailableNow = leaseAvailable;
  let deferNextSave = null;
  let signalSaveStarted = null;
  const saved = [];
  return {
    adapter: {
      acquireLease: async (_identity, ownerId) => {
        if (leaseOwner && leaseOwner !== ownerId) return false;
        leaseOwner = ownerId;
        leaseAvailableNow = true;
        return true;
      },
      renewLease: async (_identity, ownerId) => leaseAvailableNow && leaseOwner === ownerId,
      releaseLease: async (_identity, ownerId) => { if (leaseOwner === ownerId) leaseOwner = null; },
      getStatus: async () => ({ ...status }),
      async savePoint(_identity, point, ownerId, isCurrent) {
        signalSaveStarted?.();
        if (deferNextSave) await deferNextSave;
        if (!leaseAvailableNow || leaseOwner !== ownerId || isCurrent?.() === false) {
          throw new Error('La captura perdió vigencia o la lease del seguimiento.');
        }
        if (!saved.some((item) => item.eventId === point.eventId)) saved.push({ ...point });
        status = { ...status, pending: saved.length, lastCapturedAt: point.capturedAt };
      },
    },
    saved,
    updateStatus: (next) => { status = { ...next }; },
    syncHistory: () => { status = { ...status, lastSyncedAt: new Date(freshnessNow).toISOString() }; },
    setLeaseAvailable: (value) => { leaseAvailableNow = value; if (!value) leaseOwner = 'another-tab'; },
    holdNextSave() {
      let release;
      deferNextSave = new Promise((resolve) => { release = resolve; });
      const started = new Promise((resolve) => { signalSaveStarted = resolve; });
      return { started, release: () => { deferNextSave = null; signalSaveStarted = null; release(); } };
    },
  };
}

function makePosition(timestamp, { latitude = 12.1234, longitude = -86.2345 } = {}) {
  return {
    timestamp,
    coords: { latitude, longitude, accuracy: 8, heading: 0 },
  };
}

function makeTrackerFixture({ browser = makeBrowser(), queue = makeQueue(), eligible = () => true, onFreshLocation = () => undefined } = {}) {
  const states = [];
  const tracker = createForceSalesLocationTracker({
    identity,
    ownerId: `owner-${Math.random()}`,
    isEligible: eligible,
    browser,
    queue: queue.adapter,
    onState: (state) => states.push(state),
    onFreshLocation,
  });
  return { tracker, browser, queue, states };
}

const readRecentQueue = makeQueue({ initialStatus: {
  pending: 2,
  lastCapturedAt: new Date(freshnessNow - 90_001).toISOString(),
  lastSyncedAt: null,
} });
const liveFixture = makeTrackerFixture({ browser: makeBrowser({ online: false }), queue: readRecentQueue });
await Promise.all([liveFixture.tracker.start(), liveFixture.tracker.start()]);
assert.equal(liveFixture.browser.watchCount, 1, 'Repeated start calls register a single GPS watch');
assert.equal(liveFixture.tracker.getState().gps, 'stale', 'An old queue point does not make the GPS recent');
assert.equal(liveFixture.tracker.getState().online, false, 'Network state stays independent from GPS state');
assert.equal(liveFixture.tracker.getState().pending, 2, 'Pending history count stays independent from GPS state');
await liveFixture.browser.emitLifecycle();
await liveFixture.browser.emitLifecycle();
assert.equal(liveFixture.browser.watchCount, 1, 'Repeated visibility, focus and pageshow recovery does not duplicate the watch');
await liveFixture.browser.activeCallbacks.onPosition(makePosition(freshnessNow - 90_001));
assert.equal(readRecentQueue.saved.length, 0, 'A stale cached callback is not persisted');
assert.equal(liveFixture.tracker.getState().gps, 'stale', 'A stale callback cannot make historical GPS recent');
await liveFixture.browser.activeCallbacks.onPosition(makePosition(freshnessNow));
assert.equal(readRecentQueue.saved.length, 1, 'A fresh new position is persisted');
assert.equal(liveFixture.tracker.getState().gps, 'recent', 'A newly persisted position marks GPS recent');
await liveFixture.browser.activeCallbacks.onPosition(makePosition(freshnessNow - 90_001));
assert.equal(readRecentQueue.saved.length, 1, 'A stale cached callback is not persisted');
assert.equal(liveFixture.tracker.getState().gps, 'recent', 'A stale cached callback does not replace a newer GPS reading');
await liveFixture.tracker.destroy();

const synchronizedHistoryQueue = makeQueue({ initialStatus: {
  pending: 0,
  lastCapturedAt: new Date(freshnessNow - 90_001).toISOString(),
  lastSyncedAt: new Date(freshnessNow).toISOString(),
} });
const synchronizedHistoryFixture = makeTrackerFixture({ queue: synchronizedHistoryQueue });
await synchronizedHistoryFixture.tracker.refresh();
assert.equal(synchronizedHistoryFixture.tracker.getState().gps, 'stopped', 'An inactive tracker stays stopped when only historical points were synchronized');
await synchronizedHistoryFixture.tracker.start();
assert.equal(synchronizedHistoryFixture.tracker.getState().gps, 'stale', 'Historical queue synchronization does not renew GPS freshness');
await synchronizedHistoryFixture.tracker.destroy();

const recoveryFixture = makeTrackerFixture({ browser: makeBrowser(), queue: makeQueue() });
await recoveryFixture.tracker.start();
await recoveryFixture.browser.advance(90_000);
assert.equal(recoveryFixture.browser.watchCount, 2, 'No GPS read for 90 seconds restarts the watch');
await recoveryFixture.browser.advance(59_999);
assert.equal(recoveryFixture.browser.watchCount, 2, 'Restart cooldown prevents another GPS watch before 60 seconds');
await recoveryFixture.browser.advance(1);
assert.equal(recoveryFixture.browser.watchCount, 3, 'A stale watch can restart again when the 60-second cooldown expires');
await recoveryFixture.tracker.destroy();

const deniedBrowser = makeBrowser({ permission: 'denied' });
const deniedFixture = makeTrackerFixture({ browser: deniedBrowser });
await deniedFixture.tracker.start();
await deniedBrowser.emitLifecycle();
await deniedBrowser.emitLifecycle();
assert.equal(deniedBrowser.watchCount, 0, 'A denied permission does not trigger repeated geolocation requests');
assert.equal(deniedBrowser.permissionQueries, 1, 'Automatic recovery does not repeat permission requests after denial');
assert.equal(deniedFixture.tracker.getState().gps, 'denied', 'Denied permission is exposed as a blocked GPS state');
deniedBrowser.setPermission('granted');
await deniedFixture.tracker.retry();
assert.equal(deniedBrowser.watchCount, 1, 'Manual retry can resume after permission is granted');
await deniedFixture.tracker.destroy();

const revokedPermissionBrowser = makeBrowser();
const revokedPermissionFixture = makeTrackerFixture({ browser: revokedPermissionBrowser });
await revokedPermissionFixture.tracker.start();
revokedPermissionBrowser.setPermission('denied');
await revokedPermissionBrowser.emitLifecycle();
assert.equal(revokedPermissionBrowser.activeWatchCount, 0, 'Returning to the page checks permission again and stops a revoked watch');
assert.equal(revokedPermissionFixture.tracker.getState().gps, 'denied', 'Permission revoked while hidden is reported as blocked');
const permissionQueriesAfterRevoke = revokedPermissionBrowser.permissionQueries;
await revokedPermissionBrowser.emitLifecycle();
assert.equal(revokedPermissionBrowser.permissionQueries, permissionQueriesAfterRevoke, 'After a denied state, lifecycle events do not repeat permission queries');
revokedPermissionBrowser.setPermission('granted');
await revokedPermissionFixture.tracker.retry();
assert.equal(revokedPermissionBrowser.activeWatchCount, 1, 'Manual retry verifies the restored permission and starts a new watch');
await revokedPermissionFixture.tracker.destroy();

const sharedTabQueue = makeQueue();
const firstTab = makeTrackerFixture({ browser: makeBrowser(), queue: sharedTabQueue });
const secondTab = makeTrackerFixture({ browser: makeBrowser(), queue: sharedTabQueue });
await firstTab.tracker.start();
await secondTab.tracker.start();
assert.equal(firstTab.browser.activeWatchCount, 1, 'The first tab owns the only active watch for this identity');
assert.equal(secondTab.browser.activeWatchCount, 0, 'A different tab cannot open a second active GPS watch');
assert.equal(secondTab.tracker.getState().gps, 'other-tab', 'A competing tab exposes the cross-tab owner state');
await firstTab.tracker.destroy();
await secondTab.tracker.refresh();
assert.equal(secondTab.browser.activeWatchCount, 1, 'A waiting tab can acquire the lease after the owner closes');
await secondTab.tracker.destroy();

const pauseFixture = makeTrackerFixture();
await pauseFixture.tracker.start();
const callbackBeforePause = pauseFixture.browser.activeCallbacks;
await pauseFixture.tracker.pause();
await callbackBeforePause.onPosition(makePosition(pauseFixture.browser.clock));
await pauseFixture.browser.emitLifecycle();
assert.equal(pauseFixture.queue.saved.length, 0, 'A callback after pause cannot save a point');
assert.equal(pauseFixture.browser.watchCount, 1, 'Lifecycle recovery does not reactivate a user-paused route');
assert.equal(pauseFixture.tracker.getState().gps, 'paused', 'Pause has its own explicit GPS state');
await pauseFixture.tracker.resume();
assert.equal(pauseFixture.browser.watchCount, 2, 'Explicit resume may start a new watch');
await pauseFixture.tracker.destroy();

const crossTabPauseFixture = makeTrackerFixture();
await crossTabPauseFixture.tracker.start();
const callbackBeforeCrossTabPause = crossTabPauseFixture.browser.activeCallbacks;
const sharedPauseKey = `novaForceSalesTrackingPausedV1:${queue.locationScopeKey(identity)}`;
localStorage.setItem(sharedPauseKey, 'true');
await callbackBeforeCrossTabPause.onPosition(makePosition(crossTabPauseFixture.browser.clock));
assert.equal(crossTabPauseFixture.queue.saved.length, 0, 'A shared pause invalidates GPS callbacks before the storage event is delivered');
await crossTabPauseFixture.browser.emitLifecycle({ type: 'storage', key: sharedPauseKey, newValue: 'true' });
assert.equal(crossTabPauseFixture.tracker.getState().gps, 'paused', 'A pause in another tab stops the current watch');
localStorage.removeItem(sharedPauseKey);
await crossTabPauseFixture.tracker.destroy();

const lostLeaseFixture = makeTrackerFixture();
await lostLeaseFixture.tracker.start();
const callbackBeforeLeaseLoss = lostLeaseFixture.browser.activeCallbacks;
lostLeaseFixture.queue.setLeaseAvailable(false);
await lostLeaseFixture.browser.advance(10_000);
await callbackBeforeLeaseLoss.onPosition(makePosition(lostLeaseFixture.browser.clock));
assert.equal(lostLeaseFixture.queue.saved.length, 0, 'A tab that lost its lease cannot persist a late GPS callback');
assert.equal(lostLeaseFixture.tracker.getState().gps, 'other-tab', 'Lease loss reports that another tab owns tracking');
await lostLeaseFixture.tracker.destroy();

const delayedQueue = makeQueue();
const delayedSave = delayedQueue.holdNextSave();
const delayedFixture = makeTrackerFixture({ queue: delayedQueue });
await delayedFixture.tracker.start();
const saveStarted = delayedFixture.browser.activeCallbacks.onPosition(makePosition(delayedFixture.browser.clock));
await delayedSave.started;
await delayedFixture.tracker.pause();
delayedSave.release();
await saveStarted;
assert.equal(delayedQueue.saved.length, 0, 'A pending IndexedDB write is rejected when its callback epoch is invalidated');
await delayedFixture.tracker.resume();
await delayedFixture.tracker.destroy();

const destroyFixture = makeTrackerFixture();
await destroyFixture.tracker.start();
const callbackBeforeDestroy = destroyFixture.browser.activeCallbacks;
await destroyFixture.tracker.destroy();
await callbackBeforeDestroy.onPosition(makePosition(destroyFixture.browser.clock));
assert.equal(destroyFixture.queue.saved.length, 0, 'A callback arriving after destroy cannot save a point');

let eligible = true;
const identityChangeFixture = makeTrackerFixture({ eligible: () => eligible });
await identityChangeFixture.tracker.start();
const callbackBeforeIdentityChange = identityChangeFixture.browser.activeCallbacks;
eligible = false;
await callbackBeforeIdentityChange.onPosition(makePosition(identityChangeFixture.browser.clock));
assert.equal(identityChangeFixture.queue.saved.length, 0, 'A callback cannot save after session identity/elegibility changes');
await identityChangeFixture.tracker.refresh();
assert.equal(identityChangeFixture.tracker.getState().enabled, false, 'Lost eligibility stops the current watch');
await identityChangeFixture.tracker.destroy();

console.log('force-sales tracking controller: cross-tab lease, fresh-only GPS, 90/60 recovery, denied permission, pause, stale/destroyed callbacks and independent network/queue state passed');
