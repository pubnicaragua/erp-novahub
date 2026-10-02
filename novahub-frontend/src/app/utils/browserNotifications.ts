const BROWSER_NOTIFICATIONS_ENABLED_KEY = 'nh-browser-notifications-enabled';

export type BrowserNotificationStatus = NotificationPermission | 'unsupported';

function canUseBrowserNotifications() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

function readPreference() {
  try {
    return window.localStorage.getItem(BROWSER_NOTIFICATIONS_ENABLED_KEY);
  } catch {
    return null;
  }
}

export function getBrowserNotificationStatus(): BrowserNotificationStatus {
  if (!canUseBrowserNotifications()) return 'unsupported';
  return Notification.permission;
}

/** Permission is requested only after an explicit user action. */
export async function enableBrowserNotifications(): Promise<BrowserNotificationStatus> {
  if (!canUseBrowserNotifications()) return 'unsupported';

  try {
    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission === 'granted') {
      try { window.localStorage.setItem(BROWSER_NOTIFICATIONS_ENABLED_KEY, 'true'); } catch { /* optional preference */ }
    }
    return permission;
  } catch {
    return Notification.permission;
  }
}

export function isBrowserNotificationsEnabled() {
  if (!canUseBrowserNotifications() || Notification.permission !== 'granted') return false;
  return readPreference() !== 'false';
}

export function disableBrowserNotifications() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(BROWSER_NOTIFICATIONS_ENABLED_KEY, 'false'); } catch { /* optional preference */ }
}

export async function showPersistentBrowserNotification({
  title,
  body,
  tag,
  url = '/',
  notificationId,
  onClick,
}: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  notificationId?: string;
  onClick?: () => void;
}) {
  if (!isBrowserNotificationsEnabled()) return false;
  const options = {
    body,
    tag,
    icon: '/novahub-isotipo.png',
    badge: '/novahub-isotipo.png',
    data: { url, notificationId },
    renotify: true,
    requireInteraction: false,
    vibrate: [180, 80, 180],
  } as NotificationOptions;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(title, options);
        return true;
      }
    }
  } catch {
    // Fallback below for browsers that expose Notification but not SW alerts.
  }

  try {
    const browserNotification = new Notification(title, options);
    browserNotification.onclick = () => {
      window.focus();
      onClick?.();
      browserNotification.close();
    };
    return true;
  } catch {
    return false;
  }
}
