import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Activity, ListTodo, CalendarDays, Bell, Database } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
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

export const ActividadesPage = ({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: ActividadesPageProps) => {
  const { user, canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'tareas');

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

  useEffect(() => {
    if (activeSubModule) {
      setActiveTab(activeSubModule);
    }
  }, [activeSubModule]);

  const tabs = [
    { id: 'tareas', label: 'Tareas', icon: ListTodo, color: 'text-blue-500', module: 'ACTIVITIES_TASKS' },
    { id: 'eventos', label: 'Eventos', icon: CalendarDays, color: 'text-emerald-500', module: 'ACTIVITIES_EVENTS' },
    { id: 'recordatorios', label: 'Recordatorios', icon: Bell, color: 'text-amber-500', module: 'ACTIVITIES_REMINDERS' },
    { id: 'bitacora', label: 'Bitácora', icon: Database, color: 'text-rose-500', module: 'ACTIVITIES_LOGS' }
  ];

  return (
    <div className="flex flex-1 bg-background w-full">
      <main className="flex-1 relative">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Activity className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Actividades
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mt-2">
                  Gestión de tareas, eventos y registros
                </p>
              </div>
            </div>
          </div>

          <CurrencyValuationBanner className="mb-6" />

          <Tabs value={activeTab} className="w-full" onValueChange={(val) => {
            setActiveTab(val);
            if (onSubModuleChange) onSubModuleChange(val);
          }}>
            <div className={cn("w-full overflow-x-auto custom-scrollbar mb-6", !isSidebarCollapsed && "hidden lg:hidden")}>
            <TabsList className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground">
              {tabs.map((tab) => {
                const hasRequired = user?.enabledModules?.includes(tab.module);
                const hasSpecificSubmodules = user?.enabledModules?.some(m => m.startsWith('ACTIVITIES_'));
                const hasFallback = user?.enabledModules?.includes('ACTIVITIES') && !hasSpecificSubmodules;
                const hasAccess = (!user?.enabledModules || hasRequired || hasFallback) && canPerform(tab.module, 'view');
                if (!hasAccess) return null;
                return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
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
