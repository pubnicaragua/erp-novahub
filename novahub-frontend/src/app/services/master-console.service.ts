import { api } from './api';

export interface MasterConsoleStorageMetrics {
  files: {
    bytes: number;
    objects: number;
  };
  database: {
    status: 'available' | 'unavailable';
    physicalBytes: number;
    tableBytes: number;
    indexBytes: number;
    relationBytes: number;
    liveRows: number;
  };
  totalBytes: number;
  measuredAt: string;
  enforcement: 'informational-only';
}

export interface MasterConsoleOverview {
  totalTenants: number;
  activeTenants: number;
  tenantsInMora: number;
  suspendedTenants: number;
  pendingImplementations: number;
  ingresosEsperados: number;
  ingresosCobrados: number;
  montoPorCobrar: number;
  facturasVencidas: number;
  deudaTotal: number;
  planDistribution: Record<string, number>;
  totalActiveUsers: number;
  totalUsers: number;
  pendingRequests: number;
  pendingRequestDetails: Array<{
    id: string;
    requestedModule?: string;
    status: string;
    createdAt: string;
    clientTenant?: { name?: string } | null;
  }>;
  openTickets: number;
  recentAlerts: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: string;
    clientTenantId: string | null;
    userId: string | null;
  }>;
  empresasConDeuda: Array<{
    id: string;
    name: string;
    plan: string;
    deuda: number;
    facturasVencidas: number;
  }>;
  tenantsSummary: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    isActive: boolean;
    status: string;
    users: number;
    modulesActive: number;
    createdAt: string;
    inMora: boolean;
  }>;
}

export const masterConsoleService = {
  getOverview: (signal?: AbortSignal) =>
    api.get<MasterConsoleOverview>('/master-console/overview', { signal }),
  getStorageMetrics: (signal?: AbortSignal) =>
    api.get<MasterConsoleStorageMetrics>('/master-console/storage-metrics', { signal }),
  getClientDetail: (tenantId: string, signal?: AbortSignal) =>
    api.get<Record<string, unknown>>('/master-console/client/' + tenantId, { signal }),
};
