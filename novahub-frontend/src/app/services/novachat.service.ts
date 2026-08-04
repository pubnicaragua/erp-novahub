import { api } from './api';

export interface ChatChannel {
  id: string;
  name: string;
  type: string;
  channelIdentifier?: string;
  avatarUrl?: string;
  isActive: boolean;
  chatwootInboxId?: number;
}

export interface ChatContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  externalId?: string;
  notes?: string;
  customerId?: string;
}

export interface ChatConversation {
  id: string;
  subject?: string;
  status: string;
  priority: number;
  lastMessageAt?: string;
  createdAt: string;
  channel: { id: string; name: string; type: string };
  contact: { id: string; name: string; phone?: string; email?: string; avatarUrl?: string };
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  content: string;
  direction: string;
  messageType: string;
  agentName?: string;
  metadata?: {
    fileName?: string;
    fileSize?: string;
    mimeType?: string;
  };
  sentAt: string;
  conversationId: string;
}

export interface ChatRecentMessage extends ChatMessage {
  conversation: {
    id: string;
    subject?: string;
    contact: { name: string; avatarUrl?: string };
    channel: { name: string; type: string };
  };
}

export interface ChatDashboard {
  totalChannels: number;
  totalConversations: number;
  openConversations: number;
  totalMessages: number;
  recentMessages: ChatRecentMessage[];
}

export interface SeedDemoResponse {
  message: string;
  channels?: number;
  contacts?: number;
  conversations: number;
}

export const novachatService = {
  getChannels: (signal?: AbortSignal) =>
    api.get<ChatChannel[]>('/novachat/channels', { signal }),

  createChannel: (data: { name: string; type: string; channelIdentifier?: string }) =>
    api.post<ChatChannel>('/novachat/channels', data),

  getConversations: (params?: { channelId?: string; status?: string }, signal?: AbortSignal) =>
    api.get<ChatConversation[]>('/novachat/conversations', { params, signal }),

  createConversation: (data: { channelId: string; contactId: string; subject?: string }) =>
    api.post<ChatConversation>('/novachat/conversations', data),

  updateConversationStatus: (id: string, status: string) =>
    api.patch<ChatConversation>(`/novachat/conversations/${id}/status`, { status }),

  getMessages: (conversationId: string, signal?: AbortSignal) =>
    api.get<ChatMessage[]>(`/novachat/conversations/${conversationId}/messages`, { signal }),

  sendMessage: (data: { conversationId: string; content: string; agentName?: string }) =>
    api.post<ChatMessage>('/novachat/messages', data),

  getContacts: (signal?: AbortSignal) =>
    api.get<ChatContact[]>('/novachat/contacts', { signal }),

  createContact: (data: { name: string; phone?: string; email?: string; notes?: string }) =>
    api.post<ChatContact>('/novachat/contacts', data),

  getDashboard: (signal?: AbortSignal) =>
    api.get<ChatDashboard>('/novachat/dashboard', { signal }),

  seedDemo: () =>
    api.post<SeedDemoResponse>('/novachat/seed', {}),
};
