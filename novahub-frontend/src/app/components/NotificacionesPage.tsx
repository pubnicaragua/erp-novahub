import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Bell, AlertTriangle, MessageSquare, Send } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
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

          <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
            <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-6">
              {tabs.map((tab) => (
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
