// Candado de campos numéricos: un <input type="number" step="0.01"> escrito a mano se salta la regla del componente Input
// y vuelve a mover los montos de a centavo. Usa <Input> (components/ui/input) o step="any".
// Línea base: lo que ya existía; solo falla por hallazgos NUEVOS. --update-baseline guarda el estado actual.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'audit-baseline', 'inputs.json');
const RAW_NUMBER_INPUT = /<input\b[^>]*\btype=["']number["'][^>]*\bstep=\{?["']?0?\.0*1["']?\}?/gs;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of walk(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(RAW_NUMBER_INPUT)) {
    const line = text.slice(0, match.index).split('\n').length;
    const where = relative(ROOT, file).split(sep).join('/');
    findings.push({ key: `${where}|${match[0].replace(/\s+/g, ' ').slice(0, 80)}`, message: `${where}:${line}  <input type="number" step="0.01"> sin pasar por <Input>` });
  }
}
const keys = [...new Set(findings.map((finding) => finding.key))].sort();
if (process.argv.includes('--update-baseline')) {
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(`línea base de campos numéricos guardada con ${keys.length} hallazgo(s).`);
  process.exit(0);
}
const accepted = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : []);
const fresh = findings.filter((finding) => !accepted.has(finding.key));
console.log(`Campos numéricos: ${keys.length} hallazgo(s) en total, ${accepted.size} aceptado(s) en la línea base, ${fresh.length} NUEVO(S).`);
for (const finding of fresh) console.log(`  ✗ ${finding.message}`);
if (fresh.length) console.log('  → Usa el componente <Input> (sus flechas suben de a una unidad) o step="any".');
process.exit(fresh.length ? 1 : 0);
