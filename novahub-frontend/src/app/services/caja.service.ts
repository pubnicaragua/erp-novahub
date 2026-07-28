import { api } from './api';
import { resolveStorageReferences } from './storage.service';

export type CashClosureMode = 'NORMAL' | 'BLIND';

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
  costPrice?: number;
  currentStock?: number | null;
}

export interface PosCustomer {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
}

export interface PosInvoiceItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PosInvoice {
  id: string;
  number: string;
  customerId?: string;
  customCustomerName?: string;
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
  currency: string;
  customerName: string;
  registerName: string;
  matchedCriteria: string[];
  similarityScore: number;
}

export type PosPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';
export interface PosPaymentLine {
  method: PosPaymentMethod;
  amount: number;
  reference?: string;
  accountId?: string;
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
  getRegisters: (all: boolean = false) =>
    api.get<CashRegister[]>('/caja/registers', { params: all ? { all: 'true' } : undefined }),

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

  // --- Módulo de Control de Cajas (Sesiones) ---

  openSession: async (dto: any) => {
    const res = await api.post<any>('/caja/sessions/open', dto);
    return res?.data !== undefined ? res.data : res;
  },

  getActiveSession: async (registerId: string) => {
    const res = await api.get<any>(`/caja/sessions/active/${registerId}`);
    return res?.data !== undefined ? res.data : res;
  },

  getSessionHistory: async (registerId?: string, page: number = 1) => {
    const params: any = { page };
    if (registerId) params.registerId = registerId;
    const res = await api.get<any>('/caja/sessions/history', { params });
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
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
    description: string;
    reference?: string;
  }) => {
    const res = await api.post<any>(`/caja/sessions/${sessionId}/movement`, dto);
    return res?.data !== undefined ? res.data : res;
  },

  getDashboard: (period?: string, registerId?: string, startDate?: string, endDate?: string) =>
    api.get<DashboardData>('/caja/dashboard', { params: { period, registerId, startDate, endDate } }),
};
