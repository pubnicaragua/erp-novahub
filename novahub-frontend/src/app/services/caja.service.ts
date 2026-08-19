import { api } from './api';
import { resolveStorageReferences } from './storage.service';

export type CashClosureMode = 'NORMAL' | 'BLIND';

export interface CashRegisterAvailability {
  totalRegisters: number;
  activeRegisters: number;
  totalBranches: number;
  activeBranches: number;
  accessibleRegisters: number;
}

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  location?: string;
  isActive: boolean;
  branchId?: string;
  warehouse?: any;
  hasActiveSession?: boolean;
  resolvedWarehouseId?: string | null;
  closureMode?: CashClosureMode;
}

export interface SessionDenomination {
  id?: string;
  currency: 'NIO' | 'USD';
  phase: 'OPEN' | 'CLOSE';
  value: number;
  quantity: number;
  subtotal: number;
}

export interface SessionLog {
  id: string;
  type: 'OPEN' | 'SALE' | 'REFUND' | 'COUNT' | 'CLOSE' | 'ENTRY' | 'EXIT';
  description: string;
  amountNIO?: number;
  amountUSD?: number;
  paymentMethod?: string;
  reference?: string;
  createdAt: string;
}

export interface CashRegisterSession {
  id: string;
  cashRegisterId: string;
  status: 'OPEN' | 'COUNTING' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  exchangeRateUSD: number;
  initialAmountNIO: number;
  initialAmountUSD: number;
  finalAmountNIO?: number;
  finalAmountUSD?: number;
  differenceNIO?: number;
  differenceUSD?: number;
  expectedAmountNIO?: number;
  expectedAmountUSD?: number;
  notes?: string;
  closureMode?: CashClosureMode;
  openedBy?: { name: string };
  closedBy?: { name: string };
  denominations?: SessionDenomination[];
  countAttempts?: CashRegisterCount[];
}

export interface CashRegisterCount {
  id?: string;
  attempt: number;
  mode: CashClosureMode;
  capturedById?: string;
  capturedBy?: { name: string };
  countedAmountNIO: number;
  countedAmountUSD: number;
  expectedAmountNIO: number;
  expectedAmountUSD: number;
  differenceNIO: number;
  differenceUSD: number;
  notes?: string;
  createdAt?: string;
  denominations?: SessionDenomination[];
}

export interface PosProductVariant {
  id: string;
  sku: string;
  name: string;
  priceModifier?: number;
  costModifier?: number;
  attributes?: Array<{
    attributeId: string;
    attributeName: string;
    value: string;
  }>;
  currentStock?: number | null;
}

export interface PosProduct {
  id: string;
  code: string;
  name: string;
  salePrice: number;
  taxRate: number;
  description?: string;
  imageUrl?: string | null;
  imageUrlStorageUri?: string;
  itemType?: 'PRODUCT' | 'SERVICE';
  trackInventory: boolean;
  isActive?: boolean;
  costPrice?: number;
  currentStock?: number | null;
  isVariable?: boolean;
  variants?: PosProductVariant[];
}

export interface PosCustomer {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  priceListId?: string | null;
}

export interface PosInvoiceItem {
  productId?: string;
  variantId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  priceListId?: string;
  taxRate?: number;
  discount?: number;
  irRate?: number;
  irTaxId?: string | null;
}

export interface PosInvoice {
  id: string;
  number: string;
  customerId?: string;
  customCustomerName?: string;
  registerId?: string | null;
  sessionId?: string | null;
  date: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  status: string;
  register?: CashRegister;
  customer?: PosCustomer;
  items?: any[];
}

export interface PotentialDuplicateSale {
  id: string;
  number: string;
  date: string;
  total: number;
  irAmount?: number;
  currency: string;
  customerName: string;
  registerName: string;
  matchedCriteria: string[];
  similarityScore: number;
}

export type PosPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK';
export interface PosPaymentLine {
  method: PosPaymentMethod;
  amount: number;
  currency?: 'NIO' | 'USD';
  exchangeRate?: number;
  reference?: string;
  bankAccountId?: string;
}

// ==================== VENTAS SUSPENDIDAS / RESERVADAS ====================

export type PosHoldStatus = 'SUSPENDED' | 'READY' | 'DELIVERED' | 'CANCELLED';
export type PosDeliveryStatus = 'PENDING' | 'DELIVERED';

export interface BranchProductAvailability {
  branchId: string;
  branchName: string;
  warehouseId: string | null;
  warehouseName: string | null;
  currentStock: number;
  requestedQuantity: number;
  available: boolean;
}

export interface PosHoldItem {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  priceListId?: string | null;
  taxRate: number;
  discount: number;
  irRate: number;
  irTaxId?: string | null;
  irAmount: number;
  deliveryWarehouseId?: string | null;
  total: number;
}

export interface PosHold {
  id: string;
  number: string;
  registerId: string;
  sessionId: string;
  customerId?: string | null;
  customCustomerName?: string | null;
  date: string;
  billingBranchId: string;
  billingWarehouseId?: string | null;
  deliveryBranchId: string;
  status: PosHoldStatus;
  deliveryStatus: PosDeliveryStatus;
  payNow: boolean;
  discountPercent: number;
  includeTax: boolean;
  pricingMode: 'global' | 'individual';
  irRate: number;
  irTaxId?: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  irAmount: number;
  total: number;
  currency: 'NIO' | 'USD';
  exchangeRate: number;
  baseTotal?: number;
  priceListId?: string | null;
  notes?: string | null;
  createdById?: string | null;
  confirmedById?: string | null;
  confirmedAt?: string | null;
  deliveredById?: string | null;
  deliveredAt?: string | null;
  cancelledById?: string | null;
  cancelledAt?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  paymentDetails?: any;
  createdAt: string;
  updatedAt: string;
  customer?: PosCustomer | null;
  register?: { id: string; code: string; name: string } | null;
  billingBranch?: { id: string; name: string } | null;
  deliveryBranch?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  confirmedBy?: { id: string; name: string } | null;
  deliveredBy?: { id: string; name: string } | null;
  items: PosHoldItem[];
}

export interface PosHoldItemInput extends PosInvoiceItem {
  deliveryWarehouseId?: string;
  variantId?: string;
}

export interface CreatePosHoldDto {
  registerId: string;
  sessionId: string;
  customerId?: string;
  customCustomerName?: string;
  date: string;
  discountPercent?: number;
  pricingMode?: 'global' | 'individual';
  irRate?: number;
  irTaxId?: string | null;
  includeTax?: boolean;
  priceListId?: string;
  deliveryBranchId: string;
  items: PosHoldItemInput[];
  currency?: 'NIO' | 'USD';
  exchangeRate?: number;
  payments?: PosPaymentLine[];
  payNow?: boolean;
  notes?: string;
}

export interface HoldFilters {
  status?: string;
  billingBranchId?: string;
  deliveryBranchId?: string;
  registerId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface HoldListResponse {
  items: PosHold[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardKPIs {
  totalRevenue: number;
  totalExpenses: number;
  ordersCount: number;
  pendingOrders: number;
  netMargin: number;
}

export interface ProductPerformanceItem {
  productId: string;
  name: string;
  code: string;
  totalQty: number;
  totalRevenue: number;
  costPrice?: number;
  salePrice?: number;
  margin?: number;
  profit?: number;
}

export interface RegisterSales {
  registerId: string;
  registerCode: string;
  registerName: string;
  total: number;
  count: number;
}

export interface InventoryAlert {
  productId: string;
  code: string;
  name: string;
  currentStock: number;
  minStock: number;
  status: 'SIN_STOCK' | 'STOCK_BAJO' | 'REORDEN';
}

export interface RecentTransaction {
  id: string;
  number: string;
  date: string;
  register: { code: string; name: string } | null;
  customer: string;
  total: number;
  sourceTotal?: number;
  currency?: 'NIO' | 'USD';
  exchangeRate?: number;
  taxAmount: number;
  status: string;
  hasIVA: boolean;
}

export interface DashboardData {
  kpis: DashboardKPIs;
  productPerformance: {
    topSelling: ProductPerformanceItem[];
    topMargin: ProductPerformanceItem[];
    noSaleProducts: { id: string; name: string; code: string; salePrice: number }[];
  };
  salesByRegister: RegisterSales[];
  inventoryAlerts: InventoryAlert[];
  recentTransactions: RecentTransaction[];
  period: string;
}

export const cajaService = {
  getRegisters: (all: boolean = false, signal?: AbortSignal) =>
    api.get<CashRegister[]>('/caja/registers', { params: all ? { all: 'true' } : undefined, signal }),

  getRegisterAvailability: () =>
    api.get<CashRegisterAvailability>('/caja/registers/status'),

  createRegister: (data: { name: string; code: string; location?: string; branchId?: string }) =>
    api.post<CashRegister>('/caja/registers', data),

  updateRegister: (id: string, data: { name?: string; code?: string; location?: string; isActive?: boolean; branchId?: string }) =>
    api.put<CashRegister>(`/caja/registers/${id}`, data),

  deleteRegister: (id: string) =>
    api.delete<void>(`/caja/registers/${id}`),

  getRegisterAccess: (id: string) =>
    api.get<{ allUsers: any[]; assignedUserIds: string[]; assignments: { userId: string; closureMode: CashClosureMode; canRead?: boolean; canWrite?: boolean }[] }>(`/caja/registers/${id}/access`),

  updateRegisterAccess: (id: string, assignments: { userId: string; closureMode: CashClosureMode; canRead?: boolean; canWrite?: boolean }[]) =>
    api.put<{ success: boolean }>(`/caja/registers/${id}/access`, { assignments }),

  getCashNorms: () =>
    api.get<any>('/caja/settings/cash-norms'),

  updateCashNorms: (norms: any) =>
    api.put<any>('/caja/settings/cash-norms', norms),

  getAutoCloseConfig: () =>
    api.get<any>('/caja/settings/auto-close'),

  updateAutoCloseConfig: (config: any) =>
    api.put<any>('/caja/settings/auto-close', config),

  getClosureProtocol: () =>
    api.get<any>('/caja/settings/closure-protocol'),

  updateClosureProtocol: (protocol: any) =>
    api.put<any>('/caja/settings/closure-protocol', protocol),

  getDeficitCharges: () =>
    api.get<any[]>('/caja/deficit-charges'),

  updateDeficitCharge: (id: string, dto: { status?: 'PENDING' | 'COLLECTED' | 'WRITTEN_OFF'; responsibleUserId?: string | null; notes?: string }) =>
    api.patch<any>(`/caja/deficit-charges/${id}`, dto),

  getProducts: async (search?: string, warehouseId?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (warehouseId) params.warehouseId = warehouseId;
    const products = await api.get<PosProduct[]>('/caja/products', { params: Object.keys(params).length > 0 ? params : undefined });
    return resolveStorageReferences(products);
  },

  getCustomers: () =>
    api.get<PosCustomer[]>('/caja/customers'),

  createInvoice: (dto: {
    registerId: string;
    sessionId: string;
    customerId?: string;
    customCustomerName?: string;
    date: string;
    discountPercent?: number;
    pricingMode?: 'global' | 'individual';
    items: PosInvoiceItem[];
    includeTax?: boolean;
    currency: 'NIO' | 'USD';
    exchangeRate: number;
    payments: PosPaymentLine[];
    duplicateConfirmation?: { candidateIds: string[] };
  }, idempotencyKey?: string) =>
    api.idempotentPost<PosInvoice>('/caja/invoices', dto, idempotencyKey),

  checkPotentialDuplicates: (dto: {
    registerId: string;
    customerId?: string;
    customCustomerName?: string;
    date: string;
    discountPercent?: number;
    pricingMode?: 'global' | 'individual';
    irRate?: number;
    irTaxId?: string | null;
    priceListId?: string;
    items: PosInvoiceItem[];
    includeTax?: boolean;
    currency: 'NIO' | 'USD';
    exchangeRate: number;
    payments: PosPaymentLine[];
  }) => api.post<{ hasPotentialDuplicate: boolean; matches: PotentialDuplicateSale[] }>('/caja/invoices/check-duplicates', dto),

  getRecentInvoices: async (registerId?: string) => {
    const params = registerId ? { registerId } : {};
    const res = await api.get<any>('/caja/invoices/recent', { params });
    return res?.data !== undefined ? res.data : res;
  },

  // --- Ventas suspendidas / reservadas (entrega inter-sucursal) ---

  getProductAvailability: (productId: string, quantity: number, signal?: AbortSignal) =>
    api.get<BranchProductAvailability[]>(`/caja/products/${productId}/availability`, { params: { quantity }, signal }),

  createHold: (dto: CreatePosHoldDto, idempotencyKey?: string) =>
    api.idempotentPost<PosHold>('/caja/holds', dto, idempotencyKey),

  getHolds: (filters?: HoldFilters, signal?: AbortSignal) =>
    api.get<HoldListResponse>('/caja/holds', { params: filters as any, signal }),

  confirmHold: (id: string, dto: { currency?: 'NIO' | 'USD'; exchangeRate?: number; payments: PosPaymentLine[] }, idempotencyKey?: string) =>
    api.idempotentPatch<PosHold>(`/caja/holds/${id}/confirm`, dto, idempotencyKey),

  deliverHold: (id: string, idempotencyKey?: string) =>
    api.idempotentPatch<PosHold>(`/caja/holds/${id}/deliver`, {}, idempotencyKey),

  cancelHold: (id: string, idempotencyKey?: string) =>
    api.idempotentPatch<PosHold>(`/caja/holds/${id}/cancel`, {}, idempotencyKey),

  // --- Módulo de Control de Cajas (Sesiones) ---

  openSession: async (dto: any) => {
    const res = await api.post<any>('/caja/sessions/open', dto);
    return res?.data !== undefined ? res.data : res;
  },

  getActiveSession: async (registerId: string) => {
    const res = await api.get<any>(`/caja/sessions/active/${registerId}`);
    return res?.data !== undefined ? res.data : res;
  },

  getSessionHistory: async (registerId?: string, page: number = 1, signal?: AbortSignal) => {
    const params: any = { page };
    if (registerId) params.registerId = registerId;
    const res = await api.get<any>('/caja/sessions/history', { params, signal });
    return res?.data !== undefined ? res.data : res; // { items, total, pages }
  },

  countSession: async (id: string, dto: any) => {
    const res = await api.post<any>(`/caja/sessions/${id}/count`, dto);
    return res?.data !== undefined ? res.data : res;
  },

  closeSession: async (id: string, dto: any) => {
    const res = await api.post<any>(`/caja/sessions/${id}/close`, dto);
    return res?.data !== undefined ? res.data : res;
  },

  getSessionLog: async (id: string) => {
    const res = await api.get<any>(`/caja/sessions/${id}/log`);
    return res?.data !== undefined ? res.data : res;
  },

  addMovement: async (sessionId: string, dto: {
    type: 'ENTRY' | 'EXIT';
    amountNIO: number;
    amountUSD?: number;
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK';
    description: string;
    reference?: string;
  }) => {
    const res = await api.post<any>(`/caja/sessions/${sessionId}/movement`, dto);
    return res?.data !== undefined ? res.data : res;
  },

  getDashboard: (period?: string, registerId?: string, startDate?: string, endDate?: string, signal?: AbortSignal, valuationMode?: 'HISTORICAL' | 'CURRENT') =>
    api.get<DashboardData>('/caja/dashboard', { params: { period, registerId, startDate, endDate, valuationMode }, signal }),
};
