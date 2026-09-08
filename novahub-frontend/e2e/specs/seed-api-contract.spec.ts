import { test, expect } from '../fixtures/seed-data.fixture';
import { createDbAssertions } from '../helpers/db-assertions';

test.describe('NovaHub ERP — contrato seed y aislamiento base', () => {
  test('crea datos mínimos del tenant y no los mezcla con identificadores del contexto', async ({ seedData, tenantSession }) => {
    expect(seedData.customer.id).toBeTruthy();
    expect(seedData.product.id).toBeTruthy();
    expect(tenantSession.tenantId).toBeTruthy();
    const db = createDbAssertions();
    try {
      await db.assertOwned('customers', seedData.customer.id, tenantSession.tenantId);
      await db.assertOwned('products', seedData.product.id, tenantSession.tenantId);
      await db.assertNonNegativeInventory(tenantSession.tenantId);
    } finally {
      await db.close();
    }
  });
});
