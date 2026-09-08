import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class DocumentsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openFiles(): Promise<void> {
    await this.gotoModule('documentos', 'archivos');
    await this.waitForAppShell();
    await expect(this.page.getByText('Archivos', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  }

  async openContracts(): Promise<void> {
    await this.gotoModule('documentos', 'contratos');
    await this.waitForAppShell();
    await expect(this.page.getByText('Contratos', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  }

  async createContract(): Promise<void> {
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/documents/contracts') && response.request().method() === 'POST'
    ));
    await this.page.getByRole('button', { name: /nuevo contrato/i }).click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/contrato creado/i);
    await expect(this.page.getByText('Nuevo Contrato', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  }
}
