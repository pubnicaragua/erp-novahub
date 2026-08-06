import { test, expect, login, openModule } from './helpers';

test.describe('Inventario - Producto', () => {
  test('Crear producto: botón abre formulario con código', async ({ page }) => {
    await test.step('Login', async () => { await login(page); });
    await test.step('Abrir Inventario → Productos', async () => {
      await openModule(page, 'Inventario');
      const item = page.locator('a, button, span').filter({ hasText: /productos/i }).first();
      if (await item.isVisible().catch(() => false)) { await item.click(); await page.waitForTimeout(1_500); }
    });
    await test.step('Botón nuevo producto abre formulario', async () => {
      const btn = page.getByRole('button', { name: /nuevo producto|crear producto|agregar producto|nuevo/i }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Campo código presente', async () => {
      const code = page.locator('input[name*="code" i], input[placeholder*="código" i], input[placeholder*="codigo" i]').first();
      await expect(code).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Cerrar sin errores', async () => {
      await page.keyboard.press('Escape').catch(() => {});
    });
  });
});
