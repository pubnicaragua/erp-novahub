import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../services/api';
import {
  activateLocationQueueSession,
  clearOfflineRouteEligibility,
  deactivateLocationQueueSession,
  flushLocationQueue,
  getOfflineRouteEligibility,
  getLocationQueueStatus,
  locationScopeKey,
  persistOfflineRouteEligibility,
  requestLocationStoragePersistence,
  saveLocationPoint,
  type LocationQueueIdentity,
  type LocationQueueStatus,
} from '../services/force-sales-location-queue';

type Props = {
  activeModule: string;
  user: { id?: string; clientTenantId?: string; tenantId?: string; isPlatformAdmin?: boolean } | null;
  canTrack: boolean;
  canHide: boolean;
};

type TrackingState = LocationQueueStatus & {
  enabled: boolean;
  gps: 'waiting' | 'ready' | 'denied' | 'error';
  online: boolean;
  message: string;
  wakeLock: boolean;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void>; addEventListener: (type: 'release', listener: () => void) => void }> };
};

const PRESENCE_KEY = (userId: string) => `novaFuerzaPresenceSharingV1:${userId}`;
const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://backenderpnh.onrender.com/api'
  : 'http://localhost:3000/api')).replace(/\/$/, '');

function initialSharing(user: Props['user']) {
  if (!user?.id) return false;
  const saved = localStorage.getItem(PRESENCE_KEY(user.id));
  return user.isPlatformAdmin ? saved === 'true' : saved !== 'false';
}

function newEventId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function ForceSalesTrackingRuntime({ activeModule, user, canTrack, canHide }: Props) {
  const identity = useMemo(() => user?.id && (user.clientTenantId || user.tenantId)
    ? { userId: String(user.id), tenantId: String(user.clientTenantId || user.tenantId) } satisfies LocationQueueIdentity
    : null, [user?.id, user?.clientTenantId, user?.tenantId]);
  const [sharingState, setSharingState] = useState(() => ({ userId: String(user?.id || ''), enabled: initialSharing(user) }));
  const sharing = sharingState.userId === String(user?.id || '') ? sharingState.enabled : initialSharing(user);
  const setSharing = useCallback((enabled: boolean) => setSharingState({ userId: String(user?.id || ''), enabled }), [user?.id]);
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;
  const activeModuleRef = useRef(activeModule);
  activeModuleRef.current = activeModule;
  const [state, setState] = useState<TrackingState>({
    pending: 0, lastCapturedAt: null, lastSyncedAt: null,
    enabled: false, gps: 'waiting', online: navigator.onLine, message: '', wakeLock: false,
  });
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const watchId = useRef<number | null>(null);
  const starting = useRef(false);
  const enabledRef = useRef(false);
  const lastStoredAt = useRef(0);
  const lastStoredPoint = useRef<{ lat: number; lng: number } | null>(null);
  const lastPresenceAt = useRef(0);
  const lastLocation = useRef<{ lat: number; lng: number; accuracy?: number; heading?: number } | null>(null);
  const saving = useRef(false);
  const wakeLock = useRef<Awaited<ReturnType<NonNullable<WakeLockNavigator['wakeLock']>['request']>> | null>(null);
  const wakeRequested = useRef(false);

  useEffect(() => {
    if (!identity || !canTrack) return undefined;
    let disposed = false;
    let sessionReset = false;
    const scope = identity;
    const token = localStorage.getItem('nh-auth-token') || '';

    const publish = (patch: Partial<TrackingState>) => {
      if (!disposed) setState((current) => ({ ...current, ...patch }));
    };
    const refreshStatus = async () => {
      try {
        const status = await getLocationQueueStatus(scope);
        publish(status);
      } catch (error) {
        publish({ gps: 'error', message: error instanceof Error ? error.message : 'No se pudo leer la cola local.' });
      }
    };
    const stopWatch = () => {
      if (watchId.current !== null) navigator.geolocation?.clearWatch(watchId.current);
      watchId.current = null;
      enabledRef.current = false;
      publish({ enabled: false });
    };
    const releaseWakeLock = () => {
      wakeLock.current?.release().catch(() => undefined);
      wakeLock.current = null;
      publish({ wakeLock: false });
    };
    const start = async () => {
      if (starting.current || watchId.current !== null) return;
      starting.current = true;
      try {
        if (!token) {
          publish({ enabled: false, gps: 'error', message: 'Inicia sesión con conexión para reanudar la ruta.' });
          return;
        }
        if (!navigator.geolocation) {
          publish({ enabled: false, gps: 'error', message: 'Este navegador no ofrece geolocalización.' });
          return;
        }
        try {
          await requestLocationStoragePersistence();
          await activateLocationQueueSession(scope, API_BASE, token);
          await refreshStatus();
        } catch (error) {
          publish({ enabled: false, gps: 'error', message: error instanceof Error ? error.message : 'No se pudo preparar el almacenamiento local.' });
          return;
        }
        if (disposed || sessionReset || !sharingRef.current || watchId.current !== null) return;
        persistOfflineRouteEligibility(scope);
        enabledRef.current = true;
        publish({ enabled: true, gps: 'waiting', message: '' });
        watchId.current = navigator.geolocation.watchPosition(async (position) => {
        if (!enabledRef.current || saving.current) return;
        const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
        const capturedAt = new Date(position.timestamp || Date.now()).toISOString();
        const now = Date.now();
        // Evita convertir lecturas GPS cacheadas en una posición supuestamente actual.
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || now - new Date(capturedAt).getTime() > 120000) {
          publish({ gps: 'error', message: 'GPS sin una lectura reciente; esperando una posición nueva.' });
          return;
        }
        const movedMeters = lastStoredPoint.current
          ? Math.hypot((lat - lastStoredPoint.current.lat) * 111320, (lng - lastStoredPoint.current.lng) * 111320 * Math.cos(lat * Math.PI / 180))
          : Number.POSITIVE_INFINITY;
        if (now - lastStoredAt.current < 10000 && movedMeters < 25) return;
        saving.current = true;
        try {
          await saveLocationPoint(scope, {
            eventId: newEventId(), capturedAt, lat, lng,
            ...(Number.isFinite(accuracy) ? { accuracy } : {}),
            ...(Number.isFinite(heading) && heading >= 0 ? { heading } : {}),
          });
          lastStoredAt.current = now;
          lastStoredPoint.current = { lat, lng };
          lastLocation.current = { lat, lng, ...(Number.isFinite(accuracy) ? { accuracy } : {}), ...(Number.isFinite(heading) && heading >= 0 ? { heading } : {}) };
          publish({ gps: 'ready', lastCapturedAt: capturedAt, message: accuracy > 500 ? 'Se guardó el punto; la precisión GPS es baja.' : '' });
          await refreshStatus();
          if (navigator.onLine) {
            try {
              await flushLocationQueue(scope);
              await refreshStatus();
            } catch {
              publish({ message: 'Punto guardado en este teléfono; se enviará al recuperar conexión.' });
            }
            if (now - lastPresenceAt.current >= 30000 || movedMeters >= 25) {
              lastPresenceAt.current = now;
              void api.post('/force-sales/presence', lastLocation.current).catch(() => undefined);
            }
          } else {
            publish({ message: 'Sin conexión: el recorrido quedó guardado en este teléfono.' });
          }
        } catch (error) {
          publish({ gps: 'error', message: error instanceof Error ? `No se pudo guardar el punto: ${error.message}` : 'No se pudo guardar el punto; revisa el espacio disponible.' });
        } finally {
          saving.current = false;
        }
        }, (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            publish({ gps: 'denied', message: 'Permiso GPS denegado. Actívalo para continuar el recorrido.' });
            return;
          }
          publish({ gps: 'error', message: error.code === error.TIMEOUT ? 'GPS tardó demasiado; se reintentará.' : 'No se pudo obtener una ubicación GPS.' });
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
      } finally {
        starting.current = false;
      }
    };

    const setTracking = async (enabled: boolean) => {
      if (enabled) {
        await start();
        return;
      }
      stopWatch();
      releaseWakeLock();
      lastLocation.current = null;
      clearOfflineRouteEligibility(scope);
      if (canHide && navigator.onLine) void api.delete('/force-sales/presence/me').catch(() => undefined);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshStatus();
        if (navigator.onLine) void flushLocationQueue(scope).then(refreshStatus).catch(() => undefined);
        if (wakeRequested.current) void acquireWakeLock();
      } else {
        releaseWakeLock();
      }
    };
    const handleOnline = () => {
      publish({ online: true });
      void flushLocationQueue(scope).then(refreshStatus).catch(() => undefined);
    };
    const handleOffline = () => publish({ online: false, message: 'Sin conexión: los puntos nuevos se guardan en este teléfono.' });
    const handleAuthReset = () => { sessionReset = true; stopWatch(); releaseWakeLock(); clearOfflineRouteEligibility(scope); void deactivateLocationQueueSession(scope); };
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.source !== 'novahub-force-sales') return;
      if (event.data?.type === 'presence-sharing-changed') {
        const next = Boolean(event.data.enabled);
        localStorage.setItem(PRESENCE_KEY(scope.userId), String(next));
        setSharing(next);
        publish({ message: next ? '' : 'Compartir ubicación está pausado.' });
        void setTracking(next);
      }
    };
    const handleResume = () => {
      const eligible = getOfflineRouteEligibility();
      const sameIdentity = eligible && locationScopeKey(eligible) === locationScopeKey(scope);
      if (sharingRef.current && (activeModuleRef.current === 'fuerza-comercial' || sameIdentity)) void setTracking(true);
    };
    const handleRetry = () => {
      if (!sharingRef.current) return;
      stopWatch();
      void setTracking(true);
    };
    async function acquireWakeLock() {
      const api = navigator as WakeLockNavigator;
      if (!wakeRequested.current || document.visibilityState !== 'visible' || !api.wakeLock || wakeLock.current) return;
      try {
        wakeLock.current = await api.wakeLock.request('screen');
        wakeLock.current.addEventListener('release', () => {
          wakeLock.current = null;
          publish({ wakeLock: false });
        });
        publish({ wakeLock: true });
      } catch {
        publish({ wakeLock: false, message: 'El navegador no pudo mantener la pantalla activa.' });
      }
    }
    const onScreenLockClick = () => {
      wakeRequested.current = !wakeRequested.current;
      if (wakeRequested.current) void acquireWakeLock();
      else releaseWakeLock();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('message', handleMessage);
    window.addEventListener('force-sales-tracking-resume', handleResume);
    window.addEventListener('force-sales-tracking-retry', handleRetry);
    window.addEventListener('auth-session-reset', handleAuthReset);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('force-sales-screen-lock', onScreenLockClick);
    const refreshTimer = window.setInterval(() => {
      if (!navigator.onLine) return;
      void flushLocationQueue(scope).then(refreshStatus).catch(() => undefined);
      if (enabledRef.current && lastLocation.current && Date.now() - lastPresenceAt.current >= 55000) {
        lastPresenceAt.current = Date.now();
        void api.post('/force-sales/presence', lastLocation.current).catch(() => undefined);
      }
    }, 30000);
    void (async () => {
      if (token) {
        try {
          await activateLocationQueueSession(scope, API_BASE, token);
          await refreshStatus();
          if (navigator.onLine) await flushLocationQueue(scope).then(refreshStatus);
          const eligible = getOfflineRouteEligibility();
          if (sharingRef.current && eligible && locationScopeKey(eligible) === locationScopeKey(scope)) {
            persistOfflineRouteEligibility(scope);
            await start();
          }
        } catch {
          // La cola local queda disponible para un reintento posterior.
        }
      } else {
        await refreshStatus();
      }
    })();

    return () => {
      disposed = true;
      window.clearInterval(refreshTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('force-sales-tracking-resume', handleResume);
      window.removeEventListener('force-sales-tracking-retry', handleRetry);
      window.removeEventListener('auth-session-reset', handleAuthReset);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('force-sales-screen-lock', onScreenLockClick);
      stopWatch();
      releaseWakeLock();
      void deactivateLocationQueueSession(scope, false);
    };
  }, [identity, canTrack, canHide, setSharing]);

  useEffect(() => {
    if (!identity || !canTrack || activeModule !== 'fuerza-comercial') return;
    // El runtime escucha este evento sin estar atado a la vida del iframe.
    const event = new CustomEvent('force-sales-tracking-resume');
    window.dispatchEvent(event);
  }, [activeModule, canTrack, identity, user?.id]);

  const onWakeLockClick = () => window.dispatchEvent(new Event('force-sales-screen-lock'));
  const onRetryClick = () => window.dispatchEvent(new Event('force-sales-tracking-retry'));
  const timeLabel = (value: string | null) => value
    ? new Date(value).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  if (!identity || !canTrack) return null;
  if (activeModule !== 'fuerza-comercial') {
    if (!state.enabled) return null;
    return (
      <aside className="pointer-events-auto absolute right-3 top-[4.25rem] z-[150] flex max-w-[min(22rem,calc(100vw-5.5rem))] items-center gap-2 rounded-xl border border-border/80 bg-card/95 px-3 py-2 text-card-foreground shadow-lg backdrop-blur sm:right-5 sm:top-[4.5rem]" aria-label="Rastreo de Fuerza Comercial activo" role="status">
        <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="min-w-0 text-[11px] font-semibold">Ubicación activa · {state.pending} pendiente{state.pending === 1 ? '' : 's'}</span>
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('navigate-module', { detail: { module: 'fuerza-comercial' } }))} className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">Ver</button>
      </aside>
    );
  }
  const gpsLabel = state.gps === 'ready' ? 'GPS activo' : state.gps === 'denied' ? 'GPS bloqueado' : state.gps === 'error' ? 'Revisar GPS' : state.enabled ? 'Buscando GPS…' : 'Ruta detenida';

  return (
    <aside className="pointer-events-auto absolute right-3 top-[4.25rem] z-[150] w-fit max-w-[calc(100vw-5.5rem)] rounded-xl border border-border/80 bg-card/95 p-2 text-card-foreground shadow-xl backdrop-blur sm:right-5 sm:top-[4.5rem] sm:w-[min(22rem,calc(100vw-5.5rem))] sm:rounded-2xl sm:p-3" aria-label="Estado del rastreo de ruta">
      <div className="flex items-center justify-between gap-2 sm:items-start sm:gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-bold sm:flex-wrap sm:gap-2 sm:text-xs">
            <span className={`size-2 shrink-0 rounded-full ${state.enabled && state.online ? 'bg-emerald-500' : state.enabled ? 'bg-amber-500' : 'bg-muted-foreground'}`} aria-hidden="true" />
            <span className="whitespace-nowrap">{gpsLabel}</span>
            <span className="hidden font-medium text-muted-foreground sm:inline">{state.online ? 'Con conexión' : 'Sin conexión'}</span>
            <span className="whitespace-nowrap font-medium text-muted-foreground sm:hidden">{state.pending} pend.</span>
          </div>
          <div id="force-sales-tracking-details" className={`${mobileExpanded ? 'block' : 'hidden'} sm:block`}>
            <p className="mt-1 text-[11px] text-muted-foreground">{state.pending} punto{state.pending === 1 ? '' : 's'} pendiente{state.pending === 1 ? '' : 's'} · <span className="sm:hidden">{state.online ? 'Con conexión' : 'Sin conexión'} · </span>captura {timeLabel(state.lastCapturedAt)} · envío {timeLabel(state.lastSyncedAt)}</p>
            {state.message && <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300" role="status">{state.message}</p>}
            {(state.gps === 'denied' || state.gps === 'error') && sharing && <button type="button" onClick={onRetryClick} className="mt-2 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted">Reintentar GPS</button>}
            {!sharing && <p className="mt-2 text-[11px] text-muted-foreground">La ubicación está pausada. Puedes activarla desde Privacidad de ubicación.</p>}
            <button type="button" onClick={onWakeLockClick} disabled={!('wakeLock' in navigator)} aria-pressed={state.wakeLock} className="mt-2 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:hidden" title="Mantener la pantalla encendida mientras NovaHub está visible">
              {state.wakeLock ? 'Pantalla activa' : 'Mantener pantalla'}
            </button>
          </div>
        </div>
        <button type="button" onClick={() => setMobileExpanded((expanded) => !expanded)} aria-expanded={mobileExpanded} aria-controls="force-sales-tracking-details" className="shrink-0 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold hover:bg-muted sm:hidden" aria-label={mobileExpanded ? 'Ocultar detalles del rastreo' : 'Mostrar detalles del rastreo'}>
          {mobileExpanded ? 'Menos' : 'Más'}
        </button>
        <button type="button" onClick={onWakeLockClick} disabled={!('wakeLock' in navigator)} aria-pressed={state.wakeLock} className="hidden shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex" title="Mantener la pantalla encendida mientras NovaHub está visible">
          {state.wakeLock ? 'Pantalla activa' : 'Mantener pantalla'}
        </button>
      </div>
    </aside>
  );
}
