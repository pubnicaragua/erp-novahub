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
export interface SupportStreamEvent { type: 'support-conversation-updated'; conversationId: string; occurredAt?: string }

const conversationId = (id: string) => String(id || '').replace(/^support:/, '');

export const supportConversationsService = {
  getTargets: (signal?: AbortSignal) => api.get<SupportTargets>('/support-conversations/targets', { signal }),
  preview: (targets: SupportScope[]) => api.post<SupportPreview>('/support-conversations/targets/preview', { targets }),
  getConversations: (signal?: AbortSignal) => api.get<SupportConversation[]>('/support-conversations/conversations', { signal }),
  getConversation: (id: string, signal?: AbortSignal) => api.get<SupportConversation>(`/support-conversations/conversations/${encodeURIComponent(conversationId(id))}`, { signal }),
  reply: (id: string, content: string) => api.post<SupportConversation>(`/support-conversations/conversations/${encodeURIComponent(conversationId(id))}/messages`, { content }),
  markRead: (id: string) => api.patch(`/support-conversations/conversations/${encodeURIComponent(conversationId(id))}/read`, {}),
  broadcast: (payload: { title: string; content: string; targets: SupportScope[] }, key: string) => api.idempotentPost('/support-conversations/broadcasts', payload, key),
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
  const connect = async () => {
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(getApiUrl('/support-conversations/events'), {
          headers: { Accept: 'text/event-stream', ...getAuthHeaders() },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Stream de soporte: HTTP ${response.status}`);
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
