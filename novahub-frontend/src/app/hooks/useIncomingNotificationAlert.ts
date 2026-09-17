import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { playNotificationSound } from '../utils/notificationSound';
import { useAuth } from '../contexts/AuthContext';
import { dedupeNotificationRecords, notificationEventKey, subscribeToNotificationEvents } from '../services/notifications.service';
import { isBrowserNotificationsEnabled } from '../utils/browserNotifications';
import { toast } from 'sonner';
import { getNotificationNavigation, navigateToNotification } from '../utils/notificationNavigation';

/**
 * Detecta notificaciones entrantes entregadas por el stream SSE global y:
 * - Reproduce un sonido corto.
 * - Si la pestaña está en segundo plano, dispara una Notification del navegador.
 * Montar una sola vez (p.ej. en DashboardLayout).
 */
export function useIncomingNotificationAlert() {
  const { user } = useAuth();
  const { notifications, isFetched, markAsRead } = useNotifications();
  const authUser = user as (typeof user & { clientTenantId?: string; tenantId?: string }) | null | undefined;
  const storageKey = `nh-notification-seen:${authUser?.clientTenantId || authUser?.tenantId || 'current'}:${authUser?.id || 'current'}`;
  // Guardamos ids y claves de evento. El id cambia si un scheduler reintenta
  // crear la misma alerta, pero la clave de negocio debe sonar una sola vez.
  const seenEvents = useRef<Set<string>>(new Set());
  const pendingLiveNotificationIds = useRef<Set<string>>(new Set());
  const alertSessionStartedAt = useRef<number | undefined>(undefined);
  const initialized = useRef(false);

  useEffect(() => {
    initialized.current = false;
    seenEvents.current = new Set();
    pendingLiveNotificationIds.current = new Set();
    alertSessionStartedAt.current = Date.now();
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) seenEvents.current = new Set(stored.map(String));
    } catch { /* notification history is optional */ }
  }, [storageKey]);

  useEffect(() => {
    if (!authUser?.id) return undefined;
    const streamIdentity = `${authUser?.clientTenantId || authUser?.tenantId || 'current'}:${authUser.id}`;
    return subscribeToNotificationEvents(streamIdentity, (event) => {
      if (event.reason !== 'created') return;
      (event.notificationIds || []).forEach((id) => {
        const normalizedId = String(id || '').trim();
        if (normalizedId) pendingLiveNotificationIds.current.add(normalizedId);
      });
    });
  }, [authUser?.clientTenantId, authUser?.id, authUser?.tenantId, storageKey]);

  useEffect(() => {
    if (!isFetched) return;
    const isInitialFetch = !initialized.current;
    initialized.current = true;

    // The first response is the existing history, not an incoming event.
    // Seed it so a remount/F5 does not replay dozens of old notifications.
    const pendingIds = pendingLiveNotificationIds.current;
    const hasPendingNotificationInResponse = notifications.some((notification) => pendingIds.has(notification.id));
    const sessionStartedAt = alertSessionStartedAt.current ?? Date.now();
    const hasRecentNotificationInResponse = notifications.some((notification) => (
      new Date(notification.timestamp).getTime() >= sessionStartedAt - 1000
    ));

    if (isInitialFetch && seenEvents.current.size === 0 && notifications.length > 0 && !hasPendingNotificationInResponse && !hasRecentNotificationInResponse) {
      notifications.forEach((notification) => {
        seenEvents.current.add(notification.id);
        seenEvents.current.add(notificationEventKey(notification));
      });
      try { localStorage.setItem(storageKey, JSON.stringify([...seenEvents.current].slice(-1000))); } catch { /* optional history */ }
      return;
    }

    const fresh = dedupeNotificationRecords(
      notifications.filter((notification) => (
        !notification.read
        && !seenEvents.current.has(notification.id)
        && !seenEvents.current.has(notificationEventKey(notification))
      )),
    );
    if (fresh.length === 0) return;

    const freshKeys = new Set(fresh.map(notificationEventKey));
    notifications
      .filter(notification => freshKeys.has(notificationEventKey(notification)))
      .forEach(notification => {
        seenEvents.current.add(notification.id);
        seenEvents.current.add(notificationEventKey(notification));
        pendingIds.delete(notification.id);
      });
    try { localStorage.setItem(storageKey, JSON.stringify([...seenEvents.current].slice(-1000))); } catch { /* optional history */ }

    const newest = [...fresh].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || fresh[0];
    const navigation = getNotificationNavigation(newest);
    playNotificationSound();
    toast.info(newest.title || 'Nueva notificación', {
      description: newest.message || 'Tienes una novedad pendiente de revisar.',
      duration: 6000,
      position: 'top-right',
      action: {
        label: navigation.module === 'tickets' ? 'Abrir ticket' : 'Abrir',
        onClick: () => {
          void markAsRead(newest.id);
          navigateToNotification(newest);
        },
      },
    });

    if (document.hidden && isBrowserNotificationsEnabled()) {
      try {
        const notification = new Notification(newest.title || 'Nueva notificación', {
          body: newest.message || '',
          tag: notificationEventKey(newest),
          icon: '/novahub-isotipo.png',
        });
        notification.onclick = () => {
          window.focus();
          void markAsRead(newest.id);
          navigateToNotification(newest);
          notification.close();
        };
      } catch {
        // Algunos navegadores bloquean la construcción; la campana interna sigue funcionando.
      }
    }
  }, [isFetched, notifications, storageKey, markAsRead]);
}
