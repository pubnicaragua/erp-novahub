/**
 * Geometría pura de las vistas por hora del calendario (semana y día): recorta lo que cruza medianoche,
 * reparte en carriles lo que se solapa y calcula el rango de horas visible. Sin React ni fechas externas,
 * para poder probarla aparte (scripts/test-calendar-layout.mjs).
 */
export interface TimedItem {
  id: string;
  start: Date;
  end: Date;
}

export interface PlacedItem<T extends TimedItem> {
  item: T;
  /** Inicio y fin ya recortados al día (y con la duración mínima aplicada). */
  start: Date;
  end: Date;
  /** Distancia desde la primera hora visible, en píxeles. */
  top: number;
  height: number;
  /** Carril dentro del grupo de elementos que se solapan y cuántos carriles tiene ese grupo. */
  lane: number;
  lanes: number;
}

export const MIN_BLOCK_MINUTES = 30;

const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
const addDays = (day: Date, amount: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + amount, 0, 0, 0, 0);

/** Recorta un elemento al día dado; devuelve null si no toca ese día. Un elemento sin fin válido dura el mínimo. */
export function clipToDay(item: TimedItem, day: Date, minMinutes = MIN_BLOCK_MINUTES): { start: Date; end: Date } | null {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  const rawEnd = item.end.getTime() > item.start.getTime() ? item.end : new Date(item.start.getTime() + minMinutes * 60_000);
  const minEnd = new Date(item.start.getTime() + minMinutes * 60_000);
  const effectiveEnd = rawEnd.getTime() < minEnd.getTime() ? minEnd : rawEnd;
  if (effectiveEnd.getTime() <= dayStart.getTime() || item.start.getTime() >= dayEnd.getTime()) return null;
  return {
    start: item.start.getTime() < dayStart.getTime() ? dayStart : item.start,
    end: effectiveEnd.getTime() > dayEnd.getTime() ? dayEnd : effectiveEnd,
  };
}

const minutesIntoDay = (date: Date, day: Date) => (date.getTime() - startOfDay(day).getTime()) / 60_000;

/** Coloca los elementos del día en la cuadrícula horaria, repartiendo en carriles los que se solapan. */
export function layoutDay<T extends TimedItem>(items: T[], day: Date, startHour: number, hourHeight: number, minMinutes = MIN_BLOCK_MINUTES): Array<PlacedItem<T>> {
  const clipped = items
    .map((item) => ({ item, clip: clipToDay(item, day, minMinutes) }))
    .filter((entry): entry is { item: T; clip: { start: Date; end: Date } } => entry.clip !== null)
    .sort((a, b) => a.clip.start.getTime() - b.clip.start.getTime() || b.clip.end.getTime() - a.clip.end.getTime() || a.item.id.localeCompare(b.item.id));

  const placed: Array<PlacedItem<T>> = [];
  let cluster: Array<PlacedItem<T>> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    for (const entry of cluster) entry.lanes = Math.max(1, laneEnds.length);
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const { item, clip } of clipped) {
    const start = clip.start.getTime();
    const end = clip.end.getTime();
    if (cluster.length > 0 && start >= clusterEnd) closeCluster();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(end); } else { laneEnds[lane] = end; }
    clusterEnd = Math.max(clusterEnd, end);
    const topMinutes = minutesIntoDay(clip.start, day) - startHour * 60;
    const durationMinutes = (end - start) / 60_000;
    cluster.push({
      item, start: clip.start, end: clip.end,
      top: (topMinutes / 60) * hourHeight,
      height: Math.max((durationMinutes / 60) * hourHeight, 18),
      lane, lanes: 1,
    });
  }
  closeCluster();
  return placed;
}

/** Horas visibles: las habituales de oficina, ampliadas para que ningún elemento quede fuera. */
export function visibleHourRange(items: TimedItem[], days: Date[], defaultStart = 7, defaultEnd = 19): { startHour: number; endHour: number } {
  let startHour = defaultStart;
  let endHour = defaultEnd;
  for (const day of days) {
    for (const item of items) {
      const clip = clipToDay(item, day);
      if (!clip) continue;
      startHour = Math.min(startHour, Math.floor(minutesIntoDay(clip.start, day) / 60));
      endHour = Math.max(endHour, Math.ceil(minutesIntoDay(clip.end, day) / 60));
    }
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, Math.max(endHour, startHour + 1)) };
}

export type CalendarItemKind = 'event' | 'meeting' | 'task-due' | 'work';

export interface DaySummary {
  events: number;
  meetings: number;
  dues: number;
  workedMinutes: number;
}

/** Resumen de un día para el encabezado de la semana: cuánto hay de cada cosa y cuánto se trabajó. */
export function summarizeDay(items: Array<TimedItem & { kind: CalendarItemKind }>, day: Date): DaySummary {
  const summary: DaySummary = { events: 0, meetings: 0, dues: 0, workedMinutes: 0 };
  for (const item of items) {
    const clip = clipToDay(item, day, 0);
    if (!clip) continue;
    if (item.kind === 'event') summary.events += 1;
    else if (item.kind === 'meeting') summary.meetings += 1;
    else if (item.kind === 'task-due') summary.dues += 1;
    else summary.workedMinutes += Math.round((clip.end.getTime() - clip.start.getTime()) / 60_000);
  }
  return summary;
}

export function formatWorked(minutes: number): string {
  if (minutes <= 0) return '0 h';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
