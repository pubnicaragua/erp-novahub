import { test, expect } from '../fixtures/full-auth.fixture';
import { registerE2eTenant } from '../fixtures/auth.fixture';
import { createDbAssertions } from '../helpers/db-assertions';
import { AccountingPage } from '../page-objects/AccountingPage';

const apiUrl = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

test.describe('NovaHub ERP — Contabilidad y aislamiento de plan de cuentas', () => {
  test.setTimeout(120_000);

  test('crea una cuenta desde UI, la persiste en Prisma y no la expone a otro tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const accountingPage = new AccountingPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 14);
    const code = `E2E-${suffix}`;
    const name = `Cuenta E2E ${suffix}`;
    const before = await db.countByScope('accounts', 'clientTenantId', fullTenantSession.tenantId);
    const mark = apiInterceptor.mark();

    try {
      await accountingPage.openChartOfAccounts();
      const accountId = await accountingPage.createAccount({ code, name });

      const account = await db.recordByScope('accounts', accountId, 'clientTenantId', fullTenantSession.tenantId);
      expect(account).not.toBeNull();
      expect(account?.code).toBe(code);
      expect(account?.name).toBe(name);
      expect(account?.type).toBe('ASSET');
      expect(await db.countByScope('accounts', 'clientTenantId', fullTenantSession.tenantId)).toBe(before + 1);

      const duplicate = await request.post(`${apiUrl}/accounting/accounts`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { code, name: `${name} duplicada`, type: 'ASSET' },
      });
      expect(duplicate.status()).toBeGreaterThanOrEqual(400);
      expect(duplicate.status()).toBeLessThan(500);
      expect(await db.countByScope('accounts', 'clientTenantId', fullTenantSession.tenantId)).toBe(before + 1);

      const otherTenant = await registerE2eTenant(request, `accounting-other-${fullTenantSession.runId}`, ['ACCOUNTING']);
      const otherList = await request.get(`${apiUrl}/accounting/accounts`, {
        headers: { Authorization: `Bearer ${otherTenant.token}` },
      });
      expect(otherList.ok()).toBeTruthy();
      const otherBody = await otherList.json() as { data?: unknown[] } | unknown[];
      const otherAccounts = Array.isArray(otherBody) ? otherBody : (otherBody.data || []);
      expect(otherAccounts).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: accountId })]));
      await db.assertNotVisibleByScope('accounts', accountId, 'clientTenantId', otherTenant.tenantId);

      await accountingPage.assertResponsiveLayout();
      await accountingPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({
        since: mark,
        maxLatencyMs: 10_000,
        requireJsonContentType: true,
        validateRequestPayload: true,
      });
    } finally {
      await db.close();
    }
  });
});
