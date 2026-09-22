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
  Sparkles,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Plus
} from 'lucide-react';
import { cn } from '../ui/utils';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid
} from 'date-fns';
import { es } from 'date-fns/locale';
import { ActivityDetailSheet } from './ActivityDetailSheet';
import { useCurrency } from '../../contexts/CurrencyContext';
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

type ViewMode = 'month' | 'agenda';

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
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedKind, setSelectedKind] = useState<'event' | 'task' | 'meeting'>('event');

  // Filtros activos
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);

  const { formatExplicitAmount } = useCurrency();

  // Parse activities into a unified calendar structure
  const allActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      date: Date;
      endDate?: Date;
      type: 'event' | 'meeting' | 'task';
      raw: any;
      location?: string;
      status?: string;
      isVirtual?: boolean;
      guestCount?: number;
    }> = [];

    if (showEvents) {
      eventos.forEach((e) => {
        const rawDate = e.startDate || e.date || e.createdAt;
        if (!rawDate) return;
        const parsed = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);
        if (!isValid(parsed)) return;

        let endParsed: Date | undefined;
        if (e.endDate) {
          const p = typeof e.endDate === 'string' ? parseISO(e.endDate) : new Date(e.endDate);
          if (isValid(p)) endParsed = p;
        }

        const isMeeting = e.type === 'MEETING' || (!e.type && Boolean(e.meetingUrl || e.meetingPlatform));
        const guestEmails = Array.isArray(e.guestEmails) ? e.guestEmails : [];

        list.push({
          id: String(e.id),
          title: e.title || 'Evento sin título',
          date: parsed,
          endDate: endParsed,
          type: isMeeting ? 'meeting' : 'event',
          raw: e,
          location: e.location || (isMeeting ? e.meetingPlatform || 'Videollamada' : undefined),
          status: e.status,
          isVirtual: Boolean(e.meetingUrl || e.meetingPlatform),
          guestCount: guestEmails.length,
        });
      });
    }

    if (showTasks) {
      tareas.forEach((t) => {
        const rawDate = t.dueDate || t.startDate || t.createdAt;
        if (!rawDate) return;
        const parsed = typeof rawDate === 'string' ? parseISO(rawDate) : new Date(rawDate);
        if (!isValid(parsed)) return;

        list.push({
          id: String(t.id),
          title: t.title || 'Tarea sin título',
          date: parsed,
          type: 'task',
          raw: t,
          status: t.status,
        });
      });
    }

    return list;
  }, [eventos, tareas, showEvents, showTasks]);

  // Rango del calendario mensual
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Comienza en Lunes
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Navegación
  const nextMonth = () => setCurrentDate((prev) => addMonths(prev, 1));
  const prevMonth = () => setCurrentDate((prev) => subMonths(prev, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDay(today);
  };

  // Actividades del día seleccionado
  const selectedDayActivities = useMemo(() => {
    return allActivities.filter((act) => isSameDay(act.date, selectedDay));
  }, [allActivities, selectedDay]);

  // Conteo de actividades del mes visible
  const monthActivitiesCount = useMemo(() => {
    return allActivities.filter((act) => isSameMonth(act.date, currentDate)).length;
  }, [allActivities, currentDate]);

  const handleOpenItem = (activity: any) => {
    setSelectedItem(activity.raw);
    setSelectedKind(activity.type === 'task' ? 'task' : activity.type === 'meeting' ? 'meeting' : 'event');
  };

  return (
    <div className="min-w-0 space-y-4">
      {/* Barra de herramientas y filtros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card/90 p-3.5 shadow-sm backdrop-blur-sm">
        {/* Controles de navegación de fecha */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-border/50 bg-background/80 p-1 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-8 px-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Hoy
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground capitalize pl-1">
            {format(currentDate, 'MMMM yyyy', { locale: es })}
          </h2>

          <Badge variant="outline" className="text-[11px] font-bold py-0.5 px-2 bg-primary/5 text-primary border-primary/20">
            {monthActivitiesCount} {monthActivitiesCount === 1 ? 'actividad' : 'actividades'}
          </Badge>
        </div>

        {/* Filtros por tipo y botones de vista */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Conmutadores de tipo */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/40 text-xs">
            <button
              type="button"
              onClick={() => setShowEvents(!showEvents)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all',
                showEvents
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground opacity-60 hover:opacity-100'
              )}
            >
              <span className="size-2 rounded-full bg-emerald-500" />
              Eventos & Reuniones
            </button>
            <button
              type="button"
              onClick={() => setShowTasks(!showTasks)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all',
                showTasks
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-muted-foreground opacity-60 hover:opacity-100'
              )}
            >
              <span className="size-2 rounded-full bg-blue-500" />
              Tareas
            </button>
          </div>

          {/* Selector de modo de vista */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl border border-border/50">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              onClick={() => setViewMode('month')}
              className={cn(
                'h-7 px-3 text-xs font-bold rounded-lg',
                viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              Mes
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'agenda' ? 'default' : 'ghost'}
              onClick={() => setViewMode('agenda')}
              className={cn(
                'h-7 px-3 text-xs font-bold rounded-lg',
                viewMode === 'agenda' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}
            >
              Agenda
            </Button>
          </div>

          {(onNewEventClick || onNewMeetingClick) && (
            onNewEventClick && onNewMeetingClick ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1.5 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider px-3"
                  >
                    <Plus className="size-3.5" />
                    Nuevo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 rounded-xl">
                  <DropdownMenuItem onClick={onNewEventClick} className="gap-2 text-xs font-bold cursor-pointer">
                    <CalendarDays className="size-4 text-emerald-600" />
                    Nuevo Evento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onNewMeetingClick} className="gap-2 text-xs font-bold cursor-pointer">
                    <Video className="size-4 text-violet-600" />
                    Nueva Reunión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                type="button"
                onClick={onNewEventClick || onNewMeetingClick}
                size="sm"
                className="h-8 gap-1.5 rounded-xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-wider px-3"
              >
                <Plus className="size-3.5" />
                Nuevo
              </Button>
            )
          )}
        </div>
      </div>

      {/* Contenedor principal: Vista de Mes o Vista de Agenda */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          {/* Cuadrícula de 7 columnas para el mes (3 cols en desktop) */}
          <Card className="lg:col-span-3 rounded-3xl border-border/50 bg-card/80 shadow-sm overflow-hidden">
            <CardContent className="p-2 sm:p-4">
              {/* Nombres de los días de la semana */}
              <div className="grid grid-cols-7 gap-1 pb-2 border-b border-border/40 text-center">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
                  <div key={day} className="text-[11px] font-black uppercase tracking-wider text-muted-foreground py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Casillas de los días */}
              <div className="grid grid-cols-7 gap-1 pt-2">
                {days.map((day) => {
                  const dayActivities = allActivities.filter((a) => isSameDay(a.date, day));
                  const isCurrentMonth = isSameMonth(day, currentDate);
                  const isSelected = isSameDay(day, selectedDay);
                  const isDayToday = isToday(day);

                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => setSelectedDay(day)}
                      className={cn(
                        'min-h-[85px] sm:min-h-[105px] rounded-2xl p-1.5 sm:p-2 border transition-all cursor-pointer flex flex-col justify-between group',
                        isCurrentMonth ? 'bg-background/40 hover:bg-muted/40' : 'bg-muted/10 opacity-40',
                        isSelected ? 'ring-2 ring-primary border-transparent bg-primary/[0.04]' : 'border-border/30',
                        isDayToday && 'border-primary/50'
                      )}
                    >
                      {/* Cabecera del día */}
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-bold size-6 flex items-center justify-center rounded-full transition-colors',
                            isDayToday
                              ? 'bg-primary text-primary-foreground font-black shadow-xs'
                              : isSelected
                              ? 'bg-primary/20 text-primary font-black'
                              : 'text-foreground'
                          )}
                        >
                          {format(day, 'd')}
                        </span>
                        {dayActivities.length > 0 && (
                          <span className="text-[10px] font-black text-muted-foreground">
                            {dayActivities.length}
                          </span>
                        )}
                      </div>

                      {/* Píldoras de actividades en el día (hasta 3 visibles) */}
                      <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                        {dayActivities.slice(0, 3).map((act) => (
                          <div
                            key={act.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenItem(act);
                            }}
                            className={cn(
                              'text-[10px] sm:text-[11px] font-semibold truncate rounded-md px-1.5 py-0.5 flex items-center gap-1 transition-transform active:scale-95',
                              act.type === 'meeting'
                                ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300 hover:bg-violet-500/25'
                                : act.type === 'event'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/25'
                            )}
                            title={`${act.title} (${format(act.date, 'hh:mm a')})`}
                          >
                            {act.type === 'meeting' ? (
                              <Video className="size-2.5 shrink-0" />
                            ) : act.type === 'event' ? (
                              <CalendarDays className="size-2.5 shrink-0" />
                            ) : (
                              <ListTodo className="size-2.5 shrink-0" />
                            )}
                            <span className="truncate">{act.title}</span>
                          </div>
                        ))}
                        {dayActivities.length > 3 && (
                          <p className="text-[9px] font-bold text-muted-foreground pl-1">
                            +{dayActivities.length - 3} más
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Panel lateral: Detalle de actividades del día seleccionado */}
          <Card className="rounded-3xl border-border/50 bg-card/80 shadow-sm overflow-hidden">
            <div className="border-b border-border/40 p-4 bg-muted/20">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                Actividades programadas
              </p>
              <h3 className="text-sm font-black text-foreground capitalize mt-0.5">
                {format(selectedDay, "EEEE, d 'de' MMMM", { locale: es })}
              </h3>
            </div>

            <CardContent className="p-3 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
              {selectedDayActivities.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <CalendarDays className="size-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs font-bold text-foreground">Sin actividades este día</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Puedes agendar un nuevo evento o reunión con el botón superior.
                  </p>
                </div>
              ) : (
                selectedDayActivities.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => handleOpenItem(act)}
                    className={cn(
                      'rounded-2xl p-3 border transition-all cursor-pointer hover:shadow-md hover:border-primary/40 space-y-2',
                      act.type === 'meeting'
                        ? 'bg-violet-500/[0.04] border-violet-500/20'
                        : act.type === 'event'
                        ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                        : 'bg-blue-500/[0.04] border-blue-500/20'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-black text-foreground line-clamp-2">
                        {act.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] font-black uppercase tracking-wider py-0 px-1.5 shrink-0',
                          act.type === 'meeting'
                            ? 'text-violet-600 border-violet-500/30'
                            : act.type === 'event'
                            ? 'text-emerald-600 border-emerald-500/30'
                            : 'text-blue-600 border-blue-500/30'
                        )}
                      >
                        {act.type === 'meeting' ? 'Reunión' : act.type === 'event' ? 'Evento' : 'Tarea'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="size-3 text-primary" />
                        {format(act.date, 'hh:mm a')}
                        {act.endDate && ` - ${format(act.endDate, 'hh:mm a')}`}
                      </span>

                      {act.location && (
                        <span className="flex items-center gap-1 truncate max-w-[140px]">
                          <MapPin className="size-3 text-muted-foreground/60 shrink-0" />
                          {act.location}
                        </span>
                      )}

                      {act.guestCount !== undefined && act.guestCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-muted-foreground/60" />
                          {act.guestCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Vista de Agenda (Lista cronológica completa) */
        <Card className="rounded-3xl border-border/50 bg-card/80 shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            {allActivities.length === 0 ? (
              <div className="text-center py-16">
                <CalendarIcon className="size-12 mx-auto text-muted-foreground/30 mb-3" />
                <h4 className="text-sm font-bold text-foreground">No hay actividades registradas</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Comienza creando un evento o tarea para ver tu agenda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allActivities
                  .sort((a, b) => a.date.getTime() - b.date.getTime())
                  .map((act) => (
                    <div
                      key={act.id}
                      onClick={() => handleOpenItem(act)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/40 bg-background/50 hover:bg-muted/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'size-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                            act.type === 'meeting'
                              ? 'bg-violet-500/10 text-violet-600'
                              : act.type === 'event'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-blue-500/10 text-blue-600'
                          )}
                        >
                          {act.type === 'meeting' ? (
                            <Video className="size-5" />
                          ) : act.type === 'event' ? (
                            <CalendarDays className="size-5" />
                          ) : (
                            <ListTodo className="size-5" />
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-foreground">
                            {act.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1">
                            <span className="font-semibold text-foreground/80 capitalize">
                              {format(act.date, "EEEE, d 'de' MMMM", { locale: es })}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3 text-primary" />
                              {format(act.date, 'hh:mm a')}
                            </span>
                            {act.location && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3 text-muted-foreground/60" />
                                  {act.location}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-black uppercase tracking-wider py-1 px-2.5',
                            act.type === 'meeting'
                              ? 'text-violet-600 border-violet-500/30 bg-violet-500/5'
                              : act.type === 'event'
                              ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/5'
                              : 'text-blue-600 border-blue-500/30 bg-blue-500/5'
                          )}
                        >
                          {act.type === 'meeting' ? 'Reunión' : act.type === 'event' ? 'Evento' : 'Tarea'}
                        </Badge>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Drawer lateral de detalles de actividad */}
      <ActivityDetailSheet
        kind={selectedKind}
        item={selectedItem}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        onUpdate={onRefresh}
      />
    </div>
  );
};
