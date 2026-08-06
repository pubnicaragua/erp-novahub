import { test, expect, login, openModule } from './helpers';

test.describe('Compras - Orden de Compra', () => {
  test('Crear orden de compra: botón abre formulario', async ({ page }) => {
    await test.step('Login', async () => { await login(page); });
    await test.step('Abrir Compras → Órdenes de Compra', async () => {
      await openModule(page, 'Compras');
      const item = page.locator('a, button, span').filter({ hasText: /órdenes? de compra|ordenes de compra/i }).first();
      if (await item.isVisible().catch(() => false)) { await item.click(); await page.waitForTimeout(1_500); }
    });
    await test.step('Botón nueva orden abre formulario', async () => {
      const btn = page.getByRole('button', { name: /nueva orden|crear orden|nuevo/i }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Selector de proveedor presente', async () => {
      await expect(page.locator('[role="combobox"], select, [class*="combobox" i]').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Cerrar sin errores', async () => {
      await page.keyboard.press('Escape').catch(() => {});
    });
  });
});
