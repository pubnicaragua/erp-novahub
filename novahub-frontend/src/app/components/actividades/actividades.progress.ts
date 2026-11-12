/**
 * Avance de una tarea, calculado en un solo lugar para que la lista, el tablero y el detalle digan lo mismo.
 * Prioridad: completada = 100 %; con lista de verificación, subtareas hechas; si no, el último porcentaje reportado.
 */
export interface TaskProgress {
  percent: number;
  source: 'completed' | 'subtasks' | 'report' | 'none';
  done?: number;
  total?: number;
}

interface ProgressTask {
  status?: string | null;
  subtasks?: Array<{ isCompleted?: boolean }> | null;
  reports?: Array<{ progressPercent?: number | null }> | null;
}

export function getTaskProgress(task: ProgressTask | null | undefined): TaskProgress {
  const status = String(task?.status || '').toUpperCase();
  const subtasks = Array.isArray(task?.subtasks) ? task.subtasks : [];
  if (status === 'COMPLETED') return { percent: 100, source: 'completed', done: subtasks.filter((s) => s.isCompleted).length, total: subtasks.length };
  if (subtasks.length > 0) {
    const done = subtasks.filter((s) => s.isCompleted).length;
    return { percent: Math.round((done / subtasks.length) * 100), source: 'subtasks', done, total: subtasks.length };
  }
  const reported = Array.isArray(task?.reports) ? task.reports.find((r) => typeof r?.progressPercent === 'number') : undefined;
  if (reported && typeof reported.progressPercent === 'number') {
    return { percent: Math.min(100, Math.max(0, Math.round(reported.progressPercent))), source: 'report' };
  }
  return { percent: 0, source: 'none' };
}

/** Texto corto que explica de dónde sale el porcentaje. */
export function describeProgressSource(progress: TaskProgress): string {
  if (progress.source === 'completed') return 'Tarea completada';
  if (progress.source === 'subtasks') return `${progress.done} de ${progress.total} subtareas`;
  if (progress.source === 'report') return 'Según el último reporte';
  return 'Sin avance reportado';
}
