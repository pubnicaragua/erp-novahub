import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ListTodo, CalendarDays, Bell, Database, ClipboardCheck } from 'lucide-react';
import { Tabs } from './ui/tabs';
import { cn } from './ui/utils';
import { ModuleSubnavigation } from './ui/ModuleSubnavigation';
import { motion, AnimatePresence } from 'motion/react';
import { TareasView } from './actividades/TareasView';
import { EventosView } from './actividades/EventosView';
import { RecordatoriosView } from './actividades/RecordatoriosView';
import { BitacoraView } from './actividades/BitacoraView';
import { ActividadesCalendarioView } from './actividades/ActividadesCalendarioView';
import { ReportesActividadesView } from './actividades/ReportesActividadesView';
import { tasksService, eventsService, remindersService, activityLogsService } from '../services/actividades.service';
import { useAuth } from '../contexts/AuthContext';
import { asList, fetchAllReportPages, useTenantQuery } from '../hooks/useTenantQuery';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import { ExportMenu } from './ui/ExportMenu';
import { useNotificationDomainRefresh } from '../hooks/useNotificationDomainRefresh';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import { createReportWorkbook } from '../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';
import type { PdfDownloadFormat } from '../utils/pdfDownloadFormats';
import { toast } from '../services/toast';

interface ActividadesPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

const ACTIVITY_EXPORT_TARGETS: Record<string, { targetKey: string; label: string; permission: string }> = {
  tareas: { targetKey: 'actividades.tasks', label: 'Tareas', permission: 'ACTIVITIES_TASKS' },
  eventos: { targetKey: 'actividades.events', label: 'Eventos', permission: 'ACTIVITIES_EVENTS' },
  recordatorios: { targetKey: 'actividades.reminders', label: 'Recordatorios', permission: 'ACTIVITIES_REMINDERS' },
  bitacora: { targetKey: 'actividades.logs', label: 'Bitácora de actividades', permission: 'ACTIVITIES_LOGS' },
  calendario: { targetKey: 'actividades.calendar', label: 'Calendario de actividades', permission: 'ACTIVITIES_CALENDAR' },
  reuniones: { targetKey: 'actividades.meetings', label: 'Reuniones', permission: 'ACTIVITIES_MEETINGS' },
};

const activityExportDate = (value: unknown) => {
  if (!value) return '—';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('es-NI');
};

export const ActividadesPage = ({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: ActividadesPageProps) => {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [internalActiveTab, setInternalActiveTab] = useState('tareas');
  const activeTab = activeSubModule || internalActiveTab;
  const navRef = useRef<HTMLDivElement | null>(null);

  // Cada pestaña consulta solo sus datos cuando se activa. React Query conserva
  // los resultados por tenant y aborta la petición anterior al cambiar rápido.
  const reportFilters = { pageSize: 5000, report: true };
  const tasksQuery = useTenantQuery<any[]>(['activities', 'tasks', activeTab], signal => fetchAllReportPages((filters) => tasksService.getAll(signal, {
    ...filters,
    ...(activeTab === 'calendario' ? { view: 'calendar' } : {}),
  }), reportFilters, signal), {
    enabled: (activeTab === 'tareas' || activeTab === 'calendario')
      && canPerform('ACTIVITIES_TASKS', 'view')
      && (activeTab !== 'calendario' || canPerform('ACTIVITIES_CALENDAR', 'view')),
  });
  const eventsQuery = useTenantQuery<any[]>(['activities', 'events', activeTab], signal => fetchAllReportPages((filters) => eventsService.getAll(signal, {
    ...filters,
    ...(activeTab === 'calendario' ? { view: 'calendar' } : activeTab === 'reuniones' ? { view: 'MEETING' } : { view: 'EVENT' }),
  }), reportFilters, signal), {
    enabled: ['eventos', 'calendario', 'reuniones'].includes(activeTab)
      && canPerform(activeTab === 'calendario' ? 'ACTIVITIES_CALENDAR' : activeTab === 'reuniones' ? 'ACTIVITIES_MEETINGS' : 'ACTIVITIES_EVENTS', 'view'),
  });
  const remindersQuery = useTenantQuery<any[]>(['activities', 'reminders'], signal => fetchAllReportPages((filters) => remindersService.getAll(signal, filters), reportFilters, signal), {
    enabled: activeTab === 'recordatorios' && canPerform('ACTIVITIES_REMINDERS', 'view'),
  });
  const logsQuery = useTenantQuery<any[]>(['activities', 'logs'], signal => fetchAllReportPages((filters) => activityLogsService.getAll(signal, filters), reportFilters, signal), {
    enabled: activeTab === 'bitacora' && canPerform('ACTIVITIES_LOGS', 'view'),
  });

  const data = useMemo(() => {
    let fetchTareas = asList(tasksQuery.data);
    let fetchRecordatorios = asList(remindersQuery.data);
    const fetchEventos = asList(eventsQuery.data);
    const fetchBitacora = asList(logsQuery.data);

    // Mantener la visibilidad existente para usuarios que no son administradores.
    if (user && user.role !== 'admin' && !user.isPlatformAdmin && !user.managerCanAdminBranch) {
      fetchTareas = fetchTareas.filter((t: any) =>
        t.createdBy === user.id || t.assignments?.some((a: any) => a.userId === user.id)
      );
      fetchRecordatorios = fetchRecordatorios.filter((r: any) => {
        if (r.scope === 'GLOBAL' || r.scope === 'DEPARTMENT') return true;
        if (r.scope === 'PERSONAL') {
          try { return JSON.parse(r.targetId).includes(user.id); }
          catch { return r.targetId === user.id; }
        }
        return false;
      });
    }

    return { tareas: fetchTareas, eventos: fetchEventos, recordatorios: fetchRecordatorios, bitacora: fetchBitacora };
  }, [tasksQuery.data, eventsQuery.data, remindersQuery.data, logsQuery.data, user]);

  const activeQuery = activeTab === 'tareas' ? tasksQuery
    : ['eventos', 'calendario', 'reuniones'].includes(activeTab) ? eventsQuery
    : activeTab === 'recordatorios' ? remindersQuery
    : logsQuery;
  const loading = activeQuery.isLoading || activeQuery.isFetching;
  const fetchData = () => queryClient.invalidateQueries({ queryKey: ['tenant-module'] });
  const activeExportTarget = ACTIVITY_EXPORT_TARGETS[activeTab];
  const canExportActive = Boolean(activeExportTarget
    && canPerform(activeExportTarget.permission, 'view')
    && canPerform(activeExportTarget.permission, 'export'));

  // Las pestañas sin exportación del menú (Reportes tiene la suya propia) también necesitan la barra para poder cambiar de pestaña.
  const showFloatingNav = canExportActive || !activeExportTarget;

  const exportActivities = async (format: 'pdf' | 'xlsx', paperFormat: PdfDownloadFormat = 'letter') => {
    if (!activeExportTarget || !canExportActive) return;
    const toastId = toast.loading(`Preparando ${format === 'pdf' ? 'PDF' : 'Excel'} de ${activeExportTarget.label}…`);
    try {
      const exportParams = { report: true, export: true };
      const [tasks, events, reminders, logs] = await Promise.all([
        activeTab === 'calendario' && canPerform('ACTIVITIES_TASKS', 'view')
          ? tasksService.getAll(undefined, { ...exportParams, view: 'calendar' })
          : Promise.resolve([]),
        ['eventos', 'calendario', 'reuniones'].includes(activeTab) ? eventsService.getAll(undefined, {
          ...exportParams,
          ...(activeTab === 'calendario' ? { view: 'calendar' } : activeTab === 'reuniones' ? { view: 'MEETING' } : { view: 'EVENT' }),
        }) : Promise.resolve([]),
        activeTab === 'recordatorios' ? remindersService.getAll(undefined, exportParams) : Promise.resolve([]),
        activeTab === 'bitacora' ? activityLogsService.getAll(undefined, exportParams) : Promise.resolve([]),
      ]);
      const sourceRows = activeTab === 'tareas' ? asList(await tasksService.getAll(undefined, exportParams))
        : activeTab === 'eventos' || activeTab === 'reuniones' ? asList(events)
          : activeTab === 'calendario' ? [...asList(tasks), ...asList(events)]
            : activeTab === 'recordatorios' ? asList(reminders)
              : asList(logs);
      const rows = sourceRows.map((row: any) => {
        if (activeTab === 'tareas') return { Título: row.title || row.name || '—', Responsable: row.assignedTo?.name || row.assignee?.name || row.assignedToName || '—', Prioridad: row.priority || '—', Vencimiento: activityExportDate(row.dueDate), Estado: row.status || '—' };
        if (activeTab === 'eventos' || activeTab === 'reuniones') return { Evento: row.title || row.name || '—', Inicio: activityExportDate(row.startAt || row.startDate), Fin: activityExportDate(row.endAt || row.endDate), Lugar: row.location || '—', Responsable: row.organizer?.name || row.createdBy?.name || '—', Estado: row.status || '—' };
        if (activeTab === 'calendario') return { Tipo: row.title ? 'Evento' : 'Tarea', Título: row.title || row.name || '—', Inicio: activityExportDate(row.startAt || row.startDate || row.dueDate), Fin: activityExportDate(row.endAt || row.endDate), Responsable: row.assignedTo?.name || row.organizer?.name || '—', Estado: row.status || '—' };
        if (activeTab === 'recordatorios') return { Recordatorio: row.title || row.message || row.description || '—', Fecha: activityExportDate(row.remindAt || row.date || row.dueDate), Alcance: row.scope || '—', Responsable: row.createdBy?.name || row.user?.name || '—', Estado: row.status || '—' };
        return { Fecha: activityExportDate(row.createdAt || row.date), Acción: row.action || row.type || '—', Usuario: row.user?.name || row.actor?.name || '—', Módulo: row.module || '—', Registro: row.recordId || row.entityId || '—', Resultado: row.result || row.status || '—' };
      });
      const headers = rows.length ? Object.keys(rows[0]) : ['Mensaje'];
      const sections = [{ id: activeExportTarget.targetKey, title: activeExportTarget.label, headers, rows: rows.length ? rows.map((row) => headers.map((header) => row[header] as string | number)) : [['Sin registros para el alcance seleccionado']] }];
      if (format === 'xlsx') {
        createReportWorkbook({ fileName: buildDatedDownloadFileName([`reporte_actividades_${activeTab}`], 'xlsx'), sheets: [{ name: activeExportTarget.label, rows }], filters: { Vista: activeExportTarget.label, Alcance: 'Todos los registros autorizados' } });
      } else {
        await generateConfiguredReportSectionsPDF({ targetKey: activeExportTarget.targetKey, title: activeExportTarget.label, tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || null, sections, format: paperFormat, fileName: buildDatedDownloadFileName([`reporte_actividades_${activeTab}`], 'pdf') });
      }
      toast.success(`${format === 'pdf' ? 'PDF' : 'Excel'} exportado correctamente`, { id: toastId });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo generar la exportación', { id: toastId });
    }
  };

  useNotificationDomainRefresh({
    module: 'actividades',
    subModules: ['tareas', 'eventos', 'recordatorios', 'calendario', 'reuniones'],
    onRefresh: () => {
      void queryClient.invalidateQueries({ queryKey: ['activities'], refetchType: 'active' });
    },
  });

  const tabs = [
    { id: 'tareas', label: 'Tareas', icon: ListTodo, color: 'text-blue-500', module: 'ACTIVITIES_TASKS' },
    { id: 'reportes', label: 'Reportes', icon: ClipboardCheck, color: 'text-primary', module: 'ACTIVITIES_TASKS' },
    { id: 'eventos', label: 'Eventos', icon: CalendarDays, color: 'text-emerald-500', module: 'ACTIVITIES_EVENTS' },
    { id: 'recordatorios', label: 'Recordatorios', icon: Bell, color: 'text-amber-500', module: 'ACTIVITIES_REMINDERS' },
    { id: 'bitacora', label: 'Bitácora', icon: Database, color: 'text-rose-500', module: 'ACTIVITIES_LOGS' }
    ,{ id: 'calendario', label: 'Calendario', icon: CalendarDays, color: 'text-cyan-500', module: 'ACTIVITIES_CALENDAR' }
    ,{ id: 'reuniones', label: 'Reuniones', icon: CalendarDays, color: 'text-violet-500', module: 'ACTIVITIES_MEETINGS' }
  ];
  const visibleTabs = tabs.filter((tab) => {
    const hasRequired = user?.enabledModules?.includes(tab.module);
    const hasFallback = user?.enabledModules?.includes('ACTIVITIES');
    return (!user?.enabledModules || hasRequired || hasFallback) && canPerform(tab.module, 'view');
  });

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (visibleTabs.some((tab) => tab.id === activeTab)) return;
    const fallback = visibleTabs[0].id;
    setInternalActiveTab(fallback);
    onSubModuleChange?.(fallback);
  }, [activeTab, onSubModuleChange, visibleTabs]);

  // La barra de pestañas flota arriba a la derecha. Medimos cuánto ocupa para que el subtítulo de cada vista
  // no quede debajo de ella: se angosta a su izquierda o, si no cabe, baja por debajo de la barra.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const host = nav?.parentElement;
    if (!nav || !host) return;
    const measure = () => {
      const floating = window.getComputedStyle(nav).position === 'absolute' && nav.offsetWidth > 0;
      let clear = 0;
      let push = 0;
      if (floating) {
        const room = host.clientWidth - nav.offsetWidth - 16;
        if (room >= 320) clear = nav.offsetWidth + 16;
        else push = Math.max(0, nav.offsetHeight + 8 - 44);
      }
      host.style.setProperty('--activities-nav-clear', clear + 'px');
      host.style.setProperty('--activities-nav-push', push + 'px');
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(nav);
    observer?.observe(host);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [showFloatingNav, visibleTabs.length, isSidebarCollapsed]);

  const handleTabChange = (value: string) => {
    if (!visibleTabs.some((tab) => tab.id === value)) return;
    setInternalActiveTab(value);
    onSubModuleChange?.(value);
  };

  return (
    <div className="activities-module flex min-w-0 max-w-full flex-1 overflow-x-hidden bg-background">
      <main className="relative min-w-0 flex-1">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">

          <CurrencyValuationBanner className="mb-3" />

          <Tabs value={activeTab} className="relative w-full min-w-0" onValueChange={handleTabChange}>
            <div ref={navRef} className={cn('flex w-full min-w-0 max-w-full items-center gap-2', showFloatingNav ? 'mb-4 sm:absolute sm:right-0 sm:top-0 sm:z-10 sm:mb-0 sm:w-auto' : 'mb-0 sm:hidden')}>
            <ModuleSubnavigation
              items={visibleTabs.map((tab) => ({ id: tab.id, label: tab.label, icon: <tab.icon className="size-4" /> }))}
              value={activeTab}
              onValueChange={handleTabChange}
              isSidebarCollapsed={isSidebarCollapsed}
              ariaLabel="Navegación de Actividades"
              className="mb-0 min-w-0 flex-1"
            />
            {canExportActive && <ExportMenu onPdf={(paperFormat) => void exportActivities('pdf', paperFormat)} onExcel={() => void exportActivities('xlsx')} className="relative z-10 shrink-0 sm:ml-auto" pdfDescription="Plantilla configurada para esta vista" excelDescription="Todos los registros autorizados" />}
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                className="w-full min-w-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'reportes' && <ReportesActividadesView />}
                {activeTab === 'tareas' && <TareasView data={data.tareas} loading={loading} summaryError={activeQuery.isError} onRefresh={fetchData} />}
                {['eventos', 'reuniones'].includes(activeTab) && (
                  <EventosView
                    data={
                      activeTab === 'reuniones'
                        ? data.eventos.filter((e: any) => e.type === 'MEETING' || (!e.type && Boolean(e.meetingUrl || e.meetingPlatform)))
                        : data.eventos.filter((e: any) => e.type === 'EVENT' || (!e.type && !e.meetingUrl && !e.meetingPlatform))
                    }
                    mode={activeTab as 'eventos' | 'reuniones'}
                    loading={loading}
                    summaryError={activeQuery.isError}
                    onRefresh={fetchData}
                  />
                )}
                {activeTab === 'calendario' && (
                  <ActividadesCalendarioView
                    eventos={data.eventos}
                    tareas={data.tareas}
                    loading={loading}
                    onRefresh={fetchData}
                    onNewEventClick={canPerform('ACTIVITIES_EVENTS', 'create') ? () => {
                      setInternalActiveTab('eventos');
                      onSubModuleChange?.('eventos');
                    } : undefined}
                    onNewMeetingClick={canPerform('ACTIVITIES_MEETINGS', 'create') ? () => {
                      setInternalActiveTab('reuniones');
                      onSubModuleChange?.('reuniones');
                    } : undefined}
                  />
                )}
                {activeTab === 'recordatorios' && <RecordatoriosView data={data.recordatorios} loading={loading} summaryError={activeQuery.isError} onRefresh={fetchData} />}
                {activeTab === 'bitacora' && <BitacoraView data={data.bitacora} loading={loading} summaryError={activeQuery.isError} onRefresh={fetchData} />}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
};
