import { api } from './api';
import type { ChartAccount, ChartAccountCsvRow } from '../types/accounting';

export const contabilidadService = {
  // Plan de Cuentas
  getChartOfAccounts: (refresh = false, signal?: AbortSignal) => api.get<ChartAccount[]>(`/accounting/accounts${refresh ? `?refresh=true&_t=${Date.now()}` : ''}`, { signal }),
  getAccount: (id: string, signal?: AbortSignal) => api.get<ChartAccount>(`/accounting/accounts/${id}`, { signal }),
  createAccount: (data: Partial<ChartAccount>) => api.post<ChartAccount>('/accounting/accounts', data),
  updateAccount: (id: string, data: Partial<ChartAccount>) => api.put<ChartAccount>(`/accounting/accounts/${id}`, data),
  deleteAccount: (id: string) => api.delete(`/accounting/accounts/${id}`),
  mergeAccount: (id: string, targetAccountId: string) => api.post<any>(`/accounting/accounts/${id}/merge`, { targetAccountId }),
  importAccounts: (data: ChartAccountCsvRow[], replace = false) => api.post<any>(`/accounting/accounts/import${replace ? '?replace=true' : ''}`, data),
  exportAccounts: () => api.get<string[][]>('/accounting/accounts/export'),
  getDefaultAccountsByIndustry: (industry: string) => api.get<any[]>(`/accounting/accounts/defaults/${industry}`),
  getAccountBalance: (id: string, dateFrom?: string, dateTo?: string, signal?: AbortSignal) => api.get<any>(`/accounting/accounts/${id}/balance`, { params: { dateFrom, dateTo }, signal }),
  getAccountTransactions: (accountId: string, params?: { page?: number; pageSize?: number; search?: string; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any>('/financials/transactions', { params: { accountId, ...params }, signal }),

  // Asientos Contables
  getJournals: (params?: { status?: string; dateFrom?: string; dateTo?: string; accountId?: string; referenceType?: string; referenceId?: string; search?: string; costCenterId?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api.get<any>('/accounting/journals', { params, signal }),
  getJournal: (id: string, signal?: AbortSignal) => api.get<any>(`/accounting/journals/${id}`, { signal }),
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
  getTrialBalance: (params?: { dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any[]>('/accounting/reports/trial-balance', { params, signal }),
  getProfitLoss: (params: { dateFrom: string; dateTo: string; previousYear?: boolean }, signal?: AbortSignal) =>
    api.get<any>('/accounting/reports/profit-loss', { params, signal }),
  getBalanceSheet: (params: { date: string; previousYear?: boolean }, signal?: AbortSignal) =>
    api.get<any>('/accounting/reports/balance-sheet', { params, signal }),
  getCashFlow: (params: { dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any>('/accounting/reports/cash-flow', { params, signal }),
  getModuleActivity: (limit = 60, signal?: AbortSignal) =>
    api.get<any>('/accounting/module-activity', { params: { limit }, signal }),
  getBankDailyBook: (params: { bankAccountId?: string; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any>('/accounting/bank-daily-book', { params, signal }),

  // Diferencias cambiarias
  getExchangeDifferencesPreview: (params?: { asOfDate?: string; rate?: number }, signal?: AbortSignal) =>
    api.get<any>('/accounting/exchange-differences/preview', { params, signal }),
  saveExchangeDifferencesRun: (data: { asOfDate?: string; rate?: number }) =>
    api.post<any>('/accounting/exchange-differences/runs', data),
  getExchangeDifferencesRuns: (limit = 20, signal?: AbortSignal) =>
    api.get<any[]>('/accounting/exchange-differences/runs', { params: { limit }, signal }),
  getExchangeDifferencesRun: (id: string, signal?: AbortSignal) =>
    api.get<any>(`/accounting/exchange-differences/runs/${id}`, { signal }),
  createExchangeDifferencesJournal: (id: string) =>
    api.post<any>(`/accounting/exchange-differences/runs/${id}/journal`, {}),
  postExchangeDifferencesRun: (id: string) =>
    api.post<any>(`/accounting/exchange-differences/runs/${id}/post`, {}),
  createExchangeDifferencesReversal: (id: string, date?: string) =>
    api.post<any>(`/accounting/exchange-differences/runs/${id}/reversal`, date ? { date } : {}),

  // Conciliación Bancaria
  getReconciliations: (signal?: AbortSignal) => api.get<any[]>('/accounting/reconciliations', { signal }),
  getReconciliation: (id: string, signal?: AbortSignal) => api.get<any>(`/accounting/reconciliations/${id}`, { signal }),
  getReconciliationPreview: (accountId: string, period: string, signal?: AbortSignal) => api.get<any>(`/accounting/reconciliations/preview?accountId=${encodeURIComponent(accountId)}&period=${encodeURIComponent(period)}`, { signal }),
  createReconciliation: (data: any) => api.post<any>('/accounting/reconciliations', data),
  updateReconciliation: (id: string, data: any) => api.patch<any>(`/accounting/reconciliations/${id}`, data),
  autoMatchReconciliation: (id: string) => api.post<any>(`/accounting/reconciliations/${id}/auto-match`, {}),
  updateReconciliationItem: (id: string, itemId: string, data: any) => api.patch<any>(`/accounting/reconciliations/${id}/items/${itemId}`, data),
  addReconciliationItem: (id: string, data: any) => api.post<any>(`/accounting/reconciliations/${id}/items`, data),
  completeReconciliation: (id: string) => api.post<any>(`/accounting/reconciliations/${id}/complete`, {}),

  // Períodos
  getPeriods: (signal?: AbortSignal) => api.get<any[]>('/accounting/periods', { signal }),
  createPeriod: (data: any) => api.post<any>('/accounting/periods', data),
  closePeriod: (id: string) => api.post<any>(`/accounting/periods/${id}/close`, {}),
  reopenPeriod: (id: string) => api.post<any>(`/accounting/periods/${id}/reopen`, {}),

  // Reportes Fiscales
  getFiscalReports: (signal?: AbortSignal) => api.get<any[]>('/accounting/fiscal-reports', { signal }),
  generateIvaDeclaration: (month: number, year: number) => api.post<any>(`/accounting/fiscal-reports/iva/${month}/${year}`, {}),
  generateIrDeclaration: (year: number) => api.post<any>(`/accounting/fiscal-reports/ir/${year}`, {}),
  generateInssPayroll: (month: number, year: number) => api.post<any>(`/accounting/fiscal-reports/inss/${month}/${year}`, {}),
  generateInatecPayroll: (month: number, year: number) => api.post<any>(`/accounting/fiscal-reports/inatec/${month}/${year}`, {}),
  registerFiscalReportBackup: (data: { type: string; year: number; month?: number | null; fileUri: string; fileName?: string; actaUri?: string | null; actaFileName?: string | null; submittedAt?: string | null; notes?: string | null }) =>
    api.post<any>('/accounting/fiscal-reports/backup', data),
  deleteFiscalReport: (id: string) => api.delete<any>(`/accounting/fiscal-reports/${id}`),

  // Libro Mayor
  getLedger: (params?: { accountId?: string; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any[]>('/accounting/ledger', { params, signal }),

  // Estado de Cambios en el Patrimonio
  getEquityChanges: (params?: { dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any>('/accounting/equity-changes', { params, signal }),

  // Activos Fijos
  getFixedAssets: (signal?: AbortSignal) => api.get<any[]>('/accounting/fixed-assets', { signal }),
  registerFixedAsset: (data: any) => api.post<any>('/accounting/fixed-assets', data),

  // Activos Fijos (nuevo módulo)
  getFixedAssetCategories: (signal?: AbortSignal) => api.get<any[]>('/accounting/fixed-assets/categories', { signal }),
  seedFixedAssetCategories: () => api.post<any>('/accounting/fixed-assets/categories/seed', {}),
  createFixedAssetCategory: (data: any) => api.post<any>('/accounting/fixed-assets/categories', data),
  updateFixedAssetCategory: (id: string, data: any) => api.patch<any>(`/accounting/fixed-assets/categories/${id}`, data),
  deleteFixedAssetCategory: (id: string) => api.delete(`/accounting/fixed-assets/categories/${id}`),
  getFixedAssetsDetail: (signal?: AbortSignal) => api.get<any[]>('/accounting/fixed-assets/records', { signal }),
  getFixedAssetDetail: (id: string, signal?: AbortSignal) => api.get<any>(`/accounting/fixed-assets/${id}`, { signal }),
  createFixedAsset: (data: any) => api.post<any>('/accounting/fixed-assets/records', data),
  updateFixedAsset: (id: string, data: any) => api.patch<any>(`/accounting/fixed-assets/${id}`, data),
  generateFixedAssetProjection: (id: string) => api.post<any>(`/accounting/fixed-assets/${id}/depreciation/generate-projection`, {}),
  processFixedAssetDepreciation: (period: string) => api.post<any>('/accounting/fixed-assets/depreciation/process', { period }),
  validateFixedAssetImport: (rows: any[]) => api.post<any>('/accounting/fixed-assets/validate-import', { rows }),
  importFixedAssets: (rows: any[]) => api.post<any>('/accounting/fixed-assets/import', { rows }),

  // Import CSV
  importCsv: (data: { type: string; rows: any[][] }) => api.post<any>('/accounting/import/csv', data),

  // Eliminar asiento (borrador)
  deleteJournal: (id: string) => api.delete(`/accounting/journals/${id}`),

  // Bloquear período
  lockPeriod: (id: string) => api.post<any>(`/accounting/periods/${id}/lock`, {}),

  // Configuración Contable
  getConfig: (signal?: AbortSignal) => api.get<any>('/accounting/config', { signal }),
  updateConfig: (data: any) => api.put<any>('/accounting/config', data),
  seedConfig: () => api.post<any>('/accounting/config/seed', {}),

  // Cuentas sugeridas por tipo de documento
  getSuggestedAccounts: (signal?: AbortSignal) => api.get<any>('/accounting/suggested-accounts', { signal }),

  // Importar catálogo completo por industria con jerarquía
  importDefaultsWithHierarchy: (industry: string) => api.post<any>(`/accounting/import-defaults/${industry}`, {}),

  // Test Connections
  testConnections: (signal?: AbortSignal) => api.get<any>('/accounting/test-connections', { signal }),

  // Budget Items
  getBudgetItems: (period?: string, signal?: AbortSignal) => api.get<any[]>('/accounting/budget-items', { params: { period }, signal }),
  getBudgetItem: (id: string, signal?: AbortSignal) => api.get<any>(`/accounting/budget-items/${id}`, { signal }),
  createBudgetItem: (data: any) => api.post<any>('/accounting/budget-items', data),
  updateBudgetItem: (id: string, data: any) => api.put<any>(`/accounting/budget-items/${id}`, data),
  deleteBudgetItem: (id: string) => api.delete(`/accounting/budget-items/${id}`),
  checkBudgetAvailability: (accountId: string, amount: number, period?: string, signal?: AbortSignal) =>
    api.get<any[]>('/accounting/budget-items/check/' + accountId, { params: { amount, period }, signal }),

  // Expense Categories
  getExpenseCategories: (accountType?: string, signal?: AbortSignal) => api.get<any[]>('/accounting/expense-categories', { params: { accountType }, signal }),
  getExpenseCategory: (id: string, signal?: AbortSignal) => api.get<any>(`/accounting/expense-categories/${id}`, { signal }),
  createExpenseCategory: (data: any) => api.post<any>('/accounting/expense-categories', data),
  updateExpenseCategory: (id: string, data: any) => api.put<any>(`/accounting/expense-categories/${id}`, data),
  deleteExpenseCategory: (id: string) => api.delete(`/accounting/expense-categories/${id}`),

  // Tax Catalog
  getTaxCatalog: (type?: string, signal?: AbortSignal) => api.get<any[]>('/accounting/tax-catalog', { params: { type }, signal }),
  createTaxCatalogEntry: (data: any) => api.post<any>('/accounting/tax-catalog', data),
  updateTaxCatalogEntry: (id: string, data: any) => api.put<any>(`/accounting/tax-catalog/${id}`, data),
  deleteTaxCatalogEntry: (id: string) => api.delete(`/accounting/tax-catalog/${id}`),
  seedDefaultTaxCatalog: () => api.post<any>('/accounting/tax-catalog/seed', {}),

  // Auditoría de Facturas
  getInvoiceAuditList: (params: { kind: 'SALE' | 'PURCHASE'; search?: string; auditStatus?: string; page?: number; pageSize?: number; dateFrom?: string; dateTo?: string }, signal?: AbortSignal) =>
    api.get<any>('/accounting/invoices/audit', { params, signal }),
  auditInvoices: (data: { kind: 'SALE' | 'PURCHASE'; invoiceIds: string[]; observations?: string }) =>
    api.post<any>('/accounting/invoices/audit', data),
  getInvoiceAuditHistory: (params: { kind?: 'SALE' | 'PURCHASE'; action?: string; search?: string; page?: number; pageSize?: number }, signal?: AbortSignal) =>
    api.get<any>('/accounting/invoices/audit/history', { params, signal }),
  sendToCorrect: (data: { kind: 'SALE' | 'PURCHASE'; invoiceIds: string[]; observations?: string }) =>
    api.post<any>('/accounting/invoices/audit/send-to-correct', data),
  cancelAuditedInvoice: (data: { kind: 'SALE' | 'PURCHASE'; invoiceId: string; reason?: string }) =>
    api.post<any>('/accounting/invoices/audit/cancel', data),
  registerReissue: (data: { kind: 'SALE' | 'PURCHASE'; invoiceId: string; newInvoiceId: string; observations?: string }) =>
    api.post<any>('/accounting/invoices/audit/reissue', data),
};
