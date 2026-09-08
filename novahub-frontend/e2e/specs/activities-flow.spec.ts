import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { ActivitiesPage } from '../page-objects/ActivitiesPage';

test.describe('NovaHub ERP — tareas, evidencia y aislamiento de Actividades', () => {
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

  test('crea tarea, la completa con evidencia y no la expone a otro tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const activitiesPage = new ActivitiesPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const title = `Tarea E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await activitiesPage.openTasks();
      const taskId = await activitiesPage.createTask({
        title,
        description: 'Validación dual de actividades',
        priority: 'HIGH',
      });

      const created = await db.recordByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);
      expect(created).not.toBeNull();
      expect(String(created?.type)).toBe('TASK');
      expect(String(created?.status)).toBe('PENDING');
      expect(String(created?.priority)).toBe('HIGH');
      await db.assertOwnedByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);

      await activitiesPage.completeTask(taskId, 'https://e2e.novahub.test/evidence/task');
      const completed = await db.recordByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(completed?.status)).toBe('COMPLETED');
      const evidences = await db.activityEvidencesForActivity(taskId);
      expect(evidences.some((evidence) => String(evidence.fileUrl).includes('e2e.novahub.test'))).toBeTruthy();

      const invalidCompletion = await request.post(`${apiUrl}/activities/tasks/00000000-0000-0000-0000-000000000000/complete`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { fileUrl: 'https://e2e.novahub.test/invalid' },
      });
      expect(invalidCompletion.status()).toBeGreaterThanOrEqual(400);
      expect(invalidCompletion.status()).toBeLessThan(500);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Actividades Ajeno ${suffix}`,
          userName: 'Admin Actividades Ajeno',
          email: `activities-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['ACTIVITIES'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherTasks = await request.get(`${apiUrl}/activities/tasks`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherTasks.ok()).toBeTruthy();
      expect(await otherTasks.json()).toEqual([]);

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await activitiesPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });
});
