import { useEffect, useRef } from 'react';
import { useNotifications } from './useNotifications';

let soundCtx: AudioContext | null = null;

function playNotificationSound() {
  try {
    soundCtx = soundCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    if (soundCtx.state === 'suspended') void soundCtx.resume();
    const osc = soundCtx.createOscillator();
    const gain = soundCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, soundCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, soundCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(soundCtx.destination);
    osc.start();
    osc.stop(soundCtx.currentTime + 0.65);
  } catch {
    // El audio puede estar bloqueado por el navegador; la campana sigue siendo la fuente de verdad.
  }
}

/**
 * Detecta notificaciones entrantes nuevas (polling cada 30s) y:
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

    const newest = fresh[fresh.length - 1];
    playNotificationSound();

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