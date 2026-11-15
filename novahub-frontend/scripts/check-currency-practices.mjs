// Impide que vuelvan las conversiones de moneda hechas a mano, que dejaban un mismo monto con valores distintos según
// cómo se abriera una pantalla (C$ 700 se veía como $ 19.11 o $ 700.00).
//   R1  una tasa de cambio escrita a mano (36.5, 36.6243…): usar DEFAULT_EXCHANGE_RATE de utils/currency.ts.
//   R2  dividir o multiplicar por «documento.exchangeRate || tasaGlobal»: un documento en moneda base guarda tasa 1, así que
//       el resultado sale mal. Usar convertBetweenSupportedCurrencies / convertToBaseCurrency / equivalentInOtherCurrency.
//   R3  un documento nuevo con `exchangeRate: globalRate` justo debajo de `currency:`: usar initialDocumentExchangeRate.
//   R4  Number(x.toFixed(n)) o Math.round(x * 100) / 100 para redondear: en empates (x.xx5) difieren del servidor
//       (con toFixed, 1 de cada 2 empates; con Math.round, 1 de cada 20). Usar roundDecimal(x, n).
// Uso: npm run check:currency   (falla con cualquier hallazgo que no esté en la lista de pendientes de abajo)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const SKIP_FILES = new Set(['app/utils/currency.ts', 'app/services/pdf-template-definition.ts']);
// Pendientes conocidos (se retiran de aquí al corregirlos). Cada uno cuenta como máximo las veces indicadas.
const KNOWN = { 'R2 app/components/reportes/financialAnalytics.ts': 1 };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const found = [];
for (const file of walk(ROOT)) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (SKIP_FILES.has(rel)) continue;
  const rows = readFileSync(file, 'utf8').split(/\r?\n/);
  rows.forEach((row, index) => {
    const code = row.trim();
    if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
    const at = `${rel}:${index + 1}`;
    if (/\b36\.\d+\b/.test(row) && !/placeholder=|<path|d="/.test(row) && !/['"`][^'"`]*\b36\.\d+\b[^'"`]*['"`]\s*\}?\s*<\/?[a-z]/i.test(row) && /[=:(,]\s*['"`]?36\.\d+/.test(row) && !/\bplaceholder\b/.test(row)) {
      found.push({ rule: 'R1', rel, at, row: code });
    }
    if (/[*/]\s*\(?\s*[A-Za-z_.?]*[eE]xchangeRate\s*(\|\||\?\?)\s*[A-Za-z_.0-9]+/.test(row)) found.push({ rule: 'R2', rel, at, row: code });
    if (/Number\([^()]*\.toFixed\(|parseFloat\([^()]*\.toFixed\(|Math\.round\([^()]*\* ?100\) ?\/ ?100/.test(row)) found.push({ rule: 'R4', rel, at, row: code });
    if (/^exchangeRate: globalRate,?$/.test(code)) {
      const previous = rows.slice(0, index).reverse().find((r) => r.trim());
      if (previous && /^\s*currency:/.test(previous)) found.push({ rule: 'R3', rel, at, row: code });
    }
  });
}

const budget = new Map(Object.entries(KNOWN));
const failures = found.filter((item) => {
  const key = `${item.rule} ${item.rel}`;
  const left = budget.get(key) || 0;
  if (left > 0) { budget.set(key, left - 1); return false; }
  return true;
});

if (!failures.length) {
  console.log(`check:currency OK — sin tasas escritas a mano ni conversiones por tasa de documento (${found.length - failures.length} pendiente(s) conocido(s) en la lista).`);
  process.exit(0);
}
const HINT = {
  R1: 'tasa escrita a mano → DEFAULT_EXCHANGE_RATE (utils/currency.ts)',
  R2: 'conversión con «documento.exchangeRate || tasa» → convertBetweenSupportedCurrencies / convertToBaseCurrency / equivalentInOtherCurrency',
  R3: 'tasa inicial `globalRate` con cualquier moneda → initialDocumentExchangeRate(moneda, baseCurrency, globalRate)',
  R4: 'redondeo con toFixed / Math.round(x*100)/100 → roundDecimal(x, lugares) de utils/currency.ts (igual que el servidor)',
};
console.error(`check:currency — ${failures.length} hallazgo(s):\n`);
for (const item of failures) console.error(`  ${item.at}  ${item.rule}: ${HINT[item.rule]}\n      ${item.row.slice(0, 150)}`);
process.exit(1);
