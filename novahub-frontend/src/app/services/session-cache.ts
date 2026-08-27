const LOCAL_CACHE_PREFIXES = [
  'nh-',
  'erp-',
  'novahub:',
  'nova-',
  'cat_code_override_',
];

const PERSISTED_UI_KEYS = new Set([
  'erp-active-module',
  'erp-active-submodule',
  'erp-sidebar-collapsed',
  'novahub:manager-sidebar-collapsed',
  'novahub-pos-catalog-view',
  'novahub-pos-show-availability',
]);

function shouldPreserveUiStateOnRefresh(key: string) {
  return PERSISTED_UI_KEYS.has(key)
    || key.startsWith('erp-scroll-position:')
    || key.startsWith('novahub-pos-draft:')
    || key.startsWith('novahub:sales-draft:');
}

function shouldRemoveLocalKey(key: string) {
  return LOCAL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Removes client-side ERP state that can contain tenant data, navigation,
 * permissions, impersonation context or user-specific module preferences.
 * Public-access sessions use their own storage namespace and are preserved.
 */
export function clearSessionCache(options: { preserveAuthToken?: boolean; preserveImpersonation?: boolean; preserveSessionBranding?: boolean } = {}) {
  if (typeof window === 'undefined') return;

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key || !shouldRemoveLocalKey(key)) continue;
      if (options.preserveAuthToken && key === 'nh-auth-token') continue;
      if (options.preserveSessionBranding && key === 'nh-session-branding') continue;
      // A hard refresh restores the same authenticated workspace. Keep only
      // explicitly scoped UI preferences and POS drafts; a normal login or
      // logout still clears them so state cannot cross identities.
      if (options.preserveAuthToken && shouldPreserveUiStateOnRefresh(key)) continue;
      if (options.preserveImpersonation && (
        key === 'nh-manager-token'
        || key === 'nh-impersonation-state'
        || key === 'nh-manager-session-branding'
      )) continue;
      window.localStorage.removeItem(key);
    }
  } catch {
    // Private browsing or restricted storage must not block authentication.
  }

  try {
    // All sessionStorage entries belong to the ERP SPA: search state, pending
    // navigation, onboarding drafts and recovery markers must not cross users.
    window.sessionStorage.clear();
  } catch {
    // Ignore restricted storage environments.
  }
}
