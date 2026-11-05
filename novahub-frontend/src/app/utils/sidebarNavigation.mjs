/**
 * Hide duplicate in-page navigation while the desktop sidebar exposes the same destinations.
 * @param {boolean | undefined} isSidebarCollapsed
 * @returns {string}
 */
export function getSidebarAwareNavigationClass(isSidebarCollapsed) {
  return isSidebarCollapsed === false ? 'lg:hidden' : '';
}
