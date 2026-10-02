import { useEffect } from 'react';
import { useQuery, type QueryClient, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { runWithReportRequestLimit } from '../utils/report-request-limiter';

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
    // Most tenant-scoped lists do not change every few seconds. Keep the
    // result fresh enough for normal ERP work while avoiding duplicate reads
    // when users switch tabs or remount a view. Mutations invalidate queries.
    staleTime: 60_000,
    gcTime: 10 * 60_000,
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

/**
 * Invalida las consultas creadas con `useTenantQuery`.
 *
 * Esas consultas usan la clave `['tenant-module', tenantKey, ...key]`, así que
 * invalidar con la clave cruda (`['projects', projectId, ...]`) nunca coincide y la
 * vista queda con datos viejos. Las mutaciones deben usar este helper.
 */
export const invalidateTenantQueries = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: ['tenant-module'] });

/**
 * Carga todas las páginas de un listado usado por un reporte.
 * Las pantallas operativas conservan su paginación; los reportes necesitan
 * consolidar el total de registros antes de construir sus tablas y métricas.
 */
export async function fetchAllReportPages<T = any>(
  fetchPage: (filters: Record<string, any>) => Promise<any>,
  filters: Record<string, any> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const firstResponse = await runWithReportRequestLimit(() => fetchPage({ ...filters, page: 1 }), signal);
  const firstRows = asList(firstResponse);
  const meta = firstResponse?.meta || firstResponse?.data?.meta || firstResponse?.data?.data?.meta || {};
  const pageSize = Math.max(1, Number(meta.pageSize || filters.pageSize || firstRows.length || 1));
  const total = Math.max(firstRows.length, Number(meta.total || firstRows.length));
  const totalPages = Math.max(1, Number(meta.totalPages) || Math.ceil(total / pageSize));

  if (totalPages === 1) return firstRows as T[];

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      runWithReportRequestLimit(() => fetchPage({ ...filters, page: index + 2 }), signal),
    ),
  );
  return firstRows.concat(remaining.flatMap(asList)) as T[];
}
