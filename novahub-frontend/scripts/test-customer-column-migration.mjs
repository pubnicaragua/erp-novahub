import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual pure migration in isolation from this large view's UI imports.
const source = fs.readFileSync(new URL('../src/app/components/ventas/ClientesView.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('ClientesView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const migration = ast.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'migrateCustomerColumnKeys');
assert.ok(migration, 'Customer column preferences need a one-time createdAt migration');
const context = {};
vm.createContext(context);
vm.runInContext(ts.transpileModule(migration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
const migrate = context.migrateCustomerColumnKeys;
const legacy = ['name', 'status', 'code'];
assert.deepEqual(Array.from(migrate(legacy)), ['name', 'status', 'code', 'createdAt']);
assert.deepEqual(legacy, ['name', 'status', 'code'], 'Never mutate saved preferences');
assert.deepEqual(Array.from(migrate(['name', 'createdAt', 'status'])), ['name', 'createdAt', 'status']);
assert.deepEqual(Array.from(migrate({ version: 1, keys: ['name', 'status'] })), ['name', 'status'], 'Hiding the new column after migration survives reload');
assert.deepEqual(Array.from(migrate([])), ['createdAt']);
console.log('PASS customer column migration: preserves order, adds once, and respects later hiding');
