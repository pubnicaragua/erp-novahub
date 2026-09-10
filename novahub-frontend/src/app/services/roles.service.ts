import { api } from './api';

export interface RoleData {
  id?: string;
  name: string;
  description?: string;
  color?: string;
  permissions?: any[];
  allowedModules?: string[];
  warehouseIds?: string[];
}

export const rolesService = {
  getAll: (filters?: any, signal?: AbortSignal) => api.get<any>('/roles', { params: filters, signal }),
  getById: (id: string) => api.get<any>(`/roles/${id}`),
  getWarehouses: (signal?: AbortSignal) => api.get<any[]>('/roles/warehouses', { signal }),
  create: (data: Partial<RoleData>) => api.post<any>('/roles', data),
  update: (id: string, data: Partial<RoleData>) => api.patch<any>(`/roles/${id}`, data),
  delete: (id: string) => api.delete<void>(`/roles/${id}`),
};
