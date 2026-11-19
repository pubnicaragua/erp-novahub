import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { tasksService } from '../../services/actividades.service';
import type { ActivitySubtask } from '../../types';
import { toast } from 'sonner';
import { cn } from '../ui/utils';

interface SubtasksManagerProps {
  taskId: string;
  subtasks: ActivitySubtask[];
  onSubtasksChange: () => void;
  /** Agregar, quitar o renombrar subtareas: quien creó la tarea o un administrador. */
  canEdit?: boolean;
  /** Marcar una subtarea como hecha: también quien trabaja la tarea. Si no se pasa, sigue a `canEdit`. */
  canToggle?: boolean;
}

export const SubtasksManager: React.FC<SubtasksManagerProps> = ({
  taskId,
  subtasks = [],
  onSubtasksChange,
  canEdit = true,
  canToggle,
}) => {
  const toggleAllowed = canToggle ?? canEdit;
  const [newTitle, setNewTitle] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const completedCount = subtasks.filter((s) => s.isCompleted).length;
  const progressPercent = subtasks.length ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const handleAdd = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTitle.trim() || !canEdit) return;

    try {
      setIsAdding(true);
      await tasksService.addSubtask(taskId, { title: newTitle.trim() });
      setNewTitle('');
      onSubtasksChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al agregar subtarea');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (subtask: ActivitySubtask) => {
    if (!toggleAllowed) return;
    try {
      setLoadingId(subtask.id);
      await tasksService.updateSubtask(taskId, subtask.id, { isCompleted: !subtask.isCompleted });
      onSubtasksChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al actualizar subtarea');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (subtaskId: string) => {
    if (!canEdit) return;
    try {
      setLoadingId(subtaskId);
      await tasksService.deleteSubtask(taskId, subtaskId);
      toast.success('Subtarea eliminada');
      onSubtasksChange();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Error al eliminar subtarea');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/[0.08] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Checklist / Subtareas
          </h4>
          <p className="text-[11px] text-muted-foreground">
            {completedCount} de {subtasks.length} completadas ({progressPercent}%)
          </p>
        </div>
        {subtasks.length > 0 && (
          <div className="w-24 overflow-hidden rounded-full bg-muted h-2">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5 pr-1">
        {subtasks.length === 0 && (
          <p className="text-xs italic text-muted-foreground py-2 text-center">
            No hay subtareas registradas.
          </p>
        )}
        {subtasks.map((st) => (
          <div
            key={st.id}
            className={cn(
              'group flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-card/60 px-3 py-2 text-xs transition-colors',
              st.isCompleted && 'bg-emerald-500/5 border-emerald-500/20 text-muted-foreground'
            )}
          >
            <button
              type="button"
              disabled={!toggleAllowed || loadingId === st.id}
              onClick={() => handleToggle(st)}
              className="flex items-center gap-2 text-left min-w-0 flex-1 hover:opacity-80"
            >
              {loadingId === st.id ? (
                <Loader2 className="size-4 animate-spin text-primary shrink-0" />
              ) : st.isCompleted ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="size-4 text-muted-foreground/50 shrink-0" />
              )}
              <span className={cn('min-w-0 break-words whitespace-normal font-medium [overflow-wrap:anywhere]', st.isCompleted && 'line-through')}>
                {st.title}
              </span>
            </button>

            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Quitar la subtarea ${st.title}`}
                className="size-6 rounded-md text-muted-foreground transition-opacity hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                onClick={() => handleDelete(st.id)}
                disabled={loadingId === st.id}
              >
                <Trash2 className="size-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={handleAdd} className="flex gap-2 pt-1">
          <Input
            placeholder="Nueva subtarea..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-9 text-xs rounded-xl bg-background"
            disabled={isAdding}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isAdding || !newTitle.trim()}
            className="h-9 rounded-xl px-3 text-xs font-bold shrink-0"
          >
            {isAdding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5 mr-1" />}
            Agregar
          </Button>
        </form>
      )}
    </div>
  );
};
