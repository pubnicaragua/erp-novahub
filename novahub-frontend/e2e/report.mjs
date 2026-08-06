// Reporta resultados de Playwright (e2e-results/results.json) al backend QA.
// Uso: node e2e/report.mjs
// Env: PW_QA_API_URL (default http://localhost:3000/api), PW_QA_EMAIL, PW_QA_PASSWORD
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const API = process.env.PW_QA_API_URL || 'http://localhost:3000/api';
const EMAIL = process.env.PW_QA_EMAIL || 'superadmin@novahub.com';
const PASSWORD = process.env.PW_QA_PASSWORD || 'admin123';

// Mapeo spec -> checkKey (module|view|action) y pasos por spec.
const CHECK_MAP = [
  { spec: 'ventas-orden-venta.spec.ts', key: 'ventas|ordenes-venta|crear-orden', steps: 5 },
  { spec: 'compras-orden-compra.spec.ts', key: 'compras|ordenes-compra|crear-orden', steps: 4 },
  { spec: 'inventario-crear-producto.spec.ts', key: 'inventario|productos|crear-producto', steps: 4 },
  { spec: 'rh-crear-empleado.spec.ts', key: 'rh|empleados|crear-empleado', steps: 4 },
  { spec: 'contabilidad-crear-cuenta.spec.ts', key: 'contabilidad|plan-cuentas|crear-cuenta', steps: 4 },
  { spec: 'config-crear-rol.spec.ts', key: 'config|roles|crear-rol', steps: 4 },
];

async function main() {
  const file = './e2e-results/results.json';
  if (!existsSync(file)) {
    console.error('No results.json — corre primero npx playwright test');
    process.exit(1);
  }
  const report = JSON.parse(await readFile(file, 'utf8'));

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) {
    console.error('Login falló:', login.status, await login.text());
    process.exit(1);
  }
  const { access_token: token } = await login.json();

  const checks = await (await fetch(`${API}/qa/checks`, { headers: { Authorization: `Bearer ${token}` } })).json();

  let reported = 0;
  for (const suite of report.suites || []) {
    for (const spec of suite.suites || []) {
      const fileName = (spec.file || '').split(/[\\/]/).pop();
      const map = CHECK_MAP.find((m) => m.spec === fileName);
      if (!map) continue;
      const check = checks.find((c) => `${c.moduleKey}|${c.viewKey}|${c.actionKey}` === map.key);
      if (!check) { console.error(`Check no encontrado: ${map.key}`); continue; }
      const result = spec.specs?.[0]?.ok ?? true;
      const stepsOk = result ? map.steps : 0;
      const res = await fetch(`${API}/qa/checks/${check.id}/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'E2E', stepsOk, stepsTotal: map.steps,
          result: result ? 'PASS' : 'FAIL',
          notes: `Playwright e2e: ${result ? 'PASS' : 'FAIL'} (${stepsOk}/${map.steps} pasos)`,
        }),
      });
      if (res.ok) { reported++; console.log(`Reportado ${map.key}: ${result ? 'PASS' : 'FAIL'}`); }
      else { console.error(`Error reportando ${map.key}: ${res.status} ${await res.text()}`); }
    }
  }
  console.log(`\nListo: ${reported} checks actualizados (source=E2E)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
