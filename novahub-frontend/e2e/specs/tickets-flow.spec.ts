import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { TicketsPage } from '../page-objects/TicketsPage';

test.describe('NovaHub ERP — tickets, comentarios, estados y alcance por tenant', () => {
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

  test('crea ticket desde UI, registra comentario, transiciona y rechaza cruces de tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const ticketsPage = new TicketsPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const subject = `Ticket E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await ticketsPage.openTickets();
      const created = await ticketsPage.createTicket({
        subject,
        description: `Incidencia aislada de soporte ${suffix}`,
      });
      const ticket = await db.recordByScope('tickets', created.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(ticket).not.toBeNull();
      expect(String(ticket?.status)).toBe('OPEN');
      expect(String(ticket?.createdById)).toBe(fullTenantSession.userId);
      await db.assertOwnedByScope('tickets', created.id, 'clientTenantId', fullTenantSession.tenantId);

      const commentResponse = await request.post(`${apiUrl}/tools/tickets/${created.id}/comments`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { message: `Comentario E2E ${suffix}`, isInternal: true },
      });
      expect(commentResponse.status()).toBeGreaterThanOrEqual(200);
      expect(commentResponse.status()).toBeLessThan(300);
      const comment = await json<{ id: string }>(commentResponse);
      const storedComment = await db.recordByScope('ticketComments', comment.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(storedComment?.message)).toBe(`Comentario E2E ${suffix}`);

      const statusResponse = await request.patch(`${apiUrl}/tools/tickets/${created.id}`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'IN_PROGRESS' },
      });
      expect(statusResponse.status()).toBeGreaterThanOrEqual(200);
      expect(statusResponse.status()).toBeLessThan(300);
      const updatedTicket = await db.recordByScope('tickets', created.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(updatedTicket?.status)).toBe('IN_PROGRESS');

      const invalidCreate = await request.post(`${apiUrl}/tools/tickets`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { description: 'Falta asunto' },
      });
      expect(invalidCreate.status()).toBeGreaterThanOrEqual(400);
      expect(invalidCreate.status()).toBeLessThan(500);
      expect(await db.countByScope('tickets', 'clientTenantId', fullTenantSession.tenantId)).toBe(1);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Tickets Ajeno ${suffix}`,
          userName: 'Admin Tickets Ajeno',
          email: `tickets-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['TICKETS'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherListResponse = await request.get(`${apiUrl}/tools/tickets`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherListResponse.ok()).toBeTruthy();
      const otherList = await otherListResponse.json() as { data?: unknown[] };
      expect(otherList.data || []).toHaveLength(0);
      const crossTenantGet = await request.get(`${apiUrl}/tools/tickets/${created.id}`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(crossTenantGet.status()).toBeGreaterThanOrEqual(400);
      expect(crossTenantGet.status()).toBeLessThan(500);

      await ticketsPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});
