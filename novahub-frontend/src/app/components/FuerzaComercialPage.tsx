import { ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { subscribeToNotificationEvents } from '../services/notifications.service';
import { canAccessModuleView } from '../utils/moduleViewAccess';
import { ForceSalesNavigation } from './force-sales/ForceSalesNavigation';
import { ForceSalesMapHeader } from './force-sales/ForceSalesMapHeader';
import { ForceSalesCustomerLinkDialog, type ForceSalesCustomerOption } from './force-sales/ForceSalesCustomerLinkDialog';
import { useForceSalesFrameBridge } from './force-sales/useForceSalesFrameBridge';
import { buildForceSalesMapUrl } from './force-sales/forceSalesMapUrl';
import {
  enabledModesFromConfig,
  FORCE_SALES_MODE_LABELS,
  FORCE_SALES_MODE_MODULES,
  FORCE_SALES_MODE_PERMISSIONS,
  modeStorageKey,
  parseForceSalesSummary,
  resolveActiveMode,
  type ForceSalesModeConfig,
  type ForceSalesSummary,
  type ForceSalesView,
} from './force-sales/forceSalesModes';
import isotipoUrl from '../../assets/branding/novahub-isotipo.png';

const mapUrl = `${import.meta.env.BASE_URL}maps/diseñoui_mapas_freelancers.html`;

interface ForceSalesMapConfig extends ForceSalesModeConfig {
  mapProvider?: string;
  mapSearchMode?: string;
  mapTileUrl?: string | null;
  mapGeocoderUrl?: string | null;
}

function readStoredMode(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function EmptyMapState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div role="status" className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function FuerzaComercialPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: { activeSubModule?: string; onSubModuleChange?: (value: string) => void; isSidebarCollapsed?: boolean }) {
  const { user, hasAccess, canPerform } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const routeImportInputRef = useRef<HTMLInputElement>(null);
  const pendingProspectTargetRef = useRef<string | null>(null);
  const pendingRouteTargetRef = useRef<string | null>(null);
  const streamStatusRef = useRef<'connected' | 'reconnecting'>('reconnecting');
  const searchQueryRef = useRef('');
  const [previousSubModule, setPreviousSubModule] = useState(activeSubModule);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapFrameError, setMapFrameError] = useState(false);
  const [mapFrameLoadVersion, setMapFrameLoadVersion] = useState(0);
  const [customerLinkPoint, setCustomerLinkPoint] = useState<{ id: string; name: string; address: string; phone: string } | null>(null);
  const [summary, setSummary] = useState<ForceSalesSummary | null>(null);
  if (previousSubModule !== activeSubModule) {
    setPreviousSubModule(activeSubModule);
    setMapFullscreen(false);
  }
  const [mapConfig, setMapConfig] = useState<ForceSalesMapConfig | null>(null);
  const isSuperAdmin = user?.role === 'superadmin';
  const normalizedRole = String(user?.role || '').toUpperCase();
  const normalizedUserType = String(user?.userType || '').toUpperCase();
  const canAssignTeam = isSuperAdmin || ['SUPER_ADMIN', 'SUPERADMIN', 'PLATFORM_ADMIN', 'PARTNER', 'ADMIN', 'MANAGER'].includes(normalizedRole) || normalizedUserType === 'ADMIN' || Boolean(user?.isTenantAdmin) || Boolean(user?.managerCanEdit);
  const canAssignProspectOwner = canPerform('FORCE_SALES', 'assignProspect');
  const canLinkCustomer = canPerform('FORCE_SALES', 'updateProspect') && canPerform('SALES_CLIENTS', 'read');
  const isAuthorizedUser = Boolean(user) && hasAccess('fuerza-comercial');
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://backenderpnh.onrender.com/api' : 'http://localhost:3000/api');
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const googleMapsMapId = String(import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || '').trim() || 'DEMO_MAP_ID';
  const googleMapsCleanMapId = String(import.meta.env.VITE_GOOGLE_MAPS_CLEAN_MAP_ID || '').trim();
  const tenantLogo = user?.clientTenant?.logo || user?.sessionBranding?.logo || isotipoUrl;
  const view: ForceSalesView = activeSubModule === 'fuerza-comercial-kanban' ? 'kanban' : activeSubModule === 'fuerza-comercial-historial' ? 'history' : 'map';
  const workflowActions = [
    'importProspects', 'updateProspect', 'changeStage', 'registerVisit', 'discardProspect', 'delete', 'assignProspect',
    'attachEvidence', 'manageConsent', 'send', 'createRoute', 'editRoute', 'assignRoute', 'changeRouteStatus',
    'completeRouteStop', 'updatePresence', 'hidePresence', 'configureLocation',
  ] as const;
  const workflowPermissions = Object.fromEntries(workflowActions.map((action) => [action, canPerform('FORCE_SALES', action)]));

  // Modos del mapa: los activa el super admin por empresa (o sucursal) y cada rol puede permitirlos o no.
  const enabledModes = useMemo(() => enabledModesFromConfig(mapConfig), [mapConfig]);
  const moduleAccessPolicies = user?.moduleAccessPolicies;
  const allowedModes = enabledModes.filter((mode) => {
    const permission = FORCE_SALES_MODE_PERMISSIONS[mode];
    const moduleId = FORCE_SALES_MODE_MODULES[mode];
    const roleAllows = !permission || canPerform('FORCE_SALES', permission as Parameters<typeof canPerform>[1]);
    return roleAllows && (!moduleId || canAccessModuleView(moduleAccessPolicies, moduleId));
  });
  const allowedModesKey = allowedModes.join(',');
  const storageKey = modeStorageKey(user?.clientTenantId, user?.id);
  const [storedMode, setStoredMode] = useState<string | null>(() => readStoredMode(storageKey));
  const activeMode = resolveActiveMode(allowedModes, storedMode, view);
  const activeModeRef = useRef(activeMode);
  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);

  const sendToMap = useCallback((type: string, detail: Record<string, unknown> = {}) => {
    iframeRef.current?.contentWindow?.postMessage({ source: 'novahub-force-sales', type, ...detail }, window.location.origin);
  }, []);

  const changeMode = useCallback((mode: string) => {
    setStoredMode(mode);
    setSummary(null);
    searchQueryRef.current = '';
    try { window.localStorage.setItem(storageKey, mode); } catch { /* El modo elegido solo es una comodidad por navegador. */ }
  }, [storageKey]);

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
    const unsubscribe = subscribeToNotificationEvents(
      `${user.clientTenantId}:${user.id}`,
      event => {
        if (event.type !== 'force-sales-invalidated' || event.clientTenantId !== user.clientTenantId) return;
        sendToMap('force-sales-refresh', { event });
      },
      status => {
        streamStatusRef.current = status;
        sendToMap('force-sales-stream-status', { status });
      },
    );
    const onNavigate = (event: Event) => {
      const detail = (event as CustomEvent<Record<string, unknown>>).detail || {};
      if (!['fuerza-comercial', 'force-sales'].includes(String(detail.module || '').toLowerCase())) return;
      const routeId = String(detail.routeId || '').trim();
      if (routeId) {
        pendingRouteTargetRef.current = routeId;
        sendToMap('force-sales-focus-route', { routeId });
        return;
      }
      const targetId = String(detail.targetId || detail.entityId || '').trim();
      if (!targetId) return;
      pendingProspectTargetRef.current = targetId;
      sendToMap('force-sales-focus-prospect', { targetId });
    };
    window.addEventListener('navigate-module', onNavigate);
    return () => {
      unsubscribe();
      window.removeEventListener('navigate-module', onNavigate);
    };
  }, [isAuthorizedUser, user?.id, user?.clientTenantId, sendToMap]);

  const mapProvider = String(mapConfig?.mapProvider || 'GOOGLE').toUpperCase();
  const mapSearchMode = String(mapConfig?.mapSearchMode || 'EXTERNAL').toUpperCase();
  const mapSrc = activeMode ? buildForceSalesMapUrl({
    mapUrl,
    apiBase,
    logo: tenantLogo,
    view,
    userId: user?.id || '',
    tenantId: user?.clientTenantId || '',
    platformAdmin: isSuperAdmin,
    canAssignTeam,
    canAssignProspectOwner,
    canLinkCustomer,
    canViewCustomerSummary: canPerform('SALES_CLIENTS', 'read'),
    canOperateAssignedRoutes: canPerform('FORCE_SALES', 'view'),
    permissions: workflowPermissions,
    mapId: googleMapsMapId,
    cleanMapId: googleMapsCleanMapId,
    mapProvider,
    mapSearchMode,
    mapTileUrl: mapConfig?.mapTileUrl,
    mapGeocoderUrl: mapConfig?.mapGeocoderUrl,
    mapsKey: googleMapsKey,
    mode: activeMode,
    modes: allowedModes,
    layerDefaults: mapConfig?.modeLayers?.[activeMode] ?? null,
  }) : '';

  useForceSalesFrameBridge({
    frameRef: iframeRef,
    sectionRef: mapSectionRef,
    userName: user?.name || '',
    refreshKey: `${mapSrc}|${mapFullscreen}|${mapFrameLoadVersion}`,
    streamStatusRef,
    pendingProspectTargetRef,
    pendingRouteTargetRef,
    onFrameError: setMapFrameError,
    onFrameReady: () => {
      if (searchQueryRef.current) sendToMap('force-sales-search', { query: searchQueryRef.current });
    },
  });

  useEffect(() => {
    const onMapMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.source !== 'novahub-force-sales') return;
      if (event.data?.type === 'force-sales-open-customer-link') {
        const pointId = String(event.data.pointId || '').trim();
        if (!canLinkCustomer || !pointId) return;
        const point = (event.data.point || {}) as Record<string, unknown>;
        setCustomerLinkPoint({ id: pointId, name: String(point.name || ''), address: String(point.address || ''), phone: String(point.phone || '') });
      }
      if (event.data?.type === 'force-sales-summary') {
        const next = parseForceSalesSummary(event.data);
        if (next && next.mode === activeModeRef.current) setSummary(next);
      }
      if (event.data?.type === 'fullscreen') setMapFullscreen(Boolean(event.data.active));
      if (event.data?.type === 'configuration-updated') setMapConfig(event.data.configuration || {});
      if (event.data?.type === 'request-import-file') routeImportInputRef.current?.click();
      if (event.data?.type === 'force-sales-focus-complete') pendingProspectTargetRef.current = null;
      if (event.data?.type === 'force-sales-focus-route-complete') pendingRouteTargetRef.current = null;
    };
    window.addEventListener('message', onMapMessage);
    return () => window.removeEventListener('message', onMapMessage);
  }, [canLinkCustomer]);

  const selectCustomer = (customer: ForceSalesCustomerOption) => {
    if (!customerLinkPoint) return;
    sendToMap('force-sales-customer-link-selected', { pointId: customerLinkPoint.id, customer });
    setCustomerLinkPoint(null);
  };

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

  const kanbanAvailable = !mapConfig || allowedModes.includes('prospecting');
  const noModeMessage = view === 'kanban'
    ? { title: `El Kanban es parte del modo ${FORCE_SALES_MODE_LABELS.prospecting}`, description: 'Tu empresa o tu rol no tienen habilitado ese modo. Pídele al administrador de NovaHub que lo active.' }
    : { title: 'No hay modos del mapa habilitados', description: 'Tu empresa o tu rol no tienen ningún modo del mapa activo. Pídele al administrador de NovaHub que habilite Visitas y zonas, Prospección o Entregas.' };

  return (
    <section ref={mapSectionRef} className={mapFullscreen ? 'fixed inset-0 z-[100] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-background' : 'relative flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden bg-background'}>
      {!mapFullscreen && (
        <div className="shrink-0 space-y-3 px-3 pt-3 sm:px-4">
          <ForceSalesNavigation activeSubModule={activeSubModule} onSubModuleChange={onSubModuleChange} isSidebarCollapsed={isSidebarCollapsed} showKanban={kanbanAvailable} />
          {mapConfig && view === 'map' && activeMode && (
            <ForceSalesMapHeader
              key={activeMode}
              modes={allowedModes}
              activeMode={activeMode}
              onModeChange={changeMode}
              summary={summary}
              onSearch={(query, submit) => {
                searchQueryRef.current = query;
                sendToMap('force-sales-search', { query, submit });
              }}
              onPrimaryAction={() => sendToMap('force-sales-primary-action')}
            />
          )}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {mapConfig && mapSrc && <iframe
          ref={iframeRef}
          key={`${mapFrameLoadVersion}:${activeMode}:${allowedModesKey}:${mapProvider}:${mapSearchMode}:${mapConfig?.mapTileUrl || ''}:${mapConfig?.mapGeocoderUrl || ''}`}
          title="Fuerza Comercial NovaHub"
          src={mapSrc}
          allow="geolocation; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="block h-full min-h-0 w-full border-0"
        />}
        {mapConfig && !mapSrc && <EmptyMapState title={noModeMessage.title} description={noModeMessage.description} />}
        {mapFrameError && <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 p-6">
          <div role="alert" className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
            <h2 className="text-base font-bold text-foreground">No se pudo cargar el mapa comercial</h2>
            <p className="mt-2 text-sm text-muted-foreground">El servidor respondió con una página distinta al mapa. Reintenta para volver a cargarlo.</p>
            <button type="button" onClick={() => {
              setMapFrameError(false);
              setMapFrameLoadVersion((version) => version + 1);
            }} className="mt-4 min-h-10 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Reintentar mapa
            </button>
          </div>
        </div>}
        {!mapConfig && <div className="flex h-full items-center justify-center text-sm font-semibold text-[#123f35]">Cargando configuración de mapas…</div>}
      </div>
      <ForceSalesCustomerLinkDialog
        open={Boolean(customerLinkPoint)}
        point={customerLinkPoint}
        canCreate={canPerform('SALES_CLIENTS', 'create')}
        onClose={() => setCustomerLinkPoint(null)}
        onSelect={selectCustomer}
      />
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
    </section>
  );
}

export default FuerzaComercialPage;
