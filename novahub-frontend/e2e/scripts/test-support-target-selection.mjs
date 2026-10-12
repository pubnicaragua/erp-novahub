import assert from 'node:assert/strict';
import {
  isSupportTargetChecked,
  isSupportTargetInherited,
  isSupportTargetPartiallySelected,
  toggleSupportTargetSelection,
} from '../../src/app/components/help/support-target-selection.ts';

const tree = [
  {
    id: 'g1', name: 'Grupo Norte', selectable: false,
    businessUnits: [
      { id: 'u1', name: 'General', selectable: true, branches: [
        { id: 'b1', name: 'Central', selectable: true },
        { id: 'b2', name: 'Aeropuerto', selectable: true },
      ] },
      { id: 'u2', name: 'Restaurantes', selectable: false, branches: [
        { id: 'b3', name: 'Estadio', selectable: false },
      ] },
    ],
    branches: [],
  },
  {
    id: 'g2', name: 'Grupo Sur', selectable: true,
    businessUnits: [{ id: 'u3', name: 'Servicios', selectable: true, branches: [
      { id: 'b4', name: 'Puerto', selectable: true },
    ] }],
    branches: [],
  },
];

const scope = (type, id) => ({ type, id });
const ids = (scopes) => scopes.map(({ type, id }) => `${type}:${id}`).sort();

let selected = toggleSupportTargetSelection([], scope('BUSINESS_UNIT', 'u1'), tree);
assert.deepEqual(ids(selected), ['BUSINESS_UNIT:u1']);
assert.equal(isSupportTargetChecked(selected, scope('BRANCH', 'b1'), tree), true);
assert.equal(isSupportTargetInherited(selected, scope('BRANCH', 'b1'), tree), true);
assert.deepEqual(toggleSupportTargetSelection(selected, scope('BRANCH', 'b1'), tree), selected, 'un rubro incluye sus sucursales');
assert.deepEqual(toggleSupportTargetSelection(selected, scope('GROUP', 'g1'), tree), selected, 'un grupo de contexto no es seleccionable');

selected = toggleSupportTargetSelection(selected, scope('BUSINESS_UNIT', 'u1'), tree);
assert.deepEqual(selected, [], 'quitar el rubro libera la selección de sus sucursales');

selected = toggleSupportTargetSelection(selected, scope('BRANCH', 'b1'), tree);
selected = toggleSupportTargetSelection(selected, scope('BRANCH', 'b2'), tree);
assert.deepEqual(ids(selected), ['BRANCH:b1', 'BRANCH:b2'], 'seleccionar todas las sucursales conserva el destino explícito');
assert.equal(isSupportTargetPartiallySelected(selected, scope('BUSINESS_UNIT', 'u1'), tree), true);
assert.equal(isSupportTargetPartiallySelected(selected, scope('GROUP', 'g1'), tree), true);

selected = toggleSupportTargetSelection(selected, scope('BUSINESS_UNIT', 'u1'), tree);
assert.deepEqual(ids(selected), ['BUSINESS_UNIT:u1'], 'promover sucursales a rubro evita destinos duplicados');

selected = toggleSupportTargetSelection(selected, scope('GROUP', 'g2'), tree);
assert.deepEqual(ids(selected), ['BUSINESS_UNIT:u1', 'GROUP:g2']);
assert.equal(isSupportTargetChecked(selected, scope('BRANCH', 'b4'), tree), true);
selected = toggleSupportTargetSelection(selected, scope('GROUP', 'g2'), tree);
assert.deepEqual(ids(selected), ['BUSINESS_UNIT:u1'], 'quitar el grupo elimina su cobertura heredada');

console.log('OK: destinos de grupo, rubro y sucursal con herencia y consolidación explícita.');
