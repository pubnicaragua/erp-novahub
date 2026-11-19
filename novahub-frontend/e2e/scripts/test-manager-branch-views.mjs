import assert from 'node:assert/strict';
import {
  filterManagerBranchViewOptions,
  filterManagerBranchViewOptionsForScopes,
  managerBranchCanReadView,
} from '../../src/app/utils/managerBranchPermissions.ts';

const options = [
  { id: 'DASHBOARD', label: 'Dashboard', parent: 'DASHBOARD' },
  { id: 'SALES', label: 'Ventas', parent: 'SALES' },
  { id: 'SALES_CLIENTS', label: 'Clientes', parent: 'SALES' },
  { id: 'SALES_INVOICES', label: 'Facturas', parent: 'SALES' },
  { id: 'INVENTORY_PRODUCTS', label: 'Productos', parent: 'INVENTORY' },
  { id: 'CONFIG_USERS', label: 'Usuarios', parent: 'MY_COMPANY' },
];

assert.deepEqual(
  filterManagerBranchViewOptions(
    options,
    ['SALES', 'MY_COMPANY'],
    { SALES: { state: 'VISIBLE', viewIds: ['SALES_CLIENTS', 'SALES_INVOICES'] } },
    [{ SALES: ['SALES_CLIENTS'] }],
  ).map(({ id }) => id),
  ['SALES_CLIENTS'],
  'branch view choices must be active and satisfy every inherited view restriction',
);

assert.deepEqual(
  filterManagerBranchViewOptionsForScopes(
    options,
    ['SALES'],
    ['INVENTORY'],
    ['INVENTORY'],
  ).map(({ id }) => id),
  [],
  'a rubric or branch cannot expose modules that the enterprise group has not enabled',
);

assert.deepEqual(
  filterManagerBranchViewOptionsForScopes(
    options,
    ['DASHBOARD'],
    ['DASHBOARD'],
    ['DASHBOARD'],
    { DASHBOARD: { state: 'VISIBLE', viewIds: [] } },
  ).map(({ id }) => id),
  ['DASHBOARD'],
  'Dashboard is assignable only when it is enabled across the group, rubric, and branch scopes',
);

const selected = [{ module: 'SALES_CLIENTS', read: true }];
assert.equal(managerBranchCanReadView(selected, 'SALES_CLIENTS'), true);
assert.equal(managerBranchCanReadView(selected, 'SALES_INVOICES'), false);
assert.equal(managerBranchCanReadView(selected, 'SALES', ['SALES_CLIENTS']), true);

console.log('Manager branch view access checks passed.');
