import { api } from './api';
import type {
  Account, Income, Expense, RecurringExpense,
  JournalEntry, Transaction, PaginatedResponse, ApiFilters,
} from '../types';

export const accountsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Account>>('/financials/accounts', filters as any),
  getById: (id: string) => api.get<Account>(`/financials/accounts/${id}`),
  create: (data: Partial<Account>) => api.post<Account>('/financials/accounts', data),
  update: (id: string, data: Partial<Account>) => api.patch<Account>(`/financials/accounts/${id}`, data),
};

export const incomeService = {
  getAll: (filters?: ApiFilters) => api.get<Income[]>('/financials/income', filters as any),
  getById: (id: string) => api.get<Income>(`/financials/income/${id}`),
  create: (data: Partial<Income>) => api.post<Income>('/financials/income', data),
  update: (id: string, data: Partial<Income>) => api.patch<Income>(`/financials/income/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/income/${id}`),
  bulkImport: (data: any[]) => api.post<any>('/financials/income/bulk-import', data),
};

export const expensesService = {
  getAll: (filters?: ApiFilters) => api.get<Expense[]>('/financials/expenses', filters as any),
  getById: (id: string) => api.get<Expense>(`/financials/expenses/${id}`),
  create: (data: Partial<Expense>) => api.post<Expense>('/financials/expenses', data),
  update: (id: string, data: Partial<Expense>) => api.patch<Expense>(`/financials/expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/expenses/${id}`),
  bulkImport: (data: any[]) => api.post<any>('/financials/expenses/bulk-import', data),
};

export const recurringExpensesService = {
  getAll: (filters?: ApiFilters) => api.get<RecurringExpense[]>('/financials/recurring-expenses', filters as any),
  create: (data: Partial<RecurringExpense>) => api.post<RecurringExpense>('/financials/recurring-expenses', data),
  update: (id: string, data: Partial<RecurringExpense>) => api.patch<RecurringExpense>(`/financials/recurring-expenses/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/recurring-expenses/${id}`),
};

export const recurringIncomesService = {
  getAll: (filters?: ApiFilters) => api.get<any[]>('/financials/recurring-incomes', filters as any),
  create: (data: any) => api.post<any>('/financials/recurring-incomes', data),
  update: (id: string, data: any) => api.patch<any>(`/financials/recurring-incomes/${id}`, data),
  delete: (id: string) => api.delete<void>(`/financials/recurring-incomes/${id}`),
};

export const journalEntriesService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<JournalEntry>>('/financials/journals', filters as any),
  getById: (id: string) => api.get<JournalEntry>(`/financials/journals/${id}`),
  create: (data: Partial<JournalEntry>) => api.post<JournalEntry>('/financials/journals', data),
  post: (id: string) => api.patch<JournalEntry>(`/financials/journals/${id}/post`, {}),
};

// ✅ CORRECTED: was /transactions (404) → now /financials/transactions
export const transactionsService = {
  getAll: (filters?: ApiFilters) => api.get<PaginatedResponse<Transaction>>('/financials/transactions', filters as any),
};

export const balanceService = {
  getBalance: () => api.get<any>('/financials/balance'),
};
