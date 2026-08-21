import { QueryClient } from '@tanstack/react-query';

/**
 * Single QueryClient instance for the ERP.
 *
 * Keeping the instance in its own module lets the authentication boundary
 * clear all in-memory server data when a session changes, including queries
 * whose legacy keys do not yet contain a tenant id.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
