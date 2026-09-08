import { test, expect } from '../fixtures/seed-data.fixture';
import { registerE2eTenant } from '../fixtures/auth.fixture';
import { createDbAssertions } from '../helpers/db-assertions';
import { CustomersPage } from '../page-objects/CustomersPage';
import { SuppliersPage } from '../page-objects/SuppliersPage';

test.describe('NovaHub ERP — maestros de clientes y proveedores', () => {
  test.setTimeout(120_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  test('crea ambos maestros desde UI, valida persistencia y mantiene aislamiento', async ({
    page,
    request,
    tenantSession,
    seedData,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const customersPage = new CustomersPage(page);
    const suppliersPage = new SuppliersPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const customerName = `Cliente maestro E2E ${suffix}`;
    const supplierName = `Proveedor maestro E2E ${suffix}`;
    const customerEmail = `cliente-maestro-${suffix}@novahub.test`;
    const supplierEmail = `proveedor-maestro-${suffix}@novahub.test`;
    const mark = apiInterceptor.mark();

    try {
      const customersBefore = await db.countByScope('customers', 'clientTenantId', tenantSession.tenantId);
      const suppliersBefore = await db.countByScope('suppliers', 'clientTenantId', tenantSession.tenantId);

      const customer = await customersPage.createCustomer({
        name: customerName,
        ruc: `J031${suffix.slice(0, 10)}`,
        email: customerEmail,
      });
      const customerRecord = await db.recordByScope('customers', customer.id, 'clientTenantId', tenantSession.tenantId);
      expect(customerRecord).not.toBeNull();
      expect(String(customerRecord?.name)).toBe(customerName);
      expect(String(customerRecord?.email)).toBe(customerEmail);
      expect(String(customerRecord?.status)).toBe('ACTIVE');
      await db.assertOwnedByScope('customers', customer.id, 'clientTenantId', tenantSession.tenantId);

      const supplier = await suppliersPage.createSupplier({
        name: supplierName,
        ruc: `J032${suffix.slice(0, 10)}`,
        email: supplierEmail,
      });
      const supplierRecord = await db.recordByScope('suppliers', supplier.id, 'clientTenantId', tenantSession.tenantId);
      expect(supplierRecord).not.toBeNull();
      expect(String(supplierRecord?.name)).toBe(supplierName);
      expect(String(supplierRecord?.email)).toBe(supplierEmail);
      expect(String(supplierRecord?.status)).toBe('ACTIVE');
      await db.assertOwnedByScope('suppliers', supplier.id, 'clientTenantId', tenantSession.tenantId);
      expect(await db.countByScope('customers', 'clientTenantId', tenantSession.tenantId)).toBe(customersBefore + 1);
      expect(await db.countByScope('suppliers', 'clientTenantId', tenantSession.tenantId)).toBe(suppliersBefore + 1);

      const authHeaders = { Authorization: `Bearer ${tenantSession.token}` };
      const invalidCustomer = await request.post(`${apiUrl}/sales/customers`, {
        headers: authHeaders,
        data: { email: 'sin-nombre@novahub.test' },
      });
      expect(invalidCustomer.status()).toBeGreaterThanOrEqual(400);
      expect(invalidCustomer.status()).toBeLessThan(500);
      const invalidSupplier = await request.post(`${apiUrl}/purchases/suppliers`, {
        headers: authHeaders,
        data: { email: 'sin-nombre@novahub.test', type: 'COMPANY' },
      });
      expect(invalidSupplier.status()).toBeGreaterThanOrEqual(400);
      expect(invalidSupplier.status()).toBeLessThan(500);
      expect(await db.countByScope('customers', 'clientTenantId', tenantSession.tenantId)).toBe(customersBefore + 1);
      expect(await db.countByScope('suppliers', 'clientTenantId', tenantSession.tenantId)).toBe(suppliersBefore + 1);

      const otherTenant = await registerE2eTenant(request, `masters-other-${tenantSession.runId}`, ['SALES', 'PURCHASES']);
      const otherCustomersResponse = await request.get(`${apiUrl}/sales/customers?search=${encodeURIComponent(customerName)}`, {
        headers: { Authorization: `Bearer ${otherTenant.token}` },
      });
      expect(otherCustomersResponse.ok()).toBeTruthy();
      const otherCustomers = await otherCustomersResponse.json() as { data?: unknown[] };
      expect(otherCustomers.data || []).toHaveLength(0);
      const otherSuppliersResponse = await request.get(`${apiUrl}/purchases/suppliers?search=${encodeURIComponent(supplierName)}`, {
        headers: { Authorization: `Bearer ${otherTenant.token}` },
      });
      expect(otherSuppliersResponse.ok()).toBeTruthy();
      const otherSuppliers = await otherSuppliersResponse.json() as { data?: unknown[] };
      expect(otherSuppliers.data || []).toHaveLength(0);
      await db.assertNotVisibleByScope('customers', customer.id, 'clientTenantId', otherTenant.tenantId);
      await db.assertNotVisibleByScope('suppliers', supplier.id, 'clientTenantId', otherTenant.tenantId);

      await customersPage.assertResponsiveLayout();
      apiInterceptor.assertSuccessful({
        since: mark,
        requireJsonContentType: true,
        validateRequestPayload: true,
        maxLatencyMs: 10_000,
      });
      expect(seedData.customer.id).toBeTruthy();
    } finally {
      await db.close();
    }
  });
});
