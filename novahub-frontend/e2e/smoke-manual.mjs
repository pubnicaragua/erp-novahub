import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = 'http://127.0.0.1:5173';
const server = spawn(process.execPath, ['e2e/static-server.mjs'], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, E2E_STATIC_PORT: '5173' },
});

const waitForServer = async () => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/register`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('El servidor estático no respondió.');
};

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('requestfailed', (request) => errors.push(`requestfailed: ${request.url()} · ${request.failure()?.errorText || 'unknown'}`));

  for (const route of ['/register', '/login']) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    if (!response || response.status() >= 500) throw new Error(`${route} respondió HTTP ${response?.status() || 'sin respuesta'}.`);
    const bodyText = await page.locator('body').innerText();
    if (!bodyText.trim()) throw new Error(`${route} renderizó un documento vacío.`);
    if (/Error de renderizado detectado/i.test(bodyText)) throw new Error(`${route} todavía muestra el mensaje técnico de renderizado.`);
  }

  if (errors.length) throw new Error(`Se detectaron ${errors.length} errores del navegador:\n${errors.join('\n')}`);
  console.log('E2E smoke OK: /register y /login renderizan sin errores de consola ni pageerror.');
} finally {
  if (browser) await browser.close();
  if (!server.killed) server.kill();
}
