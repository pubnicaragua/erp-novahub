import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
const helperScript = html.match(/<script\s+id="nova-force-sales-location-core">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(helperScript, 'El mapa debe exponer los helpers puros de capas y recorridos');

const sandbox = { window: {} };
vm.runInNewContext(helperScript, sandbox, { filename: 'force-sales-map-layers-core.js' });
const core = sandbox.window.NovaForceSalesLocation;
assert.ok(core?.processLocationTrail, 'El filtrado de historial GPS debe poder probarse sin mapas ni red');

const base = Date.parse('2026-10-27T10:00:00.000Z');
const point = (id, offsetSeconds, lngOffset, overrides = {}) => ({
  id,
  eventId: id,
  userId: 'seller-a',
  userName: 'Vendedor A',
  capturedAt: new Date(base + offsetSeconds * 1000).toISOString(),
  lat: 12,
  lng: -86 + lngOffset,
  accuracy: 5,
  ...overrides,
});

const continuous = [
  point('p3', 20, 0.0002),
  point('p1', 0, 0),
  point('p2', 10, 0.0001),
  point('p2-duplicate', 10, 0.0001, { eventId: 'p2' }),
];
const cleaned = core.processLocationTrail(continuous);
assert.deepEqual(Array.from(cleaned.segments, (segment) => Array.from(segment.points, (item) => item.id)), [['p1', 'p2', 'p3']], 'Capturas desordenadas se ordenan y los eventos duplicados no producen líneas dobles');
assert.equal(cleaned.duplicateCount, 1);
assert.equal(cleaned.usedCount, 3);

const broken = core.processLocationTrail([
  point('start', 0, 0),
  point('time-gap', 121, 0.0001),
  point('distance-gap', 131, 0.01),
  point('speed-gap', 141, 0.02),
  point('bad-accuracy', 151, 0.021, { accuracy: 101 }),
  point('bad-coordinates', 161, 0.022, { lat: 91 }),
  point('unknown-accuracy', 171, 0.023, { accuracy: null }),
]);
assert.ok(broken.interruptions.some((item) => item.reason === 'time-gap'), 'Un salto temporal mayor a dos minutos debe cortar el tramo');
assert.ok(broken.interruptions.some((item) => item.reason === 'distance-gap'), 'Un salto mayor a 300 metros debe cortar el tramo');
assert.ok(broken.interruptions.some((item) => item.reason === 'speed-gap'), 'Una velocidad mínima imposible debe cortar el tramo');
assert.equal(broken.discardedCount, 2, 'Las coordenadas inválidas y la precisión superior a 100 metros se descartan solo de la vista');
assert.ok(broken.isolatedPoints.some((item) => item.reason === 'unknown-accuracy'), 'Una lectura sin precisión se muestra aislada y nunca se conecta');

const quiet = core.processLocationTrail([
  point('quiet-1', 0, 0, { accuracy: 12 }),
  point('quiet-2', 10, 0.00002, { accuracy: 12 }),
  point('quiet-3', 20, 0.00003, { accuracy: 12 }),
]);
assert.equal(quiet.segments.length, 0, 'El ruido dentro de la incertidumbre no debe dibujar una trayectoria');
assert.ok(quiet.isolatedPoints.some((item) => item.reason === 'gps-noise-stop' && item.samples >= 2), 'El ruido se representa como parada resumida');

const layers = core.normalizeMapLayers({ users: false, manualPoints: false, catalog: true, plannedRoutes: true, gpsTrail: true });
assert.deepEqual({ ...layers }, { users: false, manualPoints: false, catalog: true, plannedRoutes: true, gpsTrail: false, labelMode: 'off' }, 'El recorrido GPS inicia apagado y los nombres de puntos se ocultan por defecto');
assert.deepEqual({ ...core.DEFAULT_MAP_LAYERS }, { users: true, manualPoints: true, catalog: false, plannedRoutes: false, gpsTrail: false, labelMode: 'off' }, 'La vista limpia muestra usuarios y puntos manuales sin etiquetas');
assert.equal(core.normalizeMapLayers({ labelMode: 'all' }).labelMode, 'all', 'La preferencia de etiquetas se conserva al restaurar las capas');
assert.equal(core.normalizeMapLayers({ labelMode: 'unknown' }).labelMode, 'off', 'Un modo de etiquetas inválido vuelve al valor seguro oculto');
assert.equal(core.mapLayerStorageKey('tenant-1', 'user-2'), 'novaForceSalesMapLayersV1:tenant-1:user-2', 'Las preferencias se aíslan por usuario y tenant');
assert.equal(core.getBusinessLayer({ sourceKey: 'quick-abc', id: 'record-1' }), 'manualPoints', 'Los puntos quick- se clasifican como marcados manualmente');
assert.equal(core.getBusinessLayer({ id: 'quick-legacy' }), 'manualPoints', 'Los puntos quick- locales antiguos conservan su clasificación');
assert.equal(core.getBusinessLayer({ sourceKey: 'import-123', id: 'record-2' }), 'catalog', 'Las importaciones permanecen en el catálogo');
assert.equal(core.isBusinessVisibleInLayers({ sourceKey: 'quick-abc' }, layers), false);
assert.equal(core.isBusinessVisibleInLayers({ sourceKey: 'import-123' }, layers), true);
assert.equal(core.isBusinessVisibleInLayers({ id: 'quick-abc', sourceKey: 'quick-abc' }, layers, 'quick-abc'), true, 'Una notificación puede enfocar temporalmente un punto oculto por capas');
assert.equal(core.trailColorForUser('seller-a'), core.trailColorForUser('seller-a'), 'El color se mantiene estable por usuario');
assert.notEqual(core.trailColorForUser('seller-a'), core.trailColorForUser('seller-b'), 'Usuarios distintos reciben una leyenda distinguible');

const style = JSON.parse(await readFile(new URL('../maps/force-sales-clean-map-style.json', import.meta.url), 'utf8'));
const hiddenFeatures = new Set(style.filter(item => item.stylers?.some(styler => styler.visibility === 'off')).map(item => item.featureType));
assert.ok(hiddenFeatures.has('poi') && hiddenFeatures.has('transit'), 'El estilo de Google oculta puntos de interés y transporte');
assert.ok(style.some(item => item.featureType === 'road' && item.elementType === 'geometry' && item.stylers?.some(styler => styler.visibility === 'on')), 'El estilo conserva geometría de calles');
assert.ok(style.some(item => item.featureType === 'administrative.neighborhood' && item.elementType === 'labels.text' && item.stylers?.some(styler => styler.visibility === 'on')), 'El estilo fijo conserva los nombres de los barrios');
const mapPage = await readFile(new URL('../src/app/components/FuerzaComercialPage.tsx', import.meta.url), 'utf8');
assert.match(mapPage, /VITE_GOOGLE_MAPS_MAP_ID/, 'El Map ID de producción se inyecta desde el entorno del frontend');

assert.match(html, /id="mapLayersPanel"/, 'El usuario debe tener un panel de capas accesible');
assert.match(html, /Elementos de NovaHub/, 'El panel distingue las capas propias de NovaHub del mapa base');
assert.match(html, /Lugares del mapa base/, 'El panel identifica que los POI pertenecen al mapa base');
assert.match(html, /id="labels"[\s\S]*?data-mode="off"[^>]*aria-pressed="true"/, 'Ocultar etiquetas de puntos es la opción inicial accesible');
assert.match(html, /Nombres de puntos NovaHub/, 'El control de etiquetas se refiere a los negocios marcados en NovaHub');
assert.match(html, /Restablecer vista limpia/, 'El usuario puede volver a la vista limpia');
assert.match(html, /Ver lecturas originales/, 'El recorrido ofrece una vista diagnóstica de lecturas aisladas');
assert.match(html, /Precisión desconocida/, 'La UI identifica lecturas sin precisión conocida');
assert.match(html, /Trayectoria GPS aproximada/, 'La UI aclara que el historial no es una ruta exacta por calles');
assert.match(html, /VITE_GOOGLE_MAPS_MAP_ID|mapId/, 'La configuración del mapa puede recibir el Map ID de estilo');
assert.match(html, /mapProvider.*OPENSTREETMAP|etiquetas.*proveedor/i, 'La vista informa que los mosaicos externos controlan sus propias etiquetas');
assert.match(html, /mapId: mapQuery\.get\('mapId'\) \|\| 'DEMO_MAP_ID'/, 'Google conserva el Map ID para los estilos fijos y marcadores avanzados');
assert.match(html, /window\.__novaAdvancedMarkerElement/, 'La vista conserva AdvancedMarkerElement y no cambia a OverlayView');
assert.match(html, /sourceKey:prospect\.sourceKey/, 'La transformación conserva el origen del punto que devuelve el backend');
assert.match(html, /function updateMapLayerVisibility\(\)[\s\S]*presenceMarkers\.forEach[\s\S]*routeStopMarkers\.forEach/, 'Las capas de usuarios y rutas controlan la visibilidad de sus marcadores');
assert.match(html, /layerVisibleBusinesses=businesses\.filter[\s\S]*updatePipelineKpis\(layerVisibleBusinesses\)/, 'El listado y los contadores reflejan las capas comerciales activas');
assert.match(html, /if\(!closingInfoWindowForRefresh&&focusedQuickPointBusinessId\)/, 'Cerrar la ficha de una notificación termina el foco temporal y restaura las capas');

console.log('force-sales map layers: GPS filtering, clean defaults, scoped preferences, manual-point layers, and style affordances passed');
