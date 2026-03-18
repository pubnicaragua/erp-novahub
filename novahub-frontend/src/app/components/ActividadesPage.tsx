import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Activity, ListTodo, CalendarDays, Bell, Database } from 'lucide-react';
import { cn } from './ui/utils';
import { TareasView } from './actividades/TareasView';
import { EventosView } from './actividades/EventosView';
import { RecordatoriosView } from './actividades/RecordatoriosView';
import { BitacoraView } from './actividades/BitacoraView';
import { tasksService, eventsService, remindersService, activityLogsService } from '../services/actividades.service';

export const ActividadesPage = () => {
  const [activeTab, setActiveTab] = useState('tareas');
  const [data, setData] = useState({
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
      setData({ tareas, eventos, recordatorios, bitacora });
    } catch (error) {
      console.error('Error fetching actividades:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const tabs = [
    { id: 'tareas', label: 'Tareas', icon: ListTodo, color: 'text-blue-500' },
    { id: 'eventos', label: 'Eventos', icon: CalendarDays, color: 'text-emerald-500' },
    { id: 'recordatorios', label: 'Recordatorios', icon: Bell, color: 'text-amber-500' },
    { id: 'bitacora', label: 'Bitácora', icon: Database, color: 'text-rose-500' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/10 font-sans">
      <div className="flex-none bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-40">
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Activity className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Actividades</h1>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Gestión de tareas, eventos y registros
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 max-w-[1600px] mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
            {tabs.map(tab => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'outline'}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-xl h-10 px-4 font-black uppercase text-[10px] tracking-widest transition-all duration-300 min-w-fit gap-2 border-none",
                  activeTab === tab.id 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-background/50 hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <tab.icon className={cn("size-4", activeTab === tab.id ? "" : tab.color)} />
                {tab.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1600px] mx-auto">
          {activeTab === 'tareas' && <TareasView data={data.tareas} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'eventos' && <EventosView data={data.eventos} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'recordatorios' && <RecordatoriosView data={data.recordatorios} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'bitacora' && <BitacoraView data={data.bitacora} loading={loading} onRefresh={fetchData} />}
        </div>
      </div>
    </div>
  );
};
