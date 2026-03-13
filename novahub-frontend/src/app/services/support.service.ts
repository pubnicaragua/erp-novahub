import { api } from './api';
import type { Ticket, ApiFilters, PaginatedResponse } from '../types';

export const supportService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Ticket>>('/tools/tickets', filters as any),
  getOne: (id: string) => api.get<Ticket>(`/tools/tickets/${id}`),
  create: (data: Partial<Ticket>) => api.post<Ticket>('/tools/tickets', data),
  update: (id: string, data: Partial<Ticket>) => api.put<Ticket>(`/tools/tickets/${id}`, data),
  delete: (id: string) => api.delete(`/tools/tickets/${id}`),
};
