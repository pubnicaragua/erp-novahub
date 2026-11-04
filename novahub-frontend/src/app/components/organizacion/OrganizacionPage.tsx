import type { ReactNode } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService } from '../../services/organizacion.service';
import { MiAgendaView } from './MiAgendaView';
import { CompartidoView } from './CompartidoView';
import { ConfiguracionView } from './ConfiguracionView';
import { ErrorState } from './OrgBits';
import { errorMessage } from './organizacion.utils';

interface Props {
  activeSubModule?: string;
  onSubModuleChange?: (sub: string) => void;
}

type View = 'mi-agenda' | 'compartido' | 'configuracion';
const PERMISSION: Record<View, string> = { 'mi-agenda': 'ORGANIZATION_CALENDAR', compartido: 'ORGANIZATION_SHARED', configuracion: 'ORGANIZATION_SETTINGS' };

/** Organización personal: tres vistas (Mi agenda, Compartido, Configuración) sobre el módulo Actividades. */
export function OrganizacionPage({ activeSubModule, onSubModuleChange }: Props) {
  const { canPerform } = useAuth();
  const allowed = (Object.keys(PERMISSION) as View[]).filter((v) => canPerform(PERMISSION[v], 'view'));
  const requested = (activeSubModule as View) in PERMISSION ? (activeSubModule as View) : 'mi-agenda';
  const view: View | null = allowed.includes(requested) ? requested : (allowed[0] ?? null);

  const preferences = useTenantQuery(['organizacion', 'preferences'], (signal) => organizacionService.getPreferences(signal), { enabled: view !== null, staleTime: 30_000 });
  const users = useTenantQuery(['organizacion', 'users'], (signal) => organizacionService.getUsers(signal), { enabled: view !== null, staleTime: 5 * 60_000 });

  if (!view) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6">
        <div className="text-center"><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="mt-2 text-muted-foreground">No tienes permisos para ver Organización personal.</p></div>
      </div>
    );
  }

  if (preferences.isLoading) {
    return <Frame><div className="space-y-3" aria-busy="true" aria-label="Cargando Organización personal"><Skeleton className="h-12 w-64" /><Skeleton className="h-[480px] w-full" /></div></Frame>;
  }
  if (preferences.isError || !preferences.data) {
    return <Frame><ErrorState message={errorMessage(preferences.error, 'No se pudieron cargar tus preferencias de agenda')} onRetry={() => void preferences.refetch()} /></Frame>;
  }

  const go = (sub: View) => onSubModuleChange?.(sub);
  const userList = users.data ?? [];

  // La clave incluye zona horaria y primer día para reiniciar la vista cuando cambian las preferencias.
  const key = `${preferences.data.timezone}-${preferences.data.weekStartsOn}-${preferences.data.showWeekends}`;
  return (
    <Frame>
      {view === 'compartido' && <CompartidoView key={key} preferences={preferences.data} users={userList} onOpenAgenda={() => go('mi-agenda')} onOpenSettings={() => go('configuracion')} />}
      {view === 'configuracion' && <ConfiguracionView preferences={preferences.data} users={userList} />}
      {view === 'mi-agenda' && <MiAgendaView key={key} preferences={preferences.data} users={userList} onOpenSettings={() => go('configuracion')} />}
    </Frame>
  );
}

/** Mismo contenedor y márgenes que usan los demás módulos operativos (Actividades, Ventas…). */
function Frame({ children }: { children: ReactNode }) {
  return <div className="organization-module mx-auto min-h-[calc(100vh-5rem)] w-full min-w-0 max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">{children}</div>;
}
