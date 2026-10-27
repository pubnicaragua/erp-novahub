import assert from 'node:assert/strict';
import {
  clearOfflineRouteEligibility,
  getOfflineRouteEligibility,
  persistOfflineRouteEligibility,
} from '../src/app/services/force-sales-location-queue.ts';

const entries = new Map();
globalThis.localStorage = {
  getItem: (key) => entries.get(key) ?? null,
  setItem: (key, value) => entries.set(key, String(value)),
  removeItem: (key) => entries.delete(key),
};

const first = { userId: 'seller-1', tenantId: 'tenant-1' };
const other = { userId: 'seller-2', tenantId: 'tenant-1' };
persistOfflineRouteEligibility(first);
assert.deepEqual(getOfflineRouteEligibility(), first, 'La PWA recuerda solo la identidad autorizada para reanudar la ruta');
const record = JSON.parse(entries.values().next().value);
assert.ok(record.expiresAt > Date.now() && record.expiresAt <= Date.now() + 7 * 24 * 60 * 60 * 1000, 'La elegibilidad local caduca en siete días');
assert.equal(Object.hasOwn(record, 'accessToken'), false, 'El capturador offline no conserva un bearer token');
clearOfflineRouteEligibility(other);
assert.deepEqual(getOfflineRouteEligibility(), first, 'Otra identidad no puede borrar o tomar la jornada pendiente');
clearOfflineRouteEligibility(first);
assert.equal(getOfflineRouteEligibility(), null, 'Finalizar la jornada quita la elegibilidad offline');

console.log('force-sales offline route: scoped resume eligibility and expiry passed');
