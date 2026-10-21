import assert from 'node:assert/strict';
import { test } from 'node:test';
import { managerPermissionActionsFor, managerPermissionsToState, managerStateToPermissions } from './managerPermissions.ts';

test('Manager inventory approval is a separate capability with a legacy edit fallback', () => {
  const actions = managerPermissionActionsFor('MANAGER_INVENTORY').map(({ key }) => key);
  assert.equal(actions.includes('approve' as any), true);

  const legacy = managerPermissionsToState([{ module: 'MANAGER_INVENTORY', read: true, edit: true }]);
  assert.equal((legacy.MANAGER_INVENTORY as any).approve, true);

  const [saved] = managerStateToPermissions({
    ...legacy,
    MANAGER_INVENTORY: { ...legacy.MANAGER_INVENTORY, approve: false } as any,
  });
  assert.equal(saved.approve, false);
});
