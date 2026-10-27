import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../maps/diseñoui_mapas_freelancers.html', import.meta.url), 'utf8');
for (const [index, match] of [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].entries()) {
  if (/\bsrc\s*=/.test(match[1] || '') || /type=["'](?:application\/json|application\/ld\+json)/i.test(match[1] || '')) continue;
  new vm.Script(match[2], { filename: `force-sales-route-history-${index + 1}.js` });
}

const helperScript = html.match(/<script\s+id="nova-force-sales-location-core">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(helperScript, 'Fuerza Comercial debe exponer el helper de segmentos del recorrido');
const sandbox = { window: {} };
vm.runInNewContext(helperScript, sandbox, { filename: 'force-sales-route-history-core.js' });

const points = [
  { capturedAt: '2026-10-27T10:00:00.000Z', lat: 12, lng: -86 },
  { capturedAt: '2026-10-27T10:02:00.000Z', lat: 12.01, lng: -86.01 },
  { capturedAt: '2026-10-27T10:10:00.000Z', lat: 12.05, lng: -86.05 },
];
const segments = sandbox.window.NovaForceSalesLocation.splitRouteSegments(points);
assert.deepEqual(Array.from(segments, (segment) => segment.length), [2, 1], 'Un hueco mayor a cinco minutos debe crear un corte');
assert.equal(segments.flat().length, points.length, 'Todos los puntos recibidos se conservan y no se interpolan posiciones');
assert.equal(segments[1][0].lat, 12.05, 'El siguiente tramo empieza en una posición real recibida');
const realtimeMapScript = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .map(match => match[2])
  .find(script => script.includes('startForceSalesEventStream')) || '';
const invalidationHandler = realtimeMapScript.match(/if\(event\.type==='notifications-invalidated'&&event\.reason==='updated'\)\{([\s\S]*?)\n\s*\}\s*catch/)
  ?.[1] || '';
assert.match(invalidationHandler, /void\s+loadLocationTrail\(\{fitCamera:false\}\)/, 'Un evento de cambios debe refrescar los puntos GPS también en el mapa activo sin mover la cámara');
assert.doesNotMatch(invalidationHandler, /activeView==='history'[\s\S]*loadLocationTrail/, 'El refresco GPS por SSE no debe depender de estar en Historial');
assert.match(realtimeMapScript, /if\(CAN_ASSIGN_TEAM&&Date\.now\(\)-lastLocationTrailRefreshAt>=15000\)void loadLocationTrail\(\{fitCamera:false\}\)/, 'Los administradores deben reconciliar el recorrido del mapa aunque el SSE se interrumpa');
assert.match(realtimeMapScript, /async function loadLocationTrail\(options=\{\}\)/, 'El cargador de recorridos acepta refrescos que preservan la cámara');
assert.match(realtimeMapScript, /if\(options\.fitCamera\)\{[\s\S]*?googleMap\.fitBounds\(bounds,64\)[\s\S]*?googleMap\.panTo\(/, 'La cámara solo se ajusta cuando la carga se solicita para enfocar el recorrido');
assert.match(realtimeMapScript, /const selectedUser=CAN_ASSIGN_TEAM&&activeView==='history'\?String\(userSelect\?\.value\|\|''\):''/, 'El mapa principal de administradores siempre carga el equipo completo aunque el historial tenga un filtro');

const trackingRuntime = await readFile(new URL('../src/app/components/ForceSalesTrackingRuntime.tsx', import.meta.url), 'utf8');
assert.match(trackingRuntime, /import \{ MapPin \} from 'lucide-react'/, 'El indicador GPS móvil usa un icono pequeño de ubicación');
assert.match(trackingRuntime, /className="[^"]*sm:hidden[^"]*" role="status" aria-label=\{`Estado GPS:/, 'El estado GPS móvil expone el estado solo de forma accesible, sin texto visible');
assert.match(trackingRuntime, /<MapPin className=\{`size-4 \$\{gpsIconClass\}`\} aria-hidden="true" \/>/, 'En móvil solo se muestra el icono de ubicación');
assert.match(trackingRuntime, /<div className="hidden sm:block">[\s\S]*?\{gpsLabel\}[\s\S]*?Pantalla activa/, 'El texto y controles completos se conservan solo desde escritorio');
assert.doesNotMatch(trackingRuntime, /mobileExpanded|Mostrar detalles del rastreo|Buscando GPS.*sm:hidden/, 'El panel móvil no debe expandir ni mostrar las etiquetas del estado GPS');

console.log('force-sales route history: inline syntax and real-point-only gap segmentation passed');
