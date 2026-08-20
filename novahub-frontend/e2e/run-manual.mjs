import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 5173;
const baseUrl = `http://127.0.0.1:${port}`;

const waitForServer = async (timeoutMs = 120_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/register`);
      if (response.status < 500) return;
    } catch {
      // The Vite child can take a few seconds to bind the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`El frontend no respondió en ${baseUrl} dentro de ${timeoutMs / 1000}s.`);
};

const server = spawn(process.execPath, ['e2e/static-server.mjs'], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, E2E_STATIC_PORT: String(port) },
});

let runner;
try {
  await waitForServer();
  runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], {
    cwd,
    stdio: 'inherit',
    windowsHide: false,
    env: { ...process.env, E2E_MANUAL_SERVER: '1' },
  });
  const exitCode = await new Promise((resolve, reject) => {
    runner.once('error', reject);
    runner.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  process.exitCode = exitCode;
} finally {
  if (runner && !runner.killed) runner.kill();
  if (!server.killed) server.kill();
}
