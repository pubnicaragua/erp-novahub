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

export interface CustomerPortalInventoryLevel {
  variantId?: string | null;
  warehouseId?: string | null;
  warehouseName: string;
  quantity: number;
  reserved: number;
  available: number;
}

export interface CustomerPortalInventoryVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Array<{ attributeName?: string; name?: string; value?: string }>;
  baseCost: number;
  configuredCost: number;
  costSource: 'VARIANT' | 'PRODUCT' | 'PRODUCT_PLUS_MODIFIER';
  quantity: number;
  reserved: number;
  available: number;
  inventoryValue: number;
  availableInventoryValue: number;
  inventory: CustomerPortalInventoryLevel[];
}

export interface CustomerPortalInventoryRow {
  id: string;
  code: string;
  name: string;
  brandId?: string | null;
  brandName?: string | null;
  costPrice: number;
  configuredCost: number | null;
  quantity: number;
  reserved: number;
  available: number;
  inventoryValue: number;
  availableInventoryValue: number;
  inventory: CustomerPortalInventoryLevel[];
  variants: CustomerPortalInventoryVariant[];
}

export interface CustomerPortalInventoryResponse {
  currency: string;
  data: CustomerPortalInventoryRow[];
}

export const customerPortalService = {
  getMe: () => api.get<any>('/customer-portal/me'),
  getBrands: () => api.get<{ data: any[]; total: number }>('/customer-portal/brands'),
  getSummary: () => api.get<CustomerPortalSummary>('/customer-portal/summary'),
  getInventory: () => api.get<CustomerPortalInventoryResponse>('/customer-portal/inventory'),
  getSales: () => api.get<{ data: any[] }>('/customer-portal/sales'),
  getInvoices: () => api.get<{ data: any[] }>('/customer-portal/invoices'),
};
