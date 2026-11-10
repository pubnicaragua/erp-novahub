import { api } from './api';
import { fetchAllReportPages } from '../utils/reportPagination';
import type {
  Account, Income, Expense, RecurringExpense,
  JournalEntry, Transaction, PaginatedResponse, ApiFilters,
} from '../types';

export interface FinanceSourceDocumentLookup {
  id: string;
  number: string;
  date: string;
  dueDate?: string | null;
  status: string;
  total: number;
  balance: number;
  currency: string;
  exchangeRate?: number;
  customerId?: string | null;
  customerCode?: string | null;
  customerName?: string | null;
  supplierId?: string | null;
  supplierCode?: string | null;
  supplierName?: string | null;
  origin: 'SALES' | 'PURCHASES';
}

export interface FinanceAccountLookup {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype?: string | null;
  isActive: boolean;
  acceptsPostings: boolean;
}

export interface FinanceOperationalDashboardSummary {
  incomeGroups: Array<{ month: string; currency: string; exchangeRate: number; amount: number }>;
  expenseGroups: Array<{ month: string; category: string; currency: string; exchangeRate: number; amount: number }>;
  recurringExpenseGroups: Array<{ frequency: string; currency: string; exchangeRate: number; amount: number }>;
  recurringIncomeGroups: Array<{ frequency: string; currency: string; exchangeRate: number; amount: number }>;
}

export const financeDashboardService = {
  getOperationalSummary: (filters?: ApiFilters, signal?: AbortSignal) =>
    api.get<FinanceOperationalDashboardSummary>('/financials/dashboard-summary', { params: filters as any, signal }),
};

export const sourceDocumentsService = {
  getLookup: (filters?: ApiFilters & { origin: 'SALES' | 'PURCHASES'; branchId?: string; warehouseId?: string }, signal?: AbortSignal) =>
    api.get<PaginatedResponse<FinanceSourceDocumentLookup>>('/financials/source-documents/lookup', { params: filters as any, signal }),
  getDashboardSummary: (origin: 'SALES' | 'PURCHASES', signal?: AbortSignal) =>
    api.get<Array<{ currency: string; exchangeRate: number; agingBucket: string; amount: number }>>(
      '/financials/source-documents/dashboard-summary', { params: { origin }, signal },
    ),
  /** Todos los documentos origen (páginas de 200); una sola página dejaba fuera los más antiguos. */
  getAllLookup: (filters: ApiFilters & { origin: 'SALES' | 'PURCHASES'; branchId?: string; warehouseId?: string }, signal?: AbortSignal) =>
    fetchAllReportPages<FinanceSourceDocumentLookup>(
      (page) => sourceDocumentsService.getLookup({ ...filters, ...page }, signal),
      { pageSize: 200 },
      signal,
    ),
};

export const accountsService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Account>>('/financials/accounts', { params: filters as any, signal }),
  getCashBankSummary: (signal?: AbortSignal) => api.get<Array<{ currency: string; amount: number }>>('/financials/accounts/cash-bank-summary', { signal }),
  getLookup: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<FinanceAccountLookup>>('/financials/accounts/lookup', { params: filters as any, signal }),
  getById: (id: string) => api.get<Account>(`/financials/accounts/${id}`),
  create: (data: Partial<Account>) => api.post<Account>('/financials/accounts', data),
  update: (id: string, data: Partial<Account>) => api.patch<Account>(`/financials/accounts/${id}`, data),
};

export const incomeService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Income>>('/financials/income', { params: filters as any, signal }),
  getById: (id: string) => api.get<Income>(`/financials/income/${id}`),
  create: (data: Partial<Income>) => api.post<Income>('/financials/income', data),
  update: (id: string, data: Partial<Income>) => api.patch<Income>(`/financials/income/${id}`, data),
  bulkImport: (data: any[]) => api.post<any>('/financials/income/bulk-import', data),
};

export const expensesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Expense>>('/financials/expenses', { params: filters as any, signal }),
  getById: (id: string) => api.get<Expense>(`/financials/expenses/${id}`),
  create: (data: Partial<Expense>) => api.post<Expense>('/financials/expenses', data),
  update: (id: string, data: Partial<Expense>) => api.patch<Expense>(`/financials/expenses/${id}`, data),
  cancel: (id: string) => api.post<Expense>(`/financials/expenses/${id}/cancel`, {}),
  delete: (id: string) => api.delete<void>(`/financials/expenses/${id}`),
  bulkImport: (data: Partial<Expense>[]) => api.post<{ success: number; count: number; failed: number }>('/financials/expenses/bulk-import', data),
};

export const recurringExpensesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<RecurringExpense>>('/financials/recurring-expenses', { params: filters as any, signal }),
  create: (data: Partial<RecurringExpense>) => api.post<RecurringExpense>('/financials/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) => api.patch<RecurringExpense>(`/financials/recurring-expenses/${id}`, data),
  pause: (id: string) => api.post<RecurringExpense>(`/financials/recurring-expenses/${id}/pause`, {}),
  resume: (id: string) => api.post<RecurringExpense>(`/financials/recurring-expenses/${id}/resume`, {}),
  cancel: (id: string) => api.post<RecurringExpense>(`/financials/recurring-expenses/${id}/cancel`, {}),
};

export const loanInstallmentsService = {
  getAll: (params?: { status?: string; incomeId?: string }) => api.get<any[]>('/financials/loan-installments', { params: params as any }),
  pay: (id: string, data: { date?: string; paymentMethod?: string; bankAccountId?: string }) => api.post<any>(`/financials/loan-installments/${id}/pay`, data),
};

export const recurringIncomesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<any>>('/financials/recurring-incomes', { params: filters as any, signal }),
  create: (data: any) => api.post<any>('/financials/recurring-incomes', data),
  update: (id: string, data: any) => api.patch<any>(`/financials/recurring-incomes/${id}`, data),
  pause: (id: string) => api.post<any>(`/financials/recurring-incomes/${id}/pause`, {}),
  resume: (id: string) => api.post<any>(`/financials/recurring-incomes/${id}/resume`, {}),
  cancel: (id: string) => api.post<any>(`/financials/recurring-incomes/${id}/cancel`, {}),
};

export const journalEntriesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<JournalEntry>>('/financials/journals', { params: filters as any, signal }),
  getById: (id: string) => api.get<JournalEntry>(`/financials/journals/${id}`),
  post: (id: string) => api.patch<JournalEntry>(`/financials/journals/${id}/post`, {}),
};

// ✅ CORRECTED: was /transactions (404) → now /financials/transactions
export const transactionsService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Transaction>>('/financials/transactions', { params: filters as any, signal }),
};

export const balanceService = {
  getBalance: (signal?: AbortSignal) => api.get<any>('/financials/balance', { signal }),
};
