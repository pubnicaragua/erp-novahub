import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true } });
after(() => vite.close());
const salesPriceListUtils = await vite.ssrLoadModule('/src/app/utils/salesPriceList.ts');
const hasConfiguredPrice = (...args) => salesPriceListUtils.hasConfiguredSalesPriceListPrice?.(...args) ?? false;

test('a zero-valued price entry makes that product and list available', () => {
  const items = [{ priceListId: 'retail', productId: 'product-1', variantId: null, price: 0, basePrice: 0 }];

  assert.equal(hasConfiguredPrice(items, 'retail', 'product-1'), true);
});

test('a zero-valued service price counts as configured', () => {
  const items = [{ priceListId: 'retail', productId: 'service-1', itemType: 'SERVICE', price: 0, basePrice: 0 }];

  assert.equal(hasConfiguredPrice(items, 'retail', 'service-1'), true);
});

test('a product-level entry is inherited by its selected variant', () => {
  const items = [{ priceListId: 'wholesale', productId: 'product-1', variantId: null, price: 25, basePrice: 25 }];

  assert.equal(hasConfiguredPrice(items, 'wholesale', 'product-1', 'variant-7'), true);
});

test('a list without an entry for the selected variant is unavailable', () => {
  const items = [{ priceListId: 'wholesale', productId: 'product-1', variantId: 'variant-1', price: 25, basePrice: 25 }];

  assert.equal(hasConfiguredPrice(items, 'wholesale', 'product-1', 'variant-2'), false);
});

test('a catalog price does not make a list with no list entry available', () => {
  assert.equal(hasConfiguredPrice([], 'wholesale', 'product-1'), false);
});
