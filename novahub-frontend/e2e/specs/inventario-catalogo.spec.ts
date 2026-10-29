import { test, expect } from '../fixtures/seed-data.fixture';
import { createDbAssertions } from '../helpers/db-assertions';
import { InventoryPage } from '../page-objects/InventoryPage';

async function completeProductDraft(page: import('@playwright/test').Page, input: {
  code: string;
  name: string;
  categoryName: string;
  warehouseName: string;
}) {
  await page.getByTestId('inventory-product-code').fill(input.code);
  await page.getByTestId('inventory-product-name').fill(input.name);
  await page.getByTestId('inventory-product-category').getByRole('combobox').click();
  await page.getByRole('option', { name: input.categoryName }).click();
  await page.getByTestId('inventory-product-price-RETAIL').fill('150');
  await page.getByTestId('inventory-product-cost').fill('90');
  await page.getByTestId('inventory-product-warehouse').getByRole('combobox').click();
  await page.getByRole('option', { name: input.warehouseName }).click();
  await page.getByTestId('inventory-product-initial-stock').fill('0');
}

function possibleMatchFor(seedData: { product: { id: string; code?: string; name: string } }, inputKey: string) {
  return [{
    inputKey,
    matches: [{
      id: seedData.product.id,
      code: seedData.product.code,
      sku: seedData.product.code,
      name: seedData.product.name,
      reasons: ['Nombre'],
      variants: [],
    }],
  }];
}

test.describe('NovaHub ERP — catálogo de Inventario y stock inicial', () => {
  test.setTimeout(120_000);

  test('confirma un producto parecido con otro SKU y conserva el formulario si la API vuelve a advertir similitud', async ({
    page,
    tenantSession,
    seedData,
  }) => {
    const db = createDbAssertions();
    const inventoryPage = new InventoryPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const code = `SIM-E2E-${suffix}`;
    const name = seedData.product.name;
    const createBodies: Array<Record<string, unknown>> = [];
    let interceptedFirstCreate = false;

    await page.route(/\/api\/inventory\/products\/?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      createBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      if (interceptedFirstCreate) return route.continue();
      interceptedFirstCreate = true;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          statusCode: 409,
          message: {
            code: 'PRODUCT_SIMILAR_MATCH',
            message: 'Se encontró una posible coincidencia.',
            matches: possibleMatchFor(seedData, code),
          },
        }),
      });
    });

    try {
      await inventoryPage.openProducts();
      await inventoryPage.openCreateProduct();
      await completeProductDraft(page, {
        code,
        name,
        categoryName: seedData.category.name,
        warehouseName: seedData.warehouse.name,
      });

      await page.getByTestId('inventory-product-save').click();
      const decision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
      await expect(decision).toBeVisible();
      await expect(decision.getByRole('alert')).toBeVisible();
      await expect(decision.locator('[aria-label="Decisión sobre coincidencias de productos"]')).toBeFocused();
      await expect(decision.getByRole('button', { name: 'Editar producto existente' })).toBeVisible();
      await expect(decision.getByRole('button', { name: 'Crear producto nuevo' })).toBeVisible();

      for (const viewport of [
        { width: 375, height: 844 },
        { width: 768, height: 1024 },
        { width: 1024, height: 800 },
        { width: 1440, height: 900 },
      ]) {
        await page.setViewportSize(viewport);
        await expect(decision.getByRole('alert')).toBeInViewport();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      await decision.getByRole('button', { name: 'Crear producto nuevo' }).click();

      await expect(decision).toBeVisible();
      await expect(decision.locator('[aria-label="Decisión sobre coincidencias de productos"]')).toBeFocused();
      await expect(page.getByTestId('inventory-product-code')).toHaveValue(code);
      await expect(page.getByTestId('inventory-product-name')).toHaveValue(name);
      const createdResponsePromise = page.waitForResponse((response) => (
        response.request().method() === 'POST'
        && /\/api\/inventory\/products\/?$/.test(new URL(response.url()).pathname)
        && response.ok()
      ));
      await decision.getByRole('button', { name: 'Crear producto nuevo' }).click();

      await expect.poll(() => createBodies.length).toBe(2);
      expect(createBodies[0].allowSimilarProductCreate).toBe(true);
      expect(createBodies[1].allowSimilarProductCreate).toBe(true);
      await expect(page.getByText(/guardado\(s\) correctamente/i).first()).toBeVisible({ timeout: 20_000 });

      const createdResponse = await createdResponsePromise;
      const createdBody = await createdResponse.json() as { id?: string; data?: { id?: string } };
      const createdId = createdBody.data?.id || createdBody.id;
      expect(createdId).toBeTruthy();
      const persisted = await db.recordById('products', String(createdId), tenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.name)).toBe(name);
    } finally {
      await db.close();
    }
  });

  test('un SKU exacto bloquea la creación, conserva el formulario y enfoca el campo para corregirlo', async ({
    page,
    seedData,
  }) => {
    const inventoryPage = new InventoryPage(page);
    const exactCode = String(seedData.product.code);

    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: exactCode,
      name: `Registro distinto con SKU existente ${exactCode}`,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });

    const codeInput = page.getByTestId('inventory-product-code');
    await expect(page.getByText(/ya existe.*ingresa otro SKU/i)).toBeVisible();
    await expect(page.getByTestId('inventory-product-save')).toBeEnabled();
    await page.getByTestId('inventory-product-save').click();
    await expect(codeInput).toBeFocused();
    await expect(codeInput).toHaveValue(exactCode);
    await expect(page.getByTestId('inventory-product-name')).toHaveValue(`Registro distinto con SKU existente ${exactCode}`);
    await expect(page.getByTestId('inventory-product-price-RETAIL')).toHaveValue('150');
    await expect(page.getByTestId('inventory-product-cost')).toHaveValue('90');
    await expect(page.getByTestId('inventory-product-similarity-decision')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Crear producto nuevo' })).toHaveCount(0);
  });

  test('un SKU repetido en un lote vuelve al formulario sin perder sus datos', async ({ page, seedData }) => {
    const inventoryPage = new InventoryPage(page);
    const exactCode = String(seedData.product.code);
    const enteredName = `Fila con SKU existente ${exactCode}`;

    await page.route('**/api/inventory/products/check-code**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false }),
      });
    });

    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: exactCode,
      name: enteredName,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });
    await page.getByTestId('inventory-product-add-to-list').click();
    await expect(page.getByText(enteredName)).toBeVisible();
    await page.getByTestId('inventory-product-save').click();

    const codeInput = page.getByTestId('inventory-product-code');
    await expect(codeInput).toBeFocused();
    await expect(codeInput).toHaveValue(exactCode);
    await expect(page.getByTestId('inventory-product-name')).toHaveValue(enteredName);
    await expect(page.getByTestId('inventory-product-price-RETAIL')).toHaveValue('150');
    await expect(page.getByTestId('inventory-product-cost')).toHaveValue('90');
    await expect(page.getByText(/ya existe.*ingresa otro SKU/i)).toBeVisible();
    await expect(page.getByText(enteredName)).toHaveCount(0);
    await expect(page.getByTestId('inventory-product-similarity-decision')).toHaveCount(0);
  });

  test('si el servidor rechaza el SKU repetido al guardar, conserva los datos y enfoca el SKU', async ({
    page,
    tenantSession,
    seedData,
  }) => {
    const inventoryPage = new InventoryPage(page);
    const exactCode = String(seedData.product.code);
    const uniqueName = `Prueba SKU duplicado ${tenantSession.runId}`;
    let createAttempts = 0;

    await page.route('**/api/inventory/products/check-similar', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ matches: [] }),
      });
    });
    await page.route('**/api/inventory/products/check-code**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exists: false }),
      });
    });
    await page.route(/\/api\/inventory\/products\/?$/, async (route) => {
      if (route.request().method() === 'POST') createAttempts += 1;
      await route.continue();
    });

    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: exactCode,
      name: uniqueName,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });

    const conflictResponse = page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && /\/api\/inventory\/products\/?$/.test(new URL(response.url()).pathname)
      && response.status() === 409
    ));
    await page.getByTestId('inventory-product-save').click();
    await conflictResponse;

    const codeInput = page.getByTestId('inventory-product-code');
    await expect(codeInput).toBeFocused();
    await expect(codeInput).toHaveValue(exactCode);
    await expect(page.getByTestId('inventory-product-name')).toHaveValue(uniqueName);
    await expect(page.getByTestId('inventory-product-price-RETAIL')).toHaveValue('150');
    await expect(page.getByTestId('inventory-product-cost')).toHaveValue('90');
    await expect(page.getByText(/ya existe.*ingresa otro SKU/i)).toBeVisible();
    await expect(page.getByTestId('inventory-product-similarity-decision')).toHaveCount(0);
    expect(createAttempts).toBe(1);
  });

  test('si falla la consulta del producto parecido, conserva el formulario y permite reintentar', async ({
    page,
    tenantSession,
    seedData,
  }) => {
    const inventoryPage = new InventoryPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const code = `LOOKUP-E2E-${suffix}`;
    let failFirstLookup = true;

    await page.route(`**/api/inventory/products/${seedData.product.id}`, async (route) => {
      if (failFirstLookup) {
        failFirstLookup = false;
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 404, message: 'Producto no disponible para la prueba.' }),
        });
        return;
      }
      await route.continue();
    });

    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code,
      name: seedData.product.name,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });

    await page.getByTestId('inventory-product-save').click();
    const decision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
    await expect(decision).toBeVisible();
    await decision.getByRole('button', { name: 'Editar producto existente' }).click();

    await expect(page.getByText(/no pudimos abrir el producto/i)).toBeVisible();
    await expect(page.getByTestId('inventory-product-code')).toHaveValue(code);
    await expect(page.getByTestId('inventory-product-name')).toHaveValue(seedData.product.name);

    await page.getByTestId('inventory-product-save').click();
    const retryDecision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
    await expect(retryDecision).toBeVisible();
    await retryDecision.getByRole('button', { name: 'Editar producto existente' }).click();
    await expect(page.getByRole('dialog').filter({ hasText: 'Editar Producto' }).last()).toBeVisible();
  });

  test('al reintentar un lote no vuelve a enviar las filas guardadas antes de la coincidencia', async ({
    page,
    tenantSession,
    seedData,
  }) => {
    const inventoryPage = new InventoryPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const firstCode = `BATCH-A-${suffix}`;
    const secondCode = `BATCH-B-${suffix}`;
    const createBodies: Array<Record<string, unknown>> = [];
    let rejectedSecondProduct = false;

    await page.route(/\/api\/inventory\/products\/?$/, async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      if (body.code === secondCode && !rejectedSecondProduct) {
        rejectedSecondProduct = true;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 409,
            message: {
              code: 'PRODUCT_SIMILAR_MATCH',
              message: 'Se encontró una posible coincidencia.',
              matches: possibleMatchFor(seedData, secondCode),
            },
          }),
        });
        return;
      }
      await route.continue();
    });

    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: firstCode,
      name: `Producto lote A ${suffix}`,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });
    await page.getByTestId('inventory-product-add-to-list').click();
    await completeProductDraft(page, {
      code: secondCode,
      name: seedData.product.name,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });
    await page.getByTestId('inventory-product-add-to-list').click();
    await page.getByTestId('inventory-product-save').click();

    const firstDecision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
    await expect(firstDecision).toBeVisible();
    await firstDecision.getByRole('button', { name: 'Crear producto nuevo' }).click();
    const repeatedDecision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
    await expect(repeatedDecision).toBeVisible();
    await expect.poll(() => createBodies.length).toBe(2);
    await expect(page.getByText(firstCode)).toHaveCount(0);
    await repeatedDecision.getByRole('button', { name: 'Crear producto nuevo' }).click();

    await expect.poll(() => createBodies.length).toBe(3);
    expect(createBodies.filter((body) => body.code === firstCode)).toHaveLength(1);
    expect(createBodies.filter((body) => body.code === secondCode)).toHaveLength(2);
    await expect(page.getByText(/guardado\(s\) correctamente/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('productos variables permiten editar el producto padre con coincidencia por nombre y SKU exacto', async ({
    page,
    seedData,
  }) => {
    await page.route('**/api/inventory/products/check-similar', async (route) => {
      const requestBody = route.request().postDataJSON() as { items?: Array<{ code?: string; name?: string }> };
      const input = requestBody.items?.[0] || {};
      const inputKey = input.code || input.name || '';
      const isExactSku = inputKey === seedData.product.code;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          matches: [{
            inputKey,
            matches: [{
              id: seedData.product.id,
              code: seedData.product.code,
              sku: seedData.product.code,
              name: seedData.product.name,
              reasons: [isExactSku ? 'SKU' : 'Nombre'],
              variants: [
                { id: 'e2e-variant-a', sku: 'PADRE-A' },
                { id: 'e2e-variant-b', sku: 'PADRE-B' },
              ],
            }],
          }],
        }),
      });
    });

    const inventoryPage = new InventoryPage(page);
    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: `VAR-SIM-${seedData.product.code}`,
      name: seedData.product.name,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });
    await page.getByTestId('inventory-product-save').click();
    let decision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
    await expect(decision.getByRole('button', { name: 'Editar producto existente' })).toBeVisible();
    await decision.getByRole('button', { name: 'Editar producto existente' }).click();
    await expect(page.getByRole('dialog').filter({ hasText: 'Editar Producto' }).last()).toBeVisible();
    await page.getByRole('dialog').filter({ hasText: 'Editar Producto' }).last().getByRole('button', { name: 'Cancelar' }).click();

    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: String(seedData.product.code),
      name: seedData.product.name,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });
    await page.getByTestId('inventory-product-save').click();
    const codeInput = page.getByTestId('inventory-product-code');
    await expect(codeInput).toBeFocused();
    await expect(codeInput).toHaveValue(String(seedData.product.code));
    await expect(page.getByText(/ya existe.*ingresa otro SKU/i)).toBeVisible();
    await expect(page.getByTestId('inventory-product-similarity-decision')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Crear producto nuevo' })).toHaveCount(0);
  });

  test('un usuario con permiso de crear pero sin permiso de editar no puede abrir el producto existente', async ({
    page,
    seedData,
  }) => {
    await page.route('**/api/auth/profile', async (route) => {
      const response = await route.fetch();
      const profile = await response.json() as Record<string, any>;
      const permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
      profile.userType = 'EMPLOYEE';
      profile.role = 'EMPLOYEE';
      profile.permissions = [
        ...permissions.filter((permission: any) => permission.module !== 'INVENTORY_PRODUCTS'),
        { module: 'INVENTORY_PRODUCTS', read: true, create: true, edit: false },
      ];
      await route.fulfill({ response, body: JSON.stringify(profile) });
    });
    await page.route('**/api/inventory/products/check-similar', async (route) => {
      const requestBody = route.request().postDataJSON() as { items?: Array<{ code?: string }> };
      const inputKey = requestBody.items?.[0]?.code || '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ matches: possibleMatchFor(seedData, inputKey) }),
      });
    });

    await page.goto('/');
    const inventoryPage = new InventoryPage(page);
    await inventoryPage.openProducts();
    await inventoryPage.openCreateProduct();
    await completeProductDraft(page, {
      code: `NO-EDIT-${seedData.product.code}`,
      name: seedData.product.name,
      categoryName: seedData.category.name,
      warehouseName: seedData.warehouse.name,
    });
    await page.getByTestId('inventory-product-save').click();

    const decision = page.getByRole('dialog').filter({ hasText: /posible coincidencia/i }).last();
    const editAction = decision.getByRole('button', { name: 'Editar producto existente' });
    await expect(editAction).toBeDisabled();
    await expect(decision.getByText(/no tienes permiso para editar productos/i)).toBeVisible();
    await expect(decision.getByRole('button', { name: 'Crear producto nuevo' })).toBeEnabled();
  });

  test('crea un producto desde la UI y persiste stock, Kardex y tenant correctos', async ({
    page,
    tenantSession,
    seedData,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const inventoryPage = new InventoryPage(page);
    const suffix = tenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const code = `UI-E2E-${suffix}`;
    const quantity = 4;
    const mark = apiInterceptor.mark();

    try {
      const created = await inventoryPage.createProductFromSeed({
        code,
        name: `Producto UI E2E ${suffix}`,
        categoryName: seedData.category.name,
        warehouseName: seedData.warehouse.name,
        initialStock: quantity,
        retailPrice: 150,
      });

      const persisted = await db.recordById('products', created.id, tenantSession.tenantId);
      expect(persisted).not.toBeNull();
      expect(String(persisted?.code)).toBe(code);
      expect(String(persisted?.clientTenantId)).toBe(tenantSession.tenantId);
      await db.assertOwned('products', created.id, tenantSession.tenantId);

      const inventory = await db.inventorySnapshot(tenantSession.tenantId, created.id, seedData.warehouse.id);
      expect(inventory.reduce((sum, level) => sum + level.quantity, 0)).toBeCloseTo(quantity, 6);
      expect(inventory.every((level) => level.quantity >= 0)).toBeTruthy();

      const movements = await db.inventoryMovements(tenantSession.tenantId, created.id, seedData.warehouse.id);
      expect(movements.some((movement) => (
        movement.type === 'IN'
        && movement.quantity === quantity
        && String(movement.reference || '').toLowerCase().includes('stock inicial')
      ))).toBeTruthy();

      await inventoryPage.assertResponsiveLayout();
      apiInterceptor.assertSuccessful({
        since: mark,
        requireJsonContentType: true,
        validateRequestPayload: true,
        maxLatencyMs: 10_000,
      });
      apiInterceptor.assertNoServerErrors();
    } finally {
      await db.close();
    }
  });
});
