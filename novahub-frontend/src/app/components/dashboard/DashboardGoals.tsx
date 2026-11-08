import { Target } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService, type Goal } from '../../services/performance.service';
import { GoalProgressBar } from '../seguimiento/GoalProgress';
import { GOAL_PACE_LABEL, GOAL_PACE_TONE, formatGoalValue } from '../seguimiento/seguimiento.utils';
import { cn } from '../ui/utils';

const SCOPE_LABEL: Record<string, string> = { USER: 'Personal', DEPARTMENT: 'Departamento', COMPANY: 'Toda la empresa' };

/** Orden de atención: primero lo atrasado o perdido, luego lo que va al día, al final lo ya cumplido. */
const PACE_ORDER: Record<string, number> = { MISSED: 0, BEHIND: 1, ON_TRACK: 2, AHEAD: 3, MET: 4 };

function GoalRow({ goal }: { goal: Goal }) {
  const { evaluation } = goal;
  return (
    <li className="min-w-0 rounded-xl border border-border/60 bg-card/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-[13px] font-semibold">{goal.title}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold', GOAL_PACE_TONE[evaluation.pace])}>{GOAL_PACE_LABEL[evaluation.pace]}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{SCOPE_LABEL[goal.scopeType] ?? goal.scopeType} · {goal.metricLabel}</p>
      <p className="mt-1 text-[12px]"><strong>{formatGoalValue(evaluation.value, goal.unit, goal.currency)}</strong> de {formatGoalValue(goal.targetValue, goal.unit, goal.currency)} <span className="text-muted-foreground">({evaluation.percentOfTarget} %)</span></p>
      <GoalProgressBar goal={goal} />
    </li>
  );
}

/**
 * Metas en el panel de inicio: las que me tocan (personales, de mi departamento o de toda la empresa) y, para quien
 * administra el desempeño, las metas atrasadas del equipo. Si no hay metas, no ocupa lugar.
 */
export function DashboardGoals({ onOpen }: { onOpen?: () => void }) {
  const { canPerform } = useAuth();
  const canSeeTeam = canPerform('HR_PERFORMANCE', 'view');
  const mine = useTenantQuery(['performance', 'goals-mine'], (signal) => performanceService.getMyGoals(signal), { staleTime: 60_000 });
  const team = useTenantQuery(['performance', 'goals-team-dashboard'], (signal) => performanceService.getGoals({ status: 'ACTIVE' }, signal), { enabled: canSeeTeam, staleTime: 60_000 });

  const mineIds = new Set((mine.data ?? []).map((goal) => goal.id));
  const behindTeam = (team.data ?? []).filter((goal) => !mineIds.has(goal.id) && (goal.evaluation.pace === 'BEHIND' || goal.evaluation.pace === 'MISSED'));
  const myGoals = [...(mine.data ?? [])].sort((a, b) => PACE_ORDER[a.evaluation.pace] - PACE_ORDER[b.evaluation.pace]);
  if (mine.isLoading) return <Skeleton className="h-28 w-full rounded-2xl" aria-busy="true" />;
  if (!myGoals.length && !behindTeam.length) return null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm" aria-labelledby="dashboard-goals-title" data-testid="dashboard-goals">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-goals-title" className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Target className="size-4 text-primary" aria-hidden /> Metas</h2>
        {onOpen && <button type="button" onClick={onOpen} className="text-[12px] font-semibold text-primary underline dark:text-accent">Ver todas</button>}
      </div>
      {myGoals.length > 0 && (
        <>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mis metas</p>
          <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{myGoals.map((goal) => <GoalRow key={goal.id} goal={goal} />)}</ul>
        </>
      )}
      {behindTeam.length > 0 && (
        <>
          <p className={cn('mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground', myGoals.length > 0 && 'mt-4')}>Metas del equipo que necesitan atención ({behindTeam.length})</p>
          <ul className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{behindTeam.slice(0, 6).map((goal) => <GoalRow key={goal.id} goal={goal} />)}</ul>
        </>
      )}
    </section>
  );
}
