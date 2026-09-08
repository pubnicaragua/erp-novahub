import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = process.cwd();
const contractsPath = path.join(frontendRoot, 'e2e', 'module-contracts.ts');
const schemaPath = path.resolve(frontendRoot, '..', '..', 'Backend', 'prisma', 'schema.prisma');
const contractsSource = fs.readFileSync(contractsPath, 'utf8');
const schemaSource = fs.readFileSync(schemaPath, 'utf8');

const referencedModels = new Set();
for (const match of contractsSource.matchAll(/persistenceModels:\s*\[([^\]]*)\]/g)) {
  for (const model of match[1].matchAll(/'([^']+)'/g)) referencedModels.add(model[1]);
}

const prismaModels = new Set(
  [...schemaSource.matchAll(/^model\s+([A-Z][A-Za-z0-9_]*)\s*\{/gm)].map((match) => match[1]),
);
const missingModels = [...referencedModels].filter((model) => !prismaModels.has(model));
if (missingModels.length > 0) {
  throw new Error(`Modelos Prisma declarados pero inexistentes: ${missingModels.join(', ')}`);
}

console.log(JSON.stringify({
  referencedModels: referencedModels.size,
  prismaModels: prismaModels.size,
  missingModels: 0,
}, null, 2));
