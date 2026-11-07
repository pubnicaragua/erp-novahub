import { useCallback, useEffect, useState } from 'react';
import { BellRing, Share, Smartphone, Trash2 } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { toast } from '@/app/services/toast';
import { pushDevicesService, type PushDevice } from '../../services/notificaciones.service';
import { getPushDeviceStatus, subscribeThisDevice, unsubscribeThisDevice, type PushDeviceStatus } from '../../utils/pushSubscription';

const STATUS_COPY: Record<PushDeviceStatus, { label: string; tone: string; help: string }> = {
  on: { label: 'Activadas en este dispositivo', tone: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', help: 'Recibirás los avisos aunque NovaHub esté cerrado o el teléfono bloqueado.' },
  off: { label: 'Desactivadas en este dispositivo', tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', help: 'Actívalas para recibir avisos de NovaHub con la app cerrada.' },
  blocked: { label: 'Permiso bloqueado', tone: 'bg-rose-500/15 text-rose-700 dark:text-rose-300', help: 'Desbloquea las notificaciones de este sitio en la configuración del navegador o de la app instalada y vuelve aquí.' },
  unsupported: { label: 'No compatible', tone: 'bg-slate-500/15 text-slate-700 dark:text-slate-300', help: 'Este navegador no admite notificaciones push. Prueba con Chrome, Edge, Firefox o Safari actualizado.' },
  'needs-install': { label: 'Requiere instalar la app', tone: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', help: 'En iPhone y iPad las notificaciones solo funcionan con NovaHub instalado en la pantalla de inicio.' },
  'server-disabled': { label: 'Aún no disponibles', tone: 'bg-slate-500/15 text-slate-700 dark:text-slate-300', help: 'El administrador de la plataforma todavía no activó el servicio de notificaciones push.' },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Estado de las notificaciones push del dispositivo actual y lista de los dispositivos de la persona. */
export function DevicePushCard() {
  const [status, setStatus] = useState<PushDeviceStatus | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [busy, setBusy] = useState<'toggle' | 'test' | null>(null);

  const refresh = useCallback(async () => {
    const next = await getPushDeviceStatus().catch(() => 'unsupported' as PushDeviceStatus);
    setStatus(next);
    if (next !== 'unsupported' && next !== 'server-disabled') {
      setDevices(await pushDevicesService.list().catch(() => []));
    }
  }, []);

  useEffect(() => {
    // La carga inicial es asíncrona (el estado se fija al resolver, no de forma síncrona).
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', onFocus); };
  }, [refresh]);

  const errorMessage = (error: unknown, fallback: string) => {
    const detail = error as { response?: { data?: { message?: string } }; message?: string } | null;
    return detail?.response?.data?.message || detail?.message || fallback;
  };

  const activate = async () => {
    setBusy('toggle');
    try {
      const next = await subscribeThisDevice();
      if (next === 'on') toast.success('Notificaciones push activadas en este dispositivo.');
      else if (next === 'blocked') toast.error('El permiso fue bloqueado. Habilítalo desde la configuración del sitio.');
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudieron activar las notificaciones.'));
    } finally { setBusy(null); }
  };

  const deactivate = async () => {
    setBusy('toggle');
    try {
      await unsubscribeThisDevice();
      toast.success('Notificaciones push desactivadas en este dispositivo.');
      await refresh();
    } finally { setBusy(null); }
  };

  const sendTest = async () => {
    setBusy('test');
    try {
      const result = await pushDevicesService.sendTest();
      if (result.sent > 0) toast.success(`Prueba enviada a ${result.sent} dispositivo(s). Debería llegar en unos segundos.`);
      else toast.error('No se pudo entregar la prueba. Vuelve a activar las notificaciones en este dispositivo.');
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo enviar la prueba.'));
    } finally { setBusy(null); }
  };

  const removeDevice = async (device: PushDevice) => {
    await pushDevicesService.remove(device.endpoint).catch(() => undefined);
    await refresh();
  };

  if (!status) return null;
  const copy = STATUS_COPY[status];

  return (
    <Card className="rounded-2xl border-border/60 shadow-sm" data-testid="device-push-card">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Smartphone className="size-4 text-primary" aria-hidden /> Notificaciones en tus dispositivos</h3>
            <p className="mt-1 text-xs text-muted-foreground">{copy.help}</p>
          </div>
          <Badge className={`border-none text-[10px] font-black uppercase ${copy.tone}`}>{copy.label}</Badge>
        </div>

        {status === 'needs-install' && (
          <ol className="list-inside list-decimal space-y-1 rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">
            <li>Abre NovaHub en <strong>Safari</strong>.</li>
            <li>Toca el botón <Share className="inline size-3.5" aria-hidden /> <strong>Compartir</strong> y elige <strong>Añadir a pantalla de inicio</strong>.</li>
            <li>Abre NovaHub desde el icono nuevo y vuelve a esta pantalla para activar las notificaciones.</li>
            <li>Requiere iOS o iPadOS 16.4 o superior.</li>
          </ol>
        )}

        <div className="flex flex-wrap gap-2">
          {(status === 'off') && <Button type="button" size="sm" disabled={busy !== null} onClick={() => void activate()}><BellRing className="mr-1.5 size-4" aria-hidden /> {busy === 'toggle' ? 'Activando…' : 'Activar en este dispositivo'}</Button>}
          {status === 'on' && <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void deactivate()}>Desactivar en este dispositivo</Button>}
          {(status === 'on' || (devices.length > 0 && status !== 'unsupported')) && <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void sendTest()}>{busy === 'test' ? 'Enviando…' : 'Enviar notificación de prueba'}</Button>}
        </div>

        {devices.length > 0 && (
          <ul className="divide-y divide-border rounded-xl border border-border text-xs">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 p-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{device.deviceLabel || 'Dispositivo'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Activado {when(device.createdAt)} · último envío correcto {when(device.lastSuccessAt)}
                    {device.failureCount > 0 ? ` · ${device.failureCount} fallo(s) seguido(s)` : ''}
                  </p>
                </div>
                <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label={`Quitar ${device.deviceLabel || 'dispositivo'}`} onClick={() => void removeDevice(device)}><Trash2 className="size-4" aria-hidden /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
