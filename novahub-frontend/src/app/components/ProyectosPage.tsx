import { useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ProyectosListView } from './proyectos/ProyectosListView';
import { ProyectoDetalleView } from './proyectos/ProyectoDetalleView';

interface ProyectosPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

export const ProyectosPage = (_props: ProyectosPageProps) => {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tenant-module', 'projects'] });

  return (
    <div className="flex flex-1 bg-background w-full">
      <main className="flex-1 relative">
        <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:p-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-[66px] shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <FolderKanban className="size-9 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tighter flex flex-wrap items-center gap-x-3 gap-y-1 uppercase italic leading-none">
                  Proyectos
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Portafolio, planificación, presupuesto, costos y rentabilidad.
                </p>
              </div>
            </div>
          </div>

          {selectedId ? (
            <ProyectoDetalleView projectId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <ProyectosListView
              loading={false}
              onSelect={setSelectedId}
              onChanged={refresh}
              canCreate={canPerform('PROJECTS', 'create')}
              canEdit={canPerform('PROJECTS', 'edit')}
              canDelete={canPerform('PROJECTS', 'delete')}
            />
          )}
        </div>
      </main>
    </div>
  );
};