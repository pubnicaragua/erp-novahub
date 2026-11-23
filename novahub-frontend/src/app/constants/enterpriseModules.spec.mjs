import assert from 'node:assert/strict';
import {
  ENTERPRISE_MODULE_OPTIONS,
  getEffectiveBusinessUnitModules,
  getEnterpriseModulesAvailable,
  getEnterpriseModulesWithinScope,
  updateEnterpriseModuleSelection,
} from './enterpriseModules.ts';

assert.deepEqual(
  updateEnterpriseModuleSelection(['HR', 'HR_TRAINING', 'HR_PAYROLL', 'SALES'], 'HR', false),
  ['SALES'],
  'Desactivar Recursos Humanos también desactiva sus módulos hijos.',
);

assert.deepEqual(
  updateEnterpriseModuleSelection(['HR', 'HR_TRAINING', 'SALES'], 'HR_TRAINING', false),
  ['HR', 'SALES'],
  'Desactivar Capacitación conserva el módulo padre RH.',
);

assert.deepEqual(
  updateEnterpriseModuleSelection(['SALES'], 'HR_TRAINING', true),
  ['SALES', 'HR', 'HR_TRAINING'],
  'Activar una vista hija de RH también activa su módulo padre.',
);

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
