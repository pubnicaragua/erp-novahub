import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { RestaurantPage } from '../page-objects/RestaurantPage';

test.describe('NovaHub ERP — restaurante, sucursal y cocina', () => {
  test.setTimeout(120_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  async function json<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
    }
  }

  test('crea comanda desde UI, genera cocina y protege la transición de estado', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const restaurantPage = new RestaurantPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18).toUpperCase();
    const tableCode = `E2E-${suffix}`;
    const itemName = `Platillo E2E ${suffix}`;
    const mark = apiInterceptor.mark();
    expect(fullTenantSession.branchId).toBeTruthy();

    try {
      const tableResponse = await request.post(`${apiUrl}/restaurant/tables`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { branchId: fullTenantSession.branchId, code: tableCode, name: `Mesa E2E ${suffix}`, zone: 'QA', seats: 4 },
      });
      expect(tableResponse.status()).toBeGreaterThanOrEqual(200);
      expect(tableResponse.status()).toBeLessThan(300);
      const table = await json<{ id: string; branchId: string }>(tableResponse);
      // /auth/me/branches exposes the tenant's canonical operational scope;
      // Restaurant resolves it to the concrete Branch persisted on the table.
      expect(table.branchId).toBeTruthy();

      const categoryResponse = await request.post(`${apiUrl}/restaurant/menu/categories`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { name: `Categoría E2E ${suffix}`, description: 'Semilla E2E' },
      });
      expect(categoryResponse.status()).toBeGreaterThanOrEqual(200);
      expect(categoryResponse.status()).toBeLessThan(300);
      const category = await json<{ id: string }>(categoryResponse);
      const itemResponse = await request.post(`${apiUrl}/restaurant/menu/items`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { categoryId: category.id, name: itemName, price: 125, taxRate: 0, prepStation: 'KITCHEN' },
      });
      expect(itemResponse.status()).toBeGreaterThanOrEqual(200);
      expect(itemResponse.status()).toBeLessThan(300);

      await restaurantPage.openSalon();
      const order = await restaurantPage.createKitchenOrder(tableCode, itemName);
      const persistedOrder = await db.recordByScope('restaurantOrders', order.orderId, 'clientTenantId', fullTenantSession.tenantId);
      expect(persistedOrder).not.toBeNull();
      expect(String(persistedOrder?.branchId)).toBe(table.branchId);
      expect(String(persistedOrder?.status)).toBe('SENT_TO_KITCHEN');
      expect(Number(persistedOrder?.total)).toBeCloseTo(125, 6);
      await db.assertOwnedByScope('restaurantOrders', order.orderId, 'clientTenantId', fullTenantSession.tenantId);

      const tickets = await db.restaurantKitchenTicketsForOrder(order.orderId);
      expect(tickets).toHaveLength(1);
      expect(String(tickets[0].branchId)).toBe(table.branchId);
      expect(String(tickets[0].status)).toBe('PENDING');
      const events = await db.restaurantEventsForOrder(order.orderId);
      expect(events.map((event) => String(event.type))).toEqual(expect.arrayContaining(['ORDER_CREATED', 'SENT_TO_KITCHEN']));

      const ticketId = String(tickets[0].id);
      for (const status of ['IN_PREPARATION', 'READY']) {
        const response = await request.patch(`${apiUrl}/restaurant/kitchen/tickets/${ticketId}/status`, {
          headers: { Authorization: `Bearer ${fullTenantSession.token}` },
          data: { status },
        });
        expect(response.status()).toBeGreaterThanOrEqual(200);
        expect(response.status()).toBeLessThan(300);
      }
      const readyOrder = await db.recordByScope('restaurantOrders', order.orderId, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(readyOrder?.status)).toBe('READY');
      expect(String(readyOrder?.branchId)).toBe(table.branchId);

      const invalidTransition = await request.patch(`${apiUrl}/restaurant/kitchen/tickets/${ticketId}/status`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'IN_PREPARATION' },
      });
      expect(invalidTransition.status()).toBeGreaterThanOrEqual(400);
      expect(invalidTransition.status()).toBeLessThan(500);
      const unchangedTicket = await db.recordByScope('restaurantKitchenTickets', ticketId, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(unchangedTicket?.status)).toBe('READY');

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Restaurante Ajeno ${suffix}`,
          userName: 'Admin Restaurante Ajeno',
          email: `restaurant-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['RESTAURANT'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherOrders = await request.get(`${apiUrl}/restaurant/orders`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherOrders.ok()).toBeTruthy();
      expect(await otherOrders.json()).toEqual([]);

      apiInterceptor.assertSuccessful({ since: mark, requireIdempotencyKey: true, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await restaurantPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });
});
