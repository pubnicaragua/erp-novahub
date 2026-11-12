import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Flag, Video, CalendarDays, Hammer } from 'lucide-react';
import { format, isSameDay, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../ui/utils';
import { formatWorked, layoutDay, summarizeDay, visibleHourRange, type CalendarItemKind } from './calendarLayout';

/** Elemento del calendario ya normalizado: un evento, una reunión, el vencimiento de una tarea o un tramo de trabajo registrado. */
export interface CalItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  start: Date;
  end: Date;
  /** Registro original (evento o tarea) para abrir su detalle. */
  raw: any;
  /** Para tareas: estado, y si el vencimiento ya pasó sin cerrarse. */
  status?: string;
  overdue?: boolean;
  subtitle?: string;
}

const HOUR_HEIGHT = 56;
const GUTTER = '3.5rem';

const hourLabel = (hour: number) => format(new Date(2026, 0, 1, hour), 'h a', { locale: es }).toLowerCase();

const kindStyle = (item: CalItem): string => {
  if (item.kind === 'event') return 'border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100';
  if (item.kind === 'meeting') return 'border-violet-500 bg-violet-500/15 text-violet-900 dark:text-violet-100';
  if (item.kind === 'work') return 'border-dashed border-sky-500 bg-sky-500/10 text-sky-900 dark:text-sky-100';
  const status = String(item.status || '').toUpperCase();
  if (status === 'COMPLETED') return 'border-muted-foreground/50 bg-muted text-muted-foreground';
  if (item.overdue) return 'border-destructive bg-destructive/10 text-destructive';
  return 'border-blue-500 bg-blue-500/15 text-blue-900 dark:text-blue-100';
};

const KindIcon = ({ item }: { item: CalItem }) => {
  if (item.kind === 'meeting') return <Video className="size-3 shrink-0" aria-hidden="true" />;
  if (item.kind === 'event') return <CalendarDays className="size-3 shrink-0" aria-hidden="true" />;
  if (item.kind === 'work') return <Hammer className="size-3 shrink-0" aria-hidden="true" />;
  return String(item.status || '').toUpperCase() === 'COMPLETED'
    ? <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
    : <Flag className="size-3 shrink-0" aria-hidden="true" />;
};

const kindLabel: Record<CalendarItemKind, string> = {
  event: 'Evento', meeting: 'Reunión', 'task-due': 'Vence la tarea', work: 'Trabajo registrado',
};

interface CalendarTimeGridProps {
  days: Date[];
  items: CalItem[];
  onOpen: (item: CalItem) => void;
  /** En la vista de semana, tocar el encabezado de un día abre ese día. */
  onSelectDay?: (day: Date) => void;
}

/** Cuadrícula por hora y por día: lo agendado, lo que vence y el trabajo realmente registrado, cada cosa en su hora. */
export function CalendarTimeGrid({ days, items, onOpen, onSelectDay }: CalendarTimeGridProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const { startHour, endHour } = useMemo(() => visibleHourRange(items, days), [items, days]);
  const hours = useMemo(() => Array.from({ length: endHour - startHour }, (_, index) => startHour + index), [startHour, endHour]);
  const totalHeight = hours.length * HOUR_HEIGHT;
  const columns = `${GUTTER} repeat(${days.length}, minmax(0, 1fr))`;
  const nowOffset = ((now.getHours() * 60 + now.getMinutes()) / 60 - startHour) * HOUR_HEIGHT;

  const placedByDay = useMemo(
    () => days.map((day) => layoutDay(items, day, startHour, HOUR_HEIGHT)),
    [days, items, startHour],
  );

  return (
    <div className="max-h-[72vh] overflow-auto rounded-3xl border border-border/50 bg-card/80 shadow-sm" data-testid="calendar-time-grid">
      <div style={{ minWidth: days.length > 1 ? '46rem' : undefined }}>
        <div className="sticky top-0 z-30 grid border-b border-border/50 bg-card" style={{ gridTemplateColumns: columns }}>
          <div className="border-r border-border/30" aria-hidden="true" />
          {days.map((day) => {
            const summary = summarizeDay(items, day);
            const today = isToday(day);
            const content = (
              <>
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{format(day, 'EEE', { locale: es })}</span>
                <span className={cn('flex size-8 items-center justify-center rounded-full text-sm font-black', today ? 'bg-primary text-primary-foreground' : 'text-foreground')}>{format(day, 'd')}</span>
                <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-[10px] font-semibold text-muted-foreground">
                  {summary.events + summary.meetings > 0 && <span title="Eventos y reuniones">{summary.events + summary.meetings} citas</span>}
                  {summary.dues > 0 && <span title="Tareas que vencen">{summary.dues} vencen</span>}
                  {summary.workedMinutes > 0 && <span title="Trabajo registrado en tareas" className="text-sky-700 dark:text-sky-300">{formatWorked(summary.workedMinutes)}</span>}
                  {summary.events + summary.meetings + summary.dues + summary.workedMinutes === 0 && <span>Libre</span>}
                </span>
              </>
            );
            return onSelectDay && days.length > 1 ? (
              <button key={day.toISOString()} type="button" onClick={() => onSelectDay(day)} className="flex min-w-0 flex-col items-center gap-1 border-r border-border/30 px-1 py-2 transition-colors hover:bg-muted/40" aria-label={`Abrir ${format(day, "EEEE d 'de' MMMM", { locale: es })}`}>
                {content}
              </button>
            ) : (
              <div key={day.toISOString()} className="flex min-w-0 flex-col items-center gap-1 border-r border-border/30 px-1 py-2">{content}</div>
            );
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columns }}>
          <div className="relative border-r border-border/30" style={{ height: totalHeight }}>
            {hours.map((hour, index) => (
              <span key={hour} className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-muted-foreground" style={{ top: index === 0 ? 8 : index * HOUR_HEIGHT }}>
                {hourLabel(hour)}
              </span>
            ))}
          </div>
          {days.map((day, dayIndex) => (
            <div key={day.toISOString()} className={cn('relative min-w-0 border-r border-border/30', isToday(day) && 'bg-primary/[0.03]')} style={{ height: totalHeight }}>
              {hours.map((hour, index) => (
                <div key={hour} className="absolute inset-x-0 border-t border-border/40" style={{ top: index * HOUR_HEIGHT }} aria-hidden="true" />
              ))}
              {hours.map((hour, index) => (
                <div key={`half-${hour}`} className="absolute inset-x-0 border-t border-dashed border-border/20" style={{ top: index * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} aria-hidden="true" />
              ))}
              {isSameDay(day, now) && nowOffset >= 0 && nowOffset <= totalHeight && (
                <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: nowOffset }} aria-hidden="true">
                  <span className="-ml-1 size-2 rounded-full bg-primary" />
                  <span className="h-px flex-1 bg-primary" />
                </div>
              )}
              {placedByDay[dayIndex].map((placed) => {
                const item = placed.item as CalItem;
                const compact = placed.height < 34;
                return (
                  <button
                    key={`${item.kind}-${item.id}-${placed.start.getTime()}`}
                    type="button"
                    onClick={() => onOpen(item)}
                    title={`${kindLabel[item.kind]}: ${item.title} (${format(placed.start, 'h:mm a')}${item.kind === 'task-due' ? '' : ` – ${format(placed.end, 'h:mm a')}`})${item.subtitle ? ` · ${item.subtitle}` : ''}`}
                    className={cn(
                      'absolute z-10 min-w-0 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-[10px] leading-tight shadow-xs transition-shadow hover:z-20 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
                      kindStyle(item),
                    )}
                    style={{
                      top: placed.top,
                      height: placed.height - 2,
                      left: `calc(${(placed.lane / placed.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / placed.lanes}% - 3px)`,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-1 font-bold">
                      <KindIcon item={item} />
                      <span className="truncate">{item.title}</span>
                    </span>
                    {!compact && (
                      <span className="block truncate font-medium opacity-80">
                        {item.kind === 'task-due' ? `Vence ${format(placed.start, 'h:mm a')}` : `${format(placed.start, 'h:mm a')} – ${format(placed.end, 'h:mm a')}`}
                      </span>
                    )}
                    {!compact && item.subtitle && <span className="block truncate opacity-70">{item.subtitle}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
