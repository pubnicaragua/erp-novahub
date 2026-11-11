// Prueba del detector: debe marcar los usos que revientan al armar la pantalla y NO marcar los diferidos.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findUseBeforeInit } from './check-use-before-init.mjs';

const dir = mkdtempSync(join(tmpdir(), 'init-'));
const run = (name, code) => { const file = join(dir, name); writeFileSync(file, code); return findUseBeforeInit(file).map((f) => f.name); };

try {
  // Fallos seguros
  assert.deepEqual(run('a.tsx', `export function C(){ const x = [1].map(v => label(v)); const label = (v:number)=>v; return x; }`), ['label'], '.map ejecuta de inmediato');
  assert.deepEqual(run('b.tsx', `export function C(){ const x = useMemo(() => label(1), []); const label = (v:number)=>v; return x; }`), ['label'], 'useMemo ejecuta de inmediato');
  assert.deepEqual(run('c.tsx', `export function C(){ const y = label(1); const label = (v:number)=>v; return y; }`), ['label'], 'mismo ámbito');
  assert.deepEqual(run('d.tsx', `export function C(){ const y = (() => label(1))(); const label = (v:number)=>v; return y; }`), ['label'], 'función autoejecutada');
  assert.deepEqual(run('e.tsx', `export function C(){ const rows = data.filter(r => r.ok).map(r => ({ t: fmt(r) })); const fmt = (r:any)=>r; return rows; }`), ['fmt'], 'encadenado');
  assert.deepEqual(run('f.tsx', `export const rows = [1].map(v => Item(v)); const Item = (v:number) => v;`), ['Item'], 'nivel de módulo: se ejecuta al cargar');
  assert.deepEqual(run('f2.tsx', `export function C(){ return <div>{[1].map(v => <Item key={v} />)}</div>; } const Item = () => null;`), [], 'C se llama después de cargar el módulo: Item ya existe');

  // Diferidos: NO se marcan
  assert.deepEqual(run('g.tsx', `export function C(){ const onClick = () => label(1); const label = (v:number)=>v; return onClick; }`), [], 'event handler');
  assert.deepEqual(run('h.tsx', `export function C(){ useEffect(() => { label(1); }, []); const label = (v:number)=>v; }`), [], 'useEffect');
  assert.deepEqual(run('i.tsx', `export function C(){ const cb = useCallback(() => label(1), []); const label = (v:number)=>v; return cb; }`), [], 'useCallback');
  assert.deepEqual(run('j.tsx', `export function C(){ setTimeout(() => label(1), 10); const label = (v:number)=>v; }`), [], 'setTimeout');
  assert.deepEqual(run('k.tsx', `export function C(){ const run = async () => { await Promise.resolve(); label(1); }; const label = (v:number)=>v; return run; }`), [], 'async');
  assert.deepEqual(run('l.tsx', `export function C(){ const x = [1].map(label => label + 1); const label = 3; return x; }`), [], 'parámetro con el mismo nombre (sombra)');
  assert.deepEqual(run('m.tsx', `export function C(){ const label = (v:number)=>v; const x = [1].map(v => label(v)); return x; }`), [], 'declarada antes: correcto');
  assert.deepEqual(run('n.tsx', `export function C(){ const o = { label: 1 }; const x = o.label; const label = 2; return [x, label]; }`), [], 'propiedad con el mismo nombre');
  assert.deepEqual(run('o.tsx', `type T = typeof label; const label = 1; export const z: T = label;`), [], 'solo tipos');
  console.log('test-check-use-before-init OK');
} finally { rmSync(dir, { recursive: true, force: true }); }
