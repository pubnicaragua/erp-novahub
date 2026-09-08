import { expect, type Page } from '@playwright/test';
import { InventoryPage } from './InventoryPage';

interface TransferResponse {
  id?: string;
  number?: string;
  status?: string;
  data?: { id?: string; number?: string; status?: string };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class TransfersPage extends InventoryPage {
  constructor(page: Page) {
    super(page);
  }

  private visibleTestId(testId: string) {
    return this.page.locator(`[data-testid="${testId}"]:visible`).first();
  }

  private async chooseWarehouse(testId: string, warehouseName: string): Promise<void> {
    const trigger = this.visibleTestId(testId);
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();
    await this.page.getByRole('option', { name: new RegExp(escapeRegExp(warehouseName), 'i') }).last().click();
  }

  async createPendingTransfer(input: {
    sourceWarehouseName: string;
    destinationWarehouseName: string;
    productCode: string;
    quantity: number;
    reference: string;
  }): Promise<{ id: string; number: string; status?: string }> {
    await this.openTransfers();
    await this.visibleTestId('inventory-transfer-new').click();
    await this.chooseWarehouse('inventory-transfer-source', input.sourceWarehouseName);
    await expect(this.visibleTestId('inventory-transfer-add-item')).toBeEnabled({ timeout: 20_000 });
    await this.chooseWarehouse('inventory-transfer-destination', input.destinationWarehouseName);

    await this.visibleTestId('inventory-transfer-add-item').click();
    const productControl = this.page.locator('[data-testid="inventory-transfer-product"]:visible').first();
    await expect(productControl).toBeVisible({ timeout: 15_000 });
    await productControl.getByRole('combobox').click();
    await this.page.getByRole('option', { name: new RegExp(escapeRegExp(input.productCode), 'i') }).last().click();
    await this.visibleTestId('inventory-transfer-quantity').fill(String(input.quantity));
    await this.page.locator('[data-testid="inventory-transfer-reference"]:visible').first().fill(input.reference);

    const responsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && /\/api\/inventory\/transfers\/?(?:\?|$)/.test(response.url())
    ));
    await this.visibleTestId('inventory-transfer-save').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as TransferResponse;
    const transfer = body.data || body;
    if (!transfer.id || !transfer.number) {
      throw new Error(`La transferencia no devolvió id/número: ${JSON.stringify(body)}`);
    }
    await this.assertToast(/transferencia creada/i);
    await expect(this.page.locator('[data-tour="transfer-table"]:visible').getByText(transfer.number, { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    return { id: transfer.id, number: transfer.number, status: transfer.status };
  }
}
