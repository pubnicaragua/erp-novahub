import { api } from './api';
import { resolveStorageReferences } from './storage.service';

const createCrudService = <T>(endpoint: string) => ({
  getAll: async (signal?: AbortSignal) => {
    const data = await api.get(endpoint, { signal }) as T[];
    return resolveStorageReferences(data);
  },
  getById: async (id: string, signal?: AbortSignal) => {
    const data = await api.get(`${endpoint}/${id}`, { signal }) as T;
    return resolveStorageReferences(data);
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

export const tasksService = {
  ...createCrudService<any>('/activities/tasks'),
  complete: async (id: string, evidenceData: any) => {
    return await api.post(`/activities/tasks/${id}/complete`, evidenceData);
  }
};
export const eventsService = createCrudService<any>('/activities/events');
export const remindersService = createCrudService<any>('/activities/reminders');
export const activityLogsService = createCrudService<any>('/activities/logs');
