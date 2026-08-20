import { api } from "./api";

export interface ManagerGroup {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  enabledModules?: string[];
  catalogMode: string;
  inventoryMode: string;
  branches: Array<{
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    isActive: boolean;
    businessUnitId?: string | null;
    businessType?: string | null;
  }>;
  businessUnits?: Array<{
    id: string;
    name: string;
    slug?: string;
    isActive?: boolean;
    enabledModules?: string[];
  }>;
  managerAccess?: {
    isOwner: boolean;
    canManageManagers: boolean;
    canEdit: boolean;
    branchIds: string[];
    warehouseIds: string[];
    permissions: unknown;
  } | null;
}

export interface ManagerOverview {
  group: ManagerGroup;
  inventoryMode?: string;
  inventoryScopeLabel?: string;
  filters: { branchId: string | null; branchIds: string[] };
  branches: Array<{
    id: string;
    name: string;
    slug: string;
    logo?: string | null;
    industry: string;
    subIndustry?: string | null;
    businessType?: string | null;
    businessUnitId?: string | null;
    isActive?: boolean;
    _count: { users: number; products: number; warehouses: number };
  }>;
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
  warehouses: Array<{
    id: string;
    name: string;
    scopeType: string;
    clientTenantId: string | null;
    businessUnitId?: string | null;
    location?: string | null;
    authorizedBranchIds?: string[];
    clientTenant?: { id: string; name: string } | null;
  }>;
  accounts: Array<{
    code: string;
    name: string;
    totalBalance: number;
    branches: number;
  }>;
}

export interface ManagerInventoryAdjustmentItem {
  id: string;
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  variantName?: string | null;
  currentStock: number;
  actualStock: number;
  difference: number;
  unitCost?: number | null;
  baseCost?: number | null;
  currency?: string | null;
  exchangeRate?: number | null;
  impactAmount: number;
}

export interface ManagerInventoryAdjustmentRow {
  id: string;
  number: string;
  date: string;
  status: string;
  reason: string;
  notes?: string | null;
  branchId: string;
  branchName?: string | null;
  businessUnitId?: string | null;
  businessUnitName?: string | null;
  warehouseId: string;
  warehouseName?: string | null;
  itemCount: number;
  increasedUnits: number;
  decreasedUnits: number;
  differenceUnits: number;
  impactAmount: number;
  lossAmount: number;
  currency?: string | null;
  items: ManagerInventoryAdjustmentItem[];
}

export interface ManagerInventoryAdjustmentsResponse {
  data: ManagerInventoryAdjustmentRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: {
    total: number;
    drafts: number;
    sent: number;
    approved: number;
    rejected: number;
    cancelled: number;
    productsAffected: number;
    increasedUnits: number;
    decreasedUnits: number;
    monetaryImpact: number;
    lossAmount: number;
  };
}

export interface ManagerInventoryModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, number>;
}

export interface ManagerSalesModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface ManagerPurchasesModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface ManagerFinanceModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface ManagerAccountingModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface PlatformQuoteItem {
  id?: string;
  section: string;
  description: string;
  detail?: string | null;
  periodicity?: string | null;
  quantity: number;
  unitPrice: number;
  amount?: number;
  isOptional: boolean;
  sortOrder?: number;
}

export interface PlatformQuote {
  id: string;
  number: string;
  prospectCompany: string;
  prospectName: string;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  country?: string | null;
  currency: "USD" | "NIO";
  validUntil?: string | null;
  notes?: string | null;
  subtotal: number;
  optionalSubtotal: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  enterpriseGroup?: { id: string; name: string; slug: string } | null;
  clientTenant?: { id: string; name: string; slug: string } | null;
  items: PlatformQuoteItem[];
  createdAt: string;
  updatedAt: string;
}

export const enterpriseGroupsService = {
  getPlatformGroups: (signal?: AbortSignal) =>
    api.get<{
      groups: any[];
      unassignedBranches: any[];
      storageBytes: number;
      storageObjects: number;
    }>("/enterprise-groups/platform", { signal }),
  getPlatformLegacyUsers: (signal?: AbortSignal) =>
    api.get<{
      cutoff: string;
      totalUsers: number;
      totalTenants: number;
      tenants: any[];
    }>("/enterprise-groups/platform/legacy-users", { signal }),
  extendPlatformLegacyTrial: (tenantId: string, extensionDays = 7) =>
    api.idempotentPatch(
      `/enterprise-groups/platform/legacy-users/${tenantId}/trial`,
      { extensionDays },
    ),
  getPlatformGroup: (groupId: string, signal?: AbortSignal) =>
    api.get<any>(`/enterprise-groups/platform/${groupId}`, { signal }),
  createPlatformGroup: (body: any) =>
    api.idempotentPost("/enterprise-groups/platform", body),
  commitPlatformOnboarding: (body: any) =>
    api.idempotentPost("/enterprise-groups/platform/onboarding/commit", body),
  getPlatformQuotes: (
    params?: { search?: string; status?: string },
    signal?: AbortSignal,
  ) =>
    api.get<PlatformQuote[]>("/enterprise-groups/platform/quotes", {
      params,
      signal,
    }),
  createPlatformQuote: (
    body: Omit<
      PlatformQuote,
      | "id"
      | "number"
      | "status"
      | "createdAt"
      | "updatedAt"
      | "subtotal"
      | "optionalSubtotal"
      | "taxAmount"
      | "total"
      | "items"
    > & {
      items: PlatformQuoteItem[];
      discountAmount?: number;
      taxRate?: number;
    },
  ) =>
    api.idempotentPost<PlatformQuote>(
      "/enterprise-groups/platform/quotes",
      body,
    ),
  updatePlatformQuote: (id: string, body: any) =>
    api.idempotentPatch<PlatformQuote>(
      `/enterprise-groups/platform/quotes/${id}`,
      body,
    ),
  updatePlatformQuoteStatus: (id: string, status: PlatformQuote["status"]) =>
    api.idempotentPatch<PlatformQuote>(
      `/enterprise-groups/platform/quotes/${id}/status`,
      { status },
    ),
  deletePlatformQuote: (id: string) =>
    api.delete<{ id: string; deleted: boolean }>(
      `/enterprise-groups/platform/quotes/${id}`,
    ),
  createPlatformBranch: (groupId: string, body: any) =>
    api.idempotentPost(`/enterprise-groups/platform/${groupId}/branches`, body),
  createPlatformBusinessUnit: (groupId: string, body: any) =>
    api.idempotentPost(
      `/enterprise-groups/platform/${groupId}/business-units`,
      body,
    ),
  createPlatformManager: (groupId: string, body: any) =>
    api.idempotentPost(`/enterprise-groups/platform/${groupId}/managers`, body),
  createMissingPlatformManager: (groupId: string, body: any) =>
    api.idempotentPost(`/enterprise-groups/platform/${groupId}/managers/missing`, body),
  updatePlatformManagerPassword: (
    groupId: string,
    userId: string,
    password: string,
  ) =>
    api.idempotentPatch(
      `/enterprise-groups/platform/${groupId}/managers/${userId}/password`,
      { password },
    ),
  updatePlatformBusinessUnit: (groupId: string, unitId: string, body: any) =>
    api.idempotentPatch(
      `/enterprise-groups/platform/${groupId}/business-units/${unitId}`,
      body,
    ),
  updatePlatformGroup: (groupId: string, body: any) =>
    api.idempotentPatch(`/enterprise-groups/platform/${groupId}`, body),
  getManagerGroups: (signal?: AbortSignal) =>
    api.get<ManagerGroup[]>("/enterprise-groups/manager", { signal }),
  getOverview: (groupId: string, branchId?: string, signal?: AbortSignal) =>
    api.get<ManagerOverview>(`/enterprise-groups/manager/${groupId}/overview`, {
      params: branchId ? { branchId } : undefined,
      signal,
    }),
  getInventory: (
    groupId: string,
    branchId?: string,
    businessUnitId?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any[]>(`/enterprise-groups/manager/${groupId}/inventory`, {
      params: {
        ...(branchId ? { branchId } : {}),
        ...(businessUnitId ? { businessUnitId } : {}),
      },
      signal,
    }),
  getAdjustments: (
    groupId: string,
    params: {
      businessUnitId?: string;
      branchId?: string;
      warehouseId?: string;
      status?: string;
      reason?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      report?: boolean;
    } = {},
    signal?: AbortSignal,
  ) =>
    api.get<ManagerInventoryAdjustmentsResponse>(
      `/enterprise-groups/manager/${groupId}/adjustments`,
      { params, signal },
    ),
  getInventoryModule: (
    groupId: string,
    params: {
      view: string;
      businessUnitId?: string;
      branchId?: string;
      warehouseId?: string;
      status?: string;
      search?: string;
      type?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      report?: boolean;
    },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerInventoryModuleResponse>(
      `/enterprise-groups/manager/${groupId}/inventory/module`,
      { params, signal },
    ),
  getSalesModule: (
    groupId: string,
    params: {
      view: string;
      businessUnitId?: string;
      branchId?: string;
      status?: string;
      customerType?: string;
      creditStatus?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      report?: boolean;
    },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerSalesModuleResponse>(
      `/enterprise-groups/manager/${groupId}/sales/module`,
      { params, signal },
    ),
  getPurchasesModule: (
    groupId: string,
    params: {
      view: string;
      businessUnitId?: string;
      branchId?: string;
      status?: string;
      supplierType?: string;
      method?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      report?: boolean;
    },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerPurchasesModuleResponse>(
      `/enterprise-groups/manager/${groupId}/purchases/module`,
      { params, signal },
    ),
  getFinanceModule: (
    groupId: string,
    params: {
      view: string;
      businessUnitId?: string;
      branchId?: string;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      report?: boolean;
    },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerFinanceModuleResponse>(
      `/enterprise-groups/manager/${groupId}/finance/module`,
      { params, signal },
    ),
  getAccountingModule: (
    groupId: string,
    params: {
      view: string;
      businessUnitId?: string;
      branchId?: string;
      status?: string;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
      report?: boolean;
    },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerAccountingModuleResponse>(
      `/enterprise-groups/manager/${groupId}/accounting/module`,
      { params, signal },
    ),
  importSharedInventory: (groupId: string, body: any) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/inventory/import`,
      body,
    ),
  getAccounting: (groupId: string, branchId?: string, signal?: AbortSignal) =>
    api.get<{ accounts: any[]; transactions: any[] }>(
      `/enterprise-groups/manager/${groupId}/accounting`,
      { params: branchId ? { branchId } : undefined, signal },
    ),
  importSharedAccounts: (groupId: string, body: any) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/accounting/import`,
      body,
    ),
  getUsers: (groupId: string, branchId?: string, signal?: AbortSignal) =>
    api.get<any[]>(`/enterprise-groups/manager/${groupId}/users`, {
      params: branchId ? { branchId } : undefined,
      signal,
    }),
  updateBranchUser: (
    groupId: string,
    userId: string,
    body: {
      name?: string;
      email?: string;
      password?: string;
      isActive?: boolean;
    },
  ) =>
    api.idempotentPatch(
      `/enterprise-groups/manager/${groupId}/users/${userId}`,
      body,
    ),
  getManagers: (groupId: string, signal?: AbortSignal) =>
    api.get<any[]>(`/enterprise-groups/manager/${groupId}/managers`, {
      signal,
    }),
  assignManager: (groupId: string, body: any) =>
    api.idempotentPost(`/enterprise-groups/manager/${groupId}/managers`, body),
  createManager: (groupId: string, body: any) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/managers/create`,
      body,
    ),
  updateManager: (groupId: string, userId: string, body: any) =>
    api.idempotentPatch(
      `/enterprise-groups/manager/${groupId}/managers/${userId}`,
      body,
    ),
  updateManagerPassword: (groupId: string, userId: string, password: string) =>
    api.idempotentPatch(
      `/enterprise-groups/manager/${groupId}/managers/${userId}/password`,
      { password },
    ),
  revokeManager: (groupId: string, userId: string) =>
    api.delete(`/enterprise-groups/manager/${groupId}/managers/${userId}`),
  createWarehouse: (groupId: string, body: any) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/warehouses`,
      body,
    ),
  syncCorporateWarehouseCatalog: (groupId: string, warehouseId: string) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/warehouses/${warehouseId}/catalog/sync`,
      {},
    ),
  getBranchProducts: (
    groupId: string,
    branchId: string,
    search?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any[]>(`/enterprise-groups/manager/${groupId}/catalog/products`, {
      params: { branchId, ...(search ? { search } : {}) },
      signal,
    }),
  listSharedCatalog: (
    groupId: string,
    branchId?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any[]>(`/enterprise-groups/manager/${groupId}/catalog/shared`, {
      params: branchId ? { branchId } : undefined,
      signal,
    }),
  shareCatalog: (
    groupId: string,
    body: {
      productIds: string[];
      branchIds: string[];
      prices?: Record<string, Record<string, number>>;
    },
  ) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/catalog/share`,
      body,
    ),
  unshareCatalog: (groupId: string, body: { mirrorIds: string[] }) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/catalog/unshare`,
      body,
    ),
  updateSharedPrice: (
    groupId: string,
    body: { mirrorId: string; price: number },
  ) =>
    api.idempotentPatch(
      `/enterprise-groups/manager/${groupId}/catalog/price`,
      body,
    ),
  syncFromMaster: (groupId: string, body: { productId: string }) =>
    api.idempotentPost(
      `/enterprise-groups/manager/${groupId}/catalog/sync`,
      body,
    ),
  getConsolidatedTrialBalance: (
    groupId: string,
    dateFrom?: string,
    dateTo?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any>(
      `/enterprise-groups/manager/${groupId}/accounting/consolidated/trial-balance`,
      { params: { dateFrom, dateTo }, signal },
    ),
  getConsolidatedProfitLoss: (
    groupId: string,
    dateFrom?: string,
    dateTo?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any>(
      `/enterprise-groups/manager/${groupId}/accounting/consolidated/profit-loss`,
      { params: { dateFrom, dateTo }, signal },
    ),
  getConsolidatedBalanceSheet: (groupId: string, signal?: AbortSignal) =>
    api.get<any>(
      `/enterprise-groups/manager/${groupId}/accounting/consolidated/balance-sheet`,
      { signal },
    ),
  getConsolidatedCashFlow: (
    groupId: string,
    dateFrom?: string,
    dateTo?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any>(
      `/enterprise-groups/manager/${groupId}/accounting/consolidated/cash-flow`,
      { params: { dateFrom, dateTo }, signal },
    ),
  getConsolidatedBranchComparison: (
    groupId: string,
    dateFrom?: string,
    dateTo?: string,
    signal?: AbortSignal,
  ) =>
    api.get<any>(
      `/enterprise-groups/manager/${groupId}/accounting/consolidated/branch-comparison`,
      { params: { dateFrom, dateTo }, signal },
    ),
  getTransfers: (groupId: string, branchId?: string, signal?: AbortSignal) =>
    api.get<any[]>(`/enterprise-groups/manager/${groupId}/transfers`, {
      params: branchId ? { branchId } : undefined,
      signal,
    }),
  createInterTenantTransfer: (
    groupId: string,
    body: {
      sourceBranchId: string;
      destBranchId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      items: Array<{ productId: string; quantity: number; variantId?: string }>;
    },
  ) =>
    api.idempotentPost(`/enterprise-groups/manager/${groupId}/transfers`, body),
};
