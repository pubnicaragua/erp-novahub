import {
  acquireLocationTrackingLease,
  createLocationEventId,
  getLocationQueueStatus,
  locationScopeKey,
  releaseLocationTrackingLease,
  renewLocationTrackingLease,
  saveLocationPoint,
  type LocationQueueIdentity,
  type LocationQueuePoint,
  type LocationQueueStatus,
} from './force-sales-location-queue.ts';

export type ForceSalesGpsState = 'searching' | 'recent' | 'stale' | 'denied' | 'error' | 'paused' | 'stopped' | 'other-tab';

export type ForceSalesLocationTrackerState = LocationQueueStatus & {
  gps: ForceSalesGpsState;
  enabled: boolean;
  online: boolean;
  message: string;
};

export type ForceSalesLocationPosition = {
  capturedAt: string;
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
};

type PermissionState = 'granted' | 'prompt' | 'denied' | 'unknown';
type LifecycleEvent = { type?: string; key?: string | null; newValue?: string | null };
type BrowserAdapter = {
  now: () => number;
  isVisible: () => boolean;
  isOnline: () => boolean;
  queryPermission: () => Promise<PermissionState>;
  watchPosition: (
    onPosition: (position: GeolocationPosition) => void | Promise<void>,
    onError: (error: GeolocationPositionError) => void,
    options: PositionOptions,
  ) => number;
  clearWatch: (watchId: number) => void;
  subscribeLifecycle: (listener: (event?: LifecycleEvent) => void | Promise<void>) => () => void;
  setInterval: (handler: () => void, milliseconds: number) => number;
  clearInterval: (intervalId: number) => void;
};

type QueueAdapter = {
  acquireLease: (identity: LocationQueueIdentity, ownerId: string) => Promise<boolean>;
  renewLease: (identity: LocationQueueIdentity, ownerId: string) => Promise<boolean>;
  releaseLease: (identity: LocationQueueIdentity, ownerId: string) => Promise<void>;
  getStatus: (identity: LocationQueueIdentity) => Promise<LocationQueueStatus>;
  savePoint: (
    identity: LocationQueueIdentity,
    point: LocationQueuePoint,
    ownerId: string,
    isCurrent: () => boolean,
  ) => Promise<void>;
};

type TrackerOptions = {
  identity: LocationQueueIdentity;
  ownerId?: string;
  isEligible: () => boolean;
  browser?: BrowserAdapter;
  queue?: QueueAdapter;
  onState?: (state: ForceSalesLocationTrackerState) => void;
  onFreshLocation?: (position: ForceSalesLocationPosition) => void | Promise<void>;
};

type TrackerHandle = {
  start: () => Promise<void>;
  retry: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  refresh: () => Promise<void>;
  destroy: () => Promise<void>;
  getState: () => ForceSalesLocationTrackerState;
};

const RECENT_LOCATION_MS = 90_000;
const RECOVERY_COOLDOWN_MS = 60_000;
const MAINTENANCE_INTERVAL_MS = 10_000;
const PAUSED_KEY_PREFIX = 'novaForceSalesTrackingPausedV1:';

export function isFreshLocationTimestamp(
  capturedAt: string | number | null | undefined,
  now = Date.now(),
  maxAgeMs = RECENT_LOCATION_MS,
) {
  const timestamp = typeof capturedAt === 'number' ? capturedAt : Date.parse(capturedAt || '');
  return Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= maxAgeMs;
}

function makeDefaultBrowserAdapter(): BrowserAdapter {
  return {
    now: () => Date.now(),
    isVisible: () => typeof document !== 'undefined' && document.visibilityState === 'visible',
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine,
    async queryPermission() {
      const permissions = typeof navigator === 'undefined'
        ? undefined
        : (navigator as Navigator & { permissions?: Permissions }).permissions;
      if (!permissions?.query) return 'unknown';
      try {
        const status = await permissions.query({ name: 'geolocation' } as PermissionDescriptor);
        return status.state === 'granted' || status.state === 'denied' || status.state === 'prompt'
          ? status.state
          : 'unknown';
      } catch {
        return 'unknown';
      }
    },
    watchPosition(onPosition, onError, options) {
      if (typeof navigator === 'undefined' || !navigator.geolocation) throw new Error('Este navegador no ofrece geolocalización.');
      return navigator.geolocation.watchPosition((position) => { void onPosition(position); }, onError, options);
    },
    clearWatch(watchId) {
      if (typeof navigator !== 'undefined') navigator.geolocation?.clearWatch(watchId);
    },
    subscribeLifecycle(listener) {
      if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
      const onVisibility = () => { void listener({ type: 'visibilitychange' }); };
      const onFocus = () => { void listener({ type: 'focus' }); };
      const onPageShow = () => { void listener({ type: 'pageshow' }); };
      const onNetworkChange = (event: Event) => { void listener({ type: event.type }); };
      const onStorage = (event: StorageEvent) => {
        void listener({ type: 'storage', key: event.key, newValue: event.newValue });
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', onFocus);
      window.addEventListener('pageshow', onPageShow);
      window.addEventListener('online', onNetworkChange);
      window.addEventListener('offline', onNetworkChange);
      window.addEventListener('storage', onStorage);
      return () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', onFocus);
        window.removeEventListener('pageshow', onPageShow);
        window.removeEventListener('online', onNetworkChange);
        window.removeEventListener('offline', onNetworkChange);
        window.removeEventListener('storage', onStorage);
      };
    },
    setInterval: (handler, milliseconds) => window.setInterval(handler, milliseconds),
    clearInterval: (intervalId) => window.clearInterval(intervalId),
  };
}

function makeDefaultQueueAdapter(): QueueAdapter {
  return {
    acquireLease: acquireLocationTrackingLease,
    renewLease: renewLocationTrackingLease,
    releaseLease: releaseLocationTrackingLease,
    getStatus: getLocationQueueStatus,
    savePoint: saveLocationPoint,
  };
}

function makeOwnerId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tracking-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function pauseKey(identity: LocationQueueIdentity) {
  return `${PAUSED_KEY_PREFIX}${locationScopeKey(identity)}`;
}

function readPaused(identity: LocationQueueIdentity) {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(pauseKey(identity)) === 'true';
  } catch {
    return false;
  }
}

function writePaused(identity: LocationQueueIdentity, paused: boolean) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (paused) localStorage.setItem(pauseKey(identity), 'true');
    else localStorage.removeItem(pauseKey(identity));
  } catch {
    // La exclusión principal vive en IndexedDB; la pausa local se conserva si el navegador lo permite.
  }
}

export function clearForceSalesLocationTrackingPause(identity: LocationQueueIdentity) {
  writePaused(identity, false);
}

export function createForceSalesLocationTracker(options: TrackerOptions): TrackerHandle {
  const { identity, isEligible } = options;
  const browser = options.browser || makeDefaultBrowserAdapter();
  const queue = options.queue || makeDefaultQueueAdapter();
  const ownerId = options.ownerId || makeOwnerId();
  let state: ForceSalesLocationTrackerState = {
    gps: 'stopped',
    enabled: false,
    online: browser.isOnline(),
    pending: 0,
    lastCapturedAt: null,
    lastSyncedAt: null,
    message: '',
  };
  let wantsTracking = false;
  let deniedUntilRetry = false;
  let destroyed = false;
  let paused = readPaused(identity);
  let hasLease = false;
  let watchId: number | null = null;
  let epoch = 0;
  let startPromise: Promise<void> | null = null;
  let watchStartPromise: Promise<void> | null = null;
  let unsubscribeLifecycle: (() => void) | null = null;
  let intervalId: number | null = null;
  let maintenancePromise: Promise<void> | null = null;
  let lastPersistedAt = 0;
  let lastPersistedPoint: { lat: number; lng: number } | null = null;
  let latestAcceptedAt: number | null = null;
  let watchStartedAt: number | null = null;
  let lastRecoveryAt: number | null = null;

  const publish = (patch: Partial<ForceSalesLocationTrackerState>) => {
    if (destroyed) return;
    state = { ...state, ...patch };
    options.onState?.({ ...state });
  };

  const gpsFor = (capturedAt: string | null, enabled: boolean): ForceSalesGpsState => {
    if (paused) return 'paused';
    if (!enabled) return state.gps === 'other-tab' ? 'other-tab' : 'stopped';
    if (!capturedAt) return state.gps === 'denied' || state.gps === 'error' ? state.gps : 'searching';
    return isFreshLocationTimestamp(capturedAt, browser.now()) ? 'recent' : 'stale';
  };

  const isCurrent = (callbackEpoch: number) => (
    !destroyed
    && callbackEpoch === epoch
    && wantsTracking
    && !paused
    && !readPaused(identity)
    && isEligible()
  );

  const clearWatch = () => {
    epoch += 1;
    const currentWatch = watchId;
    watchId = null;
    if (currentWatch !== null) browser.clearWatch(currentWatch);
  };

  const releaseLease = async () => {
    if (!hasLease) return;
    hasLease = false;
    await queue.releaseLease(identity, ownerId).catch(() => undefined);
  };

  const stopCapture = async ({ release = true, message = '' }: { release?: boolean; message?: string } = {}) => {
    clearWatch();
    if (release) await releaseLease();
    publish({ enabled: false, gps: paused ? 'paused' : 'stopped', message });
  };

  const updateQueueStatus = async () => {
    try {
      const status = await queue.getStatus(identity);
      if (destroyed) return;
      const lastCapturedAt = [status.lastCapturedAt, state.lastCapturedAt]
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0] || null;
      const enabled = watchId !== null;
      publish({
        ...status,
        lastCapturedAt,
        online: browser.isOnline(),
        gps: state.gps === 'denied' || state.gps === 'error' || state.gps === 'other-tab'
          ? state.gps
          : gpsFor(lastCapturedAt, enabled || wantsTracking),
      });
    } catch (error) {
      publish({ online: browser.isOnline(), message: error instanceof Error ? error.message : 'No se pudo leer la cola local.' });
    }
  };

  const ownsCurrentLease = async () => {
    if (!hasLease) return false;
    const renewed = await queue.renewLease(identity, ownerId).catch(() => false);
    if (!renewed) {
      hasLease = false;
      clearWatch();
      publish({ enabled: false, gps: 'other-tab', message: 'Otra pestaña está capturando la ruta para esta cuenta.' });
      return false;
    }
    return true;
  };

  const persistPosition = async (position: GeolocationPosition, callbackEpoch: number) => {
    if (!isCurrent(callbackEpoch)) return;
    const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
    const captured = position.timestamp;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(captured)) return;
    const capturedAt = new Date(captured).toISOString();
    const now = browser.now();
    if (!isFreshLocationTimestamp(captured, now) || (latestAcceptedAt !== null && captured <= latestAcceptedAt)) {
      publish({
        gps: gpsFor(state.lastCapturedAt, watchId !== null),
        message: 'GPS sin una lectura nueva y reciente; esperando otra posición.',
      });
      return;
    }
    latestAcceptedAt = captured;
    const movedMeters = lastPersistedPoint
      ? Math.hypot((lat - lastPersistedPoint.lat) * 111320, (lng - lastPersistedPoint.lng) * 111320 * Math.cos(lat * Math.PI / 180))
      : Number.POSITIVE_INFINITY;
    const shouldPersist = !lastPersistedPoint || now - lastPersistedAt >= 10_000 || movedMeters >= 25;
    publish({ lastCapturedAt: capturedAt, gps: 'recent', enabled: true, online: browser.isOnline(), message: '' });
    if (!shouldPersist) return;
    const point: LocationQueuePoint = {
      eventId: createLocationEventId(),
      capturedAt,
      lat,
      lng,
      ...(Number.isFinite(accuracy) ? { accuracy } : {}),
      ...(Number.isFinite(heading) && heading >= 0 ? { heading } : {}),
    };
    try {
      await queue.savePoint(identity, point, ownerId, () => isCurrent(callbackEpoch));
      if (!isCurrent(callbackEpoch)) return;
      lastPersistedAt = now;
      lastPersistedPoint = { lat, lng };
      const freshPosition: ForceSalesLocationPosition = {
        capturedAt,
        lat,
        lng,
        ...(Number.isFinite(accuracy) ? { accuracy } : {}),
        ...(Number.isFinite(heading) && heading >= 0 ? { heading } : {}),
      };
      if (accuracy > 500) publish({ message: 'Se guardó el punto; la precisión GPS es baja.' });
      await updateQueueStatus();
      if (!isCurrent(callbackEpoch) || !isFreshLocationTimestamp(captured, browser.now())) return;
      await options.onFreshLocation?.(freshPosition);
    } catch (error) {
      if (!isCurrent(callbackEpoch)) return;
      publish({ gps: 'recent', message: error instanceof Error ? `GPS reciente; no se pudo guardar el punto: ${error.message}` : 'GPS reciente; no se pudo guardar el punto.' });
    }
  };

  const handlePositionError = (error: GeolocationPositionError, callbackEpoch: number) => {
    if (!isCurrent(callbackEpoch)) return;
    if (error.code === error.PERMISSION_DENIED) {
      deniedUntilRetry = true;
      void stopCapture({ message: 'Permiso GPS bloqueado. Actívalo en los permisos del sitio y pulsa Reintentar GPS.' });
      publish({ gps: 'denied', enabled: false, message: 'Permiso GPS bloqueado. Actívalo en los permisos del sitio y pulsa Reintentar GPS.' });
      return;
    }
    const gps = error.code === error.TIMEOUT
      ? gpsFor(state.lastCapturedAt, true)
      : 'error';
    publish({ gps, enabled: watchId !== null, message: error.code === error.TIMEOUT ? 'GPS tardó demasiado; se intentará recuperar.' : 'No se pudo obtener una ubicación GPS.' });
  };

  const beginWatch = (isRecovery: boolean): Promise<void> => {
    if (destroyed || paused || !wantsTracking || watchId !== null || !browser.isVisible()) return Promise.resolve();
    if (watchStartPromise) return watchStartPromise;
    watchStartPromise = (async () => {
      if (!isEligible()) {
        wantsTracking = false;
        await stopCapture({ message: 'La sesión o el permiso para compartir ubicación ya no está activo.' });
        return;
      }
      if (!hasLease) {
        const acquired = await queue.acquireLease(identity, ownerId).catch(() => false);
        if (destroyed || paused || !wantsTracking || !isEligible()) {
          if (acquired) await queue.releaseLease(identity, ownerId).catch(() => undefined);
          return;
        }
        if (!acquired) {
          publish({ enabled: false, gps: 'other-tab', online: browser.isOnline(), message: 'Otra pestaña está capturando la ruta para esta cuenta.' });
          return;
        }
        hasLease = true;
      }
      if (deniedUntilRetry) {
        publish({ enabled: false, gps: 'denied', online: browser.isOnline(), message: 'Permiso GPS bloqueado. Actívalo en los permisos del sitio y pulsa Reintentar GPS.' });
        await releaseLease();
        return;
      }
      const permission = await browser.queryPermission().catch(() => 'unknown' as PermissionState);
      if (destroyed || paused || !wantsTracking || !isEligible()) return;
      if (permission === 'denied') {
        deniedUntilRetry = true;
        publish({ enabled: false, gps: 'denied', online: browser.isOnline(), message: 'Permiso GPS bloqueado. Actívalo en los permisos del sitio y pulsa Reintentar GPS.' });
        await releaseLease();
        return;
      }
      if (!hasLease || watchId !== null || !browser.isVisible()) return;
      const thisEpoch = ++epoch;
      try {
        const nextWatchId = browser.watchPosition(
          (position) => persistPosition(position, thisEpoch),
          (error) => handlePositionError(error, thisEpoch),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
        );
        watchId = nextWatchId;
        if (!watchStartedAt) watchStartedAt = browser.now();
        if (isRecovery) lastRecoveryAt = browser.now();
        const gps = gpsFor(state.lastCapturedAt, true);
        publish({ enabled: true, gps: gps === 'stopped' ? 'searching' : gps, online: browser.isOnline(), message: '' });
      } catch (error) {
        await releaseLease();
        publish({ enabled: false, gps: 'error', online: browser.isOnline(), message: error instanceof Error ? error.message : 'No se pudo iniciar el GPS.' });
      }
    })().finally(() => { watchStartPromise = null; });
    return watchStartPromise;
  };

  const attemptRecovery = async () => {
    if (destroyed || !wantsTracking || paused || !browser.isVisible()) return;
    if (deniedUntilRetry) {
      publish({ enabled: false, gps: 'denied', online: browser.isOnline(), message: 'Permiso GPS bloqueado. Actívalo en los permisos del sitio y pulsa Reintentar GPS.' });
      return;
    }
    if (!isEligible()) {
      wantsTracking = false;
      await stopCapture({ message: 'La sesión o el permiso para compartir ubicación ya no está activo.' });
      return;
    }
    if (!watchId) {
      await beginWatch(false);
      return;
    }
    if (!await ownsCurrentLease()) return;
    // A persisted point from an earlier session is historical context, not a
    // read from this watch. Give the newly started watch its own 90-second
    // window before trying to recover it again.
    const lastReadAt = latestAcceptedAt ?? watchStartedAt;
    const sinceLastRead = lastReadAt === null ? 0 : browser.now() - lastReadAt;
    const noRecentRead = latestAcceptedAt === null
      ? sinceLastRead >= RECENT_LOCATION_MS
      : sinceLastRead > RECENT_LOCATION_MS;
    if (!noRecentRead) {
      publish({ gps: gpsFor(state.lastCapturedAt, true), enabled: true, online: browser.isOnline() });
      return;
    }
    if (lastRecoveryAt !== null && browser.now() - lastRecoveryAt < RECOVERY_COOLDOWN_MS) {
      publish({ gps: 'stale', enabled: true, online: browser.isOnline(), message: 'Sin una lectura GPS reciente; esperando el próximo intento de recuperación.' });
      return;
    }
    const previousWatch = watchId;
    watchId = null;
    epoch += 1;
    if (previousWatch !== null) browser.clearWatch(previousWatch);
    publish({ gps: 'stale', enabled: false, online: browser.isOnline(), message: 'Sin lectura GPS reciente; recuperando el seguimiento.' });
    await beginWatch(true);
  };

  const maintain = async () => {
    if (maintenancePromise || destroyed) return maintenancePromise;
    maintenancePromise = (async () => {
      publish({ online: browser.isOnline() });
      await updateQueueStatus();
      if (!wantsTracking || paused) return;
      await attemptRecovery();
    })().finally(() => { maintenancePromise = null; });
    return maintenancePromise;
  };

  const onLifecycle = async (event?: LifecycleEvent) => {
    if (destroyed) return;
    if (event?.type === 'storage' && event.key === pauseKey(identity)) {
      if (event.newValue === 'true') {
        paused = true;
        wantsTracking = false;
        await stopCapture({ message: 'El rastreo GPS está pausado en otra pestaña.' });
        publish({ gps: 'paused', enabled: false });
        return;
      }
      if (paused && event.newValue === null) {
        paused = false;
        wantsTracking = true;
      }
    }
    if (event?.type === 'online' || event?.type === 'offline') publish({ online: browser.isOnline() });
    await updateQueueStatus();
    if (!wantsTracking || paused || !browser.isVisible()) return;
    if (watchId !== null && !deniedUntilRetry) {
      const permission = await browser.queryPermission().catch(() => 'unknown' as PermissionState);
      if (destroyed || paused || !wantsTracking || !isEligible()) {
        await attemptRecovery();
        return;
      }
      if (permission === 'denied') {
        deniedUntilRetry = true;
        const message = 'Permiso GPS bloqueado. Actívalo en los permisos del sitio y pulsa Reintentar GPS.';
        await stopCapture({ message });
        publish({ gps: 'denied', enabled: false, online: browser.isOnline(), message });
        return;
      }
    }
    await attemptRecovery();
  };

  const installLifecycle = () => {
    if (!unsubscribeLifecycle) unsubscribeLifecycle = browser.subscribeLifecycle(onLifecycle);
    if (intervalId === null) intervalId = browser.setInterval(() => maintain(), MAINTENANCE_INTERVAL_MS);
  };

  const start = (manualRetry = false): Promise<void> => {
    if (destroyed) return Promise.resolve();
    if (startPromise) return startPromise;
    if (manualRetry) deniedUntilRetry = false;
    startPromise = (async () => {
      if (paused || readPaused(identity)) {
        paused = true;
        wantsTracking = false;
        publish({ gps: 'paused', enabled: false, online: browser.isOnline(), message: 'El rastreo GPS está pausado. No se capturan ubicaciones nuevas; tu ruta comercial y sus paradas siguen activas.' });
        await stopCapture({ message: 'El rastreo GPS está pausado. No se capturan ubicaciones nuevas; tu ruta comercial y sus paradas siguen activas.' });
        publish({ gps: 'paused', enabled: false });
        return;
      }
      wantsTracking = true;
      installLifecycle();
      await updateQueueStatus();
      if (!browser.isVisible()) {
        publish({ enabled: false, gps: gpsFor(state.lastCapturedAt, true), online: browser.isOnline() });
        return;
      }
      await beginWatch(false);
    })().finally(() => { startPromise = null; });
    return startPromise;
  };

  const pause = async () => {
    if (destroyed) return;
    paused = true;
    wantsTracking = false;
    writePaused(identity, true);
    await stopCapture({ message: 'El rastreo GPS está pausado. No se capturan ubicaciones nuevas hasta que lo reanudes.' });
    publish({ gps: 'paused', enabled: false });
  };

  const resume = async () => {
    if (destroyed) return;
    paused = false;
    writePaused(identity, false);
    deniedUntilRetry = false;
    await start(false);
  };

  const retry = async () => {
    if (destroyed || paused || readPaused(identity)) return;
    deniedUntilRetry = false;
    if (watchId !== null) {
      const previousWatch = watchId;
      watchId = null;
      epoch += 1;
      browser.clearWatch(previousWatch);
    }
    await start(true);
  };

  const refresh = async () => {
    if (destroyed) return;
    await updateQueueStatus();
    if (wantsTracking && !paused && browser.isVisible()) await attemptRecovery();
  };

  const destroy = async () => {
    if (destroyed) return;
    destroyed = true;
    wantsTracking = false;
    clearWatch();
    unsubscribeLifecycle?.();
    unsubscribeLifecycle = null;
    if (intervalId !== null) browser.clearInterval(intervalId);
    intervalId = null;
    await releaseLease();
  };

  if (paused) publish({ gps: 'paused', message: 'El rastreo GPS está pausado. No se capturan ubicaciones nuevas; tu ruta comercial y sus paradas siguen activas.' });

  return { start: () => start(), retry, pause, resume, refresh, destroy, getState: () => ({ ...state }) };
}
