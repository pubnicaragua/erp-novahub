import { useState } from 'react';
import { Gauge, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Skeleton } from '../../ui/skeleton';
import { cn } from '../../ui/utils';
import { useTenantQuery } from '../../../hooks/useTenantQuery';
import { toast } from '../../../services/toast';
import { performanceService, type ScorecardBand } from '../../../services/performance.service';

const BAND: Record<ScorecardBand, { label: string; tone: string; bar: string }> = {
  EXCELLENT: { label: 'Excelente', tone: 'text-emerald-700', bar: 'bg-emerald-500' }, GOOD: { label: 'Bueno', tone: 'text-sky-700', bar: 'bg-sky-500' },
  FAIR: { label: 'Regular', tone: 'text-amber-700', bar: 'bg-amber-500' }, LOW: { label: 'Bajo', tone: 'text-red-700', bar: 'bg-red-500' }, NO_DATA: { label: 'Sin datos', tone: 'text-muted-foreground', bar: 'bg-muted' },
};
const monthRange = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
};
const currentMonth = () => new Date().toISOString().slice(0, 7);

/** Puntuación de desempeño del período: junta metas, tareas, preguntas por hora, asistencia y evaluación del jefe. */
export function EmployeeScorecardPanel({ employeeId, mine = false, canCreateReview = false }: { employeeId?: string; mine?: boolean; canCreateReview?: boolean }) {
  const [month, setMonth] = useState(currentMonth());
  const [busy, setBusy] = useState(false);
  const range = monthRange(month);
  const query = useTenantQuery(
    ['performance', 'scorecard', mine ? 'mine' : employeeId ?? '', month],
    (signal) => (mine ? performanceService.getMyScorecard(range, signal) : performanceService.getScorecard(employeeId as string, range, signal)),
    { staleTime: 60_000, retry: false, enabled: mine || Boolean(employeeId) },
  );
  const card = query.data;

  const createReview = async () => {
    if (!employeeId) return;
    setBusy(true);
    try {
      const result = await performanceService.createReviewFromScorecard({ employeeId, ...range });
      toast.success(`Evaluación creada en borrador con ${result.rating} / 5. Ábrela en la pestaña Evaluaciones.`);
    } catch (error) { toast.error((error as any)?.response?.data?.message?.toString?.() || 'No se pudo crear la evaluación.'); } finally { setBusy(false); }
  };

  return (
    <Card className="space-y-4 rounded-2xl border-border/60 bg-card p-5 shadow-sm" data-testid="scorecard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground"><Gauge className="size-4 text-primary" aria-hidden /> Puntuación de desempeño</h3>
        <input type="month" aria-label="Mes a evaluar" value={month} max={currentMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs" />
      </div>
      {query.isLoading ? <Skeleton className="h-28 w-full" aria-busy="true" />
        : query.isError || !card ? <p className="text-sm text-muted-foreground" role="status">{mine ? 'Tu usuario no está vinculado a un empleado, así que no hay puntuación.' : 'No se pudo calcular la puntuación.'}</p>
        : (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <p className={cn('text-4xl font-black tabular-nums', BAND[card.band].tone)}>{card.score === null ? '—' : card.score}<span className="text-base font-bold text-muted-foreground"> / 100</span></p>
              <div><p className={cn('text-sm font-bold', BAND[card.band].tone)}>{BAND[card.band].label}{card.rating !== null ? ` · equivale a ${card.rating} / 5` : ''}</p><p className="text-xs text-muted-foreground">{card.recommendation}</p></div>
            </div>
            {card.components.length > 0 && (
              <ul className="space-y-2.5">
                {card.components.map((component) => (
                  <li key={component.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]"><span className="font-semibold">{component.label} <span className="text-[11px] font-normal text-muted-foreground">(pesa {component.effectiveWeight} %)</span></span><span className="font-bold tabular-nums">{component.score}</span></div>
                    <div className="mt-1 h-2 rounded-full bg-muted" role="img" aria-label={`${component.label}: ${component.score} de 100`}><div className={cn('h-full rounded-full', BAND[component.score >= 90 ? 'EXCELLENT' : component.score >= 75 ? 'GOOD' : component.score >= 60 ? 'FAIR' : 'LOW'].bar)} style={{ width: `${Math.min(100, component.score)}%` }} /></div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{component.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            {canCreateReview && card.score !== null && <div className="flex justify-end"><Button type="button" variant="outline" size="sm" onClick={() => void createReview()} disabled={busy}>{busy && <Loader2 className="mr-2 size-4 animate-spin" />}Crear evaluación con estos datos</Button></div>}
            <p className="text-[11px] text-muted-foreground">Se calcula con lo que hay en el sistema en ese mes: avance de sus metas, tareas con fecha límite (a tiempo y calificadas), preguntas por hora, asistencia y la última evaluación del jefe. Lo que no tenga datos no cuenta.</p>
          </>
        )}
    </Card>
  );
}
