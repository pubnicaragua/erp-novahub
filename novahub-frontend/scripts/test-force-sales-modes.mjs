import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { assembleForceSalesMap } from './build-force-sales-map.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceDir = join(root, 'map-src', 'force-sales');
const read = async (...segments) => (await readFile(join(...segments), 'utf8')).replace(/\r\n/g, '\n');

// --- El HTML publicado es exactamente lo que arman las partes ------------------------------------------------
const manifest = JSON.parse(await read(sourceDir, 'manifest.json'));
const published = await read(root, manifest.output);
assert.equal(published, assembleForceSalesMap(), 'El mapa publicado debe coincidir con sus partes. Ejecuta: node scripts/build-force-sales-map.mjs');

async function listFiles(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(join(directory, entry.name), relative));
    else if (entry.name !== 'manifest.json') files.push(relative);
  }
  return files;
}
const onDisk = (await listFiles(sourceDir)).sort();
assert.deepEqual([...manifest.parts].sort(), onDisk, 'Cada parte debe estar en el manifiesto y cada línea del manifiesto debe ser un archivo (sin partes huérfanas)');

// --- Registro de modos ----------------------------------------------------------------------------------------
const registrySource = await read(sourceDir, 'core', '078-mode-registry.js');
const messages = [];
const registrySandbox = {
  window: { location: { origin: 'https://novahub.test' }, parent: { postMessage: (message, origin) => messages.push({ message, origin }) }, addEventListener() {} },
  requestAnimationFrame: (callback) => { callback(); return 1; },
  URLSearchParams,
};
registrySandbox.window.window = registrySandbox.window;
vm.createContext(registrySandbox);
vm.runInContext(registrySource, registrySandbox);
const modes = registrySandbox.window.NovaForceSalesModes;

const resolved = modes.resolve(new URLSearchParams('modes=visits,delivery&mode=delivery'));
assert.deepEqual(Array.from(resolved.modes), ['visits', 'delivery'], 'El mapa abre con los modos que el ERP habilitó para la empresa');
assert.equal(resolved.mode, 'delivery', 'El modo pedido queda activo cuando está habilitado');
assert.equal(modes.resolve(new URLSearchParams('modes=visits,delivery&mode=prospecting')).mode, 'visits', 'Un modo no habilitado nunca queda activo: se usa el primero habilitado');
assert.deepEqual(Array.from(modes.resolve(new URLSearchParams('')).modes), ['visits', 'prospecting'], 'Sin parámetros (ERP anterior) se conserva visitas + prospección');
assert.deepEqual(Array.from(modes.parseModes('visits, <script>,Delivery,delivery,x')), ['visits', 'delivery'], 'Los identificadores de modo se validan');

assert.equal(modes.layerDefaults('visits', '').basePlaces, false, 'Visitas arranca sin los lugares de Google');
assert.equal(modes.layerDefaults('prospecting', '').basePlaces, true, 'Prospección arranca con los lugares de Google');
assert.equal(modes.layerDefaults('delivery', '').plannedRoutes, true, 'Entregas arranca mostrando la ruta planificada');
assert.equal(modes.layerDefaults('visits', JSON.stringify({ basePlaces: true, gpsTrail: 'sí', otra: true })).basePlaces, true, 'La empresa puede encender una capa en un modo');
assert.equal(modes.layerDefaults('visits', JSON.stringify({ gpsTrail: 'sí' })).gpsTrail, false, 'Solo se aceptan capas booleanas');
assert.equal(modes.layerDefaults('visits', '{no es json').users, true, 'Una configuración dañada vuelve a los valores del modo');

assert.throws(() => modes.register({ id: 'Mal Id' }), /identificador/, 'No se registra un modo sin identificador válido');
modes.register({
  id: 'demo',
  title: 'Demo',
  searchPlaceholder: 'Buscar demo',
  primaryAction: () => ({ label: 'Hacer', disabled: false, run() {} }),
  kpis: () => [{ id: 'a', label: 'A', value: 3 }],
});
modes.activate('demo');
modes.requestSummary();
const summary = messages.at(-1);
assert.equal(summary.origin, 'https://novahub.test', 'El resumen solo se envía al mismo origen');
assert.equal(summary.message.type, 'force-sales-summary');
assert.equal(summary.message.mode, 'demo');
assert.deepEqual(JSON.parse(JSON.stringify(summary.message.primaryAction)), { label: 'Hacer', disabled: false }, 'Al ERP solo viaja la etiqueta de la acción, no su código');
assert.deepEqual(JSON.parse(JSON.stringify(summary.message.kpis)), [{ id: 'a', label: 'A', value: 3 }]);

// --- Cada modo vive en su carpeta y se registra solo ----------------------------------------------------------
const modeFolders = (await readdir(join(sourceDir, 'modes'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
assert.deepEqual(modeFolders.sort(), ['delivery', 'prospecting', 'visits'], 'Tres modos, cada uno en su carpeta');
for (const folder of modeFolders) {
  const modeSource = await read(sourceDir, 'modes', folder, '200-mode.js');
  assert.match(modeSource, new RegExp(`id:'${folder}'`), `modes/${folder}/200-mode.js registra el modo ${folder}`);
  assert.ok(manifest.parts.includes(`modes/${folder}/200-mode.js`), `El manifiesto carga el modo ${folder}`);
}
const registered = new Set(modeFolders);
const modeOnlyTokens = [...published.matchAll(/data-mode-only="([^"]+)"/g)].flatMap((match) => match[1].split(' ').filter(Boolean));
assert.ok(modeOnlyTokens.length > 5, 'El panel marca qué herramientas pertenecen a cada modo');
assert.deepEqual(modeOnlyTokens.filter((token) => !registered.has(token)), [], 'Todo data-mode-only usa un modo registrado');

// --- Interfaz limpia por modo ---------------------------------------------------------------------------------
const sidebar = await read(sourceDir, 'panel', '040-sidebar.html');
const prospectingBlock = sidebar.slice(sidebar.indexOf('<section class="mode-block" data-mode-only="prospecting"'), sidebar.indexOf('</section>'));
for (const id of ['searchNearby', 'nearbyRadius', 'searchViewport', 'zoneChips', 'filtersPanel']) {
  assert.ok(prospectingBlock.includes(`id="${id}"`), `${id} pertenece solo al modo Prospección`);
}
const moreTools = sidebar.slice(sidebar.indexOf('id="moreToolsPanel"'), sidebar.indexOf('<!-- Controles internos del motor'));
for (const id of ['mapLayersPanel', 'labels', 'refresh', 'clearGoogleCache', 'mapConfigurationButton']) {
  assert.ok(moreTools.includes(`id="${id}"`), `${id} queda dentro del menú «Más», no en el panel principal`);
}
assert.doesNotMatch(sidebar.slice(0, sidebar.indexOf('id="moreToolsPanel"')), /id="refresh"|id="labels"|id="mapLayersPanel"/, 'El panel principal ya no muestra Actualizar negocios, Nombres de puntos ni Capas');
assert.match(sidebar, /<div class="engine-controls" hidden/, 'Los controles internos del motor (indicadores, pestañas, buscador) quedan ocultos: los maneja el ERP');
assert.doesNotMatch(published, /id="forceSalesMode"|id="saveForceSalesMode"/, 'El modo ya no se cambia desde el mapa: lo activa el super admin por empresa');
assert.match(published, /\[data-mode-hidden\],body:not\(\[data-mode\]\) \[data-mode-only\]\{display:none!important\}/, 'Lo que no es del modo activo se oculta sin parpadeo mientras carga el mapa');

// --- El mapa usa el modo en el arranque -------------------------------------------------------------------------
assert.match(published, /const ACTIVE_MODE_STATE = window\.NovaForceSalesModes\.resolve\(mapQuery\)/, 'El mapa lee el modo activo y los habilitados de la URL');
assert.match(published, /mapLayerStorageKey\(CURRENT_TENANT_ID,CURRENT_USER_ID,ACTIVE_MODE\)/, 'Las capas se guardan por modo');
assert.match(published, /normalizeMapLayers\(savedMapLayers,MODE_LAYER_DEFAULTS\)/, 'Cada modo arranca con las capas que la empresa definió');
assert.match(published, /let LEAD_DISCOVERY_ENABLED = ACTIVE_MODE === 'prospecting'/, 'Los negocios de Google solo se cargan en el modo Prospección');
assert.match(published, /mapId: CAN_TOGGLE_BASE_PLACES&&!mapLayers\.basePlaces\?GOOGLE_CLEAN_MAP_ID:GOOGLE_MAP_ID/, 'Sin lugares de Google el mapa usa el Map ID limpio');
assert.match(published, /window\.NovaForceSalesModes\.activate\(ACTIVE_MODE\);\s*window\.NovaForceSalesModes\.bind\(\);/, 'El arranque activa el modo y escucha la búsqueda y la acción principal del ERP');

// --- Navegación con Waze y Google Maps ------------------------------------------------------------------------------
assert.match(published, /function nextNavigationStop\(route\)/, 'La parada que se abre en Waze y Google Maps es la misma que dibuja el mapa');
assert.match(published, /id="routeOpenFullGoogleMaps"/, 'La ruta completa se puede abrir en Google Maps');
assert.doesNotMatch(published, /waze\.com\/ul\?ll=[^`']*&q=/, 'Ningún enlace de Waze lleva el texto de búsqueda «q»');

// --- Lado React: modos, resumen y URL del mapa -------------------------------------------------------------------------
const react = await import(new URL('../src/app/components/force-sales/forceSalesModes.ts', import.meta.url));
assert.deepEqual(react.enabledModesFromConfig({ enabledModes: ['delivery', 'visits'] }), ['delivery', 'visits']);
assert.deepEqual(react.enabledModesFromConfig({}), ['visits', 'prospecting'], 'Un backend anterior conserva visitas + prospección');
assert.deepEqual(react.enabledModesFromConfig({ enabledModes: ['visits', '<x>', 7] }), ['visits'], 'Se descartan modos con identificador inválido');
assert.equal(react.resolveActiveMode(['visits', 'delivery'], 'delivery', 'map'), 'delivery', 'Se recuerda el último modo usado');
assert.equal(react.resolveActiveMode(['visits', 'delivery'], 'prospecting', 'map'), 'visits', 'Un modo recordado que ya no está habilitado se ignora');
assert.equal(react.resolveActiveMode(['visits', 'prospecting'], 'visits', 'kanban'), 'prospecting', 'El Kanban pertenece a Prospección');
assert.equal(react.resolveActiveMode(['visits'], null, 'kanban'), null, 'Sin Prospección no hay Kanban');
assert.equal(react.resolveActiveMode([], 'visits', 'map'), null, 'Sin modos habilitados no hay mapa');
assert.equal(react.parseForceSalesSummary({ source: 'otro', type: 'force-sales-summary', mode: 'visits' }), null, 'Se ignoran mensajes que no son del mapa');
const parsed = react.parseForceSalesSummary({
  source: 'novahub-force-sales', type: 'force-sales-summary', mode: 'visits', title: 'Visitas y zonas', searchPlaceholder: 'Buscar cliente',
  primaryAction: { label: 'Nuevo punto', disabled: false },
  kpis: [{ id: 'points', label: 'Clientes', value: 4 }, { id: 'bad' }, { id: 'obj', label: 'Objeto', value: { x: 1 } }],
});
assert.equal(parsed.kpis.length, 2, 'Un indicador incompleto se descarta y un valor no válido se muestra como guion');
assert.equal(parsed.kpis[1].value, '—');
assert.deepEqual(parsed.primaryAction, { label: 'Nuevo punto', disabled: false });

const { buildForceSalesMapUrl } = await import(new URL('../src/app/components/force-sales/forceSalesMapUrl.ts', import.meta.url));
const url = new URL(buildForceSalesMapUrl({
  mapUrl: '/maps/mapa.html', apiBase: 'https://api.test/api', logo: '/logo.png', view: 'map', userId: 'u1', tenantId: 't1',
  platformAdmin: false, canAssignTeam: true, canAssignProspectOwner: false, canLinkCustomer: true, canViewCustomerSummary: true, canOperateAssignedRoutes: true,
  permissions: { registerVisit: true }, mapId: 'MAIN', cleanMapId: 'CLEAN', mapProvider: 'GOOGLE', mapSearchMode: 'EXTERNAL',
  mapsKey: 'k', mode: 'visits', modes: ['visits', 'delivery'], layerDefaults: { basePlaces: false },
}), 'https://novahub.test');
assert.equal(url.searchParams.get('mode'), 'visits');
assert.equal(url.searchParams.get('modes'), 'visits,delivery');
assert.deepEqual(JSON.parse(url.searchParams.get('layerDefaults')), { basePlaces: false });
assert.equal(url.searchParams.get('cleanMapId'), 'CLEAN', 'El Map ID limpio viaja al mapa');
assert.equal(url.searchParams.get('embedded'), '1');
assert.equal(url.searchParams.get('canViewCustomerSummary'), 'true', 'El mapa sabe si el rol puede ver el estado de cuenta del cliente');
assert.equal(url.searchParams.get('mapTileUrl'), null, 'Los parámetros opcionales vacíos no se envían');

// --- Fase B: zonas, ficha de deuda y visitas --------------------------------------------------------------------------
assert.ok(manifest.parts.includes('modes/visits/109-customer-debt.js') && manifest.parts.includes('modes/visits/110-work-zones.js'), 'Zonas y ficha de deuda pertenecen al modo Visitas y zonas');
assert.match(sidebar, /<section class="mode-block work-zones" data-mode-only="visits"/, 'Las zonas de trabajo solo se ven en el modo Visitas y zonas');
assert.match(sidebar, /id="zoneManager" type="button" data-mode-only="prospecting"/, 'El reparto hexagonal de Prospección ya no aparece en Visitas');
for (const id of ['workZoneModal', 'workZoneReassignModal', 'workZoneMovePoints']) assert.ok(published.includes('id="' + id + '"'), id + ' existe en el marcado');
assert.match(published, /function handleWorkZoneMapClick\(event\)/, 'Marcar el centro de una zona pasa por el único manejador de clic del mapa');
assert.match(published, /if\(handleWorkZoneMapClick\(event\)\)return;/, 'El clic del mapa no abre «Nuevo negocio» mientras se marca una zona');
assert.ok(published.includes('/force-sales/zones/${encodeURIComponent(workZoneReassignId)}/reassign'), 'Reasignar una zona llama al endpoint de reasignación');
assert.ok(published.includes('/force-sales/prospects/${id}/customer-summary'), 'La ficha del punto consulta el estado de cuenta del cliente');
assert.ok(published.includes("const CAN_VIEW_CUSTOMER_SUMMARY = mapQuery.get('canViewCustomerSummary') === 'true'"), 'El estado de cuenta solo se pide si el rol puede leer clientes de Ventas');
assert.ok(published.includes('${customerDebtHtml(b)}'), 'El punto muestra cuánto debe el cliente y cuánto lleva al día');
assert.ok(published.includes('${visitHistoryHtml(b)}'), 'El punto muestra las últimas visitas con quién las hizo');
assert.ok(published.includes('visitedAt,...(outcome?{outcome}:{})'), 'La visita envía su resultado al servidor');
assert.ok(published.includes("if(scope.has('routes')&&ACTIVE_MODE==='visits')work.push(loadWorkZones())"), 'Las zonas se actualizan en vivo cuando el servidor avisa un cambio');
const visitsKpis = await read(sourceDir, 'modes', 'visits', '200-mode.js');
assert.match(visitsKpis, /zonesNoOwner/, 'Visitas muestra cuántas zonas están sin gestor');
assert.equal(modes.layerDefaults('visits', '').catalog, true, 'En Visitas los clientes importados (catálogo propio) se ven desde el primer momento');
const dialog = await read(root, 'src', 'app', 'components', 'force-sales', 'ForceSalesCustomerLinkDialog.tsx');
assert.match(dialog, /customersService\.create\(/, 'Si el cliente no existe se crea en Ventas desde el mismo punto');
assert.match(dialog, /canCreate/, 'Crear cliente exige el permiso de Ventas');

console.log('force-sales modes: assembled map, mode registry, per-mode panels, mode permissions, layers, navigation links and shell wiring passed');
