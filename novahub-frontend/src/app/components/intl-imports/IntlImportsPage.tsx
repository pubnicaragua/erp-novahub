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

  return (
    <div className="space-y-6">
      {/* Header del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Globe className="size-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Importaciones Internacionales</h1>
              <p className="text-xs text-muted-foreground">
                Consolidación, trazabilidad por cubicaje CBM y prorrateo de gastos de nacionalización.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por Pestañas Superior */}
      <div className="flex items-center gap-1 border-b border-border/80 overflow-x-auto scrollbar-none pb-px">
        {INTL_SUBMODULE_TABS.map((tab) => {
          const isActive = currentTab === tab.id || (tab.id === 'bodega-origen' && currentTab === 'bodega-panama');
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                isActive
                  ? 'border-primary text-primary bg-background shadow-xs'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido Dinámico de la Pestaña Activa */}
      <div>
        {(currentTab === 'bodega-origen' || currentTab === 'bodega-panama') && <OriginWarehouseTab canCreate={canCreate} />}
        {currentTab === 'contenedores' && <ContainersTab canCreate={canCreate} />}
        {currentTab === 'aduana-prorrateo' && <CustomsProrationTab canApprove={canApprove} />}
        {currentTab === 'configuracion' && <IntlConfigTab canEdit={canEdit} />}
      </div>
    </div>
  );
}
