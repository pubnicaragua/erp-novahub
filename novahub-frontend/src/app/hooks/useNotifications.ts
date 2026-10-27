import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { notificationsService, subscribeToNotificationEvents, type NotificationGroupPage } from '../services/notifications.service';
import type { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTenantQuery } from './useTenantQuery';

export function useNotifications() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const authUser = user as (typeof user & { clientTenantId?: string }) | null | undefined;
    const tenantKey = authUser?.clientTenantId || authUser?.tenantId || 'current';
    const userKey = authUser?.id || 'current';
    // El buzón es tenant + usuario: evitar reutilizar en memoria el inbox de
    // otra sesión cuando se cambia de cuenta sin recargar la aplicación.
    const queryKey = ['tenant-module', tenantKey, 'notifications', userKey, 'inbox'] as const;
    const notificationsQuery = useTenantQuery<NotificationGroupPage>(
        ['notifications', userKey, 'inbox'],
        signal => notificationsService.getInboxGroups(signal),
        {
            refetchOnWindowFocus: false,
            // SSE delivers the notification with low latency. This periodic
            // catch-up covers missed reconnects and deployments where multiple
            // API instances do not share their local SSE clients through Redis.
            refetchInterval: 15_000,
            refetchIntervalInBackground: true,
        },
    );

    useEffect(() => {
        if (!authUser?.id || !localStorage.getItem('nh-auth-token')) return undefined;
        const streamIdentity = `${tenantKey}:${userKey}`;
        return subscribeToNotificationEvents(streamIdentity, event => {
            if (event.type !== 'notifications-invalidated') return;
            void queryClient.invalidateQueries({
                queryKey: ['tenant-module', tenantKey, 'notifications', userKey, 'inbox'],
            });
        });
    }, [authUser?.id, tenantKey, userKey, queryClient]);
    const inbox = notificationsQuery.data;
    const notifications = inbox?.items ?? [];
    const unreadCount = inbox?.unreadGroupCount ?? notifications.filter(notification => !notification.read).length;
    const unreadNotificationCount = inbox?.unreadNotificationCount ?? unreadCount;

    useEffect(() => {
        if (typeof navigator === 'undefined') return;
        const appBadgeNavigator = navigator as Navigator & {
            setAppBadge?: (count?: number) => Promise<void> | void;
            clearAppBadge?: () => Promise<void> | void;
        };
        const result = unreadCount > 0
            ? appBadgeNavigator.setAppBadge?.(unreadCount)
            : appBadgeNavigator.clearAppBadge?.();
        void Promise.resolve(result).catch(() => undefined);
    }, [unreadCount]);

    const markAsRead = async (id: string) => {
        try {
            await notificationsService.markAsRead(id);
            queryClient.setQueryData<NotificationGroupPage>(queryKey, previous => previous ? ({
                ...previous,
                items: previous.items.map(notification =>
                    notification.id === id ? { ...notification, read: true, unreadCount: 0 } : notification,
                ),
                unreadGroupCount: Math.max(0, previous.unreadGroupCount - (previous.items.some(item => item.id === id && !item.read) ? 1 : 0)),
                unreadNotificationCount: Math.max(0, previous.unreadNotificationCount - (previous.items.find(item => item.id === id)?.unreadCount || 0)),
            }) : previous);
            await queryClient.invalidateQueries({ queryKey });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markGroupAsRead = async (group: Notification, throughNotificationId?: string) => {
        const groupId = group.notificationGroupId || group.id;
        const readThroughId = throughNotificationId || group.latestNotificationId || group.id;
        try {
            await notificationsService.markInboxGroupRead(groupId, readThroughId);
            await queryClient.invalidateQueries({ queryKey });
        } catch (error) {
            console.error('Error marking notification group as read:', error);
            throw error;
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationsService.markAllAsRead();
            queryClient.setQueryData<NotificationGroupPage>(queryKey, previous => previous ? ({
                ...previous,
                items: previous.items.map(notification => ({ ...notification, read: true, unreadCount: 0 })),
                unreadGroupCount: 0,
                unreadNotificationCount: 0,
            }) : previous,
            );
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const clearAll = async () => {
        // El inbox es persistente: no debemos simular un borrado local que
        // reaparezca cuando el stream emita el siguiente cambio. Se conserva
        // la semántica segura disponible en backend: marcar todo como leído.
        await markAllAsRead();
    };

    return {
        notifications,
        unreadCount,
        unreadNotificationCount,
        markAsRead,
        markGroupAsRead,
        markAllAsRead,
        clearAll,
        refresh: notificationsQuery.refetch,
        isFetched: notificationsQuery.isFetched,
    };
}
