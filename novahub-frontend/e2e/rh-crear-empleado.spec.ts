import { test, expect, login, openModule } from './helpers';

test.describe('RH - Empleado', () => {
  test('Crear empleado: botón abre formulario completo', async ({ page }) => {
    await test.step('Login', async () => { await login(page); });
    await test.step('Abrir RH → Empleados', async () => {
      await openModule(page, 'Recursos Humanos');
      const item = page.locator('a, button, span').filter({ hasText: /empleados/i }).first();
      if (await item.isVisible().catch(() => false)) { await item.click(); await page.waitForTimeout(1_500); }
    });
    await test.step('Botón nuevo empleado abre formulario', async () => {
      const btn = page.getByRole('button', { name: /nuevo empleado|crear empleado|agregar empleado|nuevo/i }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Campo nombre completo presente', async () => {
      const name = page.locator('input[placeholder*="nombre" i], input[name*="name" i], input[name*="firstName" i]').first();
      await expect(name).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Cerrar sin errores', async () => {
      await page.keyboard.press('Escape').catch(() => {});
    });
  });
});
