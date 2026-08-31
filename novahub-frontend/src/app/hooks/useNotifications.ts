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
    const userKey = authUser?.id || 'current';
    // El buzón es tenant + usuario: evitar reutilizar en memoria el inbox de
    // otra sesión cuando se cambia de cuenta sin recargar la aplicación.
    const queryKey = ['tenant-module', tenantKey, 'notifications', userKey, 'inbox'] as const;
    const notificationsQuery = useTenantQuery<Notification[]>(
        ['notifications', userKey, 'inbox'],
        signal => notificationsService.getAll(signal),
        {
            // Las alertas de Compras deben aparecer casi en tiempo real para
            // que la aprobación de una solicitud/orden no dependa de una
            // ventana de espera de 30 segundos.
            refetchInterval: 5000,
            // El shell global mantiene el inbox activo aunque el usuario esté
            // en otra pestaña o módulo; el hook de alertas usa este cambio
            // para reproducir el aviso sin esperar a abrir Notificaciones.
            refetchIntervalInBackground: true,
            refetchOnWindowFocus: true,
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
        isFetched: notificationsQuery.isFetched,
    };
}
