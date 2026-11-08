import { useState } from 'react';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { performanceService } from '../../services/performance.service';
import { EmptyState, ErrorState, Field, NativeSelect } from '../organizacion/OrgBits';
import { errorMessage } from '../organizacion/organizacion.utils';
import { complianceTone, percent } from './seguimiento.utils';

const RANGES: Array<[string, string, number]> = [['7', 'Últimos 7 días', 7], ['14', 'Últimos 14 días', 14], ['30', 'Últimos 30 días', 30]];

/** Cumplimiento de las preguntas por hora: sale de las calificaciones del supervisor y de lo que no se respondió. */
export function CumplimientoTab() {
  const [range, setRange] = useState('7');
  const days = RANGES.find(([value]) => value === range)?.[2] ?? 7;
  const summary = useTenantQuery(['performance', 'checkin-summary', range], (signal) => {
    const to = new Date(Date.now() + 3_600_000);
    const from = new Date(Date.now() - days * 86_400_000);
    return performanceService.getCheckinSummary({ from: from.toISOString(), to: to.toISOString() }, signal);
  }, { staleTime: 30_000 });
  const overall = summary.data?.overall;

  return (
    <div className="space-y-4">
      <Field label="Período" className="max-w-56"><NativeSelect value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></Field>
      {summary.isLoading ? <Skeleton className="h-48 w-full" aria-busy="true" />
        : summary.isError ? <ErrorState message={errorMessage(summary.error, 'No se pudo cargar el cumplimiento')} onRetry={() => void summary.refetch()} />
        : !overall || overall.total === 0 && overall.open === 0 ? <EmptyState title="Aún no hay preguntas en este período" description="Activa las preguntas por hora en la configuración y el cumplimiento aparecerá aquí." />
        : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Kpi label="Cumplimiento" value={percent(overall.compliance)} tone={complianceTone(overall.compliance)} hint="Calificaciones ÷ 5; sin respuesta vale 0" />
              <Kpi label="Respondidas" value={`${overall.answered} de ${overall.total}`} hint={overall.responseRate === null ? undefined : `${percent(overall.responseRate)} de respuesta`} />
              <Kpi label="Sin respuesta" value={String(overall.missed)} tone={overall.missed ? 'text-red-700' : undefined} />
              <Kpi label="Calificación promedio" value={overall.averageRating === null ? '—' : `${overall.averageRating.toFixed(1)}/5`} hint={`${overall.rated} calificadas`} />
              <Kpi label="Por calificar" value={String(overall.awaitingRating)} tone={overall.awaitingRating ? 'text-amber-700' : undefined} hint="No entran al cumplimiento todavía" />
            </div>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>{['Persona', 'Cumplimiento', 'Calificación', 'Respondidas', 'Sin respuesta', 'Tarde', 'Por calificar'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(summary.data?.people ?? []).map((person) => (
                    <tr key={person.userId} className="border-t border-border">
                      <th scope="row" className="px-3 py-2 font-semibold">{person.name}</th>
                      <td className={cn('px-3 py-2 font-bold', complianceTone(person.compliance))}>{percent(person.compliance)}</td>
                      <td className="px-3 py-2">{person.averageRating === null ? '—' : `${person.averageRating.toFixed(1)}/5`}</td>
                      <td className="px-3 py-2">{person.answered}</td>
                      <td className={cn('px-3 py-2', person.missed ? 'font-semibold text-red-700' : '')}>{person.missed}</td>
                      <td className="px-3 py-2">{person.late}</td>
                      <td className="px-3 py-2">{person.awaitingRating}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
    </div>
  );
}

function Kpi({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', tone ?? 'text-primary dark:text-foreground')}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
