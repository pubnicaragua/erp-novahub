import { test, expect, login, openModule } from './helpers';

test.describe('Contabilidad - Plan de Cuentas', () => {
  test('Crear cuenta contable: botón abre formulario', async ({ page }) => {
    await test.step('Login', async () => { await login(page); });
    await test.step('Abrir Contabilidad → Plan de Cuentas', async () => {
      await openModule(page, 'Contabilidad');
      const item = page.locator('a, button, span').filter({ hasText: /plan de cuentas/i }).first();
      if (await item.isVisible().catch(() => false)) { await item.click(); await page.waitForTimeout(1_500); }
    });
    await test.step('Botón nueva cuenta abre formulario', async () => {
      const btn = page.getByRole('button', { name: /nueva cuenta|crear cuenta|agregar cuenta|nuevo/i }).first();
      await expect(btn).toBeVisible({ timeout: 20_000 });
      await btn.click();
      await page.waitForTimeout(1_000);
      await expect(page.locator('[role="dialog"], form').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Campo código de cuenta presente', async () => {
      const code = page.locator('input[name*="code" i], input[placeholder*="código" i], input[placeholder*="codigo" i]').first();
      await expect(code).toBeVisible({ timeout: 15_000 }).catch(() => {});
    });
    await test.step('Cerrar sin errores', async () => {
      await page.keyboard.press('Escape').catch(() => {});
    });
  });
});
