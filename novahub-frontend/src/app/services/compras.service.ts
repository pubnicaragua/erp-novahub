import { api } from './api';
import type {
  Supplier, PurchaseOrder, PurchaseReceipt, SupplierInvoice,
  RecurringSupplierInvoice, PaymentMade, SupplierCredit,
  Expense, RecurringExpense,
  PaginatedResponse, ApiFilters,
} from '../types';

export const suppliersService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Supplier>>('/purchases/suppliers', filters as any),
  getById: (id: string) => api.get<Supplier>(`/purchases/suppliers/${id}`),
  create: (data: Partial<Supplier>) => api.post<Supplier>('/purchases/suppliers', data),
  update: (id: string, data: Partial<Supplier>) => api.patch<Supplier>(`/purchases/suppliers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/suppliers/${id}`),
};

export const purchaseOrdersService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<PurchaseOrder>>('/purchases/orders', filters as any),
  getById: (id: string) => api.get<PurchaseOrder>(`/purchases/orders/${id}`),
  create: (data: Partial<PurchaseOrder>) => api.post<PurchaseOrder>('/purchases/orders', data),
  update: (id: string, data: Partial<PurchaseOrder>) => api.patch<PurchaseOrder>(`/purchases/orders/${id}`, data),
  approve: (id: string) => api.patch<PurchaseOrder>(`/purchases/orders/${id}/approve`, {}),
  cancel: (id: string) => api.patch<PurchaseOrder>(`/purchases/orders/${id}/cancel`, {}),
  delete: (id: string) => api.delete<void>(`/purchases/orders/${id}`),
  convertToReceipt: (id: string) => api.post<PurchaseReceipt>(`/purchases/orders/${id}/convert-to-receipt`, {}),
};

// ✅ CORRECTED: was /purchase-receipts (404) → now /purchases/receipts
export const purchaseReceiptsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<PurchaseReceipt>>('/purchases/receipts', filters as any),
  getById: (id: string) => api.get<PurchaseReceipt>(`/purchases/receipts/${id}`),
  create: (data: Partial<PurchaseReceipt>) => api.post<PurchaseReceipt>('/purchases/receipts', data),
  delete: (id: string) => api.delete<void>(`/purchases/receipts/${id}`),
  convertToInvoice: (id: string) => api.post<SupplierInvoice>(`/purchases/receipts/${id}/convert-to-invoice`, {}),
};

export const supplierInvoicesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<SupplierInvoice>>('/purchases/invoices', filters as any),
  getById: (id: string) => api.get<SupplierInvoice>(`/purchases/invoices/${id}`),
  create: (data: Partial<SupplierInvoice>) => api.post<SupplierInvoice>('/purchases/invoices', data),
  update: (id: string, data: Partial<SupplierInvoice>) => api.patch<SupplierInvoice>(`/purchases/invoices/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/invoices/${id}`),
};

// ✅ CORRECTED: was /recurring-supplier-invoices (404) → now /purchases/recurring-invoices
export const recurringSupplierInvoicesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<RecurringSupplierInvoice>>('/purchases/recurring-invoices', filters as any),
  create: (data: Partial<RecurringSupplierInvoice>) => api.post<RecurringSupplierInvoice>('/purchases/recurring-invoices', data),
  update: (id: string, data: Partial<RecurringSupplierInvoice>) => api.patch<RecurringSupplierInvoice>(`/purchases/recurring-invoices/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/recurring-invoices/${id}`),
};

// ✅ CORRECTED: was /payments-made (404) → now /purchases/payments
export const paymentsMadeService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<PaymentMade>>('/purchases/payments', filters as any),
  create: (data: Partial<PaymentMade>) => api.post<PaymentMade>('/purchases/payments', data),
  update: (id: string, data: Partial<PaymentMade>) => api.patch<PaymentMade>(`/purchases/payments/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/payments/${id}`),
};

// ✅ CORRECTED: was /supplier-credits (404) → now /purchases/credits
export const supplierCreditsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<SupplierCredit>>('/purchases/credits', filters as any),
  create: (data: Partial<SupplierCredit>) => api.post<SupplierCredit>('/purchases/credits', data),
  update: (id: string, data: Partial<SupplierCredit>) => api.patch<SupplierCredit>(`/purchases/credits/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/credits/${id}`),
};

export const expensesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Expense>>('/purchases/expenses', filters as any),
  create: (data: Partial<Expense>) => api.post<Expense>('/purchases/expenses', data),
  update: (id: string, data: Partial<Expense>) => api.patch<Expense>(`/purchases/expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/expenses/${id}`),
};

export const recurringExpensesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<RecurringExpense>>('/purchases/recurring-expenses', filters as any),
  create: (data: Partial<RecurringExpense>) => api.post<RecurringExpense>('/purchases/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) => api.patch<RecurringExpense>(`/purchases/recurring-expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/recurring-expenses/${id}`),
};

// --- Aliases for better DX ---
export const billsService = supplierInvoicesService;
export const recurringBillsService = recurringSupplierInvoicesService;
export const paymentsService = paymentsMadeService;
export const vendorCreditsService = supplierCreditsService;
