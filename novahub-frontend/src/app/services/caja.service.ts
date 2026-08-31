import { api, getApiUrl, getAuthHeaders } from './api';
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
  /** Legacy only. Caja is associated with the branch, not a warehouse. */
  warehouseId?: string | null;
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

export interface HistoricalCashReport {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  aggregationComplete: boolean;
  filters: Record<string, any>;
  summary: Record<string, any>;
  options: {
    registers: CashRegister[];
    cashiers: { id: string; name: string }[];
    branches: { id: string; name: string; code: string }[];
  };
}

export interface HistoricalCashSessionDetail {
  session: any;
  cash: {
    initial: { NIO: number; USD: number };
    expected: { NIO: number; USD: number };
    counted: { NIO: number; USD: number };
    difference: { NIO: number; USD: number };
    deposit: { NIO: number; USD: number };
    keepInCash: { NIO: number; USD: number };
  };
  invoices: {
    count: number;
    statuses: Record<string, number>;
    totals: Record<string, { NIO: number; USD: number }>;
    rows: any[];
  };
  payments: {
    summary: Record<string, { count: number; amountNIO: number; amountUSD: number }>;
    rows: any[];
    checks: any[];
    transfers: any[];
  };
  returns: { count: number; totals: { NIO: number; USD: number }; rows: any[] };
  creditNotes: { count: number; totals: { NIO: number; USD: number }; rows: any[] };
  movements: any[];
  denominations: { opening: any[]; closing: any[] };
  availability: Record<string, boolean>;
  unavailable: Array<{ label: string; value: string }>;
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
  commercialNote?: string | null;
  imageUrl?: string | null;
  imageUrlStorageUri?: string;
  itemType?: 'PRODUCT' | 'SERVICE';
  trackInventory: boolean;
  isActive?: boolean;
  costPrice?: number;
  currentStock?: number | null;
  warehouseStock?: Array<{ warehouseId: string; warehouseName: string; currentStock: number; variantId?: string | null }>;
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
  balance?: number;
  balanceDue?: number;
  balanceFavor?: number;
  availableCredit?: number;
  creditLimit?: number;
  creditLimitCurrency?: 'NIO' | 'USD';
}

export interface PosInvoiceItem {
  productId?: string;
  variantId?: string;
  warehouseId?: string;
  description: string;
  commercialNoteSnapshot?: string | null;
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
  extraCostDescription?: string | null;
  extraCostAmount?: number;
  deliveryDescription?: string | null;
  deliveryAmount?: number;
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

export type PosPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'CHECK' | 'CUSTOMER_BALANCE';
export interface PosPaymentLine {
  method: PosPaymentMethod;
  amount: number;
  currency?: 'NIO' | 'USD';
  exchangeRate?: number;
  reference?: string;
  bankAccountId?: string;
  cardCommissionPercent?: number;
  cardCommissionAmount?: number;
  cardCommissionAccountId?: string;
}

export type InvoiceCashQueueStatus = 'PENDING' | 'CLAIMED' | 'PAID' | 'CANCELLED';
export interface CashQueueDocument {
  id: string;
  number: string;
  status: string;
  date?: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  extraCostDescription?: string | null;
  extraCostAmount?: number;
  extraCharges?: Array<{ id?: string; description: string; amount: number }>;
  deliveryDescription?: string | null;
  deliveryAmount?: number;
  irAmount?: number;
  total: number;
  amountPaid?: number;
  balance: number;
  currency: 'NIO' | 'USD';
  exchangeRate?: number;
  customerId?: string | null;
  customCustomerName?: string | null;
  customer?: { id: string; name: string; phone?: string | null } | null;
  items?: Array<{ id: string; description: string; quantity: number; unitPrice: number; total: number }>;
  invoice?: { id: string; number: string; status: string } | null;
}

export interface PosWarehouseOption {
  id: string;
  name: string;
  scopeType: 'BRANCH' | 'BUSINESS_UNIT' | string;
  sourceType: 'BODEGA' | 'ALMACEN_CORPORATIVO' | string;
  branchId?: string | null;
  branchName: string;
  businessUnitId?: string | null;
  canView: boolean;
  canOperate: boolean;
}
export interface InvoiceCashQueue {
  id: string;
  status: InvoiceCashQueueStatus;
  invoiceId?: string | null;
  creditNoteId?: string | null;
  registerId?: string | null;
  sessionId?: string | null;
  requestedById?: string | null;
  claimedById?: string | null;
  claimedAt?: string | null;
  claimToken?: string | null;
  claimExpiresAt?: string | null;
  lastActivityAt?: string | null;
  paidAt?: string | null;
  releasedAt?: string | null;
  releasedById?: string | null;
  releaseReason?: string | null;
  notes?: string | null;
  createdAt: string;
  invoice?: CashQueueDocument | null;
  creditNote?: CashQueueDocument | null;
  requestedBy?: { id: string; name: string } | null;
  claimedBy?: { id: string; name: string } | null;
  register?: { id: string; code: string; name: string } | null;
}

export interface InvoiceCashQueueResponse {
  items: InvoiceCashQueue[];
  total: number;
  page: number;
  pageSize: number;
  maxVisible?: number;
  activeOnly?: boolean;
  hasMore?: boolean;
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
  sourceType?: 'BODEGA' | 'ALMACEN_CORPORATIVO';
}

export interface PosHoldItem {
  id: string;
  productId?: string | null;
  variantId?: string | null;
  description: string;
  commercialNoteSnapshot?: string | null;
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
  billingBranchId?: string | null;
  billingWarehouseId?: string | null;
  deliveryBranchId?: string | null;
  deliveryClientTenantId?: string | null;
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
  extraCostDescription?: string | null;
  extraCostAmount?: number;
  extraCharges?: Array<{ id?: string; description: string; amount: number }>;
  deliveryDescription?: string | null;
  deliveryAmount?: number;
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
  extraCostDescription?: string | null;
  extraCostAmount?: number;
  extraCharges?: Array<{ id?: string; description: string; amount: number }>;
  deliveryDescription?: string | null;
  deliveryAmount?: number;
  pricingMode?: 'global' | 'individual';
  irRate?: number;
  irTaxId?: string | null;
  includeTax?: boolean;
  priceListId?: string;
  deliveryClientTenantId: string;
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
  deliveryClientTenantId?: string;
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
  revenueOriginalCurrencyBreakdown?: { currency: 'NIO' | 'USD'; amount: number; count: number }[];
  expenseOriginalCurrencyBreakdown?: { currency: 'NIO' | 'USD'; amount: number; count: number }[];
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
  revenueOriginalCurrencyBreakdown?: { currency: 'NIO' | 'USD'; amount: number; count: number }[];
  profitOriginalCurrencyBreakdown?: { currency: 'NIO' | 'USD'; amount: number; count: number }[];
}

export interface RegisterSales {
  registerId: string;
  registerCode: string;
  registerName: string;
  total: number;
  count: number;
  originalCurrencyBreakdown?: { currency: 'NIO' | 'USD'; amount: number; count: number }[];
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
  baseCurrency?: 'NIO' | 'USD';
  productPerformance: {
    topSelling: ProductPerformanceItem[];
    topMargin: ProductPerformanceItem[];
    noSaleProducts: { id: string; name: string; code: string; salePrice: number; stock?: number }[];
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

  createRegister: (data: { name: string; code: string; location?: string }) =>
    api.post<CashRegister>('/caja/registers', data),

  updateRegister: (id: string, data: { name?: string; code?: string; location?: string; isActive?: boolean }) =>
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

  getProducts: async (search?: string, warehouseId?: string, signal?: AbortSignal) => {
    const params: any = {};
    if (search) params.search = search;
    if (warehouseId) params.warehouseId = warehouseId;
    const products = await api.get<PosProduct[]>('/caja/products', { params: Object.keys(params).length > 0 ? params : undefined, signal });
    return resolveStorageReferences(products);
  },

  getPosWarehouses: (signal?: AbortSignal) =>
    api.get<PosWarehouseOption[]>('/caja/warehouses', { signal }),

  getCustomers: () =>
    api.get<PosCustomer[]>('/caja/customers'),

  createInvoice: (dto: {
    registerId: string;
    sessionId: string;
    customerId?: string;
    customCustomerName?: string;
    date: string;
    discountPercent?: number;
    extraCostDescription?: string | null;
    extraCostAmount?: number;
    extraCharges?: Array<{ description: string; amount: number }>;
    deliveryDescription?: string | null;
    deliveryAmount?: number;
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
    extraCostDescription?: string | null;
    extraCostAmount?: number;
    extraCharges?: Array<{ description: string; amount: number }>;
    deliveryDescription?: string | null;
    deliveryAmount?: number;
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

  getInvoiceCashQueue: (filters?: { status?: string; search?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api.get<InvoiceCashQueueResponse>('/caja/invoice-cash-queue', { params: filters as any, signal }),

  claimInvoiceCashQueue: (id: string, dto: { registerId: string; sessionId: string }) =>
    api.patch<InvoiceCashQueue>(`/caja/invoice-cash-queue/${id}/claim`, dto),

  releaseInvoiceCashQueue: (id: string, dto?: { claimToken?: string; reason?: string }) =>
    api.patch<InvoiceCashQueue>(`/caja/invoice-cash-queue/${id}/release`, dto || {}),

  heartbeatInvoiceCashQueue: (id: string, dto: { registerId: string; sessionId: string; claimToken?: string }) =>
    api.patch<InvoiceCashQueue>(`/caja/invoice-cash-queue/${id}/heartbeat`, dto),

  reconcileInvoiceCashQueue: (dto?: { queueId?: string; sessionId?: string }) =>
    api.post<{ examined: number; stale: number; released: number; markedPaid: number; cancelled?: number; affectedQueueIds: string[] }>('/caja/invoice-cash-queue/reconcile', dto || {}),

  payInvoiceCashQueue: (id: string, dto: { registerId: string; sessionId: string; claimToken?: string; payments: PosPaymentLine[] }, idempotencyKey?: string) =>
    api.idempotentPatch<{ queue: InvoiceCashQueue; payment: any }>(`/caja/invoice-cash-queue/${id}/pay`, dto, idempotencyKey),

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

  getHistoricalCashReport: async (filters: {
    dateFrom?: string;
    dateTo?: string;
    branchId?: string;
    registerId?: string;
    cashierId?: string;
    paymentMethod?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}, signal?: AbortSignal): Promise<HistoricalCashReport> => {
    const res = await api.get<any>('/caja/reports/historical', { params: filters, signal });
    return (res?.data !== undefined ? res.data : res) as HistoricalCashReport;
  },

  getHistoricalCashSessionDetail: async (sessionId: string, signal?: AbortSignal): Promise<HistoricalCashSessionDetail> => {
    const res = await api.get<any>(`/caja/reports/historical/${sessionId}`, { signal });
    return (res?.data !== undefined ? res.data : res) as HistoricalCashSessionDetail;
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

export interface InvoiceCashQueueEvent {
  tenantId: string;
  queueId: string;
  invoiceId?: string | null;
  creditNoteId?: string | null;
  status: InvoiceCashQueueStatus;
  reason: string;
  occurredAt: string;
}

/** Consume la conexión SSE usando fetch para conservar Authorization: Bearer. */
export async function consumeInvoiceCashQueueEvents(
  signal: AbortSignal,
  onEvent: (event: InvoiceCashQueueEvent) => void,
  onOpen?: () => void,
) {
  const response = await fetch(getApiUrl('/caja/invoice-cash-queue/events'), {
    headers: { Accept: 'text/event-stream', ...getAuthHeaders() },
    cache: 'no-store',
    signal,
  });
  if (!response.ok) throw new Error(`No se pudo abrir la sincronización en vivo (${response.status}).`);
  if (!response.body) throw new Error('El navegador no habilitó el canal de sincronización en vivo.');
  onOpen?.();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (!signal.aborted) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n');
        if (!data) continue;
        try {
          const parsed = JSON.parse(data) as { type?: string; data?: InvoiceCashQueueEvent };
          if (parsed.type === 'queue-changed' && parsed.data) onEvent(parsed.data);
        } catch {
          // Un frame keepalive o inválido no debe cerrar la conexión.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
