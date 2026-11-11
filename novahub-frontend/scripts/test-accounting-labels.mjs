import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(fileURLToPath(new URL('../src/app/utils/accountingLabels.ts', import.meta.url)), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { accountingDescriptionLabel, accountingModuleOriginLabel } = mod.exports;

assert.equal(
  accountingDescriptionLabel('Ajuste Inventario #ADJ-007 · SURPLUS'),
  'Ajuste de Inventario #ADJ-007',
  'las descripciones históricas no deben exponer el motivo contable interno',
);
assert.equal(accountingDescriptionLabel('Ajuste de Inventario #ADJ-007'), 'Ajuste de Inventario #ADJ-007');
assert.equal(accountingModuleOriginLabel('INVENTORY_ADJUSTMENT'), 'Inventario');
console.log('test-accounting-labels OK');
