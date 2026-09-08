import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { FinancePage } from '../page-objects/FinancePage';

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

test.describe('NovaHub ERP — Finanzas, registros auxiliares y aislamiento', () => {
  test.setTimeout(120_000);

  test('registra un ingreso desde API, lo renderiza en Finanzas y no cruza tenants', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const financePage = new FinancePage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const accountCode = `E2E-INC-${suffix}`;
    const source = `Ingreso E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      const accountResponse = await request.post(`${apiUrl}/financials/accounts`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { code: accountCode, name: `Ingresos E2E ${suffix}`, type: 'INCOME' },
      });
      expect(accountResponse.status()).toBeGreaterThanOrEqual(200);
      expect(accountResponse.status()).toBeLessThan(300);
      const account = await json<{ id: string }>(accountResponse);

      const incomeResponse = await request.post(`${apiUrl}/financials/income`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: {
          amount: 275,
          date: '2026-01-15',
          source,
          description: 'Ingreso auxiliar para prueba E2E',
          accountId: account.id,
          category: 'SERVICIOS',
          currency: 'NIO',
        },
      });
      expect(incomeResponse.status()).toBeGreaterThanOrEqual(200);
      expect(incomeResponse.status()).toBeLessThan(300);
      const income = await json<{ id: string; amount: number; baseAmount?: number }>(incomeResponse);
      expect(income.id).toBeTruthy();

      const persisted = await db.recordByScope('incomes', income.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(Number(persisted?.amount)).toBeCloseTo(275, 6);
      expect(String(persisted?.accountId)).toBe(account.id);
      expect(String(persisted?.source)).toBe(source);
      await db.assertOwnedByScope('incomes', income.id, 'clientTenantId', fullTenantSession.tenantId);

      const invalidResponse = await request.post(`${apiUrl}/financials/income`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { amount: 20, date: '2026-01-15', source: `invalid-${suffix}` },
      });
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status()).toBeLessThan(500);

      await financePage.openOverview();
      await financePage.assertResponsiveLayout();
      await financePage.assertNoViewportOverflow();
      await expect(page.getByText(/ingreso/i).first()).toBeVisible();

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Finanzas Ajeno ${suffix}`,
          userName: 'Admin Finanzas Ajeno',
          email: `financials-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['FINANCIAL'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherListResponse = await request.get(`${apiUrl}/financials/income?search=${encodeURIComponent(source)}`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherListResponse.ok()).toBeTruthy();
      const otherList = await otherListResponse.json() as { data?: unknown[] };
      expect(otherList.data || []).toHaveLength(0);
      const otherProfile = await request.get(`${apiUrl}/auth/profile`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      const otherProfileBody = await otherProfile.json() as { clientTenantId?: string };
      await db.assertNotVisibleByScope('incomes', income.id, 'clientTenantId', String(otherProfileBody.clientTenantId));

      apiInterceptor.assertNoServerErrors();
      expect(apiInterceptor.records({ since: mark }).filter((record) => record.status !== undefined && record.status >= 500)).toEqual([]);
    } finally {
      await db.close();
    }
  });
});
