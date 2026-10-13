export interface KpiSummaryQuery<T> {
  data?: T[];
  isLoading?: boolean;
  isPending?: boolean;
  isError?: boolean;
}

/** Returns complete summary rows only when their request succeeded. */
export function getKpiSummaryRows<T>(query: KpiSummaryQuery<T>): T[] | null {
  if (query.isLoading || query.isPending || query.isError || !Array.isArray(query.data)) return null;
  return query.data;
}
