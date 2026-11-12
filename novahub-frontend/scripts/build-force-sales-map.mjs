// Arma el HTML del mapa de Fuerza Comercial a partir de las partes de map-src/force-sales.
//
//   node scripts/build-force-sales-map.mjs           escribe public/maps/<salida del manifiesto>
//   node scripts/build-force-sales-map.mjs --check   falla si el HTML publicado no coincide con las partes
//
// El motor del mapa vive dentro de una sola función asíncrona, por eso las partes no se cargan como
// archivos sueltos en el navegador: se unen, en el orden del manifiesto, en el mismo documento.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'map-src', 'force-sales');
const manifest = JSON.parse(readFileSync(join(sourceDir, 'manifest.json'), 'utf8'));

export function assembleForceSalesMap() {
  const names = manifest.parts;
  if (!Array.isArray(names) || !names.length) throw new Error('El manifiesto no lista partes.');
  const duplicated = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicated) throw new Error(`La parte ${duplicated} aparece dos veces en el manifiesto.`);
  return names.map((name) => {
    const file = join(sourceDir, name);
    if (!existsSync(file)) throw new Error(`Falta la parte ${name}.`);
    // En Windows Git puede entregar las partes con CRLF; el HTML publicado siempre sale con LF.
    return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  }).join('');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = join(root, manifest.output);
  const html = assembleForceSalesMap();
  if (process.argv.includes('--check')) {
    const current = existsSync(target) ? readFileSync(target, 'utf8').replace(/\r\n/g, '\n') : '';
    if (current !== html) {
      console.error(`${manifest.output} no coincide con map-src/force-sales. Ejecuta: node scripts/build-force-sales-map.mjs`);
      process.exit(1);
    }
    console.log('El mapa de Fuerza Comercial está al día con sus partes.');
  } else {
    writeFileSync(target, html, 'utf8');
    console.log(`Mapa de Fuerza Comercial armado: ${manifest.output} (${html.length} caracteres)`);
  }
}
