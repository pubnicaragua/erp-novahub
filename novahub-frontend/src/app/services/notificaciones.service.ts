import { api } from './api';

const createCrudService = <T>(endpoint: string) => ({
  getAll: async () => {
    const data = await api.get(endpoint) as T[];
    return data;
  },
  getById: async (id: string) => {
    const data = await api.get(`${endpoint}/${id}`) as T;
    return data;
  },
  create: async (payload: Partial<T>) => {
    const data = await api.post(endpoint, payload) as T;
    return data;
  },
  update: async (id: string, payload: Partial<T>) => {
    const data = await api.patch(`${endpoint}/${id}`, payload) as T;
    return data;
  },
  delete: async (id: string) => {
    const data = await api.delete(`${endpoint}/${id}`);
    return data;
  }
});

export const alertsService = createCrudService<any>('/notifications/alerts');
export const messagesService = createCrudService<any>('/notifications/messages');
export const pushNotificationsService = {
  ...createCrudService<any>('/notifications/push'),
  getCategories: () => api.get<any[]>('/notifications/push-categories'),
  createCategory: (name: string) => api.post<any>('/notifications/push-categories', { name }),
  deleteCategory: (id: string) => api.delete(`/notifications/push-categories/${id}`),
};

export const inboxService = {
  getAll: () => api.get<any[]>('/notifications/inbox'),
  readAll: () => api.patch('/notifications/inbox/read-all', {}),
  markRead: (id: string) => api.patch(`/notifications/inbox/${id}/read`, {}),
  delete: (id: string) => api.delete(`/notifications/inbox/${id}`),
};

export const notificationsCatalogService = {
  getCatalog: () => api.get<any>('/notifications/catalog'),
  seedPhase: (phaseId: 'fase-1-alertas' | 'fase-2-mensajes' | 'fase-3-push') =>
    api.post<any>(`/notifications/phases/${phaseId}/seed`, {}),
};
