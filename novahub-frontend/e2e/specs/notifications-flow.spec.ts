import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { NotificationsPage } from '../page-objects/NotificationsPage';

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

test.describe('NovaHub ERP — notificaciones, destinatario y deduplicación', () => {
  test.setTimeout(120_000);

  test('crea una alerta personal, la muestra en UI y la aísla por tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const notificationsPage = new NotificationsPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const headers = { Authorization: `Bearer ${fullTenantSession.token}` };
    const mark = apiInterceptor.mark();

    try {
      await notificationsPage.openAlerts();
      await notificationsPage.assertResponsiveLayout();
      await notificationsPage.createAlert();

      const alertsResponse = await request.get(`${apiUrl}/notifications/alerts`, { headers });
      expect(alertsResponse.ok()).toBeTruthy();
      const alerts = await alertsResponse.json() as Array<{ id: string; title: string; userId?: string; clientTenantId?: string; isRead?: boolean }>;
      const created = alerts.find((alert) => alert.title === 'Nueva Alerta');
      expect(created?.id).toBeTruthy();
      expect(created?.clientTenantId).toBe(fullTenantSession.tenantId);
      expect(created?.userId).toBe(fullTenantSession.userId);
      expect(created?.isRead).toBeFalsy();

      const persisted = await db.recordByScope('notifications', String(created?.id), 'clientTenantId', fullTenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.userId)).toBe(fullTenantSession.userId);
      expect(String(persisted?.title)).toBe('Nueva Alerta');
      await db.assertOwnedByScope('notifications', String(created?.id), 'clientTenantId', fullTenantSession.tenantId);

      const invalidResponse = await request.post(`${apiUrl}/notifications/alerts`, {
        headers,
        data: { title: '', content: '' },
      });
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status()).toBeLessThan(500);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Notificaciones Ajeno ${suffix}`,
          userName: 'Admin Notificaciones Ajeno',
          email: `notifications-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['NOTIFICATIONS'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherHeaders = { Authorization: `Bearer ${otherTenant.access_token}` };
      const otherProfileResponse = await request.get(`${apiUrl}/auth/profile`, { headers: otherHeaders });
      expect(otherProfileResponse.ok()).toBeTruthy();
      const otherProfile = await otherProfileResponse.json() as { clientTenantId?: string };
      expect(otherProfile.clientTenantId).toBeTruthy();
      const otherAlertsResponse = await request.get(`${apiUrl}/notifications/alerts`, { headers: otherHeaders });
      expect(otherAlertsResponse.ok()).toBeTruthy();
      const otherAlerts = await otherAlertsResponse.json() as Array<{ title?: string }>;
      expect(otherAlerts.filter((alert) => alert.title === 'Nueva Alerta')).toHaveLength(0);
      await db.assertNotVisibleByScope('notifications', String(created?.id), 'clientTenantId', String(otherProfile.clientTenantId));

      apiInterceptor.assertSuccessful({ since: mark, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});
