import { FileText, MessageSquare } from 'lucide-react';
import { cn } from '../ui/utils';
import { getTaskProgress } from './actividades.progress';

interface TaskProgressCellProps {
  task: any;
  className?: string;
}

/** Avance de la tarea en una celda: barra con porcentaje y, debajo, cuántos comentarios y reportes lleva. */
export function TaskProgressCell({ task, className }: TaskProgressCellProps) {
  const progress = getTaskProgress(task);
  const comments = Number(task?._count?.comments || 0);
  const reports = Number(task?._count?.reports || 0);
  const tone = progress.percent >= 100 ? 'bg-success' : 'bg-primary';
  return (
    <div className={cn('min-w-[7rem] space-y-1', className)} title={`Avance ${progress.percent}%`}>
      <div className="flex items-center gap-2">
        <div role="progressbar" aria-label="Avance de la tarea" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${progress.percent}%` }} />
        </div>
        <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">{progress.percent}%</span>
      </div>
      {(comments > 0 || reports > 0) && (
        <div className="flex items-center gap-2.5 text-[10px] font-semibold text-muted-foreground">
          {reports > 0 && <span className="inline-flex items-center gap-1" title={`${reports} ${reports === 1 ? 'reporte' : 'reportes'}`}><FileText className="size-3" aria-hidden="true" />{reports}</span>}
          {comments > 0 && <span className="inline-flex items-center gap-1" title={`${comments} ${comments === 1 ? 'comentario' : 'comentarios'}`}><MessageSquare className="size-3" aria-hidden="true" />{comments}</span>}
        </div>
      )}
    </div>
  );
}
