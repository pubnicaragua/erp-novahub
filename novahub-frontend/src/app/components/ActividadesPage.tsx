import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, ListTodo, CalendarDays, Bell, Database } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { TareasView } from './actividades/TareasView';
import { EventosView } from './actividades/EventosView';
import { RecordatoriosView } from './actividades/RecordatoriosView';
import { BitacoraView } from './actividades/BitacoraView';
import { tasksService, eventsService, remindersService, activityLogsService } from '../services/actividades.service';
import { useAuth } from '../contexts/AuthContext';
import { asList, useTenantQuery } from '../hooks/useTenantQuery';
import { CurrencyValuationBanner } from './ui/CurrencyValuation';

interface ActividadesPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

export const ActividadesPage = ({ activeSubModule, onSubModuleChange }: ActividadesPageProps) => {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [internalActiveTab, setInternalActiveTab] = useState('tareas');
  const activeTab = activeSubModule || internalActiveTab;

  // Cada pestaña consulta solo sus datos cuando se activa. React Query conserva
  // los resultados por tenant y aborta la petición anterior al cambiar rápido.
  const tasksQuery = useTenantQuery<any[]>(['activities', 'tasks'], signal => tasksService.getAll(signal), {
    enabled: activeTab === 'tareas' && canPerform('ACTIVITIES_TASKS', 'view'),
  });
  const eventsQuery = useTenantQuery<any[]>(['activities', 'events'], signal => eventsService.getAll(signal), {
    enabled: activeTab === 'eventos' && canPerform('ACTIVITIES_EVENTS', 'view'),
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
    : activeTab === 'eventos' ? eventsQuery
    : activeTab === 'recordatorios' ? remindersQuery
    : logsQuery;
  const loading = activeQuery.isLoading || activeQuery.isFetching;
  const fetchData = () => queryClient.invalidateQueries({ queryKey: ['tenant-module'] });

  const tabs = [
    { id: 'tareas', label: 'Tareas', icon: ListTodo, color: 'text-blue-500', module: 'ACTIVITIES_TASKS' },
    { id: 'eventos', label: 'Eventos', icon: CalendarDays, color: 'text-emerald-500', module: 'ACTIVITIES_EVENTS' },
    { id: 'recordatorios', label: 'Recordatorios', icon: Bell, color: 'text-amber-500', module: 'ACTIVITIES_REMINDERS' },
    { id: 'bitacora', label: 'Bitácora', icon: Database, color: 'text-rose-500', module: 'ACTIVITIES_LOGS' }
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
    <div className="flex min-w-0 max-w-full flex-1 overflow-x-hidden bg-background">
      <main className="relative min-w-0 flex-1">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1700px] p-4 sm:p-6 md:p-10">
          <div className="mb-6 flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:size-[66px]">
                <Activity className="size-7 text-primary sm:size-9" />
              </div>
              <div className="min-w-0">
                <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 break-words text-2xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">
                  Actividades
                </h1>
              </div>
            </div>
          </div>

          <CurrencyValuationBanner className="mb-6" />

          <Tabs value={activeTab} className="w-full min-w-0" onValueChange={handleTabChange}>
            <div className="mb-6 w-full min-w-0 max-w-full overscroll-x-contain overflow-x-auto custom-scrollbar">
            <TabsList className="flex h-auto w-max min-w-full max-w-none gap-1.5 rounded-2xl border border-border/40 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 backdrop-blur-sm [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {visibleTabs.map((tab) => {
                return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-black uppercase tracking-widest sm:px-4
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <tab.icon className="size-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
                );
              })}
            </TabsList>
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
                {activeTab === 'eventos' && <EventosView data={data.eventos} loading={loading} onRefresh={fetchData} />}
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
