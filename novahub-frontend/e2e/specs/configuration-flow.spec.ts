import { test, expect } from '../fixtures/full-auth.fixture';
import { createDbAssertions } from '../helpers/db-assertions';
import { ConfigurationPage } from '../page-objects/ConfigurationPage';

test.describe('NovaHub ERP — Configuración de tema por usuario', () => {
  test.setTimeout(120_000);

  test('guarda el tema visual sin mutar el branding de otro tenant', async ({ page, fullTenantSession, apiInterceptor }) => {
    const db = createDbAssertions();
    const configurationPage = new ConfigurationPage(page);
    const color = '#123456';

    try {
      await configurationPage.openBranding();
      await configurationPage.saveTheme(color);

      const user = await db.recordByIdUnscoped('users', fullTenantSession.userId);
      expect(user).not.toBeNull();
      const themeSettings = user?.themeSettings as { colors?: { primary?: string } } | null;
      expect(themeSettings?.colors?.primary).toBe(color);
      expect(user?.clientTenantId).toBe(fullTenantSession.tenantId);

      await configurationPage.assertResponsiveLayout();
      await configurationPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({
        maxLatencyMs: 10_000,
        requireJsonContentType: true,
        validateRequestPayload: true,
      });
    } finally {
      await db.close();
    }
  });
});
