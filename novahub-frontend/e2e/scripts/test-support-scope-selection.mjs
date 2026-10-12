import assert from 'node:assert/strict';
import {
  filterSupportScopeTree,
  isSupportScopeChecked,
  isSupportScopeInherited,
  toggleSupportScope,
} from '../../src/app/components/admin/support-scope-selection.ts';

const tree = [
  {
    id: 'g1', name: 'Grupo Norte',
    businessUnits: [
      { id: 'u1', name: 'General' },
      { id: 'u2', name: 'Restaurantes Café' },
    ],
    branches: [
      { id: 'b1', name: 'Central', businessUnitId: 'u1' },
      { id: 'b2', name: 'Aeropuerto', businessUnitId: 'u1' },
      { id: 'b3', name: 'Estadio', businessUnitId: 'u2' },
      { id: 'b4', name: 'Bodega', businessUnitId: '' },
    ],
  },
  {
    id: 'g2', name: 'Grupo Sur',
    businessUnits: [{ id: 'u3', name: 'Servicios' }],
    branches: [{ id: 'b5', name: 'Puerto', businessUnitId: 'u3' }],
  },
  {
    id: 'g3', name: 'Grupo Centro',
    businessUnits: [{ id: 'u4', name: 'Tiendas' }, { id: 'u5', name: 'Cafeterías' }],
    branches: [{ id: 'b6', name: 'Tienda Uno', businessUnitId: 'u4' }, { id: 'b7', name: 'Café Uno', businessUnitId: 'u5' }],
  },
];

const scope = (type, id) => ({ type, id });
const ids = (scopes) => scopes.map(({ type, id }) => `${type}:${id}`).sort();

let selected = toggleSupportScope([], scope('BRANCH', 'b1'), tree);
assert.deepEqual(ids(selected), ['BRANCH:b1'], 'una sucursal conserva alcance exacto');
assert.equal(isSupportScopeChecked(selected, scope('BRANCH', 'b1'), tree), true);
assert.equal(isSupportScopeInherited(selected, scope('BUSINESS_UNIT', 'u1'), tree), false);

const directUnit = toggleSupportScope([], scope('BUSINESS_UNIT', 'u2'), tree);
assert.deepEqual(ids(directUnit), ['BUSINESS_UNIT:u2'], 'seleccionar un rubro conserva el alcance padre');
assert.equal(isSupportScopeChecked(directUnit, scope('BRANCH', 'b3'), tree), true, 'el rubro hereda sus sucursales');
assert.equal(isSupportScopeInherited(directUnit, scope('BRANCH', 'b3'), tree), true);
assert.deepEqual(toggleSupportScope(directUnit, scope('BRANCH', 'b3'), tree), directUnit, 'no permite excepciones en un rubro');

const directGroup = toggleSupportScope([], scope('GROUP', 'g1'), tree);
assert.deepEqual(ids(directGroup), ['GROUP:g1'], 'seleccionar un grupo conserva el alcance padre');
assert.equal(isSupportScopeChecked(directGroup, scope('BRANCH', 'b3'), tree), true, 'el grupo hereda todos sus descendientes');

const singleBranchUnit = toggleSupportScope([], scope('BRANCH', 'b5'), tree);
assert.deepEqual(ids(singleBranchUnit), ['BRANCH:b5'], 'una sola sucursal no amplía el acceso al rubro o grupo');
assert.equal(isSupportScopeInherited(singleBranchUnit, scope('BUSINESS_UNIT', 'u3'), tree), false);

let allGroupBranches = toggleSupportScope([], scope('BRANCH', 'b6'), tree);
allGroupBranches = toggleSupportScope(allGroupBranches, scope('BRANCH', 'b7'), tree);
assert.deepEqual(ids(allGroupBranches), ['GROUP:g3'], 'seleccionar todas las sucursales de un grupo las consolida en el grupo');

selected = toggleSupportScope(selected, scope('BRANCH', 'b2'), tree);
assert.deepEqual(ids(selected), ['BUSINESS_UNIT:u1'], 'todas las sucursales consolidan el rubro');
assert.equal(isSupportScopeChecked(selected, scope('BRANCH', 'b1'), tree), true);
assert.equal(isSupportScopeInherited(selected, scope('BRANCH', 'b1'), tree), true);
assert.deepEqual(toggleSupportScope(selected, scope('BRANCH', 'b1'), tree), selected, 'un descendiente heredado no admite excepciones');

selected = toggleSupportScope(selected, scope('BUSINESS_UNIT', 'u2'), tree);
selected = toggleSupportScope(selected, scope('BRANCH', 'b4'), tree);
assert.deepEqual(ids(selected), ['GROUP:g1'], 'completar todos los hijos consolida el grupo');
assert.equal(isSupportScopeInherited(selected, scope('BUSINESS_UNIT', 'u2'), tree), true);
selected = toggleSupportScope(selected, scope('GROUP', 'g1'), tree);
assert.deepEqual(selected, [], 'quitar el grupo libera todos sus descendientes');

const branchSearch = filterSupportScopeTree(tree, 'central');
assert.deepEqual(branchSearch.map(({ id }) => id), ['g1'], 'la búsqueda conserva el grupo antecesor');
assert.deepEqual(branchSearch[0].businessUnits.map(({ id }) => id), ['u1']);
assert.deepEqual(branchSearch[0].branches.map(({ id }) => id), ['b1']);

const unitSearch = filterSupportScopeTree(tree, 'general');
assert.deepEqual(unitSearch[0].branches.map(({ id }) => id), ['b1', 'b2'], 'coincidir el rubro muestra sus sucursales');
assert.deepEqual(filterSupportScopeTree(tree, 'cafe')[0].businessUnits.map(({ id }) => id), ['u2'], 'la búsqueda ignora diferencias de acentos');
const groupSearch = filterSupportScopeTree(tree, 'grupo norte');
assert.equal(groupSearch[0].branches.length, 4, 'coincidir el grupo muestra su árbol completo');
assert.equal(filterSupportScopeTree(tree, 'inexistente').length, 0, 'una búsqueda sin coincidencias muestra estado vacío');

const onlySelected = filterSupportScopeTree(tree, '', { scopes: [scope('BRANCH', 'b2')], onlySelected: true });
assert.deepEqual(onlySelected.map(({ id }) => id), ['g1'], 'solo seleccionados conserva antecesores');
assert.deepEqual(onlySelected[0].businessUnits.map(({ id }) => id), ['u1']);
assert.deepEqual(onlySelected[0].branches.map(({ id }) => id), ['b2']);

console.log('OK: selección jerárquica, consolidación, herencia, búsqueda y selección visible.');
