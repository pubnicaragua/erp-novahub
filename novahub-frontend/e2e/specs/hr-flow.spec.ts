import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { HrPage } from '../page-objects/HrPage';

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

test.describe('NovaHub ERP — RR. HH., catálogos, empleados y aislamiento', () => {
  test.setTimeout(120_000);

  test('crea un empleado desde UI, persiste la estructura laboral y no cruza tenants', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const hrPage = new HrPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const departmentName = `Departamento E2E ${suffix}`;
    const positionTitle = `Analista E2E ${suffix}`;
    const employeeNumber = `EMP-${suffix}`;
    const employeeEmail = `empleado-${suffix}@novahub.test`;
    const mark = apiInterceptor.mark();

    try {
      const authHeaders = { Authorization: `Bearer ${fullTenantSession.token}` };
      const departmentResponse = await request.post(`${apiUrl}/hr/departments`, {
        headers: authHeaders,
        data: { type: 'HR', name: departmentName, code: `DEP-${suffix}` },
      });
      expect(departmentResponse.status()).toBeGreaterThanOrEqual(200);
      expect(departmentResponse.status()).toBeLessThan(300);
      const department = await json<{ id: string }>(departmentResponse);

      const positionResponse = await request.post(`${apiUrl}/hr/positions`, {
        headers: authHeaders,
        data: { departmentId: department.id, title: positionTitle, code: `POS-${suffix}` },
      });
      expect(positionResponse.status()).toBeGreaterThanOrEqual(200);
      expect(positionResponse.status()).toBeLessThan(300);
      const position = await json<{ id: string }>(positionResponse);

      const employeesBefore = await db.countByScope('employees', 'clientTenantId', fullTenantSession.tenantId);
      await hrPage.openEmployees();
      await hrPage.assertResponsiveLayout();
      await hrPage.assertNoViewportOverflow();
      await hrPage.createEmployee({
        employeeNumber,
        firstName: 'Empleado',
        lastName: `E2E ${suffix}`,
        email: employeeEmail,
        hireDate: '2026-01-15',
        departmentName,
        positionTitle,
        salary: 18500,
      });

      const employees = await db.countByScope('employees', 'clientTenantId', fullTenantSession.tenantId);
      expect(employees).toBe(employeesBefore + 1);
      const employeeList = await request.get(`${apiUrl}/hr/employees?search=${encodeURIComponent(employeeNumber)}`, {
        headers: authHeaders,
      });
      expect(employeeList.ok()).toBeTruthy();
      const employeeBody = await employeeList.json() as { data?: Array<{ id: string; employeeNumber: string }> };
      const created = employeeBody.data?.find((employee) => employee.employeeNumber === employeeNumber);
      expect(created?.id).toBeTruthy();

      const persisted = await db.recordByScope('employees', String(created?.id), 'clientTenantId', fullTenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.departmentId)).toBe(department.id);
      expect(String(persisted?.positionId)).toBe(position.id);
      expect(String(persisted?.employmentStatus)).toBe('ACTIVE');
      expect(String(persisted?.contractType)).toBe('FULL_TIME');
      expect(Number(persisted?.salary)).toBeCloseTo(18500, 6);
      await db.assertOwnedByScope('employees', String(created?.id), 'clientTenantId', fullTenantSession.tenantId);

      const invalidResponse = await request.post(`${apiUrl}/hr/employees`, {
        headers: authHeaders,
        data: {
          employeeNumber: `INVALID-${suffix}`,
          firstName: 'Inválido',
          lastName: 'E2E',
          email: 'correo-no-valido',
          hireDate: '2026-01-15',
          departmentId: department.id,
          positionId: position.id,
          contractType: 'FULL_TIME',
          salary: 1,
        },
      });
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status()).toBeLessThan(500);
      expect(await db.countByScope('employees', 'clientTenantId', fullTenantSession.tenantId)).toBe(employeesBefore + 1);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant RH Ajeno ${suffix}`,
          userName: 'Admin RH Ajeno',
          email: `hr-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['HR'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherHeaders = { Authorization: `Bearer ${otherTenant.access_token}` };
      const otherProfileResponse = await request.get(`${apiUrl}/auth/profile`, { headers: otherHeaders });
      expect(otherProfileResponse.ok()).toBeTruthy();
      const otherProfile = await otherProfileResponse.json() as { clientTenantId?: string };
      expect(otherProfile.clientTenantId).toBeTruthy();
      const otherListResponse = await request.get(`${apiUrl}/hr/employees?search=${encodeURIComponent(employeeNumber)}`, {
        headers: otherHeaders,
      });
      expect(otherListResponse.ok()).toBeTruthy();
      const otherList = await otherListResponse.json() as { data?: unknown[] };
      expect(otherList.data || []).toHaveLength(0);
      await db.assertNotVisibleByScope('employees', String(created?.id), 'clientTenantId', String(otherProfile.clientTenantId));

      apiInterceptor.assertSuccessful({ since: mark, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});
