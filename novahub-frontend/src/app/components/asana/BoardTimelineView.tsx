import { useCallback, useMemo } from 'react';
import { Calendar, Flag, GitFork } from 'lucide-react';

type Task = {
  id: string;
  title: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  status?: string;
  priority?: string;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number;
};

type BoardTimelineViewProps = {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
};

export function BoardTimelineView({ tasks, onSelectTask }: BoardTimelineViewProps) {
  // Construye una cuadrícula de 14 días
  const timelineDays = useMemo(() => {
    const days: Date[] = [];
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 3);

    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const startDateRange = timelineDays[0];
  const endDateRange = timelineDays[timelineDays.length - 1];

  // Helper para calcular el porcentaje de posición en la cuadrícula (0% - 100%)
  const getTimelinePosition = useCallback((dateStr: string) => {
    const d = new Date(dateStr);
    const totalMs = endDateRange.getTime() - startDateRange.getTime();
    const currentMs = d.getTime() - startDateRange.getTime();
    const pct = (currentMs / totalMs) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [startDateRange, endDateRange]);

  // Organiza tareas ordenadas por fecha para calcular conectores de dependencia (Image 3)
  const scheduledTasks = useMemo(() => {
    return tasks
      .filter((t) => Boolean(t.dueDate || t.startDate))
      .sort((a, b) => {
        const dateA = new Date(a.startDate || a.dueDate || 0).getTime();
        const dateB = new Date(b.startDate || b.dueDate || 0).getTime();
        return dateA - dateB;
      });
  }, [tasks]);

  // Calcula las líneas de flecha curva entre tareas consecutivas (Estilo Asana Gantt Image 3)
  const dependencyLinks = useMemo(() => {
    const links: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> = [];
    const ROW_HEIGHT = 48; // Altura fija en px de cada fila

    for (let i = 0; i < scheduledTasks.length - 1; i++) {
      const current = scheduledTasks[i];
      const next = scheduledTasks[i + 1];

      // Posición X fin de la tarea actual
      const currentEnd = current.dueDate || current.startDate;
      const nextStart = next.startDate || next.dueDate;

      if (currentEnd && nextStart) {
        const x1 = Math.min(96, Math.max(4, getTimelinePosition(currentEnd)));
        const x2 = Math.min(96, Math.max(4, getTimelinePosition(nextStart)));
        const y1 = i * ROW_HEIGHT + 24;
        const y2 = (i + 1) * ROW_HEIGHT + 24;

        links.push({
          id: `${current.id}-${next.id}`,
          x1,
          y1,
          x2,
          y2,
        });
      }
    }
    return links;
  }, [scheduledTasks, getTimelinePosition]);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm overflow-hidden space-y-4">
      {/* Controles y leyenda */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <h3 className="font-semibold text-sm">Cronograma y dependencias (Gantt)</h3>
          <span className="text-xs text-muted-foreground">
            {startDateRange.toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })} –{' '}
            {endDateRange.toLocaleDateString('es-NI', { month: 'short', day: 'numeric' })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-sky-500 inline-block" /> En curso
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-emerald-500 inline-block" /> Completada
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-rose-500 inline-block" /> Urgente
          </span>
        </div>
      </div>

      {/* Cuadrícula interactiva estilo Gantt */}
      <div className="overflow-x-auto">
        <div className="min-w-[850px]">
          {/* Encabezado de columnas de fecha */}
          <div className="grid grid-cols-12 gap-1 border-b pb-2 mb-3">
            <div className="col-span-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-2">
              Tarea / Subtarea
            </div>
            <div className="col-span-8 grid grid-cols-14 gap-0 text-center text-xs text-muted-foreground">
              {timelineDays.map((day, idx) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={idx}
                    className={`py-1 rounded text-[11px] font-medium ${
                      isToday ? 'bg-primary/10 text-primary font-bold' : ''
                    }`}
                  >
                    <div>{day.toLocaleDateString('es-NI', { weekday: 'narrow' })}</div>
                    <div>{day.getDate()}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filas de tareas con capa SVG para flechas de dependencia (Image 3) */}
          <div className="relative">
            {/* Capa SVG con flechas curvas entre barras de tareas */}
            <svg
              className="absolute top-0 right-0 h-full pointer-events-none z-10 w-[66.666667%]"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker
                  id="gantt-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#94a3b8" />
                </marker>
              </defs>
              {dependencyLinks.map((link) => {
                // Genera la trayectoria curvada en ángulo suave (Image 3)
                const midX = link.x1 + (link.x2 - link.x1) * 0.5;
                const pathData = `M ${link.x1}% ${link.y1}px C ${midX}% ${link.y1}px, ${midX}% ${link.y2}px, ${link.x2}% ${link.y2}px`;

                return (
                  <path
                    key={link.id}
                    d={pathData}
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    markerEnd="url(#gantt-arrow)"
                    className="opacity-70 dark:opacity-50"
                  />
                );
              })}
            </svg>

            {/* Listado de tareas */}
            <div className="space-y-1">
              {tasks.map((task) => {
                const hasDueDate = Boolean(task.dueDate);
                const hasStartDate = Boolean(task.startDate);
                const isCompleted = task.status === 'COMPLETED';
                const isSubtask = Boolean(task.parentTaskId);

                // Estilo de barra celeste con borde redondeado (Image 3)
                const barBaseClass = isCompleted
                  ? 'bg-emerald-100 border-2 border-emerald-400 text-emerald-900 dark:bg-emerald-950/70 dark:border-emerald-500 dark:text-emerald-200'
                  : task.priority === 'URGENT'
                  ? 'bg-rose-100 border-2 border-rose-400 text-rose-900 dark:bg-rose-950/70 dark:border-rose-500 dark:text-rose-200'
                  : 'bg-sky-100 border-2 border-sky-400 text-sky-900 dark:bg-sky-950/70 dark:border-sky-500 dark:text-sky-200 shadow-sm';

                let leftPct = 0;
                let widthPct = 9; // Ancho predeterminado

                if (hasDueDate && hasStartDate && task.startDate && task.dueDate) {
                  leftPct = getTimelinePosition(task.startDate);
                  const rightPct = getTimelinePosition(task.dueDate);
                  widthPct = Math.max(7, rightPct - leftPct);
                } else if (hasDueDate && task.dueDate) {
                  leftPct = getTimelinePosition(task.dueDate);
                  widthPct = 8;
                }

                return (
                  <div
                    key={task.id}
                    className="grid grid-cols-12 gap-1 items-center h-11 p-1 rounded-xl hover:bg-muted/30 transition group cursor-pointer border border-transparent hover:border-border/60"
                    onClick={() => onSelectTask(task.id)}
                  >
                    {/* Título e indicador de subtarea */}
                    <div className="col-span-4 flex items-center gap-2 pr-2 overflow-hidden">
                      {isSubtask && (
                        <span className="text-muted-foreground pl-3">
                          <GitFork className="size-3 rotate-180 text-muted-foreground/60" />
                        </span>
                      )}
                      <span
                        className={`text-xs font-medium truncate ${
                          isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </span>
                      {task.priority && task.priority !== 'NONE' && (
                        <Flag className="size-3 text-muted-foreground shrink-0" />
                      )}
                    </div>

                    {/* Barra de tiempo horizontal */}
                    <div className="col-span-8 relative h-7 flex items-center bg-muted/10 rounded-lg">
                      {hasDueDate ? (
                        <div
                          className={`absolute h-6 rounded-lg ${barBaseClass} px-2.5 flex items-center justify-between text-[11px] font-semibold transition-all hover:scale-[1.02]`}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            minWidth: '32px',
                          }}
                          title={`${task.title} (${task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-NI') : ''})`}
                        >
                          <span className="truncate">{task.title}</span>
                          {task.progress !== undefined && Number(task.progress) > 0 && (
                            <span className="text-[9px] opacity-75 ml-1">
                              {Number(task.progress)}%
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask(task.id);
                          }}
                          className="text-[11px] text-muted-foreground/70 hover:text-primary transition pl-2"
                        >
                          + Asignar fecha
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {!tasks.length && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No hay tareas registradas en este tablero.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
