// Detecta el error «Cannot access 'X' before initialization»: una variable (const / let / class) que se USA mientras la
// pantalla se arma, en una línea anterior a donde se declara. En el navegador revienta el módulo completo.
//
// Lo que ESLint y TypeScript no ven: el uso está dentro de un callback que se ejecuta de inmediato
// (.map / .filter / .reduce / useMemo / useState(() => …) / función autoejecutada). Un callback diferido
// (onClick, useEffect, useCallback, setTimeout, async) no se marca porque corre cuando la variable ya existe.
//
// Uso: npm run check:init         (falla con cualquier hallazgo; no hay línea base: debe quedar en cero)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const SYNC_METHODS = new Set(['map', 'filter', 'reduce', 'reduceRight', 'forEach', 'some', 'every', 'find', 'findIndex', 'findLast', 'findLastIndex', 'flatMap', 'sort', 'toSorted', 'from']);
const SYNC_FUNCTIONS = new Set(['useMemo', 'useState', 'useReducer', 'useRef', 'useSyncExternalStore', 'useDeferredValue', 'lazyState']);

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.d\.ts$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const isFunctionLike = (node) => ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node) || ts.isConstructorDeclaration(node);

function boundNames(nameNode, out = []) {
  if (ts.isIdentifier(nameNode)) out.push(nameNode.text);
  else if (ts.isObjectBindingPattern(nameNode) || ts.isArrayBindingPattern(nameNode)) {
    for (const element of nameNode.elements) if (!ts.isOmittedExpression(element)) boundNames(element.name, out);
  }
  return out;
}

/** ¿Esta función se ejecuta en el mismo momento en que se evalúa la expresión que la contiene? */
function runsImmediately(fn) {
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return false;
  if (fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)) return false;
  let parent = fn.parent;
  while (ts.isParenthesizedExpression(parent)) parent = parent.parent;
  if (!ts.isCallExpression(parent)) return false;
  if (parent.expression === fn || (ts.isParenthesizedExpression(parent.expression) && parent.expression.expression === fn)) return true; // (() => …)()
  if (!parent.arguments.includes(fn)) return false;
  const callee = parent.expression;
  if (ts.isPropertyAccessExpression(callee)) return SYNC_METHODS.has(callee.name.text);
  if (ts.isIdentifier(callee)) return SYNC_FUNCTIONS.has(callee.text);
  return false;
}

function isReference(id) {
  const parent = id.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === id) return false;
  if (ts.isQualifiedName(parent) && parent.right === id) return false;
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent) || ts.isEnumMember(parent)) && parent.name === id) return false;
  if (ts.isBindingElement(parent) && (parent.propertyName === id || parent.name === id)) return false;
  if (ts.isVariableDeclaration(parent) && parent.name === id) return false;
  if (ts.isParameter(parent) && parent.name === id) return false;
  if (ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent) || ts.isClassDeclaration(parent) || ts.isClassExpression(parent)) { if (parent.name === id) return false; }
  if (ts.isJsxAttribute(parent) && parent.name === id) return false;
  if (ts.isLabeledStatement(parent) || ts.isBreakOrContinueStatement(parent)) return false;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isImportClause(parent) || ts.isNamespaceImport(parent)) return false;
  if (ts.isTypeReferenceNode(parent) || ts.isTypeQueryNode(parent) || ts.isExpressionWithTypeArguments(parent)) return false;
  for (let node = parent; node; node = node.parent) if (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node)) return false;
  return true;
}

function declaresName(block, name) {
  return block.statements.some((statement) => (ts.isVariableStatement(statement) && statement.declarationList.declarations.some((d) => boundNames(d.name).includes(name)))
    || ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name?.text === name));
}

function shadowedBetween(id, container, name) {
  for (let node = id.parent; node && node !== container; node = node.parent) {
    if (isFunctionLike(node) && node.parameters.some((parameter) => boundNames(parameter.name).includes(name))) return true;
    if ((ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) && node.name?.text === name) return true;
    if (ts.isBlock(node) && node !== container && declaresName(node, name)) return true;
    if (ts.isCatchClause(node) && node.variableDeclaration && boundNames(node.variableDeclaration.name).includes(name)) return true;
    if ((ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node)) && node.initializer && ts.isVariableDeclarationList(node.initializer)
      && node.initializer.declarations.some((d) => boundNames(d.name).includes(name))) return true;
  }
  return false;
}

export function findUseBeforeInit(file) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const findings = [];

  const containers = [];
  (function collect(node) {
    if (ts.isSourceFile(node)) containers.push(node);
    else if (ts.isBlock(node) && node.parent && isFunctionLike(node.parent)) containers.push(node);
    ts.forEachChild(node, collect);
  })(source);

  for (const container of containers) {
    const declared = new Map();
    for (const statement of container.statements) {
      if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.BlockScoped)) {
        for (const declaration of statement.declarationList.declarations) for (const name of boundNames(declaration.name)) declared.set(name, statement);
      } else if (ts.isClassDeclaration(statement) && statement.name) declared.set(statement.name.text, statement);
    }
    if (!declared.size) continue;
    (function visit(node) {
      if (ts.isIdentifier(node) && declared.has(node.text) && isReference(node)) {
        const statement = declared.get(node.text);
        if (node.getStart() < statement.getStart() && !shadowedBetween(node, container, node.text)) {
          // Cadena de funciones entre el uso y el contenedor: todas deben ejecutarse de inmediato para que sea un fallo seguro.
          let immediate = true;
          for (let ancestor = node.parent; ancestor && ancestor !== container; ancestor = ancestor.parent) {
            if (ts.isClassDeclaration(ancestor) || ts.isClassExpression(ancestor)) { immediate = false; break; }
            if (isFunctionLike(ancestor) && !runsImmediately(ancestor)) { immediate = false; break; }
          }
          if (immediate) {
            const useLine = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
            const declLine = source.getLineAndCharacterOfPosition(statement.getStart()).line + 1;
            findings.push({ file, name: node.text, useLine, declLine });
          }
        }
      }
      ts.forEachChild(node, visit);
    })(container);
  }
  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = walkFiles(join(ROOT, 'src'));
  const all = files.flatMap(findUseBeforeInit);
  if (!all.length) {
    console.log(`check:init OK — ${files.length} archivos revisados: ninguna variable se usa antes de inicializarse mientras se arma la pantalla.`);
    process.exit(0);
  }
  console.error(`check:init — ${all.length} uso(s) antes de inicializar (revientan con «Cannot access '…' before initialization»):\n`);
  for (const f of all) console.error(`  ${relative(ROOT, f.file).split(sep).join('/')}:${f.useLine}  «${f.name}» se usa aquí, pero se declara después, en la línea ${f.declLine}`);
  console.error('\nMueve la declaración antes del primer uso (o conviértela en function, que sí se eleva).');
  process.exit(1);
}
