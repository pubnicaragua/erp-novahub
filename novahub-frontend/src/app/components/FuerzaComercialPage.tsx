import { MapPinned, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import isotipoUrl from '../../assets/branding/novahub-isotipo.png';
import mapUrl from '../../../maps/diseñoui_mapas_freelancers.html?url';

export function FuerzaComercialPage({ activeSubModule }: { activeSubModule?: string; onSubModuleChange?: (value: string) => void }) {
  const { user, hasAccess, canPerform } = useAuth();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const routeImportInputRef = useRef<HTMLInputElement>(null);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [mapConfig, setMapConfig] = useState<{ mapProvider?: string; mapSearchMode?: string; mapTileUrl?: string | null; mapGeocoderUrl?: string | null } | null>(null);
  const isSuperAdmin = user?.role === 'superadmin';
  const normalizedRole = String(user?.role || '').toUpperCase();
  const canAssignTeam = isSuperAdmin || ['SUPER_ADMIN', 'SUPERADMIN', 'PLATFORM_ADMIN', 'PARTNER', 'ADMIN', 'MANAGER'].includes(normalizedRole) || Boolean((user as any)?.isTenantAdmin) || Boolean((user as any)?.managerContext?.canEdit);
  const isAuthorizedUser = Boolean(user) && hasAccess('fuerza-comercial');
  const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://backenderpnh.onrender.com/api' : 'http://localhost:3000/api');
  const googleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const googleMapsMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';
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
    void api.get<any>('/force-sales/config').then((configuration) => {
      if (!cancelled) setMapConfig(configuration || {});
    }).catch(() => {
      if (!cancelled) setMapConfig({});
    });
    return () => { cancelled = true; };
  }, [isAuthorizedUser, user?.clientTenantId]);

  const mapProvider = String(mapConfig?.mapProvider || 'GOOGLE').toUpperCase();
  const mapSearchMode = String(mapConfig?.mapSearchMode || 'EXTERNAL').toUpperCase();
  const mapSrc = `${mapUrl}${mapUrl.includes('?') ? '&' : '?'}api=${encodeURIComponent(apiBase)}&isotipo=${encodeURIComponent(tenantLogo)}&companyLogo=${encodeURIComponent(tenantLogo)}&view=${view}&userId=${encodeURIComponent(user?.id || '')}&tenantId=${encodeURIComponent(user?.clientTenantId || '')}&platformAdmin=${isSuperAdmin ? 'true' : 'false'}&canAssignTeam=${canAssignTeam ? 'true' : 'false'}&permissions=${encodeURIComponent(JSON.stringify(workflowPermissions))}&mapId=${encodeURIComponent(googleMapsMapId)}&mapProvider=${encodeURIComponent(mapProvider)}&mapSearchMode=${encodeURIComponent(mapSearchMode)}${mapConfig?.mapTileUrl ? `&mapTileUrl=${encodeURIComponent(mapConfig.mapTileUrl)}` : ''}${mapConfig?.mapGeocoderUrl ? `&mapGeocoderUrl=${encodeURIComponent(mapConfig.mapGeocoderUrl)}` : ''}${googleMapsKey ? `&mapsKey=${encodeURIComponent(googleMapsKey)}` : ''}`;

  useEffect(() => {
    const onMapMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.source !== 'novahub-force-sales') return;
      if (event.data?.type === 'fullscreen') setMapFullscreen(Boolean(event.data.active));
      if (event.data?.type === 'configuration-updated') setMapConfig(event.data.configuration || {});
      if (event.data?.type === 'request-import-file') routeImportInputRef.current?.click();
    };
    window.addEventListener('message', onMapMessage);
    return () => window.removeEventListener('message', onMapMessage);
  }, []);

  useEffect(() => {
    setMapFullscreen(false);
  }, [activeSubModule]);

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
    <section className={mapFullscreen ? 'fixed inset-0 z-[100] h-[100dvh] min-h-0 overflow-hidden bg-[#e8f0ed]' : 'relative h-[calc(100dvh-4rem)] min-h-0 overflow-hidden bg-[#e8f0ed]'}>
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
