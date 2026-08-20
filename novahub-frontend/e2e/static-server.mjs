import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.E2E_STATIC_PORT || 5173);
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

if (!existsSync(path.join(root, 'index.html'))) {
  throw new Error('No existe dist/index.html. Ejecuta npm run build antes del E2E estático.');
}

const server = createServer((request, response) => {
  const requestPath = decodeURIComponent((request.url || '/').split('?')[0]);
  const relativePath = requestPath.replace(/^\/+/, '');
  const candidate = path.resolve(root, relativePath || 'index.html');
  const safeCandidate = candidate.startsWith(root + path.sep) || candidate === root;
  const filePath = safeCandidate && existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : path.join(root, 'index.html');
  response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`E2E static server listening on http://127.0.0.1:${port}`);
});
