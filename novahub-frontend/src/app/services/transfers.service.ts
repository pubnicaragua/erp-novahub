import { api } from './api';
import type { Transfer, ApiFilters, PaginatedResponse } from '../types';

export const transfersService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Transfer>>('/inventory/transfers', filters as any),
  getOne: (id: string) => api.get<Transfer>(`/inventory/transfers/${id}`),
  create: (data: Partial<Transfer>) => api.post<Transfer>('/inventory/transfers', data),
};
