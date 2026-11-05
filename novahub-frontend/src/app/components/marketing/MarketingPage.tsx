import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { ResumenView } from './ResumenView';
import { ClientesView } from './ClientesView';
import { CampanasView } from './CampanasView';
import { ContenidosView } from './ContenidosView';
import { AprobacionesView } from './AprobacionesView';
import { ConfiguracionMktView } from './ConfiguracionMktView';
import { Activity, CalendarDays, FileCheck, FolderOpen, LayoutDashboard, Megaphone, Settings, Users } from 'lucide-react';
import { ModuleSubnavigation } from '../ui/ModuleSubnavigation';

// Las vistas con exportación pesada (Excel/PDF) se cargan bajo demanda.
const ActivosView = lazy(() => import('./ActivosView').then((m) => ({ default: m.ActivosView })));
const AnaliticaView = lazy(() => import('./AnaliticaView').then((m) => ({ default: m.AnaliticaView })));

interface Props { activeSubModule?: string; onSubModuleChange?: (sub: string) => void; isSidebarCollapsed?: boolean }

const VIEWS = ['resumen', 'clientes', 'campanas', 'contenidos', 'aprobaciones', 'activos', 'analitica', 'configuracion'] as const;
type View = (typeof VIEWS)[number];
const PERMISSION: Record<View, string> = {
  resumen: 'MARKETING_OVERVIEW', clientes: 'MARKETING_CLIENTS', campanas: 'MARKETING_CAMPAIGNS', contenidos: 'MARKETING_CONTENT',
  aprobaciones: 'MARKETING_APPROVALS', activos: 'MARKETING_ASSETS', analitica: 'MARKETING_ANALYTICS', configuracion: 'MARKETING_SETTINGS',
};
const VIEW_TABS: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'resumen', label: 'Resumen', icon: <LayoutDashboard className="size-4" /> },
  { id: 'clientes', label: 'Clientes y briefs', icon: <Users className="size-4" /> },
  { id: 'campanas', label: 'Campañas', icon: <Megaphone className="size-4" /> },
  { id: 'contenidos', label: 'Contenidos', icon: <CalendarDays className="size-4" /> },
  { id: 'aprobaciones', label: 'Aprobaciones', icon: <FileCheck className="size-4" /> },
  { id: 'activos', label: 'Biblioteca de activos', icon: <FolderOpen className="size-4" /> },
  { id: 'analitica', label: 'Analítica', icon: <Activity className="size-4" /> },
  { id: 'configuracion', label: 'Configuración', icon: <Settings className="size-4" /> },
];

/** Marketing: ocho vistas gobernadas por permisos propios; cada acción se vuelve a validar en el backend. */
export function MarketingPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: Props) {
  const { canPerform } = useAuth();
  const allowed = VIEWS.filter((v) => canPerform(PERMISSION[v], 'view'));
  const requested = (VIEWS as readonly string[]).includes(activeSubModule ?? '') ? (activeSubModule as View) : 'resumen';
  const view = allowed.includes(requested) ? requested : (allowed[0] ?? null);
  // Los accesos rápidos del Resumen ("Nuevo brief", "Nueva campaña"…) abren el formulario de la vista destino.
  const [createIntent, setCreateIntent] = useState<View | null>(null);
  if (createIntent && createIntent !== view) setCreateIntent(null);
  const go = (sub: string, create = false) => {
    if (!(VIEWS as readonly string[]).includes(sub) || !allowed.includes(sub as View)) return;
    setCreateIntent(create ? (sub as View) : null);
    onSubModuleChange?.(sub);
  };

  if (!view) {
    return <div className="flex min-h-[50vh] items-center justify-center p-6 text-center"><div><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="mt-2 text-muted-foreground">No tienes permisos para ver Marketing.</p></div></div>;
  }
  return (
    <div className="marketing-module mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">
      <ModuleSubnavigation
        items={VIEW_TABS.filter((tab) => allowed.includes(tab.id))}
        value={view}
        onValueChange={go}
        isSidebarCollapsed={isSidebarCollapsed}
        ariaLabel="Navegación de Marketing"
      />
      <Suspense fallback={<Skeleton className="h-[480px] w-full" aria-busy="true" />}>
        {view === 'resumen' && <ResumenView go={go} />}
        {view === 'clientes' && <ClientesView openCreate={createIntent === 'clientes'} />}
        {view === 'campanas' && <CampanasView openCreate={createIntent === 'campanas'} />}
        {view === 'contenidos' && <ContenidosView openCreate={createIntent === 'contenidos'} />}
        {view === 'aprobaciones' && <AprobacionesView />}
        {view === 'activos' && <ActivosView />}
        {view === 'analitica' && <AnaliticaView />}
        {view === 'configuracion' && <ConfiguracionMktView />}
      </Suspense>
    </div>
  );
}
