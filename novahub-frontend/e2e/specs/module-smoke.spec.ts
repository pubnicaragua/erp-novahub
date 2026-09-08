import { test, expect } from '../fixtures/full-auth.fixture';
import { ModulePage } from '../page-objects/ModulePage';
import { E2E_MODULE_CATALOG } from '../module-catalog';

test.describe('NovaHub ERP — inventario general de módulos', () => {
  for (const module of E2E_MODULE_CATALOG) {
    test(`${module.label} (${module.id}) renderiza o informa acceso`, async ({ page, fullTenantSession, apiInterceptor }) => {
      const modulePage = new ModulePage(page);
      const mark = apiInterceptor.mark();
      await modulePage.open(module);
      await modulePage.assertResponsiveLayout();
      await modulePage.assertModuleAvailableOrProtected(module);
      expect(apiInterceptor.records({ since: mark }).filter((record) => record.status !== undefined && record.status >= 500)).toEqual([]);
      expect(fullTenantSession.tenantId).toBeTruthy();
    });
  }
});
