import { api } from './api';
import { dedupeNotificationRecords } from './notifications.service';
import type { ChatMessage, Message, MessageAttachment, MessageParticipant } from '../types';

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

interface PreparedDirectMessageAttachmentUpload {
  uploadId: string;
  signedUrl: string;
}

const DIRECT_MESSAGE_ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

function getDirectMessageAttachmentMimeType(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const expected = DIRECT_MESSAGE_ATTACHMENT_MIME_BY_EXTENSION[extension];
  if (!expected) throw new Error('Formato no permitido. Adjunta JPG, PNG, WebP, PDF, DOCX, XLSX o CSV.');
  const aliases = extension === 'csv' ? ['application/csv', 'application/vnd.ms-excel'] : [];
  if (file.type && file.type !== 'application/octet-stream' && file.type !== expected && !aliases.includes(file.type)) {
    throw new Error('La extensión y el tipo de archivo no coinciden.');
  }
  return expected;
}

function uploadDirectMessageAttachmentToSignedUrl(
  prepared: PreparedDirectMessageAttachmentUpload,
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
  const attachments: MessageAttachment[] = Array.isArray(value?.attachments)
    ? value.attachments.flatMap((attachment: any) => {
      const id = String(attachment?.id || '').trim();
      const fileName = String(attachment?.fileName || '').trim();
      const mimeType = String(attachment?.mimeType || '').trim();
      const byteSize = Number(attachment?.byteSize);
      return id && fileName && mimeType && Number.isFinite(byteSize) && byteSize > 0
        ? [{ id, fileName, mimeType, byteSize }]
        : [];
    })
    : [];
  return {
    id: String(value?.id || `${Date.now()}-${Math.random()}`),
    content: String(value?.content || value?.message || ''),
    createdAt: String(value?.createdAt || new Date().toISOString()),
    isRead: Boolean(value?.isRead),
    mine: typeof value?.mine === 'boolean' ? value.mine : Boolean(userId && metadata.senderId === userId),
    sender: normalizeParticipant(value?.sender, metadataParticipant(metadata, 'sender')),
    recipient: normalizeParticipant(value?.recipient, metadataParticipant(metadata, 'recipient')),
    link: value?.link || null,
    ...(attachments.length ? { attachments } : {}),
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
  const attachmentPreview = latest?.attachments?.length === 1
    ? `📎 ${latest.attachments[0].fileName}`
    : latest?.attachments?.length
      ? `📎 ${latest.attachments.length} archivos adjuntos`
      : '';
  const unreadCount = Number.isFinite(Number(value?.unreadCount))
    ? Number(value.unreadCount)
    : legacyItems.filter((item: any) => item?.userId === userId && !item?.isRead).length;

  return {
    id: String(value?.id || ''),
    title: String(value?.title || 'Mensaje'),
    kind: isDirect ? 'DIRECT' : 'SYSTEM',
    participant: threadParticipant,
    preview: String(value?.preview || latest?.content || attachmentPreview || value?.content || ''),
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

const createCrudService = <T>(endpoint: string, options?: { dedupe?: boolean }) => ({
  getAll: async (signal?: AbortSignal) => {
    const data = await api.get(endpoint, { signal }) as T[];
    return options?.dedupe ? dedupeNotificationRecords(data as any[]) as T[] : data;
  },
  getById: async (id: string, signal?: AbortSignal) => {
    const data = await api.get(`${endpoint}/${id}`, { signal }) as T;
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

const alertsCrudService = createCrudService<any>('/notifications/alerts', { dedupe: true });
export const alertsService = {
  getAll: alertsCrudService.getAll,
  getById: alertsCrudService.getById,
  create: alertsCrudService.create,
  update: alertsCrudService.update,
};
export const messagesService = {
  getAll: async (signal?: AbortSignal) => normalizeMessageThreads(await api.get<unknown>('/notifications/messages', { signal })),
  getRecipients: (signal?: AbortSignal) => api.get<MessageParticipant[]>('/notifications/messages/recipients', { signal }),
  create: (payload: { recipientId: string; title: string; content: string; attachmentUploadIds?: string[] }) =>
    api.post<Message>('/notifications/messages', payload),
  reply: (threadId: string, content: string, attachmentUploadIds: string[] = []) =>
    api.post<Message>(`/notifications/messages/${encodeURIComponent(threadId)}/replies`, { content, attachmentUploadIds }),
  async uploadAttachment(file: File, options: { onProgress?: (progress: number) => void } = {}) {
    const mimeType = getDirectMessageAttachmentMimeType(file);
    const prepared = await api.post<PreparedDirectMessageAttachmentUpload>('/notifications/messages/attachments/uploads', {
      fileName: file.name,
      mimeType,
      size: file.size,
    });
    await uploadDirectMessageAttachmentToSignedUrl(prepared, file, mimeType, options.onProgress || (() => undefined));
    return api.post<MessageAttachment>(
      `/notifications/messages/attachments/uploads/${encodeURIComponent(prepared.uploadId)}/complete`,
      {},
    );
  },
  getAttachmentUrl: (threadId: string, attachmentId: string, download = false) => api.get<{
    url: string; fileName: string; mimeType: string; byteSize: number; expiresIn: number;
  }>(`/notifications/messages/${encodeURIComponent(threadId)}/attachments/${encodeURIComponent(attachmentId)}/url${download ? '?download=1' : ''}`),
  markRead: (threadId: string) =>
    api.patch<{ success: true }>(`/notifications/messages/${threadId}/read`, {}),
};
const pushNotificationsCrudService = createCrudService<any>('/notifications/push', { dedupe: true });
export const pushNotificationsService = {
  getAll: pushNotificationsCrudService.getAll,
  getById: pushNotificationsCrudService.getById,
  create: pushNotificationsCrudService.create,
  update: pushNotificationsCrudService.update,
};

export const notificationsCatalogService = {
  getCatalog: () => api.get<any>('/notifications/catalog'),
  seedPhase: (phaseId: 'fase-1-alertas' | 'fase-2-mensajes' | 'fase-3-push') =>
    api.post<any>(`/notifications/phases/${phaseId}/seed`, {}),
};
