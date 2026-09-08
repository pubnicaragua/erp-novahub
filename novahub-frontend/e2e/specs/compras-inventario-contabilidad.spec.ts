import { test, expect } from '../fixtures/seed-data.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { PurchasesPage } from '../page-objects/PurchasesPage';

test.describe('NovaHub ERP — circuito de compras, recepción, Kardex y contabilidad', () => {
  test.setTimeout(120_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  function key(prefix: string): string {
    const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
    return `${prefix}-${cryptoApi?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  }

  async function json<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
    }
  }

  test('crea orden, aprueba recepción, incrementa inventario y mantiene el tenant aislado', async ({
    page,
    request,
    tenantSession,
    seedData,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const purchasesPage = new PurchasesPage(page);
    const quantity = 3;
    const unitPrice = 40;
    const initialInventory = await db.inventorySnapshot(
      tenantSession.tenantId,
      seedData.product.id,
      seedData.warehouse.id,
    );
    const initialQuantity = initialInventory.reduce((sum, level) => sum + level.quantity, 0);
    const mark = apiInterceptor.mark();

    try {
      const order = await purchasesPage.createOrderFromSeed({
        supplierName: seedData.supplier.name,
        productCode: seedData.product.code || '',
        warehouseName: seedData.warehouse.name,
        quantity,
        unitPrice,
      });
      const persistedOrder = await db.recordById('purchaseOrders', order.id, tenantSession.tenantId);
      expect(persistedOrder).not.toBeNull();
      expect(String(persistedOrder?.status)).toBe('IN_PROCESS');
      expect(String(persistedOrder?.supplierId)).toBe(seedData.supplier.id);
      expect(String(persistedOrder?.warehouseId)).toBe(seedData.warehouse.id);
      await db.assertOwned('purchaseOrders', order.id, tenantSession.tenantId);

      const approval = await purchasesPage.approveOrderFromList();
      const approvedOrder = await db.recordById('purchaseOrders', approval.id, tenantSession.tenantId);
      const pendingReceipt = await db.recordById('purchaseReceipts', approval.receiptId, tenantSession.tenantId);
      expect(String(approvedOrder?.status)).toBe('APPROVED');
      expect(String(pendingReceipt?.status)).toBe('PENDING');
      expect(String(pendingReceipt?.purchaseOrderId)).toBe(order.id);
      await db.assertOwned('purchaseReceipts', approval.receiptId, tenantSession.tenantId);

      const receiptResponse = await request.get(`${apiUrl}/purchases/receipts/${approval.receiptId}`, {
        headers: { Authorization: `Bearer ${tenantSession.token}` },
      });
      expect(receiptResponse.ok()).toBeTruthy();
      const receipt = await json<{ items: Array<Record<string, unknown>> }>(receiptResponse);
      expect(receipt.items.length).toBeGreaterThan(0);
      const receiptItem = receipt.items.find((item) => String(item.productId) === seedData.product.id);
      expect(receiptItem).toBeTruthy();

      const updateKey = key('purchase-receipt-update');
      const updatePayload = {
        items: receipt.items.map((item) => ({
          ...item,
          quantityReceived: String(item.productId) === seedData.product.id ? quantity : 0,
          quantityRejected: 0,
          warehouseId: seedData.warehouse.id,
        })),
      };
      const updateResponse = await request.patch(`${apiUrl}/purchases/receipts/${approval.receiptId}`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': updateKey,
        },
        data: updatePayload,
      });
      expect(updateResponse.status()).toBeGreaterThanOrEqual(200);
      expect(updateResponse.status()).toBeLessThan(300);
      const updatedReceipt = await json<{ status: string }>(updateResponse);
      expect(['RECEIVED', 'WITH_INCIDENTS']).toContain(String(updatedReceipt.status));

      const repeatedUpdateResponse = await request.patch(`${apiUrl}/purchases/receipts/${approval.receiptId}`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': updateKey,
        },
        data: updatePayload,
      });
      expect(repeatedUpdateResponse.status()).toBeGreaterThanOrEqual(200);
      expect(repeatedUpdateResponse.status()).toBeLessThan(300);
      const repeatedReceipt = await json<{ id?: string; status: string }>(repeatedUpdateResponse);
      expect(repeatedReceipt.id).toBe(approval.receiptId);
      expect(repeatedReceipt.status).toBe(updatedReceipt.status);

      const afterReceipt = await db.inventorySnapshot(
        tenantSession.tenantId,
        seedData.product.id,
        seedData.warehouse.id,
      );
      const afterQuantity = afterReceipt.reduce((sum, level) => sum + level.quantity, 0);
      expect(afterQuantity).toBeCloseTo(initialQuantity + quantity, 6);
      await db.assertNonNegativeInventory(tenantSession.tenantId);
      const movements = await db.inventoryMovements(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      expect(movements.some((movement) => movement.type === 'IN' && movement.quantity === quantity)).toBeTruthy();

      const approveResponse = await request.post(`${apiUrl}/purchases/receipts/${approval.receiptId}/approve`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': key('purchase-receipt-approve'),
        },
        data: {},
      });
      expect(approveResponse.status()).toBeGreaterThanOrEqual(200);
      expect(approveResponse.status()).toBeLessThan(300);
      const finalReceipt = await db.recordById('purchaseReceipts', approval.receiptId, tenantSession.tenantId);
      expect(['RECEIVED', 'WITH_INCIDENTS']).toContain(String(finalReceipt?.status));

      const journal = await db.journalByReference('PURCHASE_RECEIPT', approval.receiptId, tenantSession.tenantId);
      expect(journal, 'la recepción recibida debe generar asiento contable').not.toBeNull();
      expect(journal?.status).toBe('POSTED');
      await db.assertBalancedJournal(String(journal?.id), tenantSession.tenantId);

      await purchasesPage.openReceipts();
      await purchasesPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({ since: mark, requireIdempotencyKey: true, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      apiInterceptor.assertNoServerErrors();
    } finally {
      await db.close();
    }
  });
});
