import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class InventoryPage extends BasePage {
  async openProducts(): Promise<void> {
    await this.gotoModule('inventario', 'productos');
    await expect(this.page.locator('body')).toContainText(/producto|inventario/i, { timeout: 30_000 });
  }

  async openTransfers(): Promise<void> {
    await this.gotoModule('inventario', 'transferencias');
    await expect(this.page.locator('body')).toContainText(/transferencias|nueva transferencia/i, { timeout: 30_000 });
  }

  async openCreateProduct(): Promise<void> {
    const action = this.page.getByRole('button', { name: /^(nuevo|nuevo producto|crear producto|agregar producto)$/i }).first();
    await expect(action).toBeVisible({ timeout: 20_000 });
    await action.click();
    await expect(this.page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 });
  }

  private async choose(testId: string, visibleText: string): Promise<void> {
    const field = this.page.getByTestId(testId);
    await field.getByRole('combobox').click();
    await this.page.getByRole('option', {
      name: new RegExp(visibleText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    }).first().click();
  }

  async createProductFromSeed(input: {
    code: string;
    name: string;
    categoryName: string;
    warehouseName: string;
    initialStock: number;
    retailPrice: number;
  }): Promise<{ id: string; code?: string; name?: string }> {
    await this.openProducts();
    await this.openCreateProduct();
    await this.page.getByTestId('inventory-product-code').fill(input.code);
    await this.page.getByTestId('inventory-product-name').fill(input.name);
    await this.choose('inventory-product-category', input.categoryName);
    await this.page.getByTestId('inventory-product-price-RETAIL').fill(String(input.retailPrice));
    await this.page.getByTestId('inventory-product-cost').fill('90');
    await this.choose('inventory-product-warehouse', input.warehouseName);
    await this.page.getByTestId('inventory-product-initial-stock').fill(String(input.initialStock));

    const responsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && /\/api\/inventory\/products\/?(?:\?|$)/.test(response.url())
    ));
    await this.page.getByTestId('inventory-product-save').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; code?: string; name?: string; data?: { id?: string; code?: string; name?: string } };
    const product = body.data || body;
    if (!product.id) throw new Error(`La creación de producto no devolvió id: ${JSON.stringify(body)}`);
    await expect(this.page.getByText(/producto\(s\) guardado\(s\) correctamente/i).first()).toBeVisible({ timeout: 20_000 });
    return product as { id: string; code?: string; name?: string };
  }
}
