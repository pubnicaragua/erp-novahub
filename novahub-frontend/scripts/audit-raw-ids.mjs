// Candado de identificadores internos en pantalla: un id de base de datos (UUID) nunca debe verse como texto para el
// usuario. Marca los lugares donde un texto visible se arma con `x.id`, `xId` o un `||` que cae a un id cuando falta
// el nombre (por ejemplo `{supplier?.name || supplierId}`), que es como terminan apareciendo códigos como
// «d87f58c9-a982-4aea…» en lugar del nombre.
// Línea base: lo que ya existía; solo falla por hallazgos NUEVOS. --update-baseline guarda el estado actual.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'scripts', 'audit-baseline', 'raw-ids.json');

const ID_NAME = /(^|\.)(id|uuid)$|[a-z]Id$|^(rowId|recordId|entityId)$/;
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name) && !/\.(spec|test)\.tsx$/.test(name)) out.push(full);
  }
  return out;
};

const tail = (node) => {
  if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return tail(node.expression);
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${ts.isIdentifier(node.expression) ? '' : ''}.${node.name.text}`;
  return '';
};
const isIdReference = (node) => ID_NAME.test(tail(node));

/** ¿La expresión puede terminar mostrando un id? (id directo, o el último respaldo de un `||`/`??`) */
function exposesId(expression) {
  if (ts.isParenthesizedExpression(expression)) return exposesId(expression.expression);
  if (ts.isBinaryExpression(expression) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(expression.operatorToken.kind)) return exposesId(expression.right);
  if (ts.isConditionalExpression(expression)) return exposesId(expression.whenTrue) || exposesId(expression.whenFalse);
  if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression) && expression.expression.text === 'String' && expression.arguments[0]) return exposesId(expression.arguments[0]);
  if (ts.isTemplateExpression(expression)) return false;
  return isIdReference(expression);
}

const findings = [];
for (const file of walk(join(ROOT, 'src'))) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const where = relative(ROOT, file).split(sep).join('/');
  (function visit(node) {
    // Solo texto visible: expresiones entre llaves dentro del contenido de un elemento (no atributos, no key, no handlers).
    if (ts.isJsxExpression(node) && node.expression && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent)) && exposesId(node.expression)) {
      const snippet = node.getText().replace(/\s+/g, ' ').slice(0, 100);
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const hash = createHash('sha1').update(snippet).digest('hex').slice(0, 8);
      findings.push({ key: `${where}|${hash}`, message: `${where}:${line}  ${snippet}` });
    }
    ts.forEachChild(node, visit);
  })(source);
}

const keys = [...new Set(findings.map((finding) => finding.key))].sort();
if (process.argv.includes('--update-baseline')) {
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(`línea base de identificadores en pantalla guardada con ${keys.length} hallazgo(s).`);
  process.exit(0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const accepted = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : []);
  const fresh = findings.filter((finding) => !accepted.has(finding.key));
  console.log(`Identificadores en pantalla: ${keys.length} hallazgo(s) en total, ${accepted.size} aceptado(s) en la línea base, ${fresh.length} NUEVO(S).`);
  for (const finding of fresh.slice(0, 60)) console.log(`  ✗ ${finding.message}`);
  if (fresh.length) console.log('  → Muestra el nombre o la descripción; el id solo como último recurso y nunca el UUID.');
  process.exit(fresh.length ? 1 : 0);
}
