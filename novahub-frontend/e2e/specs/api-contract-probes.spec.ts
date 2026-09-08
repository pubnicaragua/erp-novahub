import { test, expect } from '../fixtures/full-auth.fixture';
import { E2E_MODULE_CONTRACTS } from '../module-contracts';

const apiUrl = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

const probedContracts = E2E_MODULE_CONTRACTS.filter((contract) => Boolean(contract.apiProbe));
const protectedContracts = probedContracts.filter(
  (contract) => contract.scope !== 'public' && contract.scope !== 'ui-only',
);

test.describe('NovaHub ERP — límites HTTP de contratos por módulo', () => {
  for (const contract of probedContracts) {
    test(`${contract.moduleId} expone su probe sin error 5xx ni 404`, async ({ request, fullTenantSession }) => {
      const probe = contract.apiProbe!;
      const startedAt = performance.now();
      const response = await request.get(`${apiUrl}${probe.path}`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
      });
      const durationMs = performance.now() - startedAt;

      expect(response.status(), `${contract.moduleId} no debe ocultar un error de servidor`).toBeLessThan(500);
      expect(response.status(), `${contract.moduleId} debe resolver un controller real`).not.toBe(404);
      expect(durationMs, `${contract.moduleId} superó la latencia máxima del probe`).toBeLessThan(10_000);

      if (response.status() < 300) {
        expect(response.headers()['content-type'] || '').toContain('application/json');
        const payload = await response.json();
        expect(payload, `${contract.moduleId} devolvió un payload JSON vacío`).toBeDefined();
      } else {
        // Un tenant operativo puede recibir 403 en módulos no contratados o
        // reservados a plataforma; el 401/403 sigue siendo un límite esperado.
        expect([401, 403]).toContain(response.status());
      }
    });
  }

  for (const contract of protectedContracts) {
    test(`${contract.moduleId} no expone su probe sin autenticación`, async ({ request }) => {
      const probe = contract.apiProbe!;
      const response = await request.get(`${apiUrl}${probe.path}`);

      expect([401, 403], `${contract.moduleId} aceptó una consulta sin JWT`).toContain(response.status());
    });
  }
});
