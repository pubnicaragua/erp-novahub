import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, MessageSquare, Send } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { AlertasView } from './notificaciones/AlertasView';
import { MensajesView } from './notificaciones/MensajesView';
import { PushView } from './notificaciones/PushView';
import { alertsService, messagesService, pushNotificationsService } from '../services/notificaciones.service';

interface NotificacionesPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (sub: string) => void;
}

export const NotificacionesPage = ({ activeSubModule, onSubModuleChange }: NotificacionesPageProps) => {
  const tabs = [
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
    { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
    { id: 'push', label: 'Push', icon: Send },
  ];
  const tabIds = tabs.map((tab) => tab.id);
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'alertas');
  const [data, setData] = useState<{ alertas: any[]; mensajes: any[]; push: any[] }>({
    alertas: [],
    mensajes: [],
    push: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertas, mensajes, push] = await Promise.all([
        alertsService.getAll().catch(() => []),
        messagesService.getAll().catch(() => []),
        pushNotificationsService.getAll().catch(() => []),
      ]);
      setData({ alertas, mensajes, push });
    } catch (error) {
      console.error('Error fetching notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (!activeSubModule) return;
    setActiveTab(tabIds.includes(activeSubModule) ? activeSubModule : 'alertas');
  }, [activeSubModule]);

  useEffect(() => {
    if (activeTab !== 'mensajes') return;
    let active = true;
    const syncMessages = async () => {
      try {
        const mensajes = await messagesService.getAll();
        if (active) setData((current) => ({ ...current, mensajes }));
      } catch {
        // Keep the last successful inbox visible and retry on the next cycle.
      }
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncMessages();
    };
    const syncWhenFocused = () => void syncMessages();

    void syncMessages();
    const timer = window.setInterval(syncMessages, 5000);
    window.addEventListener('focus', syncWhenFocused);
    document.addEventListener('visibilitychange', syncWhenVisible);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', syncWhenFocused);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [activeTab]);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto min-h-full max-w-[1700px] p-4 sm:p-6 lg:p-8">
        <header className="mb-5 flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="size-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Notificaciones</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Alertas, conversaciones y avisos del sistema</p>
          </div>
        </header>

        <Tabs
          value={activeTab}
          className="w-full"
          onValueChange={(value) => {
            setActiveTab(value);
            onSubModuleChange?.(value);
          }}
        >
          <TabsList className="mb-5 grid h-auto w-full grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-all data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <tab.icon className={cn('size-4', activeTab === tab.id ? 'text-primary' : 'text-muted-foreground')} />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === 'alertas' && <AlertasView data={data.alertas} loading={loading} onRefresh={fetchData} />}
              {activeTab === 'mensajes' && <MensajesView data={data.mensajes} loading={loading} onRefresh={fetchData} />}
              {activeTab === 'push' && <PushView data={data.push} loading={loading} onRefresh={fetchData} />}
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
};
