export type ManagerFinanceView =
  | 'overview'
  | 'cash'
  | 'receivables'
  | 'payables'
  | 'income'
  | 'expenses'
  | 'recurring'
  | 'calendar'
  | 'analysis'
  | 'balance'
  | 'losses';

export const MANAGER_FINANCE_VIEWS: Array<{ id: ManagerFinanceView; label: string }> = [
  { id: 'overview', label: 'Resumen financiero' },
  { id: 'cash', label: 'Caja y Bancos' },
  { id: 'receivables', label: 'Cuentas por cobrar' },
  { id: 'payables', label: 'Cuentas por pagar' },
  { id: 'income', label: 'Ingresos' },
  { id: 'expenses', label: 'Gastos' },
  { id: 'recurring', label: 'Movimientos recurrentes' },
  { id: 'calendar', label: 'Calendario financiero' },
  { id: 'analysis', label: 'Análisis ingresos y gastos' },
  { id: 'balance', label: 'Balance general' },
  { id: 'losses', label: 'Pérdidas' },
];
