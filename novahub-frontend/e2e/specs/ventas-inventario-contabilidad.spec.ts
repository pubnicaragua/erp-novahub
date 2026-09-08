import { test, expect } from '../fixtures/seed-data.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { SalesPage } from '../page-objects/SalesPage';

test.describe('NovaHub ERP — flujo crítico venta, inventario y contabilidad', () => {
  test.setTimeout(120_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  function idempotencyKey(prefix: string): string {
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

  async function registerIsolationTenant(request: APIRequestContext) {
    const suffix = idempotencyKey('tenant').replace(/[^a-z0-9]/gi, '').slice(0, 20);
    const response = await request.post(`${apiUrl}/auth/register-tenant`, {
      data: {
        companyName: `Tenant ajeno E2E ${suffix}`,
        userName: 'Admin Tenant Ajeno',
        email: `tenant-ajeno-${suffix}@novahub.test`,
        password: 'E2eTest!2026Xx',
        industry: 'OTHER',
        selectedModules: ['INVENTORY', 'SALES', 'PURCHASES', 'REPORTS', 'ACCOUNTING'],
      },
    });
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await json<{ access_token: string }>(response);
    if (!body.access_token) throw new Error('El tenant ajeno no devolvió access_token.');
    const profileResponse = await request.get(`${apiUrl}/auth/profile`, {
      headers: { Authorization: `Bearer ${body.access_token}` },
    });
    expect(profileResponse.ok()).toBeTruthy();
    const profile = await json<{ clientTenantId?: string }>(profileResponse);
    if (!profile.clientTenantId) throw new Error('El tenant ajeno no devolvió clientTenantId.');
    return { token: body.access_token, tenantId: profile.clientTenantId };
  }

  test('recorre UI, API, persistencia, aislamiento, idempotencia y rollback', async ({
    page,
    request,
    tenantSession,
    seedData,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const salesPage = new SalesPage(page);
    const quantity = 2;
    const initialInventory = await db.inventorySnapshot(
      tenantSession.tenantId,
      seedData.product.id,
      seedData.warehouse.id,
    );
    expect(initialInventory.length, 'debe existir un nivel de inventario para el producto sembrado').toBeGreaterThan(0);
    const initialQuantity = initialInventory.reduce((sum, level) => sum + level.quantity, 0);

    try {
      const browserMark = apiInterceptor.mark();
      const order = await salesPage.createOrderFromSeed({
        customerName: seedData.customer.name,
        productCode: seedData.product.code || '',
        warehouseName: seedData.warehouse.name,
        quantity,
      });

      const persistedOrder = await db.recordById('salesOrders', order.id, tenantSession.tenantId);
      expect(persistedOrder).not.toBeNull();
      expect(String(persistedOrder?.status)).toBe('IN_PROCESS');
      expect(String(persistedOrder?.customerId)).toBe(seedData.customer.id);
      expect(String(persistedOrder?.warehouseId)).toBe(seedData.warehouse.id);
      await db.assertOwned('salesOrders', order.id, tenantSession.tenantId);
      await db.assertOwned('warehouses', seedData.warehouse.id, tenantSession.tenantId);
      await db.assertOwned('products', seedData.product.id, tenantSession.tenantId);

      const invoice = await salesPage.convertFirstPendingOrderToInvoice();
      const persistedInvoice = await db.recordById('invoices', invoice.id, tenantSession.tenantId);
      expect(persistedInvoice).not.toBeNull();
      expect(String(persistedInvoice?.salesOrderId)).toBe(order.id);
      expect(String(persistedInvoice?.status)).toBe('PENDING');
      expect(String(persistedInvoice?.warehouseId)).toBe(seedData.warehouse.id);
      await db.assertOwned('invoices', invoice.id, tenantSession.tenantId);

      const afterConversion = await db.inventorySnapshot(
        tenantSession.tenantId,
        seedData.product.id,
        seedData.warehouse.id,
      );
      const afterConversionQuantity = afterConversion.reduce((sum, level) => sum + level.quantity, 0);
      expect(afterConversionQuantity).toBeCloseTo(initialQuantity - quantity, 6);
      await db.assertNonNegativeInventory(tenantSession.tenantId);

      const movements = await db.inventoryMovements(
        tenantSession.tenantId,
        seedData.product.id,
        seedData.warehouse.id,
      );
      expect(movements.some((movement) => (
        movement.type === 'OUT'
        && movement.quantity === quantity
        && String(movement.reference || '').includes(String(invoice.number || ''))
      ))).toBeTruthy();

      const browserCalls = apiInterceptor.records({ since: browserMark });
      expect(browserCalls.some((call) => call.method === 'POST' && call.url.includes('/sales/orders'))).toBeTruthy();
      expect(browserCalls.some((call) => call.method === 'POST' && call.url.includes('/convert-to-invoice'))).toBeTruthy();
      apiInterceptor.assertSuccessful({ since: browserMark, requireIdempotencyKey: true, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      expect(browserCalls.filter((call) => call.method === 'POST').every((call) => Boolean(call.idempotencyKey))).toBeTruthy();
      await salesPage.assertNoViewportOverflow();

      // Repetir la conversión con la misma clave no debe volver a descontar stock.
      const repeatKey = idempotencyKey('convert-repeat');
      const repeatPayload = { accountId: undefined, sellerEmployeeId: undefined };
      const firstRepeat = await request.post(`${apiUrl}/sales/orders/${order.id}/convert-to-invoice`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': repeatKey,
        },
        data: repeatPayload,
      });
      const secondRepeat = await request.post(`${apiUrl}/sales/orders/${order.id}/convert-to-invoice`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': repeatKey,
        },
        data: repeatPayload,
      });
      expect(firstRepeat.status()).toBeGreaterThanOrEqual(200);
      expect(firstRepeat.status()).toBeLessThan(300);
      expect(secondRepeat.status()).toBeGreaterThanOrEqual(200);
      expect(secondRepeat.status()).toBeLessThan(300);
      const firstRepeatBody = await json<{ id: string }>(firstRepeat);
      const secondRepeatBody = await json<{ id: string }>(secondRepeat);
      expect(secondRepeatBody.id).toBe(firstRepeatBody.id);
      expect(secondRepeatBody.id).toBe(invoice.id);
      const afterRepeat = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      expect(afterRepeat.reduce((sum, level) => sum + level.quantity, 0)).toBeCloseTo(afterConversionQuantity, 6);

      // El cobro total cierra el estado financiero y activa el asiento contable.
      const paymentKey = idempotencyKey('payment');
      const invoiceTotal = Number(persistedInvoice?.total || invoice.total || 0);
      expect(invoiceTotal).toBeGreaterThan(0);
      const paymentResponse = await request.post(`${apiUrl}/sales/payments`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': paymentKey,
        },
        data: {
          customerId: seedData.customer.id,
          invoiceId: invoice.id,
          amount: invoiceTotal,
          date: new Date().toISOString(),
          method: 'CASH',
          currency: 'NIO',
          exchangeRate: 1,
        },
      });
      expect(paymentResponse.status()).toBeGreaterThanOrEqual(200);
      expect(paymentResponse.status()).toBeLessThan(300);
      const paidInvoice = await db.recordById('invoices', invoice.id, tenantSession.tenantId);
      expect(String(paidInvoice?.status)).toBe('PAID');
      expect(Number(paidInvoice?.balance || 0)).toBeCloseTo(0, 6);

      const journal = await db.journalByReference('PAID_INVOICE', invoice.id, tenantSession.tenantId);
      expect(journal, 'el cobro total debe generar el asiento PAID_INVOICE').not.toBeNull();
      expect(journal?.status).toBe('POSTED');
      await db.assertBalancedJournal(String(journal?.id), tenantSession.tenantId);

      // Un tenant distinto no puede leer los documentos creados por el tenant actual.
      const otherTenant = await registerIsolationTenant(request);
      const otherOrdersResponse = await request.get(`${apiUrl}/sales/orders?search=${encodeURIComponent(String(order.number || ''))}`, {
        headers: { Authorization: `Bearer ${otherTenant.token}` },
      });
      expect(otherOrdersResponse.ok()).toBeTruthy();
      const otherOrders = await json<{ data?: Array<{ id: string }> }>(otherOrdersResponse);
      expect(otherOrders.data || []).toEqual([]);
      await db.assertNotVisibleToTenant('salesOrders', order.id, otherTenant.tenantId);
      await db.assertNotVisibleToTenant('invoices', invoice.id, otherTenant.tenantId);
      await db.assertNotVisibleToTenant('products', seedData.product.id, otherTenant.tenantId);

      // Fallo intermedio: el stock y el estado deben revertirse si la conversión no puede descontar.
      const beforeFailure = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      const failureOrderResponse = await request.post(`${apiUrl}/sales/orders`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': idempotencyKey('insufficient-order'),
        },
        data: {
          customerId: seedData.customer.id,
          warehouseId: seedData.warehouse.id,
          date: new Date().toISOString(),
          expectedDelivery: new Date(Date.now() + 86_400_000).toISOString(),
          status: 'IN_PROCESS',
          currency: 'NIO',
          exchangeRate: 1,
          items: [{
            productId: seedData.product.id,
            description: seedData.product.name,
            quantity: initialQuantity + 1000,
            unitPrice: 100,
            taxRate: 0,
            discount: 0,
          }],
        },
      });
      expect(failureOrderResponse.status()).toBeGreaterThanOrEqual(200);
      expect(failureOrderResponse.status()).toBeLessThan(300);
      const failureOrder = await json<{ id: string }>(failureOrderResponse);
      const failedConversion = await request.post(`${apiUrl}/sales/orders/${failureOrder.id}/convert-to-invoice`, {
        headers: {
          Authorization: `Bearer ${tenantSession.token}`,
          'Idempotency-Key': idempotencyKey('insufficient-convert'),
        },
        data: {},
      });
      expect(failedConversion.status()).toBe(400);
      const afterFailure = await db.inventorySnapshot(tenantSession.tenantId, seedData.product.id, seedData.warehouse.id);
      expect(afterFailure.reduce((sum, level) => sum + level.quantity, 0)).toBeCloseTo(
        beforeFailure.reduce((sum, level) => sum + level.quantity, 0),
        6,
      );
      const failedOrderRecord = await db.recordById('salesOrders', failureOrder.id, tenantSession.tenantId);
      expect(String(failedOrderRecord?.status)).toBe('IN_PROCESS');
      await db.assertNonNegativeInventory(tenantSession.tenantId);
    } finally {
      await db.close();
    }
  });
});
