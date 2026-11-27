// Pausas y rebotes de una tarea, como los muestra la pantalla. Las reglas que mandan están en el backend
// (task-compliance.ts); aquí solo se decide qué se ve. Probado con `npm run test:task-compliance`.

export type ReboundCategory = 'ERROR' | 'SCOPE_CHANGE' | 'BLOCKER' | 'UNCLASSIFIED';
export type PauseReason = 'PRIORITY' | 'WAITING_THIRD_PARTY' | 'BLOCKER';
export type PauseApproval = 'PENDING' | 'APPROVED' | 'REJECTED';

export const REBOUND_CATEGORY_OPTIONS: Array<{ value: Exclude<ReboundCategory, 'UNCLASSIFIED'>; label: string; hint: string }> = [
  { value: 'ERROR', label: 'Error o entrega incompleta', hint: 'Baja el cumplimiento de quien la hizo.' },
  { value: 'SCOPE_CHANGE', label: 'Pedido nuevo o cambio de alcance', hint: 'No afecta el cumplimiento.' },
  { value: 'BLOCKER', label: 'Bloqueo externo', hint: 'No afecta el cumplimiento.' },
];

export const REBOUND_CATEGORY_LABEL: Record<ReboundCategory, string> = {
  ERROR: 'Error o entrega incompleta',
  SCOPE_CHANGE: 'Pedido nuevo o cambio de alcance',
  BLOCKER: 'Bloqueo externo',
  UNCLASSIFIED: 'Sin clasificar',
};

export const PAUSE_REASON_OPTIONS: Array<{ value: PauseReason; label: string; noteLabel: string }> = [
  { value: 'PRIORITY', label: 'Salió algo con más prioridad', noteLabel: 'Explicación (opcional si eliges la tarea)' },
  { value: 'WAITING_THIRD_PARTY', label: 'Esperando a un cliente o tercero', noteLabel: '¿A quién y qué se está esperando?' },
  { value: 'BLOCKER', label: 'Algo la está bloqueando', noteLabel: '¿Qué la está bloqueando?' },
];

export const PAUSE_REASON_LABEL: Record<PauseReason, string> = {
  PRIORITY: 'Salió algo con más prioridad',
  WAITING_THIRD_PARTY: 'Esperando a un cliente o tercero',
  BLOCKER: 'Algo la está bloqueando',
};

export const PAUSE_APPROVAL_LABEL: Record<PauseApproval, string> = {
  PENDING: 'El plazo sigue corriendo: falta aprobar la pausa',
  APPROVED: 'Plazo detenido mientras dure la pausa',
  REJECTED: 'No se aprobó detener el plazo: sigue corriendo',
};

export interface PauseLike {
  id: string;
  reason: string;
  note?: string | null;
  pausedAt: string;
  resumedAt?: string | null;
  approval: string;
  displacedBy?: { id: string; title: string } | null;
}

export interface ComplianceTaskLike {
  status?: string | null;
  dueDate?: string | null;
  pausedAt?: string | null;
  pauses?: PauseLike[] | null;
  rebounds?: Array<{ category?: string | null }> | null;
}

const statusOf = (task?: ComplianceTaskLike | null) => String(task?.status || 'PENDING').toUpperCase();

/** En pausa: tiene la marca y sigue pendiente o en progreso (si ya se entregó, la marca no aplica). */
export function isPausedTask(task?: ComplianceTaskLike | null): boolean {
  return Boolean(task?.pausedAt) && ['PENDING', 'IN_PROGRESS'].includes(statusOf(task));
}

export function openPauseOf<T extends ComplianceTaskLike>(task?: T | null): PauseLike | null {
  if (!isPausedTask(task)) return null;
  return task?.pauses?.find((pause) => !pause.resumedAt) ?? null;
}

/** Solo una pausa aprobada detiene el plazo. */
export function isDeadlineStopped(task?: ComplianceTaskLike | null): boolean {
  return openPauseOf(task)?.approval === 'APPROVED';
}

/**
 * Vencida: abierta, con la fecha pasada y sin una pausa aprobada. Una pausa sin aprobar no la saca de «Vencidas»,
 * para que pausar no sirva para esconder un atraso.
 */
export function isOverdueByDeadline(task: ComplianceTaskLike, now: number = Date.now()): boolean {
  if (!['PENDING', 'IN_PROGRESS'].includes(statusOf(task)) || isDeadlineStopped(task)) return false;
  const due = task.dueDate ? new Date(task.dueDate).getTime() : Number.NaN;
  return Number.isFinite(due) && due < now;
}

/** Qué estado se muestra: «En pausa» gana sobre «Vencida»; el atraso se sigue viendo en el SLA. */
export function displayStatusOf(task: ComplianceTaskLike, now: number = Date.now()): string {
  if (isPausedTask(task)) return 'PAUSED';
  return isOverdueByDeadline(task, now) ? 'OVERDUE' : statusOf(task);
}

/** Si la tarea cumple el filtro de estado de las tarjetas de arriba. */
export function matchesStatusFilter(task: ComplianceTaskLike, filter: string, now: number = Date.now()): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'PAUSED') return isPausedTask(task);
  if (filter === 'OVERDUE') return isOverdueByDeadline(task, now);
  if (filter === 'PENDING' || filter === 'IN_PROGRESS') return statusOf(task) === filter && !isPausedTask(task);
  return statusOf(task) === filter;
}

export function countReboundsByCategory(task?: ComplianceTaskLike | null): { total: number; errors: number; unclassified: number } {
  const list = task?.rebounds ?? [];
  return {
    total: list.length,
    errors: list.filter((r) => String(r.category).toUpperCase() === 'ERROR').length,
    unclassified: list.filter((r) => !r.category || String(r.category).toUpperCase() === 'UNCLASSIFIED').length,
  };
}

/** Texto de una pausa: motivo, qué la desplazó y la explicación. */
export function pauseSummary(pause: PauseLike): string {
  const reason = PAUSE_REASON_LABEL[pause.reason as PauseReason] || 'En pausa';
  const detail = [pause.displacedBy?.title ? `por «${pause.displacedBy.title}»` : '', pause.note || ''].filter(Boolean).join(' · ');
  return detail ? `${reason}: ${detail}` : reason;
}

/** Quien aprueba no puede ser quien tiene la tarea (salvo un administrador). */
export function canReviewTask(assigneeIds: Array<string | null | undefined>, viewer: { id: string; isAdmin: boolean; canApprove: boolean }): boolean {
  if (!viewer.canApprove) return false;
  return viewer.isAdmin || !assigneeIds.some((id) => id && String(id) === viewer.id);
}

/** Quién puede pausar o reanudar: quien la tiene, quien la creó, quien aprueba o un administrador. */
export function canPauseTaskAs(
  task: { createdById?: string | null; assignedToId?: string | null; assignments?: Array<{ userId?: string | null }> | null },
  viewer: { id: string; isAdmin: boolean; canApprove: boolean },
): boolean {
  if (viewer.isAdmin || viewer.canApprove) return true;
  if (!viewer.id) return false;
  return [task.createdById, task.assignedToId, ...(task.assignments ?? []).map((a) => a.userId)].some((id) => String(id || '') === viewer.id);
}
