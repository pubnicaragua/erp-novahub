import { api } from './api';
import type {
  Account, Income, Expense, RecurringExpense,
  JournalEntry, Transaction, PaginatedResponse, ApiFilters,
} from '../types';

export const accountsService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Account>>('/financials/accounts', { params: filters as any, signal }),
  getById: (id: string) => api.get<Account>(`/financials/accounts/${id}`),
  create: (data: Partial<Account>) => api.post<Account>('/financials/accounts', data),
  update: (id: string, data: Partial<Account>) => api.patch<Account>(`/financials/accounts/${id}`, data),
};

export const incomeService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Income>>('/financials/income', { params: filters as any, signal }),
  getById: (id: string) => api.get<Income>(`/financials/income/${id}`),
  create: (data: Partial<Income>) => api.post<Income>('/financials/income', data),
  update: (id: string, data: Partial<Income>) => api.patch<Income>(`/financials/income/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/income/${id}`),
};

export const expensesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<Expense>>('/financials/expenses', { params: filters as any, signal }),
  getById: (id: string) => api.get<Expense>(`/financials/expenses/${id}`),
  create: (data: Partial<Expense>) => api.post<Expense>('/financials/expenses', data),
  bulkImport: (data: Partial<Expense>[]) => api.post<{ success: number; count: number; failed: number }>('/financials/expenses/bulk-import', data),
  update: (id: string, data: Partial<Expense>) => api.patch<Expense>(`/financials/expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/expenses/${id}`),
};

export const recurringExpensesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<RecurringExpense>>('/financials/recurring-expenses', { params: filters as any, signal }),
  create: (data: Partial<RecurringExpense>) => api.post<RecurringExpense>('/financials/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) => api.patch<RecurringExpense>(`/financials/recurring-expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/recurring-expenses/${id}`),
};

export const recurringIncomesService = {
  getAll: (filters?: ApiFilters, signal?: AbortSignal) => api.get<PaginatedResponse<any>>('/financials/recurring-incomes', { params: filters as any, signal }),
  create: (data: any) => api.post<any>('/financials/recurring-incomes', data),
  update: (id: string, data: any) => api.patch<any>(`/financials/recurring-incomes/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/recurring-incomes/${id}`),
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
