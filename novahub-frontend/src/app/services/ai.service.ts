import { apiRequest } from './api';

export interface ChatGuide {
  title: string;
  module: string;
  description: string;
}

export interface ChatOptions {
  context?: string;
  guides?: ChatGuide[];
  conversationId?: string;
  dashboardContext?: {
    source?: string;
    periodFrom?: string;
    periodTo?: string;
  };
}

export interface ChatResponse {
  reply: string;
  conversationId?: string;
  toolStatuses?: Array<{ label: string; success: boolean }>;
}

export const aiService = {
  /**
   * Envía un mensaje a Nova AI con el contexto operativo autorizado por el backend.
   * El `api` ya agrega el token `nh-auth-token` automáticamente.
   * Se usa `apiRequest` directamente (en lugar de `api.post`) para poder
   * propagar el `AbortSignal` de cancelación, igual que hacen otros
   * servicios con `api.get(..., { signal })`.
   */
  chat: (message: string, options?: ChatOptions, signal?: AbortSignal) =>
    apiRequest<ChatResponse>('/ai/chat', {
      method: 'POST',
      body: { message, ...options },
      signal,
    }),
};
