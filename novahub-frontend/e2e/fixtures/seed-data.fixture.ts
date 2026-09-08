import type { APIRequestContext } from '@playwright/test';
import { test as authTest, expect, type TenantSession } from './auth.fixture';

export interface SeededRecord {
  id: string;
  name: string;
  code?: string;
}

export interface SeedData {
  runId: string;
  customer: SeededRecord;
  supplier: SeededRecord;
  product: SeededRecord;
  warehouse: SeededRecord;
  category: SeededRecord;
}

interface ApiRecord {
  id?: string;
  name?: string;
  code?: string;
  data?: { id?: string; name?: string; code?: string };
}

const API_URL = String(
  process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
).replace(/\/+$/, '');

async function createRecord<T extends ApiRecord>(
  request: APIRequestContext,
  session: TenantSession,
  path: string,
  data: Record<string, unknown>,
): Promise<SeededRecord> {
  const response = await request.post(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    data,
  });
  if (!response.ok()) throw new Error(`Seed ${path} falló (${response.status()}): ${await response.text()}`);
  const body = await response.json() as T;
  const record = body.data || body;
  if (!record.id) throw new Error(`Seed ${path} no devolvió id: ${JSON.stringify(body)}`);
  return { id: record.id, name: record.name || String(data.name || ''), code: record.code || String(data.code || '') };
}

async function postSeedAction(
  request: APIRequestContext,
  session: TenantSession,
  path: string,
  data?: Record<string, unknown>,
): Promise<unknown> {
  const response = await request.post(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    ...(data ? { data } : {}),
  });
  if (!response.ok()) throw new Error(`Seed ${path} falló (${response.status()}): ${await response.text()}`);
  return response.json();
}

interface AccountNode {
  id?: string;
  code?: string;
  children?: AccountNode[];
}

function flattenAccounts(value: unknown): AccountNode[] {
  const roots = Array.isArray(value)
    ? value as AccountNode[]
    : ((value as { accounts?: AccountNode[]; data?: AccountNode[] })?.accounts
      || (value as { data?: AccountNode[] })?.data
      || []);
  return roots.flatMap((account) => [account, ...flattenAccounts(account.children || [])]);
}

export const test = authTest.extend<{ seedData: SeedData }>({
  seedData: async ({ request, tenantSession }, use) => {
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    await postSeedAction(request, tenantSession, '/accounting/import-defaults/OTHER');
    await postSeedAction(request, tenantSession, '/accounting/config/seed');
    const accountsResponse = await request.get(`${API_URL}/accounting/accounts`, {
      headers: { Authorization: `Bearer ${tenantSession.token}` },
    });
    if (!accountsResponse.ok()) throw new Error(`Seed /accounting/accounts falló (${accountsResponse.status()}): ${await accountsResponse.text()}`);
    const accounts = flattenAccounts(await accountsResponse.json());
    const inventoryAccount = accounts.find((account) => account.code === '1200');
    if (!inventoryAccount?.id) throw new Error('El seed contable no encontró la cuenta de inventario 1200.');

    const category = await createRecord(request, tenantSession, '/inventory/categories', {
      name: `Categoría E2E ${suffix}`,
      type: 'PRODUCT',
    });
    const warehouse = await createRecord(request, tenantSession, '/inventory/warehouses', {
      name: `Bodega E2E ${suffix}`,
      type: 'MAIN',
      inventoryAccountId: inventoryAccount.id,
    });
    const customer = await createRecord(request, tenantSession, '/sales/customers', {
      name: `Cliente E2E ${suffix}`,
      type: 'INDIVIDUAL',
      email: `cliente-${suffix}@novahub.test`,
    });
    const supplier = await createRecord(request, tenantSession, '/purchases/suppliers', {
      type: 'COMPANY',
      code: `SUP-${suffix}`,
      name: `Proveedor E2E ${suffix}`,
      ruc: `J03${suffix.slice(0, 10)}`,
      email: `proveedor-${suffix}@novahub.test`,
    });
    const product = await createRecord(request, tenantSession, '/inventory/products', {
      name: `Producto E2E ${suffix}`,
      code: `E2E-${suffix}`,
      type: 'PRODUCT',
      salePrice: 100,
      costPrice: 40,
      taxRate: 0,
      trackInventory: true,
      initialStock: 10,
      warehouseId: warehouse.id,
    });
    await use({ runId: tenantSession.runId, customer, supplier, product, warehouse, category });
  },
});

export { expect };
