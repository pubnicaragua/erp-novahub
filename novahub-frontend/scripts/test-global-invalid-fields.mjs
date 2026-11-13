import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const styles = readFileSync(join(root, 'src/styles/index.css'), 'utf8');

test('global styles visibly flag user-invalid native controls and accessible invalid state', () => {
  assert.match(styles, /:user-invalid/);
  assert.match(styles, /aria-invalid\s*=\s*['"]true['"]/);
  assert.match(styles, /var\(--destructive\)/);
});

test('required controls are not marked red before the user validates them', () => {
  assert.doesNotMatch(styles, /\[required\][^{]*\{[^}]*border-color\s*:\s*var\(--destructive\)/s);
});
