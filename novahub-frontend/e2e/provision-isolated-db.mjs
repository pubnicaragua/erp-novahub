import { createRequire } from 'node:module';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const databaseUrl = process.env.DATABASE_URL_E2E?.trim();
if (!databaseUrl || process.env.E2E_ALLOW_DATABASE_MUTATIONS !== '1' || process.env.E2E_ISOLATED_DATABASE !== '1') {
  throw new Error('La provisión E2E requiere DATABASE_URL_E2E, E2E_ALLOW_DATABASE_MUTATIONS=1 y E2E_ISOLATED_DATABASE=1.');
}

const normalUrl = process.env.E2E_NORMAL_DATABASE_URL?.trim();
if (normalUrl && normalUrl === databaseUrl) {
  throw new Error('La provisión E2E rechazó una URL igual a DATABASE_URL.');
}

const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
const declaredDatabaseName = process.env.E2E_DATABASE_NAME?.trim();
if (!/(?:e2e|test|qa)/i.test(databaseName) && declaredDatabaseName !== databaseName) {
  throw new Error(`La base '${databaseName}' no parece aislada.`);
}

const backendDir = process.env.E2E_BACKEND_DIR?.trim() || path.resolve(process.cwd(), '..', '..', 'Backend');
const requireBackend = createRequire(import.meta.url);
const { Pool } = requireBackend(path.join(backendDir, 'node_modules', 'pg'));
const pool = new Pool({ connectionString: databaseUrl, max: 1 });

function prismaCli() {
  const localScript = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
  return fs.existsSync(localScript)
    ? { command: process.execPath, args: [localScript] }
    : { command: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['prisma'] };
}

async function main() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT to_regclass('public."ClientTenant"') AS table_name`,
    );
    if (result.rows[0]?.table_name) {
      console.log('[e2e:schema] El schema del database aislado ya existe; no se recrea.');
      return;
    }

    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
    };
    const prisma = prismaCli();
    const diff = spawnSync(
      prisma.command,
      [...prisma.args, 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'],
      { cwd: backendDir, env, encoding: 'utf8', shell: false },
    );
    if (diff.status !== 0) {
      throw new Error(`No se pudo generar el DDL desde Prisma:\n${diff.error?.message || diff.stderr || diff.stdout}`);
    }
    const marker = diff.stdout.indexOf('-- CreateSchema');
    const sql = marker >= 0 ? diff.stdout.slice(marker) : diff.stdout;
    if (!sql.includes('CREATE TABLE')) throw new Error('El DDL generado no contiene tablas Prisma.');

    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('[e2e:schema] Schema aislado creado desde el datamodel Prisma.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
