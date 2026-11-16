import { CheckCircle2, Hourglass, Play, Send, UserPlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../ui/utils';
import { buildTaskTrace, durationLabel, shortDateTime, type TraceTask } from './taskTrace';

interface TaskTraceLineProps {
  task: TraceTask;
  className?: string;
  /** Solo la línea de quién la creó (para espacios muy estrechos). */
  compact?: boolean;
}

/**
 * Trazabilidad corta para tarjetas, tableros y listas: quién la creó y cuándo, cuándo la tomaron,
 * cuándo la mandaron a revisión y cuándo se cerró, con cuánto tardó cada paso.
 */
export function TaskTraceLine({ task, className, compact = false }: TaskTraceLineProps) {
  const [created, started, submitted, completed] = buildTaskTrace(task);
  const who = created.who || 'Persona no registrada';
  const status = String(task.status || 'PENDING').toUpperCase();
  const open = status === 'PENDING' || status === 'IN_PROGRESS';
  const waiting = open && !started.done ? durationLabel(created.at, new Date().toISOString()) : '';
  const title = [
    `Creada por ${who} el ${shortDateTime(created.at)}`,
    started.done ? `Tomada${started.who ? ` por ${started.who}` : ''} el ${shortDateTime(started.at)}` : null,
    submitted.done ? `Enviada a revisión el ${shortDateTime(submitted.at)}` : null,
    completed.done ? `Completada el ${shortDateTime(completed.at)}` : null,
  ].filter(Boolean).join(' · ');

  const step = (Icon: typeof UserPlus, text: ReactNode, testId: string, tone?: string) => (
    <p className={cn('flex min-w-0 items-center gap-1.5', tone)} data-testid={testId}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">{text}</span>
    </p>
  );

  return (
    <div className={cn('min-w-0 space-y-0.5 text-[11px] text-muted-foreground', className)} title={title} data-testid="activities-task-created-by">
      {step(UserPlus, <>Creó <span className="font-semibold text-foreground/80">{who}</span> · {shortDateTime(created.at)}</>, 'activities-task-trace-created')}
      {!compact && started.done && step(Play, <>Tomó{started.who ? <> <span className="font-semibold text-foreground/80">{started.who}</span></> : null} · {shortDateTime(started.at)}{durationLabel(created.at, started.at) ? ` (esperó ${durationLabel(created.at, started.at)})` : ''}</>, 'activities-task-trace-started')}
      {!compact && submitted.done && step(Send, <>A revisión · {shortDateTime(submitted.at)}</>, 'activities-task-trace-submitted')}
      {!compact && completed.done && step(CheckCircle2, <>Completada · {shortDateTime(completed.at)}{durationLabel(started.at || created.at, completed.at) ? ` (tardó ${durationLabel(started.at || created.at, completed.at)})` : ''}</>, 'activities-task-trace-completed', 'text-emerald-700 dark:text-emerald-400')}
      {!compact && waiting && step(Hourglass, <>Sin tomar hace {waiting}</>, 'activities-task-trace-waiting', 'font-semibold text-amber-700 dark:text-amber-400')}
    </div>
  );
}
