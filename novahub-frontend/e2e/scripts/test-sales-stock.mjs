import assert from 'node:assert/strict';
import {
  getAvailableSalesStock,
  getSingleSalesVariant,
  getSalesProductOptionDescription,
  getSalesStockOptionLabel,
  getSalesWarehouseStockBreakdown,
} from '../../src/app/utils/sales-stock.ts';

const product = {
  itemType: 'PRODUCT',
  trackInventory: true,
  stockLevels: [
    { warehouseId: 'warehouse-a', variantId: 'variant-red', quantity: 6, reserved: 2 },
    { warehouseId: 'warehouse-a', variantId: 'variant-blue', quantity: 5, reserved: 1 },
    { warehouseId: 'warehouse-b', variantId: 'variant-red', quantity: 9, reserved: 4 },
  ],
};

assert.equal(getAvailableSalesStock(product, 'warehouse-a', 'variant-red'), 4);
assert.equal(getAvailableSalesStock({ itemType: 'PRODUCT', trackInventory: true, stockLevels: [{ warehouseId: 'warehouse-a', currentStock: 6, reserved: 2 }] }, 'warehouse-a'), 4);
assert.equal(getAvailableSalesStock(product, 'warehouse-a', 'variant-blue'), 4);
assert.equal(getAvailableSalesStock(product, 'warehouse-b', 'variant-red'), 5);
assert.equal(getAvailableSalesStock(product, 'warehouse-a'), 8, 'sin variante resume solo la bodega seleccionada');
assert.equal(getAvailableSalesStock({
  ...product,
  warehouseCatalog: [{ id: 'warehouse-a', name: 'Bodega A' }, { id: 'warehouse-b', name: 'Bodega B' }],
}, 'warehouse-x'), null, 'una bodega fuera del alcance informado es desconocida, no cero');
assert.deepEqual(getSalesWarehouseStockBreakdown({
  ...product,
  warehouseCatalog: [
    { id: 'warehouse-a', name: 'Bodega A' },
    { id: 'warehouse-b', name: 'Bodega B' },
    { id: 'warehouse-c', name: 'Bodega C' },
  ],
}, 'variant-red').map(({ id, available }) => [id, available]), [
  ['warehouse-b', 5], ['warehouse-a', 4], ['warehouse-c', 0],
]);
assert.deepEqual(getSalesWarehouseStockBreakdown({
  ...product,
  warehouseCatalog: [
    { id: 'warehouse-a', name: 'Bodega activa', isActive: true },
    { id: 'warehouse-b', name: 'Bodega inactiva', isActive: false },
  ],
}, 'variant-red').map(({ id }) => id), ['warehouse-a'], 'los desgloses de Ventas omiten bodegas inactivas');
assert.equal(getAvailableSalesStock(product, 'warehouse-a', 'missing-variant'), 0);
assert.equal(getAvailableSalesStock({
  itemType: 'PRODUCT',
  trackInventory: true,
  currentStock: 268,
  variants: [{ id: 'no-stock', currentStock: null }],
}, 'warehouse-a', 'no-stock'), 0, 'una variante sin fila no hereda el total de otras variantes');
assert.equal(getSalesStockOptionLabel(product, 'warehouse-a', 'variant-red'), 'Disponible: 4');
assert.equal(getSalesStockOptionLabel(product, 'warehouse-a', 'missing-variant'), 'Sin existencias · Disponible: 0');

assert.equal(getAvailableSalesStock({ itemType: 'PRODUCT', trackInventory: true, stockLevels: [] }, 'warehouse-a'), 0);
assert.equal(getAvailableSalesStock({ itemType: 'PRODUCT', trackInventory: true }, 'warehouse-a'), null);
assert.equal(getAvailableSalesStock(product, null), null);
assert.equal(getAvailableSalesStock({ itemType: 'PRODUCT', trackInventory: false, stockLevels: [] }, 'warehouse-a'), null);
assert.equal(getSalesStockOptionLabel({ itemType: 'PRODUCT', trackInventory: false }, 'warehouse-a'), 'No controla inventario');
assert.equal(getSalesStockOptionLabel({ itemType: 'SERVICE', trackInventory: false }, 'warehouse-a'), null);
assert.equal(getSalesStockOptionLabel(product), 'Selecciona bodega para consultar existencias');
assert.equal(getSalesProductOptionDescription(product, 'warehouse-a', 'Nota: Garantía'), 'Disponible: 8 · Nota: Garantía');
assert.equal(getSingleSalesVariant({ variants: [{ id: 'only', sku: 'ONE' }] })?.id, 'only');
assert.equal(getSingleSalesVariant({ variants: [{ id: 'one' }, { id: 'two' }] }), null);

console.log('sales-stock: all assertions passed');
