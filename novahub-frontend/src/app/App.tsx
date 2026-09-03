import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import * as Sentry from '@sentry/react';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth, type Module } from './contexts/AuthContext';
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
import { PublicAccessPage } from './components/public/PublicAccessPage';
import { PublicRestaurantMenuPage } from './components/public/PublicRestaurantMenuPage';
import { ArcaSupplyEcommercePreviewPage } from './components/public/ArcaSupplyEcommercePreviewPage';
import { FloatingChat } from './components/ai/FloatingChat';
import { useIncomingNotificationAlert } from './hooks/useIncomingNotificationAlert';
import { safeGetItem, safeSetItem, safeRemoveItem } from './services/safe-storage';
import { readPersistedDarkMode } from './utils/theme-mode';
import { useResponsiveNativeTables } from './hooks/useResponsiveNativeTables';
import { HIDDEN_DEFERRED_SALES_VIEW_IDS, SIDEBAR_SUBMENU_MODULE_REQUIREMENTS, SIDEBAR_SUBMENU_PERMISSION_MODULES } from './utils/sidebarPermissions';

function recoverFromChunk(moduleName: string) {
  const now = Date.now();
  try {
    const key = `novahub:chunk-recovery:${moduleName}`;
    const previous = Number(sessionStorage.getItem(key) || 0);
    if (previous && now - previous <= 60_000) return;
    sessionStorage.setItem(key, String(now));
  } catch {
    // Private browsing or a disabled storage API must not prevent recovery.
  }
  const url = new URL(window.location.href);
  url.searchParams.set('__asset_recovery', `${moduleName}-${now}`);
  window.location.replace(url.toString());
}

function lazyWithChunkRecovery<T extends { default: React.ComponentType<any> }>(loader: () => Promise<T>, moduleName: string) {
  return lazy(async () => {
    try {
      return await loader();
    } catch (error) {
      recoverFromChunk(moduleName);
      throw error;
    }
  });
}

const OverviewDashboard = lazyWithChunkRecovery(() => import('./components/OverviewDashboard').then(m => ({ default: m.OverviewDashboard })), 'dashboard');
const PartnerDashboard = lazyWithChunkRecovery(() => import('./components/PartnerDashboard').then(m => ({ default: m.PartnerDashboard })), 'partner');
const InventarioPage = lazyWithChunkRecovery(async () => {
  const module = await import('./components/InventarioPage');
  const component = (module as any).default || module.InventarioPage;
  if (!component) throw new Error('El módulo de Inventario no exportó un componente válido.');
  return { default: component };
}, 'inventario');
const VentasPage = lazyWithChunkRecovery(() => import('./components/VentasPage').then(m => ({ default: m.VentasPage })), 'ventas');
const RestaurantePage = lazyWithChunkRecovery(() => import('./components/RestaurantePage').then(m => ({ default: m.RestaurantePage })), 'restaurante');
const ComprasPage = lazyWithChunkRecovery(() => import('./components/ComprasPage').then(m => ({ default: m.ComprasPage })), 'compras');
const FinanzasPage = lazyWithChunkRecovery(() => import('./components/FinanzasPage').then(m => ({ default: m.FinanzasPage })), 'finanzas');
const RecursosHumanosPage = lazyWithChunkRecovery(() => import('./components/RecursosHumanosPage').then(m => ({ default: m.RecursosHumanosPage })), 'rh');
const ClientesPage = lazyWithChunkRecovery(() => import('./components/ClientesPage').then(m => ({ default: m.ClientesPage })), 'clientes');
const ProveedoresPage = lazyWithChunkRecovery(() => import('./components/ProveedoresPage').then(m => ({ default: m.ProveedoresPage })), 'proveedores');
const ActividadesPage = lazyWithChunkRecovery(() => import('./components/ActividadesPage').then(m => ({ default: m.ActividadesPage })), 'actividades');
const ProyectosPage = lazyWithChunkRecovery(() => import('./components/ProyectosPage').then(m => ({ default: m.ProyectosPage })), 'proyectos');
const FuerzaComercialPage = lazyWithChunkRecovery(() => import('./components/FuerzaComercialPage').then(m => ({ default: m.FuerzaComercialPage })), 'fuerza-comercial');
const TicketsPage = lazyWithChunkRecovery(() => import('./components/TicketsPage').then(m => ({ default: m.TicketsPage })), 'tickets');
const DocumentosPage = lazyWithChunkRecovery(() => import('./components/DocumentosPage').then(m => ({ default: m.DocumentosPage })), 'documentos');
const NotificacionesPage = lazyWithChunkRecovery(() => import('./components/NotificacionesPage').then(m => ({ default: m.NotificacionesPage })), 'notificaciones');
const ReportesPage = lazyWithChunkRecovery(() => import('./components/ReportesPage').then(m => ({ default: m.ReportesPage })), 'reportes');
const ConfiguracionPage = lazyWithChunkRecovery(() => import('./components/ConfiguracionPage').then(m => ({ default: m.ConfiguracionPage })), 'configuracion');
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

const ErrorBoundaryFallback = () => (
  <div style={{ padding: 32, fontFamily: 'monospace', background: '#0f0f0f', color: '#ff6b6b', minHeight: '100vh' }}>
    <h2 style={{ color: '#ff6b6b', marginBottom: 16 }}>No pudimos cargar esta pantalla</h2>
    <p style={{ color: '#d1d5db', maxWidth: 560, lineHeight: 1.6 }}>
      El incidente fue registrado automáticamente. Intenta recargar la página; si continúa, comparte la hora del incidente con soporte.
    </p>
    <button
      style={{ marginTop: 16, padding: '8px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      onClick={() => window.location.reload()}
    >
      Recargar
    </button>
  </div>
);


function DashboardLayout() {
  const { hasAccess, canPerform, sessionStartVersion, user } = useAuth();
  useIncomingNotificationAlert();
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
    const requiredModules = SIDEBAR_SUBMENU_MODULE_REQUIREMENTS[`${module}:${subModule}`]
      || SIDEBAR_SUBMENU_MODULE_REQUIREMENTS[subModule];
    // Internal tabs and one-off context values are validated by their own
    // view. Known sidebar entries must, however, be authorized here too so a
    // crafted URL/event cannot open a tab hidden from the role.
    if (!requiredModules) return true;
    const permissionModules = SIDEBAR_SUBMENU_PERMISSION_MODULES[`${module}:${subModule}`]
      || SIDEBAR_SUBMENU_PERMISSION_MODULES[subModule]
      || requiredModules;
    return permissionModules.some((permissionModule) => canPerform(permissionModule, 'view'));
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
    const params = new URLSearchParams();
    if (activeModule && activeModule !== 'overview') {
      params.set('m', activeModule);
    }
    if (activeSubModule) {
      params.set('sm', activeSubModule);
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
    const main = mainRef.current;
    if (!main) return;

    const initialSaved = Number(safeGetItem(mainScrollStorageKey) || 0);
    let restorePending = Number.isFinite(initialSaved) && initialSaved > 0;
    let userInteracted = false;
    let saveFrame = 0;

    const restoreScrollPosition = () => {
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
    mutationObserver?.observe(main, { childList: true, subtree: true });

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
      case 'restaurante': return <ModuleErrorBoundary moduleName="Restaurante"><RestaurantePage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} /></ModuleErrorBoundary>;
      case 'compras': return <ModuleErrorBoundary moduleName="Compras"><ComprasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'finanzas': return <ModuleErrorBoundary moduleName="Finanzas"><FinanzasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'rh': return <RecursosHumanosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'clientes': return <ClientesPage />;
      case 'proveedores': return <ProveedoresPage />;
      case 'actividades': return <ActividadesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'proyectos': return <ModuleErrorBoundary moduleName="Proyectos"><ProyectosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'fuerza-comercial': return <FuerzaComercialPage />;
      case 'tickets': return <TicketsPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'documentos': return <DocumentosPage activeSubModule={activeSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'notificaciones': return <NotificacionesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'transferencias': return <InventarioPage activeSubModule="transferencias" isSidebarCollapsed={isCollapsed} />;
      case 'reportes': return <ReportesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'configuracion': return <ModuleErrorBoundary moduleName="Configuración"><ConfiguracionPage initialTab={activeSubModule || 'branding'} /></ModuleErrorBoundary>;
      case 'suscripciones': return user?.isPlatformAdmin ? <EnterpriseGroupsAdminView /> : <SuscripcionesPage />;
      // Alias de compatibilidad para enlaces antiguos: la administración de
      // sucursales ahora vive dentro de Grupos empresariales.
      case 'tenant-admin': return user?.isPlatformAdmin ? <EnterpriseGroupsAdminView /> : <SuscripcionesPage />;
      case 'schema': return <PrismaSchemaPage />;
      case 'financiamiento-pyme': return <FinanciamientoPymePage />;
      case 'centro-capacitacion': return <TrainingHubView />;
      case 'soporte-tecnico': return user?.isPlatformAdmin ? <SoporteTecnicoAdminView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /> : <SoporteTecnicoView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'contabilidad': return <ContabilidadPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'asesoria-legal': return <AsesoriaLegalPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'novachat': return <NovaChatView />;
      case 'qa-console': return <ModuleErrorBoundary moduleName="Validador QA"><QaConsoleView /></ModuleErrorBoundary>;
      default: return <ModuleErrorBoundary moduleName="Dashboard"><OverviewDashboard onNavigate={handleNavigate} /></ModuleErrorBoundary>;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeModule={currentModule}
        activeSubModule={activeSubModule}
        onModuleChange={handleModuleChange}
        isOpen={sidebarOpen}
        isCollapsed={isCollapsed}
        onClose={() => setSidebarOpen(false)}
        onOverview={handleOverview}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onNavigate={handleNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main
          ref={mainRef}
          className="scrollbar-overlay min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
          style={{ overflowAnchor: 'none' }}
        >
          <Suspense fallback={<PageLoader />}>
            <ModuleErrorBoundary moduleName={String(currentModule)}>
              {renderContent()}
            </ModuleErrorBoundary>
          </Suspense>
        </main>
      </div>
      <Toaster position="top-right" />
      <FloatingChat />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, login, logout, user, sessionStartVersion } = useAuth();
  const { isBrandingReady } = useTheme();
  const { isImpersonating, branch } = useImpersonation();
  const location = useLocation();
  const [trialExpired, setTrialExpired] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const [showingSessionBranding, setShowingSessionBranding] = useState(false);
  const lastSessionStartVersion = useRef(0);
  useResponsiveNativeTables();

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
      setSessionClosed(false);
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
    const handler = () => {
      if (location.pathname === '/register' || location.pathname.startsWith('/public/')) return;
      setSessionClosed(true);
    };
    window.addEventListener('session-closed', handler);
    return () => window.removeEventListener('session-closed', handler);
  }, [location.pathname]);

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
    if (!sessionClosed) return;
    const timer = setTimeout(() => {
      safeRemoveItem('nh-auth-token');
      logout?.();
      window.location.reload();
    }, 4000);
    return () => clearTimeout(timer);
  }, [sessionClosed, logout]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', readPersistedDarkMode());
  }, []);

  if (location.pathname.startsWith('/public/document/')) return <PublicAccessPage mode="document" />;
  if (location.pathname.startsWith('/public/portal/')) return <PublicAccessPage mode="portal" />;
  if (location.pathname.startsWith('/restaurant/menu/')) {
    const tableToken = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
    return <PublicRestaurantMenuPage tableToken={tableToken} />;
  }
  if (location.pathname === '/preview/arca-supply' || location.pathname === '/ecommerce/arcasupply') {
    return <ArcaSupplyEcommercePreviewPage />;
  }

  // Ruta pública de registro: no requiere autenticación y evita el guard.
  if (location.pathname === '/landing') {
    return (
      <>
        <LandingPage />
        <Toaster position="top-right" />
      </>
    );
  }

  if (location.pathname === '/modulos') {
    return <ModulosLandingPage />;
  }

  if (location.pathname === '/register') {
    return (
      <>
        <RegisterTenantPage />
        <Toaster position="top-right" />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={login} />
        <Toaster position="top-right" />
      </>
    );
  }

  const handleGuardLogout = () => {
    safeRemoveItem('nh-auth-token');
    logout?.();
    window.location.reload();
  };

  // La pantalla de trial/sesión es una barrera de presentación. El backend
  // continúa siendo la autoridad y debe rechazar cualquier mutación vencida.
  // No montamos el ERP detrás del guard para no dejarlo accesible al retirar
  // elementos del DOM desde las herramientas del navegador.
  if (sessionClosed) {
    return (
      <>
        <SessionClosedPage onLogout={handleGuardLogout} />
        <SessionMonitor />
        <Toaster position="top-right" />
      </>
    );
  }

  if (trialExpired) {
    return (
      <>
        <TrialExpiredPage onLogout={handleGuardLogout} />
        <SessionMonitor />
        <Toaster position="top-right" />
      </>
    );
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
      {(user?.userType === 'manager' || user?.role === 'manager') && !user.isPlatformAdmin && !isImpersonating ? (
        <Suspense fallback={<PageLoader />}><ManagerPage key={`manager-${sessionStartVersion}-${user.id}-${user.clientTenantId || user.tenantId}`} /></Suspense>
      ) : <DashboardLayout key={`dashboard-${sessionStartVersion}-${user?.id || 'anonymous'}-${user?.clientTenantId || user?.tenantId || ''}`} />}
      <SessionMonitor />
      <Toaster position="top-right" />
    </>
  );
}

export default function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorBoundaryFallback />}>
      <AuthProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <ImpersonationProvider>
              <ActionClickGuard />
              <AppContent />
            </ImpersonationProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
