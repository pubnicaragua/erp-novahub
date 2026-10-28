import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { api } from '../services/api';
import {
  activateLocationQueueSession,
  clearOfflineRouteEligibility,
  deactivateLocationQueueSession,
  flushLocationQueue,
  getOfflineRouteEligibility,
  locationScopeKey,
  persistOfflineRouteEligibility,
  requestLocationStoragePersistence,
  type LocationQueueIdentity,
} from '../services/force-sales-location-queue';
import {
  createForceSalesLocationTracker,
  isFreshLocationTimestamp,
  type ForceSalesLocationTrackerState,
} from '../services/force-sales-location-tracker';

type Props = {
  activeModule: string;
  user: { id?: string; clientTenantId?: string; tenantId?: string; isPlatformAdmin?: boolean } | null;
  canTrack: boolean;
  canHide: boolean;
};

type RuntimeState = ForceSalesLocationTrackerState & { wakeLock: boolean };
type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (type: 'release', listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };

const PRESENCE_KEY = (userId: string) => `novaFuerzaPresenceSharingV1:${userId}`;
const WAKE_LOCK_KEY = (identity: LocationQueueIdentity) => `novaForceSalesWakeLockV1:${locationScopeKey(identity)}`;
const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.PROD
  ? 'https://backenderpnh.onrender.com/api'
  : 'http://localhost:3000/api')).replace(/\/$/, '');

function initialSharing(user: Props['user']) {
  if (!user?.id) return false;
  const saved = localStorage.getItem(PRESENCE_KEY(user.id));
  return user.isPlatformAdmin ? saved === 'true' : saved !== 'false';
}

function readWakeLockPreference(identity: LocationQueueIdentity | null) {
  if (!identity) return false;
  try {
    return localStorage.getItem(WAKE_LOCK_KEY(identity)) === 'true';
  } catch {
    return false;
  }
}

function gpsLabel(state: ForceSalesLocationTrackerState) {
  switch (state.gps) {
    case 'searching': return 'Buscando GPS';
    case 'recent': return 'GPS reciente';
    case 'stale': return 'Sin lectura reciente';
    case 'denied': return 'Permiso bloqueado';
    case 'error': return 'Error GPS';
    case 'paused': return 'Ruta pausada';
    case 'other-tab': return 'Captura en otra pestaña';
    default: return 'Ruta detenida';
  }
}

function timeLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
}

function ageLabel(value: string | null) {
  if (!value) return 'Sin capturas';
  const age = Math.max(0, Date.now() - Date.parse(value));
  if (!Number.isFinite(age)) return 'Sin capturas';
  if (age < 60_000) return `hace ${Math.floor(age / 1000)} s`;
  if (age < 3_600_000) return `hace ${Math.floor(age / 60_000)} min`;
  return `hace ${Math.floor(age / 3_600_000)} h`;
}

function readOfflineEligibility(scope: LocationQueueIdentity) {
  const eligible = getOfflineRouteEligibility();
  return Boolean(eligible && locationScopeKey(eligible) === locationScopeKey(scope));
}

export function ForceSalesTrackingRuntime({ activeModule, user, canTrack, canHide }: Props) {
  const identity = useMemo(() => user?.id && (user.clientTenantId || user.tenantId)
    ? { userId: String(user.id), tenantId: String(user.clientTenantId || user.tenantId) } satisfies LocationQueueIdentity
    : null, [user?.id, user?.clientTenantId, user?.tenantId]);
  const identityKey = identity ? locationScopeKey(identity) : '';
  const [sharingState, setSharingState] = useState(() => ({ userId: String(user?.id || ''), enabled: initialSharing(user) }));
  const sharing = sharingState.userId === String(user?.id || '') ? sharingState.enabled : initialSharing(user);
  const setSharing = useCallback((enabled: boolean) => setSharingState({ userId: String(user?.id || ''), enabled }), [user?.id]);
  const sharingRef = useRef(sharing);
  const activeModuleRef = useRef(activeModule);
  const trackerRef = useRef<ReturnType<typeof createForceSalesLocationTracker> | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [wakePreferenceState, setWakePreferenceState] = useState(() => ({ scope: identityKey, enabled: readWakeLockPreference(identity) }));
  const wakeRequested = wakePreferenceState.scope === identityKey ? wakePreferenceState.enabled : readWakeLockPreference(identity);
  const wakeRequestedRef = useRef(wakeRequested);
  const [state, setState] = useState<RuntimeState>({
    gps: 'stopped', enabled: false, online: navigator.onLine,
    pending: 0, lastCapturedAt: null, lastSyncedAt: null, message: '', wakeLock: false,
  });

  useEffect(() => { sharingRef.current = sharing; }, [sharing]);
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { wakeRequestedRef.current = wakeRequested; }, [wakeRequested]);

  useEffect(() => {
    setPanelOpen(false);
    if (!identity) return;
    setWakePreferenceState((current) => current.scope === identityKey
      ? current
      : { scope: identityKey, enabled: readWakeLockPreference(identity) });
  }, [identity, identityKey]);

  useEffect(() => {
    if (!identity || !canTrack) {
      trackerRef.current = null;
      setState((current) => ({ ...current, gps: 'stopped', enabled: false, wakeLock: false }));
      return undefined;
    }

    let disposed = false;
    let sessionReset = false;
    let syncInFlight = false;
    let wakeLock: WakeLockSentinel | null = null;
    let wakeRequestPending = false;
    let wakeRequestVersion = 0;
    let lastPresenceAt = 0;
    let lastPresencePoint: { lat: number; lng: number } | null = null;
    const scope = identity;
    const token = localStorage.getItem('nh-auth-token') || '';
    const tracker = createForceSalesLocationTracker({
      identity: scope,
      isEligible: () => {
        if (disposed || sessionReset || !token || localStorage.getItem('nh-auth-token') !== token || !sharingRef.current) return false;
        return activeModuleRef.current === 'fuerza-comercial' || readOfflineEligibility(scope);
      },
      onState: (next) => {
        if (!disposed) setState((current) => ({ ...next, wakeLock: Boolean(wakeLock || (wakeRequestedRef.current && wakeRequestPending && current.wakeLock)) }));
      },
      onFreshLocation: async (position) => {
        if (disposed || sessionReset || !sharingRef.current || !navigator.onLine || !isFreshLocationTimestamp(position.capturedAt)) return;
        const movedMeters = lastPresencePoint
          ? Math.hypot((position.lat - lastPresencePoint.lat) * 111320, (position.lng - lastPresencePoint.lng) * 111320 * Math.cos(position.lat * Math.PI / 180))
          : Number.POSITIVE_INFINITY;
        if (Date.now() - lastPresenceAt < 30_000 && movedMeters < 25) return;
        lastPresenceAt = Date.now();
        lastPresencePoint = { lat: position.lat, lng: position.lng };
        try {
          await api.post('/force-sales/presence', {
            lat: position.lat,
            lng: position.lng,
            ...(Number.isFinite(position.accuracy) ? { accuracy: position.accuracy } : {}),
            ...(Number.isFinite(position.heading) && Number(position.heading) >= 0 ? { heading: position.heading } : {}),
          });
        } catch {
          // El punto de ruta permanece en la cola local; presencia se reintentará desde una lectura GPS nueva.
        }
      },
    });
    trackerRef.current = tracker;

    const eligibleNow = () => {
      const currentToken = localStorage.getItem('nh-auth-token') || '';
      return Boolean(currentToken && currentToken === token && sharingRef.current
        && (activeModuleRef.current === 'fuerza-comercial' || readOfflineEligibility(scope)));
    };
    const prepareQueue = async () => {
      if (!token || localStorage.getItem('nh-auth-token') !== token) throw new Error('Inicia sesión con conexión para validar la ruta.');
      await requestLocationStoragePersistence();
      await activateLocationQueueSession(scope, API_BASE, token);
    };
    const startTracking = async (explicitResume: boolean, startFromMap: boolean) => {
      if (!eligibleNow()) return;
      try {
        await prepareQueue();
        if (disposed || sessionReset || !eligibleNow()) return;
        if (startFromMap) persistOfflineRouteEligibility(scope);
        if (explicitResume) await tracker.resume();
        else await tracker.start();
      } catch (error) {
        if (!disposed) setState((current) => ({
          ...current,
          gps: 'error',
          enabled: false,
          message: error instanceof Error ? error.message : 'No se pudo preparar el almacenamiento local.',
        }));
      }
    };
    const refreshQueue = async () => {
      if (syncInFlight || disposed) return;
      syncInFlight = true;
      try {
        await flushLocationQueue(scope);
      } catch {
        // La cola conserva los puntos para el siguiente intento.
      } finally {
        syncInFlight = false;
        await tracker.refresh();
      }
    };

    const releaseWakeLock = () => {
      wakeRequestVersion += 1;
      const current = wakeLock;
      wakeLock = null;
      current?.release().catch(() => undefined);
      if (!disposed) setState((currentState) => ({ ...currentState, wakeLock: false }));
    };
    const acquireWakeLock = async () => {
      const wakeApi = navigator as WakeLockNavigator;
      if (!wakeRequestedRef.current || document.visibilityState !== 'visible' || !wakeApi.wakeLock || wakeLock || wakeRequestPending) return;
      wakeRequestPending = true;
      const requestVersion = ++wakeRequestVersion;
      try {
        const next = await wakeApi.wakeLock.request('screen');
        if (disposed || requestVersion !== wakeRequestVersion || !wakeRequestedRef.current || document.visibilityState !== 'visible') {
          await next.release().catch(() => undefined);
          return;
        }
        wakeLock = next;
        next.addEventListener('release', () => {
          if (wakeLock !== next) return;
          wakeLock = null;
          if (!disposed) setState((current) => ({ ...current, wakeLock: false }));
        });
        if (!disposed) setState((current) => ({ ...current, wakeLock: true }));
      } catch {
        if (!disposed) setState((current) => ({ ...current, wakeLock: false, message: 'El navegador no pudo mantener la pantalla activa.' }));
      } finally {
        wakeRequestPending = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void tracker.refresh();
        if (navigator.onLine) void refreshQueue();
        if (wakeRequestedRef.current) void acquireWakeLock();
      } else {
        releaseWakeLock();
      }
    };
    const handleOnline = () => { void refreshQueue(); };
    const handleAuthReset = () => {
      sessionReset = true;
      sharingRef.current = false;
      setSharing(false);
      clearOfflineRouteEligibility(scope);
      void tracker.pause();
      releaseWakeLock();
      void deactivateLocationQueueSession(scope);
      if (canHide && navigator.onLine) void api.delete('/force-sales/presence/me').catch(() => undefined);
    };
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.source !== 'novahub-force-sales') return;
      if (event.data?.type !== 'presence-sharing-changed') return;
      const next = Boolean(event.data.enabled);
      sharingRef.current = next;
      localStorage.setItem(PRESENCE_KEY(scope.userId), String(next));
      setSharing(next);
      if (next) {
        void startTracking(true, true);
      } else {
        clearOfflineRouteEligibility(scope);
        void tracker.pause();
        releaseWakeLock();
        if (canHide && navigator.onLine) void api.delete('/force-sales/presence/me').catch(() => undefined);
      }
    };
    const handleResume = () => {
      if (eligibleNow()) void startTracking(false, false);
    };
    const handleRetry = () => {
      if (!eligibleNow()) return;
      void prepareQueue().then(() => tracker.retry()).catch((error) => {
        if (!disposed) setState((current) => ({ ...current, gps: 'error', message: error instanceof Error ? error.message : 'No se pudo preparar el reintento GPS.' }));
      });
    };
    const handleWakePreference = () => {
      const next = !wakeRequestedRef.current;
      wakeRequestedRef.current = next;
      try { localStorage.setItem(WAKE_LOCK_KEY(scope), String(next)); } catch { /* La preferencia es local y opcional. */ }
      setWakePreferenceState({ scope: locationScopeKey(scope), enabled: next });
      if (next) void acquireWakeLock();
      else releaseWakeLock();
    };
    const syncTimer = window.setInterval(() => {
      if (navigator.onLine) void refreshQueue();
    }, 30_000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('message', handleMessage);
    window.addEventListener('force-sales-tracking-resume', handleResume);
    window.addEventListener('force-sales-tracking-retry', handleRetry);
    window.addEventListener('auth-session-reset', handleAuthReset);
    window.addEventListener('force-sales-screen-lock', handleWakePreference);
    document.addEventListener('visibilitychange', handleVisibility);

    void (async () => {
      try {
        if (token) {
          await prepareQueue();
          await tracker.refresh();
          if (navigator.onLine) await refreshQueue();
          if (eligibleNow()) await startTracking(false, false);
        } else {
          await tracker.refresh();
        }
        if (wakeRequestedRef.current && document.visibilityState === 'visible') await acquireWakeLock();
      } catch {
        // La ruta puede seguir en la cola local hasta que la sesión vuelva a estar disponible.
      }
    })();

    return () => {
      disposed = true;
      window.clearInterval(syncTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('force-sales-tracking-resume', handleResume);
      window.removeEventListener('force-sales-tracking-retry', handleRetry);
      window.removeEventListener('auth-session-reset', handleAuthReset);
      window.removeEventListener('force-sales-screen-lock', handleWakePreference);
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeRequestVersion += 1;
      wakeLock?.release().catch(() => undefined);
      wakeLock = null;
      if (trackerRef.current === tracker) trackerRef.current = null;
      void tracker.destroy();
      if (!sessionReset) void deactivateLocationQueueSession(scope, false);
    };
  }, [identity, canTrack, canHide, setSharing]);

  useEffect(() => {
    if (!identity || !canTrack || activeModule !== 'fuerza-comercial') return;
    window.dispatchEvent(new CustomEvent('force-sales-tracking-resume'));
  }, [activeModule, canTrack, identity, user?.id]);

  const onWakeLockClick = () => window.dispatchEvent(new Event('force-sales-screen-lock'));
  const onRetryClick = () => window.dispatchEvent(new Event('force-sales-tracking-retry'));
  const label = gpsLabel(state);
  const gpsIconClass = state.gps === 'denied' || state.gps === 'error'
    ? 'text-destructive'
    : state.gps === 'recent'
      ? 'text-emerald-600 dark:text-emerald-400'
      : state.enabled
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';
  const pendingLabel = `${state.pending} punto${state.pending === 1 ? '' : 's'} pendiente${state.pending === 1 ? '' : 's'}`;
  const wakeSupported = 'wakeLock' in navigator;

  if (!identity || !canTrack || activeModule !== 'fuerza-comercial') return null;

  return (
    <aside className="pointer-events-auto absolute right-3 top-[4.25rem] z-[150] text-card-foreground sm:right-5 sm:top-[4.5rem]" aria-label="Estado del rastreo de ruta">
      <button
        type="button"
        onClick={() => setPanelOpen((open) => !open)}
        aria-expanded={panelOpen}
        aria-controls="force-sales-tracking-panel"
        aria-label={`${panelOpen ? 'Cerrar' : 'Abrir'} estado GPS: ${label}`}
        className="flex size-10 items-center justify-center rounded-full border border-border/80 bg-card/95 p-1 shadow-xl backdrop-blur transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
      >
        <MapPin className={`size-4 ${gpsIconClass}`} aria-hidden="true" />
      </button>
      <section
        id="force-sales-tracking-panel"
        aria-label="Estado del rastreo de ruta"
        className={`${panelOpen ? 'block' : 'hidden'} absolute right-0 top-12 w-[min(22rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur sm:static sm:block sm:max-h-none sm:w-[min(23rem,calc(100vw-3rem))] sm:overflow-visible sm:p-3`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className={`size-2 shrink-0 rounded-full ${state.gps === 'recent' ? 'bg-emerald-500' : state.gps === 'denied' || state.gps === 'error' ? 'bg-destructive' : 'bg-amber-500'}`} aria-hidden="true" />
              <span>{label}</span>
              <span className="font-medium text-muted-foreground">{state.online ? 'Con conexión' : 'Sin conexión'}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Última captura: {timeLabel(state.lastCapturedAt)} · {ageLabel(state.lastCapturedAt)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{pendingLabel} · último envío {timeLabel(state.lastSyncedAt)}</p>
          </div>
          <button type="button" onClick={onWakeLockClick} disabled={!wakeSupported} aria-pressed={wakeRequested} className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" title="Mantener la pantalla activa mientras NovaHub permanece visible">
            {wakeRequested ? 'Pantalla activa' : 'Mantener pantalla'}
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Mantener pantalla funciona mientras NovaHub permanece visible.</p>
        {state.message && <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300" role="status">{state.message}</p>}
        {(state.gps === 'denied' || state.gps === 'error' || state.gps === 'stale' || state.gps === 'other-tab') && sharing && (
          <button type="button" onClick={onRetryClick} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reintentar GPS</button>
        )}
        {!sharing && <p className="mt-2 text-[11px] text-muted-foreground">La ubicación está pausada. Puedes activarla desde Privacidad de ubicación.</p>}
      </section>
    </aside>
  );
}
