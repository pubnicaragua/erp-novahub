// Recorre TODAS las pantallas del menú con un usuario de demostración y marca las que revientan:
// el cartel «Error en <módulo>», errores de JavaScript en la página o errores de la consola.
// Es la red de seguridad final: atrapa cualquier error de ejecución (variable sin definir, usada antes de
// inicializarse, dato nulo…) que ninguna revisión estática vea, ANTES de que lo encuentre un cliente.
// Solo navega y lee: no crea, edita ni borra nada.
//
// Uso (la clave la escribes tú; no se guarda ni se imprime):
//   $env:AUDIT_URL="http://localhost:5173"              (o la dirección de producción)
//   $env:AUDIT_API_URL="https://backenderpnh.onrender.com/api"
//   $env:AUDIT_EMAIL="demo@..."; $env:AUDIT_PASSWORD="..."
//   npm run audit:screens            (primera vez: npx playwright install chromium)
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = (process.env.AUDIT_URL || 'http://localhost:5173').replace(/\/$/, '');
const API = (process.env.AUDIT_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const EMAIL = process.env.AUDIT_EMAIL;
const PASSWORD = process.env.AUDIT_PASSWORD;
const SETTLE_MS = Number(process.env.AUDIT_SETTLE_MS || 2500);
if (!EMAIL || !PASSWORD) {
  console.error('Faltan AUDIT_EMAIL y AUDIT_PASSWORD (usuario de demostración). No se ejecutó nada.');
  process.exit(2);
}

const login = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const body = await login.json().catch(() => ({}));
if (!login.ok || !body.access_token) { console.error(`No se pudo iniciar sesión (HTTP ${login.status}).`); process.exit(2); }

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((token) => { try { localStorage.setItem('nh-auth-token', token); } catch { /* sin almacenamiento */ } }, body.access_token);
const page = await context.newPage();

let current = '';
const problems = [];
const record = (kind, detail) => problems.push({ screen: current, kind, detail: String(detail).slice(0, 220) });
page.on('pageerror', (error) => record('error de JavaScript', error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (/Failed to load resource|favicon|net::ERR|status of (401|403|404)/i.test(text)) return; // ruido de red, no de código
  record('consola', text);
});

const hrefsFrom = async (selector) => page.$$eval(`${selector} a[href*="m="]`, (anchors) => [...new Set(anchors.map((a) => a.getAttribute('href')))]).catch(() => []);
const settle = () => page.waitForTimeout(SETTLE_MS);
const crashed = async () => page.evaluate(() => {
  const text = document.body?.innerText || '';
  const hit = /Error en [^\n]+\n[^\n]*(error inesperado|inesperado)/i.exec(text) || /Ocurrió un error inesperado/.exec(text);
  return hit ? (text.split('\n').find((line) => line.trim() && !/^(Error en|Ocurrió|Puedes|Reintentar|Recargar)/.test(line) && /(is not defined|before initialization|Cannot|undefined|null|not a function|is not)/i.test(line)) || 'pantalla de error') : '';
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await settle();
const moduleLinks = (await hrefsFrom('[data-sidebar-navigation]')).filter((href) => !/sm=/.test(href));
const visited = new Set();
const targets = [];
for (const moduleHref of moduleLinks) {
  current = moduleHref;
  await page.goto(`${BASE}${moduleHref.startsWith('/') ? '' : '/'}${moduleHref}`, { waitUntil: 'domcontentloaded' });
  await settle();
  targets.push(moduleHref);
  for (const sub of await hrefsFrom('[data-sidebar-navigation]')) if (/sm=/.test(sub)) targets.push(sub);
}

for (const href of [...new Set(targets)]) {
  if (visited.has(href)) continue;
  visited.add(href);
  current = decodeURIComponent(href.replace(/^.*\?/, ''));
  await page.goto(`${BASE}${href.startsWith('/') ? '' : '/'}${href}`, { waitUntil: 'domcontentloaded' });
  await settle();
  const crash = await crashed();
  if (crash) record('pantalla de error', crash);
  process.stdout.write(crash ? '✗' : '·');
}
await browser.close();

console.log(`\n\nPantallas recorridas: ${visited.size}`);
const seen = new Set();
const unique = problems.filter((p) => { const key = `${p.screen}|${p.kind}|${p.detail}`; if (seen.has(key)) return false; seen.add(key); return true; });
if (!unique.length) { console.log('AUDITORÍA DE PANTALLAS OK — ninguna pantalla reventó ni dejó errores en la consola.'); process.exit(0); }
console.log(`${unique.length} problema(s):`);
for (const p of unique) console.log(`  ✗ [${p.screen}] ${p.kind}: ${p.detail}`);
process.exit(1);
