import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class SupportTechPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open(): Promise<void> {
    await this.gotoModule('soporte-tecnico');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('support-tech-new-ticket')).toBeVisible({ timeout: 20_000 });
  }

  async createTicket(subject: string, description: string): Promise<void> {
    await this.page.getByTestId('support-tech-new-ticket').click();
    await this.page.getByTestId('support-tech-subject').fill(subject);
    await this.page.getByTestId('support-tech-description').fill(description);
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/support-tickets') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('support-tech-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/ticket .*enviado correctamente|ticket enviado correctamente/i);
    await expect(this.page.getByText(subject, { exact: true })).toBeVisible({ timeout: 20_000 });
  }
}
