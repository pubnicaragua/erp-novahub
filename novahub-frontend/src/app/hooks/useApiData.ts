import { useState, useEffect, useCallback } from 'react';
import type { PaginatedResponse, ApiFilters } from '../types';

interface UseApiDataOptions {
  autoFetch?: boolean;
}

interface UseApiDataReturn<T> {
  data: T[];
  meta: PaginatedResponse<T>['meta'] | null;
  loading: boolean;
  error: string | null;
  filters: ApiFilters;
  setFilters: (filters: Partial<ApiFilters>) => void;
  refresh: () => void;
}

export function useApiData<T>(
  fetchFn: (filters: ApiFilters) => Promise<PaginatedResponse<T>>,
  options: UseApiDataOptions = { autoFetch: true }
): UseApiDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [meta, setMeta] = useState<PaginatedResponse<T>['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<ApiFilters>({
    page: 1,
    pageSize: 20,
    sortOrder: 'desc',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn(filters);
      setData(result.data);
      setMeta(result.meta);
    } catch (err: any) {
      setError(err.message || 'Error al cargar datos');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, filters]);

  const setFilters = useCallback((newFilters: Partial<ApiFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters, page: newFilters.page ?? 1 }));
  }, []);

  useEffect(() => {
    if (options.autoFetch) {
      const load = async () => {
        setLoading(true);
        await fetchData();
      };
      load();
    }
  }, [fetchData, options.autoFetch]);

  return { data, meta, loading, error, filters, setFilters, refresh: fetchData };
}
