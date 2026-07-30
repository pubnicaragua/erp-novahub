import { api } from './api';
import type { ChartAccount, ChartAccountCsvRow } from '../types/accounting';

export const contabilidadService = {
  // Plan de Cuentas
  getChartOfAccounts: (refresh = false) => api.get<ChartAccount[]>(`/accounting/accounts${refresh ? '?refresh=true' : ''}`),
  getAccount: (id: string) => api.get<ChartAccount>(`/accounting/accounts/${id}`),
  createAccount: (data: Partial<ChartAccount>) => api.post<ChartAccount>('/accounting/accounts', data),
  updateAccount: (id: string, data: Partial<ChartAccount>) => api.put<ChartAccount>(`/accounting/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete(`/accounting/accounts/${id}`),
  importAccounts: (data: ChartAccountCsvRow[], replace = false) => api.post<any>(`/accounting/accounts/import${replace ? '?replace=true' : ''}`, data),
  exportAccounts: () => api.get<string[][]>('/accounting/accounts/export'),
  getDefaultAccountsByIndustry: (industry: string) => api.get<any[]>(`/accounting/accounts/defaults/${industry}`),
  getAccountBalance: (id: string, dateFrom?: string, dateTo?: string) => api.get<any>(`/accounting/accounts/${id}/balance`, { params: { dateFrom, dateTo } }),

  // Asientos Contables
  getJournals: (params?: { status?: string; dateFrom?: string; dateTo?: string; accountId?: string; referenceType?: string; referenceId?: string; search?: string; costCenterId?: string }) =>
    api.get<any[]>('/accounting/journals', { params }),
  getJournal: (id: string) => api.get<any>(`/accounting/journals/${id}`),
  createJournal: (data: any) => api.post<any>('/accounting/journals', data),
  updateJournal: (id: string, data: any) => api.put<any>(`/accounting/journals/${id}`, data),
  postJournal: (id: string) => api.post<any>(`/accounting/journals/${id}/post`, {}),
  voidJournal: (id: string) => api.post<any>(`/accounting/journals/${id}/void`, {}),

  // Auto-generación
  autoGenerateFromInvoice: (id: string) => api.post<any>(`/accounting/auto-generate/invoice/${id}`, {}),
  autoGenerateFromPayment: (id: string) => api.post<any>(`/accounting/auto-generate/payment/${id}`, {}),
  autoGenerateFromSupplierInvoice: (id: string) => api.post<any>(`/accounting/auto-generate/supplier-invoice/${id}`, {}),
  autoGenerateFromPaymentMade: (id: string) => api.post<any>(`/accounting/auto-generate/payment-made/${id}`, {}),
  autoGenerateFromExpense: (id: string) => api.post<any>(`/accounting/auto-generate/expense/${id}`, {}),
  autoGenerateFromPayroll: (id: string) => api.post<any>(`/accounting/auto-generate/payroll/${id}`, {}),
  autoGenerateFromPurchaseReceipt: (id: string) => api.post<any>(`/accounting/auto-generate/purchase-receipt/${id}`, {}),
  autoGenerateFromCashRegisterSession: (id: string) => api.post<any>(`/accounting/auto-generate/cash-register/${id}`, {}),

  // Reportes
  getTrialBalance: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<any[]>('/accounting/reports/trial-balance', { params }),
  getProfitLoss: (params: { dateFrom: string; dateTo: string; previousYear?: boolean }) =>
    api.get<any>('/accounting/reports/profit-loss', { params }),
  getBalanceSheet: (params: { date: string; previousYear?: boolean }) =>
    api.get<any>('/accounting/reports/balance-sheet', { params }),
  getCashFlow: (params: { dateFrom: string; dateTo: string }) =>
    api.get<any>('/accounting/reports/cash-flow', { params }),

  // Conciliación Bancaria
  getReconciliations: () => api.get<any[]>('/accounting/reconciliations'),
  getReconciliation: (id: string) => api.get<any>(`/accounting/reconciliations/${id}`),
  createReconciliation: (data: any) => api.post<any>('/accounting/reconciliations', data),
  autoMatchReconciliation: (id: string) => api.post<any>(`/accounting/reconciliations/${id}/auto-match`, {}),
  completeReconciliation: (id: string) => api.post<any>(`/accounting/reconciliations/${id}/complete`, {}),

  // Períodos
  getPeriods: () => api.get<any[]>('/accounting/periods'),
  createPeriod: (data: any) => api.post<any>('/accounting/periods', data),
  closePeriod: (id: string) => api.post<any>(`/accounting/periods/${id}/close`, {}),
  reopenPeriod: (id: string) => api.post<any>(`/accounting/periods/${id}/reopen`, {}),

  // Reportes Fiscales
  getFiscalReports: () => api.get<any[]>('/accounting/fiscal-reports'),
  generateIvaDeclaration: (month: number, year: number) => api.post<any>(`/accounting/fiscal-reports/iva/${month}/${year}`, {}),
  generateIrDeclaration: (year: number) => api.post<any>(`/accounting/fiscal-reports/ir/${year}`, {}),
  generateInssPayroll: (month: number, year: number) => api.post<any>(`/accounting/fiscal-reports/inss/${month}/${year}`, {}),
  generateInatecPayroll: (month: number, year: number) => api.post<any>(`/accounting/fiscal-reports/inatec/${month}/${year}`, {}),

  // Libro Mayor
  getLedger: (params?: { accountId?: string; dateFrom?: string; dateTo?: string }) =>
    api.get<any[]>('/accounting/ledger', { params }),

  // Estado de Cambios en el Patrimonio
  getEquityChanges: (params?: { dateFrom?: string; dateTo?: string }) =>
    api.get<any>('/accounting/equity-changes', { params }),

  // Activos Fijos
  getFixedAssets: () => api.get<any[]>('/accounting/fixed-assets'),
  registerFixedAsset: (data: any) => api.post<any>('/accounting/fixed-assets', data),

  // Import CSV
  importCsv: (data: { type: string; rows: any[][] }) => api.post<any>('/accounting/import/csv', data),

  // Eliminar asiento (borrador)
  deleteJournal: (id: string) => api.delete(`/accounting/journals/${id}`),

  // Bloquear período
  lockPeriod: (id: string) => api.post<any>(`/accounting/periods/${id}/lock`, {}),

  // Configuración Contable
  getConfig: () => api.get<any>('/accounting/config'),
  updateConfig: (data: any) => api.put<any>('/accounting/config', data),
  seedConfig: () => api.post<any>('/accounting/config/seed', {}),

  // Cuentas sugeridas por tipo de documento
  getSuggestedAccounts: () => api.get<any>('/accounting/suggested-accounts'),

  // Importar catálogo completo por industria con jerarquía
  importDefaultsWithHierarchy: (industry: string) => api.post<any>(`/accounting/import-defaults/${industry}`, {}),

  // Test Connections
  testConnections: () => api.get<any>('/accounting/test-connections'),

  // Budget Items
  getBudgetItems: (period?: string) => api.get<any[]>('/accounting/budget-items', { params: { period } }),
  getBudgetItem: (id: string) => api.get<any>(`/accounting/budget-items/${id}`),
  createBudgetItem: (data: any) => api.post<any>('/accounting/budget-items', data),
  updateBudgetItem: (id: string, data: any) => api.put<any>(`/accounting/budget-items/${id}`, data),
  deleteBudgetItem: (id: string) => api.delete(`/accounting/budget-items/${id}`),
  checkBudgetAvailability: (accountId: string, amount: number, period?: string) =>
    api.get<any[]>('/accounting/budget-items/check/' + accountId, { params: { amount, period } }),

  // Expense Categories
  getExpenseCategories: (accountType?: string) => api.get<any[]>('/accounting/expense-categories', { params: { accountType } }),
  getExpenseCategory: (id: string) => api.get<any>(`/accounting/expense-categories/${id}`),
  createExpenseCategory: (data: any) => api.post<any>('/accounting/expense-categories', data),
  updateExpenseCategory: (id: string, data: any) => api.put<any>(`/accounting/expense-categories/${id}`, data),
  deleteExpenseCategory: (id: string) => api.delete(`/accounting/expense-categories/${id}`),

  // Tax Catalog
  getTaxCatalog: (type?: string) => api.get<any[]>('/accounting/tax-catalog', { params: { type } }),
  createTaxCatalogEntry: (data: any) => api.post<any>('/accounting/tax-catalog', data),
  updateTaxCatalogEntry: (id: string, data: any) => api.put<any>(`/accounting/tax-catalog/${id}`, data),
  deleteTaxCatalogEntry: (id: string) => api.delete(`/accounting/tax-catalog/${id}`),
  seedDefaultTaxCatalog: () => api.post<any>('/accounting/tax-catalog/seed', {}),
};
