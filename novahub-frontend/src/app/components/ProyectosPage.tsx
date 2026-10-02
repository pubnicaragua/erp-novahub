import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { ProyectosListView } from './proyectos/ProyectosListView';
import { ProyectoDetalleView } from './proyectos/ProyectoDetalleView';
import { useNotificationDomainRefresh } from '../hooks/useNotificationDomainRefresh';
import { Info } from 'lucide-react';

interface ProyectosPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (sub: string) => void;
}

export const ProyectosPage = ({ activeSubModule, onSubModuleChange }: ProyectosPageProps) => {
  const { canPerform } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPid = searchParams.get('pid') || searchParams.get('id') || null;
  const [selectedId, setSelectedIdState] = useState<string | null>(urlPid);
  const [lastUrlPid, setLastUrlPid] = useState<string | null>(urlPid);

  if (urlPid !== lastUrlPid) {
    setLastUrlPid(urlPid);
    setSelectedIdState(urlPid);
  }

  const handleSelectProject = (id: string | null) => {
    setSelectedIdState(id);
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('pid', id);
    } else {
      newParams.delete('pid');
      newParams.delete('id');
    }
    setSearchParams(newParams, { replace: true });
  };

  const initialTabMap: Record<string, string> = {
    'proyectos': 'resumen',
    'proyectos-resumen': 'resumen',
    'proyectos-cotizaciones': 'cotizaciones',
    'proyectos-evm': 'evm',
    'proyectos-planificacion': 'planificacion',
    'proyectos-costos': 'costos',
    'proyectos-costeo6d': 'costeo6d',
    'proyectos-memorias': 'memorias',
    'proyectos-exportar': 'exportar',
    'proyectos-parametros': 'parametros',
    'proyectos-actividades': 'actividades',
    // Fallbacks
    'proyectos-hitos': 'planificacion',
    'proyectos-tareas': 'planificacion',
    'proyectos-documentos': 'resumen',
    'proyectos-tiempo': 'planificacion',
  };

  const tabToSubModuleMap: Record<string, string> = {
    'resumen': 'proyectos-resumen',
    'cotizaciones': 'proyectos-cotizaciones',
    'costos': 'proyectos-costos',
    'costeo6d': 'proyectos-costeo6d',
    'evm': 'proyectos-evm',
    'memorias': 'proyectos-memorias',
    'exportar': 'proyectos-exportar',
    'parametros': 'proyectos-parametros',
    'planificacion': 'proyectos-planificacion',
    'costos': 'proyectos-costos',
    'actividades': 'proyectos-actividades',
  };

  const submoduleLabels: Record<string, string> = {
    'proyectos-resumen': 'Resumen, Avance y Documentos',
    'proyectos-cotizaciones': 'Cotizaciones Materiales',
    'proyectos-evm': 'Control EVM',
    'proyectos-planificacion': 'Planificación y Tareas',
    'proyectos-costos': 'Presupuesto y Costos',
    'proyectos-costeo6d': 'Costeo 6D',
    'proyectos-evm': 'Control EVM',
    'proyectos-memorias': 'Memorias de Cálculo',
    'proyectos-exportar': 'Cotización Ejecutiva',
    'proyectos-parametros': 'Parámetros del Proyecto',
    'proyectos-actividades': 'Actividades e Historial',
  };

  const targetTab = activeSubModule ? initialTabMap[activeSubModule] || 'resumen' : 'resumen';

  const handleDetailTabChange = (tabId: string) => {
    const sub = tabToSubModuleMap[tabId];
    if (sub && onSubModuleChange) {
      onSubModuleChange(sub);
    }
  };

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tenant-module'] });

  useNotificationDomainRefresh({
    module: 'proyectos',
    subModules: ['proyectos', 'tareas', 'hitos', 'cotizaciones', 'presupuesto', 'costos', 'miembros', 'documentos', 'actividades'],
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
            <ProyectoDetalleView
              projectId={selectedId}
              onBack={() => handleSelectProject(null)}
              initialTab={targetTab}
              onTabChange={handleDetailTabChange}
            />
          ) : (
            <div className="space-y-4">
              {activeSubModule && activeSubModule !== 'proyectos' && submoduleLabels[activeSubModule] ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                  <Info className="size-4 shrink-0" />
                  <span>
                    Estás consultando <strong>{submoduleLabels[activeSubModule]}</strong>. Selecciona un proyecto del portafolio para ingresar.
                  </span>
                </div>
              ) : null}
              <ProyectosListView
                loading={false}
                onSelect={(id) => handleSelectProject(id)}
                onChanged={refresh}
                canCreate={canPerform('PROJECTS_LIST', 'create')}
                canEdit={canPerform('PROJECTS_LIST', 'edit')}
                canDelete={canPerform('PROJECTS_LIST', 'delete')}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
