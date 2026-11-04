import { ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { customersService } from '../services/ventas.service';
import { subscribeToNotificationEvents } from '../services/notifications.service';
import { Combobox } from './ui/Combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import isotipoUrl from '../../assets/branding/novahub-isotipo.png';

const mapUrl = `${import.meta.env.BASE_URL}maps/diseñoui_mapas_freelancers.html`;

interface ForceSalesMapConfig {
  mapProvider?: string;
  mapSearchMode?: string;
  mapTileUrl?: string | null;
  mapGeocoderUrl?: string | null;
}

interface ForceSalesCustomerOption {
  id: string;
  code?: string | null;
  name: string;
  companyName?: string | null;
}

export function FuerzaComercialPage({ activeSubModule }: { activeSubModule?: string; onSubModuleChange?: (value: string) => void }) {
  const { user, hasAccess, canPerform } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const mapSectionRef = useRef<HTMLElement>(null);
  const routeImportInputRef = useRef<HTMLInputElement>(null);
  const pendingProspectTargetRef = useRef<string | null>(null);
  const pendingRouteTargetRef = useRef<string | null>(null);
  const streamStatusRef = useRef<'connected' | 'reconnecting'>('reconnecting');
  const [previousSubModule, setPreviousSubModule] = useState(activeSubModule);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapFrameError, setMapFrameError] = useState(false);
  const [mapFrameLoadVersion, setMapFrameLoadVersion] = useState(0);
  const [customerLinkDialogOpen, setCustomerLinkDialogOpen] = useState(false);
  const [customerLinkPointId, setCustomerLinkPointId] = useState('');
  const [customerLinkCustomers, setCustomerLinkCustomers] = useState<ForceSalesCustomerOption[]>([]);
  const [customerLinkLoading, setCustomerLinkLoading] = useState(false);
  const [customerLinkError, setCustomerLinkError] = useState('');
  const customerLinkLookupRequestRef = useRef(0);
  const customerLinkLookupTimerRef = useRef<number | null>(null);
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
  const view = activeSubModule === 'fuerza-comercial-kanban' ? 'kanban' : activeSubModule === 'fuerza-comercial-historial' ? 'history' : 'map';
  const workflowActions = [
    'importProspects', 'updateProspect', 'changeStage', 'registerVisit', 'discardProspect', 'delete', 'assignProspect',
    'attachEvidence', 'manageConsent', 'send', 'createRoute', 'editRoute', 'assignRoute', 'changeRouteStatus',
    'completeRouteStop', 'updatePresence', 'hidePresence', 'configureLocation',
  ] as const;
  const workflowPermissions = Object.fromEntries(workflowActions.map((action) => [action, canPerform('FORCE_SALES', action)]));
  const loadCustomerLinkCustomers = useCallback((search: string, requestId: number) => {
    setCustomerLinkLoading(true);
    setCustomerLinkError('');
    void customersService.getLookup({ search: search || undefined, status: 'ACTIVE', page: 1, pageSize: 25 }).then((result) => {
      if (requestId === customerLinkLookupRequestRef.current) setCustomerLinkCustomers(result?.data || []);
    }).catch(() => {
      if (requestId !== customerLinkLookupRequestRef.current) return;
      setCustomerLinkCustomers([]);
      setCustomerLinkError('No se pudieron cargar los clientes activos. Intenta de nuevo.');
    }).finally(() => {
      if (requestId === customerLinkLookupRequestRef.current) setCustomerLinkLoading(false);
    });
  }, []);
  const searchCustomerLinkCustomers = useCallback((search: string) => {
    if (customerLinkLookupTimerRef.current !== null) window.clearTimeout(customerLinkLookupTimerRef.current);
    const requestId = ++customerLinkLookupRequestRef.current;
    const term = search.trim();
    customerLinkLookupTimerRef.current = window.setTimeout(() => {
      customerLinkLookupTimerRef.current = null;
      loadCustomerLinkCustomers(term.length >= 2 ? term : '', requestId);
    }, term.length >= 2 ? 250 : 0);
  }, [loadCustomerLinkCustomers]);
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
      const routeId = String(detail.routeId || '').trim();
      if (routeId) {
        pendingRouteTargetRef.current = routeId;
        send('force-sales-focus-route', { routeId });
        return;
      }
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
  const mapSrc = `${mapUrl}${mapUrl.includes('?') ? '&' : '?'}api=${encodeURIComponent(apiBase)}&isotipo=${encodeURIComponent(tenantLogo)}&companyLogo=${encodeURIComponent(tenantLogo)}&view=${view}&embedded=1&userId=${encodeURIComponent(user?.id || '')}&tenantId=${encodeURIComponent(user?.clientTenantId || '')}&platformAdmin=${isSuperAdmin ? 'true' : 'false'}&canAssignTeam=${canAssignTeam ? 'true' : 'false'}&canAssignProspectOwner=${canAssignProspectOwner ? 'true' : 'false'}&canLinkCustomer=${canLinkCustomer ? 'true' : 'false'}&durableTracking=true&permissions=${encodeURIComponent(JSON.stringify(workflowPermissions))}&mapId=${encodeURIComponent(googleMapsMapId)}&cleanMapId=${encodeURIComponent(googleMapsCleanMapId)}&mapProvider=${encodeURIComponent(mapProvider)}&mapSearchMode=${encodeURIComponent(mapSearchMode)}${mapConfig?.mapTileUrl ? `&mapTileUrl=${encodeURIComponent(mapConfig.mapTileUrl)}` : ''}${mapConfig?.mapGeocoderUrl ? `&mapGeocoderUrl=${encodeURIComponent(mapConfig.mapGeocoderUrl)}` : ''}${googleMapsKey ? `&mapsKey=${encodeURIComponent(googleMapsKey)}` : ''}`;

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
      if (frame.src === 'about:blank') return;
      const mapDocument = frame.contentDocument;
      if (!mapDocument?.getElementById('sheet') || !mapDocument.getElementById('map')) {
        setMapFrameError(true);
        frame.src = 'about:blank';
        return;
      }
      setMapFrameError(false);
      scheduleUiContext();
      frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-stream-status', status: streamStatusRef.current }, window.location.origin);
      const targetId = pendingProspectTargetRef.current;
      if (targetId) frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-focus-prospect', targetId }, window.location.origin);
      const routeId = pendingRouteTargetRef.current;
      if (routeId) frame.contentWindow?.postMessage({ source: 'novahub-force-sales', type: 'force-sales-focus-route', routeId }, window.location.origin);
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
  }, [mapSrc, mapFullscreen, mapFrameLoadVersion, user?.name]);

  useEffect(() => {
    const onMapMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.source !== 'novahub-force-sales') return;
      if (event.data?.type === 'force-sales-open-customer-link') {
        const pointId = String(event.data.pointId || '').trim();
        if (!canLinkCustomer || !pointId) return;
        setCustomerLinkPointId(pointId);
        setCustomerLinkDialogOpen(true);
        if (customerLinkLookupTimerRef.current !== null) window.clearTimeout(customerLinkLookupTimerRef.current);
        loadCustomerLinkCustomers('', ++customerLinkLookupRequestRef.current);
      }
      if (event.data?.type === 'fullscreen') setMapFullscreen(Boolean(event.data.active));
      if (event.data?.type === 'configuration-updated') setMapConfig(event.data.configuration || {});
      if (event.data?.type === 'request-import-file') routeImportInputRef.current?.click();
      if (event.data?.type === 'force-sales-focus-complete') pendingProspectTargetRef.current = null;
      if (event.data?.type === 'force-sales-focus-route-complete') pendingRouteTargetRef.current = null;
    };
    window.addEventListener('message', onMapMessage);
    return () => window.removeEventListener('message', onMapMessage);
  }, [canLinkCustomer, loadCustomerLinkCustomers]);

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
      {mapConfig && <iframe
        ref={iframeRef}
        key={`${mapFrameLoadVersion}:${mapProvider}:${mapSearchMode}:${mapConfig?.mapTileUrl || ''}:${mapConfig?.mapGeocoderUrl || ''}`}
        title="Fuerza Comercial NovaHub"
        src={mapSrc}
        allow="geolocation; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        className="block h-full min-h-0 w-full border-0"
      />}
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
      <Dialog open={customerLinkDialogOpen} onOpenChange={(open) => {
        setCustomerLinkDialogOpen(open);
        if (!open) {
          setCustomerLinkPointId('');
          if (customerLinkLookupTimerRef.current !== null) window.clearTimeout(customerLinkLookupTimerRef.current);
          customerLinkLookupTimerRef.current = null;
          customerLinkLookupRequestRef.current += 1;
          setCustomerLinkLoading(false);
        }
      }}>
        <DialogContent className="!z-[121] w-[calc(100%-2rem)] !max-w-md" overlayClassName="!z-[120]">
          <DialogHeader>
            <DialogTitle>Cliente de ventas</DialogTitle>
          </DialogHeader>
          <Combobox
                options={customerLinkCustomers.map((customer) => ({
                  label: customer.name,
                  value: customer.id,
                  description: [customer.code ? `[${customer.code}]` : '', customer.companyName || ''].filter(Boolean).join(' '),
                }))}
                value=""
                onSearchChange={searchCustomerLinkCustomers}
                onChange={(customerId) => {
                  const customer = customerLinkCustomers.find((item) => item.id === customerId);
                  if (!customer || !customerLinkPointId) return;
                  if (customerLinkLookupTimerRef.current !== null) window.clearTimeout(customerLinkLookupTimerRef.current);
                  customerLinkLookupTimerRef.current = null;
                  customerLinkLookupRequestRef.current += 1;
                  setCustomerLinkLoading(false);
                  iframeRef.current?.contentWindow?.postMessage({
                    source: 'novahub-force-sales',
                    type: 'force-sales-customer-link-selected',
                    pointId: customerLinkPointId,
                    customer,
                  }, window.location.origin);
                  setCustomerLinkDialogOpen(false);
                  setCustomerLinkPointId('');
                }}
                placeholder="Seleccionar Cliente"
                searchPlaceholder="Buscar cliente"
                emptyMessage="No se encontraron clientes activos."
                ariaLabel="Seleccionar cliente de ventas"
                contentClassName="!z-[122]"
              />
          {customerLinkLoading && <p className="text-xs text-muted-foreground">Cargando clientes activos…</p>}
          {customerLinkError && <p role="alert" className="text-sm text-destructive">{customerLinkError}</p>}
        </DialogContent>
      </Dialog>
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
