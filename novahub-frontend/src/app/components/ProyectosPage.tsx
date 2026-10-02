import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ProyectosListView } from './proyectos/ProyectosListView';
import { ProyectoDetalleView } from './proyectos/ProyectoDetalleView';
import { useNotificationDomainRefresh } from '../hooks/useNotificationDomainRefresh';

interface ProyectosPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

const PROJECT_SUBMODULE_TABS: Record<string, string> = {
  proyectos: 'resumen',
  'proyectos-tareas': 'planificacion',
  'proyectos-hitos': 'hitos',
  'proyectos-tiempo': 'cronograma',
  'proyectos-costos': 'costos',
  'proyectos-documentos': 'documentos',
};

export const ProyectosPage = ({ activeSubModule = 'proyectos', onSubModuleChange }: ProyectosPageProps) => {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tenant-module'] });

  useNotificationDomainRefresh({
    module: 'proyectos',
    subModules: ['proyectos', 'tareas', 'hitos', 'presupuesto', 'costos', 'miembros', 'documentos', 'actividades'],
    onRefresh: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'], refetchType: 'active' });
      void queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'], refetchType: 'active' });
    },
  });

  return (
    <div className="projects-module flex flex-1 bg-background w-full">
      <main className="flex-1 relative">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:px-10 md:pb-10 md:pt-4">

          {selectedId ? (
            <ProyectoDetalleView projectId={selectedId} onBack={() => setSelectedId(null)} defaultTab={PROJECT_SUBMODULE_TABS[activeSubModule] || 'resumen'} onTabChange={onSubModuleChange} />
          ) : (
            <ProyectosListView
              loading={false}
              onSelect={setSelectedId}
              onChanged={refresh}
              canCreate={canPerform('PROJECTS_LIST', 'create')}
              canEdit={canPerform('PROJECTS_LIST', 'edit')}
              canDelete={canPerform('PROJECTS_LIST', 'delete')}
              canViewCosts={canPerform('PROJECTS_EXPENSES', 'view')}
              canViewTimeline={canPerform('PROJECTS_TIME', 'view')}
            />
          )}
        </div>
      </main>
    </div>
  );
};
