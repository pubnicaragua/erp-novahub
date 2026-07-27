import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation } from 'react-router';
import * as Sentry from '@sentry/react';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth, type Module } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LoginPage } from './components/LoginPage';
import { RegisterTenantPage } from './components/auth/RegisterTenantPage';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';

const OverviewDashboard = lazy(() => import('./components/OverviewDashboard'));
const PartnerDashboard = lazy(() => import('./components/PartnerDashboard'));
const InventarioPage = lazy(() => import('./components/InventarioPage'));
const VentasPage = lazy(() => import('./components/VentasPage'));
const ComprasPage = lazy(() => import('./components/ComprasPage'));
const FinanzasPage = lazy(() => import('./components/FinanzasPage'));
const RecursosHumanosPage = lazy(() => import('./components/RecursosHumanosPage'));
const ClientesPage = lazy(() => import('./components/ClientesPage'));
const ProveedoresPage = lazy(() => import('./components/ProveedoresPage'));
const ActividadesPage = lazy(() => import('./components/ActividadesPage'));
const TicketsPage = lazy(() => import('./components/TicketsPage'));
const DocumentosPage = lazy(() => import('./components/DocumentosPage'));
const NotificacionesPage = lazy(() => import('./components/NotificacionesPage'));
const TransferenciasPage = lazy(() => import('./components/TransferenciasPage'));
const ReportesPage = lazy(() => import('./components/ReportesPage'));
const ConfiguracionPage = lazy(() => import('./components/ConfiguracionPage'));
const SuscripcionesPage = lazy(() => import('./components/SuscripcionesPage'));
const PrismaSchemaPage = lazy(() => import('./components/PrismaSchemaPage'));
const FinanciamientoPymePage = lazy(() => import('./components/FinanciamientoPymePage'));
const AsesoriaLegalPage = lazy(() => import('./components/AsesoriaLegalPage'));
const NovaChatView = lazy(() => import('./components/novachat/NovaChatView'));
const TrainingHubView = lazy(() => import('./components/help/TrainingHubView'));
const SoporteTecnicoView = lazy(() => import('./components/help/SoporteTecnicoView'));
const SoporteTecnicoAdminView = lazy(() => import('./components/help/SoporteTecnicoAdminView'));
const ContabilidadPage = lazy(() => import('./components/contabilidad/ContabilidadPage'));
const DashboardVentas = lazy(() => import('./components/DashboardVentas'));
const DashboardCxc = lazy(() => import('./components/DashboardCxc'));

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
    <h2 style={{ color: '#ff6b6b', marginBottom: 16 }}>⚠ Error de renderizado detectado</h2>
    <button
      style={{ marginTop: 16, padding: '8px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
      onClick={() => window.location.reload()}
    >
      Recargar
    </button>
  </div>
);


function DashboardLayout() {
  const { hasAccess, user } = useAuth();
  const [activeModule, setActiveModule] = useState<Module | 'overview'>(() => {
    return (localStorage.getItem('erp-active-module') as Module | 'overview') || 'overview';
  });
  const [activeSubModule, setActiveSubModule] = useState<string | undefined>(() => {
    return localStorage.getItem('erp-active-submodule') || undefined;
  });

  useEffect(() => {
    localStorage.setItem('erp-active-module', activeModule);
  }, [activeModule]);

  useEffect(() => {
    if (activeSubModule) {
      localStorage.setItem('erp-active-submodule', activeSubModule);
    } else {
      localStorage.removeItem('erp-active-submodule');
    }
  }, [activeSubModule]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // optional: read from localStorage if you want persistence
    return localStorage.getItem('erp-sidebar-collapsed') === 'true';
  });

  const handleToggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem('erp-sidebar-collapsed', String(newVal));
  };

  const handleModuleChange = (module: Module, subModule?: string) => {
    if (hasAccess(module)) {
      setActiveModule(module);
      setActiveSubModule(module === 'inventario' ? (subModule || 'productos') : subModule);
    }
  };

  const handleNavigate = (module: Module) => {
    setActiveModule(module);
    setActiveSubModule(undefined);
    setSidebarOpen(false);
  };

  const handleOverview = () => {
    setActiveModule('overview');
    setActiveSubModule(undefined);
  };

  useEffect(() => {
    const isDeny = activeModule !== 'overview' && !hasAccess(activeModule as Module);
    
    if (isDeny) {
      const preferredOrder: Module[] = [
        'inventario', 'ventas', 'compras', 'finanzas', 'contabilidad', 'rh',
        'clientes', 'proveedores', 'actividades', 'tickets',
        'centro-capacitacion', 'soporte-tecnico', 'asesoria-legal', 'novachat',
        'documentos', 'notificaciones', 'transferencias', 
        'reportes', 'roles', 'configuracion', 'suscripciones', 'schema',
        'dashboard-ventas', 'dashboard-cxc'
      ];
      
      const firstAllowed = preferredOrder.find(m => hasAccess(m));
      if (firstAllowed) {
        setActiveModule(firstAllowed);
      }
    }
  }, [activeModule, hasAccess, user]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail.module === 'overview' || hasAccess(e.detail.module)) {
        setActiveModule(e.detail.module);
        setActiveSubModule(e.detail.subModule);
      }
    };
    window.addEventListener('navigate-module', handler);
    return () => window.removeEventListener('navigate-module', handler);
  }, [hasAccess]);

  const renderContent = () => {
    if (activeModule === 'overview') {
      if (user?.role === 'partner') {
        return <PartnerDashboard onNavigate={handleNavigate} />;
      }
      return <OverviewDashboard onNavigate={handleNavigate} onOverview={handleOverview} />;
    }

    if (!hasAccess(activeModule as Module)) {
      return (
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Acceso Denegado</h1>
            <p className="mt-2 text-muted-foreground">No tienes permisos para acceder a este modulo</p>
          </div>
        </div>
      );
    }

    switch (activeModule) {
      case 'inventario': return <InventarioPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'ventas': return <VentasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'compras': return <ComprasPage activeSubModule={activeSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'finanzas': return <FinanzasPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'rh': return <RecursosHumanosPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'clientes': return <ClientesPage />;
      case 'proveedores': return <ProveedoresPage />;
      case 'actividades': return <ActividadesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'tickets': return <TicketsPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'documentos': return <DocumentosPage activeSubModule={activeSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'notificaciones': return <NotificacionesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'transferencias': return <TransferenciasPage />;
      case 'reportes': return <ReportesPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'roles': return <ConfiguracionPage initialTab="roles" />;
      case 'configuracion': return <ConfiguracionPage initialTab={activeSubModule || 'branding'} />;
      case 'suscripciones': return <SuscripcionesPage />;
      case 'schema': return <PrismaSchemaPage />;
      case 'financiamiento-pyme': return <FinanciamientoPymePage />;
      case 'centro-capacitacion': return <TrainingHubView />;
      case 'soporte-tecnico': return user?.isPlatformAdmin ? <SoporteTecnicoAdminView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /> : <SoporteTecnicoView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'contabilidad': return <ContabilidadPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'dashboard-ventas': return <DashboardVentas />;
      case 'dashboard-cxc': return <DashboardCxc />;
      case 'asesoria-legal': return <AsesoriaLegalPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'novachat': return <NovaChatView />;
      default: return <OverviewDashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        activeModule={activeModule}
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
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            {renderContent()}
          </Suspense>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const isDark = localStorage.getItem('erp-theme-mode') === 'light' ? false : true;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Ruta pública de registro: no requiere autenticación y evita el guard.
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
      <DashboardLayout />
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
            <AppContent />
          </CurrencyProvider>
        </ThemeProvider>
      </AuthProvider>
    </Sentry.ErrorBoundary>
  );
}
