import { useEffect, useMemo, useRef, useState } from 'react';
import {
  clearOfflineRouteEligibility,
  getOfflineRouteEligibility,
  locationScopeKey,
  requestLocationStoragePersistence,
  type LocationQueueIdentity,
} from '../services/force-sales-location-queue';
import {
  clearForceSalesLocationTrackingPause,
  createForceSalesLocationTracker,
  type ForceSalesLocationTrackerState,
} from '../services/force-sales-location-tracker';

type Props = { identity: LocationQueueIdentity };
type WakeLockSentinel = { release: () => Promise<void>; addEventListener: (type: 'release', listener: () => void) => void };
type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
const WAKE_LOCK_KEY = (identity: LocationQueueIdentity) => `novaForceSalesWakeLockV1:${locationScopeKey(identity)}`;

function isSameOfflineIdentity(identity: LocationQueueIdentity) {
  const eligible = getOfflineRouteEligibility();
  return Boolean(eligible && locationScopeKey(eligible) === locationScopeKey(identity));
}

function gpsLabel(gps: ForceSalesLocationTrackerState['gps']) {
  switch (gps) {
    case 'searching': return 'Buscando GPS';
    case 'recent': return 'GPS reciente';
    case 'stale': return 'Sin lectura reciente';
    case 'denied': return 'Permiso bloqueado';
    case 'error': return 'Error GPS';
    case 'paused': return 'Rastreo GPS pausado';
    case 'other-tab': return 'Captura en otra pestaña';
    default: return 'Captura detenida';
  }
}

function timeLabel(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';
}

function ageLabel(value: string | null) {
  if (!value) return 'Sin lecturas guardadas';
  const age = Math.max(0, Date.now() - Date.parse(value));
  if (!Number.isFinite(age)) return 'Sin lecturas guardadas';
  if (age < 60_000) return `hace ${Math.floor(age / 1000)} s`;
  if (age < 3_600_000) return `hace ${Math.floor(age / 60_000)} min`;
  return `hace ${Math.floor(age / 3_600_000)} h`;
}

export function ForceSalesOfflineTrackingFallback({ identity }: Props) {
  const identityKey = locationScopeKey(identity);
  const scopedIdentity = useMemo(() => ({ userId: identity.userId, tenantId: identity.tenantId }), [identity.tenantId, identity.userId]);
  const [state, setState] = useState<ForceSalesLocationTrackerState>({
    gps: 'stopped', enabled: false, online: navigator.onLine,
    pending: 0, lastCapturedAt: null, lastSyncedAt: null, message: '',
  });
  const [wakePreferenceState, setWakePreferenceState] = useState(() => ({ scope: identityKey, enabled: (() => {
    try { return localStorage.getItem(WAKE_LOCK_KEY(identity)) === 'true'; } catch { return false; }
  })() }));
  const wakePreference = wakePreferenceState.scope === identityKey
    ? wakePreferenceState.enabled
    : (() => { try { return localStorage.getItem(WAKE_LOCK_KEY(identity)) === 'true'; } catch { return false; } })();
  const wakePreferenceRef = useRef(wakePreference);
  const trackerRef = useRef<ReturnType<typeof createForceSalesLocationTracker> | null>(null);

  useEffect(() => { wakePreferenceRef.current = wakePreference; }, [wakePreference]);

  useEffect(() => {
    let alive = true;
    let wakeLock: WakeLockSentinel | null = null;
    let wakePending = false;
    let requestVersion = 0;
    const tracker = createForceSalesLocationTracker({
      identity: scopedIdentity,
      isEligible: () => alive && isSameOfflineIdentity(scopedIdentity),
      onState: (next) => { if (alive) setState(next); },
    });
    trackerRef.current = tracker;

    const releaseWakeLock = () => {
      requestVersion += 1;
      const current = wakeLock;
      wakeLock = null;
      current?.release().catch(() => undefined);
    };
    const acquireWakeLock = async () => {
      const wakeApi = navigator as WakeLockNavigator;
      if (!wakePreferenceRef.current || document.visibilityState !== 'visible' || !wakeApi.wakeLock || wakeLock || wakePending) return;
      wakePending = true;
      const currentVersion = ++requestVersion;
      try {
        const next = await wakeApi.wakeLock.request('screen');
        if (!alive || currentVersion !== requestVersion || !wakePreferenceRef.current || document.visibilityState !== 'visible') {
          await next.release().catch(() => undefined);
          return;
        }
        wakeLock = next;
        next.addEventListener('release', () => { if (wakeLock === next) wakeLock = null; });
      } catch {
        // Mantener la pantalla activa es opcional y depende del soporte del navegador.
      } finally {
        wakePending = false;
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void tracker.refresh();
        if (wakePreferenceRef.current) void acquireWakeLock();
      } else {
        releaseWakeLock();
      }
    };
    const onOnline = () => {
      if (alive) setState((current) => ({ ...current, online: true }));
      void tracker.refresh();
    };
    const onOffline = () => {
      if (alive) setState((current) => ({ ...current, online: false }));
    };
    const onWakePreference = () => {
      if (wakePreferenceRef.current) void acquireWakeLock();
      else releaseWakeLock();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('force-sales-offline-wake-lock', onWakePreference);
    void tracker.refresh();
    if (wakePreferenceRef.current && document.visibilityState === 'visible') void acquireWakeLock();
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('force-sales-offline-wake-lock', onWakePreference);
      releaseWakeLock();
      if (trackerRef.current === tracker) trackerRef.current = null;
      void tracker.destroy();
    };
  }, [scopedIdentity]);

  const start = async () => {
    if (!isSameOfflineIdentity(scopedIdentity)) {
      setState((current) => ({ ...current, gps: 'stopped', enabled: false, message: 'La jornada ya no está habilitada para esta identidad.' }));
      return;
    }
    await requestLocationStoragePersistence();
    if (state.gps === 'paused') await trackerRef.current?.resume();
    else await trackerRef.current?.start();
  };

  const retry = () => { void trackerRef.current?.retry(); };
  const pause = () => { void trackerRef.current?.pause(); };
  const finishOfflineRoute = () => {
    clearOfflineRouteEligibility(scopedIdentity);
    clearForceSalesLocationTrackingPause(scopedIdentity);
    void trackerRef.current?.destroy().finally(() => window.location.reload());
  };
  const returnToLogin = () => {
    clearOfflineRouteEligibility(scopedIdentity);
    clearForceSalesLocationTrackingPause(scopedIdentity);
    void trackerRef.current?.destroy().finally(() => window.location.reload());
  };
  const toggleWakeLock = () => {
    const next = !wakePreferenceRef.current;
    wakePreferenceRef.current = next;
    setWakePreferenceState({ scope: identityKey, enabled: next });
    try { localStorage.setItem(WAKE_LOCK_KEY(identity), String(next)); } catch { /* La preferencia es local y opcional. */ }
    window.dispatchEvent(new Event('force-sales-offline-wake-lock'));
  };

  const gpsText = gpsLabel(state.gps);
  const pendingLabel = `${state.pending} punto${state.pending === 1 ? '' : 's'} pendiente${state.pending === 1 ? '' : 's'}`;
  const message = state.message || (state.online
    ? 'Hay conexión. Inicia sesión con la misma cuenta para enviar los puntos pendientes.'
    : 'Sin conexión: los puntos capturados se guardan en este teléfono.');
  const wakeSupported = 'wakeLock' in navigator;

  return (
    <main className="flex min-h-[100dvh] min-w-0 items-center justify-center overflow-x-hidden bg-background p-4 text-foreground sm:p-8">
      <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl sm:p-8" aria-labelledby="offline-route-title">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-200">
          <span className={`size-2 rounded-full ${state.online ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
          {state.online ? 'Sesión sin validar' : 'Modo de ruta sin conexión'}
        </div>
        <h1 id="offline-route-title" className="text-xl font-black tracking-tight sm:text-2xl">Reanudar captura GPS de Fuerza Comercial</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Se guardará únicamente la ubicación GPS de la jornada que ya habías iniciado. Esta pantalla no abre el ERP ni los datos de la empresa.</p>

        <section className="mt-5 rounded-2xl border border-border/80 bg-muted/40 p-4" aria-label="Estado de la captura offline">
          <p className="text-sm font-bold" role="status" aria-live="polite">{gpsText}</p>
          <p className="mt-1 text-xs text-muted-foreground">Última captura: {timeLabel(state.lastCapturedAt)} · {ageLabel(state.lastCapturedAt)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{state.online ? 'Con conexión' : 'Sin conexión'} · {pendingLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">Los puntos se enviarán después de iniciar sesión con la misma cuenta y empresa.</p>
        </section>

        <p className="mt-4 text-sm text-amber-800 dark:text-amber-200" role="status" aria-live="polite">{message}</p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={() => { void start(); }} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {state.gps === 'paused' ? 'Reanudar rastreo GPS' : state.enabled ? 'Captura GPS activa' : 'Reanudar captura GPS'}
          </button>
          {(state.gps === 'denied' || state.gps === 'error' || state.gps === 'stale' || state.gps === 'other-tab') && (
            <button type="button" onClick={retry} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reintentar GPS</button>
          )}
          {state.enabled && <button type="button" onClick={pause} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Pausar rastreo GPS</button>}
          {state.online && <button type="button" onClick={returnToLogin} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Volver al inicio de sesión</button>}
          {(state.enabled || state.gps === 'paused') && <button type="button" onClick={finishOfflineRoute} className="rounded-xl border border-border px-4 py-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Finalizar jornada</button>}
        </div>
        {!state.enabled && state.gps !== 'paused' && !state.online && <button type="button" onClick={finishOfflineRoute} className="mt-3 text-xs font-semibold text-muted-foreground underline underline-offset-4">Finalizar esta jornada</button>}

        <div className="mt-5 rounded-2xl border border-border/80 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Mantener pantalla encendida</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Funciona mientras NovaHub permanece visible.</p>
            </div>
            <button type="button" onClick={toggleWakeLock} disabled={!wakeSupported} aria-pressed={wakePreference} className="shrink-0 self-start rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
              {wakePreference ? 'Activada' : 'Mantener pantalla'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
