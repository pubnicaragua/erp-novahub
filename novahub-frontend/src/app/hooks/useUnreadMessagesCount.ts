import type { Message } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTenantQuery } from './useTenantQuery';
import { messagesService } from '../services/notificaciones.service';
import { supportConversationsService, type SupportConversation } from '../services/support-conversations.service';

export function useMessageInboxPreview(enabled: boolean) {
  const { user } = useAuth();
  const authUser = user as (typeof user & { clientTenantId?: string; tenantId?: string }) | null;
  const tenantKey = authUser?.clientTenantId || authUser?.tenantId || 'current';
  const userKey = user?.id || 'current';
  const canQuery = enabled && Boolean(user?.id);
  const isPlatformSupportAgent = Boolean(user?.isPlatformSupportAgent);

  const directMessagesQuery = useTenantQuery<Message[]>(
    ['notifications', userKey, 'messages'],
    signal => messagesService.getAll(signal),
    {
      enabled: canQuery && !isPlatformSupportAgent && tenantKey !== 'current',
      refetchOnWindowFocus: true,
    },
  );
  const supportConversationsQuery = useTenantQuery<SupportConversation[]>(
    ['support-conversations', userKey, 'branch-inbox'],
    signal => supportConversationsService.getConversations(signal),
    {
      enabled: canQuery && (isPlatformSupportAgent || tenantKey !== 'current'),
      refetchOnWindowFocus: true,
    },
  );

  const directUnreadCount = (directMessagesQuery.data || []).reduce(
    (total, thread) => total + Math.max(0, Number(thread.unreadCount) || 0),
    0,
  );
  const supportUnreadCount = (supportConversationsQuery.data || []).reduce(
    (total, conversation) => total + Math.max(0, Number(conversation.unreadCount) || 0),
    0,
  );

  const threads = [...(directMessagesQuery.data || []), ...(supportConversationsQuery.data || [])]
    .sort((left, right) => new Date(right.lastMessageAt).getTime() - new Date(left.lastMessageAt).getTime());

  return {
    unreadCount: directUnreadCount + supportUnreadCount,
    threads,
    isLoading: directMessagesQuery.isLoading || supportConversationsQuery.isLoading,
    isError: directMessagesQuery.isError || supportConversationsQuery.isError,
  };
}
