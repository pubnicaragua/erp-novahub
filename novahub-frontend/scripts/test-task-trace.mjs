import assert from 'node:assert/strict';
import test from 'node:test';
import { assigneeNames, buildTaskTrace, shortDateTime, truncateText } from '../src/app/components/actividades/taskTrace.ts';

test('las cuatro etapas salen en orden y las que no pasaron quedan sin hacer', () => {
  const steps = buildTaskTrace({ status: 'PENDING', createdAt: '2026-11-10T15:00:00Z', createdBy: { name: 'Gabriel Tinoco' } });
  assert.deepEqual(steps.map((s) => s.key), ['created', 'started', 'submitted', 'completed']);
  assert.deepEqual(steps.map((s) => s.done), [true, false, false, false]);
  assert.equal(steps[0].who, 'Gabriel Tinoco');
  assert.equal(steps[1].at, null);
});

test('una tarea que recorrió todo el camino muestra quién y cuándo en cada etapa', () => {
  const steps = buildTaskTrace({
    status: 'COMPLETED',
    createdAt: '2026-11-10T15:00:00Z', createdBy: { name: 'Gabriel' },
    startedAt: '2026-11-11T14:00:00Z', startedBy: { name: 'Sergio' },
    submittedAt: '2026-11-12T20:00:00Z', submittedBy: { name: 'Sergio' },
    completedAt: '2026-11-13T13:00:00Z', completedBy: { name: 'Gabriel' },
  });
  assert.deepEqual(steps.map((s) => s.done), [true, true, true, true]);
  assert.deepEqual(steps.map((s) => s.who), ['Gabriel', 'Sergio', 'Sergio', 'Gabriel']);
});

test('si la etapa ocurrió pero no se sabe quién, queda sin nombre en vez de inventarlo', () => {
  const [created] = buildTaskTrace({ status: 'PENDING', createdAt: '2026-11-10T15:00:00Z', createdBy: null });
  assert.equal(created.who, null);
  assert.equal(created.done, true);
});

test('una tarea completada sin fecha de cierre registrada igual se ve completada', () => {
  const steps = buildTaskTrace({ status: 'COMPLETED', createdAt: '2026-11-10T15:00:00Z' });
  assert.equal(steps[3].done, true);
  assert.equal(steps[3].at, null);
});

test('los asignados salen sin repetirse', () => {
  const names = assigneeNames({ assignments: [
    { userId: 'a', user: { id: 'a', name: 'Ana' } },
    { userId: 'a', user: { id: 'a', name: 'Ana' } },
    { userId: 'b', user: { id: 'b', name: 'Luis' } },
    { userId: 'c', user: null },
  ] });
  assert.deepEqual(names, ['Ana', 'Luis', 'Usuario']);
  assert.deepEqual(assigneeNames({}), []);
});

test('truncateText respeta el máximo y no corta palabras a la mitad', () => {
  const long = 'Revisar la conciliación bancaria del cierre de octubre con las diferencias de cada cuenta';
  const out = truncateText(long, 40);
  assert.ok(out.length <= 41, out);
  assert.ok(out.endsWith('…'));
  assert.ok(!out.includes('  '));
  assert.equal(out, 'Revisar la conciliación bancaria del…');
  assert.equal(truncateText('Corto', 40), 'Corto');
  assert.equal(truncateText('  a \n b  ', 40), 'a b');
  assert.equal(truncateText(null, 10), '');
  assert.equal(truncateText('x'.repeat(100), 10), 'xxxxxxxxxx…');
});

test('shortDateTime da día y hora y tolera valores vacíos o inválidos', () => {
  assert.match(shortDateTime('2026-11-13T15:30:00'), /13\/11\/26\s+\d{2}:\d{2}/);
  assert.equal(shortDateTime(null), '—');
  assert.equal(shortDateTime('no es fecha'), '—');
});
