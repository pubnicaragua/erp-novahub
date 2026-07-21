import { api } from './api';

export interface CashRegister {
  id: string;
  name: string;
  code: string;
  location?: string;
  isActive: boolean;
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

export const cajaService = {
  getRegisters: () =>
    api.get<CashRegister[]>('/caja/registers'),

  createRegister: (data: { name: string; code: string; location?: string }) =>
    api.post<CashRegister>('/caja/registers', data),

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
};
