import { test, expect } from '../fixtures/seed-data.fixture';
import { createDbAssertions } from '../helpers/db-assertions';
import { InventoryPage } from '../page-objects/InventoryPage';

test.describe('NovaHub ERP — catálogo de Inventario y stock inicial', () => {
  test.setTimeout(120_000);

  test('crea un producto desde la UI y persiste stock, Kardex y tenant correctos', async ({
    page,
    tenantSession,
    seedData,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const inventoryPage = new InventoryPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const code = `UI-E2E-${suffix}`;
    const quantity = 4;
    const mark = apiInterceptor.mark();

    try {
      const created = await inventoryPage.createProductFromSeed({
        code,
        name: `Producto UI E2E ${suffix}`,
        categoryName: seedData.category.name,
        warehouseName: seedData.warehouse.name,
        initialStock: quantity,
        retailPrice: 150,
      });

      const persisted = await db.recordById('products', created.id, tenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.code)).toBe(code);
      expect(String(persisted?.clientTenantId)).toBe(tenantSession.tenantId);
      await db.assertOwned('products', created.id, tenantSession.tenantId);

      const inventory = await db.inventorySnapshot(tenantSession.tenantId, created.id, seedData.warehouse.id);
      expect(inventory.reduce((sum, level) => sum + level.quantity, 0)).toBeCloseTo(quantity, 6);
      expect(inventory.every((level) => level.quantity >= 0)).toBeTruthy();

      const movements = await db.inventoryMovements(tenantSession.tenantId, created.id, seedData.warehouse.id);
      expect(movements.some((movement) => (
        movement.type === 'IN'
        && movement.quantity === quantity
        && String(movement.reference || '').toLowerCase().includes('stock inicial')
      ))).toBeTruthy();

      await inventoryPage.assertResponsiveLayout();
      apiInterceptor.assertSuccessful({
        since: mark,
        requireJsonContentType: true,
        validateRequestPayload: true,
        maxLatencyMs: 10_000,
      });
      apiInterceptor.assertNoServerErrors();
    } finally {
      await db.close();
    }
  });
});
