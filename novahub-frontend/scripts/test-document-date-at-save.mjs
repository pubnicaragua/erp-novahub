// Regression test: a document's default timestamp must describe when the user saves it,
// while a date the user changed and existing documents remain untouched.
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
const { resolveDocumentDateAtSave } = mod.exports;

assert.equal(typeof resolveDocumentDateAtSave, 'function', 'helper resolves a draft date at save time');
const startedAt = '2026-11-27T15:00:00.000Z';
const savedAt = new Date('2026-11-27T15:37:42.321Z');
assert.equal(resolveDocumentDateAtSave(startedAt, startedAt, true, savedAt), savedAt.toISOString());
assert.equal(resolveDocumentDateAtSave('2026-11-27', startedAt, true, new Date('2026-11-28T00:05:00.000Z')), '2026-11-28');
assert.equal(resolveDocumentDateAtSave('2026-11-25T06:00:00.000Z', startedAt, true, savedAt), '2026-11-25T06:00:00.000Z');
assert.equal(resolveDocumentDateAtSave(startedAt, startedAt, false, savedAt), startedAt);
assert.equal(resolveDocumentDateAtSave(startedAt, undefined, true, savedAt), startedAt);

for (const relative of [
  '../src/app/components/ventas/EstimacionesView.tsx',
  '../src/app/components/ventas/OrdenesVentaView.tsx',
]) {
  const component = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
  assert.match(component, /resolveDocumentDateAtSave\(/, `${relative} refreshes the default date when saving`);
  assert.match(component, /_draftStartedAt/, `${relative} keeps the initial date to distinguish edited dates`);
}

console.log('test-document-date-at-save OK');
