import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class RestaurantPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openSalon(): Promise<void> {
    await this.gotoModule('restaurante', 'salon');
    await this.waitForAppShell();
  }

  async createKitchenOrder(tableCode: string, itemName: string): Promise<{ orderId: string }> {
    await expect(this.page.getByText(tableCode, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await this.page.getByText(tableCode, { exact: true }).first().click();
    await expect(this.page.getByText(itemName, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await this.page.getByText(itemName, { exact: true }).first().click();

    const orderResponsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/restaurant/orders') && response.request().method() === 'POST'
    ));
    const kitchenResponsePromise = this.page.waitForResponse((response) => (
      /\/api\/restaurant\/orders\/[^/]+\/send-to-kitchen$/.test(new URL(response.url()).pathname)
      && response.request().method() === 'POST'
    ));
    await this.page.getByRole('button', { name: /enviar comanda a cocina/i }).click();
    const orderResponse = await orderResponsePromise;
    expect(orderResponse.status()).toBeGreaterThanOrEqual(200);
    expect(orderResponse.status()).toBeLessThan(300);
    const order = await orderResponse.json() as { id?: string };
    if (!order.id) throw new Error(`La comanda no devolvió id: ${JSON.stringify(order)}`);

    const kitchenResponse = await kitchenResponsePromise;
    expect(kitchenResponse.status()).toBeGreaterThanOrEqual(200);
    expect(kitchenResponse.status()).toBeLessThan(300);
    await this.assertToast(/comanda .* enviada a cocina/i);
    return { orderId: order.id };
  }
}
