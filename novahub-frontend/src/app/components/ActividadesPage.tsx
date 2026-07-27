import { useState, useEffect } from 'react';
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

interface ActividadesPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

export const ActividadesPage = ({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: ActividadesPageProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'tareas');
  const [data, setData] = useState<{ tareas: any[], eventos: any[], recordatorios: any[], bitacora: any[] }>({
    tareas: [],
    eventos: [],
    recordatorios: [],
    bitacora: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tareas, eventos, recordatorios, bitacora] = await Promise.all([
        tasksService.getAll().catch(() => []),
        eventsService.getAll().catch(() => []),
        remindersService.getAll().catch(() => []),
        activityLogsService.getAll().catch(() => [])
      ]);
      let fetchTareas = Array.isArray(tareas) ? tareas : (tareas as any).data || [];
      let fetchRecordatorios = Array.isArray(recordatorios) ? recordatorios : (recordatorios as any).data || [];
      const fetchEventos = Array.isArray(eventos) ? eventos : (eventos as any).data || [];
      const fetchBitacora = Array.isArray(bitacora) ? bitacora : (bitacora as any).data || [];

      // Filipter tareas y recordatorios segun el usuario
      if (user && user.role !== 'admin' && !user.isPlatformAdmin) {
         fetchTareas = fetchTareas.filter((t: any) => 
            t.createdBy === user.id || t.assignments?.some((a: any) => a.userId === user.id)
         );
         fetchRecordatorios = fetchRecordatorios.filter((r: any) => {
            if (r.scope === 'GLOBAL') return true;
            if (r.scope === 'DEPARTMENT') { return true; } // Por ahora visibles
            if (r.scope === 'PERSONAL') {
               try { const uIds = JSON.parse(r.targetId); return uIds.includes(user.id); } 
               catch { return r.targetId === user.id; }
            }
            return false;
         });
      }

      setData({ tareas: fetchTareas, eventos: fetchEventos, recordatorios: fetchRecordatorios, bitacora: fetchBitacora });
    } catch (error) {
      console.error('Error fetching actividades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
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

          <Tabs value={activeTab} className="w-full" onValueChange={(val) => {
            setActiveTab(val);
            if (onSubModuleChange) onSubModuleChange(val);
          }}>
            <TabsList className={cn(!isSidebarCollapsed && "hidden lg:hidden", "w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6 [&>button]:flex-none")}>
              {tabs.map((tab) => {
                const hasRequired = user?.enabledModules?.includes(tab.module);
                const hasSpecificSubmodules = user?.enabledModules?.some(m => m.startsWith('ACTIVITIES_'));
                const hasFallback = user?.enabledModules?.includes('ACTIVITIES') && !hasSpecificSubmodules;
                const hasAccess = !user?.enabledModules || hasRequired || hasFallback;
                if (!hasAccess) return null;
                return (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <tab.icon className={cn("size-4", activeTab === tab.id ? "" : tab.color)} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
                );
              })}
            </TabsList>
            
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
