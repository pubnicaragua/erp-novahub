import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NO_CATEGORY_KEY,
  countByCategory,
  countByPerson,
  countTasks,
  isOverdueTask,
  taskAssignees,
  taskCountLabel,
} from '../src/app/components/actividades/taskCategoryStats.ts';

const now = new Date('2026-11-12T12:00:00Z');
const past = '2026-11-10T12:00:00Z';
const future = '2026-11-20T12:00:00Z';
const ana = { userId: 'ana', user: { id: 'ana', name: 'Ana' } };
const sergio = { userId: 'sergio', user: { id: 'sergio', name: 'Sergio' } };

const tasks = [
  { id: 1, status: 'PENDING', dueDate: future, categoryId: 'SISTEMAS', assignments: [sergio] },
  { id: 2, status: 'IN_PROGRESS', dueDate: past, categoryId: 'SISTEMAS', assignments: [sergio, ana] },
  { id: 3, status: 'PENDING', dueDate: future, categoryId: 'SISTEMAS', assignments: [] },
  { id: 4, status: 'COMPLETED', dueDate: past, categoryId: 'SISTEMAS', assignments: [ana] },
  { id: 5, status: 'CANCELLED', dueDate: past, categoryId: null, assignments: [] },
  { id: 6, status: 'WAITING_APPROVAL', dueDate: future, categoryId: null, assignments: [ana] },
];

test('una tarea cerrada nunca está vencida; una abierta con fecha pasada sí', () => {
  assert.equal(isOverdueTask(tasks[3], now), false);
  assert.equal(isOverdueTask(tasks[4], now), false);
  assert.equal(isOverdueTask(tasks[1], now), true);
  assert.equal(isOverdueTask(tasks[0], now), false);
  assert.equal(isOverdueTask({ id: 9, status: 'PENDING' }, now), false);
});

test('los conteos globales separan abiertas, vencidas, sin asignar y sin tomar', () => {
  const counts = countTasks(tasks, now);
  assert.deepEqual(counts, { total: 6, open: 4, overdue: 1, unassigned: 1, notStarted: 1, done: 1 });
});

test('los conteos por categoría agrupan las tareas sin categoría aparte', () => {
  const map = countByCategory(tasks, now);
  assert.deepEqual(map.get('SISTEMAS'), { total: 4, open: 3, overdue: 1, unassigned: 1, notStarted: 1, done: 1 });
  assert.deepEqual(map.get(NO_CATEGORY_KEY), { total: 2, open: 1, overdue: 0, unassigned: 0, notStarted: 0, done: 0 });
  assert.equal(map.get('INFRAESTRUCTURA'), undefined);
});

test('la categoría se compara sin importar mayúsculas', () => {
  const map = countByCategory([{ id: 1, status: 'PENDING', categoryId: 'sistemas' }], now);
  assert.equal(map.get('SISTEMAS')?.total, 1);
});

test('la carga por persona cuenta solo tareas abiertas y ordena de mayor a menor', () => {
  const people = countByPerson(tasks, [{ id: 'luis', name: 'Luis' }], now);
  assert.deepEqual(people.map((p) => [p.id, p.open]), [['ana', 2], ['sergio', 2], ['luis', 0]]);
  const sergioStat = people.find((p) => p.id === 'sergio');
  assert.deepEqual(sergioStat, { id: 'sergio', name: 'Sergio', open: 2, inProgress: 1, notStarted: 1, overdue: 1 });
  assert.equal(people.find((p) => p.id === 'luis')?.open, 0);
});

test('quien aparece en las tareas con nombre real reemplaza al genérico', () => {
  const people = countByPerson([{ id: 1, status: 'PENDING', assignedToId: 'x' }, { id: 2, status: 'PENDING', assignments: [{ userId: 'x', user: { id: 'x', name: 'Xiomara' } }] }], [], now);
  assert.equal(people[0].name, 'Xiomara');
  assert.equal(people[0].open, 2);
});

test('el responsable directo cuenta aunque no haya lista de asignaciones', () => {
  assert.deepEqual(taskAssignees({ id: 1, assignedToId: 'pedro' }), [{ id: 'pedro', name: 'Usuario' }]);
  assert.deepEqual(taskAssignees({ id: 1, assignments: [ana, ana] }), [{ id: 'ana', name: 'Ana' }]);
});

test('la etiqueta de cantidad usa singular, plural y cero', () => {
  assert.equal(taskCountLabel(0), 'Sin tareas');
  assert.equal(taskCountLabel(1), '1 tarea');
  assert.equal(taskCountLabel(7), '7 tareas');
});
