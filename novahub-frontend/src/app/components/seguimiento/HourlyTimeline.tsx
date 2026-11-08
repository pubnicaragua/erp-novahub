import { useState, type ReactNode } from 'react';
import { Briefcase, CheckCircle2, Clock3, FileText, MapPin, MessageCircle, MessageSquareText, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';
import type { DayTimeline, TimelineHour } from '../../services/performance.service';
import { RatingStars } from '../organizacion/TaskRating';
import { formatMinutes } from '../organizacion/organizacion.utils';
import { CHECKIN_STATUS_LABEL, CHECKIN_STATUS_TONE, clockLabel } from './seguimiento.utils';

/** Horas que se muestran por omisión aunque no haya actividad: la jornada típica. */
const DEFAULT_FROM = 7;
const DEFAULT_TO = 18;

const money = (value: number) => new Intl.NumberFormat('es-NI', { maximumFractionDigits: 2 }).format(value);

function Chip({ icon, children, tone = 'bg-slate-100 text-slate-800' }: { icon: ReactNode; children: ReactNode; tone?: string }) {
  return <span className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tone)}>{icon}<span className="min-w-0 break-words">{children}</span></span>;
}

function HourRow({ hour, timeZone }: { hour: TimelineHour; timeZone: string }) {
  return (
    <li className={cn('grid gap-2 rounded-xl border p-3 sm:grid-cols-[72px_1fr]', hour.hasActivity ? 'border-border bg-card' : 'border-dashed border-border/70 bg-muted/20')}>
      <div className="text-[13px] font-bold tabular-nums text-primary dark:text-foreground">{hour.label}</div>
      <div className="min-w-0 space-y-2">
        {!hour.hasActivity && <p className="text-[12px] text-muted-foreground">Sin actividad registrada.</p>}

        {hour.checkins.map((checkin) => (
          <div key={checkin.id} className="min-w-0 rounded-lg border border-border bg-background p-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className={cn('rounded-full px-2 py-0.5 font-semibold', CHECKIN_STATUS_TONE[checkin.status])}>{CHECKIN_STATUS_LABEL[checkin.status]}</span>
              <span className="text-muted-foreground">Pregunta de las {clockLabel(checkin.scheduledFor, timeZone)}</span>
              {checkin.rating ? <RatingStars value={checkin.rating} /> : checkin.status === 'ANSWERED' ? <span className="text-muted-foreground">Por calificar</span> : null}
            </div>
            {checkin.workingOn && <p className="mt-1 break-words text-[13px] font-medium">{checkin.workingOn}</p>}
            {(checkin.remainingMinutes !== null || checkin.blockers) && (
              <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                {checkin.remainingMinutes !== null && `Le faltaba: ${checkin.remainingMinutes === 0 ? 'ya terminó' : formatMinutes(checkin.remainingMinutes)}`}
                {checkin.remainingMinutes !== null && checkin.blockers && ' · '}
                {checkin.blockers && `Bloqueo: ${checkin.blockers}`}
              </p>
            )}
            {checkin.ratingComment && <p className="mt-0.5 break-words text-[11px] italic text-muted-foreground">«{checkin.ratingComment}»</p>}
          </div>
        ))}

        {hour.workedMinutes > 0 && (
          <div className="flex items-center gap-2">
            <Chip icon={<Clock3 className="size-3" aria-hidden="true" />} tone="bg-sky-100 text-sky-900">{formatMinutes(hour.workedMinutes)} en tareas</Chip>
            <div className="h-1.5 min-w-16 max-w-48 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(100, (hour.workedMinutes / 60) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {hour.tasksCompleted.map((task) => <Chip key={task.id} icon={<CheckCircle2 className="size-3" aria-hidden="true" />} tone="bg-emerald-100 text-emerald-900">Cerró: {task.title}</Chip>)}
          {hour.opportunities.map((item) => <Chip key={`o-${item.id}`} icon={<Sparkles className="size-3" aria-hidden="true" />} tone="bg-violet-100 text-violet-900">Oportunidad: {item.name}</Chip>)}
          {hour.visits.map((item) => <Chip key={`v-${item.id}`} icon={<MapPin className="size-3" aria-hidden="true" />} tone="bg-amber-100 text-amber-900">Visita: {item.name}</Chip>)}
          {hour.messages > 0 && <Chip icon={<MessageCircle className="size-3" aria-hidden="true" />}>{hour.messages} mensaje{hour.messages === 1 ? '' : 's'} a clientes</Chip>}
          {hour.invoices.count > 0 && <Chip icon={<FileText className="size-3" aria-hidden="true" />}>{hour.invoices.count} factura{hour.invoices.count === 1 ? '' : 's'} · {money(hour.invoices.amount)}</Chip>}
        </div>
      </div>
    </li>
  );
}

/** Lo que una persona trabajó en cada hora de un día, con las horas de la jornada visibles aunque estén vacías. */
export function HourlyTimeline({ timeline }: { timeline: DayTimeline }) {
  const [showAll, setShowAll] = useState(false);
  const { totals } = timeline;
  const visible = timeline.hours.filter((hour) => showAll || hour.hasActivity || (hour.hour >= DEFAULT_FROM && hour.hour <= DEFAULT_TO));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" aria-label="Totales del día">
        <Chip icon={<Clock3 className="size-3" aria-hidden="true" />} tone="bg-sky-100 text-sky-900">{formatMinutes(totals.workedMinutes)} en tareas</Chip>
        <Chip icon={<MessageSquareText className="size-3" aria-hidden="true" />} tone="bg-emerald-100 text-emerald-900">{totals.checkinsAnswered} respuestas</Chip>
        {totals.checkinsMissed > 0 && <Chip icon={<MessageSquareText className="size-3" aria-hidden="true" />} tone="bg-red-100 text-red-900">{totals.checkinsMissed} sin respuesta</Chip>}
        <Chip icon={<CheckCircle2 className="size-3" aria-hidden="true" />}>{totals.tasksCompleted} tareas cerradas</Chip>
        <Chip icon={<Sparkles className="size-3" aria-hidden="true" />} tone="bg-violet-100 text-violet-900">{totals.opportunities} oportunidades</Chip>
        <Chip icon={<MapPin className="size-3" aria-hidden="true" />} tone="bg-amber-100 text-amber-900">{totals.visits} visitas</Chip>
        <Chip icon={<MessageCircle className="size-3" aria-hidden="true" />}>{totals.messages} mensajes</Chip>
        <Chip icon={<Briefcase className="size-3" aria-hidden="true" />}>{totals.invoices} facturas · {money(totals.invoiceAmount)}</Chip>
      </div>
      <ol className="space-y-2" aria-label={`Línea de tiempo del ${timeline.date}`}>
        {visible.map((hour) => <HourRow key={hour.hour} hour={hour} timeZone={timeline.timeZone} />)}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">Horas en la zona horaria de la persona ({timeline.timeZone}).</p>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Mostrar solo la jornada' : 'Mostrar las 24 horas'}</Button>
      </div>
    </div>
  );
}
