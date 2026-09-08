import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseUrl = process.env.DATABASE_URL_E2E?.trim();
if (!databaseUrl || process.env.E2E_ALLOW_DATABASE_MUTATIONS !== '1' || process.env.E2E_ISOLATED_DATABASE !== '1') {
  console.error('Backend E2E bloqueado: requiere DATABASE_URL_E2E, E2E_ALLOW_DATABASE_MUTATIONS=1 y E2E_ISOLATED_DATABASE=1.');
  process.exit(1);
}
if (databaseUrl === process.env.DATABASE_URL?.trim()) {
  console.error('Backend E2E bloqueado: DATABASE_URL_E2E coincide con DATABASE_URL.');
  process.exit(1);
}
const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
const declaredDatabaseName = process.env.E2E_DATABASE_NAME?.trim();
if (!/(?:e2e|test|qa)/i.test(databaseName) && declaredDatabaseName !== databaseName) {
  console.error(`Backend E2E bloqueado: la base '${databaseName}' no parece aislada. Define E2E_DATABASE_NAME si corresponde.`);
  process.exit(1);
}

const backendDir = process.env.E2E_BACKEND_DIR?.trim() || path.resolve(process.cwd(), '..', '..', 'Backend');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const normalDatabaseUrl = process.env.DATABASE_URL?.trim() || '';
const e2eFrontendOrigin = process.env.E2E_BASE_URL?.trim()
  || `http://localhost:${process.env.E2E_FRONTEND_PORT || '5173'}`;
const childEnv = {
  ...process.env,
  E2E_BACKEND_DIR: backendDir,
  E2E_NORMAL_DATABASE_URL: normalDatabaseUrl,
  DATABASE_URL: databaseUrl,
  // Prisma 7 project config prefers DIRECT_URL when Backend/.env defines it.
  // Override it explicitly so the CLI cannot silently migrate the normal DB.
  DIRECT_URL: databaseUrl,
  FRONTEND_URL: e2eFrontendOrigin,
  NODE_ENV: 'test',
  PORT: process.env.E2E_BACKEND_PORT || '3310',
  SENTRY_DSN: '',
};

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const schemaMode = process.env.E2E_SCHEMA_MODE || 'migrations';
if (schemaMode === 'datamodel') {
  const provision = spawnSync(process.execPath, [path.join(e2eDir, 'provision-isolated-db.mjs')], {
    cwd: backendDir,
    env: childEnv,
    stdio: 'inherit',
    shell: false,
  });
  if (provision.status !== 0) process.exit(provision.status || 1);
} else {
  const status = spawnSync(npxCommand, ['prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma'], {
    cwd: backendDir,
    env: childEnv,
    stdio: 'inherit',
    shell: false,
  });
  if (status.status !== 0) process.exit(status.status || 1);

  const deploy = spawnSync(npxCommand, ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'], {
    cwd: backendDir,
    env: childEnv,
    stdio: 'inherit',
    shell: false,
  });
  if (deploy.status !== 0) process.exit(deploy.status || 1);
}

const child = spawn(npmCommand, ['run', 'start:dev'], {
  cwd: backendDir,
  env: childEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const shutdown = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
