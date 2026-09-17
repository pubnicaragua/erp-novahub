import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Notification } from '../types';
import { getNotificationNavigation, type NotificationNavigation } from '../utils/notificationNavigation';

export const NOTIFICATION_DOMAIN_REFRESH_EVENT = 'notification-domain-refresh';

export interface NotificationDomainRefreshDetail {
  notificationId: string;
  navigation: NotificationNavigation;
  targetId?: string;
  number?: string;
}

const asSubModule = (value?: string) => String(value || '').trim().toLowerCase();

const canonicalSubModule = (module: string, subModule?: string) => {
  const value = asSubModule(subModule);
  if (module === 'ventas' && value === 'cotizaciones') return 'estimaciones';
  if (module === 'compras' && value === 'solicitudes-compra') return 'solicitudes';
  if (module === 'compras' && value === 'ordenes-compra') return 'ordenes';
  if (module === 'compras' && value === 'gastos-recurrentes') return 'gastos-rec';
  if (module === 'compras' && value === 'facturas-recurrentes') return 'facturas-rec';
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

  return [];
}

const buildDetail = (notification: Notification): NotificationDomainRefreshDetail => {
  const navigation = getNotificationNavigation(notification);
  return {
    notificationId: notification.id,
    navigation,
    targetId: navigation.targetId,
    number: navigation.number,
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
  queryKeys.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey, refetchType: 'active' });
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<NotificationDomainRefreshDetail>(NOTIFICATION_DOMAIN_REFRESH_EVENT, { detail }));
  }
  return detail;
}
