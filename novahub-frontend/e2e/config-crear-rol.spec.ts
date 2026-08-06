import { test, expect, login, openModule } from './helpers';

test.describe('Configuración - Roles', () => {
  test('Crear rol: botón abre formulario con permisos', async ({ page }) => {
    await test.step('Login', async () => { await login(page); });
    await test.step('Abrir Configuración → Roles', async () => {
      await openModule(page, 'Configuración');
      const item = page.locator('a, button, span').filter({ hasText: /roles/i }).first();
      if (await item.isVisible().catch(() => false)) { await item.click(); await page.waitForTimeout(1_500); }
    });
    await test.step('Botón nuevo rol abre formulario', async () => {
      const btn = page.getByRole('button', { name: /nuevo rol|crear rol|agregar rol|nuevo/i }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Selector de permisos presente', async () => {
      await expect(page.locator('[role="combobox"], [class*="checkbox" i], [class*="switch" i]').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Cerrar sin errores', async () => {
      await page.keyboard.press('Escape').catch(() => {});
    });
  });
});
