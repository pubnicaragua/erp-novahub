import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const AUTH_STATE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth', 'user.json');

setup('Iniciar sesión y guardar sesión para las vistas', async ({ page }) => {
  const email = process.env.E2E_EMAIL || 'devjair@agency.com';
  const password = process.env.E2E_PASSWORD || '123456';

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.getByPlaceholder(/tu@empresa\.com|correo/i).first().fill(email);
  await page.getByPlaceholder(/ingresa tu contraseña/i).first().fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).first().click();
  await expect(page.getByPlaceholder(/ingresa tu contraseña/i)).toBeHidden({ timeout: 20_000 });

  fs.mkdirSync(path.dirname(AUTH_STATE), { recursive: true });
  await page.context().storageState({ path: AUTH_STATE });
  expect(fs.existsSync(AUTH_STATE)).toBeTruthy();
});
