import type { CheckinStatus, GoalLevel, GoalMetric, GoalPace, GoalUnit, PendingCheckin } from '../../services/performance.service';

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = { PENDING: 'Pendiente', ANSWERED: 'Respondida', MISSED: 'Sin respuesta' };
export const CHECKIN_STATUS_TONE: Record<CheckinStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  ANSWERED: 'bg-emerald-100 text-emerald-900',
  MISSED: 'bg-red-100 text-red-900',
};

export const GOAL_LEVEL_LABEL: Record<GoalLevel, string> = { MIN: 'Mínima', TARGET: 'Meta', STRETCH: 'Ambiciosa' };
export const GOAL_PACE_LABEL: Record<GoalPace, string> = { MET: 'Cumplida', AHEAD: 'Adelantada', ON_TRACK: 'Al día', BEHIND: 'Atrasada', MISSED: 'No se logró' };
export const GOAL_PACE_TONE: Record<GoalPace, string> = {
  MET: 'bg-emerald-100 text-emerald-900',
  AHEAD: 'bg-sky-100 text-sky-900',
  ON_TRACK: 'bg-slate-100 text-slate-800',
  BEHIND: 'bg-amber-100 text-amber-900',
  MISSED: 'bg-red-100 text-red-900',
};
export const BONUS_STATUS_LABEL = { PENDING_APPROVAL: 'Por aprobar', APPROVED: 'Aprobado', REJECTED: 'Rechazado', PAID: 'Pagado en nómina' } as const;

export const GOAL_METRIC_OPTIONS: Array<{ key: GoalMetric; label: string; unit: GoalUnit; hint: string }> = [
  { key: 'SALES_AMOUNT', label: 'Ventas facturadas', unit: 'AMOUNT', hint: 'Suma de las facturas de venta de la persona en el período.' },
  { key: 'OPPORTUNITIES', label: 'Oportunidades de venta', unit: 'COUNT', hint: 'Negocios o prospectos que la persona registra en Fuerza Comercial.' },
  { key: 'VISITS', label: 'Visitas realizadas', unit: 'COUNT', hint: 'Visitas registradas a prospectos en Fuerza Comercial.' },
  { key: 'MESSAGES_SENT', label: 'Mensajes a clientes', unit: 'COUNT', hint: 'Mensajes enviados desde NovaChat (no incluye WhatsApp personal fuera de la plataforma).' },
  { key: 'TASKS_COMPLETED', label: 'Tareas completadas', unit: 'COUNT', hint: 'Tareas de Actividades marcadas como completadas.' },
  { key: 'HOURS_LOGGED', label: 'Horas registradas', unit: 'HOURS', hint: 'Horas del cronómetro o registradas a mano en tareas.' },
  { key: 'CHECKIN_COMPLIANCE', label: 'Cumplimiento de preguntas por hora', unit: 'PERCENT', hint: 'Porcentaje que sale de las calificaciones del supervisor.' },
  { key: 'MANUAL', label: 'Otra meta (avance manual)', unit: 'COUNT', hint: 'Tú registras el avance a mano.' },
];

export function formatGoalValue(value: number | null | undefined, unit: GoalUnit, currency?: string | null) {
  if (value === null || value === undefined) return '—';
  const number = new Intl.NumberFormat('es-NI', { maximumFractionDigits: unit === 'AMOUNT' ? 2 : 1 }).format(value);
  if (unit === 'AMOUNT') return `${currency || 'NIO'} ${number}`;
  if (unit === 'PERCENT') return `${number} %`;
  if (unit === 'HOURS') return `${number} h`;
  return number;
}

/** Hora local de un instante en la zona indicada, como «09:05». */
export function clockLabel(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

/** Fecha civil (AAAA-MM-DD) de hoy en la zona indicada. */
export function civilToday(timeZone: string, now: Date = new Date()): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftCivilDate(civil: string, days: number): string {
  const date = new Date(`${civil}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** «lunes, 9 de noviembre» para una fecha civil, sin desplazarla por la zona del navegador. */
export function longCivilDate(civil: string): string {
  const date = new Date(`${civil}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('es', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export const percent = (value: number | null | undefined) => (value === null || value === undefined ? '—' : `${Math.round(value * 10) / 10} %`);

/** Color del cumplimiento: verde desde 80 %, ámbar desde 50 %, rojo por debajo. */
export function complianceTone(value: number | null | undefined) {
  if (value === null || value === undefined) return 'text-muted-foreground';
  if (value >= 80) return 'text-emerald-700';
  if (value >= 50) return 'text-amber-700';
  return 'text-red-700';
}

/** Texto del contador de una pregunta: cuánto falta para que venza o cuánto lleva vencida. */
export function dueLabel(prompt: Pick<PendingCheckin, 'dueAt' | 'noDeadline'>, now: number = Date.now()): string {
  if (prompt.noDeadline) return 'Sin límite de tiempo: responde cuando puedas hoy';
  const minutes = minutesUntil(prompt.dueAt, now);
  if (minutes > 0) return `Responde en los próximos ${minutes} min`;
  return 'El plazo ya venció: responde ahora y tu supervisor lo verá como tardío';
}

/** Minutos que faltan para un instante, para el contador de una pregunta pendiente. */
export function minutesUntil(iso: string, now: number = Date.now()): number {
  return Math.ceil((new Date(iso).getTime() - now) / 60_000);
}

export const REMAINING_CHOICES: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: 'Ya terminé' },
  { minutes: 15, label: '15 min' },
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 240, label: '4 h' },
];
