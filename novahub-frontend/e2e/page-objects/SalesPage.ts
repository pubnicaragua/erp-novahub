import { expect } from '@playwright/test';
import { BasePage } from './BasePage';

export interface CreatedSalesOrder {
  id: string;
  number?: string;
  status?: string;
}

export interface CreatedInvoice {
  id: string;
  number?: string;
  status?: string;
  total?: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class SalesPage extends BasePage {
  async openSalesOrders(): Promise<void> {
    await this.gotoModule('ventas', 'ordenes-venta');
    await this.waitForAppShell();
    await expect(this.page.locator('body')).toContainText(/orden|venta/i, { timeout: 30_000 });
  }

  async openCreateSalesOrder(): Promise<void> {
    const action = this.page.getByRole('button', { name: 'Nueva Orden', exact: true });
    await expect(action).toBeVisible({ timeout: 20_000 });
    await this.dismissGuidedTour();
    await action.click();
    await expect(this.page.getByTestId('sales-order-customer')).toBeVisible({ timeout: 20_000 });
  }

  private async selectOption(fieldTestId: string, visibleText: string): Promise<void> {
    const field = this.page.getByTestId(fieldTestId);
    await expect(field).toBeVisible({ timeout: 20_000 });
    await field.getByRole('combobox').click();
    const option = this.page.getByRole('option', {
      name: new RegExp(escapeRegExp(visibleText), 'i'),
    }).last();
    await expect(option).toBeVisible({ timeout: 20_000 });
    await option.click();
  }

  async createOrderFromSeed(input: {
    customerName: string;
    productCode: string;
    warehouseName: string;
    quantity: number;
  }): Promise<CreatedSalesOrder> {
    await this.openSalesOrders();
    await this.openCreateSalesOrder();
    await this.selectOption('sales-order-customer', input.customerName);
    await this.selectOption('sales-order-warehouse', input.warehouseName);

    await this.page.getByTestId('sales-order-add-product').click();
    await this.selectOption('sales-order-product-0', input.productCode);
    await this.page.getByTestId('sales-order-quantity-0').fill(String(input.quantity));

    const responsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && /\/api\/sales\/orders\/?(?:\?|$)/.test(response.url())
    ));
    await this.page.getByTestId('sales-order-save-in-process').click();
    const response = await responsePromise;
    expect(response.status(), `crear orden: ${response.url()}`).toBeGreaterThanOrEqual(200);
    expect(response.status(), `crear orden: ${response.url()}`).toBeLessThan(300);

    const body = await response.json() as CreatedSalesOrder & { data?: CreatedSalesOrder };
    const order = body.data || body;
    if (!order.id) throw new Error(`La API no devolvió id de orden: ${JSON.stringify(body)}`);
    await expect(this.page.locator('body')).toContainText(/orden marcada en proceso|órdenes de venta/i, { timeout: 20_000 });
    return order;
  }

  async convertFirstPendingOrderToInvoice(): Promise<CreatedInvoice> {
    const action = this.page.getByRole('button', { name: /aprobar y enviar a factura|enviar a factura/i }).first();
    await expect(action).toBeVisible({ timeout: 30_000 });
    const responsePromise = this.page.waitForResponse((response) => (
      response.request().method() === 'POST'
      && /\/api\/sales\/orders\/[^/]+\/convert-to-invoice\/?(?:\?|$)/.test(response.url())
    ));
    await action.click();
    const response = await responsePromise;
    expect(response.status(), `convertir orden: ${response.url()}`).toBeGreaterThanOrEqual(200);
    expect(response.status(), `convertir orden: ${response.url()}`).toBeLessThan(300);
    const body = await response.json() as CreatedInvoice & { data?: CreatedInvoice };
    const invoice = body.data || body;
    if (!invoice.id) throw new Error(`La API no devolvió id de factura: ${JSON.stringify(body)}`);
    await expect(this.page.locator('body')).toContainText(/factura generada|facturas/i, { timeout: 30_000 });
    return invoice;
  }
}
