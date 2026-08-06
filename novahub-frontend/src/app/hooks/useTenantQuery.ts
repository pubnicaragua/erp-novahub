import { useEffect } from 'react';
import { useQuery, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';

/** Shared tenant-scoped query policy for support and activities modules. */
export function useTenantQuery<TData>(
  key: QueryKey,
  queryFn: (signal: AbortSignal) => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error, TData, QueryKey>, 'queryKey' | 'queryFn'> & { onError?: (error: Error) => void },
) {
  const { user } = useAuth();
  const authUser = user as (typeof user & { clientTenantId?: string }) | null | undefined;
  const tenantKey = authUser?.clientTenantId || authUser?.tenantId || 'current';
  const { onError, ...queryOptions } = options || {};
  const result = useQuery({
    queryKey: ['tenant-module', tenantKey, ...key],
    queryFn: ({ signal }) => queryFn(signal),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    ...queryOptions,
  });
  useEffect(() => {
    if (result.error && onError) onError(result.error);
  }, [result.error, onError]);
  return result;
}

export const asList = (response: any): any[] =>
  Array.isArray(response) ? response : Array.isArray(response?.data) ? response.data : [];
