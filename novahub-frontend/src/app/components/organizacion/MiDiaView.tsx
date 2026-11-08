import { MessageSquareText, Target } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '../ui/skeleton';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService } from '../../services/performance.service';
import { CheckinResponseForm } from '../seguimiento/CheckinResponseForm';
import { GoalSummary } from '../seguimiento/GoalProgress';
import { TimelineTab } from '../seguimiento/TimelineTab';
import { EmptyState, ErrorState, PageTitle, Panel } from './OrgBits';
import { errorMessage } from './organizacion.utils';
import type { OrgPreferences } from '../../services/organizacion.service';

/** Mi día: lo que me preguntan, lo que he trabajado hora por hora y cómo voy en mis metas. */
export function MiDiaView({ preferences }: { preferences: OrgPreferences }) {
  const client = useQueryClient();
  const pending = useTenantQuery(['performance', 'checkins-pending'], (signal) => performanceService.getPendingCheckins(signal), { staleTime: 15_000 });
  const goals = useTenantQuery(['performance', 'goals-mine'], (signal) => performanceService.getMyGoals(signal), { staleTime: 60_000 });
  const refresh = () => void client.invalidateQueries({ queryKey: ['tenant-module'] });

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle eyebrow="Organización" title="Mi día" subtitle="Responde lo que te pregunten, revisa lo que has trabajado hora por hora y mira cómo vas en tus metas." />

      <Panel title="Preguntas por responder" icon={<MessageSquareText className="size-4" />}>
        {pending.isLoading ? <Skeleton className="h-24 w-full" aria-busy="true" />
          : pending.isError ? <ErrorState message={errorMessage(pending.error, 'No se pudieron cargar tus preguntas')} onRetry={() => void pending.refetch()} />
          : !pending.data?.prompts.length ? <EmptyState title="No tienes preguntas pendientes" description="Cuando te toque responder «¿En qué estás trabajando?» aparecerá aquí y te llegará un aviso." />
          : (
            <div className="space-y-5">
              {pending.data.prompts.map((prompt) => (
                <div key={prompt.id} className="rounded-xl border border-border p-4"><CheckinResponseForm prompt={prompt} tasks={pending.data!.tasks} timeZone={preferences.timezone} onDone={refresh} /></div>
              ))}
            </div>
          )}
      </Panel>

      <Panel title="Mis metas" icon={<Target className="size-4" />}>
        {goals.isLoading ? <Skeleton className="h-28 w-full" aria-busy="true" />
          : goals.isError ? <ErrorState message={errorMessage(goals.error, 'No se pudieron cargar tus metas')} onRetry={() => void goals.refetch()} />
          : !goals.data?.length ? <EmptyState title="Aún no tienes metas" description="Cuando tu empresa te asigne una meta verás aquí tu avance y los bonos que puedes ganar." />
          : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {goals.data.map((goal) => (
                <li key={goal.id} className="min-w-0 rounded-xl border border-border p-4">
                  <p className="mb-2 break-words text-[14px] font-semibold">{goal.title}</p>
                  <GoalSummary goal={goal} />
                </li>
              ))}
            </ul>
          )}
      </Panel>

      <section aria-labelledby="mi-dia-linea">
        <h2 id="mi-dia-linea" className="sr-only">Línea de tiempo de mi día</h2>
        <TimelineTab />
      </section>
    </div>
  );
}
