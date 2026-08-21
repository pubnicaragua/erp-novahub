import { useEffect, useState } from 'react';
import { AlertTriangle, Bell, MessageSquare, Send, CircleHelp } from 'lucide-react';
import { cn } from './ui/utils';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { AlertasView } from './notificaciones/AlertasView';
import { MensajesView } from './notificaciones/MensajesView';
import { PushView } from './notificaciones/PushView';
import { alertsService, messagesService, pushNotificationsService } from '../services/notificaciones.service';
import { GuidedTour, type GuidedTourStep } from './ui/GuidedTour';
import { asList, useTenantQuery } from '../hooks/useTenantQuery';
import { useAuth } from '../contexts/AuthContext';

const NOTIFICACIONES_TOUR_STEPS: GuidedTourStep[] = [
  {
    target: '[data-tour="notificaciones-title"]',
    title: 'Notificaciones',
    description: 'Centro de comunicaciones del sistema. Gestioná alertas internas, mensajería entre usuarios y notificaciones push a dispositivos.',
    tip: 'Cada pestaña tiene un propósito distinto. Explorá las tres para conocerlas.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notificaciones-tabs"]',
    title: 'Pestañas',
    description: 'Alertas: avisos del sistema con severidad. Mensajes: conversaciones internas. Push: notificaciones a dispositivos móviles.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notificaciones-alertas-kpis"]',
    title: 'Métricas de Alertas',
    description: 'Resumen rápido: total de alertas, críticas, leídas y no leídas. Datos en tiempo real al crear o modificar.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="notificaciones-alertas-table"]',
    title: 'Tabla de Alertas',
    description: 'Creá, editá y eliminá alertas directamente. Hacé clic en una celda para editar su valor. Usá el botón Crear Alerta para agregar una nueva.',
    placement: 'top',
  },
  {
    target: '[data-tour="notificaciones-tab-mensajes"]',
    title: 'Mensajería Interna',
    description: 'Conversaciones entre usuarios del sistema. Los mensajes directos permiten respuestas; los del sistema son informativos.',
    tip: 'Usá Ctrl+Enter para enviar rápido una respuesta.',
    placement: 'top',
  },
  {
    target: '[data-tour="notificaciones-tab-push"]',
    title: 'Notificaciones Push',
    description: 'Comunicaciones enviadas a dispositivos móviles registrados. Tipos: Marketing, Sistema y Actualizaciones.',
    placement: 'top',
  },
];

interface NotificacionesPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

export const NotificacionesPage = ({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: NotificacionesPageProps) => {
  const { canPerform } = useAuth();
  const tabs = [
    { id: 'alertas', label: 'Alertas', icon: AlertTriangle, module: 'NOTIFICATIONS_ALERTS' },
    { id: 'mensajes', label: 'Mensajes', icon: MessageSquare, module: 'NOTIFICATIONS_MESSAGES' },
    { id: 'push', label: 'Push', icon: Send, module: 'NOTIFICATIONS_PUSH' },
  ];
  const visibleTabs = tabs.filter(tab => canPerform(tab.module, 'view'));
  const tabIds = tabs.map((tab) => tab.id);
  const [activeTab, setActiveTab] = useState(() => activeSubModule || 'alertas');
  const [showTour, setShowTour] = useState(false);
  const alertsQuery = useTenantQuery<any[]>(['notifications', 'alerts'], signal => alertsService.getAll(signal), {
    enabled: activeTab === 'alertas' && canPerform('NOTIFICATIONS_ALERTS', 'view'),
  });
  const messagesQuery = useTenantQuery<any[]>(['notifications', 'messages'], signal => messagesService.getAll(signal), {
    enabled: activeTab === 'mensajes' && canPerform('NOTIFICATIONS_MESSAGES', 'view'),
    refetchInterval: activeTab === 'mensajes' ? 5000 : false,
    refetchIntervalInBackground: false,
  });
  const pushQuery = useTenantQuery<any[]>(['notifications', 'push'], signal => pushNotificationsService.getAll(signal), {
    enabled: activeTab === 'push' && canPerform('NOTIFICATIONS_PUSH', 'view'),
  });
  const data = {
    alertas: asList(alertsQuery.data),
    mensajes: asList(messagesQuery.data),
    push: asList(pushQuery.data),
  };
  const activeQuery = activeTab === 'alertas' ? alertsQuery : activeTab === 'mensajes' ? messagesQuery : pushQuery;
  const loading = activeQuery.isLoading || activeQuery.isFetching;
  const fetchData = () => activeQuery.refetch();

  useEffect(() => {
    if (!activeSubModule) return;
    setActiveTab(tabIds.includes(activeSubModule) && visibleTabs.some(tab => tab.id === activeSubModule) ? activeSubModule : (visibleTabs[0]?.id || 'alertas'));
  }, [activeSubModule, visibleTabs]);

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:p-10">
        <header className="mb-6 flex items-center gap-3" data-tour="notificaciones-title">
          <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="size-9 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase italic leading-none">Notificaciones</h1>
          </div>
          <Button variant="outline" size="icon" className="size-11 rounded-xl shrink-0" onClick={() => setShowTour(true)}>
            <CircleHelp className="size-5" />
          </Button>
        </header>

        <Tabs
          value={activeTab}
          className="w-full"
          onValueChange={(value) => {
            setActiveTab(value);
            onSubModuleChange?.(value);
          }}
        >
          <div className={cn("w-full overflow-x-auto custom-scrollbar mb-6", !isSidebarCollapsed && "hidden lg:hidden")}>
          <TabsList className="flex w-max min-w-full h-auto gap-1.5 bg-gradient-to-br from-muted/30 to-muted/50 p-1.5 rounded-2xl border border-border/40 [&>button]:flex-none [&>button]:shrink-0 [&>button]:text-muted-foreground [&>button]:hover:bg-muted/50 [&>button]:hover:text-foreground" data-tour="notificaciones-tabs">
            {visibleTabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                data-tour={`notificaciones-tab-${tab.id}`}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg"
              >
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          </div>

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
      {showTour && <GuidedTour steps={NOTIFICACIONES_TOUR_STEPS} onClose={() => setShowTour(false)} title="Notificaciones" />}
    </div>
  );
};
