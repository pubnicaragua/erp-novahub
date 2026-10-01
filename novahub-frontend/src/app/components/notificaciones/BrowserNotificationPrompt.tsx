import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { Button } from '../ui/button';
import { enableBrowserNotifications, getBrowserNotificationStatus } from '../../utils/browserNotifications';
import { toast } from '@/app/services/toast';

/** Small, explicit permission prompt for installed Android/iOS PWAs. */
export function BrowserNotificationPrompt() {
  const [visible, setVisible] = useState(() => {
    return typeof window !== 'undefined' && getBrowserNotificationStatus() === 'default';
  });
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
  };

  const enable = async () => {
    setLoading(true);
    try {
      const status = await enableBrowserNotifications();
      if (status === 'granted') {
        toast.success('Notificaciones activadas en este dispositivo');
        setVisible(false);
      } else if (status === 'denied') {
        toast.error('El permiso fue bloqueado. Actívalo desde la configuración del sitio o de la PWA.');
        dismiss();
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-primary/20 bg-background/95 p-3 shadow-2xl backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:left-auto">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BellRing className="size-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-foreground">Activa los avisos de NovaHub</p>
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">Recibe nuevas conversaciones, tareas y alertas cuando cambies de pestaña o uses la PWA. En la app instalada se mostrará con el logo de NovaHub.</p>
      </div>
      <Button type="button" size="sm" className="shrink-0 rounded-xl" onClick={() => void enable()} disabled={loading}>{loading ? 'Activando…' : 'Activar'}</Button>
      <button type="button" className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" onClick={dismiss} aria-label="Cerrar aviso"><X className="size-4" /></button>
    </div>
  );
}
