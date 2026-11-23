import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

async function loadTypeScriptModule(relativePath) {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL(relativePath, import.meta.url))],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}

const { resolveTenantAdminIdentity } = await loadTypeScriptModule('../src/app/utils/tenantAdminIdentity.ts');
const { resolveCustomerDebtStatementInstallments } = await loadTypeScriptModule('../src/app/utils/customerDebtStatementRows.ts');
const { getPermissionActionKeys, hydratePermissionActions, serializePermissionActions } = await loadTypeScriptModule('../src/app/utils/permissions.ts');
const catalog = await readFile(new URL('../src/app/services/pdf-document-catalog.ts', import.meta.url), 'utf8');
const statementReport = await readFile(new URL('../src/app/utils/customerDebtStatementReport.ts', import.meta.url), 'utf8');

const adminIdentity = { role: 'admin', userType: 'admin', isPlatformAdmin: false, isPlatformSupportAgent: false };
assert.equal(resolveTenantAdminIdentity({ isTenantAdmin: true, clientTenantId: 'tenant-1' }, adminIdentity), true);
assert.equal(resolveTenantAdminIdentity({ isTenantAdmin: false, clientTenantId: 'tenant-1' }, adminIdentity), false);
assert.equal(resolveTenantAdminIdentity({ clientTenantId: 'tenant-1' }, adminIdentity), true, 'legacy sessions retain the previous role fallback');
assert.equal(resolveTenantAdminIdentity({ isTenantAdmin: true }, adminIdentity), false, 'tenantless accounts cannot become tenant admins');
assert.equal(resolveTenantAdminIdentity({ isTenantAdmin: true, clientTenantId: 'tenant-1' }, { ...adminIdentity, userType: 'manager' }), false);

const projectedRows = resolveCustomerDebtStatementInstallments({
  status: 'DRAFT',
  total: 2533.98,
  balance: 2533.98,
  principalAmount: 2533.98,
  planEnabled: true,
  planCalculationMode: 'AMOUNT',
  installmentAmount: 1000,
  frequency: 'WEEKLY',
  firstInstallmentDate: '2026-11-23',
});
assert.equal(projectedRows.length, 3);
assert.ok(projectedRows.every((row) => row.projected && row.status === 'PENDING'));
assert.ok(projectedRows.every((row) => Number(row.remainingAmount) === Number(row.totalAmount)));
assert.equal(Number(projectedRows.reduce((sum, row) => sum + Number(row.totalAmount), 0).toFixed(2)), 2533.98);

const draftSummary = resolveCustomerDebtStatementInstallments({ status: 'DRAFT', total: 2533.98, date: '2026-11-23' });
assert.equal(draftSummary.length, 1);
assert.equal(draftSummary[0].draftSummary, true);
assert.equal(draftSummary[0].totalAmount, 2533.98);

const persistedRows = [{ installmentNumber: 1, dueDate: '2026-12-01', totalAmount: 100, status: 'PAID' }];
assert.equal(resolveCustomerDebtStatementInstallments({ status: 'ISSUED', total: 100, installments: persistedRows }), persistedRows);

const creditPermission = hydratePermissionActions({ module: 'SALES_CREDIT_NOTES', read: true, issue: true }, 'SALES_CREDIT_NOTES');
assert.equal(getPermissionActionKeys('SALES_CREDIT_NOTES').includes('issue'), true);
assert.equal(creditPermission.issue, true);
assert.equal(serializePermissionActions([creditPermission])[0].issue, true);
assert.match(catalog, /key: 'ventas\.customer-debt-statement'[\s\S]*?label: 'Estado de cuenta de créditos'/);
assert.match(statementReport, /item\.projected[\s\S]*Se registrará al aprobar el crédito/);
assert.match(statementReport, /Borrador de \$\{String\(input\.documentLabel/);

console.log('Customer credit approval and draft statement checks passed.');
