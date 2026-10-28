import { MapPinned, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { subscribeToNotificationEvents } from '../services/notifications.service';
import isotipoUrl from '../../assets/branding/novahub-isotipo.png';
import mapUrl from '../../../maps/diseñoui_mapas_freelancers.html?url';

interface ForceSalesMapConfig {
  mapProvider?: string;
  mapSearchMode?: string;
  mapTileUrl?: string | null;
  mapGeocoderUrl?: string | null;
}

export function FuerzaComercialPage({ activeSubModule }: { activeSubModule?: string; onSubModuleChange?: (value: string) => void }) {
  const { user, hasAccess, canPerform } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const routeImportInputRef = useRef<HTMLInputElement>(null);
  const pendingProspectTargetRef = useRef<string | null>(null);
  const streamStatusRef = useRef<'connected' | 'reconnecting'>('reconnecting');
  const [previousSubModule, setPreviousSubModule] = useState(activeSubModule);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  if (previousSubModule !== activeSubModule) {
    setPreviousSubModule(activeSubModule);
    setMapFullscreen(false);
  }
  const [mapConfig, setMapConfig] = useState<ForceSalesMapConfig | null>(null);
  const isSuperAdmin = user?.role === 'superadmin';
  const normalizedRole = String(user?.role || '').toUpperCase();
  const normalizedUserType = String(user?.userType || '').toUpperCase();
  const canAssignTeam = isSuperAdmin || ['SUPER_ADMIN', 'SUPERADMIN', 'PLATFORM_ADMIN', 'PARTNER', 'ADMIN', 'MANAGER'].includes(normalizedRole) || normalizedUserType === 'ADMIN' || Boolean(user?.isTenantAdmin) || Boolean(user?.managerCanEdit);
  const isAuthorizedUser = Boolean(user) && hasAccess('fuerza-comercial');
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://backenderpnh.onrender.com/api' : 'http://localhost:3000/api');
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const googleMapsMapId = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '').trim() || 'DEMO_MAP_ID';
  const googleMapsCleanMapId = String(import.meta.env.VITE_GOOGLE_MAPS_CLEAN_MAP_ID || '').trim();
  const tenantLogo = user?.clientTenant?.logo || user?.sessionBranding?.logo || isotipoUrl;
  const view = activeSubModule === 'fuerza-comercial-kanban' ? 'kanban' : activeSubModule === 'fuerza-comercial-historial' ? 'history' : 'map';
  const workflowActions = [
    'importProspects', 'updateProspect', 'changeStage', 'registerVisit', 'discardProspect', 'delete', 'assignProspect',
    'attachEvidence', 'manageConsent', 'send', 'createRoute', 'editRoute', 'assignRoute', 'changeRouteStatus',
    'completeRouteStop', 'updatePresence', 'hidePresence', 'configureLocation',
  ] as const;
  const workflowPermissions = Object.fromEntries(workflowActions.map((action) => [action, canPerform('FORCE_SALES', action)]));
  useEffect(() => {
    let cancelled = false;
    if (!isAuthorizedUser) return undefined;
    void api.get<ForceSalesMapConfig>('/force-sales/config').then((configuration) => {
      if (!cancelled) setMapConfig(configuration || {});
    }).catch(() => {
      if (!cancelled) setMapConfig({});
    });
    return () => { cancelled = true; };
  }, [isAuthorizedUser, user?.clientTenantId]);

  useEffect(() => {
    if (!isAuthorizedUser || !user?.id || !user?.clientTenantId) return undefined;
    const send = (type: string, detail: Record<string, unknown> = {}) => {
      iframeRef.current?.contentWindow?.postMessage({ source: 'novahub-force-sales', type, ...detail }, window.location.origin);
    };
    const unsubscribe = subscribeToNotificationEvents(
      `${user.clientTenantId}:${user.id}`,
      event => {
        if (event.type !== 'force-sales-invalidated' || event.clientTenantId !== user.clientTenantId) return;
        send('force-sales-refresh', { event });
      },
      status => {
        streamStatusRef.current = status;
        send('force-sales-stream-status', { status });
      },
    );
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      if (!['fuerza-comercial', 'force-sales'].includes(String(detail.module || '').toLowerCase())) return;
      const targetId = String(detail.targetId || detail.entityId || '').trim();
      if (!targetId) return;
      pendingProspectTargetRef.current = targetId;
      send('force-sales-focus-prospect', { targetId });
    };
    window.addEventListener('navigate-module', onNavigate);
    return () => {
      unsubscribe();
      window.removeEventListener('navigate-module', onNavigate);
    };
  }, [isAuthorizedUser, user?.id, user?.clientTenantId]);

  const mapProvider = String(mapConfig?.mapProvider || 'GOOGLE').toUpperCase();
  const mapSearchMode = String(mapConfig?.mapSearchMode || 'EXTERNAL').toUpperCase();
  const mapSrc = `${mapUrl}${mapUrl.includes('?') ? '&' : '?'}api=${encodeURIComponent(apiBase)}&isotipo=${encodeURIComponent(tenantLogo)}&companyLogo=${encodeURIComponent(tenantLogo)}&view=${view}&userId=${encodeURIComponent(user?.id || '')}&tenantId=${encodeURIComponent(user?.clientTenantId || '')}&platformAdmin=${isSuperAdmin ? 'true' : 'false'}&canAssignTeam=${canAssignTeam ? 'true' : 'false'}&durableTracking=true&permissions=${encodeURIComponent(JSON.stringify(workflowPermissions))}&mapId=${encodeURIComponent(googleMapsMapId)}&cleanMapId=${encodeURIComponent(googleMapsCleanMapId)}&mapProvider=${encodeURIComponent(mapProvider)}&mapSearchMode=${encodeURIComponent(mapSearchMode)}${mapConfig?.mapTileUrl ? `&mapTileUrl=${encodeURIComponent(mapConfig.mapTileUrl)}` : ''}${mapConfig?.mapGeocoderUrl ? `&mapGeocoderUrl=${encodeURIComponent(mapConfig.mapGeocoderUrl)}` : ''}${googleMapsKey ? `&mapsKey=${encodeURIComponent(googleMapsKey)}` : ''}`;

  useEffect(() => {
    const frame = iframeRef.current;
    const section = mapSectionRef.current;
    if (!frame || !section) return undefined;

    let scheduledFrame = 0;
    const publishUiContext = () => {
      scheduledFrame = 0;
      const target = frame.contentWindow;
      if (!target) return;

      const visualViewport = window.visualViewport;
      const viewportTop = visualViewport?.offsetTop ?? 0;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const frameBounds = frame.getBoundingClientRect();
      const visibleTop = Math.max(frameBounds.top, viewportTop);
      const visibleBottom = Math.min(frameBounds.bottom, viewportTop + viewportHeight);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);
      const styles = getComputedStyle(document.documentElement);
      const color = (token: string, fallback: string) => {
        const value = styles.getPropertyValue(token).trim();
        return value && CSS.supports('color', value) ? value : fallback;
      };

      target.postMessage({
        source: 'novahub-force-sales',
        type: 'ui-context',
        userName: user?.name || '',
        viewport: {
          top: visibleHeight ? Math.round(visibleTop - frameBounds.top) : 0,
          bottom: visibleHeight ? Math.round(frameBounds.bottom - visibleBottom) : 0,
          height: Math.round(visibleHeight),
        },
        theme: {
          dark: document.documentElement.classList.contains('dark'),
          colors: {
            background: color('--background', '#f8fafc'),
            foreground: color('--foreground', '#11241f'),
            card: color('--card', '#ffffff'),
            muted: color('--muted', '#ececf0'),
            mutedForeground: color('--muted-foreground', '#6c7c77'),
            border: color('--border', 'rgba(0,0,0,.1)'),
            primary: color('--primary', '#01422c'),
          },
        },
      }, window.location.origin);
    };
    const scheduleUiContext = () => {
      if (scheduledFrame) return;
      scheduledFrame = requestAnimationFrame(publishUiContext);
    };
    const resizeObserver = new ResizeObserver(scheduleUiContext);
    const themeObserver = new MutationObserver(scheduleUiContext);
    const onUiContextRequest = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.source === 'novahub-force-sales' && event.data?.type === 'request-ui-context') scheduleUiContext();
    };
    resizeObserver.observe(section);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('message', onUiContextRequest);
    window.addEventListener('resize', scheduleUiContext, { passive: true });
    window.addEventListener('scroll', scheduleUiContext, { passive: true, capture: true });
    window.visualViewport?.addEventListener('resize', scheduleUiContext, { passive: true });
    window.visualViewport?.addEventListener('scroll', scheduleUiContext, { passive: true });
    const onFrameLoad = () => {
      scheduleUiContext();
      frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-stream-status', status: streamStatusRef.current }, window.location.origin);
      const targetId = pendingProspectTargetRef.current;
      if (targetId) frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-focus-prospect', targetId }, window.location.origin);
    };
    frame.addEventListener('load', onFrameLoad);
    scheduleUiContext();

    return () => {
      if (scheduledFrame) cancelAnimationFrame(scheduledFrame);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener('resize', scheduleUiContext);
      window.removeEventListener('scroll', scheduleUiContext, true);
      window.visualViewport?.removeEventListener('resize', scheduleUiContext);
      window.visualViewport?.removeEventListener('scroll', scheduleUiContext);
      window.removeEventListener('message', onUiContextRequest);
      frame.removeEventListener('load', onFrameLoad);
    };
  }, [mapSrc, mapFullscreen, user?.name]);

  useEffect(() => {
    const onMapMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.source !== 'novahub-force-sales') return;
      if (event.data?.type === 'fullscreen') setMapFullscreen(Boolean(event.data.active));
      if (event.data?.type === 'configuration-updated') setMapConfig(event.data.configuration || {});
      if (event.data?.type === 'request-import-file') routeImportInputRef.current?.click();
      if (event.data?.type === 'force-sales-focus-complete') pendingProspectTargetRef.current = null;
    };
    window.addEventListener('message', onMapMessage);
    return () => window.removeEventListener('message', onMapMessage);
  }, []);

  if (!isAuthorizedUser) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-xl">
          <ShieldAlert className="mx-auto mb-4 size-10 text-destructive" />
          <h1 className="text-2xl font-black tracking-tight">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta herramienta no está habilitada para tu empresa o tu rol.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section ref={mapSectionRef} className={mapFullscreen ? 'fixed inset-0 z-[100] h-[100dvh] min-h-0 overflow-hidden bg-background' : 'relative h-[calc(100dvh-4rem)] min-h-0 overflow-hidden bg-background'}>
      <div className="pointer-events-none absolute left-4 top-4 z-10 hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/90 px-3 py-2 text-xs font-bold text-[#123f35] shadow-lg backdrop-blur md:flex">
        <MapPinned className="size-4 text-[#08785a]" />
        NovaHub Force · {mapProvider === 'OPENSTREETMAP' ? 'OpenStreetMap' : mapProvider === 'CUSTOM' ? 'Mapa propio' : 'Google Maps'}
      </div>
      {mapConfig && <iframe
        ref={iframeRef}
        key={`${mapProvider}:${mapSearchMode}:${mapConfig?.mapTileUrl || ''}:${mapConfig?.mapGeocoderUrl || ''}`}
        title="Fuerza Comercial NovaHub"
        src={mapSrc}
        allow="geolocation; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block h-full min-h-0 w-full border-0"
      />}
      <input
        ref={routeImportInputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.tsv"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          try {
            const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
            const sheets = Object.fromEntries(workbook.SheetNames.map((name) => [
              name,
              XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name], { defval: '' }),
            ]));
            const firstSheet = workbook.SheetNames[0];
            iframeRef.current?.contentWindow?.postMessage({
              source: 'novahub-force-sales',
              type: 'force-sales-import-rows',
              fileName: file.name,
              rows: firstSheet ? sheets[firstSheet] || [] : [],
              sheets,
            }, '*');
          } catch {
            iframeRef.current?.contentWindow?.postMessage({
              source: 'novahub-force-sales',
              type: 'force-sales-import-error',
              message: 'No se pudo leer el archivo. Usa la plantilla XLSX o un CSV/TSV válido.',
            }, '*');
          }
        }}
      />
      {!mapConfig && <div className="flex h-full items-center justify-center text-sm font-semibold text-[#123f35]">Cargando configuración de mapas…</div>}
    </section>
  );
}

export default FuerzaComercialPage;
