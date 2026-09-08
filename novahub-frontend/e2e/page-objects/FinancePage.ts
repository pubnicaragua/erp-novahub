import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class FinancePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openOverview(): Promise<void> {
    await this.gotoModule('finanzas', 'resumen-financiero');
    await this.waitForAppShell();
    await expect(this.page.getByText('Finanzas', { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  }
}
