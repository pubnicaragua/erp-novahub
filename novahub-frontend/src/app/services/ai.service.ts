import { apiRequest } from './api';

export interface ChatGuide {
  title: string;
  module: string;
  description: string;
}

export interface ChatOptions {
  context?: string;
  guides?: ChatGuide[];
}

export const aiService = {
  /**
   * Envía un mensaje al Asistente de Capacitación de NovaHub ERP.
   * El `api` ya agrega el token `nh-auth-token` automáticamente.
   * Se usa `apiRequest` directamente (en lugar de `api.post`) para poder
   * propagar el `AbortSignal` de cancelación, igual que hacen otros
   * servicios con `api.get(..., { signal })`.
   */
  chat: (message: string, options?: ChatOptions, signal?: AbortSignal) =>
    apiRequest<{ reply: string }>('/ai/chat', {
      method: 'POST',
      body: { message, ...options },
      signal,
    }),
};
