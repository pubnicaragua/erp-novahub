import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ConfigurationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openBranding(): Promise<void> {
    await this.gotoModule('configuracion', 'branding');
    await this.waitForAppShell();
    await expect(this.page.getByText('Colores Personalizados', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  }

  async saveTheme(primaryColor: string): Promise<void> {
    const color = this.page.getByLabel('Código hexadecimal de color primario');
    await expect(color).toBeVisible({ timeout: 15_000 });
    await color.fill(primaryColor);
    await color.blur();

    const responsePromise = this.page.waitForResponse((response) =>
      response.url().includes('/api/branding/update')
      && response.request().method() === 'POST',
    );
    await this.page.getByTestId('configuration-theme-save').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    await this.assertToast(/tema actualizado correctamente/i);
  }
}
