import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import * as Sentry from '@sentry/react';
import { Toaster } from './components/ui/sonner';
import { useAuth, type Module } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { ImpersonationProvider, useImpersonation } from './contexts/ImpersonationContext';
import { LoginPage } from './components/LoginPage';
import { BrandLogoLoader } from './components/BrandLogo';
import { RegisterTenantPage } from './components/auth/RegisterTenantPage';
import LandingPage from './components/LandingPage';
import ModulosLandingPage from './components/ModulosLandingPage';
import { TrialExpiredPage } from './components/auth/TrialExpiredPage';
import { SessionClosedPage } from './components/auth/SessionClosedPage';
import { SessionMonitor } from './components/auth/SessionMonitor';
import { PLATFORM_SIDEBAR_MODULE_ORDER, SIDEBAR_MODULE_ORDER, Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ModuleErrorBoundary } from './components/ui/ModuleErrorBoundary';
import { ActionClickGuard } from './components/ui/ActionClickGuard';
import { useIncomingNotificationAlert } from './hooks/useIncomingNotificationAlert';
import { BrowserNotificationPrompt } from './components/notificaciones/BrowserNotificationPrompt';
import { CheckinPromptHost } from './components/seguimiento/CheckinPromptHost';
import { AutoAttendanceEntry } from './components/seguimiento/AutoAttendanceEntry';
import { JornadaWidget } from './components/seguimiento/JornadaWidget';
import { safeGetItem, safeSetItem, safeRemoveItem } from './services/safe-storage';
import { clearClientCaches, isDynamicImportLoadError, loadModuleWithChunkRecovery } from './utils/chunk-recovery';
import { currentBuildId, fetchLatestBuildId } from './utils/app-version';
import { AppUpdateBanner } from './components/ui/AppUpdateBanner';
import { reportChunkLoadIncident } from './utils/chunk-telemetry';
import { readPersistedDarkMode } from './utils/theme-mode';
import { useResponsiveNativeTables } from './hooks/useResponsiveNativeTables';
import { HIDDEN_DEFERRED_SALES_VIEW_IDS, SIDEBAR_SUBMENU_MODULE_REQUIREMENTS, SIDEBAR_SUBMENU_PERMISSION_MODULES } from './utils/sidebarPermissions';
import { GUIDED_TOUR_REQUEST_EVENT, type GuidedTourRequestResult } from './services/guided-tour.service';
import { ForceSalesTrackingRuntime } from './components/ForceSalesTrackingRuntime';
import { ForceSalesOfflineTrackingFallback } from './components/ForceSalesOfflineTrackingFallback';
import { getOfflineRouteEligibility } from './services/force-sales-location-queue';
import { NovaHubLogo } from './components/NovaHubLogo';

function lazyWithChunkRecovery<T extends { default: React.ComponentType<any> }>(loader: () => Promise<T>, moduleName: string) {
  return lazy(() => loadModuleWithChunkRecovery(loader, moduleName, reportChunkLoadIncident));
}

const OverviewDashboard = lazyWithChunkRecovery(() => import('./components/OverviewDashboard').then(m => ({ default: m.OverviewDashboard })), 'dashboard');
const PublicAccessPage = lazyWithChunkRecovery(() => import('./components/public/PublicAccessPage').then(m => ({ default: m.PublicAccessPage })), 'public-access');
const PublicRsvpPage = lazyWithChunkRecovery(() => import('./components/public/PublicRsvpPage').then(m => ({ default: m.PublicRsvpPage })), 'public-rsvp');
const PublicRestaurantMenuPage = lazyWithChunkRecovery(() => import('./components/public/PublicRestaurantMenuPage').then(m => ({ default: m.PublicRestaurantMenuPage })), 'public-restaurant-menu');
const PublicHotelGuestPage = lazyWithChunkRecovery(() => import('./components/public/PublicHotelGuestPage').then(m => ({ default: m.PublicHotelGuestPage })), 'public-hotel-guest');
const ArcaSupplyEcommercePreviewPage = lazyWithChunkRecovery(() => import('./components/public/ArcaSupplyEcommercePreviewPage').then(m => ({ default: m.ArcaSupplyEcommercePreviewPage })), 'public-ecommerce-preview');
const PublicTrackingPage = lazyWithChunkRecovery(() => import('./components/public/PublicTrackingPage').then(m => ({ default: m.PublicTrackingPage })), 'public-tracking');
const PoketPaymentCallbackPage = lazyWithChunkRecovery(() => import('./components/public/PoketPaymentCallbackPage').then(m => ({ default: m.PoketPaymentCallbackPage })), 'public-payment-callback');
const PublicProjectProgressPage = lazyWithChunkRecovery(() => import('./components/public/PublicProjectProgressPage').then(m => ({ default: m.PublicProjectProgressPage })), 'public-project-progress');
const PublicContractSignPage = lazyWithChunkRecovery(() => import('./components/public/PublicContractSignPage').then(m => ({ default: m.PublicContractSignPage })), 'public-contract-sign');
const PublicSupplierQuotationPage = lazyWithChunkRecovery(() => import('./components/public/PublicSupplierQuotationPage').then(m => ({ default: m.PublicSupplierQuotationPage })), 'public-supplier-quotation');
const FloatingChat = lazyWithChunkRecovery(() => import('./components/ai/FloatingChat').then(m => ({ default: m.FloatingChat })), 'floating-chat');
const PartnerDashboard = lazyWithChunkRecovery(() => import('./components/PartnerDashboard').then(m => ({ default: m.PartnerDashboard })), 'partner');
const InventarioPage = lazyWithChunkRecovery(async () => {
  const module = await import('./components/InventarioPage');
  const component = (module as any).default || module.InventarioPage;
  if (!component) throw new Error('El módulo de Inventario no exportó un componente válido.');
  return { default: component };
}, 'inventario');
const VentasPage = lazyWithChunkRecovery(() => import('./components/VentasPage').then(m => ({ default: m.VentasPage })), 'ventas');
const RestaurantePage = lazyWithChunkRecovery(() => import('./components/RestaurantePage').then(m => ({ default: m.RestaurantePage })), 'restaurante');
const HospedajePage = lazyWithChunkRecovery(() => import('./components/HospedajePage').then(m => ({ default: m.HospedajePage })), 'hospedaje');
const TrackingPage = lazyWithChunkRecovery(() => import('./components/TrackingPage').then(m => ({ default: m.TrackingPage })), 'tracking');
const IntlImportsPage = lazyWithChunkRecovery(() => import('./components/intl-imports/IntlImportsPage').then(m => ({ default: m.IntlImportsPage })), 'intl-imports');
const ComprasPage = lazyWithChunkRecovery(() => import('./components/ComprasPage').then(m => ({ default: m.ComprasPage })), 'compras');
const FinanzasPage = lazyWithChunkRecovery(() => import('./components/FinanzasPage').then(m => ({ default: m.FinanzasPage })), 'finanzas');
const RecursosHumanosPage = lazyWithChunkRecovery(() => import('./components/RecursosHumanosPage').then(m => ({ default: m.RecursosHumanosPage })), 'rh');
const ClientesPage = lazyWithChunkRecovery(() => import('./components/ClientesPage').then(m => ({ default: m.ClientesPage })), 'clientes');
const ProveedoresPage = lazyWithChunkRecovery(() => import('./components/ProveedoresPage').then(m => ({ default: m.ProveedoresPage })), 'proveedores');
const ActividadesPage = lazyWithChunkRecovery(() => import('./components/ActividadesPage').then(m => ({ default: m.ActividadesPage })), 'actividades');
const OrganizacionPage = lazyWithChunkRecovery(() => import('./components/organizacion/OrganizacionPage').then(m => ({ default: m.OrganizacionPage })), 'organizacion');
const MarketingPage = lazyWithChunkRecovery(() => import('./components/marketing/MarketingPage').then(m => ({ default: m.MarketingPage })), 'marketing');
const AsanaPage = lazyWithChunkRecovery(() => import('./components/AsanaPage').then(m => ({ default: m.AsanaPage })), 'asana');
const ProyectosPage = lazyWithChunkRecovery(() => import('./components/ProyectosPage').then(m => ({ default: m.ProyectosPage })), 'proyectos');
const FuerzaComercialPage = lazyWithChunkRecovery(() => import('./components/FuerzaComercialPage').then(m => ({ default: m.FuerzaComercialPage })), 'fuerza-comercial');
const ForceSalesReportsView = lazyWithChunkRecovery(() => import('./components/force-sales/ForceSalesReportsView').then(m => ({ default: m.ForceSalesReportsView })), 'force-sales-reports');
const TicketsPage = lazyWithChunkRecovery(() => import('./components/TicketsPage').then(m => ({ default: m.TicketsPage })), 'tickets');
const DocumentosPage = lazyWithChunkRecovery(() => import('./components/DocumentosPage').then(m => ({ default: m.DocumentosPage })), 'documentos');
const NotificacionesPage = lazyWithChunkRecovery(() => import('./components/NotificacionesPage').then(m => ({ default: m.NotificacionesPage })), 'notificaciones');
const ReportesPage = lazyWithChunkRecovery(() => import('./components/ReportesPage').then(m => ({ default: m.ReportesPage })), 'reportes');
const ConfiguracionPage = lazyWithChunkRecovery(() => import('./components/ConfiguracionPage').then(m => ({ default: m.ConfiguracionPage })), 'configuracion');
const AuditWorkspacePage = lazyWithChunkRecovery(() => import('./components/AuditWorkspacePage').then(m => ({ default: m.AuditWorkspacePage })), 'audit-workspace');
const SuscripcionesPage = lazyWithChunkRecovery(() => import('./components/SuscripcionesPage').then(m => ({ default: m.SuscripcionesPage })), 'suscripciones');
const PrismaSchemaPage = lazyWithChunkRecovery(() => import('./components/PrismaSchemaPage').then(m => ({ default: m.PrismaSchemaPage })), 'schema');
const FinanciamientoPymePage = lazyWithChunkRecovery(() => import('./components/FinanciamientoPymePage').then(m => ({ default: m.FinanciamientoPymePage })), 'financiamiento');
const AsesoriaLegalPage = lazyWithChunkRecovery(() => import('./components/AsesoriaLegalPage').then(m => ({ default: m.AsesoriaLegalPage })), 'asesoria');
const NovaChatView = lazyWithChunkRecovery(() => import('./components/novachat/NovaChatView').then(m => ({ default: m.NovaChatView })), 'novachat');
const TrainingHubView = lazyWithChunkRecovery(() => import('./components/help/TrainingHubView').then(m => ({ default: m.TrainingHubView })), 'training');
const SoporteTecnicoView = lazyWithChunkRecovery(() => import('./components/help/SoporteTecnicoView').then(m => ({ default: m.SoporteTecnicoView })), 'support');
const SoporteTecnicoAdminView = lazyWithChunkRecovery(() => import('./components/help/SoporteTecnicoAdminView').then(m => ({ default: m.SoporteTecnicoAdminView })), 'support-admin');
const ContabilidadPage = lazyWithChunkRecovery(() => import('./components/contabilidad/ContabilidadPage').then(m => ({ default: m.ContabilidadPage })), 'contabilidad');
const QaConsoleView = lazyWithChunkRecovery(() => import('./components/qa/QaConsoleView').then(m => ({ default: m.QaConsoleView })), 'qa');
const ManagerPage = lazyWithChunkRecovery(() => import('./components/ManagerPage').then(m => ({ default: m.ManagerPage })), 'manager');
const EnterpriseGroupsAdminView = lazyWithChunkRecovery(() => import('./components/admin/EnterpriseGroupsAdminView').then(m => ({ default: m.EnterpriseGroupsAdminView })), 'enterprise-groups');
const PlatformUsersView = lazyWithChunkRecovery(() => import('./components/admin/PlatformUsersView').then(m => ({ default: m.PlatformUsersView })), 'platform-users');
const ImplementationGuideView = lazyWithChunkRecovery(() => import('./components/admin/ImplementationGuideView').then(m => ({ default: m.ImplementationGuideView })), 'implementation-guide');
const CustomerPortalPage = lazyWithChunkRecovery(() => import('./components/customer-portal/CustomerPortalPage').then(m => ({ default: m.CustomerPortalPage })), 'customer-portal');
const PlatformSupportWorkspace = lazyWithChunkRecovery(() => import('./components/help/PlatformSupportWorkspace').then(m => ({ default: m.PlatformSupportWorkspace })), 'platform-support');

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Cargando...</p>
      </div>
    </div>
  );
}

type DeferredChatRequest = { message?: string; context?: { source?: string; periodFrom?: string; periodTo?: string } };

function ChatLauncherButton({ onClick, loading = false }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={loading ? 'Cargando Nova AI' : 'Abrir Nova AI'}
      aria-busy={loading}
      title="Preguntar a Nova"
      className="group fixed bottom-4 right-3 z-[9000] flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary via-primary to-emerald-600 text-primary-foreground shadow-2xl shadow-primary/40 ring-4 ring-primary/15 transition-[transform,box-shadow] hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 disabled:cursor-wait sm:bottom-6 sm:right-4 sm:size-12"
    >
      <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-emerald-300" />
      <NovaHubLogo size={25} className="rounded-full bg-white p-1" />
    </button>
  );
}

function DeferredFloatingChat() {
  const { user } = useAuth();
  const userId = user?.id || user?.email || 'user';
  const tenantId = user?.clientTenantId || user?.tenantId || 'current';
  const openStorageKey = `erp-nova-ai-open.${tenantId}.${userId}`;
  const [loaded, setLoaded] = useState(() => safeGetItem(openStorageKey) === 'true');
  const [initiallyOpen, setInitiallyOpen] = useState(() => safeGetItem(openStorageKey) === 'true');
  const [initialRequest, setInitialRequest] = useState<DeferredChatRequest | null>(null);

  useEffect(() => {
    const savedOpen = safeGetItem(openStorageKey) === 'true';
    setLoaded(savedOpen);
    setInitiallyOpen(savedOpen);
    setInitialRequest(null);
  }, [openStorageKey]);

  useEffect(() => {
    if (loaded) return undefined;
    const handleOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<DeferredChatRequest>).detail || {};
      setInitialRequest(detail);
      setInitiallyOpen(true);
      setLoaded(true);
    };
    window.addEventListener('open-erp-chat', handleOpenRequest);
    return () => window.removeEventListener('open-erp-chat', handleOpenRequest);
  }, [loaded]);

  if (!loaded) {
    return <ChatLauncherButton onClick={() => { setInitiallyOpen(true); setLoaded(true); }} />;
  }

  return (
    <Suspense fallback={<ChatLauncherButton onClick={() => undefined} loading />}>
      <FloatingChat initiallyOpen={initiallyOpen} initialRequest={initialRequest} />
    </Suspense>
  );
}

const CLIENT_RECOVERY_QUERY = '__client_recovery';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || 'Error desconocido');
}

const CHUNK_ERROR_POLL_MS = 15_000;

const ErrorBoundaryFallback = ({
  error,
  eventId,
}: {
  error: unknown;
  componentStack: string;
  eventId: string;
  resetError(): void;
}) => {
  const message = errorMessage(error);
  const isStaleVersion = isDynamicImportLoadError(error);
  const [recovering, setRecovering] = React.useState(false);

  const reloadFreshDocument = React.useCallback((unregisterWorkers: boolean) => {
    setRecovering(true);
    void clearClientCaches({ unregisterWorkers }).then(() => {
      const url = new URL(window.location.href);
      url.searchParams.set(CLIENT_RECOVERY_QUERY, String(Date.now()));
      window.location.replace(url.toString());
    });
  }, []);

  const handleRecovery = () => reloadFreshDocument(true);

  // Un módulo que no se encuentra casi siempre significa que la pestaña quedó con una versión anterior a un
  // despliegue. Si ya hay una versión nueva publicada se carga sola, sin esperar a que el usuario pulse el botón.
  React.useEffect(() => {
    if (!isStaleVersion) return undefined;
    let cancelled = false;
    const check = async () => {
      const latest = await fetchLatestBuildId();
      if (cancelled || !latest || latest === currentBuildId()) return;
      reloadFreshDocument(false);
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, CHUNK_ERROR_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isStaleVersion, reloadFreshDocument]);

  return (
    <div style={{ padding: 32, fontFamily: 'monospace', background: '#0f0f0f', color: '#ff6b6b', minHeight: '100vh' }}>
      <h2 style={{ color: '#ff6b6b', marginBottom: 16 }}>
        {isStaleVersion ? 'NovaHub se actualizó' : 'No pudimos cargar esta pantalla'}
      </h2>
      <p style={{ color: '#d1d5db', maxWidth: 560, lineHeight: 1.6 }}>
        {isStaleVersion
          ? 'Esta pestaña tenía una versión anterior. Estamos buscando la versión nueva y se cargará sola; si tarda, pulsa el botón. No pierdes tu sesión.'
          : 'El incidente fue registrado automáticamente. Puedes limpiar la caché del dispositivo y cargar la versión actual una sola vez.'}
      </p>
      <button
        style={{ marginTop: 16, padding: '8px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: recovering ? 'wait' : 'pointer' }}
        onClick={handleRecovery}
        disabled={recovering}
      >
        {recovering ? 'Actualizando…' : 'Limpiar caché y recargar'}
      </button>
      <details style={{ marginTop: 20, color: '#9ca3af', maxWidth: 720 }}>
        <summary style={{ cursor: 'pointer' }}>Detalles para soporte</summary>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{`Evento: ${eventId || 'no disponible'}\n${message}`}</pre>
      </details>
    </div>
  );
};


function DashboardLayout() {
  const { hasAccess, canPerform, sessionStartVersion, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState<Module | 'overview'>(() => {
    if (sessionStartVersion > 0) return 'overview';
    const urlModule = searchParams.get('m');
    if (urlModule) {
      if (urlModule === 'roles') return 'suscripciones';
      if (urlModule === 'dashboard-cxc') return 'overview';
      return (urlModule as Module | 'overview') || 'overview';
    }
    const storedModule = safeGetItem('erp-active-module');
    if (storedModule === 'roles') return 'suscripciones';
    if (storedModule === 'dashboard-cxc') return 'overview';
    return (storedModule as Module | 'overview') || 'overview';
  });
  const [activeSubModule, setActiveSubModule] = useState<string | undefined>(() => {
    if (sessionStartVersion > 0) return undefined;
    const urlSubModule = searchParams.get('sm');
    if (urlSubModule) return urlSubModule === 'dashboard' ? 'productos' : urlSubModule;
    const storedSubModule = safeGetItem('erp-active-submodule');
    return storedSubModule === 'dashboard' ? 'productos' : (storedSubModule || undefined);
  });

  useEffect(() => {
    safeSetItem('erp-active-module', activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (activeSubModule) {
      safeSetItem('erp-active-submodule', activeSubModule);
    } else {
      safeRemoveItem('erp-active-submodule');
    }
  }, [activeSubModule]);

  // Sincronizar estado de navegación con la URL (?m=ventas&sm=facturas).
  // - Cambio de módulo desde la UI: hace push (historial), el botón "atrás" vuelve al módulo previo.
  // - Cambio de submodulo: solo reemplaza la entrada actual para no llenar el historial con tabs.
  const lastModuleRef = React.useRef<Module | 'overview'>(activeModule);
  const skipInitialUrlNavigationRef = React.useRef(sessionStartVersion > 0);

  const isAuthorizedSubmodule = (module: string | undefined, subModule: string | undefined) => {
    if (!module || !subModule) return true;
    if (HIDDEN_DEFERRED_SALES_VIEW_IDS.has(subModule)) return false;
    if (module === 'restaurante' && subModule === 'configuracion') {
      return Boolean(user?.isTenantAdmin || user?.isPlatformAdmin) && canPerform('RESTAURANT', 'view');
    }
    const requiredModules = SIDEBAR_SUBMENU_MODULE_REQUIREMENTS[`${module}:${subModule}`]
      || SIDEBAR_SUBMENU_MODULE_REQUIREMENTS[subModule];
    // Internal tabs and one-off context values are validated by their own
    // view. Known sidebar entries must, however, be authorized here too so a
    // crafted URL/event cannot open a tab hidden from the role.
    if (!requiredModules) return true;
    const permissionModules = SIDEBAR_SUBMENU_PERMISSION_MODULES[`${module}:${subModule}`]
      || SIDEBAR_SUBMENU_PERMISSION_MODULES[subModule]
      || requiredModules;
    const hasExplicitViewPermission = permissionModules.some((permissionModule) =>
      user?.permissions?.some((permission) => String(permission.module || '').toUpperCase() === permissionModule.toUpperCase()),
    );
    return hasExplicitViewPermission
      ? permissionModules.some((permissionModule) =>
        user?.permissions?.some((permission) => String(permission.module || '').toUpperCase() === permissionModule.toUpperCase())
          && canPerform(permissionModule, 'view'),
      )
      : permissionModules.some((permissionModule) => canPerform(permissionModule, 'view'));
  };

  const normalizeIncomingSubmodule = (module: string | undefined, subModule: string | undefined) => {
    const normalized = subModule === 'dashboard' ? 'productos' : subModule;
    return isAuthorizedSubmodule(module, normalized) ? normalized : undefined;
  };

  useEffect(() => {
    // Al iniciar una sesión nueva, AuthContext ya limpió la URL. El objeto
    // searchParams de este primer render puede todavía contener la ruta de la
    // sesión anterior; no debemos restaurarla en el estado local.
    if (skipInitialUrlNavigationRef.current) {
      skipInitialUrlNavigationRef.current = false;
      return;
    }

    const urlModule = searchParams.get('m');
    const urlSubModule = searchParams.get('sm');
    if (!urlModule && !urlSubModule) return;
    const nextModule = urlModule === 'roles' ? 'suscripciones' : urlModule === 'dashboard-cxc' ? 'overview' : ((urlModule as Module | 'overview') || 'overview');
    // The URL is an external navigation source; synchronize local state only
    // when it actually differs from the current view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (nextModule !== activeModule) setActiveModule(nextModule);
    const nextSubModule = normalizeIncomingSubmodule(nextModule, urlSubModule || undefined);
    if (nextSubModule !== activeSubModule) setActiveSubModule(nextSubModule);
  }, [searchParams, canPerform]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeModule && activeModule !== 'overview') {
      params.set('m', activeModule);
    } else {
      params.delete('m');
    }
    if (activeSubModule) {
      params.set('sm', activeSubModule);
    } else {
      params.delete('sm');
    }
    const next = params.toString();
    const current = searchParams.toString();
    if (next === current) return;
    const moduleChanged = lastModuleRef.current !== activeModule;
    lastModuleRef.current = activeModule;
    setSearchParams(params, { replace: !moduleChanged });
  }, [activeModule, activeSubModule]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return safeGetItem('erp-sidebar-collapsed') === 'true';
  });

  const mainRef = useRef<HTMLElement | null>(null);
  const mainScrollStorageKey = `erp-scroll-position:${user?.id || 'anonymous'}:${activeModule}:${activeSubModule || ''}`;

  useEffect(() => {
    const isVisibleGuideTrigger = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0
        && !element.closest('[aria-hidden="true"]')
        && !element.closest('[data-state="closed"]')
        && !element.closest('[data-nova-ai-chat]');
    };

    const handleGuidedTourRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ respond?: (result: GuidedTourRequestResult) => void }>).detail;
      const candidates = Array.from(document.querySelectorAll<HTMLElement>([
        '[data-tutorial-trigger="true"]',
        'button[aria-label*="Cómo"]',
        'button[title*="Cómo"]',
        'button[aria-label*="tutorial"]',
        'button[title*="tutorial"]',
      ].join(','))).filter(isVisibleGuideTrigger);
      // Prefer the guide inside the active dialog. This matters for full-page
      // forms such as product creation, where the underlying list is still
      // mounted and can also contain a help trigger.
      const trigger = candidates.filter((element) => element.closest('[role="dialog"]')).at(-1) || candidates[0];
      if (!trigger) {
        detail?.respond?.({ started: false });
        return;
      }

      trigger.focus({ preventScroll: true });
      trigger.click();
      detail?.respond?.({
        started: true,
        label: trigger.getAttribute('aria-label') || trigger.getAttribute('title') || undefined,
      });
    };

    window.addEventListener(GUIDED_TOUR_REQUEST_EVENT, handleGuidedTourRequest);
    return () => window.removeEventListener(GUIDED_TOUR_REQUEST_EVENT, handleGuidedTourRequest);
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const isMessagesScrollLocked = () => Boolean(main.querySelector('[data-message-scroll-layout="contained"]'));

    const initialSaved = Number(safeGetItem(mainScrollStorageKey) || 0);
    let restorePending = Number.isFinite(initialSaved) && initialSaved > 0;
    let userInteracted = false;
    let saveFrame = 0;

    const restoreScrollPosition = () => {
      if (isMessagesScrollLocked()) {
        main.scrollTop = 0;
        restorePending = false;
        return;
      }
      if (!restorePending || userInteracted) return;

      // Read again because the authenticated user and the POS view can finish
      // initializing after this shell effect has already mounted.
      const saved = Number(safeGetItem(mainScrollStorageKey) || 0);
      const savedScrollTop = Number.isFinite(saved) && saved > 0 ? saved : 0;
      if (savedScrollTop === 0) {
        restorePending = false;
        return;
      }

      const maxScrollTop = Math.max(0, main.scrollHeight - main.clientHeight);
      // Wait until the view has content instead of replacing a saved position
      // with zero while API data is still loading. If the current view is
      // shorter than before, land at its last possible position and keep the
      // original target until the view grows again.
      if (maxScrollTop <= 0) return;
      main.scrollTop = Math.min(savedScrollTop, maxScrollTop);
      if (maxScrollTop >= savedScrollTop) restorePending = false;
    };

    const saveScrollPosition = () => {
      if (isMessagesScrollLocked()) return;
      if (saveFrame) return;
      saveFrame = window.requestAnimationFrame(() => {
        saveFrame = 0;
        if (!restorePending) safeSetItem(mainScrollStorageKey, String(main.scrollTop));
      });
    };

    const markUserInteraction = () => {
      userInteracted = true;
      restorePending = false;
    };

    main.addEventListener('scroll', saveScrollPosition, { passive: true });
    main.addEventListener('wheel', markUserInteraction, { passive: true });
    main.addEventListener('touchstart', markUserInteraction, { passive: true });
    main.addEventListener('pointerdown', markUserInteraction, { passive: true });
    main.addEventListener('keydown', markUserInteraction);
    restoreScrollPosition();
    const restoreTimers = [50, 150, 350, 700, 1200, 2000, 3500, 5000, 8000].map((delay) => window.setTimeout(restoreScrollPosition, delay));
    const mutationObserver = typeof MutationObserver !== 'undefined'
      ? new MutationObserver(restoreScrollPosition)
      : null;
    mutationObserver?.observe(main, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-message-scroll-layout'],
    });

    return () => {
      main.removeEventListener('scroll', saveScrollPosition);
      main.removeEventListener('wheel', markUserInteraction);
      main.removeEventListener('touchstart', markUserInteraction);
      main.removeEventListener('pointerdown', markUserInteraction);
      main.removeEventListener('keydown', markUserInteraction);
      restoreTimers.forEach((timer) => window.clearTimeout(timer));
      mutationObserver?.disconnect();
      if (saveFrame) window.cancelAnimationFrame(saveFrame);
      if (!restorePending) safeSetItem(mainScrollStorageKey, String(main.scrollTop));
    };
  }, [mainScrollStorageKey]);

  useEffect(() => {
    const handleImportPreviewOpened = () => {
      setIsCollapsed(true);
      safeSetItem('erp-sidebar-collapsed', 'true');
    };
    window.addEventListener('erp-import-preview-opened', handleImportPreviewOpened);
    return () => window.removeEventListener('erp-import-preview-opened', handleImportPreviewOpened);
  }, []);

  const handleToggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    safeSetItem('erp-sidebar-collapsed', String(newVal));
  };

  const handleModuleChange = (module: Module, subModule?: string) => {
    const targetModule = module === 'roles' ? 'suscripciones' : module;
    const safeSubModule = normalizeIncomingSubmodule(targetModule, subModule);
    if (hasAccess(targetModule) && (subModule === undefined || safeSubModule !== undefined)) {
      setActiveModule(targetModule);
      setActiveSubModule(module === 'inventario'
        ? (safeSubModule || (isAuthorizedSubmodule(targetModule, 'productos') ? 'productos' : undefined))
        : safeSubModule);
    }
  };

  const handleNavigate = (module: Module) => {
    setActiveModule(module === 'roles' ? 'suscripciones' : module);
    setActiveSubModule(undefined);
    setSidebarOpen(false);
  };

  const handleOverview = () => {
    setActiveModule('overview');
    setActiveSubModule(undefined);
  };

  const currentModule: Module | 'overview' = (() => {
    if (activeModule === 'overview') {
      if (hasAccess('dashboard')) return 'overview';
    } else if (hasAccess(activeModule as Module)) {
      return activeModule;
    }
    const preferredOrder = user?.isPlatformAdmin
      ? PLATFORM_SIDEBAR_MODULE_ORDER
      : SIDEBAR_MODULE_ORDER;
    return preferredOrder.find((module) => (
      module === 'overview' ? hasAccess('dashboard') : hasAccess(module)
    )) ?? activeModule;
  })();

  useEffect(() => {
    const handler = (e: any) => {
      const detail = e.detail || {};
      const targetModule = detail.module === 'roles' ? 'suscripciones' : detail.module;
      const allowed = targetModule === 'overview' ? hasAccess('dashboard') : hasAccess(targetModule);
      const safeSubModule = normalizeIncomingSubmodule(targetModule, detail.subModule);
      if (allowed && (detail.subModule === undefined || safeSubModule !== undefined)) {
        setActiveModule(targetModule);
        setActiveSubModule(safeSubModule);

        // Si la notificación viene desde otro módulo, la vista destino todavía
        // no existía cuando se disparó el evento original. Reproducimos una
        // sola vez el contexto después del render para que pueda enfocar el
        // registro exacto (factura, comanda, producto, etc.).
        const targetKeys = ['targetId', 'invoiceId', 'orderId', 'creditNoteId', 'taskId', 'reminderId', 'eventId', 'requestId', 'queueId', 'sessionId', 'productId', 'expenseId', 'holdId'];
        const hasTarget = targetKeys.some((key) => Boolean(detail[key]));
        if (hasTarget && !detail.__replayed && targetModule !== currentModule) {
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent('navigate-module', {
              detail: { ...detail, __replayed: true },
            }));
          }, 0);
        }
      }
    };
    const subHandler = (e: any) => {
      const subModule = e.detail?.subModule;
      const safeSubModule = normalizeIncomingSubmodule(String(activeModule), subModule);
      if (safeSubModule) setActiveSubModule(safeSubModule);
    };
    window.addEventListener('navigate-module', handler);
    window.addEventListener('navigate-submodule', subHandler);
    return () => {
      window.removeEventListener('navigate-module', handler);
      window.removeEventListener('navigate-submodule', subHandler);
    };
  }, [activeModule, canPerform, currentModule, hasAccess]);

  const renderContent = () => {
    if (currentModule === 'overview') {
      if (user?.role === 'partner') {
        return <PartnerDashboard onNavigate={handleNavigate} />;
      }
      return <ModuleErrorBoundary moduleName="Dashboard"><OverviewDashboard onNavigate={handleNavigate} /></ModuleErrorBoundary>;
    }

    if (!hasAccess(currentModule as Module)) {
      return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Acceso Denegado</h1>
            <p className="mt-2 text-muted-foreground">No tienes permisos para acceder a este modulo</p>
          </div>
        </div>
      );
    }

    switch (currentModule) {
      case 'inventario': return <ModuleErrorBoundary moduleName="Inventario"><InventarioPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'ventas': return <ModuleErrorBoundary moduleName="Ventas"><VentasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'restaurante': return <ModuleErrorBoundary moduleName="Restaurante"><RestaurantePage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'hospedaje': return <ModuleErrorBoundary moduleName="Hotel"><HospedajePage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'tracking': return <ModuleErrorBoundary moduleName="Tracking"><TrackingPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'intl-imports': return <ModuleErrorBoundary moduleName="Importaciones Internacionales"><IntlImportsPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'compras': return <ModuleErrorBoundary moduleName="Compras"><ComprasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'finanzas': return <ModuleErrorBoundary moduleName="Finanzas"><FinanzasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'rh': return <RecursosHumanosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'clientes': return <ClientesPage />;
      case 'proveedores': return <ProveedoresPage />;
      case 'actividades': return <ActividadesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'organizacion': return <ModuleErrorBoundary moduleName="Organización"><OrganizacionPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'marketing': return <ModuleErrorBoundary moduleName="Marketing"><MarketingPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'asana': return <ModuleErrorBoundary moduleName="Asana"><AsanaPage /></ModuleErrorBoundary>;
      case 'proyectos': return <ModuleErrorBoundary moduleName="Proyectos"><ProyectosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'fuerza-comercial': return activeSubModule === 'fuerza-comercial-reportes'
        ? <ModuleErrorBoundary moduleName="Reportes de gestores"><ForceSalesReportsView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>
        : <FuerzaComercialPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'tickets': return <TicketsPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'documentos': return <DocumentosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'notificaciones': return <NotificacionesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'transferencias': return <InventarioPage activeSubModule="transferencias" isSidebarCollapsed={isCollapsed} />;
      case 'reportes': return activeSubModule === 'reportes-gestores-cobro'
        ? <ModuleErrorBoundary moduleName="Reportes de gestores"><ForceSalesReportsView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} reportContext /></ModuleErrorBoundary>
        : <ReportesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'configuracion': return <ModuleErrorBoundary moduleName="Configuración"><ConfiguracionPage initialTab={activeSubModule || 'branding'} onTabChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'auditoria': return <ModuleErrorBoundary moduleName="NovaHub Audit"><AuditWorkspacePage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'suscripciones': return user?.isPlatformAdmin ? <EnterpriseGroupsAdminView initialTab={activeSubModule === 'plan-sucursal' ? 'module-requests' : activeSubModule} onTabChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /> : <SuscripcionesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'platform-users': return user?.role === 'superadmin' ? <PlatformUsersView /> : <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6"><div className="text-center"><h1 className="text-2xl font-semibold tracking-tight">Acceso Denegado</h1><p className="mt-2 text-muted-foreground">No tienes permisos para gestionar usuarios de plataforma</p></div></div>;
      // Alias de compatibilidad para enlaces antiguos: la administración de
      // sucursales ahora vive dentro de Grupos empresariales.
      case 'tenant-admin': return user?.isPlatformAdmin ? <EnterpriseGroupsAdminView initialTab={activeSubModule} onTabChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /> : <SuscripcionesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'schema': return <PrismaSchemaPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} />;
      case 'financiamiento-pyme': return <FinanciamientoPymePage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'centro-capacitacion': return <TrainingHubView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'soporte-tecnico': return user?.isPlatformAdmin ? <SoporteTecnicoAdminView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /> : <SoporteTecnicoView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'contabilidad': return <ContabilidadPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'asesoria-legal': return <AsesoriaLegalPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'novachat': return <NovaChatView />;
      case 'qa-console': return <ModuleErrorBoundary moduleName="Validador QA"><QaConsoleView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'guia-implementacion': return user?.role === 'superadmin' ? <ImplementationGuideView onNavigate={handleNavigate} /> : <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6"><div className="text-center"><h1 className="text-2xl font-semibold tracking-tight">Acceso Denegado</h1><p className="mt-2 text-muted-foreground">No tienes permisos para acceder a esta guía</p></div></div>;
      default: return <ModuleErrorBoundary moduleName="Dashboard"><OverviewDashboard onNavigate={handleNavigate} /></ModuleErrorBoundary>;
    }
  };

  return (
    <div className="fixed inset-0 flex h-dvh w-full min-w-0 overflow-hidden bg-background">
      <Sidebar
        activeModule={currentModule}
        activeSubModule={activeSubModule}
        onModuleChange={handleModuleChange}
        isOpen={sidebarOpen}
        isCollapsed={isCollapsed}
        onClose={() => setSidebarOpen(false)}
        onOverview={handleOverview}
      />
      <ForceSalesTrackingRuntime
        activeModule={String(currentModule)}
        user={user}
        canTrack={hasAccess('fuerza-comercial') && canPerform('FORCE_SALES', 'updatePresence')}
        canHide={canPerform('FORCE_SALES', 'hidePresence')}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onNavigate={handleNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main
          ref={mainRef}
          className={`scrollbar-overlay module-${currentModule} min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto`}
          style={{ overflowAnchor: 'none' }}
        >
          <Suspense fallback={<PageLoader />}>
            <ModuleErrorBoundary moduleName={String(currentModule)}>
              {renderContent()}
            </ModuleErrorBoundary>
          </Suspense>
        </main>
      </div>
      {currentModule !== 'fuerza-comercial' && <DeferredFloatingChat key={`${user?.clientTenantId || user?.tenantId || 'current'}.${user?.id || user?.email || 'user'}`} />}
    </div>
  );
}

function GlobalNotificationAlert() {
  useIncomingNotificationAlert();
  return null;
}

function AppContent() {
  const { isAuthenticated, login, logout, user, sessionStartVersion } = useAuth();
  const { isBrandingReady } = useTheme();
  const { isImpersonating, branch } = useImpersonation();
  const location = useLocation();
  const [trialExpired, setTrialExpired] = useState(false);
  const [sessionClosed, setSessionClosed] = useState<'closed' | 'expired' | 'invalid' | null>(null);
  const [showingSessionBranding, setShowingSessionBranding] = useState(false);
  const lastSessionStartVersion = useRef(0);
  useResponsiveNativeTables();

  useEffect(() => {
    // La recuperación de caché solo debe durar hasta que la aplicación vuelva
    // a montar correctamente. No dejamos el marcador en la URL ni bloqueamos
    // una futura recuperación del mismo dispositivo.
    const url = new URL(window.location.href);
    if (url.searchParams.has(CLIENT_RECOVERY_QUERY)) {
      url.searchParams.delete(CLIENT_RECOVERY_QUERY);
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  useEffect(() => {
    // Native number inputs act as spinners while focused. Keep the wheel for
    // scrolling and make the value change only through an explicit edit. This
    // lives at the application shell so it also covers the manager view and
    // public screens that render native inputs instead of the shared Input.
    const blurNumberInputOnWheel = (event: WheelEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.type === 'number' && document.activeElement === target) {
        target.blur();
      }
    };
    document.addEventListener('wheel', blurNumberInputOnWheel, { capture: true, passive: true });
    return () => document.removeEventListener('wheel', blurNumberInputOnWheel, true);
  }, []);

  useEffect(() => {
    if (!sessionStartVersion || sessionStartVersion === lastSessionStartVersion.current) return;
    lastSessionStartVersion.current = sessionStartVersion;
    setShowingSessionBranding(true);
    const timer = window.setTimeout(() => setShowingSessionBranding(false), 900);
    return () => window.clearTimeout(timer);
  }, [sessionStartVersion]);

  // Never carry transient session guards from one identity into another.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTrialExpired(false);
      setSessionClosed(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sessionStartVersion, user?.id, user?.clientTenantId, user?.userType]);

  // Redirección forzosa por expiración de trial/suscripción.
  // Se valida contra `clientTenant.expiresAt` (datos del servidor vía /auth/profile),
  // no contra flags locales editables. Si el período ya venció, la interfaz se
  // bloquea de inmediato en el panel de "Suscripción Expirada" (el backend además
  // rechaza toda mutación con 403 TRIAL_EXPIRED).
  useEffect(() => {
    if (!isAuthenticated || !user?.clientTenant) return;
    const expiresAt = user.clientTenant.expiresAt ? new Date(user.clientTenant.expiresAt).getTime() : null;
    const isInactive = user.clientTenant.isActive === false;
    if (expiresAt && expiresAt <= Date.now()) {
      // This state is driven by the server-provided tenant expiration, not a
      // local trial flag. Keep the modal behavior unchanged.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTrialExpired(true);
    } else if (isInactive) {
      setTrialExpired(true);
    }
  }, [isAuthenticated, user?.clientTenant?.expiresAt, user?.clientTenant?.isActive]);

  // Un 401/403 de sesión inválida también debe expulsar de la UI (no dejar la
  // interfaz "operativa" con un token muerto). Solo aplica fuera de rutas públicas.
  useEffect(() => {
    const handler = (event: Event) => {
      if (location.pathname === '/register' || location.pathname.startsWith('/public/') || location.pathname.startsWith('/firmar-contrato/')) return;
      // Al iniciar, /auth/profile valida cualquier token guardado. Un 401 en
      // esa comprobación es normal y debe dejar el login disponible, sin iniciar
      // el flujo de cierre de una sesión que todavía no está autenticada.
      if (!isAuthenticated) return;
      const code = (event as CustomEvent).detail?.code;
      setSessionClosed(code === 'SESSION_CLOSED' ? 'closed' : code === 'SESSION_EXPIRED' ? 'expired' : 'invalid');
    };
    window.addEventListener('session-closed', handler);
    return () => window.removeEventListener('session-closed', handler);
  }, [isAuthenticated, location.pathname]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.code === 'TRIAL_EXPIRED') {
        setTrialExpired(true);
      }
    };
    window.addEventListener('trial-expired', handler);
    return () => window.removeEventListener('trial-expired', handler);
  }, []);

  // Al cerrarse la sesión (contador llega a 0), redirigir solo al login.
  useEffect(() => {
    if (!sessionClosed || !isAuthenticated) return;
    const timer = setTimeout(() => {
      safeRemoveItem('nh-auth-token');
      logout?.();
      setSessionClosed(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, sessionClosed, logout]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isAuthenticated && readPersistedDarkMode());
  }, [isAuthenticated]);

  if (location.pathname === '/integrations/poket/callback') return <Suspense fallback={<PageLoader />}><PoketPaymentCallbackPage /></Suspense>;
  if (location.pathname === '/public/tracking' || location.pathname.startsWith('/public/tracking/')) return <Suspense fallback={<PageLoader />}><PublicTrackingPage /></Suspense>;
  if (location.pathname.startsWith('/rsvp/') || location.pathname.startsWith('/public/rsvp/')) return <Suspense fallback={<PageLoader />}><PublicRsvpPage /></Suspense>;
  if (location.pathname.startsWith('/public/document/')) return <Suspense fallback={<PageLoader />}><PublicAccessPage mode="document" /></Suspense>;
  if (location.pathname.startsWith('/public/portal/')) return <Suspense fallback={<PageLoader />}><PublicAccessPage mode="portal" /></Suspense>;
  if (location.pathname.startsWith('/public/project/')) return <Suspense fallback={<PageLoader />}><PublicProjectProgressPage /></Suspense>;
  if (location.pathname.startsWith('/firmar-contrato/')) return <Suspense fallback={<PageLoader />}><PublicContractSignPage /></Suspense>;
  if (location.pathname.startsWith('/public/subquotation/')) return <Suspense fallback={<PageLoader />}><PublicSupplierQuotationPage /></Suspense>;
  if (location.pathname.startsWith('/restaurant/menu/')) {
    const tableToken = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
    return <Suspense fallback={<PageLoader />}><PublicRestaurantMenuPage tableToken={tableToken} /></Suspense>;
  }
  if (location.pathname.startsWith('/hotel/guest/')) {
    const token = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
    return <Suspense fallback={<PageLoader />}><PublicHotelGuestPage token={token} /></Suspense>;
  }
  if (location.pathname === '/preview/arca-supply' || location.pathname === '/ecommerce/arcasupply') {
    return <Suspense fallback={<PageLoader />}><ArcaSupplyEcommercePreviewPage /></Suspense>;
  }

  // Ruta pública de registro: no requiere autenticación y evita el guard.
  if (location.pathname === '/landing') {
    return <LandingPage />;
  }

  if (location.pathname === '/modulos') {
    return <ModulosLandingPage />;
  }

  if (location.pathname === '/register') {
    return <RegisterTenantPage />;
  }

  if (!isAuthenticated) {
    const offlineRouteIdentity = getOfflineRouteEligibility();
    if (offlineRouteIdentity) return <ForceSalesOfflineTrackingFallback identity={offlineRouteIdentity} />;
    return <LoginPage onLogin={login} />;
  }

  const handleGuardLogout = () => {
    safeRemoveItem('nh-auth-token');
    logout?.();
    setSessionClosed(null);
  };

  // La pantalla de trial/sesión es una barrera de presentación. El backend
  // continúa siendo la autoridad y debe rechazar cualquier mutación vencida.
  // No montamos el ERP detrás del guard para no dejarlo accesible al retirar
  // elementos del DOM desde las herramientas del navegador.
  if (sessionClosed) {
    return (
      <>
        <SessionClosedPage mode={sessionClosed} onLogout={handleGuardLogout} />
        <SessionMonitor />
      </>
    );
  }

  if (trialExpired) {
    return (
      <>
        <TrialExpiredPage onLogout={handleGuardLogout} />
        <SessionMonitor />
      </>
    );
  }

  // CUSTOMER_PORTAL entra desde el mismo login, pero nunca monta el shell del
  // ERP. Su única superficie autenticada es la vista de reportes de cliente.
  if (user?.userType === 'customer_portal') {
    return <Suspense fallback={<PageLoader />}><CustomerPortalPage /></Suspense>;
  }

  // La cuenta externa de soporte tiene un shell aislado y nunca monta la
  // navegación ni el dashboard operativo del ERP.
  if (user?.isPlatformSupportAgent) {
    return <><Suspense fallback={<PageLoader />}><PlatformSupportWorkspace /></Suspense><SessionMonitor /></>;
  }

  if (showingSessionBranding || !isBrandingReady) {
    const isBranchManagerBranding = Boolean(isImpersonating && branch);
    const isPlatformBranding = Boolean(user?.isPlatformAdmin) && !isBranchManagerBranding;
    return (
      <BrandLogoLoader
        logo={isBranchManagerBranding ? branch?.logo : isPlatformBranding ? null : (user?.sessionBranding?.logo ?? user?.clientTenant?.logo)}
        title={isBranchManagerBranding ? branch?.name || 'Sucursal' : isPlatformBranding ? 'NovaHub Platform' : (user?.sessionBranding?.name || user?.clientTenant?.name || user?.tenantName || 'NovaHub ERP')}
        kind={isBranchManagerBranding ? 'branch' : isPlatformBranding ? 'platform' : (user?.sessionBranding?.kind || (user?.clientTenant ? 'branch' : 'group'))}
        description="Preparando tu espacio de trabajo…"
      />
    );
  }

  return (
    <>
      <GlobalNotificationAlert />
      <BrowserNotificationPrompt />
      <CheckinPromptHost />
      <AutoAttendanceEntry />
      <JornadaWidget />
      {(user?.userType === 'manager' || user?.role === 'manager') && !user.isPlatformAdmin && !isImpersonating ? (
        <Suspense fallback={<PageLoader />}><ManagerPage key={`manager-${sessionStartVersion}-${user.id}-${user.clientTenantId || user.tenantId}`} /></Suspense>
      ) : <DashboardLayout key={`dashboard-${sessionStartVersion}-${user?.id || 'anonymous'}-${user?.clientTenantId || user?.tenantId || ''}`} />}
      <SessionMonitor />
    </>
  );
}

export default function App() {
  return (
    <>
      <Toaster position="top-right" />
      <AppUpdateBanner />
      <Sentry.ErrorBoundary fallback={ErrorBoundaryFallback}>
        <ThemeProvider>
          <CurrencyProvider>
            <ImpersonationProvider>
              <ActionClickGuard />
              <AppContent />
            </ImpersonationProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </Sentry.ErrorBoundary>
    </>
  );
}
