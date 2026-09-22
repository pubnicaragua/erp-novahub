import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, ListTodo, CalendarDays, Bell, Database, Sparkles } from 'lucide-react';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { TareasView } from './actividades/TareasView';
import { EventosView } from './actividades/EventosView';
import { RecordatoriosView } from './actividades/RecordatoriosView';
import { BitacoraView } from './actividades/BitacoraView';
import { ActividadesCalendarioView } from './actividades/ActividadesCalendarioView';
import { tasksService, eventsService, remindersService, activityLogsService } from '../services/actividades.service';
import { useAuth } from '../contexts/AuthContext';
import { asList, useTenantQuery } from '../hooks/useTenantQuery';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';
import { ExportMenu } from './ui/ExportMenu';
import { useNotificationDomainRefresh } from '../hooks/useNotificationDomainRefresh';
import { generateConfiguredReportSectionsPDF } from '../utils/pdfGenerator';
import { createReportWorkbook } from '../utils/reportWorkbook';
import { buildDatedDownloadFileName } from '../utils/exportFileNames';
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

export const ActividadesPage = ({ activeSubModule, onSubModuleChange }: ActividadesPageProps) => {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [internalActiveTab, setInternalActiveTab] = useState('tareas');
  const activeTab = activeSubModule || internalActiveTab;

  // Cada pestaña consulta solo sus datos cuando se activa. React Query conserva
  // los resultados por tenant y aborta la petición anterior al cambiar rápido.
  const tasksQuery = useTenantQuery<any[]>(['activities', 'tasks'], signal => tasksService.getAll(signal), {
    enabled: (activeTab === 'tareas' || activeTab === 'calendario') && canPerform('ACTIVITIES_TASKS', 'view'),
  });
  const eventsQuery = useTenantQuery<any[]>(['activities', 'events'], signal => eventsService.getAll(signal), {
    enabled: ['eventos', 'calendario', 'reuniones'].includes(activeTab)
      && canPerform(activeTab === 'calendario' ? 'ACTIVITIES_CALENDAR' : activeTab === 'reuniones' ? 'ACTIVITIES_MEETINGS' : 'ACTIVITIES_EVENTS', 'view'),
  });
  const remindersQuery = useTenantQuery<any[]>(['activities', 'reminders'], signal => remindersService.getAll(signal), {
    enabled: activeTab === 'recordatorios' && canPerform('ACTIVITIES_REMINDERS', 'view'),
  });
  const logsQuery = useTenantQuery<any[]>(['activities', 'logs'], signal => activityLogsService.getAll(signal), {
    enabled: activeTab === 'bitacora' && canPerform('ACTIVITIES_LOGS', 'view'),
  });

  const data = useMemo(() => {
    let fetchTareas = asList(tasksQuery.data);
    let fetchRecordatorios = asList(remindersQuery.data);
    const fetchEventos = asList(eventsQuery.data);
    const fetchBitacora = asList(logsQuery.data);

    // Mantener la visibilidad existente para usuarios que no son administradores.
    if (user && user.role !== 'admin' && !user.isPlatformAdmin) {
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
  const canExportActive = Boolean(activeExportTarget && canPerform(activeExportTarget.permission, 'export'));

  const exportActivities = async (format: 'pdf' | 'xlsx') => {
    if (!activeExportTarget || !canExportActive) return;
    const toastId = toast.loading(`Preparando ${format === 'pdf' ? 'PDF' : 'Excel'} de ${activeExportTarget.label}…`);
    try {
      const params = { report: true, export: true };
      const [tasks, events, reminders, logs] = await Promise.all([
        activeTab === 'calendario' ? tasksService.getAll(undefined, params) : Promise.resolve([]),
        ['eventos', 'calendario', 'reuniones'].includes(activeTab) ? eventsService.getAll(undefined, params) : Promise.resolve([]),
        activeTab === 'recordatorios' ? remindersService.getAll(undefined, params) : Promise.resolve([]),
        activeTab === 'bitacora' ? activityLogsService.getAll(undefined, params) : Promise.resolve([]),
      ]);
      const sourceRows = activeTab === 'tareas' ? asList(await tasksService.getAll(undefined, params))
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
        await generateConfiguredReportSectionsPDF({ targetKey: activeExportTarget.targetKey, title: activeExportTarget.label, tenantName: user?.tenantName || 'Mi Empresa', tenantLogo: user?.sessionBranding?.logo || null, sections, fileName: buildDatedDownloadFileName([`reporte_actividades_${activeTab}`], 'pdf') });
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

          <Tabs value={activeTab} className="w-full min-w-0" onValueChange={handleTabChange}>
            <div className="mb-4 flex w-full min-w-0 max-w-full items-center gap-2">
            <div className="min-w-0 flex-1 overscroll-x-contain overflow-x-auto custom-scrollbar">
            <TabsList className="flex h-auto w-max min-w-full max-w-none gap-1.5 rounded-2xl border border-border/50 bg-card/80 p-1.5 shadow-sm backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {visibleTabs.map((tab) => {
                return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-widest sm:px-4
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.98]"
                >
                  <tab.icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
                );
              })}
            </TabsList>
            </div>
            {canExportActive && <ExportMenu onPdf={() => void exportActivities('pdf')} onExcel={() => void exportActivities('xlsx')} className="shrink-0" pdfDescription="Plantilla configurada para esta vista" excelDescription="Todos los registros autorizados" />}
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
                {activeTab === 'tareas' && <TareasView data={data.tareas} loading={loading} onRefresh={fetchData} />}
                {['eventos', 'reuniones'].includes(activeTab) && <EventosView data={data.eventos} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'calendario' && (
                  <ActividadesCalendarioView
                    eventos={data.eventos}
                    tareas={data.tareas}
                    loading={loading}
                    onRefresh={fetchData}
                    onNewEventClick={() => {
                      setInternalActiveTab('eventos');
                      onSubModuleChange?.('eventos');
                    }}
                  />
                )}
                {activeTab === 'recordatorios' && <RecordatoriosView data={data.recordatorios} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'bitacora' && <BitacoraView data={data.bitacora} loading={loading} onRefresh={fetchData} />}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
};
