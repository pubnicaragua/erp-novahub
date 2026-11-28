// Prueba: una fecha sin hora («2026-12-03») se muestra con el mismo día en cualquier zona horaria.
// Antes salía un día antes en Nicaragua (UTC−6), por ejemplo «Vencimiento final 02/12» con el último abono el 03/12.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(fileURLToPath(new URL('../src/app/utils/dateFormat.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { formatDateEs, formatDateOnly, formatCivilDateTime } = mod.exports;

for (const zone of ['America/Managua', 'UTC', 'Pacific/Auckland', 'America/Los_Angeles']) {
  process.env.TZ = zone;
  assert.equal(formatDateEs('2026-12-03'), '03/12/2026', `fecha civil en ${zone}`);
  assert.equal(formatDateEs('2026-01-01'), '01/01/2026', `primero de año en ${zone}`);
  assert.equal(formatDateEs('2026-12-31'), '31/12/2026', `fin de año en ${zone}`);
  assert.equal(formatDateOnly('2026-11-27T12:00:00.000Z'), formatDateOnly('2026-11-27'), `ancla civil ISO en ${zone}`);
  const dateTime = formatCivilDateTime('2026-11-27T12:00:00.000Z', '2026-11-27T22:05:00.000Z');
  assert.ok(dateTime.startsWith(`${formatDateOnly('2026-11-27')} `), `la fecha comercial no cambia en ${zone}`);
}
process.env.TZ = 'Pacific/Auckland';
assert.equal(formatCivilDateTime('2026-11-27T12:00:00.000Z', '2026-11-27T22:05:00.000Z'), `${formatDateOnly('2026-11-27')} 16:05`, 'usa la zona horaria del tenant, no la del navegador');
assert.equal(formatCivilDateTime('2026-11-27T12:00:00.000Z', null), formatDateOnly('2026-11-27'), 'no inventa una hora si no hay instante real');
assert.equal(formatDateEs(''), '');
assert.equal(formatDateEs(null), '');
assert.equal(formatDateEs('no es fecha'), 'no es fecha');
assert.doesNotThrow(() => formatDateEs('2026-02-30'), 'una fecha imposible no debe romper la pantalla');
assert.equal(formatDateEs(new Date(2026, 11, 3, 15, 30), true), '03/12/2026 15:30');
console.log('test-date-format OK');
