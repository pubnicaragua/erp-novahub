import { api, getApiUrl, getAuthHeaders } from './api';
import type { Message } from '../types';

export type SupportScopeType = 'GROUP' | 'BUSINESS_UNIT' | 'BRANCH';
export interface SupportScope { type: SupportScopeType; id: string }
export interface SupportAgent { id: string; name: string; email: string; isActive: boolean; createdAt: string; updatedAt: string; scopes: Array<SupportScope & { name: string }> }
export interface SupportTargetOptionBranch { id: string; name: string; selectable: boolean }
export interface SupportTargetOptionBusinessUnit {
  id: string;
  name: string;
  selectable: boolean;
  branches: SupportTargetOptionBranch[];
}
export interface SupportTargetOptionGroup {
  id: string;
  name: string;
  selectable: boolean;
  businessUnits: SupportTargetOptionBusinessUnit[];
  branches: SupportTargetOptionBranch[];
}
export interface SupportTargets { groups: SupportTargetOptionGroup[] }
export interface SupportPreview {
  targets: SupportScope[];
  branchCount: number;
  eligibleRecipientCount: number;
  branches: Array<{ id: string; name: string; recipientCount: number }>;
  branchesWithoutRecipients: Array<{ id: string; name: string; recipientCount: number }>;
}
export interface SupportConversation extends Message { kind: 'SUPPORT'; supportConversationId: string }
export interface SupportConversationAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}
interface PreparedSupportAttachmentUpload {
  uploadId: string;
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
}
export interface SupportAttachmentDownload {
  url: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  expiresIn: number;
}
export interface SupportBroadcastResult {
  broadcastId: string;
  title: string;
  createdAt: string;
  branchCount: number;
  recipientCount: number;
  conversations: Array<{ id: string; branchId: string; branchName: string; recipientCount: number; attachments: SupportConversationAttachment[] }>;
}
export type SupportStreamEvent =
  | { type: 'support-conversation-updated'; conversationId: string; occurredAt?: string }
  | { type: 'support-conversations-resync'; occurredAt?: string };

const conversationId = (id: string) => String(id || '').replace(/^support:/, '');
const SUPPORT_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

export function getSupportAttachmentMimeType(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const expected = SUPPORT_ATTACHMENT_MIME_BY_EXTENSION[extension];
  if (!expected) throw new Error('Formato no permitido. Adjunta JPG, PNG, WebP, PDF, DOCX, XLSX o CSV.');
  const aliases = extension === 'csv' ? ['application/csv', 'application/vnd.ms-excel'] : [];
  if (file.type && file.type !== 'application/octet-stream' && file.type !== expected && !aliases.includes(file.type)) {
    throw new Error('La extensión y el tipo de archivo no coinciden.');
  }
  return expected;
}

function uploadToSupportSignedUrl(
  prepared: PreparedSupportAttachmentUpload,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', prepared.signedUrl);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onerror = () => reject(new Error('No pudimos conectar con el almacenamiento.'));
    request.onabort = () => reject(new Error('La carga fue cancelada.'));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`No se pudo cargar el archivo (${request.status}).`));
    };
    const body = new FormData();
    body.append('cacheControl', '3600');
    body.append('', new Blob([file], { type: contentType }), file.name);
    request.send(body);
  });
}

export const supportConversationsService = {
  getTargets: (signal?: AbortSignal) => api.get<SupportTargets>('/support-conversations/targets', { signal }),
  preview: (targets: SupportScope[]) => api.post<SupportPreview>('/support-conversations/targets/preview', { targets }),
  getConversations: (signal?: AbortSignal) => api.get<SupportConversation[]>('/support-conversations/conversations', { signal }),
  getConversation: (id: string, signal?: AbortSignal) => api.get<SupportConversation>(`/support-conversations/conversations/${encodeURIComponent(conversationId(id))}`, { signal }),
  reply: (id: string, content: string, attachmentUploadIds: string[] = []) => api.post<SupportConversation>(`/support-conversations/conversations/${encodeURIComponent(conversationId(id))}/messages`, { content, attachmentUploadIds }),
  markRead: (id: string) => api.patch(`/support-conversations/conversations/${encodeURIComponent(conversationId(id))}/read`, {}),
  broadcast: (payload: { title: string; content: string; targets: SupportScope[]; attachmentUploadIds?: string[] }, key: string) => api.idempotentPost<SupportBroadcastResult>('/support-conversations/broadcasts', payload, key),
  async uploadAttachment(file: File, options: { conversationId?: string; onProgress?: (progress: number) => void } = {}) {
    const mimeType = getSupportAttachmentMimeType(file);
    const prepared = await api.post<PreparedSupportAttachmentUpload>('/support-conversations/attachments/uploads', {
      fileName: file.name,
      mimeType,
      size: file.size,
      conversationId: options.conversationId ? conversationId(options.conversationId) : undefined,
    });
    await uploadToSupportSignedUrl(prepared, file, mimeType, options.onProgress || (() => undefined));
    return api.post<SupportConversationAttachment>(
      `/support-conversations/attachments/uploads/${encodeURIComponent(prepared.uploadId)}/complete`,
      {},
    );
  },
  getAttachmentUrl: (id: string, attachmentId: string, download = false) => api.get<SupportAttachmentDownload>(
    `/support-conversations/conversations/${encodeURIComponent(conversationId(id))}/attachments/${encodeURIComponent(attachmentId)}/url${download ? '?download=1' : ''}`,
  ),
  listAgents: (signal?: AbortSignal) => api.get<SupportAgent[]>('/enterprise-groups/platform/support-agents', { signal }),
  getScopeOptions: (signal?: AbortSignal) => api.get<{ groups: ScopeOptionsGroup[] }>('/enterprise-groups/platform/support-agents/scope-options', { signal }),
  createAgent: (payload: { name: string; email: string; password: string; scopes: SupportScope[] }) => api.post<SupportAgent>('/enterprise-groups/platform/support-agents', payload),
  updateAgent: (id: string, payload: { name: string; email: string; password?: string }) => api.patch<SupportAgent>(`/enterprise-groups/platform/support-agents/${encodeURIComponent(id)}`, payload),
  replaceScopes: (id: string, scopes: SupportScope[]) => api.put<SupportAgent>(`/enterprise-groups/platform/support-agents/${encodeURIComponent(id)}/scopes`, { scopes }),
  updateStatus: (id: string, isActive: boolean) => api.patch<SupportAgent>(`/enterprise-groups/platform/support-agents/${encodeURIComponent(id)}/status`, { isActive }),
};

interface ScopeOptionsGroup {
  id: string;
  name: string;
  businessUnits: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string; businessUnitId: string }>;
}

export function subscribeToSupportEvents(onEvent: (event: SupportStreamEvent) => void): () => void {
  const controller = new AbortController();
  let hadConnection = false;
  const connect = async () => {
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(getApiUrl('/support-conversations/events'), {
          headers: { Accept: 'text/event-stream', ...getAuthHeaders() },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Stream de soporte: HTTP ${response.status}`);
        if (hadConnection) onEvent({ type: 'support-conversations-resync', occurredAt: new Date().toISOString() });
        hadConnection = true;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
            if (!data) continue;
            try {
              const event = JSON.parse(data) as SupportStreamEvent;
              if (event.type === 'support-conversation-updated' && event.conversationId) onEvent(event);
            } catch { /* Ignora un evento dañado y conserva el stream. */ }
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      if (!controller.signal.aborted) await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
  };
  void connect();
  return () => controller.abort();
}
