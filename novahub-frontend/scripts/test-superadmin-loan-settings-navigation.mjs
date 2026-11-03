import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformView = await readFile(new URL('../src/app/components/admin/EnterpriseGroupsAdminView.tsx', import.meta.url), 'utf8');
const branchSettingsView = await readFile(new URL('../src/app/components/admin/BranchModuleSettingsView.tsx', import.meta.url), 'utf8');

assert.match(platformView, /branch-modules/, 'SuperAdmin has a dedicated branch module settings tab');
assert.match(platformView, /Módulos y plan/, 'The platform tab is labeled Módulos y plan');
assert.match(platformView, /BranchModuleSettingsView/, 'The platform tab renders the focused branch settings view');
assert.doesNotMatch(platformView, /SuscripcionesPage/, 'The platform tab does not mount the full subscriptions management view');
assert.match(platformView, /tab !== 'branch-modules' \|\| Boolean\(user\?\.isPlatformAdmin\)/, 'Only platform administrators can open branch module settings');
assert.match(branchSettingsView, /Habilitar préstamos a clientes para \$\{tenant\.name\}/, 'The tenant list exposes the customer loan option');
assert.match(branchSettingsView, /subscriptionsService\.toggleModuleStatus/, 'The option is persisted through the existing subscription service');

console.log('superadmin customer loan settings navigation: focused tab and branch toggle are reachable');
