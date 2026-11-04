import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';
import type { OrgViewMode } from '../../services/organizacion.service';
import type { WeekStart } from './organizacion.utils';

/**
 * Fechas "civiles" (día del calendario sin hora): se representan como `Date` local a las 12:00
 * para que las operaciones de date-fns no cambien de día por el horario de verano.
 * Los instantes reales siempre se convierten con la zona horaria elegida por el usuario.
 */
type Parts = { y: number; mo: number; d: number; h: number; mi: number; s: number };

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = formatterCache.get(tz);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      f = new Intl.DateTimeFormat('en-CA', { hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    formatterCache.set(tz, f);
  }
  return f;
}

export function partsInTz(date: Date, tz: string): Parts {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return { y: out.year, mo: out.month, d: out.day, h: out.hour === 24 ? 0 : out.hour, mi: out.minute, s: out.second };
}

function offsetMs(date: Date, tz: string) {
  const p = partsInTz(date, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Hora de pared en `tz` → instante UTC. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = offsetMs(new Date(guess), tz);
  let utc = guess - first;
  const second = offsetMs(new Date(utc), tz);
  if (second !== first) utc = guess - second;
  return new Date(utc);
}

export const civilDate = (y: number, mo: number, d: number) => new Date(y, mo - 1, d, 12, 0, 0, 0);
export const civilFromInstant = (date: Date, tz: string) => { const p = partsInTz(date, tz); return civilDate(p.y, p.mo, p.d); };
export const todayCivil = (tz: string) => civilFromInstant(new Date(), tz);

const pad = (n: number) => String(n).padStart(2, '0');
export const civilKey = (c: Date) => `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}`;
export const instantKey = (date: Date, tz: string) => { const p = partsInTz(date, tz); return `${p.y}-${pad(p.mo)}-${pad(p.d)}`; };
export const minutesOfDay = (date: Date, tz: string) => { const p = partsInTz(date, tz); return p.h * 60 + p.mi; };

/** Campos de formulario (date `yyyy-mm-dd` y time `HH:mm`) en la zona elegida. */
export function toZonedInputs(date: Date, tz: string) {
  const p = partsInTz(date, tz);
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
}

/** Campos de formulario → instante UTC (o null si no son válidos). */
export function fromZonedInputs(dateValue: string, timeValue: string, tz: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const t = /^(\d{2}):(\d{2})$/.exec(timeValue || '09:00');
  if (!m || !t) return null;
  return zonedToUtc(Number(m[1]), Number(m[2]), Number(m[3]), Number(t[1]), Number(t[2]), tz);
}

export function formatTime(date: Date, tz: string) {
  const p = partsInTz(date, tz);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${pad(p.mi)} ${p.h < 12 ? 'a. m.' : 'p. m.'}`;
}

export function visibleCivilRange(view: OrgViewMode, anchor: Date, weekStartsOn: WeekStart) {
  if (view === 'DAY') return { start: anchor, end: anchor };
  if (view === 'WEEK') return { start: startOfWeek(anchor, { weekStartsOn }), end: endOfWeek(anchor, { weekStartsOn }) };
  if (view === 'MONTH') {
    return { start: startOfWeek(startOfMonth(anchor), { weekStartsOn }), end: endOfWeek(endOfMonth(anchor), { weekStartsOn }) };
  }
  return { start: anchor, end: addDays(anchor, 29) };
}

/** Rango en instantes UTC que cubre por completo los días civiles visibles. */
export function rangeToInstants(start: Date, end: Date, tz: string) {
  return {
    from: zonedToUtc(start.getFullYear(), start.getMonth() + 1, start.getDate(), 0, 0, tz),
    to: zonedToUtc(end.getFullYear(), end.getMonth() + 1, end.getDate(), 23, 59, tz),
  };
}

export function shiftCivil(view: OrgViewMode, anchor: Date, direction: 1 | -1) {
  if (view === 'DAY') return addDays(anchor, direction);
  if (view === 'WEEK') return addDays(anchor, 7 * direction);
  if (view === 'MONTH') return addMonths(anchor, direction);
  return addDays(anchor, 30 * direction);
}

export function daysBetween(start: Date, end: Date) {
  const days: Date[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
