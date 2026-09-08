import type { APIRequestContext } from '@playwright/test';
import { test as base, expect } from '../helpers/errorCapture';
import { ApiInterceptor } from '../helpers/api-interceptor';
import { assertE2eDatabaseConfigured, createDbAssertions } from '../helpers/db-assertions';

export interface TenantSession {
  token: string;
  tenantId: string;
  userId: string;
  email: string;
  password: string;
  branchId?: string;
  warehouseId?: string;
  runId: string;
}

export interface AuthFixtures {
  tenantSession: TenantSession;
  apiInterceptor: ApiInterceptor;
}

export const DEFAULT_E2E_MODULES = [
  'INVENTORY',
  'SALES',
  'PURCHASES',
  'REPORTS',
  'ACCOUNTING',
  'NOVACHAT',
] as const;

export const FULL_E2E_MODULES = [
  'SALES',
  'PURCHASES',
  'INVENTORY',
  'FINANCIAL',
  'HR',
  'PROJECTS',
  'CLIENTS',
  'PROVIDERS',
  'ACTIVITIES',
  'DOCUMENTS',
  'REPORTS',
  'CONFIGURATION',
  'TICKETS',
  'NOTIFICATIONS',
  'ACCOUNTING',
  'RETAIL_POS',
  'RESTAURANT',
  'TRACKING',
  'TRACKING_TRANSIT',
  'NOVACHAT',
  'LEGAL',
  'FINANCING',
  'SUPPORT_TECH',
] as const;

interface ApiResponseBody {
  access_token?: string;
  clientTenantId?: string;
  user?: { id?: string; clientTenantId?: string };
}

const API_URL = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

function uniqueRunId(): string {
  const cryptoApi = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function parseBody<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
  }
}

export async function registerE2eTenant(
  request: APIRequestContext,
  runId: string,
  selectedModules: readonly string[] = DEFAULT_E2E_MODULES,
): Promise<TenantSession> {
  const email = `e2e-${runId.replace(/[^a-z0-9]/gi, '').slice(0, 24)}@novahub.test`;
  const password = 'E2eTest!2026Xx';
  const response = await request.post(`${API_URL}/auth/register-tenant`, {
    data: {
      companyName: `Empresa E2E ${runId}`,
      userName: 'Admin E2E',
      email,
      password,
      industry: 'OTHER',
      selectedModules,
    },
  });
  if (response.status() < 200 || response.status() >= 300) {
    throw new Error(`No se pudo crear tenant E2E (${response.status()}): ${await response.text()}`);
  }
  const body = await parseBody<ApiResponseBody>(response);
  if (!body.access_token) throw new Error('register-tenant no devolvió access_token.');

  const profileResponse = await request.get(`${API_URL}/auth/profile`, {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  if (!profileResponse.ok()) throw new Error(`No se pudo consultar el perfil E2E (${profileResponse.status()}).`);
  const profile = await parseBody<{ id?: string; clientTenantId?: string }>(profileResponse);
  const tenantId = profile.clientTenantId || body.user?.clientTenantId || body.clientTenantId;
  if (!tenantId || !profile.id) throw new Error('El perfil E2E no devolvió tenantId o userId.');

  const bootstrapDb = createDbAssertions();
  try {
    await bootstrapDb.ensureTenantBusinessUnit(tenantId, runId);
  } finally {
    await bootstrapDb.close();
  }

  const branchesResponse = await request.get(`${API_URL}/auth/me/branches`, {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  let branchId: string | undefined;
  let warehouseId: string | undefined;
  if (branchesResponse.ok()) {
    const branchesBody = await parseBody<unknown>(branchesResponse);
    const branches = Array.isArray(branchesBody)
      ? branchesBody
      : (branchesBody as { data?: unknown[] })?.data || [];
    const branch = branches[0] as {
      id?: string;
      branchId?: string;
      warehouseId?: string;
      warehouses?: Array<{ id?: string }>;
    } | undefined;
    branchId = branch?.id || branch?.branchId;
    warehouseId = branch?.warehouseId || branch?.warehouses?.[0]?.id;
  }

  return { token: body.access_token, tenantId, userId: profile.id, email, password, branchId, warehouseId, runId };
}

export const test = base.extend<AuthFixtures>({
  apiInterceptor: async ({ page, captureErrors }, use) => {
    const interceptor = new ApiInterceptor(page);
    await use(interceptor);
    interceptor.assertNoServerErrors();
    expect(captureErrors.all, 'La navegación autenticada no debe dejar errores de consola, JS o red').toEqual([]);
  },

  tenantSession: async ({ request, page }, use) => {
    assertE2eDatabaseConfigured();
    const runId = uniqueRunId();
    const db = createDbAssertions();
    try {
      const session = await registerE2eTenant(request, runId);
      await page.addInitScript(({ token }: { token: string }) => {
        window.localStorage.setItem('nh-auth-token', token);
      }, { token: session.token });
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

export { expect };
