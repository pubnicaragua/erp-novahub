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
    businessUnit?: { id: string; name: string; isActive?: boolean } | null;
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
  approvedAt?: string | null;
  approvedBy?: { id: string; name?: string | null; email?: string | null } | null;
  auditGenerated?: boolean;
  auditId?: string | null;
  auditNumber?: string | null;
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

export interface ManagerInventoryImportLocation {
  id: string;
  warehouseId: string;
  name: string;
  location?: string | null;
  scopeType: string;
  type: 'BODEGA' | 'ALMACEN';
  branchId?: string | null;
  branchName?: string | null;
  businessUnitId: string;
  active: boolean;
  isCorporate?: boolean;
  ownershipScope?: 'SUCURSAL' | 'RUBRO';
  selectionLabel?: string;
}

export interface ManagerInventoryImportOptions {
  businessUnitId: string;
  branches: Array<{ id: string; name: string; code?: string | null; baseCurrency?: string | null }>;
  categories: Array<{ id: string; name: string }>;
  locations: ManagerInventoryImportLocation[];
  generatedAt: string;
}

export interface ManagerInventoryImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  branchId?: string;
  warehouseId?: string;
  warehouseName?: string;
  locationLabel?: string;
  locationType?: 'BODEGA' | 'ALMACEN' | string;
  stock: number;
  costPrice?: number;
  currentQty: number;
  resultingQty: number;
  productName: string;
  status: string;
  locationStatus: string;
  value: number;
  currency: string;
  issues: string[];
}

export interface ManagerInventoryImportPreview {
  businessUnitId: string;
  stockMode: 'SET' | 'ADD';
  currency: 'NIO' | 'USD';
  locations: ManagerInventoryImportLocation[];
  rows: ManagerInventoryImportPreviewRow[];
  errors: string[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    products: number;
    locations: number;
    importedUnits: number;
    resultingUnits: number;
    value: number;
  };
}

export interface ManagerInventoryImportResult {
  success: boolean;
  importReference?: string;
  productsCreated?: number;
  locationsCreated?: number;
  stockUpdated?: number;
  movementsCreated?: number;
  costUpdates?: number;
  imagesLinked?: number;
  affected?: any[];
}

export interface ManagerSalesModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface ManagerInvoiceSeriesItem {
  id?: string | null;
  scopeKey: string;
  branchId?: string | null;
  branchName: string;
  branchCode?: string | null;
  documentType: 'SALES_INVOICE' | 'POS_INVOICE';
  documentLabel: string;
  prefix: string;
  defaultPrefix: string;
  configured: boolean;
  inherited?: boolean;
  sharedWithNormal?: boolean;
  nextNumber: string;
}

export interface ManagerInvoiceSeriesBranch {
  clientTenantId: string;
  name: string;
  slug: string;
  businessUnitId?: string | null;
  baseCurrency?: string | null;
  items: ManagerInvoiceSeriesItem[];
}

export interface ManagerInvoiceSeriesConfiguration {
  groupId: string;
  businessUnitId?: string | null;
  selectedClientTenantId?: string | null;
  branches: ManagerInvoiceSeriesBranch[];
}

export interface ManagerPdfDesign {
  id?: string;
  name?: string;
  documentTypes?: string[];
  settings?: Record<string, any>;
  layoutZones?: Record<string, any> | null;
  sourceType?: string;
  engine?: string;
  templateKey?: string | null;
}

export interface ManagerCustomerDetailResponse {
  customer: any;
  invoices: any[];
  transactions: Array<{
    id: string;
    kind: string;
    number?: string | null;
    date?: string | null;
    status?: string | null;
    amount?: number;
    currency?: string | null;
    exchangeRate?: number;
    reportAmount?: number | null;
    reportCurrency?: string | null;
    reportRate?: number | null;
    reportRateLabel?: string | null;
    reportRateSource?: string | null;
    reportRateEffectiveAt?: string | null;
    description?: string | null;
  }>;
  duplicateCustomers: Array<any>;
}

export interface ManagerCustomerTransactionsResponse {
  customer: any;
  transactions: ManagerCustomerDetailResponse['transactions'];
}

export interface ManagerQuoteDetailResponse {
  quote: any & { pdfDesign?: ManagerPdfDesign | null };
  history: any[];
}

export interface ManagerSalesDocumentDetailResponse {
  document: any & { pdfDesign?: ManagerPdfDesign | null };
  history: any[];
}

export interface ManagerSalesDeliveryDetailResponse {
  delivery: any & { pdfDesign?: ManagerPdfDesign | null };
  history: any[];
}

export interface ManagerSalesCashSessionDetailResponse {
  session: any & { pdfDesign?: ManagerPdfDesign | null };
  invoices: any[];
  log: any[];
  countAttempts: any[];
  deficitCharges: any[];
  history: any[];
}

export interface ManagerSalesPriceListDetailResponse {
  priceList: any & { pdfDesign?: ManagerPdfDesign | null };
  items: any[];
  history: any[];
}

export interface ManagerPurchasesModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface ManagerPurchasesDocumentDetailResponse {
  document: any & { pdfDesign?: ManagerPdfDesign | null };
  history: any[];
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

export interface ManagerReportsModuleResponse {
  view: string;
  data: any[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
  metrics: Record<string, any>;
}

export interface ManagerHrModuleResponse {
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
  updatePlatformBranch: (groupId: string, branchId: string, body: any) =>
    api.idempotentPatch(
      `/enterprise-groups/platform/${groupId}/branches/${branchId}`,
      body,
    ),
  updatePlatformWarehouse: (groupId: string, warehouseId: string, body: any) =>
    api.idempotentPatch(
      `/enterprise-groups/platform/${groupId}/warehouses/${warehouseId}`,
      body,
    ),
  updatePlatformGroup: (groupId: string, body: any) =>
    api.idempotentPatch(`/enterprise-groups/platform/${groupId}`, body),
  getManagerGroups: (signal?: AbortSignal) =>
    api.get<ManagerGroup[]>("/enterprise-groups/manager", { signal }),
  getOverview: (groupId: string, branchId?: string, businessUnitId?: string, signal?: AbortSignal) =>
    api.get<ManagerOverview>(`/enterprise-groups/manager/${groupId}/overview`, {
      params: {
        ...(branchId ? { branchId } : {}),
        ...(businessUnitId ? { businessUnitId } : {}),
      },
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
      reportCurrency?: string;
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
  approveInventoryAdjustment: (groupId: string, adjustmentId: string) =>
    api.patch<any>(`/enterprise-groups/manager/${groupId}/adjustments/${adjustmentId}/approve`, {}),
  getInventoryModule: (
    groupId: string,
    params: {
      view: string;
      businessUnitId?: string;
      branchId?: string;
      warehouseId?: string;
      warehouseType?: 'BODEGA' | 'ALMACEN';
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
      reportCurrency?: string;
      registerId?: string;
      deliveryBranchId?: string;
      paymentStatus?: string;
      priceListMode?: 'lists' | 'prices';
    },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerSalesModuleResponse>(
      `/enterprise-groups/manager/${groupId}/sales/module`,
      { params, signal },
    ),
  getManagerInvoiceSeriesConfiguration: (
    groupId: string,
    params: { businessUnitId?: string; branchId?: string },
    signal?: AbortSignal,
  ) =>
    api.get<ManagerInvoiceSeriesConfiguration>(
      `/enterprise-groups/manager/${groupId}/sales/invoice-series`,
      { params, signal },
    ),
  saveManagerInvoiceSeriesConfiguration: (
    groupId: string,
    body: { clientTenantId: string; businessUnitId?: string; scopeBranchId?: string | null; documentType: 'SALES_INVOICE' | 'POS_INVOICE'; prefix?: string | null; shareWithOtherType?: boolean },
  ) =>
    api.put<{ clientTenantId: string; scopeBranchId: string | null; configuration: unknown }>(
      `/enterprise-groups/manager/${groupId}/sales/invoice-series`,
      body,
    ),
  getPurchasesDocumentDetail: (groupId: string, entity: string, recordId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerPurchasesDocumentDetailResponse>(
      `/enterprise-groups/manager/${groupId}/purchases/documents/${entity}/${recordId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
    ),
  getSalesCustomerDetail: (groupId: string, customerId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerCustomerDetailResponse>(
      `/enterprise-groups/manager/${groupId}/sales/customers/${customerId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
    ),
  getSalesCustomerTransactions: (groupId: string, customerId: string, reportCurrency?: string) =>
    api.get<ManagerCustomerTransactionsResponse>(
      `/enterprise-groups/manager/${groupId}/sales/customers/${customerId}/transactions`,
      { params: reportCurrency ? { reportCurrency } : undefined },
    ),
  getSalesQuoteDetail: (groupId: string, quoteId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerQuoteDetailResponse>(
      `/enterprise-groups/manager/${groupId}/sales/quotes/${quoteId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
    ),
  getSalesDocumentDetail: (groupId: string, entity: string, recordId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerSalesDocumentDetailResponse>(
      `/enterprise-groups/manager/${groupId}/sales/documents/${entity}/${recordId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
    ),
  getSalesDeliveryDetail: (groupId: string, deliveryId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerSalesDeliveryDetailResponse>(
      `/enterprise-groups/manager/${groupId}/sales/deliveries/${deliveryId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
    ),
  getSalesCashSessionDetail: (groupId: string, sessionId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerSalesCashSessionDetailResponse>(
      `/enterprise-groups/manager/${groupId}/sales/cash-sessions/${sessionId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
    ),
  getSalesPriceListDetail: (groupId: string, priceListId: string, reportCurrency?: string, signal?: AbortSignal) =>
    api.get<ManagerSalesPriceListDetailResponse>(
      `/enterprise-groups/manager/${groupId}/sales/price-lists/${priceListId}`,
      { params: reportCurrency ? { reportCurrency } : undefined, signal },
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
      reportCurrency?: string;
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
      reportCurrency?: string;
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
  getReportsModule: (
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
    api.get<ManagerReportsModuleResponse>(
      `/enterprise-groups/manager/${groupId}/reports/module`,
      { params, signal },
    ),
  getHrModule: (
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
    api.get<ManagerHrModuleResponse>(
      `/enterprise-groups/manager/${groupId}/hr/module`,
      { params, signal },
    ),
  importSharedInventory: (groupId: string, body: any) =>
    api.idempotentPost<ManagerInventoryImportResult>(
      `/enterprise-groups/manager/${groupId}/inventory/import`,
      body,
    ),
  getSharedInventoryImportOptions: (groupId: string, businessUnitId: string, signal?: AbortSignal) =>
    api.get<ManagerInventoryImportOptions>(
      `/enterprise-groups/manager/${groupId}/inventory/import/options`,
      { params: { businessUnitId }, signal },
    ),
  previewSharedInventory: (groupId: string, body: any) =>
    api.post<ManagerInventoryImportPreview>(
      `/enterprise-groups/manager/${groupId}/inventory/import/preview`,
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
  updateTransferStatus: (groupId: string, transferId: string, status: string) =>
    api.patch<any>(`/enterprise-groups/manager/${groupId}/transfers/${transferId}/status`, { status }),
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
