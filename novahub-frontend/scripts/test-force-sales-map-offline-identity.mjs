import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
const helperSource = html.match(/<script\s+id="nova-force-sales-offline-identity-core">([\s\S]*?)<\/script>/i)?.[1];

assert.ok(helperSource, 'El mapa debe exponer helpers verificables para aislar la cola offline por identidad');
const sandbox = { window: {}, atob };
vm.runInNewContext(helperSource, sandbox, { filename: 'force-sales-offline-identity-core.js' });
const identity = sandbox.window.NovaForceSalesOfflineIdentity;
assert.ok(identity, 'El mapa debe publicar los helpers de identidad offline');

const sellerA = { tenantId: 'tenant-1', userId: 'seller-1' };
const sellerB = { tenantId: 'tenant-1', userId: 'seller-2' };
const otherTenantSeller = { tenantId: 'tenant-2', userId: 'seller-1' };
assert.notEqual(identity.scopeKey(sellerA), identity.scopeKey(sellerB), 'Dos usuarios del mismo tenant deben tener ámbitos offline distintos');
assert.notEqual(identity.scopeKey(sellerA), identity.scopeKey(otherTenantSeller), 'El mismo usuario en otro tenant debe tener un ámbito offline distinto');
assert.notEqual(identity.localPointsStorageKey(sellerA, true), identity.localPointsStorageKey(sellerB, true), 'Los borradores nuevos se guardan por usuario y tenant');
assert.notEqual(identity.queueKey(sellerA, 'quick-same-key'), identity.queueKey(sellerB, 'quick-same-key'), 'La clave de cola debe impedir que sourceKey coincidentes colisionen entre identidades');
const tokenFor = payload => `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
assert.equal(identity.tokenMatchesIdentity(tokenFor({ sub: sellerA.userId, clientTenantId: sellerA.tenantId }), sellerA), true, 'El token debe coincidir con la identidad del iframe');
assert.equal(identity.tokenMatchesIdentity(tokenFor({ sub: sellerB.userId, clientTenantId: sellerB.tenantId }), sellerA), false, 'Un iframe anterior no debe enviar con el token de otro usuario');

const pendingA = { tenantId: 'tenant-1', userId: 'seller-1', sourceKey: 'quick-1' };
assert.equal(identity.entryMatchesIdentity(pendingA, sellerA), true, 'La cola del propietario debe seguir disponible para sincronización');
assert.equal(identity.entryMatchesIdentity(pendingA, sellerB), false, 'Otro usuario del mismo tenant no debe procesar la cola');
assert.equal(identity.entryMatchesIdentity({ sourceKey: 'legacy' }, sellerA), false, 'Una cola antigua sin identidad no debe enviarse automáticamente');

const localPoints = [
  { id: 'quick-a', createdBy: { id: 'seller-1' } },
  { id: 'quick-b', createdBy: { id: 'seller-2' } },
  { id: 'unknown-owner' },
];
assert.deepEqual(
  identity.selectOwnedPoints(localPoints, sellerA).map(point => point.id),
  ['quick-a'],
  'La carga heredada del tenant debe conservar solo los puntos con creador verificable de la sesión',
);
assert.equal(identity.countPointsWithoutOwner(localPoints), 1, 'Los puntos locales antiguos sin creador verificable se cuentan para advertir que están en cuarentena');

const legacyEntry = { sourceKey: 'quick-a', payload: { clientTenantId: 'tenant-1' }, remoteId: null };
const legacyCaches = [
  { tenantId: 'tenant-1', points: [{ id: 'quick-a', createdBy: { id: 'seller-1' } }] },
  { tenantId: 'tenant-2', points: [{ id: 'quick-a', createdBy: { id: 'seller-2' } }] },
];
assert.deepEqual(JSON.parse(JSON.stringify(identity.findLegacyOwner(legacyEntry, legacyCaches))), sellerA, 'La cola vieja se migra solo con creador local y tenant coincidente');
assert.equal(identity.findLegacyOwner({ ...legacyEntry, remoteId: 'remote-1' }, legacyCaches), null, 'Una actualización remota antigua no permite inferir quién la encoló');
assert.equal(identity.findLegacyOwner({ ...legacyEntry, sourceKey: 'missing' }, legacyCaches), null, 'Las colas sin punto local verificable permanecen bloqueadas');
assert.equal(identity.findLegacyOwner(legacyEntry, [
  { tenantId: 'tenant-1', points: [{ id: 'quick-a', createdBy: { id: 'seller-1' } }] },
  { tenantId: 'tenant-1', points: [{ id: 'quick-a', createdBy: { id: 'seller-2' } }] },
]), null, 'Los registros antiguos ambiguos no deben migrarse');

const migrationWiring = html.match(/function migrateLegacyOfflineProspects\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(migrationWiring, /findLegacyOwner/, 'La cola IndexedDB antigua se migra solo cuando el propietario es demostrable');
assert.match(migrationWiring, /outboxV2|OFFLINE_STORE_V2/, 'La migración conserva la cola antigua separada del store con identidad');
assert.match(html, /readOfflineProspects\(CURRENT_IDENTITY\)/, 'La sincronización y la restauración leen únicamente la cola de la identidad activa');
assert.match(html, /tokenMatchesIdentity\(token,CURRENT_IDENTITY\)/, 'Las solicitudes del iframe dejan de usar un token de una sesión diferente');
assert.match(html, /const LOCAL_POINTS_KEY\s*=\s*window\.NovaForceSalesOfflineIdentity\.localPointsStorageKey/, 'El almacenamiento de puntos nuevos usa el ámbito completo de identidad');
assert.match(html, /legacyLocalPointsWithoutOwner[\s\S]*setForceSalesSyncError/, 'El mapa informa si conserva puntos locales anteriores sin propietario verificable');

const forceRequestSource = html.match(/async function forceSalesRequest\(path, options=\{\}\)\{([\s\S]*?)\n\}/)?.[0];
assert.ok(forceRequestSource, 'Las llamadas API del mapa deben validar la identidad del token');
let attachedToken = null;
let requestCount = 0;
const validRequestSandbox = {
  CURRENT_IDENTITY: sellerA,
  window: { NovaForceSalesOfflineIdentity: identity },
  localStorage: { getItem: () => tokenFor({ sub: sellerA.userId, clientTenantId: sellerA.tenantId }) },
  apiHeaders: token => { attachedToken = token; return { Authorization: `Bearer ${token}` }; },
  fetch: async (_url, options) => {
    requestCount++;
    assert.equal(options.headers.Authorization, `Bearer ${attachedToken}`, 'El request debe usar el mismo token que se validó');
    return { ok: true, text: async () => '{}' };
  },
  API_BASE: '/api',
};
vm.createContext(validRequestSandbox);
vm.runInContext(`${forceRequestSource}; globalThis.testForceSalesRequest=forceSalesRequest;`, validRequestSandbox);
const validToken = tokenFor({ sub: sellerA.userId, clientTenantId: sellerA.tenantId });
validRequestSandbox.localStorage.getItem = () => validToken;
await validRequestSandbox.testForceSalesRequest('/force-sales/prospects');
assert.equal(attachedToken, validToken, 'La llamada API valida y adjunta un único token capturado');
validRequestSandbox.localStorage.getItem = () => tokenFor({ sub: sellerB.userId, clientTenantId: sellerB.tenantId });
await assert.rejects(() => validRequestSandbox.testForceSalesRequest('/force-sales/prospects'), /sesión activa cambió/);
assert.equal(requestCount, 1, 'Un iframe anterior no debe emitir requests con la cuenta nueva');

const readQueueSource = html.match(/async function readOfflineProspects\(identity=CURRENT_IDENTITY\)\{([\s\S]*?)\n\}/)?.[0];
assert.ok(readQueueSource, 'La lectura de cola debe aceptar una identidad explícita');
const queueEntries = [
  { tenantId: 'tenant-1', userId: 'seller-1', identityKey: identity.scopeKey(sellerA), sourceKey: 'quick-a' },
  { tenantId: 'tenant-1', userId: 'seller-2', identityKey: identity.scopeKey(sellerB), sourceKey: 'quick-b' },
];
const queueSandbox = {
  window: { NovaForceSalesOfflineIdentity: identity },
  CURRENT_IDENTITY: sellerA,
  OFFLINE_STORE_V2: 'outboxV2',
  offlineTransaction: async (_mode, operation, storeName) => {
    assert.equal(storeName, 'outboxV2', 'La sincronización usa el store aislado');
    return operation({ index: name => ({ getAll: key => {
      assert.equal(name, 'byIdentity', 'La cola se consulta por índice de identidad');
      return queueEntries.filter(entry => entry.identityKey === key);
    } }) });
  },
};
vm.createContext(queueSandbox);
vm.runInContext(`${readQueueSource}; globalThis.testReadOfflineProspects=readOfflineProspects;`, queueSandbox);
assert.deepEqual(
  (await queueSandbox.testReadOfflineProspects(sellerA)).map(entry => entry.sourceKey),
  ['quick-a'],
  'La función real de lectura no expone elementos de otra cuenta',
);

console.log('force-sales map offline identity: per-user and tenant draft isolation, strict outbox ownership, and safe legacy migration passed');
