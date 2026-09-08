import { test, expect } from '../fixtures/seed-data.fixture';
import { registerE2eTenant } from '../fixtures/auth.fixture';
import type { APIResponse } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { TransfersPage } from '../page-objects/TransfersPage';

test.describe('NovaHub ERP — transferencia de inventario entre bodegas', () => {
  test.setTimeout(150_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  async function json<T>(response: APIResponse): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
    }
  }

  function unwrap<T extends Record<string, unknown>>(body: T): T & { data?: T } {
    const data = body.data;
    return (data && typeof data === 'object' && !Array.isArray(data) ? data : body) as T & { data?: T };
  }

  test('crea desde UI, completa de forma atómica, balancea contabilidad y aísla tenant', async ({
    page,
    request,
    tenantSession,
    seedData,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const transfersPage = new TransfersPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const destinationName = `Bodega destino E2E ${suffix}`;
    const accountCode = `E2E-TRF-${suffix}`;
    const reference = `Transferencia E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      const authHeaders = { Authorization: `Bearer ${tenantSession.token}` };
      const accountResponse = await request.post(`${apiUrl}/accounting/accounts`, {
        headers: authHeaders,
        data: {
          code: accountCode,
          name: `Inventario destino E2E ${suffix}`,
          type: 'ASSET',
          acceptsPostings: true,
          allowManualEntry: true,
        },
      });
      expect(accountResponse.status()).toBeGreaterThanOrEqual(200);
      expect(accountResponse.status()).toBeLessThan(300);
      const accountBody = unwrap(await json<Record<string, unknown>>(accountResponse));
      const inventoryAccountId = String(accountBody.id || '');
      expect(inventoryAccountId).toBeTruthy();

      const destinationResponse = await request.post(`${apiUrl}/inventory/warehouses`, {
        headers: authHeaders,
        data: {
          name: destinationName,
          type: 'MAIN',
          inventoryAccountId,
        },
      });
      expect(destinationResponse.status()).toBeGreaterThanOrEqual(200);
      expect(destinationResponse.status()).toBeLessThan(300);
      const destinationBody = unwrap(await json<Record<string, unknown>>(destinationResponse));
      const destinationId = String(destinationBody.id || '');
      expect(destinationId).toBeTruthy();

      const productResponse = await request.get(`${apiUrl}/inventory/products/${seedData.product.id}`, {
        headers: authHeaders,
      });
      expect(productResponse.ok()).toBeTruthy();
      const productBody = unwrap(await json<Record<string, unknown>>(productResponse));
      const variants = Array.isArray(productBody.variants) ? productBody.variants as Array<{ id?: string }> : [];
      const variantId = String(variants[0]?.id || '');
      expect(variantId, 'El producto seed debe tener una variante para transferir').toBeTruthy();

      const sourceBefore = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      const destinationBefore = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, destinationId);
      const sourceQuantityBefore = sourceBefore.find((row) => row.variantId === variantId)?.quantity ?? 0;
      const destinationQuantityBefore = destinationBefore.find((row) => row.variantId === variantId)?.quantity ?? 0;
      expect(sourceQuantityBefore).toBeGreaterThanOrEqual(2);

      const created = await transfersPage.createPendingTransfer({
        sourceWarehouseName: seedData.warehouse.name,
        destinationWarehouseName: destinationName,
        productCode: String(seedData.product.code || ''),
        quantity: 2,
        reference,
      });
      expect(created.status).toBe('PENDING');

      const transferRecord = await db.recordByScope('transfers', created.id, 'clientTenantId', tenantSession.tenantId);
      expect(transferRecord).not.toBeNull();
      expect(String(transferRecord?.fromId)).toBe(seedData.warehouse.id);
      expect(String(transferRecord?.toId)).toBe(destinationId);
      expect(String(transferRecord?.status)).toBe('PENDING');
      expect(String(transferRecord?.reference)).toBe(reference);
      const transferItems = await db.transferItemsForTransfer(created.id);
      expect(transferItems).toHaveLength(1);
      expect(String(transferItems[0]?.variantId)).toBe(variantId);
      expect(Number(transferItems[0]?.quantity)).toBe(2);
      await db.assertOwnedByScope('transfers', created.id, 'clientTenantId', tenantSession.tenantId);

      const completeResponse = await request.patch(`${apiUrl}/inventory/transfers/${created.id}/status`, {
        headers: authHeaders,
        data: { status: 'COMPLETED' },
      });
      expect(completeResponse.status()).toBeGreaterThanOrEqual(200);
      expect(completeResponse.status()).toBeLessThan(300);
      const completedBody = unwrap(await json<Record<string, unknown>>(completeResponse));
      expect(String(completedBody.status)).toBe('COMPLETED');

      const replayCompleteResponse = await request.patch(`${apiUrl}/inventory/transfers/${created.id}/status`, {
        headers: authHeaders,
        data: { status: 'COMPLETED' },
      });
      expect(replayCompleteResponse.status()).toBeGreaterThanOrEqual(200);
      expect(replayCompleteResponse.status()).toBeLessThan(300);

      const sourceAfter = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      const destinationAfter = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, destinationId);
      expect(sourceAfter.find((row) => row.variantId === variantId)?.quantity).toBeCloseTo(sourceQuantityBefore - 2, 6);
      expect(destinationAfter.find((row) => row.variantId === variantId)?.quantity).toBeCloseTo(destinationQuantityBefore + 2, 6);
      await db.assertNonNegativeInventory(tenantSession.tenantId);

      const sourceMovements = await db.inventoryMovements(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      const destinationMovements = await db.inventoryMovements(tenantSession.tenantId, seedData.product.id, destinationId);
      expect(sourceMovements.filter((movement) => movement.type === 'OUT' && movement.reference?.includes(created.number))).toHaveLength(1);
      expect(destinationMovements.filter((movement) => movement.type === 'IN' && movement.reference?.includes(created.number))).toHaveLength(1);

      const journal = await db.journalByReference('TRANSFER', created.id, tenantSession.tenantId);
      expect(journal).not.toBeNull();
      await db.assertBalancedJournal(String(journal?.id), tenantSession.tenantId);

      const invalidTransferResponse = await request.post(`${apiUrl}/inventory/transfers`, {
        headers: authHeaders,
        data: {
          fromId: seedData.warehouse.id,
          toId: destinationId,
          items: [{ variantId, quantity: 99_999 }],
          reference: `Invalid ${suffix}`,
        },
      });
      expect(invalidTransferResponse.status()).toBeGreaterThanOrEqual(400);
      expect(invalidTransferResponse.status()).toBeLessThan(500);
      expect(await db.countByScope('transfers', 'clientTenantId', tenantSession.tenantId)).toBe(1);
      const sourceAfterInvalid = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      expect(sourceAfterInvalid.find((row) => row.variantId === variantId)?.quantity).toBeCloseTo(sourceQuantityBefore - 2, 6);

      const otherTenant = await registerE2eTenant(request, `transfer-other-${tenantSession.runId}`, ['INVENTORY', 'ACCOUNTING']);
      const otherListResponse = await request.get(`${apiUrl}/inventory/transfers?search=${encodeURIComponent(created.number)}`, {
        headers: { Authorization: `Bearer ${otherTenant.token}` },
      });
      expect(otherListResponse.ok()).toBeTruthy();
      const otherList = await json<{ data?: unknown[] }>(otherListResponse);
      expect(otherList.data || []).toHaveLength(0);
      await db.assertNotVisibleByScope('transfers', created.id, 'clientTenantId', otherTenant.tenantId);

      await transfersPage.assertResponsiveLayout();
      await expect(page.locator('body')).toContainText(/completada|transferencia/i);
      apiInterceptor.assertSuccessful({
        since: mark,
        requireJsonContentType: true,
        validateRequestPayload: true,
        maxLatencyMs: 15_000,
      });
    } finally {
      await db.close();
    }
  });
});
