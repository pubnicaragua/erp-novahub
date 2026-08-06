import { useState, useEffect, useCallback } from 'react';
import { notificationsService } from '../services/notifications.service';
import type { Notification } from '../types';

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const data = await notificationsService.getAll();
            setNotifications(data);
            setUnreadCount(data.filter((n: Notification) => !n.read).length);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }, []);

    useEffect(() => {
        const initialTimer = window.setTimeout(fetchNotifications, 0);
        // Polling for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => { window.clearTimeout(initialTimer); clearInterval(interval); };
    }, [fetchNotifications]);

    const markAsRead = async (id: string) => {
        try {
            await notificationsService.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await notificationsService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const clearAll = () => {
        // Not implemented in backend yet, but can keep as local clear for now
        setNotifications([]);
        setUnreadCount(0);
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        clearAll,
        refresh: fetchNotifications
    };
}
