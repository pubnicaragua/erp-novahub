import { SIDEBAR_PERMISSION_SUBMODULES } from '../utils/sidebarPermissions';

export interface Submodule {
  id: string;
  label: string;
  description: string;
}

export interface Module {
  id: string;
  label: string;
  icon: any;
  description: string;
  submodules?: Submodule[];
}

const submodulesFor = (parent: string): Submodule[] => SIDEBAR_PERMISSION_SUBMODULES
  .filter((submodule) => submodule.parent === parent)
  .map((submodule) => ({ ...submodule, description: `Vista de ${submodule.label}` }));

// Compatibilidad para consumidores antiguos: las listas ya salen del mismo
// catálogo del sidebar y no pueden volver a incluir vistas internas obsoletas.
export const SALES_SUBMODULES = submodulesFor('SALES');
export const PURCHASES_SUBMODULES = submodulesFor('PURCHASES');
export const INVENTORY_SUBMODULES = submodulesFor('INVENTORY');
export const FINANCIAL_SUBMODULES = submodulesFor('FINANCIAL');
export const HR_SUBMODULES = submodulesFor('HR');
export const NOTIFICATIONS_SUBMODULES = submodulesFor('NOTIFICATIONS');
export const ACTIVITIES_SUBMODULES = submodulesFor('ACTIVITIES');
export const DOCUMENTS_SUBMODULES = submodulesFor('DOCUMENTS');
export const REPORTS_SUBMODULES = submodulesFor('REPORTS');
export const ACCOUNTING_SUBMODULES = submodulesFor('ACCOUNTING');
