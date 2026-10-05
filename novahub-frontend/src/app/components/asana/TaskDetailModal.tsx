import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../services/api';
import { invalidateTenantQueries, useTenantQuery } from '../../hooks/useTenantQuery';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'BLOCKED' | 'COMPLETED';
export type TaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type Subtask = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate?: string | null;
  completedAt?: string | null;
};

export type Comment = {
  id: string;
  content: string;
  createdAt: string;
  authorId?: string;
  author?: { id: string; name?: string; email?: string };
};

export type TaskDetail = {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  sectionId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number;
  estimatedHours?: number;
  loggedHours?: number;
  createdAt: string;
  subtasks?: Subtask[];
  comments?: Comment[];
};

type Section = { id: string; name: string };

type TaskDetailModalProps = {
  boardId: string;
  taskId: string | null;
  sections: Section[];
  canEdit: boolean;
  canDelete: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: () => void;
};

const STATUS_LABELS: Record<TaskStatus, { label: string; color: string }> = {
  TODO: { label: 'Por hacer', color: 'bg-muted text-muted-foreground' },
  IN_PROGRESS: { label: 'En curso', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  REVIEW: { label: 'En revisión', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  BLOCKED: { label: 'Bloqueado', color: 'bg-destructive/10 text-destructive' },
  COMPLETED: { label: 'Completado', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const PRIORITY_LABELS: Record<TaskPriority, { label: string; color: string }> = {
  NONE: { label: 'Sin prioridad', color: 'bg-muted text-muted-foreground' },
  LOW: { label: 'Baja', color: 'bg-slate-500/10 text-slate-600' },
  MEDIUM: { label: 'Media', color: 'bg-sky-500/10 text-sky-600' },
  HIGH: { label: 'Alta', color: 'bg-amber-500/10 text-amber-600' },
  URGENT: { label: 'Urgente', color: 'bg-rose-500/10 text-rose-600' },
};

export function TaskDetailModal({
  boardId,
  taskId,
  sections,
  canEdit,
  canDelete,
  open,
  onOpenChange,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  // Consulta el detalle completo de la tarea desde el backend
  const taskQuery = useTenantQuery<TaskDetail | null>(
    ['asana', 'board', boardId, 'task', taskId],
    async () => {
      if (!boardId || !taskId) return null;
      return await api.get<TaskDetail>(`/asana/boards/${boardId}/tasks/${taskId}`);
    },
    { enabled: Boolean(boardId && taskId && open) }
  );

  const task = taskQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-6">
        {taskQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            Cargando detalles de la tarea...
          </div>
        ) : !task ? (
          <div className="py-8 text-center text-muted-foreground">
            No se encontró la tarea seleccionada.
          </div>
        ) : (
          <TaskDetailBody
            key={task.id}
            task={task}
            boardId={boardId}
            sections={sections}
            canEdit={canEdit}
            canDelete={canDelete}
            onRefetch={() => void taskQuery.refetch()}
            onClose={() => onOpenChange(false)}
            onTaskUpdated={onTaskUpdated}
            onTaskDeleted={onTaskDeleted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type TaskDetailBodyProps = {
  task: TaskDetail;
  boardId: string;
  sections: Section[];
  canEdit: boolean;
  canDelete: boolean;
  onRefetch: () => void;
  onClose: () => void;
  onTaskUpdated?: () => void;
  onTaskDeleted?: () => void;
};

// Componente montado con key={task.id} para inicialización pura de estado sin useEffect
function TaskDetailBody({
  task,
  boardId,
  sections,
  canEdit,
  canDelete,
  onRefetch,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailBodyProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [newComment, setNewComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Mutación para actualizar propiedades generales de la tarea
  const updateTask = useMutation({
    mutationFn: (changes: Partial<TaskDetail>) =>
      api.patch(`/asana/boards/${boardId}/tasks/${task.id}`, changes),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      onTaskUpdated?.();
      toast.success('Tarea actualizada');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al actualizar la tarea';
      toast.error(msg);
    },
  });

  // Mutación para mover la tarea a otra sección
  const moveSection = useMutation({
    mutationFn: (sectionId: string) =>
      api.post(`/asana/boards/${boardId}/tasks/move`, { taskId: task.id, sectionId }),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      onTaskUpdated?.();
      toast.success('Sección actualizada');
    },
    onError: () => toast.error('No se pudo cambiar la sección'),
  });

  // Mutación para crear una subtarea con fecha opcional
  const createSubtask = useMutation({
    mutationFn: ({ title: subtaskTitle, dueDate }: { title: string; dueDate?: string | null }) =>
      api.post(`/asana/boards/${boardId}/tasks`, {
        title: subtaskTitle,
        parentTaskId: task.id,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      setNewSubtaskTitle('');
      setNewSubtaskDueDate('');
      onTaskUpdated?.();
      toast.success('Subtarea agregada');
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al crear subtarea';
      toast.error(msg);
    },
  });

  // Mutación para actualizar fecha de subtarea
  const updateSubtaskDate = useMutation({
    mutationFn: ({ subtaskId, dueDate }: { subtaskId: string; dueDate?: string | null }) =>
      api.patch(`/asana/boards/${boardId}/tasks/${subtaskId}`, {
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      onTaskUpdated?.();
    },
    onError: () => toast.error('No se pudo actualizar la fecha de la subtarea'),
  });

  // Mutación para eliminar subtarea
  const deleteSubtask = useMutation({
    mutationFn: (subtaskId: string) =>
      api.delete(`/asana/boards/${boardId}/tasks/${subtaskId}`),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      onTaskUpdated?.();
      toast.success('Subtarea eliminada');
    },
    onError: () => toast.error('No se pudo eliminar la subtarea'),
  });

  // Mutación para cambiar estado de subtarea
  const toggleSubtask = useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) =>
      api.patch(`/asana/boards/${boardId}/tasks/${subtaskId}`, {
        status: completed ? 'COMPLETED' : 'TODO',
      }),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      onTaskUpdated?.();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al actualizar subtarea';
      toast.error(msg);
    },
  });

  // Mutación para publicar un comentario
  const addComment = useMutation({
    mutationFn: (content: string) =>
      api.post(`/asana/boards/${boardId}/tasks/${task.id}/comments`, { content }),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onRefetch();
      setNewComment('');
      toast.success('Comentario agregado');
    },
    onError: () => toast.error('No se pudo publicar el comentario'),
  });

  // Mutación para eliminar la tarea
  const deleteTask = useMutation({
    mutationFn: () => api.delete(`/asana/boards/${boardId}/tasks/${task.id}`),
    onSuccess: () => {
      invalidateTenantQueries(queryClient);
      onClose();
      onTaskDeleted?.();
      toast.success('Tarea eliminada');
    },
    onError: () => toast.error('No se pudo eliminar la tarea'),
  });

  const handleTitleBlur = () => {
    if (title.trim() && title.trim() !== task.title) {
      updateTask.mutate({ title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (task.description || '')) {
      updateTask.mutate({ description: description.trim() || null });
    }
  };

  const handleStatusChange = (status: TaskStatus) => {
    updateTask.mutate({ status });
  };

  const handlePriorityChange = (priority: TaskPriority) => {
    updateTask.mutate({ priority });
  };

  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'COMPLETED').length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  return (
    <div className="space-y-6">
      {/* Cabecera con título editable y estado */}
      <DialogHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                handleStatusChange(task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED')
              }
              disabled={!canEdit || updateTask.isPending}
              className="text-muted-foreground hover:text-primary transition"
              title={task.status === 'COMPLETED' ? 'Marcar incompleta' : 'Marcar completada'}
            >
              {task.status === 'COMPLETED' ? (
                <CheckCircle2 className="size-5 text-emerald-500" />
              ) : (
                <Circle className="size-5" />
              )}
            </button>
            <Badge className={STATUS_LABELS[task.status]?.color}>
              {STATUS_LABELS[task.status]?.label || task.status}
            </Badge>
            <Badge className={PRIORITY_LABELS[task.priority]?.color}>
              <Flag className="mr-1 size-3" />
              {PRIORITY_LABELS[task.priority]?.label || task.priority}
            </Badge>
          </div>

          {canDelete && (
            <div className="flex items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-xs text-destructive">¿Eliminar tarea?</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleteTask.isPending}
                    onClick={() => deleteTask.mutate()}
                  >
                    {deleteTask.isPending ? <Loader2 className="size-3 animate-spin" /> : 'Confirmar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancelar
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  title="Eliminar tarea"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogTitle className="text-xl">
          <Input
            value={title}
            disabled={!canEdit || updateTask.isPending}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Título de la tarea"
            className="text-xl font-bold border-transparent hover:border-border focus:border-primary px-1 -mx-1"
          />
        </DialogTitle>
        <DialogDescription className="sr-only">
          Detalle y edición de la tarea de Asana
        </DialogDescription>
      </DialogHeader>

      {/* Cuadrícula de 2 columnas: contenido y propiedades */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Descripción, Subtareas y Comentarios */}
        <div className="lg:col-span-2 space-y-6">
          {/* Descripción */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Descripción
            </label>
            <Textarea
              value={description}
              disabled={!canEdit || updateTask.isPending}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Escribe una descripción detallada o notas..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Subtareas / Checklist */}
          <div className="space-y-3 rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subtareas {totalSubtasks > 0 && `(${completedSubtasks}/${totalSubtasks})`}
              </span>
              {totalSubtasks > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {Math.round((completedSubtasks / totalSubtasks) * 100)}%
                </span>
              )}
            </div>

            {/* Barra de progreso de subtareas */}
            {totalSubtasks > 0 && (
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(completedSubtasks / totalSubtasks) * 100}%` }}
                />
              </div>
            )}

            {/* Lista de subtareas */}
            <div className="space-y-1.5">
              {task.subtasks?.map((subtask) => {
                const isDone = subtask.status === 'COMPLETED';
                return (
                  <div
                    key={subtask.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-background border hover:border-primary/40 transition group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        disabled={!canEdit || toggleSubtask.isPending}
                        onClick={() =>
                          toggleSubtask.mutate({
                            subtaskId: subtask.id,
                            completed: !isDone,
                          })
                        }
                        className="text-muted-foreground hover:text-primary transition shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        ) : (
                          <Circle className="size-4" />
                        )}
                      </button>
                      <span
                        className={`text-sm truncate flex-1 ${
                          isDone ? 'line-through text-muted-foreground' : 'font-medium'
                        }`}
                      >
                        {subtask.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Configuración de fecha límite para la subtarea */}
                      <Input
                        type="date"
                        disabled={!canEdit || updateSubtaskDate.isPending}
                        value={subtask.dueDate ? subtask.dueDate.substring(0, 10) : ''}
                        onChange={(e) =>
                          updateSubtaskDate.mutate({
                            subtaskId: subtask.id,
                            dueDate: e.target.value || null,
                          })
                        }
                        className="h-7 w-32 text-[11px] px-1.5"
                        title="Fecha límite de la subtarea"
                      />

                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deleteSubtask.isPending}
                          onClick={() => deleteSubtask.mutate(subtask.id)}
                          className="size-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition"
                          title="Eliminar subtarea"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Agregar subtarea con fecha opcional */}
            {canEdit && (
              <form
                className="flex flex-wrap gap-2 pt-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newSubtaskTitle.trim()) {
                    createSubtask.mutate({
                      title: newSubtaskTitle.trim(),
                      dueDate: newSubtaskDueDate || null,
                    });
                  }
                }}
              >
                <Input
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Nueva subtarea..."
                  className="h-9 text-sm flex-1 min-w-[180px]"
                  disabled={createSubtask.isPending}
                />
                <Input
                  type="date"
                  value={newSubtaskDueDate}
                  onChange={(e) => setNewSubtaskDueDate(e.target.value)}
                  className="h-9 w-36 text-xs"
                  placeholder="Fecha entrega"
                  disabled={createSubtask.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!newSubtaskTitle.trim() || createSubtask.isPending}
                >
                  {createSubtask.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Comentarios */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <MessageSquare className="size-4" />
              Comentarios ({task.comments?.length || 0})
            </div>

            {/* Lista de comentarios */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {task.comments?.map((comment) => (
                <div key={comment.id} className="rounded-xl border p-3 bg-card text-sm space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {comment.author?.name || 'Colaborador'}
                    </span>
                    <span>{new Date(comment.createdAt).toLocaleString('es-NI')}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{comment.content}</p>
                </div>
              ))}
              {!task.comments?.length && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No hay comentarios todavía. Inicia la conversación.
                </p>
              )}
            </div>

            {/* Formulario nuevo comentario */}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newComment.trim()) {
                  addComment.mutate(newComment.trim());
                }
              }}
            >
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                className="text-sm"
                disabled={addComment.isPending}
              />
              <Button
                type="submit"
                disabled={!newComment.trim() || addComment.isPending}
                size="sm"
              >
                {addComment.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Columna Derecha: Propiedades y Metadatos */}
        <div className="space-y-4 rounded-xl border p-4 bg-muted/10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Propiedades
          </h3>

          {/* Sección / Columna */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Sección / Columna</label>
            <select
              value={task.sectionId || ''}
              disabled={!canEdit || moveSection.isPending}
              onChange={(e) => moveSection.mutate(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sin sección</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Estado</label>
            <select
              value={task.status}
              disabled={!canEdit || updateTask.isPending}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="TODO">Por hacer</option>
              <option value="IN_PROGRESS">En curso</option>
              <option value="REVIEW">En revisión</option>
              <option value="BLOCKED">Bloqueado</option>
              <option value="COMPLETED">Completado</option>
            </select>
          </div>

          {/* Prioridad */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prioridad</label>
            <select
              value={task.priority}
              disabled={!canEdit || updateTask.isPending}
              onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="NONE">Sin prioridad</option>
              <option value="LOW">Baja</option>
              <option value="MEDIUM">Media</option>
              <option value="HIGH">Alta</option>
              <option value="URGENT">Urgente</option>
            </select>
          </div>

          {/* Fecha de inicio */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> Fecha inicio
            </label>
            <Input
              type="date"
              disabled={!canEdit || updateTask.isPending}
              value={task.startDate ? task.startDate.substring(0, 10) : ''}
              onChange={(e) =>
                updateTask.mutate({ startDate: e.target.value || null })
              }
              className="h-9 text-sm"
            />
          </div>

          {/* Fecha de entrega */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="size-3" /> Fecha de entrega
            </label>
            <Input
              type="date"
              disabled={!canEdit || updateTask.isPending}
              value={task.dueDate ? task.dueDate.substring(0, 10) : ''}
              onChange={(e) =>
                updateTask.mutate({ dueDate: e.target.value || null })
              }
              className="h-9 text-sm"
            />
          </div>

          {/* Horas estimadas y registradas */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> Est. (hrs)
              </label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={!canEdit || Boolean(totalSubtasks) || updateTask.isPending}
                value={task.estimatedHours ?? 0}
                onChange={(e) =>
                  updateTask.mutate({ estimatedHours: Number(e.target.value) || 0 })
                }
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="size-3" /> Reg. (hrs)
              </label>
              <Input
                type="number"
                step="0.5"
                min="0"
                disabled={!canEdit || Boolean(totalSubtasks) || updateTask.isPending}
                value={task.loggedHours ?? 0}
                onChange={(e) =>
                  updateTask.mutate({ loggedHours: Number(e.target.value) || 0 })
                }
                className="h-9 text-sm"
              />
            </div>
          </div>

          {/* Avance % */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Avance</span>
              <span>{Number(task.progress ?? 0)}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, Number(task.progress ?? 0))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
