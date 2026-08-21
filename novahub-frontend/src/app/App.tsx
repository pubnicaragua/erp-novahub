import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import * as Sentry from '@sentry/react';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth, type Module } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { ImpersonationProvider, useImpersonation } from './contexts/ImpersonationContext';
import { LoginPage } from './components/LoginPage';
import { RegisterTenantPage } from './components/auth/RegisterTenantPage';
import LandingPage from './components/LandingPage';
import { TrialExpiredPage } from './components/auth/TrialExpiredPage';
import { SessionClosedPage } from './components/auth/SessionClosedPage';
import { SessionMonitor } from './components/auth/SessionMonitor';
import { PLATFORM_SIDEBAR_MODULE_ORDER, SIDEBAR_MODULE_ORDER, Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { ModuleErrorBoundary } from './components/ui/ModuleErrorBoundary';
import { PublicAccessPage } from './components/public/PublicAccessPage';
import { PublicRestaurantMenuPage } from './components/public/PublicRestaurantMenuPage';
import { FloatingChat } from './components/ai/FloatingChat';
import { useIncomingNotificationAlert } from './hooks/useIncomingNotificationAlert';
import { safeGetItem, safeSetItem, safeRemoveItem } from './services/safe-storage';

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
const TicketsPage = lazyWithChunkRecovery(() => import('./components/TicketsPage').then(m => ({ default: m.TicketsPage })), 'tickets');
const DocumentosPage = lazyWithChunkRecovery(() => import('./components/DocumentosPage').then(m => ({ default: m.DocumentosPage })), 'documentos');
const NotificacionesPage = lazyWithChunkRecovery(() => import('./components/NotificacionesPage').then(m => ({ default: m.NotificacionesPage })), 'notificaciones');
const TransferenciasPage = lazyWithChunkRecovery(() => import('./components/TransferenciasPage').then(m => ({ default: m.TransferenciasPage })), 'transferencias');
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
  const { hasAccess, sessionStartVersion, user } = useAuth();
  const { isImpersonating, branch, manager, exitBranch } = useImpersonation();
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
    const nextSubModule = urlSubModule === 'dashboard' ? 'productos' : (urlSubModule || undefined);
    if (nextSubModule !== activeSubModule) setActiveSubModule(nextSubModule);
  }, [searchParams]);

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
    // optional: read from localStorage if you want persistence
    return safeGetItem('erp-sidebar-collapsed') === 'true';
  });

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
    if (hasAccess(targetModule)) {
      setActiveModule(targetModule);
      setActiveSubModule(module === 'inventario' ? (subModule || 'productos') : subModule);
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
      const targetModule = e.detail.module === 'roles' ? 'suscripciones' : e.detail.module;
      const allowed = targetModule === 'overview' ? hasAccess('dashboard') : hasAccess(targetModule);
      if (allowed) {
        setActiveModule(targetModule);
        setActiveSubModule(e.detail.subModule);
      }
    };
    const subHandler = (e: any) => {
      const subModule = e.detail?.subModule;
      if (subModule) setActiveSubModule(subModule === 'dashboard' ? 'productos' : subModule);
    };
    window.addEventListener('navigate-module', handler);
    window.addEventListener('navigate-submodule', subHandler);
    return () => {
      window.removeEventListener('navigate-module', handler);
      window.removeEventListener('navigate-submodule', subHandler);
    };
  }, [hasAccess]);

  const renderContent = () => {
    if (currentModule === 'overview') {
      if (user?.role === 'partner') {
        return <PartnerDashboard onNavigate={handleNavigate} />;
      }
      return <ModuleErrorBoundary moduleName="Dashboard"><OverviewDashboard onNavigate={handleNavigate} onOverview={handleOverview} /></ModuleErrorBoundary>;
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
      case 'restaurante': return <ModuleErrorBoundary moduleName="Restaurante"><RestaurantePage /></ModuleErrorBoundary>;
      case 'compras': return <ModuleErrorBoundary moduleName="Compras"><ComprasPage activeSubModule={activeSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'finanzas': return <ModuleErrorBoundary moduleName="Finanzas"><FinanzasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /></ModuleErrorBoundary>;
      case 'rh': return <RecursosHumanosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'clientes': return <ClientesPage />;
      case 'proveedores': return <ProveedoresPage />;
      case 'actividades': return <ActividadesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'tickets': return <TicketsPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'documentos': return <DocumentosPage activeSubModule={activeSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'notificaciones': return <NotificacionesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'transferencias': return <TransferenciasPage />;
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
        {isImpersonating && branch && (
          <div className="flex items-center justify-between gap-3 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">Modo Supervisor</span>
              <span className="truncate">Trabajando en <strong>{branch.name}</strong> como {manager?.name}</span>
            </div>
            <button onClick={exitBranch} className="shrink-0 rounded-lg bg-amber-500/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/25 transition-colors">
              Volver al Panel
            </button>
          </div>
        )}
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onNavigate={handleNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="scrollbar-overlay min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
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
  const { isAuthenticated, login, logout, user } = useAuth();
  const { isImpersonating } = useImpersonation();
  const location = useLocation();
  const [trialExpired, setTrialExpired] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);

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
    const isDark = safeGetItem('erp-theme-mode') === 'light' ? false : true;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  if (location.pathname.startsWith('/public/document/')) return <PublicAccessPage mode="document" />;
  if (location.pathname.startsWith('/public/portal/')) return <PublicAccessPage mode="portal" />;
  if (location.pathname.startsWith('/restaurant/menu/')) {
    const tableToken = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
    return <PublicRestaurantMenuPage tableToken={tableToken} />;
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

  return (
    <>
      {sessionClosed && (
        <SessionClosedPage
          onLogout={() => {
            safeRemoveItem('nh-auth-token');
            logout?.();
            window.location.reload();
          }}
        />
      )}
      {trialExpired && (
        <TrialExpiredPage
          onLogout={() => {
            safeRemoveItem('nh-auth-token');
            logout?.();
            window.location.reload();
          }}
        />
      )}
      {(user?.userType === 'manager' || user?.role === 'manager') && !user.isPlatformAdmin && !isImpersonating ? (
        <Suspense fallback={<PageLoader />}><ManagerPage /></Suspense>
      ) : <DashboardLayout />}
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
              <AppContent />
            </ImpersonationProvider>
          </CurrencyProvider>
        </ThemeProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
