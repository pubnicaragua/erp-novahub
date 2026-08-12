import { useEffect } from 'react';

/**
 * Import previews are full-screen workspaces. Notify the app shell so the
 * sidebar cannot cover the table when the preview is mounted.
 */
export function useImportPreviewLayout() {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('erp-import-preview-opened'));
  }, []);
}
