import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const frontendRoot = process.cwd();
const sidebarPath = path.join(frontendRoot, 'src', 'app', 'utils', 'sidebarPermissions.ts');
const permissionsPath = path.join(frontendRoot, 'src', 'app', 'utils', 'permissions.ts');
const sidebarSource = fs.readFileSync(path.join(frontendRoot, 'src', 'app', 'components', 'Sidebar.tsx'), 'utf8');
const backendRoot = path.resolve(frontendRoot, '..', '..', 'Backend', 'src');
const sidebar = await import(pathToFileURL(sidebarPath).href);
const permissions = await import(pathToFileURL(permissionsPath).href);

const hiddenIds = new Set(sidebar.HIDDEN_PERMISSION_MODULE_IDS);
const aliasIds = new Set([
  ...Object.keys(sidebar.LEGACY_VIEW_PERMISSION_ALIASES),
  ...Object.values(sidebar.LEGACY_VIEW_PERMISSION_ALIASES).flat(),
]);
const knownPermissionIds = new Set([
  ...sidebar.SIDEBAR_PERMISSION_PARENT_ORDER,
  ...sidebar.SIDEBAR_PERMISSION_MODULE_IDS,
  ...hiddenIds,
  ...aliasIds,
  // Reportes de suscripciones tienen una ruta protegida, pero no una vista
  // propia del ERP: se autorizan también mediante SUBSCRIPTIONS.
  'REPORTS_SUBSCRIPTIONS',
]);
const backendOnlyCompatibilityIds = new Set([
  'CONFIG_TENANCY',
  'CONFIG_COUNTRIES',
  'COMPANY_BRANCHES',
  'REPORTS_SUBSCRIPTIONS',
]);

const errors = [];
const normalize = (value) => String(value || '').trim().toUpperCase();
const submoduleCatalogIds = sidebar.PERMISSION_SUBMODULES.map(({ id }) => id);
const duplicateSubmoduleIds = submoduleCatalogIds.filter((id, index) => submoduleCatalogIds.indexOf(id) !== index);
if (duplicateSubmoduleIds.length > 0) {
  errors.push(`El catálogo contiene submódulos duplicados: ${[...new Set(duplicateSubmoduleIds)].join(', ')}`);
}

for (const parentId of sidebar.SIDEBAR_PERMISSION_PARENT_ORDER) {
  if (!permissions.supportsPermissionAction(parentId, 'read')) {
    errors.push(`${parentId} no tiene acción de lectura en permissions.ts`);
  }
}
for (const definition of sidebar.PERMISSION_SUBMODULES) {
  if (!permissions.supportsPermissionAction(definition.id, 'read')) {
    errors.push(`${definition.id} no tiene acción de lectura en permissions.ts`);
  }
}

for (const [surface, modules] of Object.entries(sidebar.SIDEBAR_SUBMENU_MODULE_REQUIREMENTS)) {
  for (const module of modules) {
    if (!knownPermissionIds.has(normalize(module))) {
      errors.push(`${surface} referencia el permiso inexistente ${module}`);
    }
  }
}

for (const [surface, modules] of Object.entries(sidebar.SIDEBAR_SUBMENU_PERMISSION_MODULES)) {
  for (const module of modules) {
    if (!knownPermissionIds.has(normalize(module))) {
      errors.push(`${surface} no tiene un permiso catalogado: ${module}`);
    }
  }
}

const sidebarMenuSource = sidebarSource.split('/** Orden canónico de módulos')[0];
const sidebarSubmoduleIds = [...sidebarMenuSource.matchAll(/^\s{6}\{\s*id:\s*'([^']+)'/gm)].map((match) => match[1]);
const requirementKeys = Object.keys(sidebar.SIDEBAR_SUBMENU_MODULE_REQUIREMENTS);
for (const submoduleId of new Set(sidebarSubmoduleIds)) {
  if (!requirementKeys.some((key) => key === submoduleId || key.endsWith(`:${submoduleId}`))) {
    errors.push(`La vista del sidebar ${submoduleId} no tiene requisito de suscripción`);
  }
}

const actionAliases = {
  view: 'read',
  write: 'edit',
  submit: 'approve',
  deactivate: 'delete',
  cancel: 'delete',
  reject: 'delete',
  reverse: 'delete',
  duplicate: 'create',
  download: 'export',
  print: 'export',
  authorize: 'approve',
  reopen: 'approve',
  close: 'approve',
  confirm: 'approve',
  process: 'approve',
  pay: 'approve',
  apply: 'approve',
  reconcile: 'approve',
  convert: 'approve',
  generate: 'approve',
  send: 'approve',
};

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolute);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

const canPerformPattern = /canPerform\(\s*(['"])([A-Z0-9_]+)\1\s*,\s*(['"])([A-Za-z]+)\3\s*\)/g;
for (const file of collectSourceFiles(path.join(frontendRoot, 'src', 'app'))) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(canPerformPattern)) {
    const module = normalize(match[2]);
    const requestedAction = match[4];
    const matrixAction = requestedAction === 'read' ? 'read' : actionAliases[requestedAction] || requestedAction;
    if (!knownPermissionIds.has(module)) {
      errors.push(`${path.relative(frontendRoot, file)} usa el permiso no catalogado ${module}`);
      continue;
    }
    if (!permissions.supportsPermissionAction(module, matrixAction)) {
      errors.push(`${path.relative(frontendRoot, file)} solicita ${module}:${requestedAction}, pero la matriz no lo ofrece`);
    }
  }
}

function collectBackendControllers(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectBackendControllers(absolute);
    return entry.name.endsWith('.controller.ts') ? [absolute] : [];
  });
}

const backendPermissionPattern = /@RequiresPermission\(\s*(?:(['"])([A-Z0-9_]+)\1|\[([^\]]*)\])\s*,\s*(['"])([A-Za-z]+)\4\s*\)/g;
let validatedBackendPermissionReferences = 0;
for (const file of collectBackendControllers(backendRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(backendPermissionPattern)) {
    const modules = match[2]
      ? [match[2]]
      : [...String(match[3] || '').matchAll(/['"]([A-Z0-9_]+)['"]/g)].map((item) => item[1]);
    const requestedAction = match[5];
    const matrixAction = requestedAction === 'read' ? 'read' : actionAliases[requestedAction] || requestedAction;
    for (const module of modules) {
      validatedBackendPermissionReferences += 1;
      if (!knownPermissionIds.has(module)) {
        errors.push(`${path.relative(frontendRoot, file)} usa el permiso no catalogado ${module}`);
        continue;
      }
      if (backendOnlyCompatibilityIds.has(module)) continue;
      if (!permissions.supportsPermissionAction(module, matrixAction)) {
        errors.push(`${path.relative(frontendRoot, file)} solicita ${module}:${requestedAction}, pero la matriz no lo ofrece`);
      }
    }
  }
}

if (errors.length > 0) {
  throw new Error(`Catálogo de permisos inválido:\n- ${errors.join('\n- ')}`);
}

console.log(JSON.stringify({
  parentModules: sidebar.SIDEBAR_PERMISSION_PARENT_ORDER.length,
  sidebarSubmodules: sidebar.SIDEBAR_PERMISSION_SUBMODULES.length,
  internalSubmodules: sidebar.INTERNAL_PERMISSION_SUBMODULES.length,
  catalogPermissionIds: sidebar.SIDEBAR_PERMISSION_MODULE_IDS.size,
  sidebarSubmenuIds: new Set(sidebarSubmoduleIds).size,
  validatedUiActionReferences: collectSourceFiles(path.join(frontendRoot, 'src', 'app'))
    .map((file) => fs.readFileSync(file, 'utf8').match(canPerformPattern)?.length || 0)
    .reduce((total, count) => total + count, 0),
  validatedBackendPermissionReferences,
  valid: true,
}, null, 2));
