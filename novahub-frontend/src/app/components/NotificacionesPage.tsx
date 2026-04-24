import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, MessageSquare, Send } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { AlertasView } from './notificaciones/AlertasView';
import { MensajesView } from './notificaciones/MensajesView';
import { PushView } from './notificaciones/PushView';
import { InboxView } from './notificaciones/InboxView';
import { alertsService, messagesService, notificationsCatalogService, pushNotificationsService, inboxService } from '../services/notificaciones.service';
import { toast } from 'sonner';

interface NotificacionesPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (sub: string) => void;
}

export const NotificacionesPage = ({ activeSubModule, onSubModuleChange }: NotificacionesPageProps) => {
  const tabs = [
    { id: 'inbox', label: 'Bandeja de Entrada', icon: Bell },
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
    { id: 'mensajes', label: 'Mensajes', icon: MessageSquare },
    { id: 'push', label: 'Push', icon: Send }
  ];
  const tabIds = tabs.map(tab => tab.id);
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'inbox');
  const [data, setData] = useState<{ inbox: any[], alertas: any[], mensajes: any[], push: any[] }>({
    inbox: [],
    alertas: [],
    mensajes: [],
    push: []
  });
  const [loading, setLoading] = useState(true);
  const [seedingPhase, setSeedingPhase] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [inbox, alertas, mensajes, push] = await Promise.all([
        inboxService.getAll().catch(() => []),
        alertsService.getAll().catch(() => []),
        messagesService.getAll().catch(() => []),
        pushNotificationsService.getAll().catch(() => [])
      ]);
      setData({ inbox, alertas, mensajes, push });
    } catch (error) {
      console.error('Error fetching notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeSubModule) {
      const nextTab = tabIds.includes(activeSubModule) ? activeSubModule : 'alertas';
      setActiveTab(nextTab);
    }
  }, [activeSubModule]);

  const handleSeedPhase = async (phaseId: 'fase-1-alertas' | 'fase-2-mensajes' | 'fase-3-push') => {
    try {
      setSeedingPhase(phaseId);
      const result = await notificationsCatalogService.seedPhase(phaseId);
      toast.success(`Fase cargada: ${result.created} nuevas, ${result.skipped} existentes`);
      await fetchData();
    } catch {
      toast.error('No se pudo cargar la fase de notificaciones');
    } finally {
      setSeedingPhase(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-5rem)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Bell className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Notificaciones
                </h1>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50 mt-2">
                  Centro de alertas y comunicaciones
                </p>
              </div>
            </div>
          </div>

          <Tabs
            value={activeTab}
            className="w-full"
            onValueChange={(value) => {
              setActiveTab(value);
              if (onSubModuleChange) onSubModuleChange(value);
            }}
          >
            <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6">
              {tabs.map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                    data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                    data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
                >
                  <tab.icon className={cn("size-4", activeTab === tab.id ? "" : "text-muted-foreground/70")} />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'inbox' && <InboxView data={data.inbox} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'alertas' && <AlertasView data={data.alertas} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'mensajes' && <MensajesView data={data.mensajes} loading={loading} onRefresh={fetchData} />}
                {activeTab === 'push' && <PushView data={data.push} loading={loading} onRefresh={fetchData} />}
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </div>
      </main>
    </div>
  );
};
