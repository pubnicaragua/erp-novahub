import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Bell, AlertTriangle, MessageSquare, Send } from 'lucide-react';
import { cn } from './ui/utils';
import { AlertasView } from './notificaciones/AlertasView';
import { MensajesView } from './notificaciones/MensajesView';
import { PushView } from './notificaciones/PushView';
import { alertsService, messagesService, pushNotificationsService } from '../services/notificaciones.service';

export const NotificacionesPage = () => {
  const [activeTab, setActiveTab] = useState('alertas');
  const [data, setData] = useState<{ alertas: any[], mensajes: any[], push: any[] }>({
    alertas: [],
    mensajes: [],
    push: []
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertas, mensajes, push] = await Promise.all([
        alertsService.getAll().catch(() => []),
        messagesService.getAll().catch(() => []),
        pushNotificationsService.getAll().catch(() => [])
      ]);
      setData({ alertas, mensajes, push });
    } catch (error) {
      console.error('Error fetching notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const tabs = [
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle, color: 'text-rose-500' },
    { id: 'mensajes', label: 'Mensajes', icon: MessageSquare, color: 'text-blue-500' },
    { id: 'push', label: 'Push', icon: Send, color: 'text-emerald-500' }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-muted/10 font-sans">
      <div className="flex-none bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-40">
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 bg-primary/10 rounded-xl">
                  <Bell className="size-5 text-primary" />
                </div>
                <h1 className="text-2xl font-black tracking-tight uppercase">Notificaciones</h1>
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Centro de alertas y comunicaciones
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
          {activeTab === 'alertas' && <AlertasView data={data.alertas} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'mensajes' && <MensajesView data={data.mensajes} loading={loading} onRefresh={fetchData} />}
          {activeTab === 'push' && <PushView data={data.push} loading={loading} onRefresh={fetchData} />}
        </div>
      </div>
    </div>
  );
};
