import { api } from './api';
import type {
  Customer, Estimate, SalesOrder, Invoice,
  RecurringInvoice, PaymentReceived, SalesReturn,
  CreditNote, PaginatedResponse, ApiFilters,
} from '../types';

// ---- Customers ----
export const customersService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Customer>>('/sales/customers', filters as any),
  getById: (id: string) => api.get<Customer>(`/sales/customers/${id}`),
  create: (data: Partial<Customer>) => api.post<Customer>('/sales/customers', data),
  update: (id: string, data: Partial<Customer>) => api.patch<Customer>(`/sales/customers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/sales/customers/${id}`),
};

// ---- Estimates ----
export const estimatesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Estimate>>('/sales/estimates', filters as any),
  getById: (id: string) => api.get<Estimate>(`/sales/estimates/${id}`),
  create: (data: Partial<Estimate>) => api.post<Estimate>('/sales/estimates', data),
  update: (id: string, data: Partial<Estimate>) => api.patch<Estimate>(`/sales/estimates/${id}`, data),
  delete: (id: string) => api.delete<void>(`/sales/estimates/${id}`),
  convertToOrder: (id: string) => api.post<SalesOrder>(`/sales/estimates/${id}/convert-to-order`, {}),
};

// ---- Sales Orders ----
export const salesOrdersService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<SalesOrder>>('/sales/orders', filters as any),
  getById: (id: string) => api.get<SalesOrder>(`/sales/orders/${id}`),
  create: (data: Partial<SalesOrder>) => api.post<SalesOrder>('/sales/orders', data),
  update: (id: string, data: Partial<SalesOrder>) => api.patch<SalesOrder>(`/sales/orders/${id}`, data),
  delete: (id: string) => api.delete<void>(`/sales/orders/${id}`),
  confirm: (id: string) => api.patch<SalesOrder>(`/sales/orders/${id}/confirm`, {}),
  convertToInvoice: (id: string) => api.post<Invoice>(`/sales/orders/${id}/convert-to-invoice`, {}),
};

// ---- Invoices ----
export const invoicesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Invoice>>('/sales/invoices', filters as any),
  getById: (id: string) => api.get<Invoice>(`/sales/invoices/${id}`),
  create: (data: Partial<Invoice>) => api.post<Invoice>('/sales/invoices', data),
  update: (id: string, data: Partial<Invoice>) => api.patch<Invoice>(`/sales/invoices/${id}`, data),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<Invoice, 'id' | 'number' | 'status'> }>(`/sales/invoices/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string) => api.post<Invoice>(`/sales/invoices/${id}/cancel`, { reason }),
  delete: (id: string) => api.delete<void>(`/sales/invoices/${id}`),
};

// ---- Recurring Invoices ----
export const recurringInvoicesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<RecurringInvoice>>('/sales/recurring-invoices', filters as any),
  getById: (id: string) => api.get<RecurringInvoice>(`/sales/recurring-invoices/${id}`),
  create: (data: Partial<RecurringInvoice>) => api.post<RecurringInvoice>('/sales/recurring-invoices', data),
  update: (id: string, data: Partial<RecurringInvoice>) => api.patch<RecurringInvoice>(`/sales/recurring-invoices/${id}`, data),
  pause: (id: string) => api.patch<RecurringInvoice>(`/sales/recurring-invoices/${id}/pause`, {}),
  resume: (id: string) => api.patch<RecurringInvoice>(`/sales/recurring-invoices/${id}/resume`, {}),
  delete: (id: string) => api.delete<void>(`/sales/recurring-invoices/${id}`),
};

// ---- Payments Received ----
export const paymentsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<PaymentReceived>>('/sales/payments', filters as any),
  getById: (id: string) => api.get<PaymentReceived>(`/sales/payments/${id}`),
  create: (data: Partial<PaymentReceived>) => api.post<PaymentReceived>('/sales/payments', data),
  update: (id: string, data: Partial<PaymentReceived>) => api.patch<PaymentReceived>(`/sales/payments/${id}`, data),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<PaymentReceived, 'id' | 'number'> }>(`/sales/payments/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string) => api.post<PaymentReceived>(`/sales/payments/${id}/cancel`, { reason }),
  delete: (id: string) => api.delete<void>(`/sales/payments/${id}`),
};

// ---- Sales Returns ----
export const salesReturnsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<SalesReturn>>('/sales/returns', filters as any),
  getById: (id: string) => api.get<SalesReturn>(`/sales/returns/${id}`),
  create: (data: Partial<SalesReturn>) => api.post<SalesReturn>('/sales/returns', data),
  update: (id: string, data: Partial<SalesReturn>) => api.patch<SalesReturn>(`/sales/returns/${id}`, data),
  approve: (id: string) => api.patch<SalesReturn>(`/sales/returns/${id}/approve`, {}),
  delete: (id: string) => api.delete<void>(`/sales/returns/${id}`),
};

// ---- Credit Notes ----
export const creditNotesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<CreditNote>>('/sales/credit-notes', filters as any),
  getById: (id: string) => api.get<CreditNote>(`/sales/credit-notes/${id}`),
  create: (data: Partial<CreditNote>) => api.post<CreditNote>('/sales/credit-notes', data),
  update: (id: string, data: Partial<CreditNote>) => api.patch<CreditNote>(`/sales/credit-notes/${id}`, data),
  issue: (id: string) => api.patch<CreditNote>(`/sales/credit-notes/${id}/issue`, {}),
  delete: (id: string) => api.delete<void>(`/sales/credit-notes/${id}`),
};

export const reportsService = {
  getAging: (customerId?: string) => api.get<any>('/sales/reports/aging', { customerId }),
  getSalesSummary: () => api.get<any>('/sales/reports/summary'),
};
