import { api } from './api';
import { resolveStorageReferences } from './storage.service';
import type { Ticket, TicketComment, TicketAudit, User, ApiFilters } from '../types';

const normalizeList = <T>(response: any): T[] => {
  if (Array.isArray(response)) return response as T[];
  if (Array.isArray(response?.data)) return response.data as T[];
  return [];
};

export const supportService = {
  // El listado conserva las storage:// URIs y solo firma archivos al abrir un
  // ticket; resolver cada fila aquí produciría N+1 requests a Storage.
  getAll: (filters?: ApiFilters & { priority?: string; assignedToId?: string; customerId?: string; invoiceId?: string; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) => api.get<{ data: Ticket[]; meta: any }>('/tools/tickets', { params: filters as any, signal }),
  getOne: async (id: string, signal?: AbortSignal) => resolveStorageReferences(await api.get<Ticket>(`/tools/tickets/${id}`, { signal })),
  create: (data: Partial<Ticket>) => api.post<Ticket>('/tools/tickets', data),
  update: (id: string, data: Partial<Ticket>) => api.patch<Ticket>(`/tools/tickets/${id}`, data),
  reopen: (id: string, reason: string) => api.post<Ticket>(`/tools/tickets/${id}/reopen`, { reason }),
  delete: (id: string) => api.delete(`/tools/tickets/${id}`),
  getCategories: (signal?: AbortSignal) => api.get<any[]>('/tools/ticket-categories', { signal }),
  createCategory: (data: { name: string; description?: string; color?: string }) => api.post<any>('/tools/ticket-categories', data),
  updateCategory: (id: string, data: { name?: string; description?: string; color?: string; isActive?: boolean }) => api.patch<any>(`/tools/ticket-categories/${id}`, data),
  deleteCategory: (id: string) => api.delete(`/tools/ticket-categories/${id}`),
  getComments: (id: string, signal?: AbortSignal) => api.get<TicketComment[]>(`/tools/tickets/${id}/comments`, { signal }),
  addComment: (id: string, message: string, isInternal = true) => api.post<TicketComment>(`/tools/tickets/${id}/comments`, { message, isInternal }),
  getAttachments: (id: string, signal?: AbortSignal) => api.get<any[]>(`/tools/tickets/${id}/attachments`, { signal }),
  addAttachment: (id: string, data: { uri: string; fileName: string; mimeType?: string; byteSize?: number }) => api.post<any>(`/tools/tickets/${id}/attachments`, data),
  removeAttachment: (id: string, attachmentId: string) => api.delete(`/tools/tickets/${id}/attachments/${attachmentId}`),
  getAudit: (id: string, signal?: AbortSignal) => api.get<TicketAudit[]>(`/tools/tickets/${id}/audit`, { signal }),
};

export const knowledgeBaseService = {
  getAll: async (filters?: ApiFilters & Record<string, unknown>, signal?: AbortSignal) => normalizeList<any>(await api.get<any>('/tools/knowledge-base/articles', { params: filters as any, signal })),
  getOne: (id: string, signal?: AbortSignal) => api.get<any>(`/tools/knowledge-base/articles/${id}`, { signal }),
  create: (data: Record<string, unknown>) => api.post<any>('/tools/knowledge-base/articles', data),
  update: (id: string, data: Record<string, unknown>) => api.patch<any>(`/tools/knowledge-base/articles/${id}`, data),
  delete: (id: string) => api.delete<void>(`/tools/knowledge-base/articles/${id}`),
  getStats: (signal?: AbortSignal) => api.get<any>('/tools/knowledge-base/stats', { signal }),
  getCategories: async (signal?: AbortSignal) => normalizeList<any>(await api.get<any>('/tools/knowledge-base/categories', { signal })),
  createCategory: (data: { name: string; description?: string }) => api.post<any>('/tools/knowledge-base/categories', data),
  updateCategory: (id: string, data: { name?: string; description?: string; isActive?: boolean }) => api.patch<any>(`/tools/knowledge-base/categories/${id}`, data),
  deleteCategory: (id: string) => api.delete<void>(`/tools/knowledge-base/categories/${id}`),
  getVersions: (id: string, signal?: AbortSignal) => api.get<any[]>(`/tools/knowledge-base/articles/${id}/versions`, { signal }),
  getAudit: (id: string, signal?: AbortSignal) => api.get<any[]>(`/tools/knowledge-base/articles/${id}/audit`, { signal }),
  relateArticles: (id: string, relatedArticleIds: string[]) => api.post<any>(`/tools/knowledge-base/articles/${id}/relations`, { relatedArticleIds }),
  unrelateArticle: (id: string, relatedArticleId: string) => api.delete(`/tools/knowledge-base/articles/${id}/relations/${relatedArticleId}`),
  linkTicket: (id: string, ticketId: string) => api.post<any>(`/tools/knowledge-base/articles/${id}/tickets`, { ticketId }),
  unlinkTicket: (id: string, ticketId: string) => api.delete(`/tools/knowledge-base/articles/${id}/tickets/${ticketId}`),
  addAttachment: (id: string, data: { uri: string; fileName: string; mimeType?: string; byteSize?: number }) => api.post<any>(`/tools/knowledge-base/articles/${id}/attachments`, data),
  removeAttachment: (id: string, attachmentId: string) => api.delete(`/tools/knowledge-base/articles/${id}/attachments/${attachmentId}`),
};

export const supportAgentsService = {
  getAll: async (filters?: ApiFilters, signal?: AbortSignal) => normalizeList<User>(await api.get<any>('/users/support-agents', { params: filters as any, signal })),
  update: (id: string, data: Partial<User>) => api.patch<User>(`/users/${id}`, data),
};
