import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications } from './useNotifications';
import { playNotificationSound } from '../utils/notificationSound';
import { useAuth } from '../contexts/AuthContext';
import {
  dedupeNotificationRecords,
  getNotificationActorId,
  notificationEventKey,
  subscribeToNotificationEvents,
} from '../services/notifications.service';
import { waitForNotificationActionBarrier } from '../services/notification-action-coordinator';
import { isBrowserNotificationsEnabled } from '../utils/browserNotifications';
import { toast } from '@/app/services/toast';
import { getNotificationNavigation, navigateToNotification } from '../utils/notificationNavigation';
import { refreshNotificationDomain } from '../services/notification-domain-refresh';
import type { Notification } from '../types';

/**
 * Global notification presentation.
 *
 * The inbox remains the source of truth. SSE only invalidates it and provides
 * a low-latency hint; dedupe keys make reconnects and repeated invalidations
 * harmless. Events caused by the current actor wait for the local operation
 * toast, while events caused by another actor are presented immediately.
 */
export function useIncomingNotificationAlert() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { notifications, isFetched, markAsRead } = useNotifications();
  const authUser = user as (typeof user & { clientTenantId?: string; tenantId?: string }) | null | undefined;
  const storageKey = `nh-notification-seen:${authUser?.clientTenantId || authUser?.tenantId || 'current'}:${authUser?.id || 'current'}`;
  const seenEvents = useRef<Set<string>>(new Set());
  const pendingLiveNotificationIds = useRef<Set<string>>(new Set());
  const queuedOwnNotifications = useRef<Notification[]>([]);
  const queuedOwnKeys = useRef<Set<string>>(new Set());
  const processingOwnQueue = useRef(false);
  const initialized = useRef(false);
  const alertSessionStartedAt = useRef<number | undefined>(undefined);

  useEffect(() => {
    initialized.current = false;
    seenEvents.current = new Set();
    pendingLiveNotificationIds.current = new Set();
    queuedOwnNotifications.current = [];
    queuedOwnKeys.current = new Set();
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
    const streamIdentity = `${authUser.clientTenantId || authUser.tenantId || 'current'}:${authUser.id}`;
    return subscribeToNotificationEvents(streamIdentity, (event) => {
      if (event.reason !== 'created') return;
      (event.notificationIds || []).forEach((id) => {
        const normalizedId = String(id || '').trim();
        if (normalizedId) pendingLiveNotificationIds.current.add(normalizedId);
      });
    });
  }, [authUser?.clientTenantId, authUser?.id, authUser?.tenantId]);

  useEffect(() => {
    if (!isFetched) return;
    const isInitialFetch = !initialized.current;
    initialized.current = true;

    // The first response is existing history, not a live event. Seed it so a
    // remount/F5 does not replay old notifications.
    const pendingIds = pendingLiveNotificationIds.current;
    const hasPendingNotificationInResponse = notifications.some((notification) => pendingIds.has(notification.id));
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
        seenEvents.current.add(notificationEventKey(notification));
      });
      try { localStorage.setItem(storageKey, JSON.stringify([...seenEvents.current].slice(-1_000))); } catch {
        // Optional history.
      }
      return;
    }

    const fresh = dedupeNotificationRecords(
      notifications.filter((notification) => (
        !notification.read
        && !seenEvents.current.has(notification.id)
        && !seenEvents.current.has(notificationEventKey(notification))
      )),
    ).sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
    if (fresh.length === 0) return;

    fresh.forEach((notification) => {
      const key = notificationEventKey(notification);
      seenEvents.current.add(notification.id);
      seenEvents.current.add(key);
      pendingIds.delete(notification.id);

      const metadata = notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)
        ? notification.metadata as Record<string, unknown>
        : {};
      // Manager-group copies have their own SSE/presentation path. Keeping
      // them out of the tenant listener prevents two toasts for one event.
      if (metadata.managerGroupId) return;

      // The notification is also the low-latency domain-change signal. Query
      // invalidation is active-only; mounted legacy views receive the same
      // detail through the local refresh bus.
      refreshNotificationDomain(notification, queryClient, authUser?.clientTenantId || authUser?.tenantId || 'current');

      if (getNotificationActorId(notification) === String(authUser?.id || '')) {
        if (!queuedOwnKeys.current.has(key)) {
          queuedOwnKeys.current.add(key);
          queuedOwnNotifications.current.push(notification);
        }
        return;
      }

      // A different user's action, scheduler event, or legacy event without
      // actorId must not wait for a local operation toast.
      presentNotification(notification, markAsRead);
    });

    try { localStorage.setItem(storageKey, JSON.stringify([...seenEvents.current].slice(-1_000))); } catch {
      // Optional history.
    }

    if (!processingOwnQueue.current && queuedOwnNotifications.current.length > 0) {
      processingOwnQueue.current = true;
      void (async () => {
        try {
          while (queuedOwnNotifications.current.length > 0) {
            await waitForNotificationActionBarrier();
            const batch = queuedOwnNotifications.current.splice(0);
            batch.forEach((notification) => presentNotification(notification, markAsRead));
          }
        } finally {
          processingOwnQueue.current = false;
        }
      })();
    }
  }, [authUser?.clientTenantId, authUser?.id, authUser?.tenantId, isFetched, markAsRead, notifications, queryClient, storageKey]);
}

function presentNotification(
  notification: Notification,
  markAsRead: (id: string) => Promise<void>,
): void {

  const navigation = getNotificationNavigation(notification);
  playNotificationSound();
  toast.info(notification.title || 'Nueva notificación', {
    description: notification.message || 'Tienes una novedad pendiente de revisar.',
    action: {
      label: navigation.module === 'tickets' ? 'Abrir ticket' : 'Abrir',
      onClick: () => {
        void markAsRead(notification.id);
        navigateToNotification(notification);
      },
    },
  });

  if (typeof document !== 'undefined' && document.hidden && typeof Notification !== 'undefined' && isBrowserNotificationsEnabled()) {
    try {
      const browserNotification = new Notification(notification.title || 'Nueva notificación', {
        body: notification.message || '',
        tag: notificationEventKey(notification),
        icon: '/novahub-isotipo.png',
      });
      browserNotification.onclick = () => {
        window.focus();
        void markAsRead(notification.id);
        navigateToNotification(notification);
        browserNotification.close();
      };
    } catch {
      // The in-app toast and bell remain available when browser notifications fail.
    }
  }

}
