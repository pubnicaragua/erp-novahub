import { api } from './api';

export interface AuditLog {
  id: string;
  createdAt: string;
  clientTenantId: string;
  branchId?: string;
  branchName?: string | null;
  enterpriseGroupId?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  userId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  module: string;
  submodule?: string | null;
  view?: string | null;
  action: string;
  actionType?: string | null;
  entity: string;
  entityId: string;
  entityLabel?: string | null;
  description?: string | null;
  result?: string | null;
  source?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  changedFields?: unknown;
  context?: unknown;
  metadata?: unknown;
  details?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  endpoint?: string | null;
  correlationId?: string | null;
  user?: { id: string; name: string; email: string; role?: string | null } | null;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  role?: string;
  enterpriseGroupId?: string;
  companyId?: string;
  branchId?: string;
  module?: string;
  submodule?: string;
  view?: string;
  action?: string;
  actionType?: string;
  entity?: string;
  result?: string;
  source?: string;
  search?: string;
  identifier?: string;
}

export interface AuditLogResponse {
  items: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditFilterOptions {
  modules: string[];
  submodules: string[];
  actions: string[];
  entities: string[];
  results: string[];
  roles: string[];
  users: Array<{ id: string; name?: string | null; email?: string | null; role?: string | null }>;
  branches?: Array<{ id: string; name: string; companyId?: string | null; companyName?: string | null }>;
  companies?: Array<{ id: string; name: string }>;
}

function paramsFromQuery(query: AuditLogQuery) {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== '' && value !== null),
  ) as Record<string, string | number>;
}

export const auditService = {
  list: (query: AuditLogQuery = {}, signal?: AbortSignal) =>
    api.get<AuditLogResponse>('/audit/logs', { params: paramsFromQuery(query), signal }),
  get: (id: string, signal?: AbortSignal) => api.get<AuditLog>(`/audit/logs/${encodeURIComponent(id)}`, { signal }),
  filterOptions: (signal?: AbortSignal) => api.get<AuditFilterOptions>('/audit/filter-options', { signal }),
  export: (query: AuditLogQuery = {}, signal?: AbortSignal) =>
    api.get<AuditLogResponse>('/audit/logs/export', { params: paramsFromQuery({ ...query, page: 1, pageSize: 100 }), signal }),
};
