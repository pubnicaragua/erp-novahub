import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Flag,
  GitFork,
  Loader2,
  Plus,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';

type Section = { id: string; name: string; color?: string | null; sortOrder: number };
type Task = {
  id: string;
  title: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  progress?: number;
};

type BoardListViewProps = {
  sections: Section[];
  tasks: Task[];
  canCreateTask: boolean;
  canEditTask: boolean;
  quickTitles: Record<string, string>;
  creating: boolean;
  onTitleChange: (sectionId: string, title: string) => void;
  onCreateTask: (sectionId: string, title: string) => void;
  onCreateSubtask?: (parentTaskId: string, title: string) => void;
  onToggleTask: (taskId: string, currentStatus?: string) => void;
  onSelectTask: (taskId: string) => void;
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  TODO: { label: 'Por hacer', color: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  REVIEW: { label: 'En revisión', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  BLOCKED: { label: 'Bloqueado', color: 'bg-destructive/10 text-destructive' },
  COMPLETED: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  NONE: { label: 'Sin prioridad', color: 'bg-muted text-muted-foreground' },
  LOW: { label: 'Baja', color: 'bg-slate-500/10 text-slate-600' },
  MEDIUM: { label: 'Media', color: 'bg-sky-500/10 text-sky-600' },
  HIGH: { label: 'Alta', color: 'bg-amber-500/10 text-amber-600' },
  URGENT: { label: 'Urgente', color: 'bg-rose-500/10 text-rose-600' },
};

export function BoardListView({
  sections,
  tasks,
  canCreateTask,
  canEditTask,
  quickTitles,
  creating,
  onTitleChange,
  onCreateTask,
  onCreateSubtask,
  onToggleTask,
  onSelectTask,
}: BoardListViewProps) {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [subtaskInputs, setSubtaskInputs] = useState<Record<string, string>>({});

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleSubtaskSubmit = (parentTaskId: string, e: React.FormEvent) => {
    e.preventDefault();
    const title = subtaskInputs[parentTaskId]?.trim();
    if (title && onCreateSubtask) {
      onCreateSubtask(parentTaskId, title);
      setSubtaskInputs((prev) => ({ ...prev, [parentTaskId]: '' }));
    }
  };

  // Tareas raíz sin sección
  const unsectionedTasks = tasks.filter(
    (t) => !t.parentTaskId && (!t.sectionId || !sections.some((s) => s.id === t.sectionId))
  );

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        // Filtra tareas principales de esta sección (excluye subtareas del nivel raíz)
        const sectionRootTasks = tasks.filter(
          (t) => t.sectionId === section.id && !t.parentTaskId
        );
        const isCollapsed = collapsedSections[section.id];
        const title = quickTitles[section.id] || '';

        return (
          <div key={section.id} className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            {/* Encabezado de la Sección */}
            <div
              className="flex items-center justify-between p-3.5 bg-muted/30 cursor-pointer select-none hover:bg-muted/50 transition"
              onClick={() => toggleSection(section.id)}
            >
              <div className="flex items-center gap-2">
                {isCollapsed ? (
                  <ChevronRight className="size-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 text-muted-foreground" />
                )}
                <h3 className="font-semibold text-sm">{section.name}</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground font-medium">
                  {sectionRootTasks.length}
                </span>
              </div>
            </div>

            {/* Lista de Tareas y Subtareas en árbol (Estilo Asana Image 2) */}
            {!isCollapsed && (
              <div className="divide-y divide-border/60">
                {sectionRootTasks.map((task) => {
                  const isDone = task.status === 'COMPLETED';
                  const priority = PRIORITY_MAP[task.priority || 'NONE'];
                  const status = STATUS_MAP[task.status || 'TODO'];

                  // Subtareas asociadas a esta tarea
                  const taskSubtasks = tasks.filter((t) => t.parentTaskId === task.id);
                  const hasSubtasks = taskSubtasks.length > 0;
                  const isExpanded = expandedTasks[task.id];

                  return (
                    <div key={task.id} className="divide-y divide-border/30">
                      {/* Fila Principal de la Tarea */}
                      <div
                        className="group flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/20 transition cursor-pointer"
                        onClick={() => onSelectTask(task.id)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {/* Botón desplegable si tiene subtareas (Image 2) */}
                          {hasSubtasks ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskExpansion(task.id);
                              }}
                              className="size-6 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition"
                              title={isExpanded ? 'Ocultar subtareas' : 'Mostrar subtareas'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                          ) : (
                            <div className="w-6 shrink-0" />
                          )}

                          {/* Checkbox de estado */}
                          <button
                            type="button"
                            disabled={!canEditTask}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTask(task.id, task.status);
                            }}
                            className="text-muted-foreground hover:text-primary transition shrink-0"
                            title={isDone ? 'Marcar incompleta' : 'Marcar completada'}
                          >
                            {isDone ? (
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            ) : (
                              <Circle className="size-4" />
                            )}
                          </button>

                          {/* Título de tarea */}
                          <span
                            className={`text-sm truncate font-medium ${
                              isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {task.title}
                          </span>

                          {/* Badge de cantidad de subtareas con ícono (Image 2: 2 ⑂) */}
                          {hasSubtasks && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded cursor-pointer hover:bg-muted transition"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskExpansion(task.id);
                              }}
                              title={`${taskSubtasks.length} subtareas`}
                            >
                              <span>{taskSubtasks.length}</span>
                              <GitFork className="size-3 rotate-180" />
                            </span>
                          )}
                        </div>

                        {/* Metadatos y badges */}
                        <div className="flex items-center gap-3 shrink-0">
                          {task.dueDate && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="size-3" />
                              {new Date(task.dueDate).toLocaleDateString('es-NI')}
                            </span>
                          )}

                          {priority && task.priority !== 'NONE' && (
                            <Badge className={`${priority.color} text-xs`}>
                              <Flag className="mr-1 size-2.5" />
                              {priority.label}
                            </Badge>
                          )}

                          {status && (
                            <Badge className={`${status.color} text-xs`}>
                              {status.label}
                            </Badge>
                          )}

                          {task.progress !== undefined && Number(task.progress) > 0 && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground w-16">
                              <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.min(100, Number(task.progress))}%` }}
                                />
                              </div>
                              <span className="text-[10px]">{Number(task.progress)}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Subtareas Desplegadas Indentadas (Estilo Asana Image 2) */}
                      {isExpanded && (
                        <div className="bg-muted/10 pl-11 pr-3 py-1 space-y-1 border-l-2 border-primary/20 ml-6 my-1">
                          {taskSubtasks.map((subtask) => {
                            const subtaskDone = subtask.status === 'COMPLETED';
                            return (
                              <div
                                key={subtask.id}
                                className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition cursor-pointer"
                                onClick={() => onSelectTask(subtask.id)}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <button
                                    type="button"
                                    disabled={!canEditTask}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleTask(subtask.id, subtask.status);
                                    }}
                                    className="text-muted-foreground hover:text-primary transition shrink-0"
                                  >
                                    {subtaskDone ? (
                                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                                    ) : (
                                      <Circle className="size-3.5" />
                                    )}
                                  </button>
                                  <span
                                    className={`text-xs truncate ${
                                      subtaskDone
                                        ? 'line-through text-muted-foreground'
                                        : 'font-medium'
                                    }`}
                                  >
                                    {subtask.title}
                                  </span>
                                </div>

                                {subtask.dueDate && (
                                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Calendar className="size-2.5" />
                                    {new Date(subtask.dueDate).toLocaleDateString('es-NI')}
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          {/* Añadir subtarea en línea (Image 2: Add task...) */}
                          {canCreateTask && onCreateSubtask && (
                            <form
                              className="flex gap-2 pt-1 pb-1"
                              onSubmit={(e) => handleSubtaskSubmit(task.id, e)}
                            >
                              <Input
                                value={subtaskInputs[task.id] || ''}
                                onChange={(e) =>
                                  setSubtaskInputs((prev) => ({
                                    ...prev,
                                    [task.id]: e.target.value,
                                  }))
                                }
                                placeholder="Añadir subtarea..."
                                className="h-7 text-xs bg-background"
                              />
                              <Button
                                type="submit"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                disabled={!subtaskInputs[task.id]?.trim()}
                              >
                                <Plus className="size-3" />
                              </Button>
                            </form>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {!sectionRootTasks.length && (
                  <p className="p-4 text-xs text-muted-foreground text-center">
                    No hay tareas en esta sección.
                  </p>
                )}

                {/* Formulario rápido para añadir tarea en la sección */}
                {canCreateTask && (
                  <form
                    className="flex gap-2 p-2.5 bg-background"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (title.trim()) {
                        onCreateTask(section.id, title.trim());
                      }
                    }}
                  >
                    <Input
                      value={title}
                      onChange={(e) => onTitleChange(section.id, e.target.value)}
                      placeholder="+ Añadir tarea a esta sección..."
                      className="h-8 text-xs border-transparent hover:border-input focus:border-primary"
                      disabled={creating}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      disabled={!title.trim() || creating}
                    >
                      {creating ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Si hay tareas sin sección asignada */}
      {unsectionedTasks.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
          <div className="p-3.5 bg-muted/30">
            <h3 className="font-semibold text-sm text-muted-foreground">Sin sección</h3>
          </div>
          <div className="divide-y divide-border/60">
            {unsectionedTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 hover:bg-muted/20 cursor-pointer"
                onClick={() => onSelectTask(task.id)}
              >
                <span className="text-sm font-medium">{task.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
