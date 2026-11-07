import type { AgendaEvent, AgendaReminder, AgendaTask, OrgAccessLevel, WeekDayKey, WorkingHours } from '../../services/organizacion.service';

export const BRAND = { forest: '#01422C', accent: '#74C044' };

export const serifStyle = { fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic' as const, fontWeight: 500 };

export type WeekStart = 0 | 1 | 6;

export const WEEK_DAY_KEYS: WeekDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const WEEK_DAY_LABELS: Record<WeekDayKey, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
};
/** `Date#getDay()` (0 = domingo) → clave de horario laboral. */
export const dayKeyFromDate = (date: Date): WeekDayKey => (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[date.getDay()];

export function defaultWorkingHours(): WorkingHours {
  const weekday = { enabled: true, start: '08:00', end: '17:00' };
  const off = { enabled: false, start: null, end: null };
  return { mon: { ...weekday }, tue: { ...weekday }, wed: { ...weekday }, thu: { ...weekday }, fri: { ...weekday }, sat: { ...off }, sun: { ...off } };
}

export type CalendarItem = {
  key: string;
  id: string;
  kind: 'TASK' | 'EVENT' | 'MEETING' | 'REMINDER';
  title: string;
  start: Date;
  end: Date;
  status: string;
  busy?: boolean;
  completed?: boolean;
  detail?: string | null;
  raw: AgendaEvent | AgendaTask | AgendaReminder;
};

const validDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

/** Unifica tareas, eventos y recordatorios en elementos de calendario. */
export function toCalendarItems(data: { events: AgendaEvent[]; tasks: AgendaTask[]; reminders: AgendaReminder[] } | undefined): CalendarItem[] {
  if (!data) return [];
  const items: CalendarItem[] = [];
  for (const event of data.events) {
    const start = validDate(event.startDate);
    if (!start) continue;
    const end = validDate(event.endDate) ?? new Date(start.getTime() + 60 * 60 * 1000);
    items.push({
      key: `event-${event.id}`, id: event.id, kind: event.kind, title: event.title, start, end, status: event.status,
      busy: event.busy, completed: event.status === 'COMPLETED', detail: event.location, raw: event,
    });
  }
  for (const task of data.tasks) {
    const start = validDate(task.startDate) ?? validDate(task.dueDate);
    if (!start) continue;
    const end = validDate(task.endDate) ?? new Date(start.getTime() + 45 * 60 * 1000);
    items.push({
      key: `task-${task.id}`, id: task.id, kind: 'TASK', title: task.title, start, end, status: task.status,
      completed: task.status === 'COMPLETED' || task.status === 'APPROVED', raw: task,
    });
  }
  for (const reminder of data.reminders) {
    // Los recordatorios ligados a un evento ya se representan con el propio evento.
    if (reminder.activityId) continue;
    const start = validDate(reminder.reminderDate);
    if (!start) continue;
    items.push({
      key: `reminder-${reminder.id}`, id: reminder.id, kind: 'REMINDER', title: reminder.title, start,
      end: new Date(start.getTime() + 30 * 60 * 1000), status: reminder.status,
      completed: reminder.status === 'SENT', raw: reminder,
    });
  }
  return items.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export const ACCESS_LEVELS: Array<{ id: OrgAccessLevel; title: string; hint: string }> = [
  { id: 'AVAILABILITY', title: 'Solo disponibilidad', hint: 'Puede ver ocupado o libre, sin detalles.' },
  { id: 'SHARED_EVENTS', title: 'Ver eventos compartidos', hint: 'Consulta título y horario de los eventos con invitados.' },
  { id: 'EDIT', title: 'Ver y editar autorizados', hint: 'Además de lo anterior, puede gestionar eventos que compartes (sujeto a sus permisos de Actividades).' },
];

export const KIND_LABEL: Record<CalendarItem['kind'], string> = { TASK: 'Tarea', EVENT: 'Evento', MEETING: 'Reunión', REMINDER: 'Recordatorio' };

/** Clases por tipo (verde = tarea, morado = evento, ámbar = recordatorio, azul = reunión). */
export const KIND_CLASS: Record<CalendarItem['kind'], string> = {
  TASK: 'border-l-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100',
  EVENT: 'border-l-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/30 dark:text-violet-100',
  MEETING: 'border-l-sky-500 bg-sky-50 text-sky-950 dark:bg-sky-950/30 dark:text-sky-100',
  REMINDER: 'border-l-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100',
};

export function timeZoneLabel(timezone: string) {
  try {
    const part = new Intl.DateTimeFormat('es', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value;
    return `${part || ''} ${timezone}`.trim();
  } catch {
    return timezone;
  }
}

/** Zonas horarias para el selector, con la del navegador y la actual siempre incluidas. */
export function timeZoneOptions(current?: string) {
  const all = (() => {
    try {
      return (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    } catch {
      return [] as string[];
    }
  })();
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return [...new Set([current, browser, 'America/Managua', 'America/Mexico_City', 'America/Bogota', 'America/Panama', 'America/New_York', 'UTC', ...all].filter(Boolean) as string[])];
}

export function formatInTz(date: Date, timezone: string, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat('es', { timeZone: timezone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat('es', options).format(date);
  }
}

/** Valor para <input type="datetime-local"> en la hora local del navegador. */
export function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function errorMessage(error: unknown, fallback = 'No se pudo completar la operación') {
  const e = error as { response?: { data?: { message?: unknown } }; data?: { message?: unknown }; message?: unknown } | null;
  const message = e?.response?.data?.message ?? e?.data?.message ?? e?.message;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' && message ? message : fallback;
}

/** Origen de cada conexión de supervisión, mostrado con transparencia en la vista Equipo. */
export const SOURCE_LABEL: Record<string, string> = {
  ALL: 'Todo el equipo', USER: 'Asignado', DEPARTMENT: 'Departamento', ROLE: 'Rol', DEPARTMENT_HEAD: 'Jefe de departamento', REPORTS_TO: 'Organigrama',
};

// ───────────── Cumplimiento y calificación de tareas ─────────────
export type TaskPunctuality = 'ON_TIME' | 'LATE' | 'UNKNOWN';

/** 150 → «2 h 30 min»; 45 → «45 min»; 1500 → «1 d 1 h». */
export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  if (total < 24 * 60) {
    const rest = total % 60;
    return rest ? `${Math.floor(total / 60)} h ${rest} min` : `${Math.floor(total / 60)} h`;
  }
  const hours = Math.floor((total % (24 * 60)) / 60);
  return hours ? `${Math.floor(total / (24 * 60))} d ${hours} h` : `${Math.floor(total / (24 * 60))} d`;
}

/**
 * ¿Se entregó a tiempo? Mismo criterio que el servidor: completada en o antes de la hora límite. Sin hora límite
 * o sin fecha de cierre (tareas anteriores a este registro) no se puede medir y se dice así, sin inventar.
 */
export function taskPunctuality(task: { status?: string; dueDate?: string | null; completedAt?: string | null }): { kind: TaskPunctuality; lateMinutes: number } {
  if (task.status !== 'COMPLETED' || !task.dueDate || !task.completedAt) return { kind: 'UNKNOWN', lateMinutes: 0 };
  const due = new Date(task.dueDate).getTime();
  const done = new Date(task.completedAt).getTime();
  if (Number.isNaN(due) || Number.isNaN(done)) return { kind: 'UNKNOWN', lateMinutes: 0 };
  return done <= due ? { kind: 'ON_TIME', lateMinutes: 0 } : { kind: 'LATE', lateMinutes: Math.max(1, Math.round((done - due) / 60_000)) };
}

export const RATING_LABEL: Record<number, string> = { 1: 'Deficiente', 2: 'Por mejorar', 3: 'Cumple', 4: 'Muy bueno', 5: 'Excelente' };
/** Con esta calificación o menos, el servidor exige explicar qué mejorar. */
export const FEEDBACK_REQUIRED_AT_OR_BELOW = 2;
export const MAX_FEEDBACK_LENGTH = 1000;

export const DIGEST_LABEL: Record<'START_OF_DAY' | 'BEFORE_LUNCH' | 'END_OF_DAY', { title: string; hint: string }> = {
  START_OF_DAY: { title: 'Inicio de la jornada', hint: 'Tareas que vencen hoy, atrasadas y eventos del día.' },
  BEFORE_LUNCH: { title: 'Antes del almuerzo', hint: 'Lo que falta por cerrar antes de salir a almorzar.' },
  END_OF_DAY: { title: 'Cierre del día', hint: 'Lo completado hoy y lo que queda pendiente.' },
};
/** Días de la semana para los resúmenes: 1 = lunes … 7 = domingo (igual que el servidor). */
export const DIGEST_WEEKDAYS: Array<{ id: number; short: string; label: string }> = [
  { id: 1, short: 'L', label: 'Lunes' }, { id: 2, short: 'M', label: 'Martes' }, { id: 3, short: 'X', label: 'Miércoles' },
  { id: 4, short: 'J', label: 'Jueves' }, { id: 5, short: 'V', label: 'Viernes' }, { id: 6, short: 'S', label: 'Sábado' }, { id: 7, short: 'D', label: 'Domingo' },
];
