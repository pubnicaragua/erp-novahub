import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
const here = dirname(fileURLToPath(import.meta.url));
const componentPath = resolve(here, '../src/app/components/admin/EnterpriseGroupSetupView.tsx');
const source = readFileSync(componentPath, 'utf8');
const servicePath = resolve(here, '../src/app/services/enterprise-groups.service.ts');
const service = readFileSync(servicePath, 'utf8');

test('integration settings are destination-grouped and restricted to Super Admin', () => {
  assert.match(source, /Conexiones entre módulos/);
  assert.match(source, /id: "SALES_TO_ACCOUNTING"/);
  assert.match(source, /id: "SALES_TO_FINANCE"/);
  assert.match(source, /user\?\.role !== "superadmin"/);
  assert.match(source, /Automática según módulos habilitados/);
  assert.match(source, /Falta habilitar Ventas para el grupo/);
  assert.match(service, /\/integration-policies/);
  assert.match(service, /\/branches\/\$\{branchId\}\/integration-policies/);
  assert.doesNotMatch(source, /Conexiones de Ventas/);
});

test('rubro and branch overrides use inherited, forced, and disconnected states', () => {
  assert.match(source, /function IntegrationPolicyOverrideFields/);
  assert.match(source, /Heredar de \$\{parentLabel\}/);
  assert.match(source, /Forzar conexión/);
  assert.match(source, /Desconectar/);
  assert.match(service, /business-units\/\$\{unitId\}\/integration-policies/);
  assert.match(service, /branches\/\$\{branchId\}\/integration-policies/);
});
