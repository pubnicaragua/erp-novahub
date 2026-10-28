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
assert.equal(locationCore.isFreshLocationTimestamp(new Date(1_798_300_000_000 - 90_000).toISOString(), 1_798_300_000_000), true, 'El umbral GPS del mapa incluye exactamente 90 segundos');
assert.equal(locationCore.isFreshLocationTimestamp(new Date(1_798_300_000_000 - 90_001).toISOString(), 1_798_300_000_000), false, 'Una coordenada antigua no es una lectura GPS reciente');
assert.equal(locationCore.isFreshLocationTimestamp(new Date(1_798_300_000_001).toISOString(), 1_798_300_000_000), false, 'El mapa rechaza timestamps GPS futuros');
assert.equal(locationCore.presenceGpsState({ capturedAt: new Date(1_798_300_000_000 - 30_000).toISOString(), now: 1_798_300_000_000, historyAvailable: true }), 'recent', 'El estado GPS reciente se determina por capturedAt');
assert.equal(locationCore.presenceGpsState({ capturedAt: null, now: 1_798_300_000_000, historyAvailable: true }), 'stale', 'Sin punto GPS reciente el mapa indica lectura desactualizada');
assert.equal(locationCore.presenceGpsState({ capturedAt: null, now: 1_798_300_000_000, historyAvailable: false }), 'unknown', 'Si no se consulta el historial el mapa no deduce el GPS de presencia');
const showUserLocationSource = html.match(/function showUserLocation\(position\)\{[\s\S]*?\r?\n\}\r?\nfunction presenceContent/)?.[0].replace(/\r?\nfunction presenceContent$/, '');
assert.ok(showUserLocationSource, 'El mapa conserva una entrada comprobable para lecturas GPS originales');
const acceptedPresenceReads = [];
const markerStub = { setPosition() {}, title: '', content: null };
const locationSandbox = {
  window: { NovaForceSalesLocation: locationCore },
  document: { createElement: () => ({ className: '', setAttribute() {} }) },
  google: { maps: { Circle: class { setCenter() {} setRadius() {} } } },
  googleMap: {},
  createMapMarker: () => markerStub,
  setGpsIndicator() {},
  canForceSales: () => true,
  presenceSharingEnabled: true,
  presenceWatchRequested: false,
  startPresenceWatch() {},
  syncSellerPresence: (coords, capturedAt) => acceptedPresenceReads.push({ coords, capturedAt }),
  userLocationMarker: null,
  userLocationCircle: null,
  lastKnownCoords: null,
  Date,
};
vm.createContext(locationSandbox);
vm.runInContext(`${showUserLocationSource}; window.testShowUserLocation = showUserLocation;`, locationSandbox);
const mapNow = Date.now();
assert.equal(locationSandbox.window.testShowUserLocation({ timestamp: mapNow - 90_001, coords: { latitude: 12.1, longitude: -86.2, accuracy: 8 } }), false, 'Una lectura antigua no se dibuja como GPS actual');
assert.equal(acceptedPresenceReads.length, 0, 'Una lectura antigua no publica presencia');
assert.equal(locationSandbox.window.testShowUserLocation({ timestamp: mapNow, coords: { latitude: 12.1, longitude: -86.2, accuracy: 8 } }), true, 'Una lectura nueva puede actualizar el mapa');
assert.equal(acceptedPresenceReads.length, 1, 'La presencia parte de la lectura GPS nueva');
assert.equal(locationSandbox.lastKnownCoords.capturedAt, new Date(mapNow).toISOString(), 'El timestamp original queda junto a las coordenadas retenidas');
assert.ok(locationCore.validateEvidenceFile, 'Fuerza Comercial debe validar fotos antes de reemplazar evidencia');
const validPhoto = locationCore.validateEvidenceFile({ type: 'image/jpeg', size: 1024 }, { allowPdf: false });
assert.equal(validPhoto.valid, true);
assert.equal(validPhoto.error, null);
assert.equal(locationCore.validateEvidenceFile({ type: 'application/pdf', size: 1024 }, { allowPdf: false }).valid, false, 'Un punto nuevo solo admite fotografías');
assert.equal(locationCore.validateEvidenceFile({ type: 'image/jpeg', size: 10 * 1024 * 1024 + 1 }, { allowPdf: false }).error, 'La evidencia supera el límite de 10 MB');
assert.equal(locationCore.validateEvidenceFile({ type: 'application/pdf', size: 1024 }, { allowPdf: true }).valid, true, 'Un seguimiento conserva la opción de adjuntar PDF');
assert.ok(locationCore.visibleFrameArea, 'El panel debe medir el espacio visible aunque el teclado cubra parte del mapa');
const visibleArea = locationCore.visibleFrameArea({ frameTop: 80, frameHeight: 800, viewportTop: 120, viewportHeight: 480 });
assert.equal(visibleArea.top, 40);
assert.equal(visibleArea.bottom, 280);
assert.equal(visibleArea.height, 480);

const cameraAttributes = html.match(/<input id="quickPointCameraInput"([^>]*)>/)?.[1] || '';
const galleryAttributes = html.match(/<input id="quickPointGalleryInput"([^>]*)>/)?.[1] || '';
assert.match(cameraAttributes, /capture="environment"/, 'La opción cámara usa la cámara trasera');
assert.match(galleryAttributes, /accept="image\/\*"/, 'El selector de galería admite fotografías');
assert.doesNotMatch(galleryAttributes, /\bcapture\b/, 'El selector de galería no debe forzar la cámara');
assert.match(html, /Elegir de galería/, 'El panel de punto ofrece seleccionar una imagen existente');
assert.match(html, /id="quickCaptureRemovePhoto"/, 'El usuario puede quitar una foto elegida antes de guardar');
assert.match(html, /id="quickEvidenceCameraInput"[^>]*capture="environment"/, 'Las visitas y seguimientos pueden capturar una fotografía nueva');
assert.match(html, /id="quickEvidenceGalleryInput"[^>]*accept="image\/\*"/, 'Las visitas y seguimientos pueden elegir una fotografía de la galería');
assert.match(html, /id="quickEvidenceInput"[^>]*accept="application\/pdf"/, 'Las visitas y seguimientos conservan la carga de PDF');
assert.match(html, /addEventListener\('cancel'/, 'Cancelar un selector de archivos no descarta el borrador');
assert.match(html, /data-kanban-toggle=.*aria-expanded=.*aria-controls=/, 'El Kanban móvil expone etapas plegables y su estado accesible');
assert.match(html, /@media\(max-width:820px\)[\s\S]*?min-height:44px/, 'Los controles táctiles móviles conservan al menos 44 px');
assert.match(html, /@media\(prefers-reduced-motion:reduce\)/, 'La vista respeta movimiento reducido');
const businessMarkerFactory = html.match(/function markerSvg\(b\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(businessMarkerFactory, 'Los puntos comerciales deben tener un creador de iconos verificable');
const markerSandbox = {
  google: { maps: {
    Size: class Size { constructor(width, height) { this.width = width; this.height = height; } },
    Point: class Point { constructor(x, y) { this.x = x; this.y = y; } },
  } },
  NOVAHUB_ISOTIPO_URL: 'https://example.test/isotipo.svg',
  stateClass: () => 'new',
  userInitials: name => String(name || '').slice(0, 2).toUpperCase(),
  svgDataUrl: svg => svg,
};
vm.createContext(markerSandbox);
vm.runInContext(`${businessMarkerFactory}; globalThis.createBusinessMarkerIcon = markerSvg;`, markerSandbox);
const businessMarkerIcon = markerSandbox.createBusinessMarkerIcon({ priority: 'A' });
assert.equal(businessMarkerIcon.scaledSize.width, 26, 'El isotipo conserva el tamaño base actual de los puntos comerciales');
assert.equal(businessMarkerIcon.responsiveBusinessPoint, true, 'Solo los puntos individuales identifican su icono como responsive');
assert.match(html, /if\(icon\.responsiveBusinessPoint\)wrapper\.classList\.add\('nova-business-point-marker'\)/, 'El tamaño responsive solo se aplica a puntos individuales');
assert.match(html, /@media\(min-width:1024px\)\{\.nova-map-marker-content\.nova-business-point-marker img\{[^}]*width:32px!important;[^}]*height:32px!important;?\}\}/, 'El isotipo de puntos sube a 32 px desde escritorio compacto y el CSS queda limitado a esos puntos');
const clusterMarkerFactory = html.match(/function clusterSvg\(count\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(clusterMarkerFactory, 'Los iconos de grupos deben conservar su creador independiente');
vm.runInContext(`${clusterMarkerFactory}; globalThis.createClusterMarkerIcon = clusterSvg;`, markerSandbox);
assert.equal(markerSandbox.createClusterMarkerIcon(3).scaledSize.width, 24, 'Los grupos de puntos conservan su tamaño actual');
markerSandbox.NOVAHUB_ISOTIPO_URL = '';
assert.equal(markerSandbox.createBusinessMarkerIcon({ priority: 'A' }).scaledSize.width, 42, 'El arte alternativo conserva 42 px');
assert.ok(html.indexOf("type==='ui-context'") < html.indexOf('window.__novaMapsReady.then'), 'El iframe procesa teclado y tema antes de esperar la carga del mapa');
assert.match(html, /quick-capture-hint\{font-size:14px!important/, 'La ayuda de captura conserva legibilidad en móvil');
assert.match(html, /Punto guardado en el dispositivo · sincronizando/, 'El primer feedback identifica el guardado local mientras sincroniza');
assert.match(html, /Punto sincronizado con NovaHub/, 'La sincronización completada se comunica por separado');
const automaticLocationRequest = html.match(/function requestCurrentLocation\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.ok(automaticLocationRequest, 'La política GPS debe poder solicitar ubicación sin mezclarla con acciones de cámara');
assert.doesNotMatch(automaticLocationRequest, /locateMe|panTo|setCenter|flyTo/, 'Actualizar GPS requerido no debe mover la cámara');
assert.match(html, /type==='force-sales-refresh'/, 'El mapa debe aceptar invalidaciones del stream compartido');
assert.match(html, /force-sales-focus-prospect/, 'El mapa debe aceptar destinos de notificaciones con el punto exacto');
assert.match(html, /\/force-sales\/prospects\//, 'El destino puede cargar puntos que no están en el catálogo ya hidratado');
assert.match(html, /crypto\.randomUUID\(\)/, 'Los puntos nuevos usan identificadores UUID y conservan el prefijo legacy quick-');
assert.match(html, /forceSalesRefreshInFlight/, 'Los eventos simultáneos se agrupan para evitar consultas superpuestas');
assert.ok(['Sin sincronizar', 'Reconectando', 'Conectado'].every(status => html.includes(status)), 'El mapa distingue datos no sincronizados, reconexión y stream conectado');
assert.match(html, /type==='force-sales-stream-status'[\s\S]*refreshForceSalesData/, 'La reconexión reconcilia el catálogo compartido');
assert.match(html, /forceSalesSyncErrors\.delete\('catálogo'\)/, 'El mapa limpia el error de sincronización cuando vuelve el catálogo compartido');
assert.doesNotMatch(html, /startForceSalesEventStream/, 'El iframe no abre una segunda conexión SSE');
assert.match(html, /loadLocationTrail\(\{fitCamera:false\}\)/, 'La actualización automática del historial conserva la cámara');
const routeHydration = html.match(/function hydrateRemoteRoute\(route\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.ok(routeHydration, 'Las rutas persistidas se hidratan sin reconstruir el mapa');
assert.doesNotMatch(routeHydration, /panTo|fitBounds|setZoom|flyTo/, 'La ruta seleccionada automáticamente no cambia centro ni zoom');
assert.match(html, /function showUserLocation\(position\)[\s\S]*isFreshLocationTimestamp/, 'El mapa valida el timestamp original antes de aceptar la ubicación');
assert.match(html, /const capturedAt=Number\(position\?\.timestamp\)[\s\S]*capturedAt:new Date\(capturedAt\)\.toISOString\(\)/, 'La última ubicación conserva el timestamp GPS original');
assert.doesNotMatch(html, /syncSellerPresence\(lastKnownCoords\)/, 'Reactivar el compartir no envía una ubicación retenida');
assert.match(html, /function loadRecentGpsCaptures[\s\S]*force-sales\/location-points/, 'El estado GPS del equipo se consulta desde el historial existente');
assert.match(html, /GPS reciente|Sin lectura GPS reciente|GPS sin confirmar/, 'El mapa presenta el estado GPS aparte de presencia');
assert.doesNotMatch(html, /En línea · ubicación actualizada/, 'La presencia en línea no se presenta como prueba de GPS reciente');
const completeRouteStop = html.match(/async function completeCurrentRouteStop\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(completeRouteStop, /freshRouteLocation[\s\S]*isFreshLocationTimestamp/, 'Completar una parada no envía una coordenada almacenada que ya sea antigua');

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
