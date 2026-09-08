import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { BasePage } from '../page-objects/BasePage';

test.describe('NovaHub ERP — financiamiento PYME, expediente y estados', () => {
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

  test('crea solicitud, agrega documento/nota, cambia estado y protege prefill por tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const basePage = new BasePage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const mark = apiInterceptor.mark();
    const payload = {
      requestedAmount: 50_000,
      termMonths: 24,
      purpose: 'capital_trabajo',
      guarantees: ['sin_garantia'],
      repaymentSource: 'ingresos_operativos',
      monthlyRevenue: 100_000,
      monthlyExpenses: 60_000,
      totalAssets: 200_000,
      totalLiabilities: 80_000,
      fundsDeclaration: true,
      isRucRegistered: true,
      hasIrDeclarations: true,
    };

    try {
      const createResponse = await request.post(`${apiUrl}/financing/applications`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: payload,
      });
      expect(createResponse.status()).toBeGreaterThanOrEqual(200);
      expect(createResponse.status()).toBeLessThan(300);
      const created = await json<{ id: string; status: string }>(createResponse);
      const application = await db.recordByScope('financingApplications', created.id, 'tenantId', fullTenantSession.tenantId);
      expect(application).not.toBeNull();
      expect(String(application?.status)).toBe('PENDING');
      expect(Number(application?.netWorth)).toBeCloseTo(120_000, 6);
      expect(Number(application?.monthlyCashFlow)).toBeCloseTo(40_000, 6);
      expect(Number(application?.debtRatio)).toBeCloseTo(0.6, 6);
      await db.assertOwnedByScope('financingApplications', created.id, 'tenantId', fullTenantSession.tenantId);

      const documentResponse = await request.post(`${apiUrl}/financing/applications/${created.id}/documents`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { type: 'RUC', fileName: `RUC-${suffix}.pdf`, fileUrl: 'https://e2e.novahub.test/financing/ruc.pdf', fileSize: 1024, isRequired: true },
      });
      expect(documentResponse.status()).toBeGreaterThanOrEqual(200);
      expect(documentResponse.status()).toBeLessThan(300);
      const document = await json<{ id: string }>(documentResponse);
      expect(await db.recordByIdUnscoped('financingDocuments', document.id)).not.toBeNull();

      const noteResponse = await request.post(`${apiUrl}/financing/applications/${created.id}/notes`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { note: `Revisión E2E ${suffix}` },
      });
      expect(noteResponse.status()).toBeGreaterThanOrEqual(200);
      expect(noteResponse.status()).toBeLessThan(300);

      const statusResponse = await request.patch(`${apiUrl}/financing/applications/${created.id}/status`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'IN_REVIEW', reviewNotes: `Documentación en revisión ${suffix}` },
      });
      expect(statusResponse.status()).toBeGreaterThanOrEqual(200);
      expect(statusResponse.status()).toBeLessThan(300);
      const updated = await db.recordByScope('financingApplications', created.id, 'tenantId', fullTenantSession.tenantId);
      expect(String(updated?.status)).toBe('IN_REVIEW');
      expect(String(updated?.reviewNotes)).toContain(suffix);

      const calculator = await request.get(`${apiUrl}/financing/calculator?amount=50000&term=24&rate=18`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
      });
      expect(calculator.ok()).toBeTruthy();
      expect(Number((await calculator.json() as { monthlyPayment?: number }).monthlyPayment)).toBeGreaterThan(0);

      const invalidCreate = await request.post(`${apiUrl}/financing/applications`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { ...payload, requestedAmount: 0 },
      });
      expect(invalidCreate.status()).toBeGreaterThanOrEqual(400);
      expect(invalidCreate.status()).toBeLessThan(500);
      expect(await db.countByScope('financingApplications', 'tenantId', fullTenantSession.tenantId)).toBe(1);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Financiamiento Ajeno ${suffix}`,
          userName: 'Admin Financiamiento Ajeno',
          email: `financing-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['FINANCING'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherList = await request.get(`${apiUrl}/financing/applications`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherList.ok()).toBeTruthy();
      expect(await otherList.json()).toEqual([]);
      const crossTenantPrefill = await request.get(`${apiUrl}/financing/prefill/${fullTenantSession.tenantId}`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(crossTenantPrefill.status()).toBe(403);

      await basePage.gotoModule('financiamiento-pyme', 'solicitudes-financiamiento');
      await basePage.waitForAppShell();
      await expect(page.getByRole('heading', { name: /Financiamiento PyME/i })).toBeVisible({ timeout: 20_000 });
      await basePage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});
