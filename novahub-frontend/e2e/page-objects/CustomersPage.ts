import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class CustomersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openDirectory(): Promise<void> {
    await this.gotoModule('clientes');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('customers-new')).toBeVisible({ timeout: 20_000 });
  }

  async createCustomer(input: { name: string; ruc: string; email: string }): Promise<{ id: string; code?: string }> {
    await this.openDirectory();
    await this.page.getByTestId('customers-new').click();
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await this.page.getByTestId('customer-name').fill(input.name);
    await this.page.getByTestId('customer-ruc').fill(input.ruc);
    await this.page.getByTestId('customer-email').fill(input.email);
    const responsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST' && /\/api\/sales\/customers\/?(?:\?|$)/.test(response.url())
    ));
    const refreshPromise = this.page.waitForResponse((response) => (
      response.request().method() === 'GET' && /\/api\/sales\/customers(?:\?|$)/.test(response.url())
    ));
    await this.page.getByTestId('customer-save').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; code?: string; data?: { id?: string; code?: string } };
    const customer = body.data || body;
    if (!customer.id) throw new Error(`El cliente no devolvió id: ${JSON.stringify(body)}`);
    await refreshPromise;
    await this.assertToast(/cliente creado/i);
    await expect(this.page.getByText(input.name, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    return { id: customer.id, code: customer.code };
  }
}
