import assert from 'node:assert/strict';
import { updateEnterpriseModuleSelection } from './enterpriseModules.ts';

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
