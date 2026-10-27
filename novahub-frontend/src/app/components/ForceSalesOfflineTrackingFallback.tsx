import { useEffect, useRef, useState } from 'react';
import {
  clearOfflineRouteEligibility,
  getLocationQueueStatus,
  requestLocationStoragePersistence,
  saveLocationPoint,
  type LocationQueueIdentity,
  type LocationQueueStatus,
} from '../services/force-sales-location-queue';

type Props = { identity: LocationQueueIdentity };

export function ForceSalesOfflineTrackingFallback({ identity }: Props) {
  const [status, setStatus] = useState<LocationQueueStatus>({ pending: 0, lastCapturedAt: null, lastSyncedAt: null });
  const [running, setRunning] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState('Esta pantalla solo reanuda la captura de ruta. Para usar NovaHub, inicia sesión con conexión.');
  const watchId = useRef<number | null>(null);
  const lastPointAt = useRef(0);
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);
  const saving = useRef(false);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const next = await getLocationQueueStatus(identity);
        if (alive) setStatus(next);
      } catch (error) {
        if (alive) setMessage(error instanceof Error ? error.message : 'No se pudo leer la cola local.');
      }
    };
    const onOnline = () => {
      setOnline(true);
      setMessage('Hay conexión. Inicia sesión con la misma cuenta para enviar los puntos pendientes.');
      void refresh();
    };
    const onOffline = () => {
      setOnline(false);
      setMessage('Sin conexión: las ubicaciones capturadas se guardarán en este teléfono.');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void refresh();
    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    };
  }, [identity.userId, identity.tenantId]);

  const stop = () => {
    if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
    watchId.current = null;
    saving.current = false;
    setRunning(false);
  };

  const start = () => {
    stop();
    if (!navigator.geolocation) {
      setMessage('Este navegador no ofrece geolocalización.');
      return;
    }
    void requestLocationStoragePersistence();
    setRunning(true);
    setMessage(online ? 'Esperando una lectura GPS…' : 'Esperando una lectura GPS… Los puntos se guardan localmente.');
    watchId.current = navigator.geolocation.watchPosition(async (position) => {
      if (saving.current) return;
      const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
      const now = Date.now();
      const capturedAt = new Date(position.timestamp || now).toISOString();
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || now - new Date(capturedAt).getTime() > 120000) {
        setMessage('GPS sin una lectura reciente; esperando una posición nueva.');
        return;
      }
      const movedMeters = lastPosition.current
        ? Math.hypot((lat - lastPosition.current.lat) * 111320, (lng - lastPosition.current.lng) * 111320 * Math.cos(lat * Math.PI / 180))
        : Number.POSITIVE_INFINITY;
      if (now - lastPointAt.current < 10000 && movedMeters < 25) return;
      saving.current = true;
      try {
        const eventId = crypto.randomUUID ? crypto.randomUUID() : (() => {
          const bytes = crypto.getRandomValues(new Uint8Array(16));
          bytes[6] = (bytes[6] & 0x0f) | 0x40;
          bytes[8] = (bytes[8] & 0x3f) | 0x80;
          const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        })();
        await saveLocationPoint(identity, {
          eventId, capturedAt, lat, lng,
          ...(Number.isFinite(accuracy) ? { accuracy } : {}),
          ...(Number.isFinite(heading) && heading >= 0 ? { heading } : {}),
        });
        lastPointAt.current = now;
        lastPosition.current = { lat, lng };
        setStatus(await getLocationQueueStatus(identity));
        setMessage(online
          ? 'Punto guardado. Inicia sesión con conexión para completar la sincronización.'
          : 'Punto guardado sin conexión.');
      } catch (error) {
        setMessage(error instanceof Error ? `No se pudo guardar el punto: ${error.message}` : 'No se pudo guardar el punto; revisa el espacio disponible.');
      } finally {
        saving.current = false;
      }
    }, (error) => {
      setRunning(false);
      setMessage(error.code === error.PERMISSION_DENIED
        ? 'El navegador bloqueó el GPS. Permite la ubicación para este sitio y vuelve a intentarlo.'
        : error.code === error.TIMEOUT ? 'GPS tardó demasiado; puedes volver a intentarlo.' : 'No se pudo obtener una ubicación GPS.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  };

  const returnToLogin = () => {
    stop();
    clearOfflineRouteEligibility(identity);
    window.location.reload();
  };
  const finishOfflineRoute = () => {
    stop();
    clearOfflineRouteEligibility(identity);
    window.location.reload();
  };
  const timeLabel = status.lastCapturedAt
    ? new Date(status.lastCapturedAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-4 text-foreground sm:p-8">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8" aria-labelledby="offline-route-title">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
          <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
          {online ? 'Sesión sin validar' : 'Modo de ruta sin conexión'}
        </div>
        <h1 id="offline-route-title" className="text-xl font-black tracking-tight sm:text-2xl">Reanudar ruta de Fuerza Comercial</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Se guardará únicamente la ubicación GPS de la jornada que ya habías iniciado. Esta pantalla no abre el ERP ni los datos de la empresa.</p>
        <div className="mt-5 rounded-2xl border border-border/80 bg-muted/40 p-4">
          <p className="text-sm font-semibold">{status.pending} punto{status.pending === 1 ? '' : 's'} pendiente{status.pending === 1 ? '' : 's'} · última captura {timeLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Los puntos se enviarán después de iniciar sesión con la misma cuenta y empresa.</p>
        </div>
        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200" role="status" aria-live="polite">{message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={start} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90">
            {running ? 'Reiniciar GPS' : 'Reanudar captura GPS'}
          </button>
          {online && <button type="button" onClick={returnToLogin} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted">Volver al inicio de sesión</button>}
          {running && <button type="button" onClick={finishOfflineRoute} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted">Finalizar ruta</button>}
        </div>
        {!running && !online && <button type="button" onClick={finishOfflineRoute} className="mt-3 text-xs font-semibold text-muted-foreground underline underline-offset-4">Finalizar esta jornada</button>}
      </section>
    </main>
  );
}
