import { api } from './api';
import { resolveStorageReferences } from './storage.service';
import type { Ticket, TicketComment, TicketAudit, Document, User, ApiFilters } from '../types';

const normalizeList = <T>(response: any): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (Array.isArray(response?.data)) return response.data as T[];
  return [];
};

export const supportService = {
  // El listado conserva las storage:// URIs y solo firma archivos al abrir un
  // ticket; resolver cada fila aquí produciría N+1 requests a Storage.
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<Ticket[]>('/tools/tickets', { params: filters as any, signal }),
  getOne: async (id: string, signal?: AbortSignal) => resolveStorageReferences(await api.get<Ticket>(`/tools/tickets/${id}`, { signal })),
  create: (data: Partial<Ticket>) => api.post<Ticket>('/tools/tickets', data),
  update: (id: string, data: Partial<Ticket>) => api.patch<Ticket>(`/tools/tickets/${id}`, data),
  delete: (id: string) => api.delete(`/tools/tickets/${id}`),
  getComments: (id: string, signal?: AbortSignal) => api.get<TicketComment[]>(`/tools/tickets/${id}/comments`, { signal }),
  addComment: (id: string, message: string) => api.post<TicketComment>(`/tools/tickets/${id}/comments`, { message }),
  getAudit: (id: string, signal?: AbortSignal) => api.get<TicketAudit[]>(`/tools/tickets/${id}/audit`, { signal }),
};

export const knowledgeBaseService = {
  getAll: async (filters?: ApiFilters, signal?: AbortSignal) => normalizeList<Document>(await api.get<any>('/tools/documents', { params: filters as any, signal })),
  getOne: (id: string, signal?: AbortSignal) => api.get<Document>(`/tools/documents/${id}`, { signal }),
  create: (data: Partial<Document>) => api.post<Document>('/tools/documents', data),
  update: (id: string, data: Partial<Document>) => api.patch<Document>(`/tools/documents/${id}`, data),
  delete: (id: string) => api.delete<void>(`/tools/documents/${id}`),
};

export const supportAgentsService = {
  getAll: async (filters?: ApiFilters, signal?: AbortSignal) => normalizeList<User>(await api.get<any>('/users', { params: filters as any, signal })),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
};
