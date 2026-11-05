import { useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type OrgPreferences, type TeamMember } from '../../services/organizacion.service';
import { EmptyState, ErrorState, NativeSelect } from './OrgBits';
import { errorMessage, KIND_CLASS } from './organizacion.utils';

type Row = { key: string; kind: 'TASK' | 'EVENT' | 'MEETING'; title: string; date: Date; status: string; userIds: string[] };

/** Calendario del equipo: todas las actividades de las personas supervisadas, agrupadas por día (solo lectura). */
export function EquipoCalendario({ members, preferences }: { members: TeamMember[]; preferences: OrgPreferences }) {
  const weekStartsOn = preferences.weekStartsOn;
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn }));
  const [userId, setUserId] = useState('');
  const range = useMemo(() => ({ from: weekStart.toISOString(), to: addDays(weekStart, 7).toISOString() }), [weekStart]);
  const agenda = useTenantQuery(['organizacion', 'team-agenda', range.from, userId], (signal) => organizacionService.getTeamAgenda({ ...range, userIds: userId || undefined }, signal), { staleTime: 30_000 });
  const names = new Map(members.map((m) => [m.id, m.name]));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const rows: Row[] = [
    ...(agenda.data?.events ?? []).filter((e) => e.startDate).map((e) => ({ key: `e-${e.id}`, kind: e.kind, title: e.title, date: new Date(e.startDate as string), status: e.status, userIds: e.userIds })),
    ...(agenda.data?.tasks ?? []).filter((t) => t.dueDate || t.startDate).map((t) => ({ key: `t-${t.id}`, kind: 'TASK' as const, title: t.title, date: new Date((t.dueDate ?? t.startDate) as string), status: t.status, userIds: t.userIds })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold capitalize">Semana del {format(weekStart, 'd', { locale: es })} al {format(addDays(weekStart, 6), "d 'de' MMMM yyyy", { locale: es })}</p>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label="Persona" className="h-9 w-auto min-w-[180px]" value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Todo el equipo</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </NativeSelect>
          <Button type="button" size="sm" variant="outline" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn }))}>Hoy</Button>
          <Button type="button" size="icon" variant="outline" onClick={() => setWeekStart((d) => addDays(d, -7))} aria-label="Semana anterior"><ChevronLeft className="size-4" /></Button>
          <Button type="button" size="icon" variant="outline" onClick={() => setWeekStart((d) => addDays(d, 7))} aria-label="Semana siguiente"><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      {agenda.isLoading ? <Skeleton className="h-64 w-full" aria-busy="true" />
        : agenda.isError ? <ErrorState message={errorMessage(agenda.error, 'No se pudo cargar el calendario del equipo')} onRetry={() => void agenda.refetch()} />
        : rows.length === 0 ? <EmptyState title="Sin actividades" description="Nadie del equipo tiene actividades programadas en esta semana." />
        : (
          <ol className="space-y-4">
            {days.map((day) => {
              const list = rows.filter((r) => format(r.date, 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'));
              if (!list.length) return null;
              return (
                <li key={day.toISOString()}>
                  <p className="mb-1.5 text-[12px] font-semibold capitalize text-muted-foreground">{format(day, "EEEE d 'de' MMMM", { locale: es })}</p>
                  <ul className="space-y-1.5">
                    {list.map((r) => (
                      <li key={r.key} className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-l-4 px-3 py-2 text-[13px]', KIND_CLASS[r.kind], ['COMPLETED', 'CANCELLED'].includes(r.status) && 'opacity-60')}>
                        <span className="w-14 shrink-0 text-[11px] font-semibold">{format(r.date, 'HH:mm')}</span>
                        <span className={cn('min-w-0 flex-1 break-words font-semibold', r.status === 'COMPLETED' && 'line-through')}>{r.title}</span>
                        <span className="text-[11px]">{r.userIds.map((id) => names.get(id) ?? 'Usuario').join(', ')}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
    </section>
  );
}
