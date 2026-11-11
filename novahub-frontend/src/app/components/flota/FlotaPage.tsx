import { Suspense, type ReactNode } from 'react';
import { Route, Settings, Truck } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { ModuleSubnavigation } from '../ui/ModuleSubnavigation';
import { VehiculosView } from './VehiculosView';
import { TarifasView } from './TarifasView';
import { ParametrosView } from './ParametrosView';

interface Props { activeSubModule?: string; onSubModuleChange?: (sub: string) => void; isSidebarCollapsed?: boolean }

const VIEWS = ['vehiculos', 'tarifas', 'parametros'] as const;
type View = (typeof VIEWS)[number];
const PERMISSION: Record<View, string> = { vehiculos: 'FLEET_VEHICLES', tarifas: 'FLEET_RATES', parametros: 'FLEET_SETTINGS' };
const VIEW_TABS: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'vehiculos', label: 'Vehículos', icon: <Truck className="size-4" /> },
  { id: 'tarifas', label: 'Tarifas y rutas', icon: <Route className="size-4" /> },
  { id: 'parametros', label: 'Parámetros y costos', icon: <Settings className="size-4" /> },
];

/** Flota y fletes: tres vistas con permisos propios; cada acción se vuelve a validar en el backend. */
export function FlotaPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: Props) {
  const { canPerform } = useAuth();
  const allowed = VIEWS.filter((v) => canPerform(PERMISSION[v], 'view'));
  const requested = (VIEWS as readonly string[]).includes(activeSubModule ?? '') ? (activeSubModule as View) : 'vehiculos';
  const view = allowed.includes(requested) ? requested : (allowed[0] ?? null);

  if (!view) {
    return <div className="flex min-h-[50vh] items-center justify-center p-6 text-center"><div><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="mt-2 text-muted-foreground">No tienes permiso para ver Flota y fletes.</p></div></div>;
  }
  return (
    <div className="flota-module mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1500px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">
      <ModuleSubnavigation
        items={VIEW_TABS.filter((tab) => allowed.includes(tab.id))}
        value={view}
        onValueChange={(sub) => onSubModuleChange?.(sub)}
        isSidebarCollapsed={isSidebarCollapsed}
        ariaLabel="Navegación de Flota y fletes"
      />
      <Suspense fallback={<Skeleton className="h-[480px] w-full" aria-busy="true" />}>
        {view === 'vehiculos' && <VehiculosView />}
        {view === 'tarifas' && <TarifasView />}
        {view === 'parametros' && <ParametrosView />}
      </Suspense>
    </div>
  );
}
