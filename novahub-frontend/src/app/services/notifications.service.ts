import { api } from './api';
import type { Notification } from '../types';

export const notificationsService = {
  getAll: () => api.get<Notification[]>('/tools/notifications'),
  markAsRead: (id: string) => api.patch<Notification>(`/tools/notifications/${id}/read`, {}),
  markAllAsRead: () => api.patch('/tools/notifications/read-all', {}),
  delete: (id: string) => api.delete(`/tools/notifications/${id}`),
};
