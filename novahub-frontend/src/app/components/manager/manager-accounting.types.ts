export type ManagerAccountingView =
  | 'overview'
  | 'chart'
  | 'journal'
  | 'ledger'
  | 'trialBalance'
  | 'profitLoss'
  | 'balanceSheet'
  | 'cashFlow'
  | 'exchange'
  | 'equity'
  | 'assets'
  | 'bankBook'
  | 'reconciliation'
  | 'periods'
  | 'fiscal'
  | 'invoiceAudit'
  | 'budgets'
  | 'expenseCategories'
  | 'hrPaymentRequests';

export const MANAGER_ACCOUNTING_VIEWS: Array<{ id: ManagerAccountingView; label: string }> = [
  { id: 'overview', label: 'Resumen contable' },
  { id: 'chart', label: 'Plan de Cuentas' },
  { id: 'journal', label: 'Libro Diario' },
  { id: 'ledger', label: 'Libro Mayor' },
  { id: 'trialBalance', label: 'Balance de Comprobación' },
  { id: 'profitLoss', label: 'Estado de Resultados' },
  { id: 'balanceSheet', label: 'Balance General' },
  { id: 'cashFlow', label: 'Flujo de Efectivo' },
  { id: 'exchange', label: 'Diferencias Cambiarias' },
  { id: 'equity', label: 'Cambios Patrimonio' },
  { id: 'assets', label: 'Activos Fijos' },
  { id: 'bankBook', label: 'Libro Diario de Bancos' },
  { id: 'reconciliation', label: 'Conciliación Bancaria' },
  { id: 'periods', label: 'Períodos Contables' },
  { id: 'fiscal', label: 'Reportes Fiscales' },
  { id: 'invoiceAudit', label: 'Auditoría de Facturas' },
  { id: 'budgets', label: 'Presupuestos' },
  { id: 'expenseCategories', label: 'Categorías Gastos' },
  { id: 'hrPaymentRequests', label: 'Solicitudes de pago RR. HH.' },
];
