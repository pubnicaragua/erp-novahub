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

export const tasksService = createCrudService<any>('/activities/tasks');
export const eventsService = createCrudService<any>('/activities/events');
export const remindersService = createCrudService<any>('/activities/reminders');
export const activityLogsService = createCrudService<any>('/activities/logs');
