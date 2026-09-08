import { test, expect } from '@playwright/test';
import { E2E_MODULE_CATALOG } from '../module-catalog';
import { E2E_MODULE_CONTRACTS } from '../module-contracts';

test.describe('NovaHub ERP — catálogo de contratos de módulos', () => {
  test('cada superficie renderizada tiene contrato de alcance e invariantes', () => {
    const moduleIds = E2E_MODULE_CATALOG.map((module) => module.id);
    const contractIds = E2E_MODULE_CONTRACTS.map((contract) => contract.moduleId);
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
    expect(new Set(contractIds).size).toBe(contractIds.length);
    expect(contractIds.sort()).toEqual(moduleIds.sort());

    for (const contract of E2E_MODULE_CONTRACTS) {
      const catalogEntry = E2E_MODULE_CATALOG.find((module) => module.id === contract.moduleId);
      expect(catalogEntry, `Falta la entrada de UI para ${contract.moduleId}`).toBeDefined();
      expect(contract.scenarios).toContain('happy-path');
      expect(contract.scenarios).toContain('validation-4xx');
      expect(contract.scenarios).toContain('permission-denied');
      expect(contract.scenarios).toContain('module-disabled');
      expect(contract.scenarios).toContain('cross-tenant');
      for (const scenario of [
        'branch-or-warehouse-scope',
        'idempotent-repeat',
        'transaction-rollback',
        'teardown',
      ] as const) {
        expect(contract.scenarios, `${contract.moduleId} no documenta ${scenario}`).toContain(scenario);
      }
      if (catalogEntry?.requiresPlatformRole) {
        expect(contract.scope, `${contract.moduleId} requiere rol de plataforma`).toBe('platform');
      }
      // Schema/guía son superficies de plataforma deliberadamente UI-only:
      // validan autorización de ruta y shell, pero no poseen controlador ni
      // persistencia propia que debamos inventar para satisfacer el catálogo.
      if (contract.scope !== 'ui-only' && contract.persistenceModels.length > 0) {
        expect(contract.sourceController || contract.apiProbe).toBeTruthy();
      }
    }
  });
});
