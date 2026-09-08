import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { ProjectsPage } from '../page-objects/ProjectsPage';

test.describe('NovaHub ERP — portafolio, planificación, costos e idempotencia de Proyectos', () => {
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

  test('crea proyecto desde UI, agrega planificación/costo y conserva aislamiento', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const projectsPage = new ProjectsPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const name = `Proyecto E2E ${suffix}`;
    const sourceId = `ACTIVITY-${suffix}`;
    const costKey = `projects-cost-${fullTenantSession.runId}`;
    const mark = apiInterceptor.mark();
    expect(fullTenantSession.branchId).toBeTruthy();

    try {
      await projectsPage.openPortfolio();
      const created = await projectsPage.createProject({
        name,
        description: 'Validación dual de portafolio y rentabilidad',
        plannedBudget: 1000,
      });
      expect(created.id).toBeTruthy();
      await projectsPage.openProject(name);

      const project = await db.recordByScope('projects', created.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(project).not.toBeNull();
      expect(String(project?.name)).toBe(name);
      expect(String(project?.status)).toBe('DRAFT');
      expect(Number(project?.plannedBudget)).toBeCloseTo(1000, 6);
      await db.assertOwnedByScope('projects', created.id, 'clientTenantId', fullTenantSession.tenantId);

      const branchUpdate = await request.patch(`${apiUrl}/projects/${created.id}`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { branchId: fullTenantSession.branchId, status: 'IN_PROGRESS' },
      });
      expect(branchUpdate.status()).toBeGreaterThanOrEqual(200);
      expect(branchUpdate.status()).toBeLessThan(300);
      const branchUpdateBody = await json<{ branchId?: string }>(branchUpdate);
      const operationalBranchId = branchUpdateBody.branchId;
      expect(operationalBranchId).toBeTruthy();

      const milestoneResponse = await request.post(`${apiUrl}/projects/${created.id}/milestones`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { name: `Hito E2E ${suffix}`, description: 'Hito de prueba', status: 'PENDING' },
      });
      expect(milestoneResponse.status()).toBeGreaterThanOrEqual(200);
      expect(milestoneResponse.status()).toBeLessThan(300);
      const milestone = await json<{ id: string }>(milestoneResponse);

      const taskResponse = await request.post(`${apiUrl}/projects/${created.id}/tasks`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: {
          title: `Tarea E2E ${suffix}`,
          description: 'Tarea vinculada al hito E2E',
          priority: 'HIGH',
          progress: 25,
          milestoneId: milestone.id,
        },
      });
      expect(taskResponse.status()).toBeGreaterThanOrEqual(200);
      expect(taskResponse.status()).toBeLessThan(300);
      const task = await json<{ id: string }>(taskResponse);

      const costCountBefore = await db.countByScope('projectCosts', 'clientTenantId', fullTenantSession.tenantId);
      const costPayload = {
        concept: 'Materiales E2E',
        category: 'OPERATIVO',
        amount: 250,
        currency: 'NIO',
        source: 'ACTIVITY',
        sourceId,
        status: 'EXECUTED',
      };
      const costResponse = await request.post(`${apiUrl}/projects/${created.id}/costs`, {
        headers: {
          Authorization: `Bearer ${fullTenantSession.token}`,
          'Idempotency-Key': costKey,
        },
        data: costPayload,
      });
      expect(costResponse.status()).toBeGreaterThanOrEqual(200);
      expect(costResponse.status()).toBeLessThan(300);
      const cost = await json<{ id: string }>(costResponse);

      const replayResponse = await request.post(`${apiUrl}/projects/${created.id}/costs`, {
        headers: {
          Authorization: `Bearer ${fullTenantSession.token}`,
          'Idempotency-Key': costKey,
        },
        data: costPayload,
      });
      expect(replayResponse.status()).toBeGreaterThanOrEqual(200);
      expect(replayResponse.status()).toBeLessThan(300);
      const replay = await json<{ id: string; idempotent?: boolean }>(replayResponse);
      expect(replay.id).toBe(cost.id);
      expect(replay.idempotent).toBeTruthy();
      expect(await db.countByScope('projectCosts', 'clientTenantId', fullTenantSession.tenantId)).toBe(costCountBefore + 1);

      const completeTaskResponse = await request.post(`${apiUrl}/projects/${created.id}/tasks/${task.id}/complete`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
      });
      expect(completeTaskResponse.status()).toBeGreaterThanOrEqual(200);
      expect(completeTaskResponse.status()).toBeLessThan(300);
      const completeMilestoneResponse = await request.patch(`${apiUrl}/projects/${created.id}/milestones/${milestone.id}`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'COMPLETED' },
      });
      expect(completeMilestoneResponse.status()).toBeGreaterThanOrEqual(200);
      expect(completeMilestoneResponse.status()).toBeLessThan(300);

      const detailResponse = await request.get(`${apiUrl}/projects/${created.id}`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
      });
      expect(detailResponse.ok()).toBeTruthy();
      const detail = await detailResponse.json() as {
        branchId?: string;
        status?: string;
        executedCost?: number;
        progress?: number;
        tasks?: Array<{ id: string; status: string }>;
        milestones?: Array<{ id: string; status: string }>;
      };
      expect(detail.branchId).toBe(operationalBranchId);
      expect(detail.status).toBe('IN_PROGRESS');
      expect(Number(detail.executedCost)).toBeCloseTo(250, 6);
      expect(detail.tasks?.find((row) => row.id === task.id)?.status).toBe('COMPLETED');
      expect(detail.milestones?.find((row) => row.id === milestone.id)?.status).toBe('COMPLETED');
      expect(Number(detail.progress)).toBeGreaterThanOrEqual(100);

      const invalidCreate = await request.post(`${apiUrl}/projects`, {
        headers: {
          Authorization: `Bearer ${fullTenantSession.token}`,
          'Idempotency-Key': `projects-invalid-${fullTenantSession.runId}`,
        },
        data: { description: 'Falta nombre y fecha de inicio' },
      });
      expect(invalidCreate.status()).toBeGreaterThanOrEqual(400);
      expect(invalidCreate.status()).toBeLessThan(500);
      expect(await db.countByScope('projects', 'clientTenantId', fullTenantSession.tenantId)).toBe(1);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Proyectos Ajeno ${suffix}`,
          userName: 'Admin Proyectos Ajeno',
          email: `projects-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['PROJECTS'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherProfileResponse = await request.get(`${apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherProfileResponse.ok()).toBeTruthy();
      const otherProfile = await otherProfileResponse.json() as { clientTenantId?: string };
      expect(otherProfile.clientTenantId).toBeTruthy();
      const otherListResponse = await request.get(`${apiUrl}/projects?search=${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherListResponse.ok()).toBeTruthy();
      const otherList = await otherListResponse.json() as { data?: unknown[] };
      expect(otherList.data || []).toHaveLength(0);
      await db.assertNotVisibleByScope('projects', created.id, 'clientTenantId', String(otherProfile.clientTenantId));

      await projectsPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({
        since: mark,
        requireIdempotencyKey: true,
        requireJsonContentType: true,
        validateRequestPayload: true,
        maxLatencyMs: 10_000,
      });
    } finally {
      await db.close();
    }
  });
});
