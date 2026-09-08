import { test as base, expect, type TenantSession } from './auth.fixture';
import { ApiInterceptor } from '../helpers/api-interceptor';
import { assertE2eDatabaseConfigured, createDbAssertions } from '../helpers/db-assertions';
import { FULL_E2E_MODULES, registerE2eTenant } from './auth.fixture';

interface FullAuthFixtures {
  fullTenantSession: TenantSession;
  apiInterceptor: ApiInterceptor;
}

export const test = base.extend<FullAuthFixtures>({
  fullTenantSession: async ({ request, page }, use) => {
    assertE2eDatabaseConfigured();
    const runId = `full-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const db = createDbAssertions();
    try {
      const session = await registerE2eTenant(request, runId, FULL_E2E_MODULES);
      await page.addInitScript(({ token }: { token: string }) => {
        window.localStorage.setItem('nh-auth-token', token);
      }, { token: session.token });
      await use(session);
    } finally {
      await page.close().catch(() => undefined);
      await db.resetIsolatedDatabase().catch((error: unknown) => {
        console.error('[e2e:cleanup] no se pudo limpiar la base E2E del tenant completo', error);
        throw error;
      });
      await db.close();
    }
  },
});

export { expect };
