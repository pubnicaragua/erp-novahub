import { useEffect, useMemo, useRef, useState } from 'react';
import { ORGANIZACION_GUIDES } from './guides';
import { useQueryClient } from '@tanstack/react-query';
import { format, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Bell, CalendarDays, ChevronLeft, ChevronRight, Filter, ListChecks, ListTodo, Plus, Settings2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { tasksService } from '../../services/actividades.service';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService, type OrgPreferences, type OrgUser, type OrgViewMode } from '../../services/organizacion.service';
import { toast } from '../../services/toast';
import { NuevaActividadSheet, type ActivityKind } from './NuevaActividadSheet';
import { ItemDetailSheet } from './ItemDetailSheet';
import { EmptyState, ErrorState, Heading, NativeSelect, PageTitle, Panel } from './OrgBits';
import {
  KIND_CLASS, KIND_LABEL, dayKeyFromDate, errorMessage, timeZoneLabel, toCalendarItems, type CalendarItem,
} from './organizacion.utils';
import {
  civilDate, civilKey, daysBetween, formatTime, instantKey, minutesOfDay, rangeToInstants, shiftCivil, todayCivil,
  visibleCivilRange, zonedToUtc,
} from './organizacion.time';

interface Props {
  preferences: OrgPreferences;
  users: OrgUser[];
  onOpenSettings: () => void;
}

const HOUR_START = 6;
const HOUR_END = 21;
/** Alturas disponibles por hora; el usuario ajusta el zoom del calendario con los botones −/+. */
const ROW_HEIGHTS = [44, 60, 80, 104] as const;
const DEFAULT_ZOOM = 1;
const VIEW_LABEL: Record<OrgViewMode, string> = { WEEK: 'Semana', DAY: 'Día', MONTH: 'Mes', AGENDA: 'Agenda' };
const TYPE_FILTERS: Array<{ id: CalendarItem['kind']; label: string }> = [
  { id: 'TASK', label: 'Tareas' }, { id: 'EVENT', label: 'Eventos' }, { id: 'MEETING', label: 'Reuniones' }, { id: 'REMINDER', label: 'Recordatorios' },
];

/** Reparte los elementos solapados del día en carriles para que no se tapen entre sí. */
function layoutLanes(items: CalendarItem[]) {
  const sorted = [...items].sort((a, b) => a.start.getTime() - b.start.getTime());
  const placed: Array<{ item: CalendarItem; lane: number; lanes: number }> = [];
  let group: typeof placed = [];
  let groupEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    group.forEach((g) => { g.lanes = lanes; });
    placed.push(...group);
    group = [];
  };
  for (const item of sorted) {
    if (group.length && item.start.getTime() >= groupEnd) flush();
    const used = new Set(group.filter((g) => g.item.end.getTime() > item.start.getTime()).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    group.push({ item, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, item.end.getTime());
  }
  flush();
  return placed;
}

export function MiAgendaView({ preferences, users, onOpenSettings }: Props) {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const tz = preferences.timezone;
  const weekStartsOn = preferences.weekStartsOn;

  const [view, setView] = useState<OrgViewMode>(preferences.defaultView);
  const [anchor, setAnchor] = useState<Date>(() => todayCivil(tz));
  const [ownerUserId, setOwnerUserId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const ROW_H = ROW_HEIGHTS[zoom];
  const [types, setTypes] = useState<Set<CalendarItem['kind']>>(new Set(['TASK', 'EVENT', 'MEETING', 'REMINDER']));
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'DONE'>('ALL');
  const [sheet, setSheet] = useState<{ open: boolean; kind?: ActivityKind; date?: Date }>({ open: false });
  const [selected, setSelected] = useState<CalendarItem | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  const readOnlyView = Boolean(ownerUserId) && ownerUserId !== user?.id;
  // «Hoy» avanza solo: si la pestaña queda abierta pasada la medianoche, el día seleccionado que seguía
  // a «hoy» se mueve con él (antes el panel lateral se quedaba en el día anterior).
  const [today, setToday] = useState<Date>(() => todayCivil(tz));
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  const todayRef = useRef(today);
  useEffect(() => {
    const sync = () => {
      setNowTick(Date.now());
      const current = todayCivil(tz);
      const previous = todayRef.current;
      if (civilKey(current) === civilKey(previous)) return;
      todayRef.current = current;
      setToday(current);
      setAnchor((selected) => (civilKey(selected) === civilKey(previous) ? current : selected));
    };
    const timer = window.setInterval(sync, 30_000);
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', sync);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', sync);
    };
  }, [tz]);
  const gridRef = useRef<HTMLDivElement>(null);

  const { start, end } = useMemo(() => visibleCivilRange(view, anchor, weekStartsOn), [view, anchor, weekStartsOn]);
  const range = useMemo(() => rangeToInstants(start, end, tz), [start, end, tz]);
  const days = useMemo(() => daysBetween(start, end).filter((d) => view !== 'WEEK' || preferences.showWeekends || ![0, 6].includes(d.getDay())), [start, end, view, preferences.showWeekends]);

  const agenda = useTenantQuery(
    ['organizacion', 'agenda', ownerUserId || 'me', view, civilKey(start), civilKey(end), tz],
    (signal) => organizacionService.getAgenda({ from: range.from.toISOString(), to: range.to.toISOString(), ownerUserId: ownerUserId || undefined }, signal),
    { staleTime: 15_000 },
  );

  const todayRange = useMemo(() => rangeToInstants(today, today, tz), [today, tz]);
  const todayAgenda = useTenantQuery(
    ['organizacion', 'agenda-today', civilKey(today), tz],
    (signal) => organizacionService.getAgenda({ from: todayRange.from.toISOString(), to: todayRange.to.toISOString() }, signal),
    { staleTime: 15_000 },
  );
  const owners = useTenantQuery(['organizacion', 'viewable-owners'], (signal) => organizacionService.getViewableOwners(signal), { staleTime: 5 * 60_000 });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['tenant-module'] });
  };

  const allItems = useMemo(() => toCalendarItems(agenda.data), [agenda.data]);
  const items = useMemo(() => allItems.filter((i) => {
    if (!types.has(i.kind)) return false;
    if (statusFilter === 'OPEN') return !i.completed;
    if (statusFilter === 'DONE') return Boolean(i.completed);
    return true;
  }), [allItems, types, statusFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = instantKey(item.start, tz);
      map.set(key, [...(map.get(key) || []), item]);
    }
    return map;
  }, [items, tz]);

  const todayItems = useMemo(() => toCalendarItems(todayAgenda.data), [todayAgenda.data]);
  const todayTasks = (todayAgenda.data?.tasks ?? []);
  const doneToday = todayItems.filter((i) => i.completed).length;
  const pendingToday = todayItems.filter((i) => !i.completed).length;
  const pct = todayItems.length ? Math.round((doneToday / todayItems.length) * 100) : 0;

  const canCreateAny = canPerform('ACTIVITIES_TASKS', 'create') || canPerform('ACTIVITIES_EVENTS', 'create') || canPerform('ACTIVITIES_MEETINGS', 'create') || canPerform('ACTIVITIES_REMINDERS', 'create');
  const canCompleteTasks = canPerform('ACTIVITIES_TASKS', 'complete');

  const openNew = (kind?: ActivityKind, date?: Date) => setSheet({ open: true, kind, date });

  const completeTask = async (id: string) => {
    setCompleting(id);
    try {
      await tasksService.complete(id);
      toast.success('Tarea completada');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setCompleting(null);
    }
  };

  const title = (() => {
    if (view === 'DAY') return format(anchor, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    if (view === 'MONTH') return format(anchor, "MMMM 'de' yyyy", { locale: es });
    if (view === 'AGENDA') return `Próximos 30 días desde el ${format(anchor, "d 'de' MMMM", { locale: es })}`;
    return `Semana del ${format(start, 'd', { locale: es })} al ${format(end, "d 'de' MMMM 'de' yyyy", { locale: es })}`;
  })();

  const selectedDayItems = (byDay.get(civilKey(anchor)) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime());
  const overlapping = new Set<string>();
  const evts = selectedDayItems.filter((i) => i.kind === 'EVENT' || i.kind === 'MEETING');
  evts.forEach((a, idx) => evts.slice(idx + 1).forEach((b) => { if (b.start < a.end && a.start < b.end) { overlapping.add(a.key); overlapping.add(b.key); } }));

  const workingHours = preferences.workingHours;
  const isWorkingSlot = (day: Date, hour: number) => {
    const wh = workingHours[dayKeyFromDate(day)];
    if (!wh?.enabled || !wh.start || !wh.end) return false;
    const mins = hour * 60;
    const [sh, sm] = wh.start.split(':').map(Number);
    const [eh, em] = wh.end.split(':').map(Number);
    return mins >= sh * 60 + sm && mins < eh * 60 + em;
  };

  // Al abrir la cuadrícula se desplaza a la hora actual (o al inicio de la jornada si hoy no está a la vista).
  const todayVisible = days.some((d) => civilKey(d) === civilKey(today));
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || (view !== 'WEEK' && view !== 'DAY')) return;
    const focusMinutes = todayVisible ? Math.min(Math.max(minutesOfDay(new Date(), tz), HOUR_START * 60), (HOUR_END - 2) * 60) : 8 * 60;
    grid.scrollTop = Math.max(0, ((focusMinutes - HOUR_START * 60) / 60) * ROW_H - ROW_H * 1.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, zoom, todayVisible, civilKey(anchor)]);

  const tzLabel = timeZoneLabel(tz);
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  // En la cuadrícula horaria el bloque ocupa todo su alto y deja ver el título completo (2 líneas) y la hora.
  const itemButton = (item: CalendarItem, compact = false) => (
    <button
      key={item.key} type="button" onClick={() => setSelected(item)} title={item.title}
      className={cn(
        'flex w-full min-w-0 flex-col rounded-md border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        !compact && 'h-full overflow-hidden',
        KIND_CLASS[item.kind], item.completed && 'opacity-60', item.busy && 'border-l-slate-400 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
      )}
      aria-label={`${KIND_LABEL[item.kind]}: ${item.title}, ${formatTime(item.start, tz)}`}
    >
      <span className={cn('font-semibold', compact ? 'truncate' : 'line-clamp-2 break-words', item.completed && 'line-through')}>{item.title}</span>
      {!compact && <span className="shrink-0 text-[10px] opacity-80">{formatTime(item.start, tz)}</span>}
    </button>
  );

  const renderTimeGrid = () => (
    <div ref={gridRef} className="max-h-[640px] overflow-auto rounded-xl border border-border" role="grid" aria-label={`Calendario: ${title}`}>
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className="sticky top-0 z-20 border-b border-border bg-card" />
        {days.map((day) => {
          const isToday = civilKey(day) === civilKey(today);
          return (
            <div key={civilKey(day)} className={cn('sticky top-0 z-20 border-b border-l border-border bg-card px-2 py-2 text-center text-[12px] font-semibold', isToday && 'bg-accent/15')}>
              <span className="capitalize text-muted-foreground">{format(day, 'EEE', { locale: es })}</span>{' '}
              <span className={cn('inline-flex min-w-7 items-center justify-center rounded-md px-1.5 py-0.5', isToday ? 'bg-primary text-primary-foreground' : 'text-foreground')}>{format(day, 'dd')}</span>
            </div>
          );
        })}

        <div>
          {hours.map((h) => (
            <div key={h} className="border-b border-border pr-1 text-right text-[10px] text-muted-foreground" style={{ height: ROW_H }}>
              <span className={cn('relative', h === HOUR_START ? 'top-0.5' : '-top-2')}>{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
        </div>
        {days.map((day) => {
          const key = civilKey(day);
          const dayItems = (byDay.get(key) || []).filter((i) => i.kind !== 'REMINDER' || true);
          const laid = layoutLanes(dayItems);
          return (
            <div key={key} className="relative border-l border-border" style={{ height: ROW_H * hours.length }}>
              {hours.map((h) => (
                <button
                  key={h} type="button" disabled={readOnlyView || !canCreateAny}
                  onClick={() => openNew(undefined, zonedToUtc(day.getFullYear(), day.getMonth() + 1, day.getDate(), h, 0, tz))}
                  aria-label={`Crear actividad el ${format(day, "d 'de' MMMM", { locale: es })} a las ${h}:00`}
                  className={cn('block w-full border-b border-border transition hover:bg-accent/10 disabled:cursor-default disabled:hover:bg-transparent', !isWorkingSlot(day, h) && 'bg-muted/40')}
                  style={{ height: ROW_H }}
                />
              ))}
              {key === civilKey(today) && (() => {
                const nowMin = minutesOfDay(new Date(nowTick), tz);
                if (nowMin < HOUR_START * 60 || nowMin >= HOUR_END * 60) return null;
                return (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: ((nowMin - HOUR_START * 60) / 60) * ROW_H }} aria-hidden="true">
                    <div className="h-0.5 bg-rose-500" />
                    <div className="-mt-1.5 size-2.5 rounded-full bg-rose-500" />
                  </div>
                );
              })()}
              {laid.map(({ item, lane, lanes }) => {
                const startMin = Math.max(minutesOfDay(item.start, tz), HOUR_START * 60);
                const rawEnd = instantKey(item.end, tz) === key ? minutesOfDay(item.end, tz) : HOUR_END * 60;
                const endMin = Math.min(Math.max(rawEnd, startMin + 30), HOUR_END * 60);
                const top = ((startMin - HOUR_START * 60) / 60) * ROW_H;
                const height = Math.max(40, ((endMin - startMin) / 60) * ROW_H - 2);
                if (minutesOfDay(item.start, tz) >= HOUR_END * 60) return null;
                return (
                  <div key={item.key} className="absolute px-0.5" style={{ top, height, left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}>
                    {itemButton(item)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderMonth = () => (
    <div className="overflow-x-auto rounded-xl border border-border">
      <div className="grid min-w-[560px] grid-cols-7">
        {days.slice(0, 7).map((d) => <div key={civilKey(d)} className="border-b border-border bg-card px-2 py-2 text-center text-[11px] font-semibold capitalize text-muted-foreground">{format(d, 'EEE', { locale: es })}</div>)}
        {days.map((day) => {
          const key = civilKey(day);
          const list = byDay.get(key) || [];
          const isToday = key === civilKey(today);
          return (
            <div key={key} className={cn('min-h-[104px] border-b border-l border-border p-1.5', !isSameMonth(day, anchor) && 'bg-muted/40 text-muted-foreground', isToday && 'bg-accent/10')}>
              <button type="button" onClick={() => { setAnchor(day); setView('DAY'); }} className={cn('mb-1 rounded px-1 text-[12px] font-semibold hover:bg-muted', isToday && 'bg-primary text-primary-foreground hover:bg-primary')} aria-label={`Ver el día ${format(day, "d 'de' MMMM", { locale: es })}`}>
                {format(day, 'd')}
              </button>
              <div className="space-y-1">
                {list.slice(0, 3).map((i) => itemButton(i, true))}
                {list.length > 3 && <button type="button" className="text-[10px] font-semibold text-primary hover:underline dark:text-accent" onClick={() => { setAnchor(day); setView('DAY'); }}>+{list.length - 3} más</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderAgenda = () => {
    const grouped = days.map((d) => ({ day: d, list: (byDay.get(civilKey(d)) || []).slice().sort((a, b) => a.start.getTime() - b.start.getTime()) })).filter((g) => g.list.length);
    if (!grouped.length) return <EmptyState title="Sin actividades" description="No hay actividades en los próximos 30 días." />;
    return (
      <ol className="space-y-4">
        {grouped.map(({ day, list }) => (
          <li key={civilKey(day)}>
            <Heading level={3} className="mb-1.5 text-[12px] font-semibold capitalize text-muted-foreground">{format(day, "EEEE d 'de' MMMM", { locale: es })}</Heading>
            <ul className="space-y-1.5">
              {list.map((i) => (
                <li key={i.key}>
                  <button type="button" onClick={() => setSelected(i)} className={cn('flex w-full items-center gap-3 rounded-lg border-l-4 px-3 py-2 text-left text-[13px]', KIND_CLASS[i.kind], i.completed && 'opacity-60')}>
                    <span className="w-20 shrink-0 text-[11px] font-semibold">{formatTime(i.start, tz)}</span>
                    <span className={cn('min-w-0 flex-1 truncate font-semibold', i.completed && 'line-through')}>{i.title}</span>
                    <span className="hidden text-[11px] sm:inline">{KIND_LABEL[i.kind]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <PageTitle guide={ORGANIZACION_GUIDES.agenda}
        eyebrow="Organización personal"
        title="Mi agenda"
        subtitle="Organiza tus tareas, eventos y recordatorios en una sola vista de trabajo."
        actions={(
          <>
            <Button type="button" variant="outline" onClick={onOpenSettings}><Settings2 className="size-4" aria-hidden="true" />Preferencias de vista</Button>
            {canCreateAny && !readOnlyView && <Button type="button" onClick={() => openNew()}><Plus className="size-4" aria-hidden="true" />Nueva actividad</Button>}
          </>
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Vista del calendario" className="flex flex-wrap gap-2">
          {(Object.keys(VIEW_LABEL) as OrgViewMode[]).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', view === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>
              {VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Tareas</span>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-violet-900">Eventos</span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-900">Reuniones</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Recordatorios</span>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[260px_minmax(0,1fr)_280px]">
        <aside className="order-2 min-w-0 space-y-4 xl:order-1">
          <Panel title="Vista rápida" icon={<Activity className="size-4" />}>
            {todayAgenda.isLoading ? <Skeleton className="h-20 w-full" /> : (
              <div className="flex items-center gap-4">
                <div
                  className="relative flex size-20 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `conic-gradient(#74C044 ${pct * 3.6}deg, rgba(116,192,68,0.18) 0deg)` }}
                  role="img" aria-label={`${pct}% realizado hoy`}
                >
                  <div className="flex size-[62px] flex-col items-center justify-center rounded-full bg-card"><span className="text-[17px] font-bold text-primary dark:text-foreground">{pct}%</span><span className="text-[9px] text-muted-foreground">realizado</span></div>
                </div>
                <div className="min-w-0">
                  <p className="text-3xl font-bold text-primary dark:text-foreground">{pendingToday}</p>
                  <p className="text-[12px] text-muted-foreground">pendientes de hoy</p>
                  <span className="mt-1 inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[11px] font-semibold text-primary dark:text-accent">{todayItems.length} actividades</span>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Mi lista de hoy" icon={<ListChecks className="size-4" />}>
            <p className="mb-2 text-[12px] text-muted-foreground">Marca las tareas completadas sin salir de tu agenda.</p>
            {todayAgenda.isError ? <ErrorState message={errorMessage(todayAgenda.error, 'No se pudo cargar tu lista de hoy')} onRetry={() => void todayAgenda.refetch()} /> : (
              <ul className="divide-y divide-border">
                {todayTasks.length === 0 && !todayAgenda.isLoading && <li className="py-3 text-[12px] text-muted-foreground">No tienes tareas con fecha de hoy.</li>}
                {todayTasks.map((t) => {
                  const done = t.status === 'COMPLETED' || t.status === 'APPROVED';
                  const due = t.dueDate ? new Date(t.dueDate) : null;
                  return (
                    <li key={t.id} className="flex items-start gap-2 py-2">
                      <input
                        type="checkbox" className="mt-0.5 size-4 accent-[#01422C]" checked={done}
                        disabled={done || !canCompleteTasks || completing === t.id}
                        onChange={() => void completeTask(t.id)} aria-label={`Completar tarea ${t.title}`}
                        title={canCompleteTasks ? undefined : 'Tu rol no puede completar tareas'}
                      />
                      <div className="min-w-0">
                        <p className={cn('truncate text-[13px] font-semibold', done && 'text-muted-foreground line-through')}>{t.title}</p>
                        {due && <p className="text-[11px] text-muted-foreground">{formatTime(due, tz)}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {canPerform('ACTIVITIES_TASKS', 'create') && (
              <Button type="button" variant="outline" className="mt-2 w-full" onClick={() => openNew('TASK', new Date())}><Plus className="size-4" aria-hidden="true" />Nueva tarea</Button>
            )}
          </Panel>
        </aside>

        <section className="order-1 min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm xl:order-2" aria-live="polite">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Heading className="flex min-w-0 items-center gap-2 text-[15px] font-semibold capitalize leading-snug"><CalendarDays className="size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{title}</span></Heading>
            <div className="flex flex-wrap items-center gap-2">
              {(view === 'WEEK' || view === 'DAY') && (
                <div className="flex items-center gap-1" role="group" aria-label="Zoom del calendario">
                  <Button type="button" size="icon" variant="outline" disabled={zoom <= 0} onClick={() => setZoom((z) => Math.max(0, z - 1))} aria-label="Reducir altura del calendario"><ZoomOut className="size-4" /></Button>
                  <Button type="button" size="icon" variant="outline" disabled={zoom >= ROW_HEIGHTS.length - 1} onClick={() => setZoom((z) => Math.min(ROW_HEIGHTS.length - 1, z + 1))} aria-label="Aumentar altura del calendario"><ZoomIn className="size-4" /></Button>
                </div>
              )}
              <Button type="button" size="sm" variant="outline" onClick={() => setAnchor(todayCivil(tz))}>Hoy</Button>
              <Button type="button" size="icon" variant="outline" onClick={() => setAnchor((a) => shiftCivil(view, a, -1))} aria-label="Periodo anterior"><ChevronLeft className="size-4" /></Button>
              <Button type="button" size="icon" variant="outline" onClick={() => setAnchor((a) => shiftCivil(view, a, 1))} aria-label="Periodo siguiente"><ChevronRight className="size-4" /></Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}><Filter className="size-4" aria-hidden="true" />Filtrar</Button>
            </div>
          </div>

          {showFilters && (
            <div className="mb-3 grid gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
              <fieldset>
                <legend className="mb-1 text-[12px] font-semibold">Tipo</legend>
                <div className="flex flex-wrap gap-3">
                  {TYPE_FILTERS.map((f) => (
                    <label key={f.id} className="flex items-center gap-1.5 text-[12px]">
                      <input type="checkbox" className="size-4 accent-[#01422C]" checked={types.has(f.id)}
                        onChange={() => setTypes((prev) => { const next = new Set(prev); if (next.has(f.id)) next.delete(f.id); else next.add(f.id); return next; })} />
                      {f.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-[12px] font-semibold">Estado
                  <NativeSelect className="mt-1" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'DONE')}>
                    <option value="ALL">Todos</option><option value="OPEN">Pendientes</option><option value="DONE">Completados</option>
                  </NativeSelect>
                </label>
                <label className="text-[12px] font-semibold">Calendario
                  <NativeSelect className="mt-1" value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)}>
                    <option value="">Mi agenda</option>
                    {(owners.data ?? []).map((o) => <option key={o.id} value={o.id}>Agenda de {o.name}</option>)}
                  </NativeSelect>
                </label>
              </div>
            </div>
          )}

          <p className="mb-2 text-[11px] text-muted-foreground">Zona horaria: <strong>{tzLabel}</strong>{readOnlyView && ' · Estás viendo la agenda de otra persona (solo lectura).'}</p>

          {agenda.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando agenda"><Skeleton className="h-10 w-full" /><Skeleton className="h-[420px] w-full" /></div>
          ) : agenda.isError ? (
            <ErrorState message={errorMessage(agenda.error, 'No se pudo cargar la agenda')} onRetry={() => void agenda.refetch()} />
          ) : (
            <>
              {items.length === 0 && view !== 'AGENDA' && (
                <p className="mb-2 rounded-lg bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
                  {allItems.length ? 'Ninguna actividad coincide con los filtros.' : 'No hay actividades en este periodo.'}
                  {canCreateAny && !readOnlyView && <button type="button" className="ml-2 font-semibold text-primary underline dark:text-accent" onClick={() => openNew()}>Crear una</button>}
                </p>
              )}
              {(view === 'WEEK' || view === 'DAY') && renderTimeGrid()}
              {view === 'MONTH' && renderMonth()}
              {view === 'AGENDA' && renderAgenda()}
            </>
          )}
        </section>

        <aside className="order-3 min-w-0 space-y-4">
          <Panel title={format(anchor, "EEEE d 'de' MMMM", { locale: es })} icon={<CalendarDays className="size-4" />}>
            <p className="mb-2 text-[12px] text-muted-foreground">Tu jornada y próximos compromisos.</p>
            <ul className="divide-y divide-border">
              {selectedDayItems.length === 0 && <li className="py-3 text-[12px] text-muted-foreground">Sin compromisos para este día.</li>}
              {selectedDayItems.map((i) => (
                <li key={i.key}>
                  <button type="button" onClick={() => setSelected(i)} className="flex w-full items-start gap-3 py-2 text-left">
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', KIND_CLASS[i.kind])} aria-hidden="true">
                      {i.kind === 'TASK' ? <ListTodo className="size-4" /> : i.kind === 'REMINDER' ? <Bell className="size-4" /> : <CalendarDays className="size-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className={cn('block truncate text-[13px] font-semibold', i.completed && 'line-through opacity-60')}>{i.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{formatTime(i.start, tz)} · {KIND_LABEL[i.kind]}</span>
                      {overlapping.has(i.key) && <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-900">Conflicto de horario</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          {canCreateAny && !readOnlyView && (
            <Panel title="Crear rápidamente" icon={<Plus className="size-4" />}>
              <div className="grid grid-cols-3 gap-2">
                {([['TASK', 'Tarea', ListTodo], ['EVENT', 'Evento', CalendarDays], ['REMINDER', 'Aviso', Bell]] as const).map(([k, label, Icon]) => (
                  <button key={k} type="button" onClick={() => openNew(k, civilKey(anchor) === civilKey(today) ? new Date() : civilDate(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate()))}
                    className="flex flex-col items-center gap-1 rounded-xl border border-border px-2 py-3 text-[12px] font-semibold transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <Icon className="size-4" aria-hidden="true" />{label}
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </aside>
      </div>

      <p className="text-[11px] text-muted-foreground">Esta agenda reutiliza las tareas, eventos y recordatorios existentes en NovaHub Actividades. Los eventos compartidos respetan sus permisos de origen.</p>

      <NuevaActividadSheet
        open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
        initialKind={sheet.kind} initialDate={sheet.date} timezone={tz} users={users} onCreated={refresh}
      />
      <ItemDetailSheet item={selected} readOnly={readOnlyView} timezone={tz} timezoneLabel={tzLabel} onClose={() => setSelected(null)} onChanged={refresh} />
    </div>
  );
}
