import { useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notifications.service';
import type { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useTenantQuery } from './useTenantQuery';

export function useNotifications() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const authUser = user as (typeof user & { clientTenantId?: string }) | null | undefined;
    const tenantKey = authUser?.clientTenantId || authUser?.tenantId || 'current';
    const queryKey = ['tenant-module', tenantKey, 'notifications', 'inbox'] as const;
    const notificationsQuery = useTenantQuery<Notification[]>(
        ['notifications', 'inbox'],
        signal => notificationsService.getAll(signal),
        {
            refetchInterval: 30000,
            refetchIntervalInBackground: false,
        },
    );
    const notifications = notificationsQuery.data ?? [];
    const unreadCount = notifications.filter(notification => !notification.read).length;

    const markAsRead = async (id: string) => {
        try {
            await notificationsService.markAsRead(id);
            queryClient.setQueryData<Notification[]>(queryKey, previous =>
                (previous ?? []).map(notification =>
                    notification.id === id ? { ...notification, read: true } : notification,
                ),
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationsService.markAllAsRead();
            queryClient.setQueryData<Notification[]>(queryKey, previous =>
                (previous ?? []).map(notification => ({ ...notification, read: true })),
            );
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const clearAll = async () => {
        // El inbox es persistente: no debemos simular un borrado local que
        // reaparece en el siguiente polling. Se conserva la semántica segura
        // disponible en backend: marcar todo como leído.
        await markAllAsRead();
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        refresh: notificationsQuery.refetch,
    };
}
