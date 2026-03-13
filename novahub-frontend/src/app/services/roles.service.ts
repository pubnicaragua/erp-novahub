import { api } from './api';
import type { PaginatedResponse, ApiFilters, RoleManagement } from '../types';

export const rolesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<RoleManagement>>('/roles', filters as any),
  getById: (id: string) => api.get<RoleManagement>(`/roles/${id}`),
  create: (data: Partial<RoleManagement>) => api.post<RoleManagement>('/roles', data),
  update: (id: string, data: Partial<RoleManagement>) => api.put<RoleManagement>(`/roles/${id}`, data),
  delete: (id: string) => api.delete<void>(`/roles/${id}`),
};
