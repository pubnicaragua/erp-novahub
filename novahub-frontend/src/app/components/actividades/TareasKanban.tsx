import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { GripVertical, Eye, Clock, CheckCircle2, AlertTriangle, ShieldCheck, UserCheck } from 'lucide-react';
import { cn } from '../ui/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { Task } from '../../types';
import { format } from 'date-fns';

export interface TaskKanbanColumn {
  id: string;
  label: string;
  status: string;
  color: string;
  bgBadge: string;
}

const KANBAN_COLUMNS: TaskKanbanColumn[] = [
  { id: 'col_pending', label: 'Pendiente', status: 'PENDING', color: '#f59e0b', bgBadge: 'bg-amber-500/10 text-amber-500' },
  { id: 'col_in_progress', label: 'En Progreso', status: 'IN_PROGRESS', color: '#3b82f6', bgBadge: 'bg-blue-500/10 text-blue-500' },
  { id: 'col_waiting_approval', label: 'Por Aprobar', status: 'WAITING_APPROVAL', color: '#a855f7', bgBadge: 'bg-purple-500/10 text-purple-500' },
  { id: 'col_completed', label: 'Completada', status: 'COMPLETED', color: '#10b981', bgBadge: 'bg-emerald-500/10 text-emerald-500' },
];

interface TareasKanbanProps {
  data: Task[];
  onViewDetail: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  onSubmitApproval?: (task: Task) => void;
  onApprove?: (task: Task) => void;
  canEdit: boolean;
  canApprove: boolean;
}

export const TareasKanban: React.FC<TareasKanbanProps> = ({
  data,
  onViewDetail,
  onStatusChange,
  onSubmitApproval,
  onApprove,
  canEdit,
  canApprove,
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDragOverColId(null);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColId(colId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverColId((prev) => (prev === colId ? null : prev));
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetColumn: TaskKanbanColumn) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      setDraggedTaskId(null);
      setDragOverColId(null);

      if (!taskId) return;
      const task = data.find((t) => String(t.id) === String(taskId));
      if (!task) return;

      const currentStatus = String(task.status || 'PENDING').toUpperCase();
      const targetStatus = targetColumn.status;

      if (currentStatus === targetStatus) return;

      // Special transitions:
      // 1. Dropping into WAITING_APPROVAL triggers approval submission modal
      if (targetStatus === 'WAITING_APPROVAL' && onSubmitApproval) {
        onSubmitApproval(task);
        return;
      }

      // 2. Dropping into COMPLETED requires approve permission if coming from WAITING_APPROVAL
      if (targetStatus === 'COMPLETED') {
        if (currentStatus === 'WAITING_APPROVAL' && onApprove) {
          onApprove(task);
          return;
        }
      }

      if (canEdit) {
        await onStatusChange(taskId, targetStatus);
      }
    },
    [data, canEdit, onStatusChange, onSubmitApproval, onApprove]
  );

  const columnTasks = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      PENDING: [],
      IN_PROGRESS: [],
      WAITING_APPROVAL: [],
      COMPLETED: [],
    };

    data.forEach((task) => {
      const status = String(task.status || 'PENDING').toUpperCase();
      if (grouped[status]) {
        grouped[status].push(task);
      } else {
        grouped.PENDING.push(task);
      }
    });

    return grouped;
  }, [data]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 p-4 overflow-x-auto min-h-[600px]">
      {KANBAN_COLUMNS.map((col) => {
        const tasks = columnTasks[col.status] || [];
        const isDragOver = dragOverColId === col.id;

        return (
          <div
            key={col.id}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={(e) => handleDragEnter(e, col.id)}
            onDragLeave={(e) => handleDragLeave(e, col.id)}
            onDrop={(e) => handleDrop(e, col)}
            className={cn(
              'flex flex-col rounded-3xl border border-border/50 bg-card/60 p-3 transition-colors duration-200 min-h-[500px]',
              isDragOver && 'border-primary/60 bg-primary/[0.04] ring-2 ring-primary/20'
            )}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-2 py-2 mb-2 border-b border-border/40">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  {col.label}
                </h3>
              </div>
              <Badge variant="outline" className={cn('text-[10px] font-black border-none', col.bgBadge)}>
                {tasks.length}
              </Badge>
            </div>

            {/* Task list in column */}
            <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5">
              {tasks.length === 0 && (
                <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border/40 text-[11px] text-muted-foreground/60">
                  Sin tareas en esta etapa
                </div>
              )}
              {tasks.map((task) => {
                const isDragging = draggedTaskId === String(task.id);
                const subtasks = task.subtasks || [];
                const completedSubtasks = subtasks.filter((s: any) => s.isCompleted).length;
                const isOverdue =
                  task.dueDate &&
                  new Date(task.dueDate).getTime() < Date.now() &&
                  !['COMPLETED', 'CANCELLED'].includes(String(task.status).toUpperCase());

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: isDragging ? 0.4 : 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    draggable={canEdit}
                    onDragStart={(e) => handleDragStart(e as any, String(task.id))}
                    onDragEnd={handleDragEnd}
                    onClick={() => onViewDetail(task)}
                    className={cn(
                      'group cursor-grab active:cursor-grabbing rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm transition-all duration-150',
                      'hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30',
                      isDragging && 'opacity-40 scale-[0.98]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <GripVertical className="size-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                        <h4 className="text-xs font-bold truncate text-foreground">
                          {task.title}
                        </h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-md text-muted-foreground hover:text-primary shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetail(task);
                        }}
                      >
                        <Eye className="size-3.5" />
                      </Button>
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2.5">
                        {task.description}
                      </p>
                    )}

                    {/* Progress of subtasks */}
                    {subtasks.length > 0 && (
                      <div className="mb-2.5 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Subtareas</span>
                          <span>
                            {completedSubtasks}/{subtasks.length}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${(completedSubtasks / subtasks.length) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Rejection / Approval Banner if applicable */}
                    {task.rejectedReason && col.status === 'IN_PROGRESS' && (
                      <div className="mb-2 rounded-lg bg-rose-500/10 border border-rose-500/20 p-1.5 text-[10px] font-semibold text-rose-600">
                        <AlertTriangle className="size-3 inline mr-1" />
                        Rechazado: {task.rejectedReason}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[10px]">
                      <span
                        className={cn(
                          'flex items-center gap-1 text-muted-foreground',
                          isOverdue && 'font-bold text-rose-600'
                        )}
                      >
                        <Clock className="size-3" />
                        {task.dueDate ? format(new Date(task.dueDate), 'dd/MM HH:mm') : 'Sin fecha'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {task.priority && (
                          <span
                            className={cn(
                              'font-black uppercase text-[9px]',
                              task.priority === 'URGENT' && 'text-rose-500',
                              task.priority === 'HIGH' && 'text-amber-500',
                              task.priority === 'MEDIUM' && 'text-blue-500',
                              task.priority === 'LOW' && 'text-slate-500'
                            )}
                          >
                            {task.priority}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
