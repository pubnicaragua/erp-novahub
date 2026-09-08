import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { TrackingPage } from '../page-objects/TrackingPage';

test.describe('NovaHub ERP — tracking, eventos e aislamiento por tenant', () => {
  test.setTimeout(120_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  function suffix(runId: string): string {
    return runId.replace(/[^a-z0-9]/gi, '').slice(0, 18).toUpperCase();
  }

  async function json<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
    }
  }

  test('crea ticket, registra evento, conserva historial y no cruza tenants', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const trackingPage = new TrackingPage(page);
    const trackingCode = `TRK-E2E-${suffix(fullTenantSession.runId)}`;
    const mark = apiInterceptor.mark();

    try {
      await trackingPage.openTransit();
      const created = await trackingPage.createTicket({
        trackingCode,
        clientName: 'Cliente Tracking E2E',
        carrier: 'Agencia E2E',
        origin: 'Managua',
        destination: 'Miami',
        description: 'Paquete de prueba aislado por tenant',
      });

      const shipment = await db.recordByScope('trackingShipments', created.id, 'tenantId', fullTenantSession.tenantId);
      expect(shipment).not.toBeNull();
      expect(String(shipment?.trackingCode)).toBe(trackingCode);
      expect(String(shipment?.status)).toBe('PENDING');
      await db.assertOwnedByScope('trackingShipments', created.id, 'tenantId', fullTenantSession.tenantId);

      const initialEvents = await db.trackingEventsForShipment(created.id);
      expect(initialEvents.some((event) => String(event.label).toLowerCase().includes('ticket creado'))).toBeTruthy();

      await trackingPage.openTicket(trackingCode);
      await trackingPage.addEvent('IN_TRANSIT', 'Bodega Managua');

      const transitioned = await db.recordByScope('trackingShipments', created.id, 'tenantId', fullTenantSession.tenantId);
      expect(String(transitioned?.status)).toBe('IN_TRANSIT');
      const events = await db.trackingEventsForShipment(created.id);
      expect(events.some((event) => String(event.status) === 'IN_TRANSIT' && String(event.location) === 'Bodega Managua')).toBeTruthy();

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Tracking Ajeno ${suffix(fullTenantSession.runId)}`,
          userName: 'Admin Tracking Ajeno',
          email: `tracking-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['TRACKING', 'TRACKING_TRANSIT'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string; user?: { clientTenantId?: string } }>(otherTenantResponse);
      const otherProfileResponse = await request.get(`${apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherProfileResponse.ok()).toBeTruthy();
      const otherProfile = await otherProfileResponse.json() as { clientTenantId?: string };
      expect(otherProfile.clientTenantId).toBeTruthy();
      const otherList = await request.get(`${apiUrl}/tracking/shipments?search=${encodeURIComponent(trackingCode)}`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherList.ok()).toBeTruthy();
      expect(await otherList.json()).toEqual([]);
      await db.assertNotVisibleByScope('trackingShipments', created.id, 'tenantId', String(otherProfile.clientTenantId));

      const invalid = await request.post(`${apiUrl}/tracking/shipments`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { clientName: 'Sin código' },
      });
      expect(invalid.status()).toBeGreaterThanOrEqual(400);
      expect(invalid.status()).toBeLessThan(500);
      expect(await db.countTrackingShipmentsByCode(fullTenantSession.tenantId, trackingCode)).toBe(1);

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await trackingPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });
});
