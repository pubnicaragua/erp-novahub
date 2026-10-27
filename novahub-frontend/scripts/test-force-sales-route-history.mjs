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

console.log('force-sales route history: inline syntax and real-point-only gap segmentation passed');
