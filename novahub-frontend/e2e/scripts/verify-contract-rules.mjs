import path from 'node:path';
import { pathToFileURL } from 'node:url';

const frontendRoot = process.cwd();
const catalogModule = await import(pathToFileURL(path.join(frontendRoot, 'e2e', 'module-catalog.ts')).href);
const contractsModule = await import(pathToFileURL(path.join(frontendRoot, 'e2e', 'module-contracts.ts')).href);
const catalog = catalogModule.E2E_MODULE_CATALOG;
const contracts = contractsModule.E2E_MODULE_CONTRACTS;
const requiredScenarios = [
  'happy-path',
  'validation-4xx',
  'permission-denied',
  'module-disabled',
  'cross-tenant',
  'branch-or-warehouse-scope',
  'idempotent-repeat',
  'transaction-rollback',
  'teardown',
];

const catalogIds = new Set(catalog.map((entry) => entry.id));
const contractIds = new Set(contracts.map((entry) => entry.moduleId));
if (catalogIds.size !== catalog.length) throw new Error('module-catalog.ts contiene IDs duplicados.');
if (contractIds.size !== contracts.length) throw new Error('module-contracts.ts contiene IDs duplicados.');
if (catalogIds.size !== contractIds.size || [...catalogIds].some((id) => !contractIds.has(id))) {
  throw new Error('El catálogo y los contratos no tienen las mismas superficies.');
}

for (const entry of catalog) {
  const contract = contracts.find((candidate) => candidate.moduleId === entry.id);
  if (!contract) throw new Error(`Falta contrato para ${entry.id}.`);
  for (const scenario of requiredScenarios) {
    if (!contract.scenarios.includes(scenario)) throw new Error(`${entry.id} no documenta ${scenario}.`);
  }
  if (entry.requiresPlatformRole && contract.scope !== 'platform') {
    throw new Error(`${entry.id} requiere rol de plataforma pero está declarado como ${contract.scope}.`);
  }
  if (!['ui-only', 'platform'].includes(contract.scope) && !contract.sourceController && !contract.apiProbe) {
    throw new Error(`${entry.id} no tiene controller ni probe declarado.`);
  }
}

console.log(JSON.stringify({ catalogEntries: catalog.length, contractEntries: contracts.length, requiredScenarios: requiredScenarios.length, valid: true }, null, 2));
