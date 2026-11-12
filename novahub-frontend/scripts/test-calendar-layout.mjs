import assert from 'node:assert/strict';
import test from 'node:test';
import { clipToDay, formatWorked, layoutDay, summarizeDay, visibleHourRange } from '../src/app/components/actividades/calendarLayout.ts';
import { getTaskProgress } from '../src/app/components/actividades/actividades.progress.ts';
import { resolvePeriod } from '../src/app/components/actividades/reportPeriod.ts';

const day = new Date(2026, 10, 12); // 12 de noviembre de 2026, hora local
const at = (hour, minute = 0, d = day) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute);
const item = (id, start, end) => ({ id, start, end });

test('un elemento se coloca por hora: top y alto salen de la hora de inicio y la duración', () => {
  const [placed] = layoutDay([item('a', at(9), at(10, 30))], day, 7, 60);
  assert.equal(placed.top, 120); // dos horas después de las 7:00
  assert.equal(placed.height, 90);
  assert.equal(placed.lane, 0);
  assert.equal(placed.lanes, 1);
});

test('lo que se solapa se reparte en carriles; lo que no, ocupa todo el ancho', () => {
  const placed = layoutDay([
    item('a', at(9), at(11)),
    item('b', at(10), at(12)),
    item('c', at(13), at(14)),
  ], day, 7, 60);
  const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
  assert.equal(byId.a.lanes, 2);
  assert.equal(byId.b.lanes, 2);
  assert.notEqual(byId.a.lane, byId.b.lane);
  assert.equal(byId.c.lanes, 1);
  assert.equal(byId.c.lane, 0);
});

test('un carril liberado se reutiliza dentro del mismo grupo', () => {
  const placed = layoutDay([
    item('a', at(9), at(12)),
    item('b', at(9, 30), at(10)),
    item('c', at(10, 30), at(11)),
  ], day, 7, 60);
  const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
  assert.equal(byId.a.lanes, 2);
  assert.equal(byId.b.lane, byId.c.lane); // c entra en el carril que dejó libre b
});

test('lo que cruza medianoche se recorta a cada día y lo de otro día no aparece', () => {
  const night = item('n', at(22), at(2, 0, new Date(2026, 10, 13)));
  const today = clipToDay(night, day);
  assert.deepEqual([today.start.getHours(), today.end.getHours(), today.end.getDate()], [22, 0, 13]);
  const tomorrow = clipToDay(night, new Date(2026, 10, 13));
  assert.deepEqual([tomorrow.start.getHours(), tomorrow.start.getDate(), tomorrow.end.getHours()], [0, 13, 2]);
  assert.equal(clipToDay(night, new Date(2026, 10, 11)), null);
  assert.equal(clipToDay(night, new Date(2026, 10, 14)), null);
});

test('un elemento sin fin (un vencimiento) dura el mínimo para que se vea', () => {
  const clip = clipToDay(item('due', at(10), at(10)), day);
  assert.equal((clip.end - clip.start) / 60_000, 30);
});

test('el rango de horas se amplía para que nada quede fuera y nunca pasa de 0–24', () => {
  assert.deepEqual(visibleHourRange([], [day]), { startHour: 7, endHour: 19 });
  assert.deepEqual(visibleHourRange([item('a', at(5, 30), at(6))], [day]), { startHour: 5, endHour: 19 });
  assert.deepEqual(visibleHourRange([item('a', at(18), at(21, 15))], [day]), { startHour: 7, endHour: 22 });
  const range = visibleHourRange([item('a', at(23), at(23, 59))], [day]);
  assert.equal(range.endHour, 24);
});

test('el resumen del día cuenta cada tipo y suma las horas trabajadas', () => {
  const summary = summarizeDay([
    { ...item('e', at(9), at(10)), kind: 'event' },
    { ...item('m', at(11), at(12)), kind: 'meeting' },
    { ...item('d', at(15), at(15)), kind: 'task-due' },
    { ...item('w1', at(8), at(9, 30)), kind: 'work' },
    { ...item('w2', at(14), at(14, 45)), kind: 'work' },
    { ...item('otro', at(9, 0, new Date(2026, 10, 14)), at(10, 0, new Date(2026, 10, 14))), kind: 'work' },
  ], day);
  assert.deepEqual(summary, { events: 1, meetings: 1, dues: 1, workedMinutes: 135 });
  assert.equal(formatWorked(135), '2 h 15 min');
  assert.equal(formatWorked(120), '2 h');
  assert.equal(formatWorked(45), '45 min');
  assert.equal(formatWorked(0), '0 h');
});

test('el avance sale de la tarea completada, luego de las subtareas y por último del último reporte', () => {
  assert.deepEqual(getTaskProgress({ status: 'COMPLETED', subtasks: [{ isCompleted: false }] }).percent, 100);
  const withSubtasks = getTaskProgress({ status: 'IN_PROGRESS', subtasks: [{ isCompleted: true }, { isCompleted: false }, { isCompleted: false }, { isCompleted: true }], reports: [{ progressPercent: 90 }] });
  assert.deepEqual([withSubtasks.percent, withSubtasks.source, withSubtasks.done, withSubtasks.total], [50, 'subtasks', 2, 4]);
  assert.deepEqual(getTaskProgress({ status: 'IN_PROGRESS', subtasks: [], reports: [{ progressPercent: 40 }] }), { percent: 40, source: 'report' });
  assert.equal(getTaskProgress({ status: 'IN_PROGRESS', reports: [{ progressPercent: 250 }] }).percent, 100);
  assert.deepEqual(getTaskProgress({ status: 'PENDING' }), { percent: 0, source: 'none' });
  assert.equal(getTaskProgress(null).percent, 0);
});

test('los periodos del centro de reportes cubren hoy, 7 y 30 días contando el día de hoy', () => {
  const now = new Date(2026, 10, 12, 15, 0);
  assert.deepEqual(resolvePeriod('TODAY', { from: '', to: '' }, now), { from: '2026-11-12', to: '2026-11-12' });
  assert.deepEqual(resolvePeriod('7D', { from: '', to: '' }, now), { from: '2026-11-06', to: '2026-11-12' });
  assert.deepEqual(resolvePeriod('30D', { from: '', to: '' }, now), { from: '2026-10-14', to: '2026-11-12' });
  assert.deepEqual(resolvePeriod('ALL', { from: '2026-01-01', to: '2026-01-02' }, now), { from: '', to: '' });
  assert.deepEqual(resolvePeriod('CUSTOM', { from: '2026-01-01', to: '2026-01-02' }, now), { from: '2026-01-01', to: '2026-01-02' });
});
