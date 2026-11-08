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

export interface MasterConsoleTenantStorage {
  id: string;
  name: string;
  slug: string;
  objects: number;
  bytes: number;
  heavyImageBytes: number;
  recoverableBytes: number;
  lastActivityAt: string;
  idleDays: number | null;
  inactive: boolean;
  suspended: boolean;
}

/** Detalle del consumo para decidir dónde optimizar (solo lectura). */
export interface MasterConsoleStorageReport {
  measuredAt: string;
  inactiveDays: number;
  heavyImageThresholdBytes: number;
  totals: { bytes: number; objects: number };
  byKind: Array<{ kind: string; label: string; objects: number; bytes: number }>;
  byModule: Array<{ bucket: string; module: string | null; objects: number; bytes: number }>;
  heavyImages: { objects: number; bytes: number; estimatedRecoverableBytes: number };
  tenants: MasterConsoleTenantStorage[];
  inactiveTenants: { count: number; objects: number; bytes: number; top: MasterConsoleTenantStorage[] };
  withoutOwner: { objects: number; bytes: number };
  heaviestFiles: Array<{ id: string; tenantName: string | null; bucket: string; fileName: string; mimeType: string | null; bytes: number; module: string | null; createdAt: string }>;
  largestTables: Array<{ name: string; bytes: number; liveRows: number }>;
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

export interface MasterConsoleClientDetail extends Record<string, unknown> {
  enabledSpecificFeatures: Array<{
    key: string;
    label: string;
    description: string;
  }>;
}

export const masterConsoleService = {
  getOverview: (signal?: AbortSignal) =>
    api.get<MasterConsoleOverview>('/master-console/overview', { signal }),
  getStorageMetrics: (signal?: AbortSignal) =>
    api.get<MasterConsoleStorageMetrics>('/master-console/storage-metrics', { signal }),
  getStorageReport: (inactiveDays: number, signal?: AbortSignal) =>
    api.get<MasterConsoleStorageReport>(`/master-console/storage-report?inactiveDays=${encodeURIComponent(String(inactiveDays))}&top=15`, { signal }),
  getClientDetail: (tenantId: string, signal?: AbortSignal) =>
    api.get<MasterConsoleClientDetail>('/master-console/client/' + tenantId, { signal }),
};
