import { api } from './api';

export interface CustomerPortalSummary {
  currency: string;
  today: { sales: number; invoices: number };
  month: { sales: number; invoices: number };
  totalInvoiced: number;
  totalPaid: number;
  pendingBalance: number;
  returnsTotal: number;
  creditNotesTotal: number;
}

export interface CustomerPortalInventoryRow {
  id: string;
  code: string;
  name: string;
  brandId?: string | null;
  brandName?: string | null;
  inventory: Array<{ warehouseId?: string | null; warehouseName: string; quantity: number; reserved: number; available: number }>;
}

export const customerPortalService = {
  getMe: () => api.get<any>('/customer-portal/me'),
  getBrands: () => api.get<{ data: any[]; total: number }>('/customer-portal/brands'),
  getSummary: () => api.get<CustomerPortalSummary>('/customer-portal/summary'),
  getInventory: () => api.get<{ data: CustomerPortalInventoryRow[] }>('/customer-portal/inventory'),
  getSales: () => api.get<{ data: any[] }>('/customer-portal/sales'),
  getInvoices: () => api.get<{ data: any[] }>('/customer-portal/invoices'),
};
