import { api } from './api';
import type { Notification } from '../types';

interface InboxNotificationDto {
  id: string;
  title: string;
  content?: string | null;
  message?: string | null;
  description?: string | null;
  detail?: string | null;
  type: 'ALERT' | 'MESSAGE' | 'PUSH';
  isRead: boolean;
  createdAt: string;
  link?: string | null;
  dedupeKey?: string | null;
  metadata?: unknown;
}

const mapNotificationType = (type: InboxNotificationDto['type']): Notification['type'] => {
  if (type === 'PUSH') return 'error';
  if (type === 'ALERT') return 'warning';
  return 'info';
};

const metadataObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

export type NotificationRecordLike = {
  id: string;
  title?: string | null;
  content?: string | null;
  message?: string | null;
  metadata?: unknown;
  isRead?: boolean;
  read?: boolean;
  createdAt?: string;
  timestamp?: string;
  userId?: string | null;
  type?: string | null;
  link?: string | null;
  dedupeKey?: string | null;
};

const stableJson = (value: unknown): string => {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.keys(input as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = normalize((input as Record<string, unknown>)[key]);
          return result;
        }, {});
    }
    return input;
  };

  try {
    return JSON.stringify(normalize(value)) || '';
  } catch {
    return '';
  }
};

/** Defensive client-side collapse for old rows and concurrent API responses. */
export function notificationEventKey(item: NotificationRecordLike): string {
  const metadata = metadataObject(item.metadata);
  const explicit = String(item.dedupeKey || metadata.dedupeKey || '').trim();
  if (explicit) return `key:${explicit}`;

  const kind = String(metadata.kind || '').trim();
  const entityId = String(
    metadata.entityId
    || metadata.orderId
    || metadata.invoiceId
    || metadata.creditId
    || metadata.taskId
    || metadata.reminderId
    || metadata.eventId
    || '',
  ).trim();
  if (kind && entityId) return `entity:${kind}:${entityId}`;

  const notificationType = String(item.type || '').trim().toUpperCase();
  const isSystemNotification = notificationType === 'ALERT'
    || notificationType === 'PUSH'
    || item.type === 'warning'
    || item.type === 'error';
  if (!isSystemNotification) return `id:${item.id}`;

  // Defensive fallback for old system rows that were created before the
  // backend stored a business dedupe key. Scope it to the same calendar day
  // so a legitimate reminder on a later day is not hidden.
  const rawDate = item.createdAt || item.timestamp || '';
  const parsedDate = new Date(rawDate);
  const day = Number.isNaN(parsedDate.getTime()) ? 'unknown' : parsedDate.toISOString().slice(0, 10);
  const title = String(item.title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const content = String(item.content || item.message || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  const link = String(item.link || '').trim().toLocaleLowerCase();
  return `legacy:${day}:${title}:${content}:${link}:${stableJson(metadata)}`;
}

export function dedupeNotificationRecords<T extends NotificationRecordLike>(items: T[]): T[] {
  const grouped = new Map<string, T>();
  for (const item of items) {
    const groupKey = `${item.userId || 'current'}:${item.type || 'NOTIFICATION'}:${notificationEventKey(item)}`;
    const current = grouped.get(groupKey);
    const currentUnread = current ? (current.isRead === false || current.read === false) : false;
    const itemUnread = item.isRead === false || item.read === false;
    const currentDate = new Date(current?.createdAt || current?.timestamp || 0).getTime();
    const itemDate = new Date(item.createdAt || item.timestamp || 0).getTime();
    if (!current || (itemUnread && !currentUnread) || (itemUnread === currentUnread && itemDate > currentDate)) {
      grouped.set(groupKey, item);
    }
  }
  return [...grouped.values()].sort(
    (left, right) => new Date(right.createdAt || right.timestamp || 0).getTime() - new Date(left.createdAt || left.timestamp || 0).getTime(),
  );
}

const notificationDetail = (item: InboxNotificationDto): string => {
  const explicit = [item.content, item.message, item.description, item.detail]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);
  if (explicit) return explicit;

  const metadata = metadataObject(item.metadata);
  const metadataDetail = [metadata.detail, metadata.description, metadata.message, metadata.reason, metadata.summary]
    .map((value) => String(value ?? '').trim())
    .find(Boolean);
  if (metadataDetail) return metadataDetail;

  const title = String(item.title || '').trim();
  const kind = String(metadata.kind || '').toUpperCase();
  const invoiceNumber = String(metadata.invoiceNumber || '').trim();
  const creditNumber = String(metadata.creditNumber || '').trim();
  const destination = String(metadata.navigation?.subModule || '').trim();
  const destinationLabels: Record<string, string> = {
    'cuentas-cobrar': 'Cuentas por cobrar',
    facturas: 'Facturas',
    'notas-credito': 'Notas de crédito',
    'facturacion-caja': 'Facturación por Caja',
    suscripciones: 'Suscripciones',
  };

  if (kind.includes('INVOICE') || /factura/i.test(title)) {
    return invoiceNumber
      ? `Factura ${invoiceNumber}. Revisa el cliente, vencimiento y saldo pendiente.`
      : 'Revisa el cliente, vencimiento y saldo pendiente de las facturas relacionadas.';
  }
  if (kind.includes('CREDIT') || /crédito|credito|nota de crédito|nota de credito/i.test(title)) {
    return creditNumber
      ? `Crédito ${creditNumber}. Revisa su vencimiento, saldo y aplicación.`
      : 'Revisa el vencimiento, saldo y aplicación del crédito relacionado.';
  }
  if (/suspendida por mora|suspensi[oó]n/i.test(title)) {
    return 'La cuenta requiere atención. Revisa la suscripción y la causa de la suspensión.';
  }
  if (destination && destinationLabels[destination]) return `Revisa el detalle en ${destinationLabels[destination]}.`;
  if (item.link) return 'Abre esta notificación para consultar el detalle relacionado.';
  return 'Abre esta notificación para consultar el detalle.';
};

const mapInboxNotification = (item: InboxNotificationDto): Notification => {
  const message = notificationDetail(item);
  return {
    id: item.id,
    title: item.title,
    message,
    type: mapNotificationType(item.type),
    timestamp: item.createdAt,
    read: item.isRead,
    link: item.link || null,
    dedupeKey: item.dedupeKey || null,
    metadata: item.metadata,
  };
};

export const notificationsService = {
  getAll: async (signal?: AbortSignal) => {
    const data = await api.get<InboxNotificationDto[]>('/notifications/inbox', { signal });
    return dedupeNotificationRecords(data.map(mapInboxNotification));
  },
  markAsRead: (id: string) => api.patch<{ success: boolean }>(`/notifications/inbox/${id}/read`, {}),
  markAllAsRead: () => api.patch('/notifications/inbox/read-all', {}),
  getManagerInbox: async (groupId: string, signal?: AbortSignal) => {
    const data = await api.get<InboxNotificationDto[]>(`/notifications/manager-inbox/${groupId}`, { signal });
    return dedupeNotificationRecords(data.map(mapInboxNotification));
  },
  markManagerAsRead: (groupId: string, id: string) => api.patch<{ success: boolean }>(`/notifications/manager-inbox/${groupId}/${id}/read`, {}),
  delete: (id: string) => api.delete(`/notifications/inbox/${id}`),
  getViewAlertReadIds: async (namespace: string, signal?: AbortSignal) => {
    const data = await api.get<{ itemIds?: string[] }>('/notifications/view-alerts/read', {
      params: { namespace },
      signal,
    });
    return Array.isArray(data?.itemIds) ? data.itemIds.map(String) : [];
  },
  markViewAlertsRead: (namespace: string, itemIds: string[]) =>
    api.post<{ success: boolean; count: number }>('/notifications/view-alerts/read', { namespace, itemIds }),
};
