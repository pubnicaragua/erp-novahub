import { api } from './api';
import type { Document, ApiFilters, PaginatedResponse } from '../types';

export const documentsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Document>>('/tools/documents', filters as any),
  getOne: (id: string) => api.get<Document>(`/tools/documents/${id}`),
  create: (data: Partial<Document>) => api.post<Document>('/tools/documents', data),
  update: (id: string, data: Partial<Document>) => api.put<Document>(`/tools/documents/${id}`, data),
  delete: (id: string) => api.delete(`/tools/documents/${id}`),
};
