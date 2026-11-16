// Trazabilidad de una tarea (quién la creó y cuándo pasó por cada etapa) y recorte de textos largos.
// Lógica pura, probada con `npm run test:task-trace`.

export interface TraceUser {
  id?: string | null;
  name?: string | null;
}

export interface TraceTask {
  status?: string | null;
  createdAt?: string | null;
  createdBy?: TraceUser | null;
  startedAt?: string | null;
  startedBy?: TraceUser | null;
  submittedAt?: string | null;
  submittedBy?: TraceUser | null;
  completedAt?: string | null;
  completedBy?: TraceUser | null;
  assignments?: Array<{ userId?: string | null; user?: TraceUser | null }> | null;
}

export type TraceStepKey = 'created' | 'started' | 'submitted' | 'completed';

export interface TraceStep {
  key: TraceStepKey;
  label: string;
  /** Momento ISO en que ocurrió, o null si todavía no pasa (o no se registró). */
  at: string | null;
  /** Nombre de quien lo hizo; null si no se registró. */
  who: string | null;
  /** La etapa ya ocurrió. */
  done: boolean;
}

const cleanName = (user?: TraceUser | null): string | null => {
  const name = String(user?.name || '').trim();
  return name || null;
};

/** Las cuatro etapas de una tarea, en orden, con quién y cuándo. */
export function buildTaskTrace(task: TraceTask): TraceStep[] {
  const completed = String(task.status || '').toUpperCase() === 'COMPLETED' || Boolean(task.completedAt);
  return [
    { key: 'created', label: 'Creada', at: task.createdAt || null, who: cleanName(task.createdBy), done: true },
    { key: 'started', label: 'En progreso', at: task.startedAt || null, who: cleanName(task.startedBy), done: Boolean(task.startedAt) },
    { key: 'submitted', label: 'Enviada a revisión', at: task.submittedAt || null, who: cleanName(task.submittedBy), done: Boolean(task.submittedAt) },
    { key: 'completed', label: 'Completada', at: task.completedAt || null, who: cleanName(task.completedBy), done: completed },
  ];
}

/** Nombres de las personas a quienes está asignada la tarea, sin repetir. */
export function assigneeNames(task: TraceTask): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const assignment of task.assignments || []) {
    const id = String(assignment?.userId || assignment?.user?.id || '').trim();
    const name = cleanName(assignment?.user) || 'Usuario';
    const key = id || name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Recorta un texto a un máximo de caracteres, sin cortar la última palabra a la mitad cuando es posible. */
export function truncateText(value: unknown, max: number): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (max <= 0) return '';
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace >= Math.floor(max * 0.6) ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s,;:.\-–—]+$/u, '')}…`;
}

/** «13/11/26 09:30», o «—» si falta o no es una fecha válida. */
export function shortDateTime(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-NI', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date).replace(',', '');
}

export interface TaskEditor {
  /** Usuario que mira la tarea. */
  id?: string | null;
  /** Administrador de la empresa o de la plataforma. */
  isAdmin?: boolean;
  /** Tiene el permiso «editar» de Tareas (solo cuenta en tareas antiguas sin creador registrado). */
  canEdit?: boolean;
}

/**
 * ¿Puede cambiar el título, la descripción, las fechas o las subtareas? Quien la creó o un administrador.
 * Quien la está haciendo solo comenta, reporta avance y marca subtareas. Igual que `assertTaskContentEditor` del backend.
 */
export function canEditTaskContent(task: { createdById?: string | null; createdBy?: TraceUser | null }, viewer: TaskEditor): boolean {
  if (viewer.isAdmin) return true;
  const creatorId = String(task.createdById || task.createdBy?.id || '').trim();
  if (creatorId) return creatorId === String(viewer.id || '').trim();
  return Boolean(viewer.canEdit);
}

/** Tiempo entre dos momentos en palabras cortas: «45 min», «5 h», «3 d 4 h». Vacío si falta alguno. */
export function durationLabel(from: unknown, to: unknown): string {
  if (!from || !to) return '';
  const start = new Date(String(from)).getTime();
  const end = new Date(String(to)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '';
  const minutes = Math.round((end - start) / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days} d ${rest} h` : `${days} d`;
}

/** Abierta (pendiente o en progreso) con fecha de vencimiento ya pasada. */
export function isTaskOverdue(task: { status?: string | null; dueDate?: string | null }, now: number): boolean {
  const status = String(task.status || 'PENDING').toUpperCase();
  if (!['PENDING', 'IN_PROGRESS'].includes(status) || !task.dueDate) return false;
  const due = new Date(task.dueDate).getTime();
  return Number.isFinite(due) && due < now;
}

/**
 * Vencidas primero (la más atrasada arriba) y luego el resto en el mismo orden en que venían.
 * No cambia el orden por categoría: se aplica dentro de cada lista.
 */
export function sortOverdueFirst<T extends { status?: string | null; dueDate?: string | null }>(tasks: T[], now: number): T[] {
  const overdue: T[] = [];
  const rest: T[] = [];
  for (const task of tasks) (isTaskOverdue(task, now) ? overdue : rest).push(task);
  overdue.sort((a, b) => new Date(String(a.dueDate)).getTime() - new Date(String(b.dueDate)).getTime());
  return [...overdue, ...rest];
}

/** Día local AAAA-MM-DD de una fecha (los filtros por día no deben correrse por la zona horaria). */
export function localDayKey(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

