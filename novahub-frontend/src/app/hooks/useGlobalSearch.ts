import { useEffect } from 'react'

/**
 * Reads a global search term stored by the GlobalSearch component (sidebar).
 * Call this in any view component that should receive external search queries.
 */
export function useGlobalSearch(setSearchTerm: (term: string) => void, moduleKey: string) {
  useEffect(() => {
    try {
      const storedModule = sessionStorage.getItem('global-search-module')
      const storedTerm = sessionStorage.getItem('global-search-term')
      if (storedModule === moduleKey && storedTerm) {
        setSearchTerm(storedTerm)
        // Clear so it doesn't re-apply on subsequent renders
        sessionStorage.removeItem('global-search-term')
        sessionStorage.removeItem('global-search-module')
      }
    } catch { /* localStorage not available */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
