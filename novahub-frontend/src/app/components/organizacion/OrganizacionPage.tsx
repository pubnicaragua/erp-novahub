import type { ReactNode } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService } from '../../services/organizacion.service';
import { MiAgendaView } from './MiAgendaView';
import { CompartidoView } from './CompartidoView';
import { ConfiguracionView } from './ConfiguracionView';
import { EquipoView } from './EquipoView';
import { EstrategiasView } from './EstrategiasView';
import { MiDiaView } from './MiDiaView';
import { ErrorState } from './OrgBits';
import { errorMessage } from './organizacion.utils';
import { CalendarDays, Clock3, Eye, Lightbulb, Settings, Users } from 'lucide-react';
import { ModuleSubnavigation } from '../ui/ModuleSubnavigation';

interface Props {
  activeSubModule?: string;
  onSubModuleChange?: (sub: string) => void;
  isSidebarCollapsed?: boolean;
}

type View = 'mi-agenda' | 'mi-dia' | 'compartido' | 'estrategias' | 'equipo' | 'configuracion';
const PERMISSION: Record<View, string> = { 'mi-agenda': 'ORGANIZATION_CALENDAR', 'mi-dia': 'ORGANIZATION_CALENDAR', compartido: 'ORGANIZATION_SHARED', estrategias: 'ORGANIZATION_SHARED', equipo: 'ORGANIZATION_TEAM', configuracion: 'ORGANIZATION_SETTINGS' };
const VIEW_TABS: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'mi-agenda', label: 'Mi agenda', icon: <CalendarDays className="size-4" /> },
  { id: 'mi-dia', label: 'Mi día', icon: <Clock3 className="size-4" /> },
  { id: 'compartido', label: 'Compartido', icon: <Users className="size-4" /> },
  { id: 'estrategias', label: 'Estrategias', icon: <Lightbulb className="size-4" /> },
  { id: 'equipo', label: 'Equipo', icon: <Eye className="size-4" /> },
  { id: 'configuracion', label: 'Configuración', icon: <Settings className="size-4" /> },
];

/** Organización: tres vistas (Mi agenda, Compartido, Configuración) sobre el módulo Actividades. */
export function OrganizacionPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed }: Props) {
  const { canPerform } = useAuth();
  const allowed = (Object.keys(PERMISSION) as View[]).filter((v) => canPerform(PERMISSION[v], 'view'));
  const requested = (activeSubModule as View) in PERMISSION ? (activeSubModule as View) : 'mi-agenda';
  const view: View | null = allowed.includes(requested) ? requested : (allowed[0] ?? null);

  const preferences = useTenantQuery(['organizacion', 'preferences'], (signal) => organizacionService.getPreferences(signal), { enabled: view !== null, staleTime: 30_000 });
  const users = useTenantQuery(['organizacion', 'users'], (signal) => organizacionService.getUsers(signal), { enabled: view !== null, staleTime: 5 * 60_000 });

  const subnavigation = view ? <ModuleSubnavigation
    items={VIEW_TABS.filter((tab) => allowed.includes(tab.id))}
    value={view}
    onValueChange={(sub) => {
      if (allowed.includes(sub as View)) onSubModuleChange?.(sub);
    }}
    isSidebarCollapsed={isSidebarCollapsed}
    ariaLabel="Navegación de Organización"
  /> : null;

  if (!view) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="text-center"><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="mt-2 text-muted-foreground">No tienes permisos para ver Organización.</p></div>
      </div>
    );
  }

  if (preferences.isLoading) {
    return <Frame>{subnavigation}<div className="space-y-3" aria-busy="true" aria-label="Cargando Organización"><Skeleton className="h-12 w-64" /><Skeleton className="h-[480px] w-full" /></div></Frame>;
  }
  if (preferences.isError || !preferences.data) {
    return <Frame>{subnavigation}<ErrorState message={errorMessage(preferences.error, 'No se pudieron cargar tus preferencias de agenda')} onRetry={() => void preferences.refetch()} /></Frame>;
  }

  const go = (sub: View) => {
    if (allowed.includes(sub)) onSubModuleChange?.(sub);
  };
  const userList = users.data ?? [];

  // La clave incluye zona horaria y primer día para reiniciar la vista cuando cambian las preferencias.
  const key = `${preferences.data.timezone}-${preferences.data.weekStartsOn}-${preferences.data.showWeekends}`;
  return (
    <Frame>
      {subnavigation}
      {view === 'compartido' && <CompartidoView key={key} preferences={preferences.data} users={userList} onOpenAgenda={() => go('mi-agenda')} onOpenSettings={() => go('configuracion')} />}
      {view === 'equipo' && <EquipoView preferences={preferences.data} />}
      {view === 'mi-dia' && <MiDiaView preferences={preferences.data} />}
      {view === 'estrategias' && <EstrategiasView />}
      {view === 'configuracion' && <ConfiguracionView preferences={preferences.data} users={userList} />}
      {view === 'mi-agenda' && <MiAgendaView key={key} preferences={preferences.data} users={userList} onOpenSettings={() => go('configuracion')} />}
    </Frame>
  );
}

/** Mismo contenedor y márgenes que usan los demás módulos operativos (Actividades, Ventas…). */
function Frame({ children }: { children: ReactNode }) {
  return <div className="organization-module mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">{children}</div>;
}
