import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from './useNotifications';
import { playNotificationSound } from '../utils/notificationSound';
import { useAuth } from '../contexts/AuthContext';
import { getNotificationActorId, subscribeToNotificationEvents } from '../services/notifications.service';
import { waitForNotificationActionBarrier } from '../services/notification-action-coordinator';
import { showPersistentBrowserNotification } from '../utils/browserNotifications';
import { claimNotificationPresentation } from '../utils/notification-presentation';
import { toast } from '@/app/services/toast';
import { getNotificationNavigation, navigateToNotification } from '../utils/notificationNavigation';
import { refreshNotificationDomain } from '../services/notification-domain-refresh';
import { notificationsService } from '../services/notifications.service';
import type { Notification } from '../types';

/**
 * The grouped inbox is the source of truth. Group IDs remain stable as routine
 * members arrive; detail pages refresh every domain event while presentation
 * is claimed once across same-origin tabs.
 */
export function useIncomingNotificationAlert() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { notifications, isFetched, markAsRead } = useNotifications();
  const authUser = user as (typeof user & { clientTenantId?: string; tenantId?: string }) | null | undefined;
  const tenantId = authUser?.clientTenantId || authUser?.tenantId || 'current';
  const userId = authUser?.id || 'current';
  const storageKey = `nh-notification-seen:${tenantId}:${userId}`;
  const presentationIdentity = `${tenantId}:${userId}`;
  const seenEvents = useRef<Set<string>>(new Set());
  const pendingLiveNotificationIds = useRef<Set<string>>(new Set());
  const queuedOwnNotifications = useRef<Map<string, Notification>>(new Map());
  const processingOwnQueue = useRef(false);
  const initialized = useRef(false);
  const alertSessionStartedAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    initialized.current = false;
    seenEvents.current = new Set();
    pendingLiveNotificationIds.current = new Set();
    queuedOwnNotifications.current = new Map();
    processingOwnQueue.current = false;
    alertSessionStartedAt.current = Date.now();
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) seenEvents.current = new Set(stored.map(String));
    } catch {
      // Notification history is optional.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!authUser?.id) return undefined;
    const streamIdentity = `${tenantId}:${userId}`;
    return subscribeToNotificationEvents(streamIdentity, (event) => {
      if (event.reason !== 'created') return;
      (event.notificationIds || []).forEach((id) => {
        const normalizedId = String(id || '').trim();
        if (normalizedId) pendingLiveNotificationIds.current.add(normalizedId);
      });
    });
  }, [authUser?.id, tenantId, userId]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'novahub-notification-click') return;
      const notificationId = String(event.data.notificationId || '').trim();
      if (!notificationId) return;
      void markAsRead(notificationId);
      const notification = notifications.find(item => item.latestNotificationId === notificationId || item.id === notificationId);
      if (notification) navigateToNotification(notification);
    };
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [markAsRead, notifications]);

  useEffect(() => {
    if (!isFetched) return;
    const isInitialFetch = !initialized.current;
    initialized.current = true;

    const pendingIds = pendingLiveNotificationIds.current;
    const hasPendingNotificationInResponse = notifications.some((notification) => (
      pendingIds.has(notification.latestNotificationId || notification.id)
    ));
    const sessionStartedAt = alertSessionStartedAt.current ?? Date.now();
    const hasRecentNotificationInResponse = notifications.some((notification) => (
      new Date(notification.timestamp).getTime() >= sessionStartedAt - 1_000
    ));

    if (
      isInitialFetch
      && seenEvents.current.size === 0
      && notifications.length > 0
      && !hasPendingNotificationInResponse
      && !hasRecentNotificationInResponse
    ) {
      notifications.forEach((notification) => {
        seenEvents.current.add(notification.id);
        seenEvents.current.add(notification.latestNotificationId || notification.id);
      });
      persistSeenEvents(storageKey, seenEvents.current);
      return;
    }

    const freshGroups = notifications.filter((notification) => {
      const latestId = notification.latestNotificationId || notification.id;
      return !seenEvents.current.has(latestId) && !seenEvents.current.has(notification.id);
    });
    if (freshGroups.length === 0) return;

    freshGroups.forEach((group) => {
      const groupId = group.notificationGroupId || group.id;
      const latestId = group.latestNotificationId || group.id;
      seenEvents.current.add(group.id);
      seenEvents.current.add(latestId);
      pendingIds.delete(latestId);

      const metadata = notificationMetadata(group);
      // Manager branch copies are presented by the Manager inbox listener.
      if (metadata.managerGroupId) return;

      refreshNotificationDomain(group, queryClient, tenantId);
      void refreshGroupDomainEvents(group, queryClient, tenantId, seenEvents.current, storageKey);

      if (group.read) return;
      if (getNotificationActorId(group) === userId) {
        queuedOwnNotifications.current.set(groupId, group);
        return;
      }

      void presentNotificationGroup(group, groupId, latestId, presentationIdentity, markAsRead);
    });

    persistSeenEvents(storageKey, seenEvents.current);

    if (!processingOwnQueue.current && queuedOwnNotifications.current.size > 0) {
      processingOwnQueue.current = true;
      void (async () => {
        try {
          while (queuedOwnNotifications.current.size > 0) {
            await waitForNotificationActionBarrier();
            const batch = [...queuedOwnNotifications.current.values()];
            queuedOwnNotifications.current.clear();
            for (const group of batch) {
              const groupId = group.notificationGroupId || group.id;
              const latestId = group.latestNotificationId || group.id;
              await presentNotificationGroup(group, groupId, latestId, presentationIdentity, markAsRead);
            }
          }
        } finally {
          processingOwnQueue.current = false;
        }
      })();
    }
  }, [authUser?.clientTenantId, authUser?.id, authUser?.tenantId, isFetched, markAsRead, notifications, presentationIdentity, queryClient, storageKey, tenantId, userId]);
}

async function refreshGroupDomainEvents(
  group: Notification,
  queryClient: ReturnType<typeof useQueryClient>,
  tenantId: string,
  seenEvents: Set<string>,
  storageKey: string,
) {
  const groupId = group.notificationGroupId || group.id;
  let cursor: string | null = null;
  let sawMember = false;
  try {
    do {
      const page = await notificationsService.getInboxGroupItems(groupId, cursor);
      page.items.forEach((member) => {
        sawMember = true;
        if (seenEvents.has(member.id)) return;
        seenEvents.add(member.id);
        refreshNotificationDomain(member, queryClient, tenantId);
      });
      cursor = page.nextCursor;
    } while (cursor);
  } catch {
    // Group details are optional for cache recovery; the summary still signals its latest domain update.
  }
  if (!sawMember) refreshNotificationDomain(group, queryClient, tenantId);
  persistSeenEvents(storageKey, seenEvents);
}

async function presentNotificationGroup(
  group: Notification,
  groupId: string,
  latestId: string,
  identity: string,
  markAsRead: (id: string) => Promise<void>,
) {
  const claimedEvent = await claimNotificationPresentation(identity, `event:${latestId}`);
  if (!claimedEvent) return;
  const shouldSound = await claimNotificationPresentation(identity, `sound:${groupId}`);
  if (shouldSound) playNotificationSound();

  const navigation = getNotificationNavigation(group);
  const openLatestNotification = () => {
    void markAsRead(latestId);
    navigateToNotification(group);
  };
  toast.info(group.title || 'Nueva notificación', {
    id: `notification-group:${groupId}`,
    description: group.message || 'Tienes una novedad pendiente de revisar.',
    action: {
      label: navigation.module === 'tickets' ? 'Abrir ticket' : 'Abrir',
      onClick: openLatestNotification,
    },
  });

  if (typeof document !== 'undefined' && document.hidden) {
    void showPersistentBrowserNotification({
      title: group.title || 'Nueva notificación',
      body: group.message || 'Tienes una novedad pendiente de revisar.',
      tag: `notification-group:${groupId}`,
      notificationId: latestId,
      renotify: shouldSound,
      silent: !shouldSound,
      url: group.link || '/',
      onClick: openLatestNotification,
    });
  }
}

function notificationMetadata(notification: Notification): Record<string, unknown> {
  if (notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)) {
    return notification.metadata as Record<string, unknown>;
  }
  return {};
}

function persistSeenEvents(storageKey: string, events: Set<string>) {
  try { localStorage.setItem(storageKey, JSON.stringify([...events].slice(-1_000))); } catch {
    // Optional history.
  }
}
