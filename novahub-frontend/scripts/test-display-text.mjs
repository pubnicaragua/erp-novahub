// Prueba: ningún identificador interno (UUID) llega a pantalla como nombre o título.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(fileURLToPath(new URL('../src/app/utils/displayText.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { firstReadable, isInternalId, cardHeading } = mod.exports;

const uuid = 'd87f58c9-a982-4aea-b70f-876ebe2844af';
assert.equal(isInternalId(uuid), true);
assert.equal(isInternalId('RXP-20261109-D7A73B-3EC5'), false, 'un número de documento no es un id interno');
assert.equal(isInternalId('clx0abcdefghijklmnopqrstu'), true, 'cuid');
assert.equal(isInternalId('Pago de Internet'), false);

assert.equal(firstReadable(undefined, '', uuid, 'C-001'), 'C-001', 'salta vacíos y UUID');
assert.equal(firstReadable(null, uuid), '—', 'si solo hay un UUID, un guion');
assert.equal(firstReadable(uuid, { fallback: 'Sin nombre' }), 'Sin nombre', 'respaldo propio');
assert.equal(firstReadable(0, uuid), '0', 'el cero es un valor legible');

// El caso de la captura: un gasto generado por recurrencia.
const expense = { id: uuid, number: 'RXP-20261109-D7A73B-3EC5', description: 'Pago de Internet' };
assert.deepEqual(cardHeading(expense), { title: 'Pago de Internet', subtitle: 'RXP-20261109-D7A73B-3EC5' }, 'descripción arriba, número debajo, sin repetir');
assert.deepEqual(cardHeading({ id: uuid, number: 'F-100' }), { title: 'F-100', subtitle: '' }, 'sin descripción: el número, sin repetirlo');
assert.deepEqual(cardHeading({ id: uuid }), { title: '—', subtitle: '' }, 'sin nada legible: nunca el UUID');
assert.deepEqual(cardHeading({ id: uuid, name: 'Camión 05', code: 'CAM-05' }), { title: 'Camión 05', subtitle: 'CAM-05' });
console.log('test-display-text OK');
