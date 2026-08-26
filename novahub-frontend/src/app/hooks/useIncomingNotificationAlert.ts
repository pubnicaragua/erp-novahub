import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';
import { playNotificationSound } from '../utils/notificationSound';
import { toast } from 'sonner';

/**
 * Detecta notificaciones entrantes nuevas (polling cada 5s) y:
 * - Reproduce un sonido corto.
 * - Si la pestaña está en segundo plano, dispara una Notification del navegador.
 * Montar una sola vez (p.ej. en DashboardLayout).
 */
export function useIncomingNotificationAlert() {
  const { notifications } = useNotifications();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (seenIds.current === null) {
      seenIds.current = new Set(notifications.map(n => n.id));
      return;
    }
    const fresh = notifications.filter(n => !n.read && !seenIds.current!.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach(n => seenIds.current!.add(n.id));

    const newest = [...fresh].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] || fresh[0];
    playNotificationSound();
    toast.info(newest.title || 'Nueva notificación', {
      description: newest.message || 'Tienes una novedad pendiente de revisar.',
      duration: 6000,
    });

    if (document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        const notification = new Notification(newest.title || 'Nueva notificación', {
          body: newest.message || '',
          tag: newest.id,
          icon: '/favicon.svg',
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Algunos navegadores bloquean la construcción; la campana interna sigue funcionando.
      }
    }
  }, [notifications]);
}
