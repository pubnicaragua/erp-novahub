import assert from 'node:assert/strict';
import test from 'node:test';
import { FORGOTTEN_TIMER_SECONDS, formatClock, formatDuration, isForgottenTimer, runningSeconds, splitTimeEntries, totalFinishedSeconds } from '../src/app/components/actividades/taskTime.ts';

test('formatDuration da horas y minutos, nunca decimales', () => {
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(20), 'menos de 1 min');
  assert.equal(formatDuration(45 * 60), '45 min');
  assert.equal(formatDuration(3600), '1 h');
  assert.equal(formatDuration(2.75 * 3600), '2 h 45 min');
  assert.equal(formatDuration(26.5 * 3600), '26 h 30 min');
  assert.equal(formatDuration(-5), '0 min');
  assert.equal(formatDuration(Number.NaN), '0 min');
});

test('formatClock arma el reloj con dos dígitos', () => {
  assert.equal(formatClock(0), '00:00:00');
  assert.equal(formatClock(3725), '01:02:05');
  assert.equal(formatClock(26 * 3600 + 30 * 60), '26:30:00');
});

test('el cronómetro de otra persona no se toma como propio', () => {
  const entries = [
    { id: 'a', userId: 'sergio', startedAt: '2026-11-15T10:00:00Z' },
    { id: 'b', userId: 'gabriel', startedAt: '2026-11-15T11:00:00Z', endedAt: '2026-11-15T12:00:00Z', durationSeconds: 3600 },
  ];
  const asGabriel = splitTimeEntries(entries, 'gabriel');
  assert.equal(asGabriel.mine, null);
  assert.deepEqual(asGabriel.others.map((e) => e.id), ['a']);
  assert.deepEqual(asGabriel.finished.map((e) => e.id), ['b']);
  const asSergio = splitTimeEntries(entries, 'sergio');
  assert.equal(asSergio.mine.id, 'a');
  assert.deepEqual(asSergio.others, []);
});

test('sin usuario identificado ningún cronómetro es mío', () => {
  const { mine, others } = splitTimeEntries([{ id: 'a', userId: 'x', startedAt: '2026-11-15T10:00:00Z' }], null);
  assert.equal(mine, null);
  assert.equal(others.length, 1);
});

test('el usuario también se reconoce por la relación user', () => {
  const { mine } = splitTimeEntries([{ id: 'a', user: { id: 'gabriel' }, startedAt: '2026-11-15T10:00:00Z' }], 'gabriel');
  assert.equal(mine.id, 'a');
});

test('el total suma solo lo cerrado y un cronómetro corriendo no cuenta 0 ni se inventa', () => {
  const entries = [
    { id: 'a', startedAt: 'x', endedAt: 'y', durationSeconds: 2700 },
    { id: 'b', startedAt: 'x', endedAt: 'y', durationSeconds: 7200 },
    { id: 'c', startedAt: 'x', durationSeconds: 0 },
    { id: 'd', startedAt: 'x', endedAt: 'y', durationSeconds: -50 },
  ];
  assert.equal(totalFinishedSeconds(entries), 9900);
  assert.equal(formatDuration(totalFinishedSeconds(entries)), '2 h 45 min');
});

test('runningSeconds nunca es negativo ni NaN', () => {
  const now = new Date('2026-11-15T12:00:00Z').getTime();
  assert.equal(runningSeconds({ startedAt: '2026-11-15T11:00:00Z' }, now), 3600);
  assert.equal(runningSeconds({ startedAt: '2026-11-15T13:00:00Z' }, now), 0);
  assert.equal(runningSeconds({ startedAt: 'no es fecha' }, now), 0);
});

test('un cronómetro de más de 12 horas se marca como olvidado', () => {
  assert.equal(isForgottenTimer(FORGOTTEN_TIMER_SECONDS - 1), false);
  assert.equal(isForgottenTimer(FORGOTTEN_TIMER_SECONDS), true);
  assert.equal(isForgottenTimer(26.5 * 3600), true);
});
