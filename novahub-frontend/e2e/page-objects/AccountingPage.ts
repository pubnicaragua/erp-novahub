import { expect, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AccountingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openChartOfAccounts(): Promise<void> {
    await this.gotoModule('contabilidad', 'plan-cuentas');
    await this.waitForAppShell();
    await expect(this.page.getByText('Plan de Cuentas', { exact: true }).first()).toBeVisible({ timeout: 30_000 });
  }

  async createAccount(input: { code: string; name: string }): Promise<string> {
    await this.page.getByTestId('accounting-new-account').click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await dialog.getByTestId('accounting-account-code').fill(input.code);
    await dialog.getByTestId('accounting-account-name').fill(input.name);

    const responsePromise = this.page.waitForResponse((response) =>
      response.url().includes('/api/accounting/accounts')
      && response.request().method() === 'POST',
    );
    await dialog.getByTestId('accounting-account-save').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; data?: { id?: string } };
    const id = body.id || body.data?.id;
    expect(id, 'Crear cuenta debe devolver el identificador persistido').toBeTruthy();
    await this.assertToast(/cuenta creada/i);
    const matchingNames = this.page.getByText(input.name, { exact: true });
    await expect.poll(async () => {
      const count = await matchingNames.count();
      for (let index = 0; index < count; index += 1) {
        if (await matchingNames.nth(index).isVisible()) return true;
      }
      return false;
    }, { timeout: 15_000, message: `La cuenta ${input.name} debe aparecer en una fila visible` }).toBe(true);
    return String(id);
  }
}
