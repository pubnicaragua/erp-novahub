import { test, expect } from '../helpers';

test.describe('Ventas - prevalidación contable de facturas', () => {
  test('muestra la advertencia y bloquea emisión cuando falta la cuenta contable', async ({ page }) => {
    await page.goto('/?m=ventas&sm=facturas');

    const nuevaFactura = page.getByRole('button', { name: /nueva factura/i }).first();
    await nuevaFactura.waitFor({ timeout: 30_000 });
    await nuevaFactura.click();
    await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /agregar producto/i }).first().click();
    const producto = page.getByRole('combobox').filter({ hasText: /seleccionar producto/i }).first();
    await producto.click();
    await page.locator('[data-slot="command-item"]').first().click();

    await expect(page.getByRole('alert')).toContainText(/costo de ventas|cuenta de inventario|almac.n/i, { timeout: 20_000 });
    await expect(page.getByRole('button', { name: /guardar como pendiente/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /registrar pago/i })).toBeDisabled();
  });
});
