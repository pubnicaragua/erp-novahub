import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { SupportTechPage } from '../page-objects/SupportTechPage';

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

test.describe('NovaHub ERP — Soporte técnico, actor y aislamiento', () => {
  test.setTimeout(120_000);

  test('crea un ticket desde la UI y limita su lectura al tenant creador', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const supportPage = new SupportTechPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const subject = `Incidencia E2E ${suffix}`;
    const headers = { Authorization: `Bearer ${fullTenantSession.token}` };
    const mark = apiInterceptor.mark();

    try {
      await supportPage.open();
      await supportPage.assertResponsiveLayout();
      await supportPage.createTicket(subject, 'Descripción de incidencia para validar actor, tenant y trazabilidad.');

      const ticketsResponse = await request.get(`${apiUrl}/support-tickets/my`, { headers });
      expect(ticketsResponse.ok()).toBeTruthy();
      const tickets = await ticketsResponse.json() as Array<{ id: string; subject: string; clientTenantId: string; createdByUserId: string; status: string }>;
      const created = tickets.find((ticket) => ticket.subject === subject);
      expect(created?.id).toBeTruthy();
      expect(created?.clientTenantId).toBe(fullTenantSession.tenantId);
      expect(created?.createdByUserId).toBe(fullTenantSession.userId);
      expect(created?.status).toBe('OPEN');

      const persisted = await db.recordByScope('supportTickets', String(created?.id), 'clientTenantId', fullTenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.subject)).toBe(subject);
      expect(String(persisted?.createdByUserId)).toBe(fullTenantSession.userId);
      expect(String(persisted?.status)).toBe('OPEN');
      await db.assertOwnedByScope('supportTickets', String(created?.id), 'clientTenantId', fullTenantSession.tenantId);

      const invalidResponse = await request.post(`${apiUrl}/support-tickets`, {
        headers,
        data: { subject: '', description: '', category: 'BUG', priority: 'MEDIUM' },
      });
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status()).toBeLessThan(500);
      expect(await db.countByScope('supportTickets', 'clientTenantId', fullTenantSession.tenantId)).toBe(1);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Soporte Ajeno ${suffix}`,
          userName: 'Admin Soporte Ajeno',
          email: `support-tech-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['SUPPORT_TECH'],
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
      const otherListResponse = await request.get(`${apiUrl}/support-tickets/my`, { headers: otherHeaders });
      expect(otherListResponse.ok()).toBeTruthy();
      expect(await otherListResponse.json()).toEqual([]);
      await db.assertNotVisibleByScope('supportTickets', String(created?.id), 'clientTenantId', String(otherProfile.clientTenantId));

      apiInterceptor.assertSuccessful({ since: mark, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});
