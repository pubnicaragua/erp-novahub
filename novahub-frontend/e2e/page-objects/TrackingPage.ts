import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface TrackingTicketInput {
  trackingCode: string;
  clientName: string;
  carrier: string;
  origin: string;
  destination: string;
  description: string;
}

export class TrackingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openTransit(): Promise<void> {
    await this.gotoModule('tracking', 'tracking');
    await this.waitForAppShell();
    await expect(this.page.getByTestId('tracking-new-ticket')).toBeVisible({ timeout: 20_000 });
  }

  async createTicket(input: TrackingTicketInput): Promise<{ id: string; ticketNumber: string; trackingCode: string }> {
    await this.page.getByTestId('tracking-new-ticket').click();
    await expect(this.page.getByTestId('tracking-create-submit')).toBeVisible();

    for (const [field, value] of Object.entries(input)) {
      await this.page.getByTestId(`tracking-create-${field}`).fill(value);
    }

    const responsePromise = this.page.waitForResponse((response) => (
      response.url().includes('/api/tracking/shipments')
      && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('tracking-create-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; ticketNumber?: string; trackingCode?: string };
    if (!body.id) throw new Error(`La creación de tracking no devolvió id: ${JSON.stringify(body)}`);
    await this.assertToast(/ticket .* creado/i);
    await expect(this.page.getByText(input.trackingCode, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    return { id: body.id, ticketNumber: String(body.ticketNumber || ''), trackingCode: String(body.trackingCode || input.trackingCode) };
  }

  async openTicket(trackingCode: string): Promise<void> {
    await this.page.getByText(trackingCode, { exact: true }).first().click();
    await expect(this.page.getByTestId('tracking-event-submit')).toBeVisible({ timeout: 20_000 });
  }

  async addEvent(status: string, location: string): Promise<void> {
    await this.page.getByTestId('tracking-event-status').selectOption(status);
    await this.page.getByTestId('tracking-event-location').fill(location);
    const responsePromise = this.page.waitForResponse((response) => (
      /\/api\/tracking\/shipments\/[^/]+\/events$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('tracking-event-submit').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/evento registrado/i);
    await expect(this.page.getByText(new RegExp(location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).first()).toBeVisible({ timeout: 20_000 });
  }
}
