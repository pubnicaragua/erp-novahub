// Prueba: las flechas de un campo de dinero suben y bajan de a una unidad (500 → 499), no de a centavo (499.99).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(fileURLToPath(new URL('../src/app/utils/inputStep.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { resolveNumberInputStep } = mod.exports;

assert.equal(resolveNumberInputStep('number', undefined, true), 'any', 'campo de moneda: flechas libres');
assert.equal(resolveNumberInputStep('number', '0.01'), 'any', 'step="0.01" se vuelve any');
assert.equal(resolveNumberInputStep('number', 0.01), 'any', 'step={0.01} se vuelve any');
assert.equal(resolveNumberInputStep('number', '.01'), 'any');
assert.equal(resolveNumberInputStep('number', '0.001'), 'any', 'step="0.001" (milésimas) se vuelve any');
assert.equal(resolveNumberInputStep('number', '1'), '1', 'un paso entero se respeta');
assert.equal(resolveNumberInputStep('number', 5), 5, 'un paso de 5 se respeta');
assert.equal(resolveNumberInputStep('number', '0.5'), '0.5', 'un paso de medio se respeta');
assert.equal(resolveNumberInputStep('number', 'any'), 'any');
assert.equal(resolveNumberInputStep('text', '0.01', true), '0.01', 'solo aplica a type=number');
assert.equal(resolveNumberInputStep(undefined, undefined), undefined);

// Con step="any" el navegador sube y baja de a 1; se comprueba la aritmética que verá el usuario.
const press = (value, direction, step) => (step === 'any' ? value + direction : Math.round((value + direction * Number(step)) * 100) / 100);
assert.equal(press(500, -1, '0.01'), 499.99, 'antes: bajaba de a centavo');
assert.equal(press(500, -1, resolveNumberInputStep('number', '0.01')), 499, 'ahora: baja de a una unidad');
console.log('test-input-step OK');
