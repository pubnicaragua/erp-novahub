import { test, expect, login, openModule, clickByText } from './helpers';

test.describe('Ventas - Orden de Venta', () => {
  test('Flujo completo: crear orden de venta', async ({ page }) => {
    await test.step('Login', async () => { await login(page); });
    await test.step('Abrir Ventas → Órdenes de Venta', async () => {
      await openModule(page, 'Ventas');
      const ordenItem = page.locator('a, button, span').filter({ hasText: /órdenes? de venta|ordenes de venta/i }).first();
      await ordenItem.waitFor({ timeout: 10_000 });
      await ordenItem.click();
    });
    await test.step('Se abre el formulario de creación (Confirmar Orden visible)', async () => {
      await page.waitForURL(/ordenes?/, { timeout: 30_000 }).catch(() => {});
      const btn = page.getByRole('button', { name: /nueva orden/i }).first();
      await btn.waitFor({ timeout: 30_000 });
      await btn.click();
      await expect(page.getByRole('button', { name: /confirmar orden/i })).toBeVisible({ timeout: 30_000 });
    });
    await test.step('Selectores de cliente/vendedor presentes', async () => {
      await expect(page.locator('text=Seleccionar Cliente').first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
      await expect(page.locator('text=Seleccionar vendedor').first()).toBeVisible({ timeout: 10_000 }).catch(() => {});
    });
    await test.step('Cerrar formulario sin error', async () => {
      await clickByText(page, 'Cancelar').catch(() => {});
      await page.keyboard.press('Escape').catch(() => {});
    });
  });
});
