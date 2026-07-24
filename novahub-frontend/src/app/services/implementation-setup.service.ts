import { api } from './api';

export type ImplementationStatus = 'pending' | 'in_progress' | 'completed' | 'error';
export type ImplementationSetupAction =
  | 'open-company-settings'
  | 'open-currency-settings'
  | 'open-role-settings'
  | 'open-warehouse-form'
  | 'open-branch-form'
  | 'open-cash-register-form'
  | 'validate-setup';

export interface ImplementationNavigationTarget {
  module: string;
  subModule?: string;
  action?: ImplementationSetupAction;
}

export interface ImplementationStep {
  id: string;
  order: number;
  title: string;
  description: string;
  actionLabel: string;
  target: ImplementationNavigationTarget;
  required: boolean;
  status: ImplementationStatus;
  validCount: number;
  discardedCount: number;
  lastLoadedAt?: string;
  error?: string;
}

interface StepDefinition {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  target: ImplementationNavigationTarget;
  required?: boolean;
  load: () => Promise<unknown>;
  minCount?: number;
  isComplete?: (value: unknown) => boolean;
  count?: (value: unknown) => number;
}

export interface ImplementationSetupSummary {
  steps: ImplementationStep[];
  totalSteps: number;
  completedSteps: number;
  requiredSteps: number;
  completedRequiredSteps: number;
  hasBlockingErrors: boolean;
  isComplete: boolean;
}

export interface ImplementationTourContext {
  stepId: string;
  module: string;
  subModule?: string;
  action?: ImplementationSetupAction;
  tourActive: boolean;
  createdAt: number;
}

export const IMPLEMENTATION_TOUR_STORAGE_KEY = 'novahub:implementation-setup-tour';
const STEP_VALIDATION_TIMEOUT_MS = 2500;
const SUMMARY_CACHE_TTL_MS = 45000;
let cachedSummary: { value: ImplementationSetupSummary; createdAt: number; moduleKey: string } | null = null;

export function rememberImplementationTourContext(context: Omit<ImplementationTourContext, 'createdAt'>) {
  sessionStorage.setItem(IMPLEMENTATION_TOUR_STORAGE_KEY, JSON.stringify({
    ...context,
    createdAt: Date.now(),
  }));
}

export function consumeImplementationTourContext(module: string, subModule?: string) {
  const raw = sessionStorage.getItem(IMPLEMENTATION_TOUR_STORAGE_KEY);
  if (!raw) return null;

  try {
    const context = JSON.parse(raw) as ImplementationTourContext;
    const isStale = Date.now() - context.createdAt > 30000;
    const sameModule = context.module === module;
    const sameSubModule = !context.subModule || !subModule || context.subModule === subModule;

    if (isStale || (sameModule && sameSubModule)) {
      sessionStorage.removeItem(IMPLEMENTATION_TOUR_STORAGE_KEY);
    }

    return !isStale && sameModule && sameSubModule ? context : null;
  } catch {
    sessionStorage.removeItem(IMPLEMENTATION_TOUR_STORAGE_KEY);
    return null;
  }
}

function normalizeList(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (Array.isArray((value as any)?.data)) return (value as any).data;
  if (Array.isArray((value as any)?.items)) return (value as any).items;
  if (Array.isArray((value as any)?.results)) return (value as any).results;
  return [];
}

function countRecords(value: unknown) {
  const record = value as any;
  if (typeof record?.total === 'number') return record.total;
  if (typeof record?.count === 'number') return record.count;
  return normalizeList(value).length;
}

function latestDate(value: unknown) {
  const dates = normalizeList(value)
    .flatMap((item) => [item?.updatedAt, item?.createdAt, item?.date, item?.openedAt])
    .filter(Boolean)
    .map((date) => new Date(date).getTime())
    .filter((time) => Number.isFinite(time));

  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates)).toISOString();
}

function hasAccountingConfig(value: unknown) {
  const config = value as Record<string, unknown> | null;
  if (!config || typeof config !== 'object') return false;
  return Object.values(config).some((item) => item !== null && item !== undefined && item !== '');
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo validar este paso.';
}

const STEP_DEFINITIONS: StepDefinition[] = [
  {
    id: 'company-profile',
    title: 'Configurar datos de la empresa',
    description: 'Nombre comercial, logo, datos fiscales y datos base del tenant.',
    actionLabel: 'Configurar',
    target: { module: 'configuracion', subModule: 'empresa', action: 'open-company-settings' },
    load: () => api.get('/branding/current'),
    isComplete: (value) => {
      const branding = value as any;
      return Boolean(branding?.companyName || branding?.name || branding?.logo);
    },
    count: (value) => {
      const branding = value as any;
      return ['companyName', 'name', 'logo', 'primaryColor'].filter((key) => Boolean(branding?.[key])).length;
    },
  },
  {
    id: 'financial-settings',
    title: 'Configurar moneda, impuestos, bancos y cuentas financieras',
    description: 'Cuentas financieras y base monetaria para ventas, compras y reportes.',
    actionLabel: 'Configurar',
    target: { module: 'configuracion', subModule: 'currency', action: 'open-currency-settings' },
    load: () => api.get('/financials/accounts'),
  },
  {
    id: 'users-permissions',
    title: 'Crear usuarios, roles y permisos',
    description: 'Usuarios internos, roles operativos y permisos por modulo.',
    actionLabel: 'Crear roles',
    target: { module: 'configuracion', subModule: 'roles', action: 'open-role-settings' },
    load: async () => {
      const [users, roles] = await Promise.all([
        api.get('/users').catch(() => []),
        api.get('/roles').catch(() => []),
      ]);
      return [...normalizeList(users), ...normalizeList(roles)];
    },
  },
  {
    id: 'warehouses',
    title: 'Crear almacenes o bodegas',
    description: 'Ubicaciones fisicas o logicas donde se controla inventario.',
    actionLabel: 'Crear almacen',
    target: { module: 'inventario', subModule: 'almacenes', action: 'open-warehouse-form' },
    load: () => api.get('/inventory/warehouses'),
  },
  {
    id: 'branches',
    title: 'Crear sucursales que se alimenten del almacen',
    description: 'Puntos operativos conectados a uno o varios almacenes.',
    actionLabel: 'Crear sucursal',
    target: { module: 'inventario', subModule: 'almacenes', action: 'open-branch-form' },
    load: () => api.get('/sucursales'),
  },
  {
    id: 'cash-registers',
    title: 'Crear cajas y asignar accesos',
    description: 'Cajas por sucursal, permisos de uso, apertura y cierre.',
    actionLabel: 'Configurar cajas',
    target: { module: 'ventas', subModule: 'control-caja', action: 'open-cash-register-form' },
    load: () => api.get('/caja/registers', { params: { all: 'true' } }),
  },
  {
    id: 'customers',
    title: 'Importar clientes',
    description: 'Clientes empresa, naturales o consumidor final con RUC/cedula cuando aplique.',
    actionLabel: 'Importar',
    target: { module: 'ventas', subModule: 'clientes' },
    load: () => api.get('/sales/customers'),
  },
  {
    id: 'estimates',
    title: 'Importar cotizaciones/proformas',
    description: 'Cotizaciones conectadas a clientes por RUC, cedula, codigo o correo.',
    actionLabel: 'Importar',
    target: { module: 'ventas', subModule: 'estimaciones' },
    load: () => api.get('/sales/estimates'),
  },
  {
    id: 'customer-invoices',
    title: 'Importar facturas de clientes',
    description: 'Facturas historicas matcheadas al cliente correcto.',
    actionLabel: 'Importar',
    target: { module: 'ventas', subModule: 'facturas' },
    load: () => api.get('/sales/invoices'),
  },
  {
    id: 'received-payments',
    title: 'Importar pagos recibidos y saldos por cobrar',
    description: 'Pagos, abonos y saldos iniciales de cartera.',
    actionLabel: 'Importar',
    target: { module: 'ventas', subModule: 'pagos-recibidos' },
    load: () => api.get('/sales/payments'),
  },
  {
    id: 'suppliers',
    title: 'Importar proveedores',
    description: 'Directorio de proveedores con identificacion fiscal y condiciones.',
    actionLabel: 'Importar',
    target: { module: 'compras', subModule: 'proveedores' },
    load: () => api.get('/purchases/suppliers'),
  },
  {
    id: 'supplier-invoices',
    title: 'Importar facturas de proveedor',
    description: 'Cuentas por pagar conectadas al proveedor correcto.',
    actionLabel: 'Importar',
    target: { module: 'compras', subModule: 'facturas-proveedor' },
    load: () => api.get('/purchases/invoices'),
  },
  {
    id: 'expenses',
    title: 'Importar gastos',
    description: 'Gastos operativos clasificados por categoria y cuenta.',
    actionLabel: 'Importar',
    target: { module: 'compras', subModule: 'gastos' },
    load: () => api.get('/purchases/expenses'),
  },
  {
    id: 'products',
    title: 'Importar productos/catalogo',
    description: 'SKU, precios, costos, impuestos, categorias y datos comerciales.',
    actionLabel: 'Importar',
    target: { module: 'inventario', subModule: 'productos' },
    load: () => api.get('/inventory/products'),
  },
  {
    id: 'initial-stock',
    title: 'Importar inventario inicial por almacen',
    description: 'Existencias iniciales, lotes, series o IMEI por bodega.',
    actionLabel: 'Importar stock',
    target: { module: 'inventario', subModule: 'ajustes' },
    load: () => api.get('/inventory/stock'),
  },
  {
    id: 'employees',
    title: 'Importar empleados',
    description: 'Colaboradores, cargos, departamentos y datos laborales.',
    actionLabel: 'Importar',
    target: { module: 'rh', subModule: 'empleados' },
    load: () => api.get('/hr/employees'),
  },
  {
    id: 'payroll-config',
    title: 'Configurar planilla',
    description: 'Reglas de nomina, deducciones, beneficios y periodos.',
    actionLabel: 'Configurar',
    target: { module: 'rh', subModule: 'config-nomina' },
    load: () => api.get('/hr/payroll-config'),
  },
  {
    id: 'accounting-chart',
    title: 'Configurar catalogo contable',
    description: 'Plan de cuentas que alimenta reportes y asientos.',
    actionLabel: 'Configurar',
    target: { module: 'contabilidad', subModule: 'plan-cuentas' },
    load: () => api.get('/accounting/accounts'),
  },
  {
    id: 'automatic-accounts',
    title: 'Configurar cuentas contables automaticas',
    description: 'Cuentas puente para ventas, compras, bancos, IVA e inventario.',
    actionLabel: 'Configurar',
    target: { module: 'contabilidad', subModule: 'configuracion' },
    load: () => api.get('/accounting/config'),
    isComplete: hasAccountingConfig,
    count: (value) => Object.values((value as any) || {}).filter(Boolean).length,
  },
  {
    id: 'opening-journals',
    title: 'Importar asientos contables iniciales',
    description: 'Saldos iniciales y asiento de apertura balanceado.',
    actionLabel: 'Importar',
    target: { module: 'contabilidad', subModule: 'diario' },
    load: () => api.get('/accounting/journals'),
  },
];

function hasModuleAccess(target: ImplementationNavigationTarget, enabledModules?: string[]) {
  if (!enabledModules) return true;
  if (target.module === 'overview') return true;

  const has = (...modules: string[]) => modules.some((module) => enabledModules.includes(module));
  const subModule = target.subModule || '';

  if (target.module === 'configuracion') {
    const configModule = subModule === 'empresa' ? 'CONFIG_COMPANY' : subModule === 'currency' ? 'CONFIG_CURRENCY' : subModule === 'roles' ? 'CONFIG_ROLES' : 'CONFIGURATION';
    return has('CONFIGURATION', configModule, 'CONFIG_TENANCY', 'CONFIG_USERS');
  }
  if (target.module === 'ventas') {
    const salesModule = subModule === 'clientes' ? 'SALES_CLIENTS' : subModule === 'estimaciones' ? 'SALES_QUOTES' : subModule === 'facturas' ? 'SALES_INVOICES' : subModule === 'pagos-recibidos' ? 'SALES_PAYMENTS' : subModule === 'control-caja' ? 'RETAIL_POS' : 'SALES';
    return has('SALES', salesModule, 'SALES_POS');
  }
  if (target.module === 'inventario') {
    const inventoryModule = subModule === 'productos' ? 'INVENTORY_PRODUCTS' : subModule === 'almacenes' ? 'INVENTORY_WAREHOUSES' : subModule === 'ajustes' ? 'INVENTORY_ADJUSTMENTS' : 'INVENTORY';
    return has('INVENTORY', inventoryModule);
  }
  if (target.module === 'compras') {
    const purchasingModule = subModule === 'proveedores' ? 'PURCHASES_PROVIDERS' : subModule === 'facturas-proveedor' ? 'PURCHASES_INVOICES' : subModule === 'gastos' ? 'PURCHASES_EXPENSES' : 'PURCHASES';
    return has('PURCHASES', purchasingModule);
  }
  if (target.module === 'rh') return has('HR', 'HR_EMPLOYEES', 'HR_PAYROLL', 'HR_PAYROLL_CONFIG');
  if (target.module === 'contabilidad') return has('ACCOUNTING', 'ACCOUNTING_CHART', 'ACCOUNTING_JOURNAL', 'ACCOUNTING_CONFIG');
  return true;
}

export async function getImplementationSetupSummary(forceRefresh = false, enabledModules?: string[]): Promise<ImplementationSetupSummary> {
  const moduleKey = enabledModules ? [...enabledModules].sort().join('|') : '*';
  if (!forceRefresh && cachedSummary && cachedSummary.moduleKey === moduleKey && Date.now() - cachedSummary.createdAt < SUMMARY_CACHE_TTL_MS) {
    return cachedSummary.value;
  }

  const activeDefinitions = STEP_DEFINITIONS.filter((definition) => hasModuleAccess(definition.target, enabledModules));
  const settled = await Promise.allSettled(activeDefinitions.map((definition) =>
    Promise.race([
      definition.load(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error('La validacion de este paso tardó más de lo esperado. Intenta entrar al modulo para revisar el dato.')), STEP_VALIDATION_TIMEOUT_MS);
      }),
    ])
  ));

  const baseSteps = activeDefinitions.map<ImplementationStep>((definition, index) => {
    const result = settled[index];
    if (result.status === 'rejected') {
      return {
        id: definition.id,
        order: index + 1,
        title: definition.title,
        description: definition.description,
        actionLabel: definition.actionLabel,
        target: definition.target,
        required: definition.required !== false,
        status: 'error',
        validCount: 0,
        discardedCount: 1,
        error: getErrorMessage(result.reason),
      };
    }

    const validCount = definition.count?.(result.value) ?? countRecords(result.value);
    const minCount = definition.minCount ?? 1;
    const completed = definition.isComplete?.(result.value) ?? validCount >= minCount;
    const status: ImplementationStatus = completed ? 'completed' : validCount > 0 ? 'in_progress' : 'pending';

    return {
      id: definition.id,
      order: index + 1,
      title: definition.title,
      description: definition.description,
      actionLabel: definition.actionLabel,
      target: definition.target,
      required: definition.required !== false,
      status,
      validCount,
      discardedCount: 0,
      lastLoadedAt: latestDate(result.value),
    };
  });

  const completedBaseSteps = baseSteps.filter((step) => step.status === 'completed').length;
  const hasBlockingErrors = baseSteps.some((step) => step.required && step.status === 'error');
  const allRequiredBaseStepsComplete = baseSteps.every((step) => !step.required || step.status === 'completed');

  const consistencyStep: ImplementationStep = {
    id: 'consistency-check',
    order: baseSteps.length + 1,
    title: 'Validar consistencia general del ERP',
    description: 'Revisar que no existan datos huerfanos, saldos incompletos o configuraciones pendientes.',
    actionLabel: 'Validar',
    target: { module: 'overview', action: 'validate-setup' },
    required: true,
    status: hasBlockingErrors ? 'error' : allRequiredBaseStepsComplete ? 'completed' : 'pending',
    validCount: completedBaseSteps,
    discardedCount: hasBlockingErrors ? baseSteps.filter((step) => step.status === 'error').length : 0,
  };

  const finishStep: ImplementationStep = {
    id: 'finish-launch',
    order: baseSteps.length + 2,
    title: 'Finalizar puesta en marcha y mostrar dashboard',
    description: 'Cuando todo este completo, NovaHub oculta esta guia y muestra el dashboard operativo.',
    actionLabel: 'Ver dashboard',
    target: { module: 'overview' },
    required: true,
    status: consistencyStep.status === 'completed' ? 'completed' : 'pending',
    validCount: consistencyStep.status === 'completed' ? 1 : 0,
    discardedCount: 0,
  };

  const steps = [...baseSteps, consistencyStep, finishStep];
  const requiredSteps = steps.filter((step) => step.required);
  const completedRequiredSteps = requiredSteps.filter((step) => step.status === 'completed').length;

  const summary = {
    steps,
    totalSteps: steps.length,
    completedSteps: steps.filter((step) => step.status === 'completed').length,
    requiredSteps: requiredSteps.length,
    completedRequiredSteps,
    hasBlockingErrors,
    isComplete: completedRequiredSteps === requiredSteps.length,
  };

  cachedSummary = { value: summary, createdAt: Date.now(), moduleKey };
  return summary;
}
