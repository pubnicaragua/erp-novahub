import { runWithReportRequestLimit } from './report-request-limiter.ts';

function reportRows(response: any): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function reportMeta(response: any) {
  return response?.meta || response?.data?.meta || response?.data?.data?.meta || {};
}

/** Recupera todas las páginas de un reporte, manteniendo los filtros de vista. */
export async function fetchAllReportPages<T = any>(
  fetchPage: (filters: Record<string, any>) => Promise<any>,
  filters: Record<string, any> = {},
  signal?: AbortSignal,
  initialResponse?: any,
): Promise<T[]> {
  const firstResponse = initialResponse || await runWithReportRequestLimit(() => fetchPage({ ...filters, page: 1 }), signal);
  const firstRows = reportRows(firstResponse);
  const meta = reportMeta(firstResponse);
  const pageSize = Math.max(1, Number(meta.pageSize || filters.pageSize || firstRows.length || 1));
  const total = Math.max(firstRows.length, Number(meta.total || firstRows.length));
  const totalPages = Math.max(1, Number(meta.totalPages) || Math.ceil(total / pageSize));
  if (totalPages === 1) return firstRows as T[];

  const remaining: any[] = [];
  for (let offset = 0; offset < totalPages - 1; offset += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, totalPages - offset - 1) }, (_, index) =>
        runWithReportRequestLimit(() => fetchPage({ ...filters, page: offset + index + 2 }), signal),
      ),
    );
    remaining.push(...batch);
  }
  return firstRows.concat(remaining.flatMap(reportRows)) as T[];
}
