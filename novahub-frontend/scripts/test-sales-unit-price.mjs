// Prueba: lo que se registra en dólares se queda en dólares. Un producto o una lista de precios en USD, usados en un
// documento en USD, entregan el precio tal como se registró (sin ida y vuelta por córdobas ni cambio por la tasa del día).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Se transpila a mano porque estos archivos importan sin extensión (ESM de Node no los resuelve).
const require = createRequire(import.meta.url);
const ts = require('typescript');
const load = (relative, shims = {}) => {
  const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, (name) => shims[name] ?? require(name));
  return mod.exports;
};
const currency = load('../src/app/utils/currency.ts');
const { getCatalogUnitPrice, getSalesUnitPrice } = load('../src/app/utils/salesPriceList.ts', { './currency': currency });

// Producto en dólares: precio original 100.00; en córdobas quedó 3,662.43 con la tasa 36.6243.
const usdProduct = { salePrice: 3662.43, salePriceOriginal: 100, priceCurrency: 'USD' };
assert.equal(getCatalogUnitPrice(usdProduct, 'USD', 36.6243), 100, 'documento en USD: el precio registrado');
assert.equal(getCatalogUnitPrice(usdProduct, 'USD', 36.9), 100, 'aunque la tasa del día sea otra, no cambia el precio');
assert.equal(getCatalogUnitPrice(usdProduct, 'NIO', 36.6243), 3662.43, 'documento en córdobas: el equivalente guardado');

// Producto en córdobas usado en un documento en dólares: se convierte con la tasa del documento.
const nioProduct = { salePrice: 3662.43, salePriceOriginal: 3662.43, priceCurrency: 'NIO' };
assert.equal(Math.round(getCatalogUnitPrice(nioProduct, 'USD', 36.6243) * 100) / 100, 100);
assert.equal(getCatalogUnitPrice(nioProduct, 'NIO', 36.6243), 3662.43);

// Sin datos de moneda original se comporta como antes.
assert.equal(getCatalogUnitPrice({ salePrice: 73.2486 }, 'USD', 36.6243), 2);
assert.equal(getCatalogUnitPrice({}, 'NIO', 1), 0);
assert.equal(getCatalogUnitPrice({ salePrice: 'abc' }, 'USD', 36.6), 0, 'precio ilegible no produce NaN');

// Lista de precios: una entrada en dólares en un documento en dólares se respeta.
const usdEntry = { price: 518.78, currency: 'USD', basePrice: 19000, exchangeRate: 36.6243 };
assert.equal(getSalesUnitPrice(usdEntry, 'USD', 36.9), 518.78, 'lista en USD + documento en USD: precio tal cual');
assert.equal(Math.round(getSalesUnitPrice(usdEntry, 'NIO', 36.6243)), 19000, 'documento en córdobas: usa el valor base');
const nioEntry = { price: 500, currency: 'NIO', basePrice: 500 };
assert.equal(getSalesUnitPrice(nioEntry, 'NIO', 36.6), 500);
assert.equal(Math.round(getSalesUnitPrice(nioEntry, 'USD', 36.5) * 100) / 100, 13.7);

// Cualquier tasa: el precio en dólares nunca cambia al usar la lista/producto en dólares.
for (let rate = 30; rate <= 45; rate += 0.0137) {
  assert.equal(getCatalogUnitPrice(usdProduct, 'USD', rate), 100);
  assert.equal(getSalesUnitPrice(usdEntry, 'USD', rate), 518.78);
}
console.log('test-sales-unit-price OK');
