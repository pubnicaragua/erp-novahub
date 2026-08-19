import { api } from './api';

export interface ManagerGroup {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  catalogMode: string;
  inventoryMode: string;
  branches: Array<{ id: string; name: string; slug: string; logo?: string | null; isActive: boolean; businessUnitId?: string | null }>;
}

export interface ManagerOverview {
  group: ManagerGroup;
  filters: { branchId: string | null; branchIds: string[] };
  branches: Array<{ id: string; name: string; slug: string; logo?: string | null; industry: string; businessUnitId?: string | null; _count: { users: number; products: number; warehouses: number } }>;
  metrics: {
    branches: number;
    users: number;
    activeUsers: number;
    warehouses: number;
    inventoryLines: number;
    inventoryUnits: number;
    reservedUnits: number;
    accountingMovements: number;
    debit: number;
    credit: number;
    storageObjects: number;
    storageBytes: number;
  };
  warehouses: Array<{ id: string; name: string; scopeType: string; clientTenantId: string; businessUnitId?: string | null; location?: string | null; clientTenant?: { id: string; name: string } }>;
  accounts: Array<{ code: string; name: string; totalBalance: number; branches: number }>;
}

export const enterpriseGroupsService = {
  getPlatformGroups: (signal?: AbortSignal) => api.get<{ groups: any[]; unassignedBranches: any[] }>('/enterprise-groups/platform', { signal }),
  createPlatformGroup: (body: any) => api.idempotentPost('/enterprise-groups/platform', body),
  updatePlatformGroup: (groupId: string, body: any) => api.idempotentPatch(`/enterprise-groups/platform/${groupId}`, body),
  getManagerGroups: (signal?: AbortSignal) => api.get<ManagerGroup[]>('/enterprise-groups/manager', { signal }),
  getOverview: (groupId: string, branchId?: string, signal?: AbortSignal) => api.get<ManagerOverview>(`/enterprise-groups/manager/${groupId}/overview`, { params: branchId ? { branchId } : undefined, signal }),
  getInventory: (groupId: string, branchId?: string, signal?: AbortSignal) => api.get<any[]>(`/enterprise-groups/manager/${groupId}/inventory`, { params: branchId ? { branchId } : undefined, signal }),
  getAccounting: (groupId: string, branchId?: string, signal?: AbortSignal) => api.get<{ accounts: any[]; transactions: any[] }>(`/enterprise-groups/manager/${groupId}/accounting`, { params: branchId ? { branchId } : undefined, signal }),
  getUsers: (groupId: string, branchId?: string, signal?: AbortSignal) => api.get<any[]>(`/enterprise-groups/manager/${groupId}/users`, { params: branchId ? { branchId } : undefined, signal }),
  getManagers: (groupId: string, signal?: AbortSignal) => api.get<any[]>(`/enterprise-groups/manager/${groupId}/managers`, { signal }),
  assignManager: (groupId: string, body: any) => api.idempotentPost(`/enterprise-groups/manager/${groupId}/managers`, body),
  createWarehouse: (groupId: string, body: any) => api.idempotentPost(`/enterprise-groups/manager/${groupId}/warehouses`, body),
};
