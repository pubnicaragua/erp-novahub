"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Video,
  ListTodo,
  CalendarDays,
  Plus,
  Hammer,
  Activity,
  AlarmClock,
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  format,
  addDays,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isWithinInterval,
  parseISO,
  isValid,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { ActivityViewHeader } from './ActivityViewHeader';
import { CalendarTimeGrid, type CalItem } from './CalendarTimeGrid';
import { formatWorked } from './calendarLayout';
import { SalesKpiCard } from '../ventas/SalesKpiCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { usersService } from '../../services/users.service';
import { asList, useTenantQuery } from '../../hooks/useTenantQuery';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ActividadesCalendarioViewProps {
  eventos: any[];
  tareas?: any[];
  loading?: boolean;
  onRefresh?: () => void;
  onNewEventClick?: () => void;
  onNewMeetingClick?: () => void;
}

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const VIEW_LABEL: Record<ViewMode, string> = { month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Agenda' };

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const parsed = typeof value === 'string' ? parseISO(value) : new Date(value as any);
  return isValid(parsed) ? parsed : null;
};

const typeOf = (item: CalItem): 'meeting' | 'event' | 'task' => (item.kind === 'meeting' ? 'meeting' : item.kind === 'event' ? 'event' : 'task');

export const ActividadesCalendarioView: React.FC<ActividadesCalendarioViewProps> = ({
  eventos = [],
  tareas = [],
  loading = false,
  onRefresh,
  onNewEventClick,
  onNewMeetingClick,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedKind, setSelectedKind] = useState<'event' | 'task' | 'meeting'>('event');

  // Capas visibles y persona
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showWork, setShowWork] = useState(true);
  const [personId, setPersonId] = useState('ALL');

  const usersQuery = useTenantQuery<any[]>(['activities', 'calendar-users'], (signal) => usersService.getLookup(undefined, signal));
  const people = asList(usersQuery.data);

  /** Todo lo que se pinta en el calendario, normalizado. Las tareas aportan su vencimiento y el trabajo que se registró en ellas. */
  const allItems = useMemo(() => {
    const list: CalItem[] = [];
    const now = new Date();

    if (showEvents) {
      eventos.forEach((e) => {
        const start = parseDate(e.startDate || e.date || e.createdAt);
        if (!start) return;
        const end = parseDate(e.endDate) ?? start;
        const isMeeting = e.type === 'MEETING' || (!e.type && Boolean(e.meetingUrl || e.meetingPlatform));
        list.push({
          id: String(e.id),
          kind: isMeeting ? 'meeting' : 'event',
          title: e.title || 'Evento sin título',
          start,
          end,
          raw: e,
          status: e.status,
          subtitle: e.location || (isMeeting ? e.meetingPlatform || 'Videollamada' : undefined),
        });
      });
    }

    tareas.forEach((t) => {
      const assigneeIds: string[] = (t.assignments || []).map((a: any) => a.userId).filter(Boolean);
      const matchesPerson = personId === 'ALL' || assigneeIds.includes(personId) || t.assignedToId === personId;
      const status = String(t.status || '').toUpperCase();
      const assigneeNames = (t.assignments || []).map((a: any) => a.user?.name).filter(Boolean).join(', ');

      if (showTasks && matchesPerson) {
        const due = parseDate(t.dueDate || t.startDate || t.createdAt);
        if (due) {
          list.push({
            id: String(t.id),
            kind: 'task-due',
            title: t.title || 'Tarea sin título',
            start: due,
            end: due,
            raw: t,
            status,
            overdue: ['PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL'].includes(status) && due.getTime() < now.getTime(),
            subtitle: assigneeNames || undefined,
          });
        }
      }

      if (showWork) {
        (t.timeEntries || []).forEach((entry: any) => {
          if (personId !== 'ALL' && entry.userId !== personId) return;
          const start = parseDate(entry.startedAt);
          if (!start) return;
          const explicitEnd = parseDate(entry.endedAt);
          const seconds = Number(entry.durationSeconds) || 0;
          // Un cronómetro aún en marcha llega hasta ahora; una entrada manual dura lo que se anotó.
          const end = explicitEnd ?? (seconds > 0 ? new Date(start.getTime() + seconds * 1000) : now);
          if (end.getTime() <= start.getTime()) return;
          list.push({
            id: `${t.id}:${entry.id}`,
            kind: 'work',
            title: t.title || 'Tarea sin título',
            start,
            end,
            raw: t,
            status,
            subtitle: entry.description || assigneeNames || undefined,
          });
        });
      }
    });

    return list;
  }, [eventos, tareas, showEvents, showTasks, showWork, personId]);

  // Rango visible según la vista
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const gridDays = viewMode === 'day' ? [currentDate] : weekDays;

  const range = viewMode === 'day'
    ? { start: startOfDay(currentDate), end: endOfDay(currentDate) }
    : viewMode === 'week'
      ? { start: weekStart, end: endOfDay(weekEnd) }
      : { start: monthStart, end: endOfDay(monthEnd) };

  const rangeLabel = viewMode === 'day'
    ? format(currentDate, "EEEE d 'de' MMMM yyyy", { locale: es })
    : viewMode === 'week'
      ? `${format(weekStart, 'd MMM', { locale: es })} – ${format(weekEnd, 'd MMM yyyy', { locale: es })}`
      : format(currentDate, 'MMMM yyyy', { locale: es });

  const inRange = (item: CalItem) => item.kind === 'work'
    ? item.end.getTime() >= range.start.getTime() && item.start.getTime() <= range.end.getTime()
    : isWithinInterval(item.start, range);
  const rangeItems = useMemo(() => allItems.filter(inRange), [allItems, viewMode, currentDate]);  // eslint-disable-line react-hooks/exhaustive-deps
  const scheduledItems = rangeItems.filter((item) => item.kind !== 'work');
  const meetingsAndEvents = rangeItems.filter((item) => item.kind === 'event' || item.kind === 'meeting').length;
  const dueSoon = rangeItems.filter((item) => item.kind === 'task-due' && !['COMPLETED', 'CANCELLED'].includes(String(item.status || '').toUpperCase())).length;
  const workedMinutes = rangeItems
    .filter((item) => item.kind === 'work')
    .reduce((sum, item) => {
      const start = Math.max(item.start.getTime(), range.start.getTime());
      const end = Math.min(item.end.getTime(), range.end.getTime());
      return sum + Math.max(0, Math.round((end - start) / 60_000));
    }, 0);

  // Navegación: avanza lo que muestra la vista (mes, semana o día)
  const step = (direction: 1 | -1) => setCurrentDate((prev) => (
    viewMode === 'day' ? addDays(prev, direction) : viewMode === 'week' ? addDays(prev, 7 * direction) : direction === 1 ? addMonths(prev, 1) : subMonths(prev, 1)
  ));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today);
  };

  const selectedDayItems = useMemo(
    () => allItems.filter((item) => item.kind !== 'work' && isSameDay(item.start, selectedDay)).sort((a, b) => a.start.getTime() - b.start.getTime()),
    [allItems, selectedDay],
  );
  const selectedDayWorked = useMemo(
    () => allItems.filter((item) => item.kind === 'work' && isSameDay(item.start, selectedDay)).reduce((sum, item) => sum + Math.round((item.end.getTime() - item.start.getTime()) / 60_000), 0),
    [allItems, selectedDay],
  );

  const handleOpenItem = (item: CalItem) => {
    setSelectedItem(item.raw);
    setSelectedKind(typeOf(item));
  };

  const periodNoun = viewMode === 'day' ? 'del día' : viewMode === 'week' ? 'de la semana' : 'del mes';

  return (
    <div className="min-w-0 space-y-6">
      <ActivityViewHeader
        title="Calendario"
        tourPrefix="calendario-tutorial"
        helpLabel="Cómo leer el Calendario"
        helpTitle="Calendario"
        helpDescription="Muestra por día y por hora lo que se agenda (eventos y reuniones), lo que vence (tareas) y el trabajo que el equipo registró en las tareas."
        dataTitle="Mes, semana, día y agenda"
        dataDescription="Usa «Semana» o «Día» para ver cada actividad en su hora. Los bloques punteados son trabajo ya registrado en tareas; las banderas, los vencimientos."
        actionsTitle="Filtra por persona"
        actionsDescription="Elige una persona para ver solo sus tareas y el trabajo que registró, y activa o apaga cada capa. Toca un bloque para abrir su detalle."
        purpose="Qué se hace, cuándo y quién: citas, vencimientos y trabajo registrado, ordenados por día y por hora."
      />

      <div className="space-y-2" data-tour="calendario-tutorial-data" aria-busy={loading}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SalesKpiCard title="Actividades" value={loading ? '—' : scheduledItems.length} icon={Activity} kind="indicator" sub={`Agendadas y por vencer ${periodNoun}`} />
          <SalesKpiCard title="Eventos y reuniones" value={loading ? '—' : meetingsAndEvents} icon={CalendarDays} kind="indicator" sub={rangeLabel} />
          <SalesKpiCard title="Tareas por vencer" value={loading ? '—' : dueSoon} icon={AlarmClock} kind="indicator" sub="Sin cerrar" />
          <SalesKpiCard title="Trabajo registrado" value={loading ? '—' : formatWorked(workedMinutes)} icon={Hammer} kind="indicator" sub="Tiempo anotado en tareas" />
        </div>
      </div>

      {/* Barra: navegación a la izquierda; persona, capas, vista y «Nuevo» a la derecha */}
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border/50 bg-card/90 p-3.5 shadow-sm backdrop-blur-sm lg:flex-row lg:items-center" data-tour="calendario-tutorial-actions">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-border/50 bg-background/80 p-1 shadow-sm">
            <Button type="button" variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Anterior" className="size-8 rounded-lg text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={goToToday} className="h-8 px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              Hoy
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => step(1)} aria-label="Siguiente" className="size-8 rounded-lg text-muted-foreground hover:text-foreground">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <h3 className="pl-1 text-base font-black capitalize tracking-tight text-foreground sm:text-lg" aria-live="polite">{rangeLabel}</h3>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-2 lg:w-auto lg:justify-end">
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger className="h-9 w-48 rounded-xl text-xs" aria-label="Persona" data-testid="calendar-person">
              <SelectValue placeholder="Todas las personas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las personas</SelectItem>
              {people.map((person: any) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded-xl border border-border/40 bg-muted/40 p-1 text-xs" role="group" aria-label="Capas del calendario">
            {([
              { key: 'events', label: 'Eventos y reuniones', on: showEvents, toggle: () => setShowEvents((v) => !v), dot: 'bg-emerald-500', activeCls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
              { key: 'tasks', label: 'Vencimientos', on: showTasks, toggle: () => setShowTasks((v) => !v), dot: 'bg-blue-500', activeCls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
              { key: 'work', label: 'Trabajo registrado', on: showWork, toggle: () => setShowWork((v) => !v), dot: 'bg-sky-400', activeCls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
            ] as const).map((layer) => (
              <button
                key={layer.key}
                type="button"
                aria-pressed={layer.on}
                onClick={layer.toggle}
                className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all', layer.on ? layer.activeCls : 'text-muted-foreground opacity-60 hover:opacity-100')}
              >
                <span className={cn('size-2 rounded-full', layer.dot)} />
                {layer.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-muted/50 p-1" role="group" aria-label="Vista del calendario">
            {(Object.keys(VIEW_LABEL) as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={viewMode === mode ? 'default' : 'ghost'}
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={cn('h-7 rounded-lg px-3 text-xs font-bold', viewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              >
                {VIEW_LABEL[mode]}
              </Button>
            ))}
          </div>

          {(onNewEventClick || onNewMeetingClick) && (
            onNewEventClick && onNewMeetingClick ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="sm" data-toolbar-role="primary" className="h-8 gap-1.5 rounded-xl bg-primary px-3 text-xs font-black uppercase tracking-wider text-primary-foreground">
                    <Plus className="size-3.5" />
                    Nuevo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem onClick={onNewEventClick} className="cursor-pointer gap-2 text-xs font-bold">
                    <CalendarDays className="size-4 text-emerald-600" />
                    Nuevo Evento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onNewMeetingClick} className="cursor-pointer gap-2 text-xs font-bold">
                    <Video className="size-4 text-violet-600" />
                    Nueva Reunión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button type="button" onClick={onNewEventClick || onNewMeetingClick} size="sm" data-toolbar-role="primary" className="h-8 gap-1.5 rounded-xl bg-primary px-3 text-xs font-black uppercase tracking-wider text-primary-foreground">
                <Plus className="size-3.5" />
                Nuevo
              </Button>
            )
          )}
        </div>
      </div>

      {(viewMode === 'week' || viewMode === 'day') && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] font-medium text-muted-foreground" aria-label="Leyenda">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-l-4 border-emerald-500 bg-emerald-500/20" />Evento</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-l-4 border-violet-500 bg-violet-500/20" />Reunión</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-l-4 border-blue-500 bg-blue-500/20" />Vence una tarea</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-l-4 border-destructive bg-destructive/15" />Vencida sin cerrar</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border-l-4 border-dashed border-sky-500 bg-sky-500/15" />Trabajo registrado</span>
          </div>
          <CalendarTimeGrid
            days={gridDays}
            items={allItems}
            onOpen={handleOpenItem}
            onSelectDay={(day) => { setCurrentDate(day); setSelectedDay(day); setViewMode('day'); }}
          />
          {rangeItems.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground" role="status">No hay actividades {periodNoun} con estas capas y esta persona.</p>
          )}
        </>
      )}

      {viewMode === 'month' && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-4">
          <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm lg:col-span-3">
            <CardContent className="p-2 sm:p-4">
              <div className="grid grid-cols-7 gap-1 border-b border-border/40 pb-2 text-center">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                  <div key={day} className="py-1 text-[11px] font-black uppercase tracking-wider text-muted-foreground">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 pt-2">
                {calendarDays.map((day) => {
                  const dayItems = allItems.filter((a) => a.kind !== 'work' && isSameDay(a.start, day)).sort((a, b) => a.start.getTime() - b.start.getTime());
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = isSameDay(day, selectedDay);
                  const isDayToday = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      onDoubleClick={() => { setCurrentDate(day); setViewMode('day'); }}
                      className={cn(
                        'group flex min-h-[85px] cursor-pointer flex-col justify-between rounded-2xl border p-1.5 transition-all sm:min-h-[105px] sm:p-2',
                        isCurrentMonth ? 'bg-background/40 hover:bg-muted/40' : 'bg-muted/10 opacity-40',
                        isSelected ? 'border-transparent bg-primary/[0.04] ring-2 ring-primary' : 'border-border/30',
                        isDayToday && 'border-primary/50',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn('flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors', isDayToday ? 'bg-primary font-black text-primary-foreground shadow-xs' : isSelected ? 'bg-primary/20 font-black text-primary' : 'text-foreground')}>
                          {format(day, 'd')}
                        </span>
                        {dayItems.length > 0 && <span className="text-[10px] font-black text-muted-foreground">{dayItems.length}</span>}
                      </div>

                      <div className="mt-1 flex-1 space-y-1 overflow-hidden">
                        {dayItems.slice(0, 3).map((act) => (
                          <div
                            key={`${act.kind}-${act.id}`}
                            onClick={(e) => { e.stopPropagation(); handleOpenItem(act); }}
                            className={cn(
                              'flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-transform active:scale-95 sm:text-[11px]',
                              typeOf(act) === 'meeting'
                                ? 'bg-violet-500/15 text-violet-700 hover:bg-violet-500/25 dark:text-violet-300'
                                : typeOf(act) === 'event'
                                  ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300'
                                  : act.overdue
                                    ? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
                                    : 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 dark:text-blue-300',
                            )}
                            title={`${act.title} (${format(act.start, 'hh:mm a')})`}
                          >
                            {act.kind === 'meeting' ? <Video className="size-2.5 shrink-0" /> : act.kind === 'event' ? <CalendarDays className="size-2.5 shrink-0" /> : <ListTodo className="size-2.5 shrink-0" />}
                            <span className="truncate">{act.title}</span>
                          </div>
                        ))}
                        {dayItems.length > 3 && <p className="pl-1 text-[9px] font-bold text-muted-foreground">+{dayItems.length - 3} más</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
            <div className="border-b border-border/40 bg-muted/20 p-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Actividades programadas</p>
              <h3 className="mt-0.5 text-sm font-black capitalize text-foreground">{format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })}</h3>
              {selectedDayWorked > 0 && <p className="mt-1 text-[11px] font-medium text-muted-foreground">Trabajo registrado: {formatWorked(selectedDayWorked)}</p>}
              <Button type="button" variant="link" className="mt-1 h-auto p-0 text-[11px] font-bold" onClick={() => { setCurrentDate(selectedDay); setViewMode('day'); }}>Ver este día por hora</Button>
            </div>

            <CardContent className="custom-scrollbar max-h-[600px] space-y-2 overflow-y-auto p-3">
              {selectedDayItems.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <CalendarDays className="mx-auto mb-2 size-10 text-muted-foreground/30" />
                  <p className="text-xs font-bold text-foreground">Sin actividades este día</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Puedes agendar un nuevo evento o reunión con el botón superior.</p>
                </div>
              ) : (
                selectedDayItems.map((act) => {
                  const type = typeOf(act);
                  return (
                    <div
                      key={`${act.kind}-${act.id}`}
                      onClick={() => handleOpenItem(act)}
                      className={cn(
                        'cursor-pointer space-y-2 rounded-2xl border p-3 transition-all hover:border-primary/40 hover:shadow-md',
                        type === 'meeting' ? 'border-violet-500/20 bg-violet-500/[0.04]' : type === 'event' ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-blue-500/20 bg-blue-500/[0.04]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="line-clamp-2 text-xs font-black text-foreground">{act.title}</h4>
                        <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[9px] font-black uppercase tracking-wider', type === 'meeting' ? 'border-violet-500/30 text-violet-600' : type === 'event' ? 'border-emerald-500/30 text-emerald-600' : 'border-blue-500/30 text-blue-600')}>
                          {type === 'meeting' ? 'Reunión' : type === 'event' ? 'Evento' : 'Tarea'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="size-3 text-primary" />
                          {format(act.start, 'hh:mm a')}
                          {(act.kind === 'event' || act.kind === 'meeting') && act.end.getTime() > act.start.getTime() && ` - ${format(act.end, 'hh:mm a')}`}
                        </span>
                        {act.subtitle && (
                          <span className="flex max-w-[140px] items-center gap-1 truncate">
                            {type === 'task' ? <Users className="size-3 shrink-0 text-muted-foreground/60" /> : <MapPin className="size-3 shrink-0 text-muted-foreground/60" />}
                            {act.subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {viewMode === 'agenda' && (
        <Card className="overflow-hidden rounded-3xl border-border/50 bg-card/80 shadow-sm">
          <CardContent className="p-4 sm:p-6">
            {allItems.filter((item) => item.kind !== 'work').length === 0 ? (
              <div className="py-16 text-center">
                <CalendarIcon className="mx-auto mb-3 size-12 text-muted-foreground/30" />
                <h4 className="text-sm font-bold text-foreground">No hay actividades registradas</h4>
                <p className="mt-1 text-xs text-muted-foreground">Comienza creando un evento o tarea para ver tu agenda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allItems
                  .filter((item) => item.kind !== 'work')
                  .sort((a, b) => a.start.getTime() - b.start.getTime())
                  .map((act) => {
                    const type = typeOf(act);
                    return (
                      <div
                        key={`${act.kind}-${act.id}`}
                        onClick={() => handleOpenItem(act)}
                        className="flex cursor-pointer flex-col justify-between gap-3 rounded-2xl border border-border/40 bg-background/50 p-3.5 transition-all hover:bg-muted/40 sm:flex-row sm:items-center"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn('mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl', type === 'meeting' ? 'bg-violet-500/10 text-violet-600' : type === 'event' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600')}>
                            {type === 'meeting' ? <Video className="size-5" /> : type === 'event' ? <CalendarDays className="size-5" /> : <ListTodo className="size-5" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-foreground sm:text-sm">{act.title}</h4>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="font-semibold capitalize text-foreground/80">{format(act.start, "EEEE, d 'de' MMMM", { locale: es })}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Clock className="size-3 text-primary" />{format(act.start, 'hh:mm a')}</span>
                              {act.subtitle && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1"><MapPin className="size-3 text-muted-foreground/60" />{act.subtitle}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Badge variant="outline" className={cn('px-2.5 py-1 text-[10px] font-black uppercase tracking-wider', type === 'meeting' ? 'border-violet-500/30 bg-violet-500/5 text-violet-600' : type === 'event' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' : 'border-blue-500/30 bg-blue-500/5 text-blue-600')}>
                            {type === 'meeting' ? 'Reunión' : type === 'event' ? 'Evento' : 'Tarea'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ActivityDetailSheet
        kind={selectedKind}
        item={selectedKind === 'task' && selectedItem ? (tareas.find((task) => String(task.id) === String(selectedItem.id)) ?? selectedItem) : selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        onUpdate={onRefresh}
      />
    </div>
  );
};
