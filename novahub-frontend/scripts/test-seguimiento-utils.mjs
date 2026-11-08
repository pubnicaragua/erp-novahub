import assert from 'node:assert/strict';
import test from 'node:test';
import {
  civilToday, clockLabel, complianceTone, dueLabel, formatGoalValue, longCivilDate, minutesUntil, percent, shiftCivilDate, GOAL_METRIC_OPTIONS,
} from '../src/app/components/seguimiento/seguimiento.utils.ts';

test('las fechas civiles se desplazan sin depender de la zona del navegador', () => {
  assert.equal(shiftCivilDate('2026-11-09', 1), '2026-11-10');
  assert.equal(shiftCivilDate('2026-11-01', -1), '2026-10-31');
  assert.equal(shiftCivilDate('2026-02-28', 1), '2026-03-01');
  assert.equal(shiftCivilDate('2028-02-28', 1), '2028-02-29');
  assert.equal(shiftCivilDate('2026-12-31', 1), '2027-01-01');
});

test('hoy se calcula en la zona pedida', () => {
  // 03:30Z del 10 de noviembre: en Managua (UTC-6) todavía es el 9; en Tokio ya es el 10
  const instant = new Date('2026-11-10T03:30:00Z');
  assert.equal(civilToday('America/Managua', instant), '2026-11-09');
  assert.equal(civilToday('Asia/Tokyo', instant), '2026-11-10');
});

test('la hora de un instante se muestra en la zona de la persona', () => {
  assert.equal(clockLabel('2026-11-09T14:05:00Z', 'America/Managua'), '08:05');
  assert.equal(clockLabel('2026-11-09T14:05:00Z', 'Europe/Madrid'), '15:05');
  assert.equal(clockLabel(null, 'America/Managua'), '—');
  assert.equal(clockLabel('no es una fecha', 'America/Managua'), '—');
});

test('la fecha larga no se corre un día', () => {
  assert.match(longCivilDate('2026-11-09'), /lunes/i);
  assert.match(longCivilDate('2026-11-15'), /domingo/i);
});

test('los valores de una meta llevan su unidad', () => {
  assert.equal(formatGoalValue(25000, 'AMOUNT', 'NIO'), 'NIO 25,000');
  assert.equal(formatGoalValue(25000, 'AMOUNT', 'USD').startsWith('USD '), true);
  assert.equal(formatGoalValue(87.5, 'PERCENT'), '87.5 %');
  assert.equal(formatGoalValue(1.5, 'HOURS'), '1.5 h');
  assert.equal(formatGoalValue(12, 'COUNT'), '12');
  assert.equal(formatGoalValue(null, 'COUNT'), '—');
});

test('el cumplimiento se colorea por tramos', () => {
  assert.equal(complianceTone(95), 'text-emerald-700');
  assert.equal(complianceTone(80), 'text-emerald-700');
  assert.equal(complianceTone(60), 'text-amber-700');
  assert.equal(complianceTone(10), 'text-red-700');
  assert.equal(complianceTone(null), 'text-muted-foreground');
  assert.equal(percent(53.333), '53.3 %');
  assert.equal(percent(null), '—');
});

test('el contador de una pregunta cuenta minutos hacia arriba y llega a cero o negativo al vencer', () => {
  const now = Date.parse('2026-11-09T14:00:00Z');
  assert.equal(minutesUntil('2026-11-09T14:10:00Z', now), 10);
  assert.equal(minutesUntil('2026-11-09T14:00:30Z', now), 1);
  assert.equal(minutesUntil('2026-11-09T13:55:00Z', now), -5);
});

test('todos los tipos de meta tienen unidad y una pista', () => {
  assert.equal(GOAL_METRIC_OPTIONS.length, 9);
  assert.ok(GOAL_METRIC_OPTIONS.some((option) => option.key === 'LINKED_TASKS' && option.unit === 'PERCENT'));
  for (const option of GOAL_METRIC_OPTIONS) {
    assert.ok(option.label && option.hint, `${option.key} sin texto`);
    assert.ok(['AMOUNT', 'COUNT', 'HOURS', 'PERCENT'].includes(option.unit));
  }
});

test('una pregunta sin límite de tiempo no muestra cuenta regresiva ni se marca vencida', () => {
  const dueAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  assert.match(dueLabel({ dueAt, noDeadline: true }), /Sin límite de tiempo/);
  assert.match(dueLabel({ dueAt, noDeadline: false }), /Responde en los próximos/);
});
