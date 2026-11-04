import assert from 'node:assert/strict';
import { getCustomerLoanMoraActions } from '../src/app/utils/customer-loan-permissions.ts';

assert.deepEqual(
  getCustomerLoanMoraActions(true, false),
  { canOpenCatalog: true, canCreateType: true, canEditTypes: false },
  'create-only users can add mora types but cannot edit existing ones',
);
assert.deepEqual(
  getCustomerLoanMoraActions(false, true),
  { canOpenCatalog: true, canCreateType: false, canEditTypes: true },
  'edit-only users can edit mora types but cannot add new ones',
);
assert.deepEqual(
  getCustomerLoanMoraActions(true, true),
  { canOpenCatalog: true, canCreateType: true, canEditTypes: true },
  'users with both permissions can create and edit mora types',
);
assert.deepEqual(
  getCustomerLoanMoraActions(false, false),
  { canOpenCatalog: false, canCreateType: false, canEditTypes: false },
  'read-only users cannot open mora catalog management actions',
);

console.log('Customer loan permission scenarios passed.');
