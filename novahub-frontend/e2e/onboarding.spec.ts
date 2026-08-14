import { test, expect } from './helpers/errorCapture';

test.describe('Onboarding de registro', () => {
  test('abre el registro y muestra el paso 1 sin errores', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('heading', { name: /crear/i })).toBeVisible();
    await expect(page.getByLabel(/nombre de empresa/i)).toBeVisible();
  });

  test('el paso 1 valida el número de WhatsApp', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/nombre de empresa/i).fill('Empresa Playwright QA');
    await page.getByLabel(/nombre del contacto/i).fill('Juan Prueba');
    await page.getByLabel(/^cargo$/i).fill('Gerente General');
    await page.getByLabel(/número de whatsapp/i).fill('123');
    await expect(page.getByText(/número de whatsapp válido/i)).toBeVisible();
  });

  test('sin verificar WhatsApp el botón Siguiente queda bloqueado', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel(/nombre de empresa/i).fill('Empresa Playwright QA');
    await page.getByLabel(/nombre del contacto/i).fill('Juan Prueba');
    await page.getByLabel(/^cargo$/i).fill('Gerente General');
    await page.getByLabel(/número de whatsapp/i).fill('+50581234567');
    await page.getByLabel(/^email$/i).fill('qa.playwright@novahub.test');
    await page.getByLabel(/contraseña/i).fill('Playwright2026!');
    await page.getByText(/acepto los/i).click();
    await expect(page.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });
});
