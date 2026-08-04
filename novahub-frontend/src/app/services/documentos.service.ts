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

export const contractsService = createCrudService<any>('/documents/contracts');
export const legalInvoicesService = createCrudService<any>('/documents/legal-invoices');
export const reportsService = createCrudService<any>('/documents/reports');
export const filesService = createCrudService<any>('/documents/files');
