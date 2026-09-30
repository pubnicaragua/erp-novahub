import React, { useState } from 'react';
import { Globe, Boxes, PackageCheck, Scale, Settings2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { OriginWarehouseTab } from './OriginWarehouseTab';
import { ContainersTab } from './ContainersTab';
import { CustomsProrationTab } from './CustomsProrationTab';
import { IntlConfigTab } from './IntlConfigTab';

type IntlImportsSubModule = 'bodega-origen' | 'bodega-panama' | 'contenedores' | 'aduana-prorrateo' | 'configuracion';

interface IntlImportsPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule: string) => void;
}

const INTL_SUBMODULE_TABS: Array<{ id: IntlImportsSubModule; label: string; icon: React.ReactNode }> = [
  { id: 'bodega-origen', label: 'Bodega Origen', icon: <Boxes className="size-4" /> },
  { id: 'contenedores', label: 'Contenedores', icon: <PackageCheck className="size-4" /> },
  { id: 'aduana-prorrateo', label: 'Aduana / Prorrateo', icon: <Scale className="size-4" /> },
  { id: 'configuracion', label: 'Configuración', icon: <Settings2 className="size-4" /> },
];

export function IntlImportsPage({ activeSubModule, onSubModuleChange }: IntlImportsPageProps) {
  const { canPerform } = useAuth();

  const normalizedSubModule = activeSubModule === 'bodega-panama' ? 'bodega-origen' : activeSubModule;

  const targetTab = (normalizedSubModule && INTL_SUBMODULE_TABS.some((t) => t.id === normalizedSubModule))
    ? (normalizedSubModule as IntlImportsSubModule)
    : undefined;

  const [localTab, setLocalTab] = useState<IntlImportsSubModule>('bodega-origen');
  const currentTab = targetTab || localTab;

  const handleTabChange = (tabId: IntlImportsSubModule) => {
    setLocalTab(tabId);
    onSubModuleChange?.(tabId);
  };

  const canCreate = canPerform('IMPORT_INTL', 'create');
  const canEdit = canPerform('IMPORT_INTL', 'edit');
  const canApprove = canPerform('IMPORT_INTL', 'approve');
  // Permisos dedicados: no se heredan de `approve` ni de `edit`.
  const canCloseByException = canPerform('IMPORT_INTL', 'closeByException');
  const canReopen = canPerform('IMPORT_INTL', 'reopenContainer');

  return (
    <div className="intl-imports-module space-y-4 sm:space-y-6 min-w-0 max-w-full">
      {/* Header del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 sm:pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <Globe className="size-5 sm:size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground break-words leading-tight">
                Importaciones Internacionales
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                Consolidación, trazabilidad por cubicaje CBM y prorrateo de gastos de nacionalización.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por Pestañas Superior (Estilo Navbar Segmentada como Imagen 2) */}
      <div className="min-w-0 max-w-full overflow-x-auto scrollbar-none py-0.5">
        <div
          data-intl-tabs="true"
          className="inline-flex h-11 w-full sm:w-auto items-center justify-start rounded-2xl border border-border/60 bg-muted/40 dark:bg-muted/20 p-1 text-muted-foreground gap-1"
        >
          {INTL_SUBMODULE_TABS.map((tab) => {
            const isActive = currentTab === tab.id || (tab.id === 'bodega-origen' && currentTab === 'bodega-panama');
            return (
              <button
                key={tab.id}
                type="button"
                data-active={isActive ? 'true' : undefined}
                onClick={() => handleTabChange(tab.id)}
                className={`relative inline-flex h-full flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all whitespace-nowrap select-none ${
                  isActive
                    ? 'bg-background text-primary shadow-xs dark:bg-card border border-border/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido Dinámico de la Pestaña Activa */}
      <div className="min-w-0 max-w-full">
        {(currentTab === 'bodega-origen' || currentTab === 'bodega-panama') && <OriginWarehouseTab canCreate={canCreate} />}
        {currentTab === 'contenedores' && <ContainersTab canCreate={canCreate} canEdit={canEdit} />}
        {currentTab === 'aduana-prorrateo' && (
          <CustomsProrationTab
            canApprove={canApprove}
            canCloseByException={canCloseByException}
            canReopen={canReopen}
          />
        )}
        {currentTab === 'configuracion' && (
          <IntlConfigTab canEdit={canEdit} canCreate={canCreate} canDelete={canEdit} />
        )}
      </div>
    </div>
  );
}
