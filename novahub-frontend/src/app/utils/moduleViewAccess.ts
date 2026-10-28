import { ENTERPRISE_MODULE_OPTIONS } from '../constants/enterpriseModules';

export type ModuleAvailabilityState = 'VISIBLE' | 'HIDDEN' | 'DISABLED';
export type ModuleViewPolicy = { state: ModuleAvailabilityState; viewIds: string[] | null };
export type ModuleViewPolicies = Record<string, ModuleViewPolicy>;

const FRONTEND_MODULE_ALIASES: Record<string, string> = {
  DASHBOARD: 'DASHBOARD',
  VENTAS: 'SALES', COMPRAS: 'PURCHASES', INVENTARIO: 'INVENTORY',
  FINANZAS: 'FINANCIAL', CONTABILIDAD: 'ACCOUNTING', RH: 'HR',
  'CENTRO-CAPACITACION': 'HR_TRAINING', 'ASESORIA-LEGAL': 'LEGAL',
  'SOPORTE-TECNICO': 'SUPPORT_TECH', 'FINANCIAMIENTO-PYME': 'FINANCING',
  DOCUMENTOS: 'DOCUMENTS', NOTIFICACIONES: 'NOTIFICATIONS', REPORTES: 'REPORTS',
  NOVACHAT: 'NOVACHAT', ACTIVIDADES: 'ACTIVITIES', PROYECTOS: 'PROJECTS',
  'FUERZA-COMERCIAL': 'FORCE_SALES_MAP',
  'FUERZA-COMERCIAL-KANBAN': 'FORCE_SALES_KANBAN',
  'FUERZA-COMERCIAL-HISTORIAL': 'FORCE_SALES_HISTORY',
  'FUERZA-COMERCIAL-REPORTES': 'FORCE_SALES_REPORTS',
  'REPORTES-GESTORES-COBRO': 'FORCE_SALES_REPORTS',
  RESTAURANTE: 'RESTAURANT',
  TRACKING: 'TRACKING', TICKETS: 'TICKETS', ROLES: 'MY_COMPANY',
  SUSCRIPCIONES: 'MY_COMPANY', CONFIGURACION: 'CONFIGURATION',
};

const VIEW_PARENT_ALIASES: Record<string, string> = {
  IMPORT_INTL: 'TRACKING', IMPORT_INTL_ORIGIN: 'TRACKING', IMPORT_INTL_CONTAINERS: 'TRACKING',
  IMPORT_INTL_CUSTOMS: 'TRACKING', IMPORT_INTL_CONFIG: 'TRACKING',
  RETAIL_POS: 'SALES', RETAIL_CASH_CONTROL: 'SALES', SALES_POS: 'SALES', CAJA: 'SALES',
  CLIENTS: 'SALES', PROVIDERS: 'PURCHASES', FINANCIAL_ACCOUNTS: 'FINANCIAL',
  CONFIG_COMPANY: 'MY_COMPANY', CONFIG_USERS: 'MY_COMPANY', CONFIG_ROLES: 'MY_COMPANY',
  CONFIG_DEPARTMENTS: 'MY_COMPANY', CONFIG_DOMAINS: 'MY_COMPANY', SUBSCRIPTIONS: 'MY_COMPANY',
  CONFIG_BRANDING: 'CONFIGURATION', CONFIG_PDF: 'CONFIGURATION', CONFIG_SECURITY: 'CONFIGURATION',
  CONFIG_CURRENCY: 'CONFIGURATION', CONFIG_NOVA_PULSE: 'CONFIGURATION', AUDIT_LOGS: 'CONFIGURATION',
  FORCE_SALES_MAP: 'FORCE_SALES',
  FORCE_SALES_KANBAN: 'FORCE_SALES',
  FORCE_SALES_HISTORY: 'FORCE_SALES',
  FORCE_SALES_REPORTS: 'FORCE_SALES',
};

const IMPORT_INTL_VIEW_IDS = new Set([
  'IMPORT_INTL_ORIGIN', 'IMPORT_INTL_CONTAINERS', 'IMPORT_INTL_CUSTOMS', 'IMPORT_INTL_CONFIG',
]);

function normalizedId(value: unknown): string {
  const normalized = String(value || '').trim().toUpperCase();
  return FRONTEND_MODULE_ALIASES[normalized] || normalized;
}

export function canAccessModuleView(policies: unknown, moduleOrView: unknown): boolean {
  const records = policies && typeof policies === 'object' && !Array.isArray(policies)
    ? policies as Record<string, ModuleViewPolicy>
    : {};
  if (!Object.keys(records).length) return true;
  const requested = String(moduleOrView || '').trim().toUpperCase();
  const normalized = normalizedId(requested);
  let parent = VIEW_PARENT_ALIASES[normalized] || '';
  if (!parent) {
    const parentOption = ENTERPRISE_MODULE_OPTIONS.find((module) => module.id === normalized);
    if (parentOption) parent = normalized;
    else parent = ENTERPRISE_MODULE_OPTIONS
      .map((module) => module.id)
      .filter((candidate) => normalized.startsWith(`${candidate}_`))
      .sort((left, right) => right.length - left.length)[0] || '';
  }
  if (!parent) return true;
  const policy = records[parent];
  if (!policy) return true;
  if (policy.state !== 'VISIBLE') return false;
  if (!Array.isArray(policy.viewIds)) return true;
  if (normalized === parent) return false;
  return policy.viewIds.some((viewId) => String(viewId).toUpperCase() === normalized);
}

/** Keep the module container in navigation when at least one child view is allowed. */
export function canAccessModuleShell(policies: unknown, moduleOrView: unknown): boolean {
  const records = policies && typeof policies === 'object' && !Array.isArray(policies)
    ? policies as Record<string, ModuleViewPolicy>
    : {};
  if (!Object.keys(records).length) return true;
  const requested = String(moduleOrView || '').trim().toUpperCase();
  const normalized = normalizedId(requested);
  let parent = VIEW_PARENT_ALIASES[normalized] || '';
  if (!parent) {
    const parentOption = ENTERPRISE_MODULE_OPTIONS.find((module) => module.id === normalized);
    if (parentOption) parent = normalized;
    else parent = ENTERPRISE_MODULE_OPTIONS
      .map((module) => module.id)
      .filter((candidate) => normalized.startsWith(`${candidate}_`))
      .sort((left, right) => right.length - left.length)[0] || '';
  }
  if (!parent) return true;
  const policy = records[parent];
  if (!policy) return true;
  if (policy.state !== 'VISIBLE') return false;
  if (!Array.isArray(policy.viewIds)) return true;
  if (normalized === 'IMPORT_INTL') {
    return policy.viewIds.some((viewId) => IMPORT_INTL_VIEW_IDS.has(String(viewId).toUpperCase()));
  }
  if (normalized !== parent) return policy.viewIds.some((viewId) => String(viewId).toUpperCase() === normalized);
  return policy.viewIds.length > 0;
}
