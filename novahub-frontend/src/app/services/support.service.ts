import { api } from './api';
import type { Ticket, Document, User, ApiFilters } from '../types';

const normalizeList = <T>(response: any): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (Array.isArray(response?.data)) return response.data as T[];
  return [];
};

export const supportService = {
  getAll: (filters?: ApiFilters) => api.get<Ticket[]>('/tools/tickets', filters as any),
  getOne: (id: string) => api.get<Ticket>(`/tools/tickets/${id}`),
  create: (data: Partial<Ticket>) => api.post<Ticket>('/tools/tickets', data),
  update: (id: string, data: Partial<Ticket>) => api.patch<Ticket>(`/tools/tickets/${id}`, data),
  delete: (id: string) => api.delete(`/tools/tickets/${id}`),
};

export const knowledgeBaseService = {
  getAll: async (filters?: ApiFilters) => normalizeList<Document>(await api.get<any>('/tools/documents', filters as any)),
  getOne: (id: string) => api.get<Document>(`/tools/documents/${id}`),
  create: (data: Partial<Document>) => api.post<Document>('/tools/documents', data),
  update: (id: string, data: Partial<Document>) => api.patch<Document>(`/tools/documents/${id}`, data),
  delete: (id: string) => api.delete<void>(`/tools/documents/${id}`),
};

export const supportAgentsService = {
  getAll: async (filters?: ApiFilters) => normalizeList<User>(await api.get<any>('/users', filters as any)),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
};
