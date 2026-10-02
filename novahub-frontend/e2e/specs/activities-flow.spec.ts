import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { ActivitiesPage } from '../page-objects/ActivitiesPage';

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

function parseDetails(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  return JSON.parse(String(raw)) as Record<string, unknown>;
}

test.describe('NovaHub ERP — tareas, evidencia y aislamiento de Actividades', () => {
  test.setTimeout(120_000);

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

  test('reasigna tarea con motivo, registra TASK_REASSIGNED y lo muestra en el historial', async ({
    page,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const activitiesPage = new ActivitiesPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const title = `Reasignar E2E ${suffix}`;
    const reason = `Motivo de reasignacion E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await activitiesPage.openTasks();
      const taskId = await activitiesPage.createTask({
        title,
        description: 'Flujo ITSM de reasignacion',
        priority: 'MEDIUM',
      });
      await activitiesPage.reassignTask(taskId, reason);

      const assigned = await db.recordByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);
      expect(assigned).not.toBeNull();
      expect(String(assigned?.assignedToId || '')).not.toBe('');

      const logs = await db.activityLogsForActivity(taskId);
      const reassignLogs = logs.filter((log) => String(log.action) === 'TASK_REASSIGNED');
      expect(reassignLogs).toHaveLength(1);
      expect(String(reassignLogs[0].clientTenantId)).toBe(fullTenantSession.tenantId);
      const details = parseDetails(reassignLogs[0].details);
      expect(details.reason).toBe(reason);
      expect(details.toUserId).toBe(String(assigned?.assignedToId));

      await activitiesPage.openDetail(taskId);
      await expect(page.getByText('Historial de reasignaciones')).toBeVisible();
      await expect(page.getByText(`Motivo: ${reason}`, { exact: true })).toBeVisible();
      await activitiesPage.closeDetail();

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await activitiesPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });

  test('autoasigna la tarea con claim, es idempotente y lo refleja en el historial', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const activitiesPage = new ActivitiesPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const title = `Claim E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await activitiesPage.openTasks();
      const taskId = await activitiesPage.createTask({
        title,
        description: 'Flujo ITSM de autoasignacion',
        priority: 'HIGH',
      });

      await activitiesPage.claimTask(taskId);
      const claimed = await db.recordByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(claimed?.assignedToId)).toBe(fullTenantSession.userId);

      const claimLogs = (await db.activityLogsForActivity(taskId))
        .filter((log) => String(log.action) === 'TASK_CLAIMED');
      expect(claimLogs).toHaveLength(1);
      expect(String(claimLogs[0].clientTenantId)).toBe(fullTenantSession.tenantId);
      const claimDetails = parseDetails(claimLogs[0].details);
      expect(claimDetails.reason).toBe('Auto-asignación');
      expect(claimDetails.toUserId).toBe(fullTenantSession.userId);

      await activitiesPage.openDetail(taskId);
      await expect(page.getByText('Historial de reasignaciones')).toBeVisible();
      await expect(page.getByText(/Auto-asignación/)).toBeVisible();
      await activitiesPage.closeDetail();

      // Idempotencia: un segundo claim no duplica el log (§2.2).
      const secondClaim = await request.post(`${apiUrl}/activities/tasks/${taskId}/claim`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: {},
      });
      expect(secondClaim.ok()).toBeTruthy();
      const claimLogsAfter = (await db.activityLogsForActivity(taskId))
        .filter((log) => String(log.action) === 'TASK_CLAIMED');
      expect(claimLogsAfter).toHaveLength(1);

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await activitiesPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });

  test('crea tarea con categoría, la persiste y filtra la lista por categoría', async ({
    page,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const activitiesPage = new ActivitiesPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const title = `Categoria E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await activitiesPage.openTasks();
      const taskId = await activitiesPage.createTask({
        title,
        description: 'Flujo ITSM de categorias',
        priority: 'MEDIUM',
        category: 'Sistemas',
      });

      const created = await db.recordByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(created?.categoryId)).toBe('SISTEMAS');

      await activitiesPage.selectCategoryFilter('Sistemas');
      await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();
      await activitiesPage.selectCategoryFilter('Operaciones');
      await expect(page.getByText(title, { exact: true })).toHaveCount(0);
      await activitiesPage.selectCategoryFilter('Todas las categorías');
      await expect(page.getByText(title, { exact: true }).filter({ visible: true }).first()).toBeVisible();

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await activitiesPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });

  test('crea tarea con campo personalizado, lo persiste y lo muestra en el detalle', async ({
    page,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const activitiesPage = new ActivitiesPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const title = `Campos E2E ${suffix}`;
    const fieldValue = `CRM E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      await activitiesPage.openTasks();
      const taskId = await activitiesPage.createTask({
        title,
        description: 'Flujo ITSM de campos personalizados',
        priority: 'MEDIUM',
        customFields: { servicioAfectado: fieldValue },
      });

      const created = await db.recordByScope('activities', taskId, 'clientTenantId', fullTenantSession.tenantId);
      const rawFields = created?.customFields;
      const fields = typeof rawFields === 'string' ? JSON.parse(rawFields) : rawFields;
      expect(fields).toMatchObject({ servicioAfectado: fieldValue });

      await activitiesPage.openDetail(taskId);
      await expect(page.getByText('Servicio afectado', { exact: true }).last()).toBeVisible();
      await expect(page.getByText(fieldValue, { exact: true })).toBeVisible();
      await activitiesPage.closeDetail();

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await activitiesPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });

  test('muestra el semáforo SLA, el consumo y el plazo agotado en vencida y en tiempo', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const activitiesPage = new ActivitiesPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const overdueTitle = `SLA vencida E2E ${suffix}`;
    const onTimeTitle = `SLA en tiempo E2E ${suffix}`;
    const overdueDueAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const onTimeDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    const authHeader = { Authorization: `Bearer ${fullTenantSession.token}` };
    const mark = apiInterceptor.mark();

    try {
      const overdueResponse = await request.post(`${apiUrl}/activities/tasks`, {
        headers: authHeader,
        data: { title: overdueTitle, description: 'SLA vencido', priority: 'URGENT', dueDate: overdueDueAt },
      });
      expect(overdueResponse.ok()).toBeTruthy();
      const overdue = await json<{ id: string }>(overdueResponse);
      expect(overdue.id).toBeTruthy();

      const onTimeResponse = await request.post(`${apiUrl}/activities/tasks`, {
        headers: authHeader,
        data: { title: onTimeTitle, description: 'SLA en tiempo', priority: 'MEDIUM', dueDate: onTimeDueAt },
      });
      expect(onTimeResponse.ok()).toBeTruthy();
      const onTime = await json<{ id: string }>(onTimeResponse);
      expect(onTime.id).toBeTruthy();

      const overdueRow = await db.recordByScope('activities', overdue.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(overdueRow?.slaDueAt).not.toBeNull();
      const onTimeRow = await db.recordByScope('activities', onTime.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(onTimeRow?.slaDueAt).not.toBeNull();

      await activitiesPage.openTasks();

      // Semáforo en la tabla para la vencida (búsqueda deja una sola fila).
      await activitiesPage.searchTasks(overdueTitle);
      await expect(page.getByText(onTimeTitle, { exact: true })).toHaveCount(0);
      await expect(page.getByTestId('sla-badge-breached').filter({ visible: true })).toHaveCount(1);

      // Detalle: plazo agotado + consumo total.
      await activitiesPage.openDetail(overdue.id);
      const overdueDialog = page.getByRole('dialog');
      await expect(overdueDialog.getByText('Acuerdo de Nivel de Servicio (SLA)')).toBeVisible();
      await expect(overdueDialog.getByTestId('sla-badge-breached')).toBeVisible();
      await expect(overdueDialog.getByText('El plazo acordado ya se agotó')).toBeVisible();
      await expect(overdueDialog.getByText('Consumo del plazo')).toBeVisible();
      await expect(overdueDialog.getByRole('progressbar', { name: 'Consumo del SLA' })).toBeVisible();
      await expect(overdueDialog.getByText('Tiempo consumido del SLA: 100%')).toBeVisible();
      await activitiesPage.closeDetail();

      // Semáforo en tiempo para la futura.
      await activitiesPage.searchTasks(onTimeTitle);
      await expect(page.getByText(overdueTitle, { exact: true })).toHaveCount(0);
      await expect(page.getByTestId('sla-badge-on_time').filter({ visible: true })).toHaveCount(1);

      await activitiesPage.openDetail(onTime.id);
      const onTimeDialog = page.getByRole('dialog');
      await expect(onTimeDialog.getByTestId('sla-badge-on_time')).toBeVisible();
      await expect(onTimeDialog.getByText(/Quedan/)).toBeVisible();
      await activitiesPage.closeDetail();

      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
      await activitiesPage.assertNoViewportOverflow();
    } finally {
      await db.close();
    }
  });
});
