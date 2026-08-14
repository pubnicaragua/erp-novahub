import { test, expect } from '../helpers/errorCapture';

test.describe('Vistas del ERP (plantillas para grabar)', () => {
  test('Contabilidad: Configuración contable carga sin errores', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('erp-active-module', 'contabilidad');
      localStorage.setItem('erp-active-submodule', 'configuracion');
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByText(/configuración de cuentas para asientos/i).first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(1500);
  });
});
