import React from 'react';
import { motion } from 'motion/react';
import { Clock, Eye, CheckCircle2, Send, XCircle, Paperclip, Users, Flag, HandHelping, UserCog, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../ui/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import type { Task } from '../../types';
import { SlaBadge } from './SlaBadge';
import { getActivityCategoryLabel } from './actividades.constants';
import { format } from 'date-fns';

interface TareasCardsViewProps {
  data: Task[];
  onViewDetail: (task: Task) => void;
  onSubmitApproval?: (task: Task) => void;
  onApprove?: (task: Task) => void;
  onReject?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  canEdit: boolean;
  canApprove: boolean;
  getTaskDisplayStatus: (task: any) => string;
  /** Categoría activa del filtro del padre: 'ALL' o un slug de ACTIVITY_CATEGORIES. */
  categoryFilter?: string;
  /** Permite limpiar el filtro de categoría desde el estado vacío. */
  onCategoryFilterChange?: (value: string) => void;
  /** Reloj del padre para que el semáforo SLA no diverja de la tabla. */
  now?: Date;
  /** Usuario autenticado: habilita "Tomar Tarea" solo si la tarea no es suya. */
  currentUserId?: string | null;
  isTaskMine?: (task: Task) => boolean;
  canClaimTask?: (task: Task) => boolean;
  isClaiming?: string | null;
  onClaimTask?: (task: Task) => void | Promise<void>;
  onReassignTask?: (task: Task) => void;
}

const statusOpts = [
  { value: 'PENDING', label: 'Pendiente', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400' },
  { value: 'WAITING_APPROVAL', label: 'Por Aprobar', color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'COMPLETED', label: 'Completada', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' },
  { value: 'CANCELLED', label: 'Cancelada', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400' },
  { value: 'OVERDUE', label: 'Vencida', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400' },
];

const priorityOpts = [
  { value: 'LOW', label: 'Baja', color: 'text-muted-foreground bg-muted/60 border-border/50' },
  { value: 'MEDIUM', label: 'Media', color: 'text-primary bg-primary/10 border-primary/20' },
  { value: 'HIGH', label: 'Alta', color: 'text-primary bg-primary/15 border-primary/30 font-bold' },
  { value: 'URGENT', label: 'Urgente', color: 'text-primary bg-primary/20 border-primary/40 font-black' },
];

export const TareasCardsView: React.FC<TareasCardsViewProps> = ({
  data,
  onViewDetail,
  onSubmitApproval,
  onApprove,
  onReject,
  onComplete,
  canEdit,
  canApprove,
  getTaskDisplayStatus,
  categoryFilter = 'ALL',
  onCategoryFilterChange,
  now,
  currentUserId,
  isTaskMine,
  canClaimTask,
  isClaiming,
  onClaimTask,
  onReassignTask,
}) => {
  if (data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border/50 p-8 text-center">
        <p className="text-sm font-semibold text-muted-foreground">No se encontraron tareas con los filtros aplicados</p>
        {categoryFilter !== 'ALL' && onCategoryFilterChange && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onCategoryFilterChange('ALL')}
            className="h-8 gap-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider"
          >
            <RotateCcw className="size-3.5" /> Quitar filtro de categoría
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((task) => {
        const displayStatus = getTaskDisplayStatus(task);
        const statusObj = statusOpts.find((s) => s.value === displayStatus) || statusOpts[0];
        const priorityObj = priorityOpts.find((p) => p.value === (task.priority || '').toUpperCase()) || priorityOpts[1];
        const assignments = task.assignments || [];
        const subtasks = task.subtasks || [];
        const completedSubtasks = subtasks.filter((s: any) => s.isCompleted).length;
        const evidence = task.evidences?.[0];
        const rawStatus = String(task.status || '').toUpperCase();
        const isClosed = rawStatus === 'COMPLETED' || rawStatus === 'CANCELLED';
        const categoryId = String(task.categoryId || '').trim().toUpperCase();
        const isCategoryFiltered = categoryFilter !== 'ALL' && categoryId === categoryFilter;
        const isMine = Boolean(currentUserId) && Boolean(isTaskMine?.(task));
        const showClaim = canEdit && Boolean(onClaimTask) && Boolean(canClaimTask?.(task)) && !isMine;
        const showReassign = canEdit && Boolean(onReassignTask) && !isClosed;

        return (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group min-w-0"
          >
            <Card
              className={cn(
                'flex flex-col justify-between rounded-3xl border-border/60 bg-card/90 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-md',
                isCategoryFiltered && 'border-primary/40'
              )}
            >
              <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                <div>
                  {/* Card Header: Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <Badge variant="outline" className={cn('px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider', statusObj.color)}>
                      {statusObj.label}
                    </Badge>
                    <Badge variant="outline" className={cn('px-2 py-0.5 text-[9px] font-black uppercase tracking-wider', priorityObj.color)}>
                      <Flag className="mr-1 size-3 inline" />
                      {priorityObj.label}
                    </Badge>
                  </div>

                  {/* Semáforo SLA y categoría (§4/§5) */}
                  <div className="mb-2 flex min-w-0 flex-wrap items-center gap-1">
                    <SlaBadge
                      slaDueAt={task.slaDueAt ?? task.dueDate ?? null}
                      status={task.status}
                      showRemaining
                      now={now}
                      className="max-w-full"
                    />
                    {categoryId && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'min-w-0 max-w-full truncate bg-secondary/40 px-2 py-0.5 text-[9px] font-bold uppercase',
                          isCategoryFiltered && 'border-primary/40 text-primary'
                        )}
                      >
                        {getActivityCategoryLabel(categoryId)}
                      </Badge>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3
                    className="text-base font-bold text-foreground hover:text-primary cursor-pointer transition-colors line-clamp-2"
                    onClick={() => onViewDetail(task)}
                  >
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-2">
                  {/* Progress of Subtasks if any */}
                  {subtasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-semibold">
                        <span>Checklist</span>
                        <span>{completedSubtasks}/{subtasks.length}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Assignees */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold">
                      <Users className="size-3.5 text-primary" />
                      {assignments.length > 0 ? (
                        <span className="flex min-w-0 items-center gap-1">
                          <span className="min-w-0 truncate">
                            {assignments[0].user?.name || 'Asignado'} {assignments.length > 1 ? `+${assignments.length - 1}` : ''}
                          </span>
                          {isMine && (
                            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-primary">
                              Tú
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60 italic">Sin asignar</span>
                      )}
                    </span>

                    <span className={cn('flex items-center gap-1 font-medium', displayStatus === 'OVERDUE' && 'font-bold text-rose-600')}>
                      <Clock className="size-3.5" />
                      {task.dueDate ? format(new Date(task.dueDate), 'dd/MM/yy HH:mm') : '—'}
                    </span>
                  </div>

                  {/* Footer & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-xl px-2.5 h-8 text-xs font-bold text-muted-foreground hover:text-foreground"
                      onClick={() => onViewDetail(task)}
                    >
                      <Eye className="mr-1.5 size-3.5" /> Detalle
                    </Button>

                    <div className="flex flex-wrap items-center gap-1">
                      {showClaim && onClaimTask && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          data-testid={`activities-card-claim-${task.id}`}
                          title="Tomar tarea"
                          aria-label="Tomar tarea"
                          disabled={isClaiming === task.id}
                          className="h-8 gap-1 rounded-lg px-2 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-primary/10"
                          onClick={() => void onClaimTask(task)}
                        >
                          {isClaiming === task.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <HandHelping className="size-3.5" />
                          )}
                          Tomar
                        </Button>
                      )}

                      {showReassign && onReassignTask && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Reasignar tarea"
                          aria-label="Reasignar tarea"
                          data-testid={`activities-card-reassign-${task.id}`}
                          className="size-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          onClick={() => onReassignTask(task)}
                        >
                          <UserCog className="size-4" />
                        </Button>
                      )}

                      {['PENDING', 'IN_PROGRESS'].includes(displayStatus) && canEdit && onSubmitApproval && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Enviar a aprobación"
                          className="size-8 rounded-lg text-primary hover:bg-primary/10"
                          onClick={() => onSubmitApproval(task)}
                        >
                          <Send className="size-4" />
                        </Button>
                      )}

                      {displayStatus === 'WAITING_APPROVAL' && canApprove && (
                        <>
                          {onApprove && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Aprobar tarea"
                              className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                              onClick={() => onApprove(task)}
                            >
                              <CheckCircle2 className="size-4" />
                            </Button>
                          )}
                          {onReject && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              title="Rechazar tarea"
                              className="size-8 rounded-lg text-rose-600 hover:bg-rose-500/10"
                              onClick={() => onReject(task)}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          )}
                        </>
                      )}

                      {displayStatus !== 'COMPLETED' && displayStatus !== 'WAITING_APPROVAL' && canApprove && onComplete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          title="Completar tarea"
                          className="size-8 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => onComplete(task)}
                        >
                          <CheckCircle2 className="size-4" />
                        </Button>
                      )}

                      {evidence?.fileUrl && (
                        <a
                          href={evidence.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Ver evidencia"
                          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        >
                          <Paperclip className="size-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
};
