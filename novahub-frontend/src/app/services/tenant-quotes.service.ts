import { api } from './api';
import type { PlatformQuote } from './enterprise-groups.service';

export interface TenantQuotesImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: number;
  results: Array<{ row: number; number: string | null; result: 'CREATED' | 'SKIPPED' | 'ERROR'; message: string }>;
}

export interface QuoteOwners { canAssign: boolean; users: Array<{ id: string; name: string }> }
export interface CopyTarget { id: string; name: string; slug: string; isActive: boolean }

export interface CopyQuotesResult {
  tenant: string;
  requested: number;
  copied: number;
  skippedAlreadyCopied: string[];
  failed: Array<{ number: string; message: string }>;
}

/** Cotizaciones avanzadas de la empresa del usuario (función específica «Cotizaciones avanzadas»). */
export const tenantQuotesService = {
  getCapabilities: (signal?: AbortSignal) =>
    api.get<{ advancedQuotes: boolean; canManageAll: boolean }>('/sales/proposals/capabilities', { signal }),
  getOwners: (signal?: AbortSignal) => api.get<QuoteOwners>('/sales/proposals/owners', { signal }),
  list: (params?: { search?: string; status?: string }, signal?: AbortSignal) =>
    api.get<PlatformQuote[]>('/sales/proposals', { params, signal }),
  create: (body: any) => api.idempotentPost<PlatformQuote>('/sales/proposals', body),
  update: (id: string, body: any) => api.idempotentPatch<PlatformQuote>(`/sales/proposals/${id}`, body),
  updateStatus: (id: string, status: PlatformQuote['status']) =>
    api.idempotentPatch<PlatformQuote>(`/sales/proposals/${id}/status`, { status }),
  remove: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/sales/proposals/${id}`),
  duplicate: (id: string) => api.post<PlatformQuote>(`/sales/proposals/${id}/duplicate`, {}),
  importQuotes: (rows: any[]) => api.post<TenantQuotesImportResult>('/sales/proposals/import', { rows }),
  /** SuperAdmin: empresas que ya tienen habilitadas las cotizaciones avanzadas. */
  listCopyTargets: (search: string, signal?: AbortSignal) =>
    api.get<CopyTarget[]>('/tenant-quotes/platform/targets', { params: { search: search || undefined }, signal }),
  /** SuperAdmin: copia cotizaciones de plataforma a una empresa sin modificar las originales. */
  copyFromPlatform: (body: { targetTenantId: string; quoteIds?: string[]; all?: boolean }) =>
    api.post<CopyQuotesResult>('/tenant-quotes/platform/copy', body),
};
