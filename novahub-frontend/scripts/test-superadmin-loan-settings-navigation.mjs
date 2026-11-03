import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const platformView = await readFile(new URL('../src/app/components/admin/EnterpriseGroupsAdminView.tsx', import.meta.url), 'utf8');
const subscriptionsView = await readFile(new URL('../src/app/components/SuscripcionesPage.tsx', import.meta.url), 'utf8');

assert.match(platformView, /branch-modules/, 'SuperAdmin has a dedicated branch module settings tab');
assert.match(platformView, /Módulos y plan/, 'The platform tab is labeled Módulos y plan');
assert.match(platformView, /SuscripcionesPage/, 'The platform tab renders the existing subscriptions management view');
assert.match(platformView, /embedded/, 'The existing view can be rendered inside the platform console');
assert.match(platformView, /tab !== 'branch-modules' \|\| Boolean\(user\?\.isPlatformAdmin\)/, 'Only platform administrators can open branch module settings');
assert.match(subscriptionsView, /Habilitar préstamos a clientes para \$\{tenant\.name\}/, 'The tenant list exposes the customer loan option');

console.log('superadmin customer loan settings navigation: tab and branch toggle are reachable');
