import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CreatedPurchaseOrder {
  id: string;
  number?: string;
  status?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Interacciones estables del circuito Orden de compra -> Recepción. */
export class PurchasesPage extends BasePage {
  async openPurchaseOrders(): Promise<void> {
    await this.gotoModule('compras', 'ordenes-compra');
    await this.waitForAppShell();
    await expect(this.page.getByRole('heading', { name: 'Órdenes de Compra', exact: true })).toBeVisible({ timeout: 30_000 });
  }

  private async choose(testId: string, value: string): Promise<void> {
    const field = this.page.getByTestId(testId);
    await field.getByRole('combobox').click();
    await this.page.getByRole('option', { name: new RegExp(escapeRegExp(value), 'i') }).first().click();
  }

  async createOrderFromSeed(input: {
    supplierName: string;
    productCode: string;
    warehouseName: string;
    quantity: number;
    unitPrice: number;
  }): Promise<CreatedPurchaseOrder> {
    await this.openPurchaseOrders();
    await this.page.getByRole('button', { name: 'Nueva Orden', exact: true }).click();
    await expect(this.page.getByText('Nueva Orden de Compra', { exact: true })).toBeVisible();

    await this.choose('purchase-order-supplier', input.supplierName);
    await this.choose('purchase-order-warehouse', input.warehouseName);
    await this.page.getByTestId('purchase-order-add-item').click();
    await this.choose('purchase-order-product-0', input.productCode);

    const item = this.page.getByTestId('purchase-order-item-0');
    await item.getByTestId('purchase-order-item-quantity').fill(String(input.quantity));
    await item.getByTestId('purchase-order-item-price').fill(String(input.unitPrice));
    await this.page.getByPlaceholder('Dirección de entrega o facturación').fill('Dirección E2E de recepción');

    const responsePromise = this.page.waitForResponse((response) => (
      response.url().includes('/api/purchases/orders')
      && response.request().method() === 'POST'
    ));
    await this.page.getByTestId('purchase-order-save-in-process').click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { id?: string; number?: string; status?: string };
    if (!body.id) throw new Error(`La creación de orden no devolvió id: ${JSON.stringify(body)}`);
    await expect(this.page.getByText(/Orden guardada en proceso|Orden de compra registrada/i).first()).toBeVisible({ timeout: 15_000 });
    return { id: body.id, number: body.number, status: body.status };
  }

  async approveOrderFromList(): Promise<{ id: string; receiptId: string }> {
    await expect(this.page.getByRole('button', { name: 'Aprobar orden de compra' }).first()).toBeVisible({ timeout: 30_000 });
    await this.page.getByRole('button', { name: 'Aprobar orden de compra' }).first().click();
    await expect(this.page.getByRole('heading', { name: '¿Aprobar orden de compra?' })).toBeVisible();

    const responsePromise = this.page.waitForResponse((response) => (
      response.url().includes('/api/purchases/orders/')
      && response.url().endsWith('/approve')
      && response.request().method() === 'PATCH'
    ));
    await this.page.getByRole('button', { name: 'Sí, aprobar orden', exact: true }).click();
    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(300);
    const body = await response.json() as { order?: { id?: string }; receipt?: { id?: string } };
    if (!body.order?.id || !body.receipt?.id) {
      throw new Error(`La aprobación no devolvió orden y recepción: ${JSON.stringify(body)}`);
    }
    await expect(this.page.getByText(/Orden aprobada/i).first()).toBeVisible({ timeout: 15_000 });
    return { id: body.order.id, receiptId: body.receipt.id };
  }

  async openReceipts(): Promise<void> {
    await this.gotoModule('compras', 'recepciones');
    await this.waitForAppShell();
    await expect(this.page.getByRole('heading', { name: 'Recepciones', exact: true })).toBeVisible({ timeout: 30_000 });
  }
}
