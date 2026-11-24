// Prueba que la validación del formulario acepte las dos convenciones de límites del backend.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(fileURLToPath(new URL('../src/app/utils/commission-scale.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { areCommissionScaleRulesConsecutive } = mod.exports;

assert.equal(areCommissionScaleRulesConsecutive(5000, 5000.01), true, 'permite el siguiente centavo');
assert.equal(areCommissionScaleRulesConsecutive(5000, 5001), true, 'permite la unidad entera siguiente');
assert.equal(areCommissionScaleRulesConsecutive(5000, 5000.02), false, 'rechaza huecos de dos centavos');
assert.equal(areCommissionScaleRulesConsecutive(5000, 5000), false, 'rechaza solapamientos');
console.log('test-commission-scale OK');
