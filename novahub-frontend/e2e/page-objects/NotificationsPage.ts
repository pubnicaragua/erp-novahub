import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class NotificationsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openAlerts(): Promise<void> {
    await this.gotoModule('notificaciones', 'alertas');
    await this.waitForAppShell();
    await expect(this.page.getByText('Alertas del Sistema', { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  async createAlert(): Promise<void> {
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/notifications/alerts') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('notifications-create-alert').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/alerta creada/i);
    // The mutation callback invalidates/refetches the alerts query. Reloading
    // here gives the UI assertion a deterministic GET boundary even when the
    // initial query was still in flight while the alert was created.
    const refreshPromise = this.page.waitForResponse((next) => (
      next.url().endsWith('/api/notifications/alerts') && next.request().method() === 'GET'
    ));
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    const refresh = await refreshPromise;
    expect(refresh.status()).toBeGreaterThanOrEqual(200);
    expect(refresh.status()).toBeLessThan(300);
    await expect(this.page.getByText('Nueva Alerta', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  }
}
