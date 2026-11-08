import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService } from '../../services/performance.service';
import { EmptyState, ErrorState, NativeSelect, Panel, controlClass } from '../organizacion/OrgBits';
import { errorMessage, formatMinutes } from '../organizacion/organizacion.utils';
import { HourlyTimeline } from './HourlyTimeline';
import { longCivilDate, shiftCivilDate } from './seguimiento.utils';

export interface PersonOption { id: string; name: string }

/** Cuántos días hacia atrás se listan para revisar días anteriores. */
const HISTORY_DAYS = 14;

/**
 * Línea de tiempo por hora de una persona: lo que trabajó en cada hora del día, con navegación a días anteriores.
 * Sin `people` (vista «Mi día») muestra solo a quien tiene la sesión abierta.
 */
export function TimelineTab({ people, selfId }: { people?: PersonOption[]; selfId?: string }) {
  const [userId, setUserId] = useState(people?.[0]?.id ?? '');
  const [date, setDate] = useState<string | null>(null);
  const effectiveUser = people ? userId : undefined;
  const enabled = people ? Boolean(userId) : true;
  const day = useTenantQuery(
    ['performance', 'timeline-day', effectiveUser ?? selfId ?? 'me', date ?? 'today'],
    (signal) => performanceService.getDayTimeline({ userId: effectiveUser, date: date ?? undefined }, signal),
    { enabled, staleTime: 30_000 },
  );
  const current = day.data?.date;
  const range = useTenantQuery(
    ['performance', 'timeline-range', effectiveUser ?? selfId ?? 'me', current ?? ''],
    (signal) => performanceService.getRangeTimeline({ userId: effectiveUser, from: shiftCivilDate(current as string, -(HISTORY_DAYS - 1)), to: current as string }, signal),
    { enabled: enabled && Boolean(current), staleTime: 60_000 },
  );

  if (people && !people.length) return <EmptyState title="No hay personas para mostrar" description="Cuando haya personas a tu cargo aparecerán aquí." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {people && (
          <div className="min-w-48 space-y-1.5">
            <label htmlFor="timeline-person" className="block text-[12px] font-semibold">Persona</label>
            <NativeSelect id="timeline-person" value={userId} onChange={(e) => { setUserId(e.target.value); setDate(null); }}>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </NativeSelect>
          </div>
        )}
        <div className="space-y-1.5">
          <span className="block text-[12px] font-semibold">Día</span>
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="outline" aria-label="Día anterior" disabled={!current} onClick={() => setDate(shiftCivilDate(current as string, -1))}><ChevronLeft className="size-4" /></Button>
            <input type="date" aria-label="Elegir un día" value={current ?? ''} onChange={(e) => e.target.value && setDate(e.target.value)} className={cn(controlClass, 'w-40')} />
            <Button type="button" size="icon" variant="outline" aria-label="Día siguiente" disabled={!current} onClick={() => setDate(shiftCivilDate(current as string, 1))}><ChevronRight className="size-4" /></Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setDate(null)}>Hoy</Button>
          </div>
        </div>
        {current && <p className="pb-2 text-[13px] font-semibold capitalize text-primary dark:text-foreground">{longCivilDate(current)}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {day.isLoading ? <div className="space-y-2" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
            : day.isError ? <ErrorState message={errorMessage(day.error, 'No se pudo cargar la línea de tiempo')} onRetry={() => void day.refetch()} />
            : day.data ? <HourlyTimeline timeline={day.data} /> : null}
        </div>
        <Panel title="Días anteriores" icon={<CalendarDays className="size-4" />}>
          {range.isLoading ? <Skeleton className="h-40" aria-busy="true" />
            : range.isError ? <ErrorState message={errorMessage(range.error, 'No se pudo cargar el historial')} onRetry={() => void range.refetch()} />
            : (
              <ul className="space-y-1">
                {[...(range.data?.days ?? [])].reverse().map((item) => (
                  <li key={item.date}>
                    <button type="button" onClick={() => setDate(item.date)} aria-current={item.date === current ? 'date' : undefined}
                      className={cn('w-full min-w-0 rounded-lg border px-3 py-2 text-left text-[12px] transition hover:bg-muted/50', item.date === current ? 'border-primary bg-primary/5' : 'border-border')}>
                      <span className="block font-semibold capitalize">{longCivilDate(item.date)}</span>
                      <span className="block text-muted-foreground">
                        {item.activeHours ? `${item.firstActivity}–${item.lastActivity} · ${formatMinutes(item.workedMinutes)} en tareas · ${item.opportunities} oportunidades · ${item.checkinsAnswered} respuestas` : 'Sin actividad'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </div>
    </div>
  );
}
