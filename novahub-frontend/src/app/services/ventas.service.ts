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
  importMassive: (data: { rows: Array<Partial<Customer> & { fiscalRegime?: string; customerClass?: string; priceListCode?: string }> }) => api.post<{ total: number; created: number; skipped: number; errors: string[]; warnings: string[] }>('/sales/customers/import', data),
  update: (id: string, data: Partial<Customer>) => api.patch<Customer>(`/sales/customers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/sales/customers/${id}`),
};

export const auditService = {
  getEntityHistory: (entity: string, entityId: string) => api.get<any[]>(`/audit/entity/${entity}/${entityId}`),
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
  create: (data: Partial<SalesOrder>, idempotencyKey?: string) => api.idempotentPost<SalesOrder>('/sales/orders', data, idempotencyKey),
  update: (id: string, data: Partial<SalesOrder>) => api.patch<SalesOrder>(`/sales/orders/${id}`, data),
  delete: (id: string) => api.delete<void>(`/sales/orders/${id}`),
  confirm: (id: string) => api.patch<SalesOrder>(`/sales/orders/${id}/confirm`, {}),
  convertToInvoice: (id: string, data?: Pick<SalesOrder, 'accountId' | 'sellerEmployeeId'>, idempotencyKey?: string) =>
    api.idempotentPost<Invoice>(`/sales/orders/${id}/convert-to-invoice`, data || {}, idempotencyKey),
};

// ---- Invoices ----
export const invoicesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Invoice>>('/sales/invoices', filters as any),
  getById: (id: string) => api.get<Invoice>(`/sales/invoices/${id}`),
  create: (data: Partial<Invoice>, idempotencyKey?: string) => api.idempotentPost<Invoice>('/sales/invoices', data, idempotencyKey),
  update: (id: string, data: Partial<Invoice>) => api.patch<Invoice>(`/sales/invoices/${id}`, data),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<Invoice, 'id' | 'number' | 'status'> }>(`/sales/invoices/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string, idempotencyKey?: string) => api.idempotentPost<Invoice>(`/sales/invoices/${id}/cancel`, { reason }, idempotencyKey),
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
  create: (data: Partial<PaymentReceived>, idempotencyKey?: string) => api.idempotentPost<PaymentReceived>('/sales/payments', data, idempotencyKey),
  update: (id: string, data: Partial<PaymentReceived>) => api.patch<PaymentReceived>(`/sales/payments/${id}`, data),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<PaymentReceived, 'id' | 'number'> }>(`/sales/payments/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string, idempotencyKey?: string) => api.idempotentPost<PaymentReceived>(`/sales/payments/${id}/cancel`, { reason }, idempotencyKey),
  delete: (id: string) => api.delete<void>(`/sales/payments/${id}`),
};

// ---- Sales Returns ----
export const salesReturnsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<SalesReturn>>('/sales/returns', filters as any),
  getById: (id: string) => api.get<SalesReturn>(`/sales/returns/${id}`),
  create: (data: Partial<SalesReturn>, idempotencyKey?: string) => api.idempotentPost<SalesReturn>('/sales/returns', data, idempotencyKey),
  update: (id: string, data: Partial<SalesReturn>) => api.patch<SalesReturn>(`/sales/returns/${id}`, data),
  approve: (id: string, idempotencyKey?: string) => api.idempotentPatch<SalesReturn>(`/sales/returns/${id}/approve`, {}, idempotencyKey),
  process: (id: string, idempotencyKey?: string) => api.idempotentPatch<SalesReturn>(`/sales/returns/${id}/process`, {}, idempotencyKey),
  delete: (id: string) => api.delete<void>(`/sales/returns/${id}`),
};

// ---- Credit Notes ----
export const creditNotesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<CreditNote>>('/sales/credit-notes', filters as any),
  getById: (id: string) => api.get<CreditNote>(`/sales/credit-notes/${id}`),
  create: (data: Partial<CreditNote>, idempotencyKey?: string) => api.idempotentPost<CreditNote>('/sales/credit-notes', data, idempotencyKey),
  update: (id: string, data: Partial<CreditNote>) => api.patch<CreditNote>(`/sales/credit-notes/${id}`, data),
  issue: (id: string, idempotencyKey?: string) => api.idempotentPatch<CreditNote>(`/sales/credit-notes/${id}/issue`, {}, idempotencyKey),
  apply: (id: string, data: any, idempotencyKey?: string) => api.idempotentPatch<CreditNote>(`/sales/credit-notes/${id}/apply`, data, idempotencyKey),
  delete: (id: string) => api.delete<void>(`/sales/credit-notes/${id}`),
};

export const reportsService = {
  getAging: (customerId?: string) => api.get<any>('/sales/reports/aging', { customerId }),
  getSalesSummary: () => api.get<any>('/sales/reports/summary'),
};
