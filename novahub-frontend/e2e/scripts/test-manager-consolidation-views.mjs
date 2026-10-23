import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MANAGER_OPERATION_BY_SECTION,
  MANAGER_OPERATION_DEFINITIONS,
} from '../../src/app/components/manager/manager-operations.types.ts';

const backendServicePath = new URL('../../../../Backend/src/enterprise-groups/enterprise-groups.service.ts', import.meta.url);
const backendService = await readFile(backendServicePath, 'utf8');
const newlyAddedViews = {
  hotel: ['overview', 'rooms', 'calendar', 'reservations', 'stays'],
  'intl-imports': ['overview', 'origin', 'containers', 'customs'],
  asana: ['overview', 'boards', 'tasks'],
  notifications: ['overview', 'alerts', 'push'],
};

for (const definition of MANAGER_OPERATION_DEFINITIONS) {
  assert.equal(
    MANAGER_OPERATION_BY_SECTION[definition.id],
    definition.id,
    `Manager section ${definition.id} must route to its consolidated view`,
  );
}

for (const [module, expectedViews] of Object.entries(newlyAddedViews)) {
  const definition = MANAGER_OPERATION_DEFINITIONS.find((item) => item.id === module);
  assert.ok(definition, `Missing Manager definition for ${module}`);
  assert.deepEqual(definition.views.map(({ id }) => id), expectedViews, `${module} navigation views changed`);

  const escapedModule = module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const moduleContract = new RegExp(`(?:^|\\n)\\s*['\"]?${escapedModule}['\"]?: \\{[^\\n]*views: \\[([^\\]]*)\\]`, 'm');
  const match = backendService.match(moduleContract);
  assert.ok(match, `Backend Manager module contract is missing for ${module}`);
  const backendViews = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(([, view]) => view);
  assert.deepEqual(backendViews, expectedViews, `${module} frontend and backend views must match`);
}

console.log('Manager consolidation view routing and API contracts passed.');
