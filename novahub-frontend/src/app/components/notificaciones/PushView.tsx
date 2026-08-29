import { useEffect, useState } from 'react';
import { PushNotification } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BellRing, CheckCircle2, Plus, Search, Send, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';
import { pushNotificationsService } from '../../services/notificaciones.service';
import { navigateToNotification } from '../../utils/notificationNavigation';
import { enableBrowserNotifications, getBrowserNotificationStatus, isBrowserNotificationsEnabled, type BrowserNotificationStatus } from '../../utils/browserNotifications';
import { NotificationTable } from './NotificationTable';

interface PushViewProps {
  data: PushNotification[];
  loading: boolean;
  onRefresh: () => void;
}

export const PushView: React.FC<PushViewProps> = ({ data, loading, onRefresh }) => {
  const { canPerform } = useAuth();
  const { markAsRead } = useNotifications();
  const [searchTerm, setSearchTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const [browserStatus, setBrowserStatus] = useState<BrowserNotificationStatus>(() => getBrowserNotificationStatus());
  const [enablingBrowser, setEnablingBrowser] = useState(false);

  const errMsg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

  useEffect(() => {
    const syncPermission = () => setBrowserStatus(getBrowserNotificationStatus());
    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  const handleEnableBrowserNotifications = async () => {
    if (enablingBrowser || browserStatus === 'denied') return;
    setEnablingBrowser(true);
    try {
      const status = await enableBrowserNotifications();
      setBrowserStatus(status);
      if (status === 'granted') toast.success('Notificaciones del navegador activadas');
      else if (status === 'denied') toast.error('El navegador bloqueó el permiso. Debes habilitarlo desde la configuración del sitio.');
      else toast.error('Este navegador no admite notificaciones web.');
    } finally {
      setEnablingBrowser(false);
    }
  };

  const handleAdd = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await pushNotificationsService.create({ title: 'Nueva Notificación Push', content: 'Contenido...', type: 'SYSTEM', sent: false, scope: 'PERSONAL' });
      toast.success('Aviso interno creado'); onRefresh();
    } catch (e: any) { toast.error(errMsg(e, 'Error al crear')); }
    finally { setCreating(false); }
  };

  const handleNotificationClick = async (notification: PushNotification) => {
    try {
      if (!notification.isRead) await markAsRead(notification.id);
      navigateToNotification(notification);
      await onRefresh();
    } catch (e: any) {
      toast.error(errMsg(e, 'No se pudo marcar la notificación como leída'));
    }
  };

  const handleMarkRead = async (notification: PushNotification) => {
    try {
      if (!notification.isRead) await markAsRead(notification.id);
      await onRefresh();
    } catch (e: any) {
      toast.error(errMsg(e, 'No se pudo marcar el aviso como leído'));
    }
  };

  const kpis = [
    { title: 'Registradas', value: data.length, icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pendientes', value: data.filter(p => !p.sent).length, icon: Wifi, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { title: 'No leídas', value: data.filter(p => !p.isRead).length, icon: BellRing, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { title: 'Lectura', value: data.length ? `${Math.round((data.filter(p => p.isRead).length / data.length) * 100)}%` : '0%', icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const filtered = data.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || p.content?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="notificaciones-push">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/[0.035] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BellRing className="size-5" /></div>
            <div>
              <p className="font-semibold text-foreground">Avisos del navegador</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Recibe el aviso aunque estés en otra pestaña del ERP. Se activa únicamente en este navegador y requiere permiso explícito.</p>
            </div>
          </div>
          <Button type="button" variant={browserStatus === 'granted' && isBrowserNotificationsEnabled() ? 'outline' : 'default'} className="shrink-0 rounded-xl" onClick={handleEnableBrowserNotifications} disabled={enablingBrowser || browserStatus === 'unsupported' || browserStatus === 'denied' || (browserStatus === 'granted' && isBrowserNotificationsEnabled())}>
            <BellRing className="mr-2 size-4" />
            {browserStatus === 'granted' && isBrowserNotificationsEnabled() ? 'Activadas' : browserStatus === 'denied' ? 'Permiso bloqueado' : browserStatus === 'unsupported' ? 'No disponible' : enablingBrowser ? 'Activando…' : 'Activar navegador'}
          </Button>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Registro de avisos</h2><p className="mt-1 text-sm text-muted-foreground">Historial de avisos internos del ERP. El permiso del navegador se controla arriba.</p></div>
          <div className="erp-list-toolbar flex min-w-0 flex-wrap items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            {canPerform('NOTIFICATIONS_PUSH', 'create') && (
              <Button data-toolbar-role="primary" onClick={handleAdd} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Crear aviso</Button>
            )}
          </div>
        </div>
        <NotificationTable
          data={filtered}
          mode="push"
          loading={loading}
          onRowClick={handleNotificationClick}
          onMarkRead={handleMarkRead}
        />
      </Card>
    </div>
  );
};

