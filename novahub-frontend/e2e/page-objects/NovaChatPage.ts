import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class NovaChatPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openInbox(): Promise<void> {
    await this.gotoModule('novachat');
    await this.waitForAppShell();
    await expect(this.page.getByText('Todas las conversaciones', { exact: true })).toBeVisible({ timeout: 20_000 });
  }

  async openConversation(subjectOrId: string): Promise<void> {
    const exact = this.page.getByText(subjectOrId, { exact: true }).first();
    if (await exact.count()) {
      await exact.click();
    } else {
      const idPrefix = subjectOrId.length >= 8 ? subjectOrId.slice(0, 4) : subjectOrId;
      await this.page.locator('button').filter({ hasText: `#${idPrefix}` }).first().click();
    }
    await expect(this.page.getByTestId('novachat-message-input')).toBeVisible({ timeout: 20_000 });
  }

  async sendMessage(content: string): Promise<string> {
    await this.page.getByTestId('novachat-message-input').fill(content);
    const responsePromise = this.page.waitForResponse((response) => (
      response.url().endsWith('/api/novachat/messages') && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('novachat-send-message').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string };
    if (!body.id) throw new Error(`NovaChat no devolvió id de mensaje: ${JSON.stringify(body)}`);
    await expect(this.page.getByText(content, { exact: true }).last()).toBeVisible({ timeout: 20_000 });
    return body.id;
  }
}
