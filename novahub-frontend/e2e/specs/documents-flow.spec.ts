import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { DocumentsPage } from '../page-objects/DocumentsPage';

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

test.describe('NovaHub ERP — Documentos, ownership y Nova Cloud', () => {
  test.setTimeout(120_000);

  test('registra un archivo dentro del tenant y confirma la mutación visual de contratos', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const documentsPage = new DocumentsPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const fileName = `documento-e2e-${suffix}.txt`;
    const tenantScope = fullTenantSession.tenantId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    const fileUri = `storage://documents/${tenantScope}/${fileName}`;
    const mark = apiInterceptor.mark();
    const headers = { Authorization: `Bearer ${fullTenantSession.token}` };

    try {
      // The isolated E2E database deliberately has no corresponding object in
      // the production Supabase bucket. Keep the storage boundary observable
      // without reading or mutating external storage: the document creation,
      // tenant authorization and database assertions still use the real API.
      await page.route('**/api/storage/resolve', async (route) => {
        const body = route.request().postDataJSON() as { uri?: string } | null;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: `https://e2e.invalid/resolved/${encodeURIComponent(String(body?.uri || ''))}` }),
        });
      });
      await documentsPage.openFiles();
      await documentsPage.assertResponsiveLayout();
      await documentsPage.assertNoViewportOverflow();

      const createResponse = await request.post(`${apiUrl}/documents/files`, {
        headers,
        data: {
          name: fileName,
          url: fileUri,
          type: 'text/plain',
          size: 1,
          category: 'E2E',
        },
      });
      if (createResponse.status() < 200 || createResponse.status() >= 300) {
        throw new Error(`No se pudo registrar el archivo: HTTP ${createResponse.status()} ${await createResponse.text()}`);
      }
      expect(createResponse.status()).toBeLessThan(300);
      const created = await json<{ id: string; name: string; url: string }>(createResponse);
      expect(created.name).toBe(fileName);
      expect(created.url).toBe(fileUri);

      const persisted = await db.recordByScope('documents', created.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.name)).toBe(fileName);
      expect(String(persisted?.uploadedById)).toBe(fullTenantSession.userId);
      expect(String(persisted?.folder)).toBe('E2E');
      await db.assertOwnedByScope('documents', created.id, 'clientTenantId', fullTenantSession.tenantId);

      await documentsPage.openFiles();
      await expect(page.getByText(fileName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

      const invalidResponse = await request.post(`${apiUrl}/documents/files`, {
        headers,
        data: { name: 'incompleto.txt', type: 'text/plain', size: 1 },
      });
      expect(invalidResponse.status()).toBeGreaterThanOrEqual(400);
      expect(invalidResponse.status()).toBeLessThan(500);
      expect(await db.countByScope('documents', 'clientTenantId', fullTenantSession.tenantId)).toBe(1);

      await documentsPage.openContracts();
      await documentsPage.createContract();
      await documentsPage.assertResponsiveLayout();
      await documentsPage.assertNoViewportOverflow();

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant Documentos Ajeno ${suffix}`,
          userName: 'Admin Documentos Ajeno',
          email: `documents-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['DOCUMENTS'],
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
      const otherFilesResponse = await request.get(`${apiUrl}/documents/files`, { headers: otherHeaders });
      expect(otherFilesResponse.ok()).toBeTruthy();
      const otherFiles = await otherFilesResponse.json() as unknown[];
      expect(otherFiles).toHaveLength(0);
      await db.assertNotVisibleByScope('documents', created.id, 'clientTenantId', String(otherProfile.clientTenantId));

      apiInterceptor.assertSuccessful({ since: mark, maxLatencyMs: 10_000 });
    } finally {
      await page.unroute('**/api/storage/resolve').catch(() => undefined);
      await db.close();
    }
  });
});
