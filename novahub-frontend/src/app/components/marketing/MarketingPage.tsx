import { lazy, Suspense } from 'react';
import { Skeleton } from '../ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { ResumenView } from './ResumenView';
import { ClientesView } from './ClientesView';
import { CampanasView } from './CampanasView';
import { ContenidosView } from './ContenidosView';
import { AprobacionesView } from './AprobacionesView';
import { ConfiguracionMktView } from './ConfiguracionMktView';

// Las vistas con exportación pesada (Excel/PDF) se cargan bajo demanda.
const ActivosView = lazy(() => import('./ActivosView').then((m) => ({ default: m.ActivosView })));
const AnaliticaView = lazy(() => import('./AnaliticaView').then((m) => ({ default: m.AnaliticaView })));

interface Props { activeSubModule?: string; onSubModuleChange?: (sub: string) => void }

const VIEWS = ['resumen', 'clientes', 'campanas', 'contenidos', 'aprobaciones', 'activos', 'analitica', 'configuracion'] as const;
type View = (typeof VIEWS)[number];
const PERMISSION: Record<View, string> = {
  resumen: 'MARKETING_OVERVIEW', clientes: 'MARKETING_CLIENTS', campanas: 'MARKETING_CAMPAIGNS', contenidos: 'MARKETING_CONTENT',
  aprobaciones: 'MARKETING_APPROVALS', activos: 'MARKETING_ASSETS', analitica: 'MARKETING_ANALYTICS', configuracion: 'MARKETING_SETTINGS',
};

/** Marketing: ocho vistas gobernadas por permisos propios; cada acción se vuelve a validar en el backend. */
export function MarketingPage({ activeSubModule, onSubModuleChange }: Props) {
  const { canPerform } = useAuth();
  const allowed = VIEWS.filter((v) => canPerform(PERMISSION[v], 'view'));
  const requested = (VIEWS as readonly string[]).includes(activeSubModule ?? '') ? (activeSubModule as View) : 'resumen';
  const view = allowed.includes(requested) ? requested : (allowed[0] ?? null);
  const go = (sub: string) => { if ((VIEWS as readonly string[]).includes(sub) && allowed.includes(sub as View)) onSubModuleChange?.(sub); };

  if (!view) {
    return <div className="flex min-h-[50vh] items-center justify-center p-6 text-center"><div><h1 className="text-2xl font-semibold">Acceso denegado</h1><p className="mt-2 text-muted-foreground">No tienes permisos para ver Marketing.</p></div></div>;
  }
  return (
    <Suspense fallback={<Skeleton className="h-[480px] w-full" aria-busy="true" />}>
      {view === 'resumen' && <ResumenView go={go} />}
      {view === 'clientes' && <ClientesView />}
      {view === 'campanas' && <CampanasView />}
      {view === 'contenidos' && <ContenidosView />}
      {view === 'aprobaciones' && <AprobacionesView />}
      {view === 'activos' && <ActivosView />}
      {view === 'analitica' && <AnaliticaView />}
      {view === 'configuracion' && <ConfiguracionMktView />}
    </Suspense>
  );
}
