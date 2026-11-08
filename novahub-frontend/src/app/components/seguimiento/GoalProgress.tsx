import { cn } from '../ui/utils';
import type { Goal } from '../../services/performance.service';
import { BONUS_STATUS_LABEL, GOAL_LEVEL_LABEL, GOAL_PACE_LABEL, GOAL_PACE_TONE, formatGoalValue } from './seguimiento.utils';

/** Barra de avance con marcas en la mínima, la meta y la ambiciosa. La escala llega hasta la meta más alta. */
export function GoalProgressBar({ goal }: { goal: Goal }) {
  const top = Math.max(goal.stretchValue ?? 0, goal.targetValue, goal.evaluation.value, 1);
  const at = (value: number) => `${Math.min(100, (value / top) * 100)}%`;
  const marks = [
    goal.minValue !== null ? { label: GOAL_LEVEL_LABEL.MIN, value: goal.minValue } : null,
    { label: GOAL_LEVEL_LABEL.TARGET, value: goal.targetValue },
    goal.stretchValue !== null ? { label: GOAL_LEVEL_LABEL.STRETCH, value: goal.stretchValue } : null,
  ].filter((mark): mark is { label: string; value: number } => mark !== null);
  const level = goal.evaluation.level;
  return (
    <div className="pt-4" role="img" aria-label={`Avance: ${formatGoalValue(goal.evaluation.value, goal.unit, goal.currency)} de ${formatGoalValue(goal.targetValue, goal.unit, goal.currency)}`}>
      <div className="relative h-2.5 rounded-full bg-muted">
        <div className={cn('h-full rounded-full', level === 'STRETCH' ? 'bg-violet-500' : level === 'TARGET' ? 'bg-emerald-500' : level === 'MIN' ? 'bg-sky-500' : 'bg-amber-500')} style={{ width: at(goal.evaluation.value) }} />
        {marks.map((mark) => (
          <span key={mark.label} className="absolute top-0 h-full w-0.5 bg-foreground/40" style={{ left: at(mark.value) }}>
            <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold text-muted-foreground">{mark.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Resumen de una meta: avance, ritmo, siguiente nivel y bonos. Lo usan «Mi día» y «Metas y bonos». */
export function GoalSummary({ goal }: { goal: Goal }) {
  const { evaluation } = goal;
  const fmt = (value: number | null) => formatGoalValue(value, goal.unit, goal.currency);
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', GOAL_PACE_TONE[evaluation.pace])}>{GOAL_PACE_LABEL[evaluation.pace]}</span>
        {evaluation.level && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary dark:text-accent">Nivel: {GOAL_LEVEL_LABEL[evaluation.level]}</span>}
        <span className="text-[11px] text-muted-foreground">{goal.metricLabel}</span>
      </div>
      <p className="text-[13px]"><strong>{fmt(evaluation.value)}</strong> de {fmt(goal.targetValue)} <span className="text-muted-foreground">({evaluation.percentOfTarget} %)</span></p>
      <GoalProgressBar goal={goal} />
      <p className="text-[11px] text-muted-foreground">
        {evaluation.nextLevel ? `Faltan ${fmt(evaluation.remainingToNext)} para el nivel «${GOAL_LEVEL_LABEL[evaluation.nextLevel]}».` : 'Alcanzó el nivel más alto.'} Ha pasado el {evaluation.elapsedPercent} % del período.
      </p>
      {goal.bonusRules.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Bonos: {goal.bonusRules.map((rule) => `${GOAL_LEVEL_LABEL[rule.level]} ${rule.amount} ${rule.currency}`).join(' · ')}
          {goal.awards.length > 0 && ` — ${goal.awards.map((award) => `${GOAL_LEVEL_LABEL[award.level]}: ${BONUS_STATUS_LABEL[award.status]}`).join(', ')}`}
        </p>
      )}
    </div>
  );
}
