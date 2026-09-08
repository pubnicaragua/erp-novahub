import { test, expect } from '../fixtures/auth.fixture';

const apiUrl = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

test.describe('NovaHub ERP — límites de autorización y validación', () => {
  test('rechaza un perfil sin JWT', async ({ request }) => {
    const response = await request.get(`${apiUrl}/auth/profile`);
    expect(response.status()).toBe(401);
  });

  test('un usuario de tenant no puede leer la superficie de plataforma', async ({ request, tenantSession }) => {
    const response = await request.get(`${apiUrl}/enterprise-groups/platform`, {
      headers: { Authorization: `Bearer ${tenantSession.token}` },
    });
    expect(response.status()).toBe(403);
  });

  test('un usuario de tenant no puede consultar el panel QA de plataforma', async ({ request, tenantSession }) => {
    const response = await request.get(`${apiUrl}/qa/checks`, {
      headers: { Authorization: `Bearer ${tenantSession.token}` },
    });
    expect(response.status()).toBe(403);
  });

  test('rechaza una orden de venta sin los campos requeridos', async ({ request, tenantSession }) => {
    const response = await request.post(`${apiUrl}/sales/orders`, {
      headers: {
        Authorization: `Bearer ${tenantSession.token}`,
        'Idempotency-Key': `${tenantSession.runId}:invalid-sales-order`,
      },
      data: {},
    });
    expect(response.status()).toBe(400);
  });
});
