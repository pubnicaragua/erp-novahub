import { chromium } from '@playwright/test';

const baseUrl = process.env.NOVAHUB_URL ?? 'http://localhost:5173/';
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const projectName = `Tour Proyecto Completo ${stamp}`;

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function bodyText() {
  return page.locator('body').innerText({ timeout: 8000 }).catch(() => '');
}

async function clickText(text) {
  await page.getByText(text, { exact: true }).first().click({ timeout: 10000 });
}

async function fillByLabel(label, value) {
  const control = page.getByLabel(label, { exact: false }).first();
  await control.fill(value, { timeout: 5000 });
}

async function selectFirstOption(label, fallbackText) {
  const control = page.getByLabel(label, { exact: false }).first();
  await control.click({ timeout: 5000 });
  await page.waitForTimeout(300);
  const options = page.getByRole('option');
  const count = await options.count().catch(() => 0);
  if (count > 1) {
    await options.nth(1).click();
    return;
  }
  if (count === 1) {
    await options.first().click();
    return;
  }
  if (fallbackText) {
    await page.getByText(fallbackText).first().click({ timeout: 3000 }).catch(() => {});
  }
}

async function fillDateNear(label, value) {
  const labeled = page.getByLabel(label, { exact: false }).first();
  const tag = await labeled.evaluate((el) => el.tagName).catch(() => '');
  if (tag) {
    await labeled.fill(value).catch(async () => {
      await labeled.click();
      await page.keyboard.type(value);
    });
    return;
  }
  const inputs = page.locator('input');
  const count = await inputs.count();
  for (let i = 0; i < count; i += 1) {
    const input = inputs.nth(i);
    const box = await input.boundingBox().catch(() => null);
    if (!box) continue;
    const valueNow = await input.inputValue().catch(() => '');
    if (!valueNow) {
      await input.fill(value).catch(() => {});
      if ((await input.inputValue().catch(() => '')) === value) return;
    }
  }
}

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
await fillByLabel(/correo/i, 'demo@novahub.com');
await fillByLabel(/contraseña/i, '123456');
await page.getByRole('button', { name: /iniciar sesión/i }).click();
await page.waitForTimeout(5000);

await clickText('Proyectos');
await clickText('Portafolio');
await page.waitForTimeout(2500);

await page.getByRole('button', { name: /nuevo proyecto/i }).click();
await page.waitForTimeout(1000);

await fillByLabel(/nombre del proyecto/i, projectName);
await fillByLabel(/descripción/i, 'Proyecto creado por Codex para validar el flujo completo: datos generales, costos, línea base, EVM y cotización.');

await selectFirstOption(/estado/i);
await selectFirstOption(/prioridad/i);
await selectFirstOption(/responsable/i);
await selectFirstOption(/sucursal/i);
await selectFirstOption(/cliente relacionado/i);

await fillDateNear(/fecha de inicio/i, '2026-10-05');
await fillDateNear(/fecha de fin/i, '2026-11-20');
await fillByLabel(/presupuesto proyectado/i, '125000');
await fillByLabel(/ingresos proyectados/i, '165000').catch(() => {});
await fillByLabel(/tasa de cambio/i, '36.80').catch(() => {});
await fillByLabel(/notas/i, 'Validación integral: proyecto nuevo con presupuesto, responsable, sucursal y datos financieros.');

await page.screenshot({ path: 'tour-filled-project-form.png', fullPage: true });
await page.getByRole('button', { name: /crear proyecto/i }).click();
await page.waitForTimeout(5000);

const afterCreate = await bodyText();
console.log(`PROJECT_NAME=${projectName}`);
console.log(`URL_AFTER_CREATE=${page.url()}`);
console.log(afterCreate.slice(0, 6000));

await page.screenshot({ path: 'tour-project-created.png', fullPage: true });

console.log('Browser left open for manual inspection. Press Ctrl+C in this terminal session when done.');
await new Promise(() => {});
