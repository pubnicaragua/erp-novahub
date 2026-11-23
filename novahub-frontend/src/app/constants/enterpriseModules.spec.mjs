import assert from 'node:assert/strict';
import {
  ENTERPRISE_MODULE_OPTIONS,
  getEffectiveBusinessUnitModules,
  getEnterpriseModulesAvailable,
  getEnterpriseModulesWithinScope,
  isEnterpriseModuleInFamily,
  isEnterpriseModuleRoot,
  updateEnterpriseModuleSelection,
} from './enterpriseModules.ts';

assert.deepEqual(
  updateEnterpriseModuleSelection(['HR', 'HR_TRAINING', 'HR_PAYROLL', 'SALES'], 'HR', false),
  ['HR_TRAINING', 'SALES'],
  'Desactivar Recursos Humanos desactiva sus vistas hijas y conserva raíces independientes.',
);

assert.deepEqual(
  updateEnterpriseModuleSelection(['HR', 'HR_TRAINING', 'SALES'], 'HR_TRAINING', false),
  ['HR', 'SALES'],
  'Desactivar Capacitación conserva el módulo padre RH.',
);

assert.deepEqual(
  updateEnterpriseModuleSelection(['SALES'], 'HR_TRAINING', true),
  ['SALES', 'HR_TRAINING'],
  'Activar Centro de capacitación no activa Recursos Humanos.',
);

assert.deepEqual(
  updateEnterpriseModuleSelection(['SALES', 'SALES_CLIENTS', 'SALES_VOICE_QUICK'], 'SALES', false),
  ['SALES_VOICE_QUICK'],
  'Desactivar Ventas no desactiva otro módulo raíz con prefijo similar.',
);

for (const module of ENTERPRISE_MODULE_OPTIONS) {
  for (const family of ENTERPRISE_MODULE_OPTIONS) {
    if (module.id !== family.id) {
      assert.equal(
        isEnterpriseModuleInFamily(module.id, family.id),
        false,
        `${module.id} must remain independent from root ${family.id}.`,
      );
    }
  }
  const otherModules = ENTERPRISE_MODULE_OPTIONS
    .filter(({ id }) => id !== module.id)
    .slice(0, 3)
    .map(({ id }) => id);
  assert.deepEqual(
    updateEnterpriseModuleSelection(otherModules, module.id, true),
    [...otherModules, module.id],
    `Activar ${module.id} no debe activar otro módulo raíz.`,
  );
}

assert.equal(isEnterpriseModuleInFamily('SALES_CLIENTS', 'SALES'), true);
assert.equal(isEnterpriseModuleInFamily('HR_TRAINING', 'HR'), false);
assert.equal(isEnterpriseModuleInFamily('SALES_VOICE_QUICK', 'SALES'), false);
assert.equal(isEnterpriseModuleRoot('HR_TRAINING'), true);

assert.equal(
  getEnterpriseModulesAvailable(undefined).length,
  ENTERPRISE_MODULE_OPTIONS.length,
  'Una selección sin límite explícito muestra el catálogo completo.',
);
assert.deepEqual(
  getEnterpriseModulesAvailable([]),
  [],
  'Un alcance explícitamente vacío no habilita opciones del catálogo.',
);
for (const module of ENTERPRISE_MODULE_OPTIONS) {
  assert.deepEqual(
    getEnterpriseModulesAvailable([module.id.toLowerCase()]).map(({ id }) => id),
    [module.id],
    `El selector respeta el alcance para ${module.id}.`,
  );
}

assert.deepEqual(
  getEffectiveBusinessUnitModules([], ['SALES', 'HR']),
  ['SALES', 'HR'],
  'Un rubro sin selección propia hereda todos los módulos habilitados por el grupo.',
);
assert.deepEqual(
  getEffectiveBusinessUnitModules(['sales', 'DASHBOARD', 'UNKNOWN'], ['SALES', 'HR']),
  ['SALES'],
  'La selección del rubro queda limitada a los módulos del grupo.',
);
assert.deepEqual(
  getEffectiveBusinessUnitModules([], []),
  [],
  'Un alcance superior vacío permanece vacío.',
);
assert.deepEqual(
  getEnterpriseModulesWithinScope(['sales', 'SALES', 'UNKNOWN'], ['SALES']),
  ['SALES'],
  'Las selecciones guardadas se normalizan y se limitan al alcance visible.',
);
assert.deepEqual(
  getEnterpriseModulesWithinScope(ENTERPRISE_MODULE_OPTIONS.map(({ id }) => id), ENTERPRISE_MODULE_OPTIONS.map(({ id }) => id)),
  ENTERPRISE_MODULE_OPTIONS.map(({ id }) => id),
  'Los 29 módulos del catálogo se pueden seleccionar y conservar.',
);
assert.deepEqual(
  getEnterpriseModulesWithinScope([], ['SALES']),
  [],
  'Una sucursal personalizada conserva una selección vacía.',
);
