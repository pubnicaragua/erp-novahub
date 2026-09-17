import { useEffect } from 'react';
import {
  NOTIFICATION_DOMAIN_REFRESH_EVENT,
  type NotificationDomainRefreshDetail,
} from '../services/notification-domain-refresh';

interface UseNotificationDomainRefreshOptions {
  module: string;
  subModules: string[];
  onRefresh: (detail: NotificationDomainRefreshDetail) => void | Promise<void>;
  enabled?: boolean;
}

/** Subscribes legacy/local-state views to the same notification refresh bus. */
export function useNotificationDomainRefresh({ module, subModules, onRefresh, enabled = true }: UseNotificationDomainRefreshOptions) {
  const subModulesKey = subModules.join('|');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;
    const accepted = new Set(subModulesKey.split('|').map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<NotificationDomainRefreshDetail>).detail;
      const eventModule = String(detail?.navigation?.module || '').trim().toLowerCase();
      const eventSubModule = String(detail?.navigation?.subModule || '').trim().toLowerCase();
      if (eventModule !== String(module || '').trim().toLowerCase() || !accepted.has(eventSubModule)) return;
      void onRefresh(detail);
    };
    window.addEventListener(NOTIFICATION_DOMAIN_REFRESH_EVENT, handler);
    return () => window.removeEventListener(NOTIFICATION_DOMAIN_REFRESH_EVENT, handler);
  }, [enabled, module, onRefresh, subModulesKey]);
}
