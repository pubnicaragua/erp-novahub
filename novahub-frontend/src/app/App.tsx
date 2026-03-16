import React, { useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { AuthProvider, useAuth, type Module } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { LoginPage } from './components/LoginPage';
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
import { RolesPage } from './components/RolesPage';
import { ConfiguracionPage } from './components/ConfiguracionPage';
import { SuscripcionesPage } from './components/SuscripcionesPage';
import { PrismaSchemaPage } from './components/PrismaSchemaPage';

function DashboardLayout() {
  const { hasAccess, user } = useAuth();
  const [activeModule, setActiveModule] = useState<Module | 'overview'>('overview');
  const [activeSubModule, setActiveSubModule] = useState<string | undefined>();
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
      setActiveSubModule(subModule);
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
      case 'inventario': return <InventarioPage />;
      case 'ventas': return <VentasPage activeSubModule={activeSubModule} />;
      case 'compras': return <ComprasPage activeSubModule={activeSubModule} />;
      case 'finanzas': return <FinanzasPage activeSubModule={activeSubModule} />;
      case 'rh': return <RecursosHumanosPage activeSubModule={activeSubModule} />;
      case 'clientes': return <ClientesPage />;
      case 'proveedores': return <ProveedoresPage />;
      case 'actividades': return <ActividadesPage />;
      case 'tickets': return <TicketsPage />;
      case 'documentos': return <DocumentosPage />;
      case 'notificaciones': return <NotificacionesPage />;
      case 'transferencias': return <TransferenciasPage />;
      case 'reportes': return <ReportesPage />;
      case 'roles': return <RolesPage />;
      case 'configuracion': return <ConfiguracionPage />;
      case 'suscripciones': return <SuscripcionesPage />;
      case 'schema': return <PrismaSchemaPage />;
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onNavigate={handleNavigate}
          isCollapsed={isCollapsed}
          onToggleCollapse={handleToggleCollapse}
        />
        <main className="flex-1 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated, login } = useAuth();

  useEffect(() => {
    const isDark = localStorage.getItem('erp-theme-mode') === 'light' ? false : true;
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

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
    <AuthProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <AppContent />
        </CurrencyProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
