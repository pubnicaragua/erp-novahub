import { PauseCircle, Undo2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { countReboundsByCategory, openPauseOf, pauseSummary, type ComplianceTaskLike } from './taskCompliance';
import { truncateText } from './taskTrace';

interface ComplianceChipsProps {
  task: ComplianceTaskLike;
  /** Muestra debajo por qué está en pausa (tarjetas y tablero). */
  showPauseReason?: boolean;
  /** Donde la columna o el estado ya dicen «En pausa», solo se muestra el motivo. */
  hidePauseBadge?: boolean;
  className?: string;
}

/** Etiquetas de una tarea en una lista, tarjeta o tablero: si está en pausa (y por qué) y cuántas veces la devolvieron. */
export function ComplianceChips({ task, showPauseReason = false, hidePauseBadge = false, className }: ComplianceChipsProps) {
  const pause = openPauseOf(task);
  const rebounds = countReboundsByCategory(task);
  if (!pause && rebounds.total === 0) return null;
  const reason = pause ? pauseSummary(pause) : '';
  const reboundTitle = `Devuelta ${rebounds.total} ${rebounds.total === 1 ? 'vez' : 'veces'}: ${rebounds.errors} por error${rebounds.unclassified ? `, ${rebounds.unclassified} sin clasificar` : ''}`;
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {pause && !hidePauseBadge && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-black uppercase text-violet-700 dark:text-violet-300" title={reason} data-testid="activities-chip-paused">
            <PauseCircle className="size-3" aria-hidden="true" />
            {pause.approval === 'APPROVED' ? 'En pausa · plazo detenido' : 'En pausa'}
          </span>
        )}
        {rebounds.total > 0 && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase',
              rebounds.errors > 0 ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'border-border bg-muted/50 text-muted-foreground',
            )}
            title={reboundTitle}
            data-testid="activities-chip-rebounds"
          >
            <Undo2 className="size-3" aria-hidden="true" />
            Devuelta ×{rebounds.total}
          </span>
        )}
      </div>
      {pause && showPauseReason && (
        <p className="flex min-w-0 items-start gap-1 text-[11px] font-semibold leading-4 text-violet-700 dark:text-violet-300" title={reason} data-testid="activities-pause-reason-line">
          <PauseCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{truncateText(reason, 90)}</span>
        </p>
      )}
    </div>
  );
}
