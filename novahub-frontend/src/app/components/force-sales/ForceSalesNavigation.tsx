import { BarChart3, History, LayoutDashboard, MapPinned } from 'lucide-react';
import { ModuleSubnavigation } from '../ui/ModuleSubnavigation';

const FORCE_SALES_ITEMS = [
  { id: 'fuerza-comercial', label: 'Mapa comercial', icon: MapPinned },
  { id: 'fuerza-comercial-kanban', label: 'Kanban comercial', icon: LayoutDashboard },
  { id: 'fuerza-comercial-historial', label: 'Historial de visitas', icon: History },
  { id: 'fuerza-comercial-reportes', label: 'Reportes de gestores', icon: BarChart3 },
] as const;

interface ForceSalesNavigationProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule: string) => void;
  isSidebarCollapsed?: boolean;
  reportContext?: boolean;
  /** El Kanban comercial pertenece al modo Prospección: sin ese modo no se ofrece. */
  showKanban?: boolean;
}

export function ForceSalesNavigation({ activeSubModule, onSubModuleChange, isSidebarCollapsed, reportContext = false, showKanban = true }: ForceSalesNavigationProps) {
  const items = reportContext
    ? [{ id: 'reportes-gestores-cobro', label: 'Gestores de cobro', icon: BarChart3 }]
    : FORCE_SALES_ITEMS.filter((item) => showKanban || item.id !== 'fuerza-comercial-kanban');
  const activeId = items.some((item) => item.id === activeSubModule) ? activeSubModule! : items[0].id;

  return (
    <ModuleSubnavigation
      items={items.map(({ id, label, icon: Icon }) => ({ id, label, icon: <Icon className="size-4" /> }))}
      value={activeId}
      onValueChange={(value) => onSubModuleChange?.(value)}
      isSidebarCollapsed={isSidebarCollapsed}
      ariaLabel={reportContext ? 'Navegación de Reportes de Gestores' : 'Navegación de Fuerza Comercial'}
      className={reportContext ? undefined : 'mb-0'}
    />
  );
}
