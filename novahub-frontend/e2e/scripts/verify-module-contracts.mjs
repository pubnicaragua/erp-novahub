import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const appSource = fs.readFileSync(path.join(frontendRoot, 'src', 'app', 'App.tsx'), 'utf8');
const sidebarSource = fs.readFileSync(path.join(frontendRoot, 'src', 'app', 'components', 'Sidebar.tsx'), 'utf8');
const catalogSource = fs.readFileSync(path.join(frontendRoot, 'e2e', 'module-catalog.ts'), 'utf8');
const contractsSource = fs.readFileSync(path.join(frontendRoot, 'e2e', 'module-contracts.ts'), 'utf8');
const backendRoot = path.resolve(frontendRoot, '..', '..', 'Backend', 'src');

const catalogIds = [...catalogSource.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
const appCaseIds = [...appSource.matchAll(/case\s+'([^']+)'/g)].map((match) => match[1]);
const sidebarIds = [...sidebarSource.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1]);
const controllerFiles = [...contractsSource.matchAll(/sourceController:\s*'([^']+)'/g)].map((match) => match[1]);

const backendControllerFiles = [];
function collectBackendControllers(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collectBackendControllers(absolute);
    else if (/\.controller\.ts$/.test(entry.name)) backendControllerFiles.push(absolute);
  }
}
collectBackendControllers(backendRoot);

const backendRouteDecorators = backendControllerFiles.reduce((total, file) => {
  const source = fs.readFileSync(file, 'utf8');
  return total + [...source.matchAll(/@(Get|Post|Patch|Put|Delete)\s*\(/g)].length;
}, 0);

const duplicateIds = catalogIds.filter((id, index) => catalogIds.indexOf(id) !== index);
if (duplicateIds.length > 0) throw new Error(`IDs duplicados en module-catalog.ts: ${duplicateIds.join(', ')}`);

const missingUiAnchors = catalogIds.filter((id) => id !== 'overview' && !appCaseIds.includes(id) && !sidebarIds.includes(id));
if (missingUiAnchors.length > 0) throw new Error(`Superficies sin ancla en App.tsx/Sidebar.tsx: ${missingUiAnchors.join(', ')}`);

const missingControllers = [...new Set(controllerFiles)].filter((file) => !fs.existsSync(path.join(backendRoot, file)));
if (missingControllers.length > 0) throw new Error(`Controllers declarados pero inexistentes: ${missingControllers.join(', ')}`);

const e2eFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) e2eFiles.push(absolute);
  }
}
collect(path.join(frontendRoot, 'e2e'));
const fixedWaitFiles = e2eFiles
  .filter((file) => !file.endsWith('verify-module-contracts.mjs'))
  .filter((file) => fs.readFileSync(file, 'utf8').includes(['waitFor', 'Timeout'].join('')));
const fixedWaitToken = ['waitFor', 'Timeout'].join('');
if (fixedWaitFiles.length > 0) throw new Error(`Se encontró page.${fixedWaitToken} en: ${fixedWaitFiles.join(', ')}`);

console.log(JSON.stringify({
  catalogEntries: catalogIds.length,
  appCases: new Set(appCaseIds).size,
  sidebarIds: new Set(sidebarIds).size,
  backendControllers: backendControllerFiles.length,
  backendRouteDecorators,
  controllersVerified: new Set(controllerFiles).size,
  controllersNotMappedToUiContract: backendControllerFiles.length - new Set(controllerFiles).size,
  fixedWaits: 0,
}, null, 2));
