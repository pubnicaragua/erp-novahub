import { api } from './api';
import type {
  Supplier, PurchaseOrder, PurchaseReceipt, SupplierInvoice,
  RecurringSupplierInvoice, PaymentMade, SupplierCredit,
  Expense, RecurringExpense, PurchaseRequest, PurchaseManagement,
  PaginatedResponse, ApiFilters,
} from '../types';

export const suppliersService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Supplier>>('/purchases/suppliers', { params: filters as any, signal }),
  getById: (id: string) => api.get<Supplier>(`/purchases/suppliers/${id}`),
  create: (data: Partial<Supplier>) => api.post<Supplier>('/purchases/suppliers', data),
  importMassive: (data: { rows: Array<Partial<Supplier> & { paymentTerms?: string }> }) => api.post<{ total: number; created: number; skipped: number; errors: string[]; warnings: string[] }>('/purchases/suppliers/import', data),
  update: (id: string, data: Partial<Supplier>) => api.patch<Supplier>(`/purchases/suppliers/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/suppliers/${id}`),
  recalculateBalance: (id: string) => api.patch<any>(`/purchases/suppliers/${id}/recalculate-balance`, {}),
};

export const purchaseOrdersService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<PurchaseOrder>>('/purchases/orders', { params: filters as any, signal }),
  getById: (id: string) => api.get<PurchaseOrder>(`/purchases/orders/${id}`),
  create: (data: Partial<PurchaseOrder>) => api.post<PurchaseOrder>('/purchases/orders', data),
  update: (id: string, data: Partial<PurchaseOrder>) => api.patch<PurchaseOrder>(`/purchases/orders/${id}`, data),
  approve: (id: string) => api.patch<{ order: PurchaseOrder; receipt: PurchaseReceipt }>(`/purchases/orders/${id}/approve`, {}),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<PurchaseOrder, 'id' | 'number' | 'status'> }>(`/purchases/orders/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string) => api.post<PurchaseOrder>(`/purchases/orders/${id}/cancel`, { reason }),
  reject: (id: string, reason?: string) => api.post<PurchaseOrder>(`/purchases/orders/${id}/reject`, { reason }),
  convertToReceipt: (id: string) => api.post<PurchaseReceipt>(`/purchases/orders/${id}/convert-to-receipt`, {}),
};

// ✅ CORRECTED: was /purchase-receipts (404) → now /purchases/receipts
export const purchaseReceiptsService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<PurchaseReceipt>>('/purchases/receipts', { params: filters as any, signal }),
  getById: (id: string) => api.get<PurchaseReceipt>(`/purchases/receipts/${id}`),
  create: (data: Partial<PurchaseReceipt>) => api.post<PurchaseReceipt>('/purchases/receipts', data),
  update: (id: string, data: Partial<PurchaseReceipt>) => api.patch<PurchaseReceipt>(`/purchases/receipts/${id}`, data),
  approve: (id: string) => api.post<PurchaseReceipt>(`/purchases/receipts/${id}/approve`, {}),
  cancel: (id: string, reason?: string) => api.post<PurchaseReceipt>(`/purchases/receipts/${id}/cancel`, { reason }),
  registerInvoice: (id: string, data: { number: string; date?: string; dueDate?: string; subtotal?: number; taxAmount?: number; withholdingTotal?: number; withholdingBase?: number; total?: number; currency?: string; exchangeRate?: number; notes?: string; attachments: Array<{ fileName: string; fileType: string; fileSize: number; fileUrl: string }> }) =>
    api.post<SupplierInvoice>(`/purchases/receipts/${id}/invoice`, data),
};

export const supplierInvoicesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<SupplierInvoice>>('/purchases/invoices', { params: filters as any, signal }),
  getById: (id: string) => api.get<SupplierInvoice>(`/purchases/invoices/${id}`),
  create: (data: Partial<SupplierInvoice>) => api.post<SupplierInvoice>('/purchases/invoices', data),
  update: (id: string, data: Partial<SupplierInvoice>) => api.patch<SupplierInvoice>(`/purchases/invoices/${id}`, data),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<SupplierInvoice, 'id' | 'number' | 'status'> }>(`/purchases/invoices/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string) => api.post<SupplierInvoice>(`/purchases/invoices/${id}/cancel`, { reason }),
  addAttachment: (id: string, data: { fileName: string; fileType: string; fileSize: number; fileUrl: string }) => api.post<any>(`/purchases/invoices/${id}/attachments`, data),
  removeAttachment: (id: string, attachmentId: string) => api.delete<void>(`/purchases/invoices/${id}/attachments/${attachmentId}`),
};

// ✅ CORRECTED: was /recurring-supplier-invoices (404) → now /purchases/recurring-invoices
export const recurringSupplierInvoicesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<RecurringSupplierInvoice>>('/purchases/recurring-invoices', { params: filters as any, signal }),
  create: (data: Partial<RecurringSupplierInvoice>) => api.post<RecurringSupplierInvoice>('/purchases/recurring-invoices', data),
  update: (id: string, data: Partial<RecurringSupplierInvoice>) => api.patch<RecurringSupplierInvoice>(`/purchases/recurring-invoices/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/recurring-invoices/${id}`),
};

// ✅ CORRECTED: was /payments-made (404) → now /purchases/payments
export const paymentsMadeService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<PaymentMade>>('/purchases/payments', { params: filters as any, signal }),
  create: (data: Partial<PaymentMade>) => api.post<PaymentMade>('/purchases/payments', data),
  createMixed: (data: Partial<PaymentMade> & { payments: Array<Partial<PaymentMade>> }) => api.post<PaymentMade>('/purchases/payments/mixed', data),
  update: (id: string, data: Partial<PaymentMade>) => api.patch<PaymentMade>(`/purchases/payments/${id}`, data),
  checkNumber: (number: string, excludeId?: string) =>
    api.get<{ exists: boolean; record?: Pick<PaymentMade, 'id' | 'number' | 'isActive'> }>(`/purchases/payments/check-number/${encodeURIComponent(number)}`, excludeId ? ({ excludeId } as any) : undefined),
  cancel: (id: string, reason?: string) => api.post<PaymentMade>(`/purchases/payments/${id}/cancel`, { reason }),
};

// ✅ CORRECTED: was /supplier-credits (404) → now /purchases/credits
export const supplierCreditsService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<SupplierCredit>>('/purchases/credits', { params: filters as any, signal }),
  create: (data: Partial<SupplierCredit>) => api.post<SupplierCredit>('/purchases/credits', data),
  update: (id: string, data: Partial<SupplierCredit>) => api.patch<SupplierCredit>(`/purchases/credits/${id}`, data),
  issue: (id: string) => api.post<SupplierCredit>(`/purchases/credits/${id}/issue`, {}),
  apply: (id: string, data: { paymentMethod?: string; bankAccountId?: string } = {}) => api.post<SupplierCredit>(`/purchases/credits/${id}/apply`, data),
  void: (id: string) => api.post<SupplierCredit>(`/purchases/credits/${id}/void`, {}),
  delete: (id: string) => api.delete<void>(`/purchases/credits/${id}`),
};

export const expensesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Expense>>('/purchases/expenses', { params: filters as any, signal }),
  create: (data: Partial<Expense>) => api.post<Expense>('/purchases/expenses', data),
  update: (id: string, data: Partial<Expense>) => api.patch<Expense>(`/purchases/expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/expenses/${id}`),
};

export const recurringExpensesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<RecurringExpense>>('/purchases/recurring-expenses', { params: filters as any, signal }),
  create: (data: Partial<RecurringExpense>) => api.post<RecurringExpense>('/purchases/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) => api.patch<RecurringExpense>(`/purchases/recurring-expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/recurring-expenses/${id}`),
};

export const purchasesReportsService = {
  getAging: (supplierId?: string) => api.get<any>('/purchases/reports/aging', { supplierId }),
};

export const supplierPricesService = {
  getAll: (supplierId?: string, signal?: AbortSignal) => api.get<any[]>('/purchases/supplier-prices', { params: { supplierId }, signal }),
  create: (data: any) => api.post<any>('/purchases/supplier-prices', data),
  delete: (id: string) => api.delete<void>(`/purchases/supplier-prices/${id}`),
};

// ─── SOLICITUDES DE COMPRA ──────────────────────────────────────────────────
export const purchaseRequestsService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<PurchaseRequest>>('/purchases/requests', { params: filters as any, signal }),
  getById: (id: string) => api.get<PurchaseRequest>(`/purchases/requests/${id}`),
  create: (data: Partial<PurchaseRequest>) => api.post<PurchaseRequest>('/purchases/requests', data),
  update: (id: string, data: Partial<PurchaseRequest>) => api.patch<PurchaseRequest>(`/purchases/requests/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/requests/${id}`),
  changeStatus: (id: string, status: string, reason?: string, supplierId?: string) => api.post<PurchaseRequest>(`/purchases/requests/${id}/status`, { status, reason, supplierId }),
};

// ─── GESTIÓN DE COMPRA ──────────────────────────────────────────────────────
export const purchaseManagementService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<PurchaseManagement>>('/purchases/management', { params: filters as any, signal }),
  getById: (id: string) => api.get<PurchaseManagement>(`/purchases/management/${id}`),
  create: (data: Partial<PurchaseManagement>) => api.post<PurchaseManagement>('/purchases/management', data),
  update: (id: string, data: Partial<PurchaseManagement>) => api.patch<PurchaseManagement>(`/purchases/management/${id}`, data),
  delete: (id: string) => api.delete<void>(`/purchases/management/${id}`),
  approve: (id: string) => api.post<PurchaseManagement>(`/purchases/management/${id}/approve`, {}),
  reject: (id: string, reason?: string) => api.post<PurchaseManagement>(`/purchases/management/${id}/reject`, { reason }),
  convertToOrder: (id: string) => api.post<PurchaseOrder>(`/purchases/management/${id}/convert-to-order`, {}),
};

// --- Aliases for better DX ---
export const billsService = supplierInvoicesService;
export const recurringBillsService = recurringSupplierInvoicesService;
export const paymentsService = paymentsMadeService;
export const vendorCreditsService = supplierCreditsService;
