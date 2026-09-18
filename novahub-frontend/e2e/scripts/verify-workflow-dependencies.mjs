import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const backendRegistryPath = path.resolve(frontendRoot, '..', '..', 'Backend', 'src', 'common', 'authorization', 'workflow-dependencies.ts');
const frontendRegistryPath = path.join(frontendRoot, 'src', 'app', 'types', 'workflow-dependencies.ts');

if (!fs.existsSync(backendRegistryPath)) {
  throw new Error(`No se encontró el registro backend de dependencias: ${backendRegistryPath}`);
}

const backendSource = fs.readFileSync(backendRegistryPath, 'utf8');
const frontendSource = fs.readFileSync(frontendRegistryPath, 'utf8');
const extractKeys = (source) => [...source.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*\{\s*$/gm)].map((match) => match[1]);
const backendKeys = extractKeys(backendSource);
const frontendKeys = extractKeys(frontendSource);
const unique = (values) => [...new Set(values)].sort();

if (JSON.stringify(unique(backendKeys)) !== JSON.stringify(unique(frontendKeys))) {
  throw new Error(`El contrato frontend/backend de dependencias diverge. Backend=${backendKeys.join(',')} Frontend=${frontendKeys.join(',')}`);
}

function extractBalanced(source, start, opening, closing) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === opening) depth += 1;
    if (char === closing) {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`No se pudo cerrar una estructura del contrato desde ${start}`);
}

function extractDependencyBlock(source, key) {
  const match = source.match(new RegExp(`^  ${key}: \\{`, 'm'));
  if (!match || match.index === undefined) throw new Error(`No se encontró la dependencia ${key}`);
  const opening = source.indexOf('{', match.index);
  return extractBalanced(source, opening, '{', '}');
}

function propertyStart(block, property) {
  const match = block.match(new RegExp(`(?:^|[\\{\\n,])\\s*${property}:\\s*`, 'm'));
  if (!match || match.index === undefined) throw new Error(`Falta ${property} en una dependencia`);
  return match.index + match[0].length;
}

function stringValue(block, property) {
  const start = propertyStart(block, property);
  const quote = block[start];
  if (!['"', "'", '`'].includes(quote)) throw new Error(`${property} no es texto`);
  let value = '';
  for (let index = start + 1; index < block.length; index += 1) {
    if (block[index] === quote && block[index - 1] !== '\\') return value;
    value += block[index];
  }
  throw new Error(`Texto sin cerrar en ${property}`);
}

function balancedProperty(block, property, opening, closing) {
  const start = propertyStart(block, property);
  return extractBalanced(block, start, opening, closing);
}

function stringArray(block, property) {
  const array = balancedProperty(block, property, '[', ']');
  return [...array.matchAll(/['"]((?:\\.|[^'"])*)['"]/g)].map((match) => match[1]);
}

function permissionsArray(block) {
  const array = balancedProperty(block, 'consumerPermissions', '[', ']');
  return [...array.matchAll(/module:\s*['"]([^'"]+)['"][^}]*action:\s*['"]([^'"]+)['"]/g)]
    .map((match) => ({ module: match[1], action: match[2] }));
}

function messagesObject(block) {
  const object = balancedProperty(block, 'messages', '{', '}');
  return Object.fromEntries(['loading', 'empty', 'forbidden', 'outOfScope', 'error']
    .map((property) => [property, stringValue(object, property)]));
}

function conditionalObject(block) {
  const start = propertyStart(block, 'conditionalFields');
  const object = extractBalanced(block, start, '{', '}');
  return { when: stringValue(object, 'when'), fields: stringArray(object, 'fields') };
}

function normalizedDependency(source, key) {
  const block = extractDependencyBlock(source, key);
  const conditional = block.includes('conditionalFields:') ? conditionalObject(block) : undefined;
  return {
    key,
    consumerPermissions: permissionsArray(block),
    lookupEndpoint: stringValue(block, 'lookupEndpoint'),
    backendAction: stringValue(block, 'backendAction'),
    lookupFields: stringArray(block, 'lookupFields'),
    conditionalFields: conditional,
    scope: stringValue(block, 'scope'),
    required: /(?:^|\n)\s*required:\s*true/.test(block),
    messages: messagesObject(block),
    errorCodes: stringArray(block, 'errorCodes'),
  };
}

for (const key of unique(backendKeys)) {
  const backendContract = normalizedDependency(backendSource, key);
  const frontendContract = normalizedDependency(frontendSource, key);
  if (JSON.stringify(backendContract) !== JSON.stringify(frontendContract)) {
    throw new Error(`El contrato frontend/backend diverge en ${key}:\nBackend=${JSON.stringify(backendContract)}\nFrontend=${JSON.stringify(frontendContract)}`);
  }
}

const requiredStates = ['loading', 'ready', 'empty', 'forbidden', 'out_of_scope', 'error'];
for (const state of requiredStates) {
  if (!backendSource.includes(`'${state}'`) || !frontendSource.includes(`'${state}'`)) {
    throw new Error(`Falta el estado común de dependencia: ${state}`);
  }
}

// El saldo es una excepción documentada: el selector de pagos lo presenta
// para que el usuario pueda elegir y aplicar el monto correcto. Los demás
// campos son de contacto, identificación fiscal o costo y no pertenecen a
// un lookup operativo genérico.
const sensitiveFields = ['phone', 'email', 'address', 'costPrice', 'taxId', 'ruc'];
for (const field of sensitiveFields) {
  const lookupBlocks = [...backendSource.matchAll(new RegExp(`lookupFields: \\[([^\\]]*)\\]`, 'g'))].map((match) => match[1]);
  if (lookupBlocks.some((block) => new RegExp(`\\b${field}\\b`, 'i').test(block))) {
    throw new Error(`El catálogo central expone un campo sensible no permitido: ${field}`);
  }
}

console.log(JSON.stringify({ dependencies: backendKeys.length, states: requiredStates.length, valid: true }, null, 2));
