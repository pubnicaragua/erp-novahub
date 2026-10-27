import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const htmlPath = new URL('../maps/diseñoui_mapas_freelancers.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');
for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()) {
  const attributes = match[1] || '';
  if (/\bsrc\s*=/.test(attributes) || /type=["'](?:application\/json|application\/ld\+json)/i.test(attributes)) continue;
  new vm.Script(match[2], { filename: `force-sales-inline-${index + 1}.js` });
}
const helperScript = html.match(/<script\s+id="nova-force-sales-location-core">([\s\S]*?)<\/script>/i)?.[1];

assert.ok(helperScript, 'Fuerza Comercial debe exponer sus helpers de captura y foco del mapa');

const sandbox = { window: {} };
vm.runInNewContext(helperScript, sandbox, { filename: 'force-sales-location-core.js' });
const locationCore = sandbox.window.NovaForceSalesLocation;
assert.ok(locationCore, 'El helper de ubicación debe estar disponible para el mapa');
assert.equal(locationCore.normalizeCoordinates({ lat: 91, lng: -86 }), null, 'Las coordenadas fuera de rango no deben aceptarse');
assert.equal(locationCore.normalizeCoordinates({ lat: null, lng: -86 }), null, 'Las coordenadas faltantes no deben convertirse en cero');

const candidates = Array.from({ length: 320 }, (_, index) => ({ id: `point-${index}` }));
const focusedPoint = { id: 'just-created' };
const visible = locationCore.selectMapBusinesses({
  filteredBusinesses: [...candidates, { id: 'invalid', lat: null, lng: undefined }],
  allBusinesses: [...candidates, focusedPoint],
  currentBounds: { contains: () => false },
  limit: 100,
  focusedId: focusedPoint.id,
});
assert.equal(visible.length, 1, 'Solo el punto enfocado debe superar el filtro de límites y viewport');
assert.equal(visible[0].id, focusedPoint.id, 'El punto recién creado debe quedar primero y visible');
assert.equal(visible.some(business => business.id === 'invalid'), false, 'Los negocios sin coordenadas no deben romper los límites del mapa');

let markerOptions;
let dragEnd;
const marker = {
  position: { lat: 12.1234567, lng: -86.2345678 },
  addEventListener: (name, callback) => {
    assert.equal(name, 'gmp-dragend');
    dragEnd = callback;
  },
};
let adjustedPosition;
const draftMarker = locationCore.createDraftMarker({
  createMarker: (options) => {
    markerOptions = options;
    return marker;
  },
  position: { lat: 12.1, lng: -86.2 },
  onPositionChange: (position) => { adjustedPosition = position; },
});

assert.equal(draftMarker, marker);
assert.equal(markerOptions.draggable, true, 'El pin provisional debe poder arrastrarse');
assert.equal(markerOptions.gmpDraggable, true, 'El pin debe activar arrastre accesible con Google Maps');
marker.position = { lat: 12.1357911, lng: -86.2468022 };
dragEnd({});
assert.equal(adjustedPosition.lat, 12.1357911);
assert.equal(adjustedPosition.lng, -86.2468022);

const gpsLabel = locationCore.formatCaptureLocation({
  lat: 12.1234567,
  lng: -86.2345678,
  source: 'ubicación actual',
  accuracy: 18.4,
});
assert.match(gpsLabel, /12\.123457, -86\.234568/);
assert.match(gpsLabel, /GPS ±18 m/);
const mapLabel = locationCore.formatCaptureLocation({
  lat: 12.1234567,
  lng: -86.2345678,
  source: 'mapa',
});
assert.match(mapLabel, /Punto seleccionado/);
assert.doesNotMatch(mapLabel, /GPS/);

console.log('force-sales map location: inline syntax, coordinate validation, marker drag, focused visibility, and location labels passed');
