import { api } from './api';
import type { User, ApiFilters } from '../types';

export const usersService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<User[]>('/users', { params: filters as any, signal }),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: Partial<User>) => api.post<User>('/users', data),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
  changePassword: (id: string, password: string) => api.patch<User>(`/users/${id}/password`, { password }),
  delete: (id: string) => api.delete<void>(`/users/${id}`),
};
