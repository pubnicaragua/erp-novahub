// Prueba: el redondeo del frontend es idéntico al del servidor (Prisma.Decimal, ROUND_HALF_CEIL) en 4000 vectores.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const load = (rel) => {
  const source = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, () => ({}));
  return mod.exports;
};
const { roundDecimal } = load('../src/app/utils/currency.ts');

const vectors = JSON.parse(readFileSync(fileURLToPath(new URL('./fixtures/round-vectors.json', import.meta.url)), 'utf8'));
const bad = vectors.filter(([value, places, expected]) => roundDecimal(value, places) !== expected);
assert.equal(bad.length, 0, `${bad.length} redondeos difieren del servidor, p. ej. ${JSON.stringify(bad.slice(0, 3))}`);

assert.equal(roundDecimal(1264.725, 2), 1264.73);
assert.equal(roundDecimal(132.795, 2), 132.8);
assert.equal(roundDecimal(-2.5, 0), -2, 'ROUND_HALF_CEIL: el empate negativo sube hacia cero');
assert.equal(roundDecimal('1,234.565', 2), 1234.57);
assert.equal(roundDecimal(NaN, 2), 0);

// Sin centavos sueltos: un importe ya redondeado no cambia, y convertir ida y vuelta con tasa exacta lo conserva.
for (let cents = 0; cents < 200000; cents += 7) {
  const amount = cents / 100;
  assert.equal(roundDecimal(amount, 2), amount, `idempotencia en ${amount}`);
  const usd = roundDecimal(amount / 36.6243, 2);
  assert.ok(Math.abs(roundDecimal(usd * 36.6243, 2) - amount) <= 0.19, `ida y vuelta de ${amount}`);
}
console.log(`test-money-rounding OK — ${vectors.length} vectores idénticos al servidor.`);
