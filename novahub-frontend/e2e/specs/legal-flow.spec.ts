import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { LegalPage } from '../page-objects/LegalPage';

test.describe('NovaHub ERP — asesoría legal, estados, evidencia y aislamiento', () => {
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

  test('crea caso desde UI, conserva notas/documentos/mensajes y limita el tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const legalPage = new LegalPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const description = `Caso legal E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await legalPage.openCases();
      const created = await legalPage.createCase(description);
      const legalCase = await db.recordByScope('legalCases', created.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(legalCase).not.toBeNull();
      expect(String(legalCase?.status)).toBe('PENDING');
      expect(String(legalCase?.description)).toBe(description);
      await db.assertOwnedByScope('legalCases', created.id, 'clientTenantId', fullTenantSession.tenantId);

      const noteResponse = await request.post(`${apiUrl}/legal/cases/${created.id}/notes`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { content: `Nota E2E ${suffix}`, isInternal: true },
      });
      expect(noteResponse.status()).toBeGreaterThanOrEqual(200);
      expect(noteResponse.status()).toBeLessThan(300);
      const note = await json<{ id: string }>(noteResponse);

      const documentResponse = await request.post(`${apiUrl}/legal/cases/${created.id}/documents`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { name: `Evidencia ${suffix}.pdf`, url: 'https://e2e.novahub.test/legal/evidence.pdf', type: 'application/pdf' },
      });
      expect(documentResponse.status()).toBeGreaterThanOrEqual(200);
      expect(documentResponse.status()).toBeLessThan(300);
      const document = await json<{ id: string }>(documentResponse);

      const messageResponse = await request.post(`${apiUrl}/legal/cases/${created.id}/messages`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { content: `Mensaje E2E ${suffix}`, sender: 'client', senderName: 'Administrador E2E' },
      });
      expect(messageResponse.status()).toBeGreaterThanOrEqual(200);
      expect(messageResponse.status()).toBeLessThan(300);
      const message = await json<{ id: string }>(messageResponse);

      const statusResponse = await request.patch(`${apiUrl}/legal/cases/${created.id}/status`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'IN_PROGRESS' },
      });
      expect(statusResponse.status()).toBeGreaterThanOrEqual(200);
      expect(statusResponse.status()).toBeLessThan(300);

      const reminderResponse = await request.post(`${apiUrl}/legal/reminders`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { title: `Recordatorio E2E ${suffix}`, description: 'Seguimiento legal', dueDate: '2099-12-31', caseId: created.id },
      });
      expect(reminderResponse.status()).toBeGreaterThanOrEqual(200);
      expect(reminderResponse.status()).toBeLessThan(300);
      const reminder = await json<{ id: string }>(reminderResponse);

      const updated = await db.recordByScope('legalCases', created.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(updated?.status)).toBe('IN_PROGRESS');
      const notes = await db.legalCaseNotesForCase(created.id);
      expect(notes.some((row) => String(row.id) === note.id && row.isInternal === true)).toBeTruthy();
      const messages = await db.legalCaseMessagesForCase(created.id);
      expect(messages.some((row) => String(row.id) === message.id && String(row.sender) === 'client')).toBeTruthy();
      expect(await db.recordByIdUnscoped('legalDocuments', document.id)).not.toBeNull();
      const storedReminder = await db.recordByScope('legalReminders', reminder.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(storedReminder?.caseId)).toBe(created.id);

      const invalidTransition = await request.patch(`${apiUrl}/legal/cases/00000000-0000-0000-0000-000000000000/status`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'COMPLETED' },
      });
      expect(invalidTransition.status()).toBeGreaterThanOrEqual(400);
      expect(invalidTransition.status()).toBeLessThan(500);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Legal Ajeno ${suffix}`,
          userName: 'Admin Legal Ajeno',
          email: `legal-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['LEGAL'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherListResponse = await request.get(`${apiUrl}/legal/cases`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherListResponse.ok()).toBeTruthy();
      expect(await otherListResponse.json()).toEqual([]);
      const otherGetResponse = await request.get(`${apiUrl}/legal/cases/${created.id}`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherGetResponse.status()).toBeGreaterThanOrEqual(400);
      expect(otherGetResponse.status()).toBeLessThan(500);

      await legalPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});
