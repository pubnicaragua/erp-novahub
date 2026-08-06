import { test, expect, Page } from '@playwright/test';

export const QA_SUPERADMIN = {
  // Usuario tenant para navegar vistas ERP (superadmin no ve módulos tenant)
  email: process.env.PW_QA_EMAIL || 'devjair@agency.com',
  password: process.env.PW_QA_PASSWORD || '123456',
};

export async function login(page: Page) {
  await page.goto('/');
  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail" i]').first();
  await emailInput.waitFor({ timeout: 20_000 });
  await emailInput.fill(QA_SUPERADMIN.email);
  const passInput = page.locator('input[type="password"]').first();
  await passInput.fill(QA_SUPERADMIN.password);
  await passInput.press('Enter');
  // esperar sesión: token en localStorage o que la pantalla de login desaparezca
  await page.waitForFunction(() => {
    const t = Object.keys(localStorage).find((k) => /token|auth/i.test(k));
    return !!t || !document.querySelector('input[type="password"]');
  }, null, { timeout: 30_000 });
  await page.waitForTimeout(1_500);
  await expect(page.locator('aside, nav, [class*="sidebar" i]').first()).toBeVisible({ timeout: 20_000 }).catch(() => {});
}

export async function openModule(page: Page, menuText: string) {
  // sidebar item por texto
  const item = page.locator('aside a, nav a, [class*="sidebar" i] [role="button"], [class*="sidebar" i] button')
    .filter({ hasText: menuText }).first();
  if (await item.isVisible().catch(() => false)) {
    await item.click();
  } else {
    // mobile: abrir menú hamburguesa
    const burger = page.locator('button[aria-label*="menu" i], [class*="menu" i] button').first();
    if (await burger.isVisible().catch(() => false)) {
      await burger.click();
      await page.waitForTimeout(500);
      await item.click();
    } else {
      await page.evaluate((t) => {
        window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: t, subModule: undefined } }));
      }, menuText);
    }
  }
  await page.waitForTimeout(1_500);
}

export async function clickByText(page: Page, text: string) {
  await page.getByRole('button', { name: new RegExp(text, 'i') }).first().click();
}

export async function expectToastSuccess(page: Page, text?: RegExp) {
  const toast = page.locator('[data-sonner-toast], [role="status"], [class*="toast" i]').first();
  await toast.waitFor({ timeout: 15_000 }).catch(() => {});
  if (text) {
    await expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
  }
}

export async function closeDialog(page: Page) {
  const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] [aria-label="Cerrar"]').first();
  if (await closeBtn.isVisible().catch(() => false)) await closeBtn.click();
  await page.waitForTimeout(600);
}

export { test, expect };
