// Detecta en una sola pasada los errores que en producción aparecen como «X is not defined» o como un módulo
// que no carga: nombres sin declarar o sin importar, imports que no existen y módulos que no se encuentran.
// No exige que todo el proyecto pase TypeScript (hay errores de otro tipo en la base); solo estos.
// Uso: npm run check:names
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const BLOCKING = new Map([
  ['TS2304', 'nombre no definido'],
  ['TS2552', 'nombre no definido (¿quisiste decir otro?)'],
  ['TS2503', 'espacio de nombres no definido'],
  ['TS2305', 'el módulo no exporta ese nombre'],
  ['TS2724', 'el módulo no exporta ese nombre (¿quisiste decir otro?)'],
  ['TS2614', 'import con nombre que no existe'],
  ['TS2307', 'módulo no encontrado'],
]);

const result = spawnSync(process.execPath, ['--max-old-space-size=4096', tsc, '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
});
if (result.error) {
  console.error('No se pudo ejecutar TypeScript:', result.error.message);
  process.exit(2);
}

// Los mensajes largos de tsc continúan en líneas con sangría: nos quedamos con la línea del error.
const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/);
const found = lines
  .map((line) => /^(.*)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(line))
  .filter((match) => match && BLOCKING.has(match[4]));

if (!found.length) {
  console.log('check:names OK — no hay nombres sin definir, imports inexistentes ni módulos que falten.');
  process.exit(0);
}
console.error(`check:names — ${found.length} error(es) que fallarían en el navegador:\n`);
for (const match of found) {
  const [, file, line, column, code, message] = match;
  console.error(`  ${file}:${line}:${column}  ${code} (${BLOCKING.get(code)}): ${message}`);
}
console.error('\nCorrígelos antes de subir: cada uno rompe la vista al usarla («… is not defined»).');
process.exit(1);
