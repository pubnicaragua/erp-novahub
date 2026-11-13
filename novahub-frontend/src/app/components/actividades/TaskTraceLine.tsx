import { UserPlus } from 'lucide-react';
import { cn } from '../ui/utils';
import { buildTaskTrace, shortDateTime, type TraceTask } from './taskTrace';

interface TaskTraceLineProps {
  task: TraceTask;
  className?: string;
}

/** Una línea corta para tarjetas y tableros: quién creó la tarea y cuándo. */
export function TaskTraceLine({ task, className }: TaskTraceLineProps) {
  const created = buildTaskTrace(task)[0];
  const who = created.who || 'Persona no registrada';
  const label = `Creada por ${who} el ${shortDateTime(created.at)}`;
  return (
    <p className={cn('flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground', className)} title={label} data-testid="activities-task-created-by">
      <UserPlus className="size-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">Creó <span className="font-semibold text-foreground/80">{who}</span> · {shortDateTime(created.at)}</span>
    </p>
  );
}
