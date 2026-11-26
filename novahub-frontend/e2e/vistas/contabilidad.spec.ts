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
  });

  test('Contabilidad: detalle del asiento reserva ancho legible para su descripción en móvil', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 850 });
    await page.addInitScript(() => {
      localStorage.setItem('erp-active-module', 'contabilidad');
      localStorage.setItem('erp-active-submodule', 'diario');
    });
    await page.goto('/?m=contabilidad&sm=diario');

    const journalNumber = page.getByText('#AS-015', { exact: true }).first();
    await expect(journalNumber).toBeVisible({ timeout: 30_000 });
    await journalNumber.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const description = dialog.locator('h3').first();
    await expect(description).toBeVisible();
    const descriptionWidth = await description.evaluate((element) => element.getBoundingClientRect().width);
    expect(descriptionWidth).toBeGreaterThanOrEqual(200);

    const hasViewportOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(hasViewportOverflow).toBe(false);
  });
});
