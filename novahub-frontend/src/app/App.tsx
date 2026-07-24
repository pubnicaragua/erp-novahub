import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth, type Module } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LoginPage } from './components/LoginPage';
import { RegisterTenantPage } from './components/auth/RegisterTenantPage';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { OverviewDashboard } from './components/OverviewDashboard';
import { PartnerDashboard } from './components/PartnerDashboard';
import { InventarioPage } from './components/InventarioPage';
import { VentasPage } from './components/VentasPage';
import { ComprasPage } from './components/ComprasPage';
import { FinanzasPage } from './components/FinanzasPage';
import { RecursosHumanosPage } from './components/RecursosHumanosPage';
import { ClientesPage } from './components/ClientesPage';
import { ProveedoresPage } from './components/ProveedoresPage';
import { ActividadesPage } from './components/ActividadesPage';
import { TicketsPage } from './components/TicketsPage';
import { DocumentosPage } from './components/DocumentosPage';
import { NotificacionesPage } from './components/NotificacionesPage';
import { TransferenciasPage } from './components/TransferenciasPage';
import { ReportesPage } from './components/ReportesPage';
import { ConfiguracionPage } from './components/ConfiguracionPage';
import { SuscripcionesPage } from './components/SuscripcionesPage';
import { PrismaSchemaPage } from './components/PrismaSchemaPage';
import { FinanciamientoPymePage } from './components/FinanciamientoPymePage';
import { AsesoriaLegalPage } from './components/AsesoriaLegalPage';
import { NovaChatView } from './components/novachat/NovaChatView';
import { TrainingHubView } from './components/help/TrainingHubView';
import { SoporteTecnicoView } from './components/help/SoporteTecnicoView';
import { SoporteTecnicoAdminView } from './components/help/SoporteTecnicoAdminView';
import { ContabilidadPage } from './components/contabilidad/ContabilidadPage';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#0f0f0f', color: '#ff6b6b', minHeight: '100vh' }}>
          <h2 style={{ color: '#ff6b6b', marginBottom: 16 }}>⚠ Error de renderizado detectado</h2>
          <pre style={{ background: '#1a1a1a', padding: 16, borderRadius: 8, overflowX: 'auto', color: '#ffa07a', fontSize: 13 }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            style={{ marginTop: 16, padding: '8px 20px', background: '#333', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}


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

  // Auto-redirigir si está en un módulo para el cual no tiene acceso (o al iniciar sesión)
  useEffect(() => {
    const isDeny = activeModule !== 'overview' && !hasAccess(activeModule as Module);
    const isOverview = activeModule === 'overview';
    
    // Si no tiene acceso al módulo actual o si estamos en overview pero hay un primer módulo preferido
    if (isDeny || isOverview) {
      // Intentar encontrar el primer módulo operativo disponible
      const preferredOrder: Module[] = [
        'inventario', 'ventas', 'compras', 'finanzas', 'contabilidad', 'rh',
        'clientes', 'proveedores', 'actividades', 'tickets',
        'centro-capacitacion', 'soporte-tecnico', 'asesoria-legal', 'novachat',
        'documentos', 'notificaciones', 'transferencias', 
        'reportes', 'roles', 'configuracion', 'suscripciones', 'schema'
      ];
      
      const firstAllowed = preferredOrder.find(m => hasAccess(m));
      
      // Si fue denegado, forzar redirección
      // Si estaba en overview pero el usuario no es admin/partner, mejor mandarlo a su módulo de trabajo real
      if (isDeny || (isOverview && user && !user.isPlatformAdmin && !user.isTenantAdmin)) {
        if (firstAllowed) {
          setActiveModule(firstAllowed);
        }
      }
    }
  }, [activeModule, hasAccess, user]);

  useEffect(() => {
    const handler = (e: any) => {
      if (hasAccess(e.detail.module)) {
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
      return <OverviewDashboard onNavigate={handleNavigate} />;
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
      case 'configuracion': return <ConfiguracionPage />;
      case 'suscripciones': return <SuscripcionesPage />;
      case 'schema': return <PrismaSchemaPage />;
      case 'financiamiento-pyme': return <FinanciamientoPymePage />;
      case 'centro-capacitacion': return <TrainingHubView />;
      case 'soporte-tecnico': return user?.isPlatformAdmin ? <SoporteTecnicoAdminView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} /> : <SoporteTecnicoView activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
      case 'contabilidad': return <ContabilidadPage activeSubModule={activeSubModule} onSubModuleChange={setActiveSubModule} isSidebarCollapsed={isCollapsed} />;
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
          {renderContent()}
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
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <AppContent />
          </CurrencyProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
