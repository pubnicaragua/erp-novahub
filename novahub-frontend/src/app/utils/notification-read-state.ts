import type { NotificationGroupPage } from '../services/notifications.service';

export function markNotificationGroupsRead(page: NotificationGroupPage): NotificationGroupPage {
  return {
    ...page,
    items: page.items.map((notification) => ({ ...notification, read: true, unreadCount: 0 })),
    unreadGroupCount: 0,
    unreadNotificationCount: 0,
  };
}
