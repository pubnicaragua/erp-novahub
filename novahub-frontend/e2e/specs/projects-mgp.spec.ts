import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';

test.describe('NovaHub ERP — Módulo de Gestión de Proyectos (MGP) dual flow', () => {
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

  test('flujo completo MGP: hitos ponderados, enlace público, cotización de materiales, oferta de proveedor y selección', async ({
    request,
    fullTenantSession,
  }) => {
    const db = createDbAssertions();
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 14);
    const authHeaders = { Authorization: `Bearer ${fullTenantSession.token}` };

    // 1. Crear Proyecto para prueba
    const projectRes = await request.post(`${apiUrl}/projects`, {
      headers: authHeaders,
      data: {
        name: `Proyecto MGP ${suffix}`,
        description: 'Validación E2E de hitos ponderados y cotización de materiales',
        plannedBudget: 50000,
        currency: 'NIO',
        startDate: new Date().toISOString(),
      },
    });
    expect(projectRes.status()).toBe(201);
    const project = await json<{ id: string; code: string }>(projectRes);
    expect(project.id).toBeTruthy();

    // 2. Crear Hitos con Ponderación
    const m1Res = await request.post(`${apiUrl}/projects/${project.id}/milestones`, {
      headers: authHeaders,
      data: { name: 'Cimentación y Estructura', dueDate: new Date().toISOString() },
    });
    const m1 = await json<{ id: string }>(m1Res);

    const m2Res = await request.post(`${apiUrl}/projects/${project.id}/milestones`, {
      headers: authHeaders,
      data: { name: 'Acabados e Instalaciones', dueDate: new Date().toISOString() },
    });
    const m2 = await json<{ id: string }>(m2Res);

    // Actualizar pesos: Hito 1 (peso 40, avance 100%), Hito 2 (peso 60, avance 50%) -> Avance global = 70.00%
    await request.patch(`${apiUrl}/projects/${project.id}/milestones/${m1.id}/weight`, {
      headers: authHeaders,
      data: { weight: 40, progress: 100 },
    });

    await request.patch(`${apiUrl}/projects/${project.id}/milestones/${m2.id}/weight`, {
      headers: authHeaders,
      data: { weight: 60, progress: 50 },
    });

    // Validar en BD que el proyecto tenga el avance ponderado = 70
    const dbProject = await db.recordByScope('projects', project.id, 'clientTenantId', fullTenantSession.tenantId);
    expect(Number(dbProject?.progress)).toBeCloseTo(70, 1);

    // 3. Registrar Captura Fotográfica de Avance
    const captureRes = await request.post(`${apiUrl}/projects/${project.id}/captures`, {
      headers: authHeaders,
      data: {
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb186156f',
        caption: 'Avance de cimentación al 100%',
        milestoneId: m1.id,
        isPublic: true,
      },
    });
    expect(captureRes.status()).toBe(201);
    const capture = await json<{ id: string }>(captureRes);
    expect(capture.id).toBeTruthy();

    // 4. Generar Enlace Público para Cliente
    const linkRes = await request.post(`${apiUrl}/projects/${project.id}/public-links`, {
      headers: authHeaders,
      data: { revokeExisting: true },
    });
    expect(linkRes.status()).toBe(201);
    const linkData = await json<{ id: string; token: string; url: string }>(linkRes);
    expect(linkData.token).toBeTruthy();

    // 5. Consultar Vista Pública del Cliente (sin headers de auth)
    const publicClientRes = await request.get(`${apiUrl}/public-access/project-progress/${linkData.token}`);
    expect(publicClientRes.status()).toBe(200);
    const clientProgress = await json<any>(publicClientRes);
    expect(clientProgress.project.name).toBe(`Proyecto MGP ${suffix}`);
    expect(Number(clientProgress.project.progress)).toBeCloseTo(70, 1);
    expect(clientProgress.stages.length).toBe(2);
    expect(clientProgress.captures.length).toBe(1);

    // Seguridad estricta: la vista pública NUNCA debe incluir presupuestos ni cotizaciones
    expect(clientProgress.plannedBudget).toBeUndefined();
    expect(clientProgress.executedCost).toBeUndefined();
    expect(clientProgress.materialQuotations).toBeUndefined();

    // 6. Crear Cotización Compuesta de Materiales
    const quotRes = await request.post(`${apiUrl}/projects/${project.id}/material-quotations`, {
      headers: authHeaders,
      data: {
        name: 'Cotización Materiales Principales',
        currency: 'NIO',
        materials: [
          { description: 'Cemento Portland Tipo 1', quantity: 100, unit: 'BOLSA' },
          { description: 'Varilla de Acero 1/2 pulgada', quantity: 50, unit: 'VARILLA' },
        ],
      },
    });
    expect(quotRes.status()).toBe(201);
    const quotation = await json<{ id: string; code: string; materials: { id: string }[] }>(quotRes);
    expect(quotation.id).toBeTruthy();
    expect(quotation.materials.length).toBe(2);

    // 7. Crear Proveedor y Asignar Subcotización
    const supRes = await request.post(`${apiUrl}/purchases/suppliers`, {
      headers: authHeaders,
      data: {
        name: `Proveedor Aceros ${suffix}`,
        code: `SUP-${suffix.slice(0, 6)}`,
        email: `aceros_${suffix}@test.com`,
      },
    });
    const supplier = await json<{ id: string }>(supRes);

    const subRes = await request.post(`${apiUrl}/projects/${project.id}/material-quotations/${quotation.id}/subquotations`, {
      headers: authHeaders,
      data: {
        supplierId: supplier.id,
        editWindowHours: 24,
      },
    });
    expect(subRes.status()).toBe(201);
    const subData = await json<{ subQuotation: { id: string }; token: string; publicPath: string }>(subRes);
    expect(subData.token).toBeTruthy();

    // 8. Proveedor consulta su Vista Semiprivada (sin auth)
    const publicSubRes = await request.get(`${apiUrl}/public-access/subquotation/${subData.token}`);
    expect(publicSubRes.status()).toBe(200);
    const supplierView = await json<any>(publicSubRes);
    expect(supplierView.materials.length).toBe(2);
    expect(supplierView.termsAccepted).toBe(false);

    // 9. Proveedor Acepta Términos y Condiciones
    const termsRes = await request.post(`${apiUrl}/public-access/subquotation/${subData.token}/accept-terms`, {
      data: { termsVersion: 'v1.0' },
    });
    expect(termsRes.status()).toBe(201);

    // 10. Proveedor Envía su Oferta
    const mat1Id = quotation.materials[0].id;
    const mat2Id = quotation.materials[1].id;

    // Cemento: 100 bolsas @ C$ 350 = 35,000
    // Varilla: 50 varillas @ C$ 400 = 20,000
    // Subtotal = 55,000, IVA 15% = 8,250, Total = 63,250
    const offerRes = await request.post(`${apiUrl}/public-access/subquotation/${subData.token}/submit`, {
      data: {
        offers: [
          { materialId: mat1Id, unitPrice: 350, deliveryDays: 3 },
          { materialId: mat2Id, unitPrice: 400, deliveryDays: 5 },
        ],
        taxAmount: 8250,
        supplierNotes: 'Precios válidos por 15 días.',
      },
    });
    expect(offerRes.status()).toBe(201);
    const offerData = await json<any>(offerRes);
    expect(Number(offerData.subtotal)).toBeCloseTo(55000, 2);
    expect(Number(offerData.total)).toBeCloseTo(63250, 2);

    // 11. Comparativa y Selección de Ofertas
    const compRes = await request.get(`${apiUrl}/projects/${project.id}/material-quotations/${quotation.id}/comparison`, {
      headers: authHeaders,
    });
    expect(compRes.status()).toBe(200);

    // Auto-seleccionar mejores precios
    const selectRes = await request.patch(`${apiUrl}/projects/${project.id}/material-quotations/${quotation.id}/select-offers`, {
      headers: authHeaders,
      data: { autoSelectLowest: true },
    });
    expect(selectRes.status()).toBe(200);
    const finalQuotation = await json<any>(selectRes);
    expect(Number(finalQuotation.selectedSubtotalAmount)).toBeCloseTo(55000, 2);
    expect(Number(finalQuotation.selectedTotalAmount)).toBeCloseTo(63250, 2);
    // Dado que era el único proveedor asignado y ya respondió, la cotización debe pasar a COMPLETE
    expect(finalQuotation.status).toBe('COMPLETE');

    // 12. Validar Persistencia en BD
    await db.assertOwnedByScope('projectProgressCaptures', capture.id, 'clientTenantId', fullTenantSession.tenantId);
    await db.assertOwnedByScope('projectMaterialQuotations', quotation.id, 'clientTenantId', fullTenantSession.tenantId);
    await db.assertOwnedByScope('projectSubQuotations', subData.subQuotation.id, 'clientTenantId', fullTenantSession.tenantId);
  });
});
