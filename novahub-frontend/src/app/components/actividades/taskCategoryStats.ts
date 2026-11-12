/**
 * Conteos de tareas por categoría, globales y por persona. Lógica pura: la vista «Por categoría» solo los pinta.
 *
 * Definiciones (se muestran igual en pantalla):
 *  - abierta: no está completada ni cancelada (una tarea «Por aprobar» sigue abierta).
 *  - vencida: abierta con fecha de vencimiento anterior a ahora.
 *  - sin asignar: abierta y nadie la tiene a cargo.
 *  - sin tomar: abierta, con responsable, que sigue en «Pendiente» (nadie la ha empezado).
 */

export interface StatsTask {
  id: string | number;
  status?: string | null;
  dueDate?: string | null;
  categoryId?: string | null;
  assignedToId?: string | null;
  assignments?: Array<{ userId?: string | null; user?: { id?: string | null; name?: string | null } | null }> | null;
}

export interface CountSet {
  total: number;
  open: number;
  overdue: number;
  unassigned: number;
  notStarted: number;
  done: number;
}

export interface PersonStat {
  id: string;
  name: string;
  open: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
}

export const NO_CATEGORY_KEY = '__none__';

const CLOSED = new Set(['COMPLETED', 'CANCELLED']);

export function isOpenTask(task: { status?: string | null }): boolean {
  return !CLOSED.has(String(task.status || '').toUpperCase());
}

export function isOverdueTask(task: StatsTask, now: Date): boolean {
  if (!isOpenTask(task)) return false;
  if (String(task.status || '').toUpperCase() === 'OVERDUE') return true;
  if (!task.dueDate) return false;
  const due = new Date(task.dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

export function taskAssignees(task: StatsTask): Array<{ id: string; name: string }> {
  const seen = new Set<string>();
  const people: Array<{ id: string; name: string }> = [];
  for (const assignment of task.assignments || []) {
    const id = String(assignment?.user?.id || assignment?.userId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    people.push({ id, name: String(assignment?.user?.name || '').trim() || 'Usuario' });
  }
  const direct = String(task.assignedToId || '').trim();
  if (direct && !seen.has(direct)) people.push({ id: direct, name: 'Usuario' });
  return people;
}

export function categoryKeyOf(task: StatsTask): string {
  const key = String(task.categoryId || '').trim().toUpperCase();
  return key || NO_CATEGORY_KEY;
}

const emptyCounts = (): CountSet => ({ total: 0, open: 0, overdue: 0, unassigned: 0, notStarted: 0, done: 0 });

function addTask(counts: CountSet, task: StatsTask, now: Date) {
  counts.total += 1;
  const status = String(task.status || '').toUpperCase();
  if (status === 'COMPLETED') counts.done += 1;
  if (!isOpenTask(task)) return;
  counts.open += 1;
  if (isOverdueTask(task, now)) counts.overdue += 1;
  const assignees = taskAssignees(task);
  if (assignees.length === 0) counts.unassigned += 1;
  else if (status === 'PENDING') counts.notStarted += 1;
}

export function countTasks(tasks: StatsTask[], now: Date = new Date()): CountSet {
  const counts = emptyCounts();
  for (const task of tasks) addTask(counts, task, now);
  return counts;
}

export function countByCategory(tasks: StatsTask[], now: Date = new Date()): Map<string, CountSet> {
  const map = new Map<string, CountSet>();
  for (const task of tasks) {
    const key = categoryKeyOf(task);
    if (!map.has(key)) map.set(key, emptyCounts());
    addTask(map.get(key)!, task, now);
  }
  return map;
}

/**
 * Carga por persona. `knownPeople` agrega a quienes no tienen ninguna tarea abierta
 * para ver de un vistazo quién está libre. Orden: más tareas abiertas primero.
 */
export function countByPerson(
  tasks: StatsTask[],
  knownPeople: Array<{ id: string; name: string }> = [],
  now: Date = new Date(),
): PersonStat[] {
  const map = new Map<string, PersonStat>();
  const ensure = (id: string, name: string) => {
    const current = map.get(id);
    if (current) {
      if (current.name === 'Usuario' && name !== 'Usuario') current.name = name;
      return current;
    }
    const created: PersonStat = { id, name, open: 0, inProgress: 0, notStarted: 0, overdue: 0 };
    map.set(id, created);
    return created;
  };
  for (const person of knownPeople) ensure(String(person.id), person.name || 'Usuario');
  for (const task of tasks) {
    if (!isOpenTask(task)) continue;
    const status = String(task.status || '').toUpperCase();
    const overdue = isOverdueTask(task, now);
    for (const assignee of taskAssignees(task)) {
      const stat = ensure(assignee.id, assignee.name);
      stat.open += 1;
      if (status === 'PENDING') stat.notStarted += 1;
      if (status === 'IN_PROGRESS') stat.inProgress += 1;
      if (overdue) stat.overdue += 1;
    }
  }
  return [...map.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name, 'es'));
}

/** «3 tareas», «1 tarea», «Sin tareas». */
export function taskCountLabel(count: number): string {
  if (count === 0) return 'Sin tareas';
  return count === 1 ? '1 tarea' : `${count} tareas`;
}
