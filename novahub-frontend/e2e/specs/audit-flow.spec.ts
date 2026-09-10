import { expect } from '@playwright/test';
import {
  FULL_E2E_MODULES,
  registerE2eTenant,
  test as base,
  type TenantSession,
} from '../fixtures/auth.fixture';
import { assertE2eDatabaseConfigured, createDbAssertions } from '../helpers/db-assertions';

type ApiBody = Record<string, any>;

const API_URL = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

function runId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function body(response: Awaited<ReturnType<Parameters<typeof registerE2eTenant>[0]['post']>>): Promise<ApiBody> {
  const text = await response.text();
  try {
    return JSON.parse(text) as ApiBody;
  } catch {
    throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
  }
}

async function expectStatus(response: Awaited<ReturnType<Parameters<typeof registerE2eTenant>[0]['post']>>, status: number): Promise<ApiBody> {
  const parsed = await body(response);
  expect(response.status(), response.url()).toBe(status);
  return parsed;
}

async function createCustomer(request: Parameters<typeof registerE2eTenant>[0], session: TenantSession, name: string): Promise<string> {
  const response = await request.post(`${API_URL}/sales/customers`, {
    headers: headers(session.token),
    data: { name, type: 'INDIVIDUAL', email: `${session.runId}@novahub.test` },
  });
  const created = await expectStatus(response, 201);
  const customer = created.data || created;
  if (!customer.id) throw new Error(`La creación del cliente no devolvió id: ${JSON.stringify(created)}`);
  return String(customer.id);
}

async function auditLogs(request: Parameters<typeof registerE2eTenant>[0], token: string, query: string): Promise<ApiBody> {
  const response = await request.get(`${API_URL}/audit/logs?${query}`, { headers: headers(token) });
  return expectStatus(response, 200);
}

const test = base.extend<{ fullTenantSession: TenantSession }>({
  fullTenantSession: async ({ request, page }, use) => {
    assertE2eDatabaseConfigured();
    const session = await registerE2eTenant(request, runId('audit'), FULL_E2E_MODULES);
    await page.addInitScript(({ token }: { token: string }) => {
      window.localStorage.setItem('nh-auth-token', token);
    }, { token: session.token });
    const db = createDbAssertions();
    try {
      await use(session);
    } finally {
      await page.close().catch(() => undefined);
      await db.resetIsolatedDatabase().catch((error: unknown) => {
        console.error('[e2e:cleanup] no se pudo limpiar la base E2E', error);
        throw error;
      });
      await db.close();
    }
  },
});

test.describe('Logs y auditoría por sucursal', () => {
  test('registra, consulta y aísla eventos de una sucursal', async ({ request, fullTenantSession }) => {
    const customerId = await createCustomer(request, fullTenantSession, `Cliente auditoría ${fullTenantSession.runId}`);
    const byEntity = await auditLogs(request, fullTenantSession.token, `identifier=${encodeURIComponent(customerId)}&pageSize=20`);
    const event = (byEntity.items || []).find((item: ApiBody) => item.entityId === customerId);

    expect(event).toBeTruthy();
    expect(event.clientTenantId).toBe(fullTenantSession.tenantId);
    expect(event.branchId).toBe(fullTenantSession.tenantId);
    expect(event.module).toBe('SALES');
    expect(event.action).toBe('CREATE');
    expect(event.result).toBe('SUCCESS');
    expect(event.correlationId).toBeTruthy();

    const byBranch = await auditLogs(request, fullTenantSession.token, `branchId=${fullTenantSession.tenantId}&pageSize=50`);
    expect((byBranch.items || []).length).toBeGreaterThan(0);
    expect((byBranch.items || []).every((item: ApiBody) => item.clientTenantId === fullTenantSession.tenantId)).toBe(true);

    const otherSession = await registerE2eTenant(request, runId('audit-other'), FULL_E2E_MODULES);
    const crossBranch = await request.get(`${API_URL}/audit/logs?branchId=${otherSession.tenantId}`, {
      headers: headers(fullTenantSession.token),
    });
    await expectStatus(crossBranch, 403);

    const writeAttempt = await request.post(`${API_URL}/audit/logs`, {
      headers: headers(fullTenantSession.token),
      data: {},
    });
    expect(writeAttempt.status()).toBe(404);

    const failedLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: fullTenantSession.email, password: 'WrongPassword!2026' },
    });
    expect(failedLogin.status()).toBe(401);
    const securityLogs = await auditLogs(request, fullTenantSession.token, 'module=AUTH&action=LOGIN_FAILED&pageSize=50');
    const failedEvent = (securityLogs.items || []).find((item: ApiBody) => item.clientTenantId === fullTenantSession.tenantId);
    expect(failedEvent).toBeTruthy();
    expect(JSON.stringify(failedEvent)).not.toContain('WrongPassword!2026');
    expect(JSON.stringify(failedEvent.metadata || failedEvent.details || '')).not.toMatch(/passwordHash|authorization|token/i);
  });
});

test.describe('Auditoría consolidada de Manager', () => {
  test('muestra eventos de la sucursal autorizada y bloquea otra sucursal', async ({ request, page, apiInterceptor, fullTenantSession }) => {
    void apiInterceptor;
    const db = createDbAssertions();
    const manager = await db.createManagerForTenant(fullTenantSession.tenantId, fullTenantSession.runId);
    await db.close();

    const customerId = await createCustomer(request, fullTenantSession, `Cliente manager ${fullTenantSession.runId}`);
    const managerLogin = await request.post(`${API_URL}/auth/login`, {
      data: { email: manager.email, password: manager.password },
    });
    const managerPayload = await expectStatus(managerLogin, 201);
    const managerToken = managerPayload.access_token;
    if (!managerToken) throw new Error('El login Manager no devolvió access_token.');

    const activity = await request.get(`${API_URL}/enterprise-groups/manager/${manager.groupId}/users/activity?branchId=${manager.branchId}&pageSize=50`, {
      headers: headers(managerToken),
    });
    const activityPayload = await expectStatus(activity, 200);
    const activityEvent = (activityPayload.items || []).find((item: ApiBody) => item.entityId === customerId);
    expect(activityEvent).toBeTruthy();
    expect(activityEvent.recordLabel).toBeTruthy();
    expect(activityEvent).not.toHaveProperty('metadata');
    expect(activityEvent).not.toHaveProperty('endpoint');
    expect((activityPayload.items || []).every((item: ApiBody) => item.clientTenantId === manager.branchId || item.clientTenant?.id === manager.branchId)).toBe(true);

    const otherSession = await registerE2eTenant(request, runId('manager-other'), FULL_E2E_MODULES);
    const forbidden = await request.get(`${API_URL}/enterprise-groups/manager/${manager.groupId}/users/activity?branchId=${otherSession.tenantId}`, {
      headers: headers(managerToken),
    });
    await expectStatus(forbidden, 403);

    await page.addInitScript(({ token }: { token: string }) => {
      window.localStorage.setItem('nh-auth-token', token);
    }, { token: managerToken });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Usuarios' })).toBeVisible({ timeout: 30_000 });
    const menuToggle = page.getByRole('button', { name: 'Abrir menú Manager' });
    if (await menuToggle.isVisible()) await menuToggle.click();
    await page.getByRole('button', { name: 'Usuarios' }).click();
    await expect(page.getByText('Auditoría consolidada', { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Logs inmutables de las sucursales dentro de tu alcance autorizado.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Filtrar rubro en auditoría')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel('Filtrar sucursal en auditoría')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('columnheader', { name: 'Rubro' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Sucursal' })).toBeVisible();
    await expect(page.getByText('Cliente manager', { exact: false })).toBeVisible({ timeout: 30_000 });

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewport + 1);
  });
});
