import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class TicketsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openTickets(): Promise<void> {
    await this.gotoModule('tickets', 'tickets');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('tickets-new-ticket')).toBeVisible({ timeout: 20_000 });
  }

  async createTicket(input: { subject: string; description: string }): Promise<{ id: string; number: string }> {
    await this.page.getByTestId('tickets-new-ticket').click();
    await this.page.getByTestId('tickets-form-subject').fill(input.subject);
    await this.page.getByTestId('tickets-form-description').fill(input.description);
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/tools/tickets') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('tickets-form-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; number?: string };
    if (!body.id) throw new Error(`El ticket no devolvió id: ${JSON.stringify(body)}`);
    await this.assertToast(/ticket creado/i);
    await expect(this.page.locator('p:visible').filter({ hasText: input.subject }).first()).toBeVisible({ timeout: 20_000 });
    return { id: body.id, number: String(body.number || '') };
  }
}
