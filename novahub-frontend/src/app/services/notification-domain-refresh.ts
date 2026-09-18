import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Notification } from '../types';
import { getNotificationNavigation, type NotificationNavigation } from '../utils/notificationNavigation';

export const NOTIFICATION_DOMAIN_REFRESH_EVENT = 'notification-domain-refresh';

export interface NotificationDomainRefreshDetail {
  notificationId: string;
  navigation: NotificationNavigation;
  targetId?: string;
  number?: string;
  entityType?: string;
  action?: string;
  status?: string;
  previousStatus?: string;
  newStatus?: string;
  sourceId?: string;
  sourceType?: string;
  branchId?: string;
  warehouseId?: string;
  aggregateCount?: number;
}

const asSubModule = (value?: string) => String(value || '').trim().toLowerCase();

const canonicalSubModule = (module: string, subModule?: string) => {
  const value = asSubModule(subModule);
  if (module === 'ventas' && value === 'cotizaciones') return 'estimaciones';
  if (module === 'compras' && value === 'solicitudes-compra') return 'solicitudes';
  if (module === 'compras' && value === 'ordenes-compra') return 'ordenes';
  if (module === 'compras' && value === 'gastos-recurrentes') return 'gastos-rec';
  if (module === 'compras' && value === 'facturas-recurrentes') return 'facturas-rec';
  if (module === 'rh' || module === 'rrhh' || module === 'recursos-humanos') {
    const aliases: Record<string, string> = {
      'dashboard-hr': 'dashboard',
      'configuracion-nomina': 'config-nomina',
      'payroll-config': 'config-nomina',
      'tipos-ausencia': 'ausencias-config',
      'absence-types': 'ausencias-config',
      payroll: 'nominas',
      attendance: 'asistencia',
      leaves: 'ausencias',
      'leave-requests': 'ausencias',
      evaluation: 'evaluaciones',
      reviews: 'evaluaciones',
      performance: 'evaluaciones',
      training: 'capacitaciones',
      trainings: 'capacitaciones',
      benefits: 'beneficios',
      benefit: 'beneficios',
      'payroll-settings': 'config-nomina',
    };
    return aliases[value] || value;
  }
  if (module === 'restaurante' || module === 'restaurant') {
    const aliases: Record<string, string> = {
      tables: 'salon',
      orders: 'comandas',
      kitchen: 'cocina',
      menu: 'carta',
      reports: 'reportes',
    };
    return aliases[value] || value;
  }
  if (module === 'tracking' || module === 'logistica' || module === 'logistics') {
    const aliases: Record<string, string> = {
      'tracking-recepcion': 'reception',
      'tracking-lotes': 'batches',
      'tracking-paquetes': 'packages',
      'tracking-conciliacion': 'reconciliation',
      'tracking-facturacion': 'billing',
      'tracking-configuracion': 'config',
      transit: 'transit',
      reception: 'reception',
      batches: 'batches',
      packages: 'packages',
      reconciliation: 'reconciliation',
      billing: 'billing',
      config: 'config',
    };
    return aliases[value] || value;
  }
  if (module === 'finanzas' || module === 'finance' || module === 'financials') {
    const aliases: Record<string, string> = {
      'resumen-financiero': 'resumen',
      'caja-bancos': 'caja-bancos',
      bancos: 'caja-bancos',
      'cuentas-por-cobrar': 'cuentas-cobrar',
      'cuentas-por-pagar': 'cuentas-pagar',
      'gastos-recurrentes': 'recurrentes',
      'movimientos-recurrentes': 'recurrentes',
      'ingresos-recurrentes': 'ingresos-recurrentes',
      'diario-financiero': 'diario-financiero',
      'libro-mayor-financiero': 'libro-mayor-financiero',
      balance: 'balance-general',
    };
    return aliases[value] || value;
  }
  if (module === 'contabilidad' || module === 'accounting') {
    const aliases: Record<string, string> = {
      cuentas: 'plan-cuentas',
      'libro-diario': 'diario',
      asientos: 'diario',
      'balance-general': 'balance-general-contable',
      conciliaciones: 'conciliacion',
      'reportes-fiscales': 'reportes-fiscales',
      'categorias-gastos': 'categorias-gastos',
      configuration: 'configuracion',
      config: 'configuracion',
    };
    return aliases[value] || value;
  }
  return value;
};

const scoped = (domain: string, resource: string, tenantKey: string): QueryKey => [domain, resource, tenantKey];
const accountingScoped = (resource: string, tenantKey: string): QueryKey => ['accounting', tenantKey, resource];

/**
 * Returns prefixes instead of full keys so every active page/filter variant
 * is refreshed while its current local state remains untouched.
 */
export function getNotificationDomainQueryKeys(navigation: NotificationNavigation, tenantKey: string): QueryKey[] {
  const module = asSubModule(navigation.module);
  const subModule = canonicalSubModule(module, navigation.subModule);

  if (module === 'ventas') {
    const salesKeys: Record<string, QueryKey[]> = {
      clientes: [scoped('sales', 'customers', tenantKey), scoped('sales', 'customers-catalog', tenantKey)],
      estimaciones: [scoped('sales', 'estimates', tenantKey)],
      'ordenes-venta': [scoped('sales', 'orders', tenantKey)],
      facturas: [
        scoped('sales', 'invoices', tenantKey),
        scoped('sales', 'invoices-payment-catalog', tenantKey),
        scoped('sales', 'invoices-return-catalog', tenantKey),
      ],
      'facturas-recurrentes': [scoped('sales', 'recurring-invoices', tenantKey)],
      'pagos-recibidos': [scoped('sales', 'payments', tenantKey)],
      'devoluciones-venta': [scoped('sales', 'returns', tenantKey)],
      'notas-credito': [
        scoped('sales', 'credit-notes', tenantKey),
        scoped('sales', 'credit-notes-payment-catalog', tenantKey),
      ],
      'listas-precios': [['sales', 'price-lists']],
    };
    return salesKeys[subModule] || [];
  }

  if (module === 'compras') {
    const purchaseKeys: Record<string, QueryKey[]> = {
      proveedores: [scoped('purchases', 'suppliers', tenantKey), scoped('purchases', 'suppliers-catalog', tenantKey)],
      solicitudes: [scoped('purchases', 'requests', tenantKey)],
      gastos: [scoped('purchases', 'expenses', tenantKey)],
      'gastos-rec': [scoped('purchases', 'recurring-expenses', tenantKey)],
      ordenes: [scoped('purchases', 'orders', tenantKey), scoped('purchases', 'orders-catalog', tenantKey)],
      recepciones: [scoped('purchases', 'receipts', tenantKey)],
      'facturas-rec': [scoped('purchases', 'recurring-invoices', tenantKey)],
      pagos: [scoped('purchases', 'payments', tenantKey), scoped('purchases', 'invoices-catalog', tenantKey)],
      creditos: [scoped('purchases', 'credit-invoices', tenantKey)],
    };
    return purchaseKeys[subModule] || [];
  }

  if (module === 'inventario') {
    const inventoryKeys: Record<string, QueryKey[]> = {
      productos: [
        scoped('inventory', 'products', tenantKey),
        scoped('inventory', 'products-summary', tenantKey),
        scoped('inventory', 'products-catalog', tenantKey),
        scoped('inventory', 'series', tenantKey),
      ],
      servicios: [scoped('inventory', 'products', tenantKey), scoped('inventory', 'products-summary', tenantKey), scoped('inventory', 'products-catalog', tenantKey)],
      atributos: [scoped('inventory', 'categories', tenantKey)],
      almacenes: [scoped('inventory', 'warehouses', tenantKey), scoped('inventory', 'linked-warehouses', tenantKey)],
      transferencias: [scoped('inventory', 'transfers', tenantKey), scoped('inventory', 'products', tenantKey), scoped('inventory', 'products-summary', tenantKey), scoped('inventory', 'movements', tenantKey)],
      ajustes: [scoped('inventory', 'adjustments', tenantKey), scoped('inventory', 'pending-audits-for-adjustments', tenantKey), scoped('inventory', 'products', tenantKey), scoped('inventory', 'products-summary', tenantKey), scoped('inventory', 'movements', tenantKey)],
      auditorias: [scoped('inventory', 'audits', tenantKey), scoped('inventory', 'pending-audits-for-adjustments', tenantKey), scoped('inventory', 'adjustments', tenantKey)],
      movimientos: [scoped('inventory', 'movements', tenantKey), scoped('inventory', 'products', tenantKey), scoped('inventory', 'products-summary', tenantKey)],
      perdidas: [scoped('inventory', 'losses', tenantKey), scoped('inventory', 'products', tenantKey), scoped('inventory', 'products-summary', tenantKey)],
      'marcas-clientes': [scoped('inventory', 'brand-customer-mappings', tenantKey)],
      'mobiliario-equipos': [accountingScoped('company-assets', tenantKey)],
      configuracion: [scoped('inventory', 'warehouses', tenantKey), ['accounting', tenantKey]],
    };
    return inventoryKeys[subModule] || [];
  }

  if (module === 'rh' || module === 'rrhh' || module === 'recursos-humanos') {
    const hrKeys: Record<string, QueryKey[]> = {
      dashboard: [['hr', 'dashboard']],
      empleados: [['hr', 'empleados'], ['hr', 'dashboard'], ['hr', 'departamentos']],
      departamentos: [['hr', 'departamentos'], ['hr', 'empleados'], ['hr', 'dashboard']],
      nominas: [['hr', 'nominas'], ['hr', 'dashboard'], ['hr', 'comisiones']],
      comisiones: [['hr', 'comisiones'], ['hr', 'nominas']],
      asistencia: [['hr', 'asistencia'], ['hr', 'dashboard']],
      ausencias: [['hr', 'ausencias'], ['hr', 'vacation-balance'], ['hr', 'absence-types'], ['hr', 'dashboard']],
      'ausencias-config': [['hr', 'absence-types'], ['hr', 'ausencias'], ['hr', 'dashboard']],
      evaluaciones: [['hr', 'evaluaciones'], ['hr', 'dashboard']],
      kpi: [['hr', 'kpi-data'], ['hr', 'kpi'], ['hr', 'dashboard']],
      capacitaciones: [['hr', 'capacitaciones'], ['hr', 'dashboard']],
      beneficios: [['hr', 'beneficios'], ['hr', 'dashboard']],
      'config-nomina': [['hr', 'payroll-config', 'active'], ['hr', 'nominas'], ['hr', 'dashboard']],
    };
    return hrKeys[subModule] || [];
  }

  if (module === 'finanzas' || module === 'finance' || module === 'financials') {
    const financeBase = [
      scoped('finance', 'accounts', tenantKey),
      scoped('finance', 'accounting-mappings', tenantKey),
    ];
    const financeKeys: Record<string, QueryKey[]> = {
      resumen: [scoped('finance', 'income', tenantKey), scoped('finance', 'expenses', tenantKey), scoped('finance', 'recurring-expenses', tenantKey), scoped('finance', 'recurring-incomes', tenantKey), ...financeBase],
      'caja-bancos': [scoped('finance', 'bank-accounts', tenantKey), scoped('finance', 'bank-account-movements', tenantKey), scoped('finance', 'transactions', tenantKey), scoped('finance', 'sales-invoices-lookup', tenantKey), scoped('finance', 'supplier-invoices-lookup', tenantKey), scoped('finance', 'payments-made', tenantKey), ...financeBase],
      'cuentas-cobrar': [scoped('finance', 'income', tenantKey), scoped('finance', 'sales-invoices', tenantKey), scoped('finance', 'sales-invoices-lookup', tenantKey)],
      'cuentas-pagar': [scoped('finance', 'expenses', tenantKey), scoped('finance', 'supplier-invoices', tenantKey), scoped('finance', 'supplier-invoices-lookup', tenantKey)],
      ingresos: [scoped('finance', 'income', tenantKey), ...financeBase],
      gastos: [scoped('finance', 'expenses', tenantKey), ...financeBase],
      recurrentes: [scoped('finance', 'recurring-expenses', tenantKey), scoped('finance', 'expenses', tenantKey), ...financeBase],
      'ingresos-recurrentes': [scoped('finance', 'recurring-incomes', tenantKey), scoped('finance', 'income', tenantKey), ...financeBase],
      'diario-financiero': [scoped('finance', 'journals', tenantKey), scoped('finance', 'income', tenantKey), scoped('finance', 'expenses', tenantKey)],
      'libro-mayor-financiero': [scoped('finance', 'transactions', tenantKey), ...financeBase],
      calendario: [scoped('finance', 'recurring-expenses', tenantKey), scoped('finance', 'recurring-incomes', tenantKey)],
      analisis: [scoped('finance', 'income', tenantKey), scoped('finance', 'expenses', tenantKey), ...financeBase],
      'balance-general': [scoped('finance', 'income', tenantKey), scoped('finance', 'expenses', tenantKey), scoped('finance', 'balance', tenantKey), ...financeBase],
      perdidas: [scoped('finance', 'expenses', tenantKey), scoped('finance', 'losses', tenantKey), ['inventory', 'losses', 'finanzas', tenantKey]],
    };
    return financeKeys[subModule] || financeBase;
  }

  if (module === 'contabilidad' || module === 'accounting') {
    const accountingKeys: Record<string, QueryKey[]> = {
      'plan-cuentas': [accountingScoped('accounts', tenantKey), accountingScoped('suggested-accounts', tenantKey)],
      diario: [accountingScoped('journals', tenantKey), accountingScoped('module-activity', tenantKey)],
      'libro-mayor': [accountingScoped('ledger', tenantKey), accountingScoped('accounts', tenantKey)],
      'balance-comprobacion': [accountingScoped('trial-balance', tenantKey), accountingScoped('accounts', tenantKey)],
      'estado-resultados': [accountingScoped('profit-loss', tenantKey), accountingScoped('accounts', tenantKey)],
      'balance-general-contable': [accountingScoped('balance-sheet', tenantKey), accountingScoped('accounts', tenantKey)],
      'flujo-efectivo': [accountingScoped('cash-flow', tenantKey), accountingScoped('bank-accounts', tenantKey), accountingScoped('config', tenantKey)],
      'diferencias-cambiarias': [accountingScoped('exchange-differences', tenantKey), accountingScoped('journals', tenantKey)],
      'cambios-patrimonio': [accountingScoped('equity-changes', tenantKey), accountingScoped('accounts', tenantKey)],
      'activos-fijos': [accountingScoped('fixed-assets', tenantKey), accountingScoped('fixed-asset-details', tenantKey), accountingScoped('fixed-asset-categories', tenantKey)],
      'libro-bancos': [accountingScoped('bank-accounts', tenantKey), accountingScoped('bank-account-movements', tenantKey), accountingScoped('bank-daily-book', tenantKey)],
      conciliacion: [accountingScoped('reconciliations', tenantKey), accountingScoped('reconciliation-detail', tenantKey), accountingScoped('bank-accounts', tenantKey)],
      periodos: [accountingScoped('periods', tenantKey), accountingScoped('journals', tenantKey)],
      'reportes-fiscales': [accountingScoped('fiscal-reports', tenantKey)],
      'auditoria-facturas': [accountingScoped('invoice-audit', tenantKey), accountingScoped('invoice-audit-history', tenantKey), ['invoice-audit'], ['invoice-audit-history'], ['invoice-cancellation-requests']],
      presupuestos: [accountingScoped('budget-items', tenantKey)],
      'centros-costos': [accountingScoped('cost-centers', tenantKey), accountingScoped('budget-items', tenantKey)],
      'categorias-gastos': [accountingScoped('expense-categories', tenantKey)],
      configuracion: [accountingScoped('config', tenantKey), accountingScoped('accounts', tenantKey), accountingScoped('tax-catalog', tenantKey), accountingScoped('cost-centers', tenantKey)],
      'solicitudes-pago': [['hr-payment-requests']],
    };
    return accountingKeys[subModule] || [accountingScoped('accounts', tenantKey)];
  }

  if (module === 'actividades' || module === 'activities') return [];

  if (module === 'proyectos' || module === 'projects') {
    const projectKeys: Record<string, QueryKey[]> = {
      proyectos: [['projects', 'list'], ['tenant-module', 'projects']],
      tareas: [['projects', 'tasks', navigation.targetId], ['tenant-module', 'projects']],
      hitos: [['projects', 'milestones', navigation.targetId], ['tenant-module', 'projects']],
      presupuesto: [['projects', 'budget', navigation.targetId], ['tenant-module', 'projects']],
      costos: [['projects', 'costs', navigation.targetId], ['tenant-module', 'projects']],
      miembros: [['projects', 'members', navigation.targetId], ['tenant-module', 'projects']],
      documentos: [['projects', 'documents', navigation.targetId], ['tenant-module', 'projects']],
      actividades: [['projects', 'activities', navigation.targetId], ['tenant-module', 'projects']],
    };
    return [...(projectKeys[subModule] || [['projects']]), ...(navigation.targetId ? [['projects', 'detail', navigation.targetId] as QueryKey] : [])];
  }

  if (module === 'tickets') return [['tickets'], ['tenant-module', 'tickets']];
  if (module === 'soporte-tecnico' || module === 'support') return [['technical-support'], ['tenant-module', 'support-tickets']];
  if (module === 'asesoria-legal' || module === 'legal') return [
    ['legal', 'cases'], ['legal', 'reminders'],
    ...(navigation.targetId ? [['legal', 'case', navigation.targetId] as QueryKey, ['legal', 'messages', navigation.targetId] as QueryKey] : []),
  ];
  if (module === 'financiamiento-pyme' || module === 'financing') return [
    ['financing', 'applications'],
    ...(navigation.targetId ? [['financing', 'application', navigation.targetId] as QueryKey] : []),
  ];
  if (module === 'documentos' || module === 'documents') return [['documents'], ['documents', subModule || 'all']];
  if (module === 'novachat' || module === 'nova-chat') return [
    ['novachat', 'inbox'],
    ...(navigation.targetId ? [['novachat', 'messages', navigation.targetId] as QueryKey] : []),
  ];
  if (module === 'suscripciones' || module === 'mi-sucursal' || module === 'my-company') return [
    ['my-company'],
    ['my-company-detail'],
    ['tenant-module', 'my-company'],
  ];

  // Restaurante y Tracking mantienen datos locales en sus vistas. El evento
  // interno se encarga de actualizar únicamente el componente montado.
  if (module === 'restaurante' || module === 'restaurant' || module === 'tracking' || module === 'logistica' || module === 'logistics') {
    return [];
  }

  if (module === 'contabilidad' && subModule === 'solicitudes-pago') {
    return [['hr-payment-requests']];
  }

  return [];
}

const buildDetail = (notification: Notification): NotificationDomainRefreshDetail => {
  const navigation = getNotificationNavigation(notification);
  const metadata = notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)
    ? notification.metadata as Record<string, unknown>
    : {};
  return {
    notificationId: notification.id,
    navigation,
    targetId: navigation.targetId,
    number: navigation.number,
    entityType: String(metadata.entityType || metadata.entity || '').trim() || undefined,
    action: String(metadata.action || '').trim() || undefined,
    status: String(metadata.status || '').trim() || undefined,
    previousStatus: String(metadata.previousStatus || '').trim() || undefined,
    newStatus: String(metadata.newStatus || '').trim() || undefined,
    sourceId: String(metadata.sourceId || '').trim() || undefined,
    sourceType: String(metadata.sourceType || '').trim() || undefined,
    branchId: String(metadata.branchId || '').trim() || undefined,
    warehouseId: String(metadata.warehouseId || '').trim() || undefined,
    aggregateCount: Number.isFinite(Number(metadata.aggregateCount)) ? Number(metadata.aggregateCount) : undefined,
  };
};

/**
 * Invalidates only active, relevant queries and emits a local event for
 * legacy views whose data is still held outside TanStack Query.
 */
export function refreshNotificationDomain(
  notification: Notification,
  queryClient: QueryClient,
  tenantKey: string,
): NotificationDomainRefreshDetail {
  const detail = buildDetail(notification);
  const queryKeys = getNotificationDomainQueryKeys(detail.navigation, tenantKey);
  if (detail.navigation.module === 'contabilidad' && detail.navigation.subModule === 'solicitudes-pago') {
    const sourceSubModule = canonicalSubModule('rh', String(detail.sourceType || '').trim().toLowerCase());
    if (sourceSubModule) queryKeys.push(['hr', sourceSubModule]);
  }
  queryKeys.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<NotificationDomainRefreshDetail>(NOTIFICATION_DOMAIN_REFRESH_EVENT, { detail }));
  }
  return detail;
}
