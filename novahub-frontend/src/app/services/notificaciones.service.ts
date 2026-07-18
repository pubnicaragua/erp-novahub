import { api } from './api';
import type { ChatMessage, Message, MessageParticipant } from '../types';

const SYSTEM_PARTICIPANT: MessageParticipant = { id: 'system', name: 'Sistema' };

const metadataObject = (value: unknown): Record<string, any> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const currentUserId = (): string => {
  try {
    const encoded = localStorage.getItem('nh-auth-token')?.split('.')[1];
    if (!encoded) return '';
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    return String(payload?.sub || payload?.id || '');
  } catch {
    return '';
  }
};

const normalizeParticipant = (value: any, fallback: MessageParticipant = SYSTEM_PARTICIPANT): MessageParticipant => ({
  id: String(value?.id || fallback.id),
  name: String(value?.name || fallback.name),
  ...(value?.email || fallback.email ? { email: String(value?.email || fallback.email) } : {}),
  ...(value?.avatar !== undefined || fallback.avatar !== undefined ? { avatar: value?.avatar ?? fallback.avatar ?? null } : {}),
  ...(value?.role || fallback.role ? { role: String(value?.role || fallback.role) } : {}),
});

const metadataParticipant = (metadata: Record<string, any>, side: 'sender' | 'recipient'): MessageParticipant => {
  if (side === 'sender') {
    return normalizeParticipant({
      id: metadata.senderId || 'system',
      name: metadata.senderName || 'Sistema',
      email: metadata.senderEmail,
    });
  }
  return normalizeParticipant({
    id: metadata.recipientId || '',
    name: metadata.recipientName || 'Vos',
    email: metadata.recipientEmail,
  }, { id: '', name: 'Vos' });
};

const normalizeChatMessage = (value: any, userId: string): ChatMessage => {
  const metadata = metadataObject(value?.metadata);
  return {
    id: String(value?.id || `${Date.now()}-${Math.random()}`),
    content: String(value?.content || value?.message || ''),
    createdAt: String(value?.createdAt || new Date().toISOString()),
    isRead: Boolean(value?.isRead),
    mine: typeof value?.mine === 'boolean' ? value.mine : Boolean(userId && metadata.senderId === userId),
    sender: normalizeParticipant(value?.sender, metadataParticipant(metadata, 'sender')),
    recipient: normalizeParticipant(value?.recipient, metadataParticipant(metadata, 'recipient')),
    link: value?.link || null,
  };
};

const normalizeMessageThread = (value: any, userId: string): Message => {
  const rootMetadata = metadataObject(value?.metadata);
  const sender = metadataParticipant(rootMetadata, 'sender');
  const recipient = metadataParticipant(rootMetadata, 'recipient');
  const isDirect = value?.kind === 'DIRECT'
    || (rootMetadata.kind === 'DIRECT_MESSAGE' && Boolean(rootMetadata.senderId));
  const legacyItems = [value, ...(Array.isArray(value?.replies) ? value.replies : [])];
  const sourceMessages = Array.isArray(value?.messages) ? value.messages : legacyItems;
  const messages = sourceMessages
    .map((item: any) => normalizeChatMessage(item, userId))
    .sort((left: ChatMessage, right: ChatMessage) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const latest = messages[messages.length - 1];
  const counterpart = rootMetadata.senderId === userId ? recipient : sender;
  const threadParticipant = normalizeParticipant(value?.participant, isDirect ? counterpart : SYSTEM_PARTICIPANT);
  const unreadCount = Number.isFinite(Number(value?.unreadCount))
    ? Number(value.unreadCount)
    : legacyItems.filter((item: any) => item?.userId === userId && !item?.isRead).length;

  return {
    id: String(value?.id || ''),
    title: String(value?.title || 'Mensaje'),
    kind: isDirect ? 'DIRECT' : 'SYSTEM',
    participant: threadParticipant,
    preview: String(value?.preview || latest?.content || value?.content || ''),
    lastMessageAt: String(value?.lastMessageAt || latest?.createdAt || value?.createdAt || new Date().toISOString()),
    unreadCount,
    canReply: Boolean(value?.canReply ?? (isDirect && threadParticipant.id && threadParticipant.id !== 'system')),
    messages,
  };
};

const normalizeMessageThreads = (response: unknown): Message[] => {
  const values = Array.isArray(response) ? response : [];
  const userId = currentUserId();
  return values
    .filter((item: any) => item && (Array.isArray(item.messages) || !item.parentId))
    .map((item: any) => normalizeMessageThread(item, userId))
    .filter((item) => Boolean(item.id))
    .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());
};

const createCrudService = <T>(endpoint: string) => ({
  getAll: async () => {
    const data = await api.get(endpoint) as T[];
    return data;
  },
  getById: async (id: string) => {
    const data = await api.get(`${endpoint}/${id}`) as T;
    return data;
  },
  create: async (payload: Partial<T>) => {
    const data = await api.post(endpoint, payload) as T;
    return data;
  },
  update: async (id: string, payload: Partial<T>) => {
    const data = await api.patch(`${endpoint}/${id}`, payload) as T;
    return data;
  },
  delete: async (id: string) => {
    const data = await api.delete(`${endpoint}/${id}`);
    return data;
  }
});

export const alertsService = createCrudService<any>('/notifications/alerts');
export const messagesService = {
  getAll: async () => normalizeMessageThreads(await api.get<unknown>('/notifications/messages')),
  getRecipients: () => api.get<MessageParticipant[]>('/notifications/messages/recipients'),
  create: (payload: { recipientId: string; title: string; content: string }) =>
    api.post<Message>('/notifications/messages', payload),
  reply: (threadId: string, content: string) =>
    api.post<Message>(`/notifications/messages/${threadId}/replies`, { content }),
  markRead: (threadId: string) =>
    api.patch<{ success: true }>(`/notifications/messages/${threadId}/read`, {}),
};
export const pushNotificationsService = createCrudService<any>('/notifications/push');

export const notificationsCatalogService = {
  getCatalog: () => api.get<any>('/notifications/catalog'),
  seedPhase: (phaseId: 'fase-1-alertas' | 'fase-2-mensajes' | 'fase-3-push') =>
    api.post<any>(`/notifications/phases/${phaseId}/seed`, {}),
};
