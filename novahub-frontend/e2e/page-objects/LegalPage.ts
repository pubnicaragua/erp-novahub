import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LegalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openCases(): Promise<void> {
    await this.gotoModule('asesoria-legal', 'casos');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('legal-new-case')).toBeVisible({ timeout: 20_000 });
  }

  async createCase(description: string): Promise<{ id: string; number: string }> {
    await this.page.getByTestId('legal-new-case').click();
    await this.page.getByTestId('legal-case-description').fill(description);
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/legal/cases') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('legal-case-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; number?: string };
    if (!body.id) throw new Error(`El caso legal no devolvió id: ${JSON.stringify(body)}`);
    await this.assertToast(/caso creado/i);
    await expect(this.page.getByText(description, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    return { id: body.id, number: String(body.number || '') };
  }
}
