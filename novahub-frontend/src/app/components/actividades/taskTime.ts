// Tiempo registrado en una tarea: cronómetros, totales y cómo se muestran. Lógica pura, probada con
// `npm run test:task-time`.

export interface TimeEntryLike {
  id: string;
  userId?: string | null;
  user?: { id?: string | null; name?: string | null } | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds?: number | null;
  isManual?: boolean;
  description?: string | null;
}

/** Un cronómetro que lleva más de este tiempo corriendo casi seguro se olvidó de detener. */
export const FORGOTTEN_TIMER_SECONDS = 12 * 3600;

/** «2 h 45 min», «45 min», «1 h», «menos de 1 min». Nunca decimales. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) return seconds > 0 ? 'menos de 1 min' : '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** «01:02:03» para el reloj en vivo. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

export interface SplitEntries<T extends TimeEntryLike> {
  /** El cronómetro que está corriendo y es de la persona que mira. */
  mine: T | null;
  /** Cronómetros corriendo de otras personas: se ven, pero no se controlan. */
  others: T[];
  /** Registros ya cerrados. */
  finished: T[];
}

/** Separa los registros: mi cronómetro, los de otras personas y los ya cerrados. */
export function splitTimeEntries<T extends TimeEntryLike>(entries: T[], currentUserId: string | null | undefined): SplitEntries<T> {
  const me = String(currentUserId || '').trim();
  const running = entries.filter((entry) => !entry.endedAt);
  const mine = (me && running.find((entry) => String(entry.userId || entry.user?.id || '').trim() === me)) || null;
  const others = running.filter((entry) => entry !== mine);
  const finished = entries.filter((entry) => Boolean(entry.endedAt));
  return { mine, others, finished };
}

/** Segundos de un cronómetro que sigue corriendo, nunca negativos. */
export function runningSeconds(entry: Pick<TimeEntryLike, 'startedAt'>, nowMs: number = Date.now()): number {
  const start = new Date(entry.startedAt).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 1000));
}

/** Suma solo lo ya cerrado. */
export function totalFinishedSeconds(entries: TimeEntryLike[]): number {
  return entries.filter((entry) => Boolean(entry.endedAt)).reduce((sum, entry) => sum + Math.max(0, Number(entry.durationSeconds) || 0), 0);
}

export function isForgottenTimer(seconds: number): boolean {
  return seconds >= FORGOTTEN_TIMER_SECONDS;
}
