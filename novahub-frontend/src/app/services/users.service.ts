import { api } from './api';
import type { User, PaginatedResponse, ApiFilters } from '../types';

export const usersService = {
  getAll: (filters?: ApiFilters) => api.get<User[]>('/users', filters as any),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: Partial<User>) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
  changePassword: (id: string, password: string) => api.patch<User>(`/users/${id}/password`, { password }),
  delete: (id: string) => api.delete<void>(`/users/${id}`),
};
