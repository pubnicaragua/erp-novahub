import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPauseTaskAs, canReviewTask, countReboundsByCategory, displayStatusOf, isDeadlineStopped, isOverdueByDeadline,
  isPausedTask, matchesStatusFilter, openPauseOf, pauseSummary,
} from '../src/app/components/actividades/taskCompliance.ts';

const now = new Date('2026-11-27T12:00:00Z').getTime();
const past = '2026-11-20T12:00:00Z';
const future = '2026-12-10T12:00:00Z';
const pause = (approval, extra = {}) => ({ id: 'p1', reason: 'BLOCKER', note: 'Falta acceso', pausedAt: past, resumedAt: null, approval, ...extra });
const paused = (approval, extra = {}) => ({ status: 'IN_PROGRESS', dueDate: past, pausedAt: past, pauses: [pause(approval)], ...extra });

test('una tarea en pausa se muestra como tal aunque esté vencida', () => {
  assert.equal(displayStatusOf(paused('PENDING'), now), 'PAUSED');
  assert.equal(displayStatusOf({ status: 'IN_PROGRESS', dueDate: past }, now), 'OVERDUE');
  assert.equal(displayStatusOf({ status: 'IN_PROGRESS', dueDate: future }, now), 'IN_PROGRESS');
});

test('pausar sin aprobación no saca la tarea de «Vencidas»; con aprobación sí', () => {
  assert.equal(isOverdueByDeadline(paused('PENDING'), now), true);
  assert.equal(isOverdueByDeadline(paused('REJECTED'), now), true);
  assert.equal(isOverdueByDeadline(paused('APPROVED'), now), false);
  assert.equal(matchesStatusFilter(paused('PENDING'), 'OVERDUE', now), true);
  assert.equal(matchesStatusFilter(paused('APPROVED'), 'OVERDUE', now), false);
  assert.equal(isDeadlineStopped(paused('APPROVED')), true);
});

test('en pausa no cuenta como pendiente ni en progreso', () => {
  assert.equal(matchesStatusFilter(paused('PENDING'), 'IN_PROGRESS', now), false);
  assert.equal(matchesStatusFilter(paused('PENDING', { status: 'PENDING' }), 'PENDING', now), false);
  assert.equal(matchesStatusFilter(paused('PENDING'), 'PAUSED', now), true);
  assert.equal(matchesStatusFilter(paused('PENDING'), 'ALL', now), true);
  assert.equal(matchesStatusFilter({ status: 'IN_PROGRESS', dueDate: past }, 'IN_PROGRESS', now), true);
});

test('la marca de pausa no aplica a una tarea ya entregada o cerrada', () => {
  for (const status of ['WAITING_APPROVAL', 'COMPLETED', 'CANCELLED']) {
    assert.equal(isPausedTask({ status, pausedAt: past }), false);
    assert.equal(openPauseOf({ status, pausedAt: past, pauses: [pause('APPROVED')] }), null);
  }
});

test('la pausa vigente es la que no se ha reanudado', () => {
  const task = { status: 'PENDING', pausedAt: past, pauses: [pause('PENDING', { id: 'abierta' }), pause('APPROVED', { id: 'vieja', resumedAt: past })] };
  assert.equal(openPauseOf(task).id, 'abierta');
  assert.equal(isDeadlineStopped(task), false);
});

test('cuenta rebotes totales, por error y sin clasificar', () => {
  assert.deepEqual(countReboundsByCategory({ rebounds: [{ category: 'ERROR' }, { category: 'SCOPE_CHANGE' }, { category: 'UNCLASSIFIED' }, {}] }), { total: 4, errors: 1, unclassified: 2 });
  assert.deepEqual(countReboundsByCategory({}), { total: 0, errors: 0, unclassified: 0 });
});

test('el resumen dice qué tarea tomó la prioridad', () => {
  assert.equal(pauseSummary(pause('PENDING', { reason: 'PRIORITY', note: null, displacedBy: { id: 't2', title: 'Ajustes de Mudanzas' } })), 'Salió algo con más prioridad: por «Ajustes de Mudanzas»');
  assert.equal(pauseSummary(pause('PENDING')), 'Algo la está bloqueando: Falta acceso');
});

test('quién aprueba y quién puede pausar', () => {
  assert.equal(canReviewTask(['ana'], { id: 'ana', isAdmin: false, canApprove: true }), false);
  assert.equal(canReviewTask(['ana'], { id: 'ana', isAdmin: true, canApprove: true }), true);
  assert.equal(canReviewTask(['ana'], { id: 'jefe', isAdmin: false, canApprove: true }), true);
  assert.equal(canReviewTask([], { id: 'jefe', isAdmin: false, canApprove: false }), false);
  const task = { createdById: 'c', assignedToId: 'a', assignments: [{ userId: 'b' }] };
  for (const id of ['a', 'b', 'c']) assert.equal(canPauseTaskAs(task, { id, isAdmin: false, canApprove: false }), true);
  assert.equal(canPauseTaskAs(task, { id: 'x', isAdmin: false, canApprove: false }), false);
  assert.equal(canPauseTaskAs(task, { id: '', isAdmin: false, canApprove: false }), false);
});
