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

/** Permission is requested only from the explicit button in the Push view. */
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
