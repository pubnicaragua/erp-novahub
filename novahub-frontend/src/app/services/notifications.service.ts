import { api } from './api';
import type { Notification } from '../types';

interface InboxNotificationDto {
  id: string;
  title: string;
  content: string;
  type: 'ALERT' | 'MESSAGE' | 'PUSH';
  isRead: boolean;
  createdAt: string;
  link?: string | null;
  metadata?: unknown;
}

const mapNotificationType = (type: InboxNotificationDto['type']): Notification['type'] => {
  if (type === 'PUSH') return 'error';
  if (type === 'ALERT') return 'warning';
  return 'info';
};

const mapInboxNotification = (item: InboxNotificationDto): Notification => ({
  id: item.id,
  title: item.title,
  message: item.content,
  type: mapNotificationType(item.type),
  timestamp: item.createdAt,
  read: item.isRead,
  link: item.link || null,
  metadata: item.metadata,
});

export const notificationsService = {
  getAll: async (signal?: AbortSignal) => {
    const data = await api.get<InboxNotificationDto[]>('/notifications/inbox', { signal });
    return data.map(mapInboxNotification);
  },
  markAsRead: (id: string) => api.patch<{ success: boolean }>(`/notifications/inbox/${id}/read`, {}),
  markAllAsRead: () => api.patch('/notifications/inbox/read-all', {}),
  delete: (id: string) => api.delete(`/notifications/inbox/${id}`),
};
