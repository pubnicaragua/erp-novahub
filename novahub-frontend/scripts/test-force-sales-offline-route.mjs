import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const fallback = await readFile(new URL('../src/app/components/ForceSalesOfflineTrackingFallback.tsx', import.meta.url), 'utf8');
const queue = await readFile(new URL('../src/app/services/force-sales-location-queue.ts', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
assert.match(fallback, /createForceSalesLocationTracker/, 'La pantalla offline comparte el coordinador de recuperación');
assert.match(fallback, /getOfflineRouteEligibility[\s\S]*locationScopeKey/, 'El coordinador offline valida la misma identidad local autorizada');
assert.match(fallback, /tracker\.pause\(\)|\.pause\(\)/, 'La persona puede pausar la captura y esa pausa no se reanuda sola');
assert.match(fallback, /tracker\.resume\(\)|\.resume\(\)/, 'Reanudar requiere una acción explícita');
assert.match(fallback, /Reintentar GPS|tracker\.retry\(\)/, 'La pantalla offline ofrece reintento manual del permiso/GPS');
assert.match(fallback, /GPS reciente|Sin lectura reciente|Permiso bloqueado/, 'La pantalla offline distingue estados GPS fiables');
assert.match(fallback, /pending\} punto|Puntos pendientes/, 'La pantalla offline muestra la cantidad de puntos en cola');
assert.match(fallback, /NovaHub permanece visible/, 'La pantalla offline explica el límite de mantener pantalla');
assert.match(fallback, /wakeLock|WAKE_LOCK_KEY/, 'Mantener pantalla es una opción explícita y guardada localmente');
assert.match(queue, /const DATABASE_VERSION\s*=\s*2/, 'La página agrega el store de lease mediante una actualización aditiva');
assert.match(serviceWorker, /indexedDB\.open\(LOCATION_DB_NAME\)/, 'El service worker abre la versión existente de la cola sin pedir una versión inferior');
assert.doesNotMatch(serviceWorker, /indexedDB\.open\(LOCATION_DB_NAME,\s*\d+\)/, 'El service worker no debe fallar con VersionError al leer una base ya actualizada');
assert.match(serviceWorker, /onupgradeneeded[\s\S]*trackingLeases/, 'El service worker crea el store de leases si es quien ejecuta la migración primero');

console.log('force-sales offline route: scoped eligibility, coordinator, pause/retry, state separation and wake lock passed');
