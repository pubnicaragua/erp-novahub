import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../public/maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()) {
  if (/\bsrc\s*=/.test(match[1] || '') || /type=["'](?:application\/json|application\/ld\+json)/i.test(match[1] || '')) continue;
  new vm.Script(match[2], { filename: `force-sales-route-history-${index + 1}.js` });
}

const helperScript = html.match(/<script\s+id="nova-force-sales-location-core">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(helperScript, 'Fuerza Comercial debe exponer el procesador de historial GPS');
const sandbox = { window: {} };
vm.runInNewContext(helperScript, sandbox, { filename: 'force-sales-route-history-core.js' });

const points = [
  { id: 'third', eventId: 'third', userId: 'seller-1', accuracy: 5, capturedAt: '2026-10-27T10:04:01.000Z', lat: 12.002, lng: -86 },
  { id: 'first', eventId: 'first', userId: 'seller-1', accuracy: 5, capturedAt: '2026-10-27T10:00:00.000Z', lat: 12, lng: -86 },
  { id: 'second', eventId: 'second', userId: 'seller-1', accuracy: 5, capturedAt: '2026-10-27T10:02:00.000Z', lat: 12.001, lng: -86 },
];
const processed = sandbox.window.NovaForceSalesLocation.processLocationTrail(points);
assert.deepEqual(Array.from(processed.segments, segment => Array.from(segment.points, point => point.id)), [['first', 'second']], 'Las posiciones fuera de orden se ordenan y el corte ocurre al superar 120 segundos');
assert.ok(processed.interruptions.some(item => item.reason === 'time-gap'), 'El historial informa el motivo del corte');
assert.equal(processed.originalPoints.length, points.length, 'Las lecturas recibidas permanecen disponibles sin interpolar posiciones');
assert.equal(processed.isolatedPoints[0].point.id, 'third', 'El siguiente tramo empieza en una lectura real recibida, aislada tras la interrupción');
const realtimeMapScript = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .map(match => match[2])
  .find(script => script.includes('function refreshForceSalesData')) || '';
const refreshHandler = realtimeMapScript.match(/function refreshForceSalesData\(event=\{\}\)\{([\s\S]*?)\n\}/)?.[1] || '';
assert.match(refreshHandler, /shouldLoadLocationTrail\(\)&&refreshTrail\)work\.push\(loadLocationTrail\(\{fitCamera:false\}\)\)/, 'Los eventos solo consultan el recorrido mientras su capa o el historial estén abiertos y no mueven la cámara');
assert.match(realtimeMapScript, /function shouldLoadLocationTrail\(\)\{return CAN_ASSIGN_TEAM&&\(\(activeView==='map'&&mapLayers\.gpsTrail\)\|\|activeView==='history'\)\}/, 'El historial no se consulta en segundo plano cuando ambas vistas están cerradas');
assert.match(realtimeMapScript, /if\(event\.data\?\.type==='force-sales-refresh'\)refreshForceSalesData\(event\.data\.event\|\|\{\}\)/, 'El iframe recibe cambios por el stream compartido del shell');
assert.match(realtimeMapScript, /if\(forceSalesRealtimeConnected\)refreshForceSalesData\(\{resource:'location-trail'\}\)/, 'La reconexión solicita reconciliación, limitada por la capa abierta');
assert.match(realtimeMapScript, /if\(shouldLoadLocationTrail\(\)&&Date\.now\(\)-lastLocationTrailRefreshAt>=15000\)void loadLocationTrail\(\{fitCamera:false\}\)/, 'El respaldo de 15 segundos solo corre mientras la capa o el historial estén abiertos');
assert.match(realtimeMapScript, /async function loadLocationTrail\(options=\{\}\)/, 'El cargador de recorridos acepta refrescos que preservan la cámara');
assert.match(realtimeMapScript, /if\(!shouldLoadLocationTrail\(\)\)\{locationTrailRefreshRequested=false;return\}/, 'Una respuesta no inicia consultas de historial si la capa se apagó');
assert.match(realtimeMapScript, /requestId!==locationTrailRequestId\|\|!shouldLoadLocationTrail\(\)/, 'Una respuesta tardía no puede volver a dibujar una capa apagada');
assert.match(realtimeMapScript, /if\(current\.fitCamera&&cameraPoints\.length\)[\s\S]*?googleMap\.fitBounds\(bounds,64\)[\s\S]*?googleMap\.panTo\(/, 'Solo una acción explícita de ver el recorrido cambia el encuadre');
assert.match(realtimeMapScript, /const selectedUser=CAN_ASSIGN_TEAM\?String\(userSelect\?\.value\|\|''\):''/, 'El mapa y el historial consultan el usuario seleccionado, incluido el selector del mapa');
assert.match(html, /function loadRecentGpsCaptures\(\)[\s\S]*force-sales\/location-points/, 'Los estados GPS del equipo se consultan desde el endpoint de historial existente');
assert.match(html, /<b>Presencia:<\/b>[\s\S]*<b>GPS:<\/b>/, 'El popup presenta presencia y GPS como estados distintos');
assert.doesNotMatch(html, /En línea · ubicación actualizada/, 'isOnline no se usa para afirmar que hay un GPS reciente');
assert.doesNotMatch(html, /syncSellerPresence\(lastKnownCoords\)/, 'El mapa no reenvía coordenadas almacenadas al reactivar compartir');

const trackingRuntime = await readFile(new URL('../src/app/components/ForceSalesTrackingRuntime.tsx', import.meta.url), 'utf8');
assert.match(trackingRuntime, /import \{ ChevronDown, ChevronUp, MapPin \} from 'lucide-react'/, 'El indicador GPS móvil usa un icono pequeño de ubicación');
assert.match(trackingRuntime, /aria-expanded=\{panelOpen\}[\s\S]*?aria-controls="force-sales-tracking-panel"/, 'El icono GPS móvil es un control accesible que abre el panel');
assert.match(trackingRuntime, /id="force-sales-tracking-panel"[\s\S]*?aria-label="Estado del rastreo GPS"/, 'El panel GPS tiene nombre y semántica accesibles');
assert.match(trackingRuntime, /GPS reciente|Sin lectura reciente|Permiso bloqueado|Ruta pausada/, 'El panel expone estados GPS separados de la conexión');
assert.match(trackingRuntime, /Puntos pendientes|pending\} punto/, 'El panel muestra el total de puntos pendientes');
assert.match(trackingRuntime, /NovaHub permanece visible/, 'La opción de pantalla activa explica el límite de visibilidad');
assert.doesNotMatch(trackingRuntime, /lastLocation\.current&&Date\.now\(\)-lastPresenceAt\.current/, 'Un temporizador no reenvía una coordenada retenida para renovar presencia');
assert.match(trackingRuntime, /onFreshLocation[\s\S]*?isFreshLocationTimestamp/, 'La presencia parte de un callback GPS nuevo y validado por timestamp');
assert.match(trackingRuntime, /WAKE_LOCK_KEY|novaForceSalesWakeLockV1/, 'La elección de mantener pantalla se conserva por identidad');
assert.match(trackingRuntime, /const handleResume = \(\) => \{\s*if \(eligibleNow\(\)\) void startTracking\(false, false\);/, 'Al volver a Fuerza Comercial o a una ruta elegible, el runtime inicia el coordinador sin duplicar watches');
assert.match(trackingRuntime, /if \(eligibleNow\(\)\) await startTracking\(false, false\);/, 'La primera carga inicia captura solo con sesión, identidad, compartir y módulo/ruta elegibles');

assert.match(realtimeMapScript, /let remoteProspectsRefreshRequested=false/, 'El mapa conserva una invalidación recibida mientras carga prospectos');
assert.match(realtimeMapScript, /if\(remoteProspectsLoading\)\{remoteProspectsRefreshRequested=true;return\}/, 'Un evento SSE durante una consulta activa agenda un refresco posterior');
assert.match(realtimeMapScript, /if\(remoteProspectsRefreshRequested\)\{remoteProspectsRefreshRequested=false;void loadRemoteProspects\(\);\}/, 'La consulta activa vuelve a cargar los prospectos si recibió una invalidación mientras esperaba');
assert.match(realtimeMapScript, /if\(routePlanningMode&&marker\._b\)\{toggleRouteBusiness\(marker\._b\);return;\}/, 'El mapa agrega o quita la parada al pulsar directamente su punto sin abrir su ficha');
assert.match(realtimeMapScript, /const removeStop=\(\)=>\{if\(routePlanningMode\)toggleRouteBusiness\(business\)\}/, 'El marcador numerado permite quitar una parada desde el mapa');
assert.match(realtimeMapScript, /idempotencyKey:routeSaveAttemptKey/, 'La clave de idempotencia del guardado permanece junto al borrador local');
assert.match(realtimeMapScript, /routeSaveAttemptKey=draft\.idempotencyKey\|\|null/, 'Un reintento tras recargar conserva la clave de idempotencia');
assert.doesNotMatch(realtimeMapScript, /if\(active&&!routeDraftDirty&&!hasStoredRouteDraft\(\)\)hydrateRemoteRoute\(active\)/, 'La carga de rutas no abre automáticamente una ruta arbitraria sobre el borrador');
assert.match(realtimeMapScript, /route-stop-selected/, 'Las paradas del borrador tienen una marca visual de alto contraste');
assert.match(realtimeMapScript, /routePlanningMode\|\|mapLayers\.plannedRoutes\?googleMap:null/, 'Las paradas del borrador permanecen visibles aunque la capa de rutas esté apagada');
assert.match(realtimeMapScript, /routeStopKeys=new Set\(routeBusinesses\.map\(keyOf\)\)/, 'Las paradas seleccionadas se excluyen del agrupamiento de puntos comerciales');
assert.match(realtimeMapScript, /activeRouteCount=userId=>routesUnavailable\?null:remoteRoutes\.filter/, 'El selector muestra el número de rutas activas sin interpretar una consulta fallida como cero');
assert.match(html, /id="routeAssigneeHistory" hidden/, 'El historial de rutas queda plegado inicialmente');
assert.doesNotMatch(html, /id="routeFilterAssignee"|id="routeSavedRoute"|id="routeHistoryDate"/, 'El constructor ya no muestra filtros o selectores separados de rutas guardadas');
assert.match(html, /id="routeAssigneeSearch" type="text" role="combobox"[\s\S]*?id="routeAssigneeOptions"[^>]*role="listbox"/, 'El responsable de ruta se elige en un único buscador accesible');
assert.doesNotMatch(html, /Se asignará a \$\{selectedAssigneeName\} al pulsar “Guardar y asignar”/, 'El selector no muestra mensajes de asignación pendientes intrusivos');
assert.match(html, /<button class="save" id="routeSave" type="button">Guardar ruta<\/button>/, 'El constructor deja claro el único guardado de la ruta');
const routeAssigneeTargetHelper = html.match(/function routeAssigneeOptionFromEventTarget\(target\)\{[\s\S]*?\n\}/)?.[0];
assert.ok(routeAssigneeTargetHelper, 'El selector normaliza el destino del evento sin asumir que pertenece al mismo realm DOM');
const findRouteAssigneeOption = vm.runInNewContext(`${routeAssigneeTargetHelper};routeAssigneeOptionFromEventTarget`, { Element: class Element {} });
const expectedRouteOption = { id: 'selected-option' };
const crossRealmRouteTarget = vm.runInNewContext(
  '({nodeType: 1, closest(selector) { return selector === \'#routeAssigneeOptions [role="option"]\' ? option : null; }})',
  { option: expectedRouteOption },
);
assert.equal(findRouteAssigneeOption(crossRealmRouteTarget), expectedRouteOption, 'Un clic cuyo target viene de otro realm DOM encuentra su opción de responsable');
const routeAssigneePickerHandlers = html.match(/const routeAssigneeSearchInput=[\s\S]*?routeAssigneeSearchInput\.addEventListener\('blur'/)?.[0] || '';
assert.match(routeAssigneePickerHandlers, /routeAssigneeOptionFromEventTarget\(event\.target\)/, 'Los eventos de puntero y clic usan el resolver validado para seleccionar el responsable');
assert.match(routeAssigneePickerHandlers, /routeAssigneeOptions\.addEventListener\('pointerdown'/, 'El clic táctil o de ratón selecciona antes de perder el foco del combo');
assert.match(html, /id="routeCatalog"/, 'El panel ofrece un catálogo persistente de rutas para reabrir y reasignar');
assert.match(html, /id="routeVicinityMode"/, 'El constructor ofrece selección de puntos cercanos por cantidad o radio');
assert.match(html, /activeSavedRouteAssigneeId[\s\S]*?String\(assigneeId\|\|''\)!==String\(activeSavedRouteAssigneeId\|\|''\)/, 'La reasignación compara con el responsable persistido de la ruta');
assert.match(html, /class="route-transfer-destination">A: <b id="routeTransferAssigneeName"/, 'La transferencia identifica dinámicamente al responsable elegido');
assert.match(html, /class="route-transfer-checkbox"/, 'La transferencia usa una casilla personalizada');
assert.match(html, /class="route-transfer-title"[\s\S]*class="route-transfer-count"[\s\S]*class="route-transfer-destination"/, 'La opción de transferencia separa título, usuario destino y cantidad');
assert.match(html, /id="routeTransferUnit"/, 'El conteo muestra punto o puntos en singular/plural');
assert.match(html, /id="routeTransferHelp"[\s\S]*transferHelp\.textContent=transferEnabled\?/, 'La ayuda explica el efecto real de activar o dejar desactivada la transferencia');
assert.match(html, /route-transfer-checkbox:checked::after[\s\S]*route-transfer-checkbox:focus-visible/, 'La casilla personalizada muestra confirmación y foco accesible');
assert.match(html, /route-transfer-option:has\(\.route-transfer-checkbox:checked\)/, 'La tarjeta cambia de estado visual al activar la transferencia');
assert.match(html, /<b>Responsable del punto<\/b>[\s\S]*?<b>Responsable de la ruta actual<\/b>/, 'La ficha separa al responsable comercial del responsable de la ruta');
assert.doesNotMatch(html, /id="owner-[^"]+"|<label>Dueño o decisor<\/label>/, 'La ficha ya no expone el dueño o decisor como asignación');
assert.match(html, /c\.contactName=contactName;c\.contactPhone=contactPhone;[\s\S]*?body\.notes=note/, 'Guardar el seguimiento no borra el dueño histórico y conserva contacto/notas');

console.log('force-sales route history: inline syntax and real-point-only gap segmentation passed');
