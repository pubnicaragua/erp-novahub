import { api } from './api';

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  location?: string;
  isActive: boolean;
  warehouseId?: string;
  warehouse?: any;
}

export interface PosProduct {
  id: string;
  code: string;
  name: string;
  salePrice: number;
  taxRate: number;
  description?: string;
  trackInventory: boolean;
}

export interface PosCustomer {
  id: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
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

  createRegister: (data: { name: string; code: string; location?: string; warehouseId?: string }) =>
    api.post<CashRegister>('/caja/registers', data),

  updateRegister: (id: string, data: { name?: string; code?: string; location?: string; isActive?: boolean; warehouseId?: string }) =>
    api.put<CashRegister>(`/caja/registers/${id}`, data),

  deleteRegister: (id: string) =>
    api.delete<void>(`/caja/registers/${id}`),

  getRegisterAccess: (id: string) =>
    api.get<{ allUsers: any[]; assignedUserIds: string[] }>(`/caja/registers/${id}/access`),

  updateRegisterAccess: (id: string, userIds: string[]) =>
    api.put<{ success: boolean }>(`/caja/registers/${id}/access`, { userIds }),

  getProducts: (search?: string) =>
    api.get<PosProduct[]>('/caja/products', { params: search ? { search } : undefined }),

  getCustomers: () =>
    api.get<PosCustomer[]>('/caja/customers'),

  createInvoice: (dto: {
    registerId: string;
    customerId?: string;
    customCustomerName?: string;
    date: string;
    discountPercent?: number;
    items: PosInvoiceItem[];
  }) =>
    api.post<PosInvoice>('/caja/invoices', dto),

  getRecentInvoices: (registerId?: string) =>
    api.get<PosInvoice[]>('/caja/invoices/recent', { params: registerId ? { registerId } : undefined }),

  getDashboard: (period?: string) =>
    api.get<DashboardData>('/caja/dashboard', { params: period ? { period } : undefined }),
};
