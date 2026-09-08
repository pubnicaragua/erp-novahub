import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class SuppliersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openDirectory(): Promise<void> {
    await this.gotoModule('proveedores');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('suppliers-new')).toBeVisible({ timeout: 20_000 });
  }

  async createSupplier(input: { name: string; ruc: string; email: string }): Promise<{ id: string; code?: string }> {
    await this.openDirectory();
    await this.page.getByTestId('suppliers-new').click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await this.page.getByTestId('supplier-name').fill(input.name);
    await this.page.getByTestId('supplier-ruc').fill(input.ruc);
    await this.page.getByTestId('supplier-email').fill(input.email);
    const responsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST' && /\/api\/purchases\/suppliers\/?(?:\?|$)/.test(response.url())
    ));
    const refreshPromise = this.page.waitForResponse((response) => (
      response.request().method() === 'GET' && /\/api\/purchases\/suppliers(?:\?|$)/.test(response.url())
    ));
    await this.page.getByTestId('supplier-save').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; code?: string; data?: { id?: string; code?: string } };
    const supplier = body.data || body;
    if (!supplier.id) throw new Error(`El proveedor no devolvió id: ${JSON.stringify(body)}`);
    await refreshPromise;
    await this.assertToast(/proveedor creado/i);
    await expect(this.page.getByText(input.name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    return { id: supplier.id, code: supplier.code };
  }
}
