import assert from 'node:assert/strict';
import test from 'node:test';
import { assigneeNames, buildTaskTrace, canEditTaskContent, durationLabel, localDayKey, shortDateTime, sortOverdueFirst, truncateText } from '../src/app/components/actividades/taskTrace.ts';

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

test('solo quien creó la tarea o un administrador cambia su contenido', () => {
  assert.equal(canEditTaskContent({ createdById: 'u1' }, { id: 'u1' }), true);
  assert.equal(canEditTaskContent({ createdById: 'u1' }, { id: 'u2', canEdit: true }), false);
  assert.equal(canEditTaskContent({ createdById: 'u1' }, { id: 'u2', isAdmin: true }), true);
  assert.equal(canEditTaskContent({ createdBy: { id: 'u1', name: 'Ileana' } }, { id: 'u1' }), true);
  assert.equal(canEditTaskContent({}, { id: 'u2', canEdit: true }), true);
  assert.equal(canEditTaskContent({}, { id: 'u2', canEdit: false }), false);
});

test('la duración se dice en minutos, horas o días', () => {
  assert.equal(durationLabel('2026-11-10T10:00:00Z', '2026-11-10T10:30:00Z'), '30 min');
  assert.equal(durationLabel('2026-11-10T10:00:00Z', '2026-11-10T15:10:00Z'), '5 h');
  assert.equal(durationLabel('2026-11-10T10:00:00Z', '2026-11-13T14:00:00Z'), '3 d 4 h');
  assert.equal(durationLabel(null, '2026-11-13T14:00:00Z'), '');
});

test('las vencidas van primero, la más atrasada arriba, y el resto conserva su orden', () => {
  const now = new Date('2026-11-15T12:00:00Z').getTime();
  const tasks = [
    { id: 'a', status: 'PENDING', dueDate: '2026-11-20T12:00:00Z' },
    { id: 'b', status: 'IN_PROGRESS', dueDate: '2026-11-14T12:00:00Z' },
    { id: 'c', status: 'COMPLETED', dueDate: '2026-11-01T12:00:00Z' },
    { id: 'd', status: 'PENDING', dueDate: '2026-11-10T12:00:00Z' },
    { id: 'e', status: 'PENDING' },
  ];
  assert.deepEqual(sortOverdueFirst(tasks, now).map((t) => t.id), ['d', 'b', 'a', 'c', 'e']);
});

test('el día local de una fecha no se corre por la zona horaria', () => {
  const local = new Date(2026, 10, 14, 21, 30);
  assert.equal(localDayKey(local.toISOString()), '2026-11-14');
  assert.equal(localDayKey(''), null);
});
