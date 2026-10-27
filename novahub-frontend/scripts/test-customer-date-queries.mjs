import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../src/app/components/VentasPage.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('VentasPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node);
  ts.forEachChild(node, visit);
}
visit(ast);
const configs = [];
const calls = [];
const dates = { dateFrom: '2026-10-01', dateTo: '2026-10-27' };
const context = {
  tenantKey: 'tenant-1', customersPage: { page: 3, pageSize: 50 }, customersDates: dates,
  searchFor: () => 'Ana', canViewSalesSection: () => true, activeSection: 'clientes',
  keepPreviousData: (value) => value, useQuery: (config) => configs.push(config),
  customersService: { getAll: (filters, signal) => { calls.push({ filters, signal }); return []; } },
  fetchAllReportPages: (fetch, filters) => fetch(filters),
};
vm.createContext(context);
for (const name of ['customersListQuery', 'customersSummaryQuery']) {
  const declaration = declarations.get(name);
  assert.ok(declaration, `Missing customer query ${name}`);
  vm.runInContext(ts.transpileModule(`const ${declaration.getText(ast)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
}
for (const config of configs) {
  assert.ok(config.queryKey.includes(dates.dateFrom), 'Range start must isolate cached customer results');
  assert.ok(config.queryKey.includes(dates.dateTo), 'Range end must isolate cached customer results');
  const signal = new AbortController().signal;
  await config.queryFn({ signal });
  const call = calls.at(-1);
  assert.equal(call.filters.dateFrom, dates.dateFrom);
  assert.equal(call.filters.dateTo, dates.dateTo);
  assert.equal(call.filters.search, 'Ana');
  assert.equal(call.signal, signal);
}
const updates = [];
context.setDateFilters = (update) => updates.push(update({ facturas: { dateFrom: '', dateTo: '' } }));
context.updatePage = (...args) => updates.push(args);
vm.runInContext(ts.transpileModule(`const ${declarations.get('updateDateRange').getText(ast)}; updateDateRange('clientes', '2026-10-01', '2026-10-27');`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
assert.deepEqual(Array.from(updates[1]), ['clientes', 1], 'Changing range resets customer pagination');
assert.equal(updates[0].clientes.dateTo, dates.dateTo);
console.log('PASS customer list and full summary propagate range, cache scope, search, cancellation, and reset page');
