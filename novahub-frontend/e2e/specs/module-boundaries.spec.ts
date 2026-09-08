import { test, expect } from '../fixtures/auth.fixture';
import { E2E_MODULE_CATALOG } from '../module-catalog';
import { E2E_MODULE_CONTRACTS } from '../module-contracts';
import { ModulePage } from '../page-objects/ModulePage';

const apiUrl = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

test.describe('NovaHub ERP — fronteras de acceso y módulo deshabilitado', () => {
  test.setTimeout(600_000);

  test('recorre todas las superficies con un tenant restringido', async ({ page, tenantSession, apiInterceptor }) => {
    const modulePage = new ModulePage(page);
    const mark = apiInterceptor.mark();

    for (const module of E2E_MODULE_CATALOG) {
      await modulePage.open(module);
      await modulePage.assertResponsiveLayout();
      await modulePage.assertModuleAvailableOrProtected(module);
    }

    expect(tenantSession.tenantId).toBeTruthy();
    expect(apiInterceptor.records({ since: mark }).filter((record) => record.status !== undefined && record.status >= 500)).toEqual([]);
  });

  test('cada probe conserva el límite de autenticación y de módulo', async ({ request, tenantSession }) => {
    for (const contract of E2E_MODULE_CONTRACTS) {
      if (!contract.apiProbe || contract.scope === 'ui-only') continue;

      const probePath = `${apiUrl}${contract.apiProbe.path}`;
      const anonymous = await request.get(probePath);
      if (contract.scope === 'public') {
        expect(anonymous.status(), `${contract.moduleId} público no debe fallar con 5xx`).toBeLessThan(500);
      } else {
        expect([401, 403], `${contract.moduleId} aceptó un probe sin JWT`).toContain(anonymous.status());
      }

      const authenticated = await request.get(probePath, {
        headers: { Authorization: `Bearer ${tenantSession.token}` },
      });
      expect(authenticated.status(), `${contract.moduleId} devolvió un error de servidor`).toBeLessThan(500);
      expect(authenticated.status(), `${contract.moduleId} apunta a una ruta inexistente`).not.toBe(404);
      if (authenticated.status() < 300) {
        expect(authenticated.headers()['content-type'] || '').toContain('application/json');
      } else {
        expect([401, 403], `${contract.moduleId} devolvió un rechazo no documentado`).toContain(authenticated.status());
      }
    }
  });
});
