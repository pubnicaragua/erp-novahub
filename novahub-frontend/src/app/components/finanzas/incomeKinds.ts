/**
 * Tipos de movimiento de Finanzas > Ingresos. Solo OPERATING es ingreso del negocio; los demás son
 * entradas de dinero que acreditan patrimonio o pasivo y no entran en ventas, ingresos ni impuestos.
 */
export type IncomeKind = 'OPERATING' | 'PARTNER_CONTRIBUTION' | 'LOAN_RECEIVED' | 'FINANCING';

export interface IncomeKindOption {
  value: IncomeKind;
  label: string;
  accountType: 'INCOME' | 'EQUITY' | 'LIABILITY';
  /** Código sugerido del catálogo contable (editable por el usuario). */
  defaultCode: string;
  counterpartyLabel: string;
  help: string;
}

export const INCOME_KIND_OPTIONS: IncomeKindOption[] = [
  { value: 'OPERATING', label: 'Ingreso operativo', accountType: 'INCOME', defaultCode: '4000', counterpartyLabel: 'Origen', help: 'Ingresa al estado de resultados y a los totales de ventas e ingresos.' },
  { value: 'PARTNER_CONTRIBUTION', label: 'Aporte de socio', accountType: 'EQUITY', defaultCode: '3000', counterpartyLabel: 'Socio', help: 'Aumenta el patrimonio (Capital social). No es ingreso ni base de impuestos.' },
  { value: 'LOAN_RECEIVED', label: 'Préstamo recibido', accountType: 'LIABILITY', defaultCode: '2600', counterpartyLabel: 'Acreedor / banco', help: 'Aumenta un pasivo por pagar. No es ingreso ni base de impuestos.' },
  { value: 'FINANCING', label: 'Financiamiento', accountType: 'LIABILITY', defaultCode: '2610', counterpartyLabel: 'Acreedor', help: 'Aumenta un pasivo por pagar. No es ingreso ni base de impuestos.' },
];

export const incomeKindLabel = (kind?: string | null) =>
  INCOME_KIND_OPTIONS.find((option) => option.value === String(kind || 'OPERATING').toUpperCase())?.label || 'Ingreso operativo';

/** Las filas históricas no traen `kind`: son ingresos operativos. */
export const isOperatingIncome = (row: { kind?: string | null } | null | undefined) =>
  !row?.kind || String(row.kind).toUpperCase() === 'OPERATING';

export const isLoanKind = (kind?: string | null) => ['LOAN_RECEIVED', 'FINANCING'].includes(String(kind || '').toUpperCase());

export interface InstallmentPreview { sequence: number; dueDate: string; principal: number; interest: number }

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Vista previa de la tabla de pagos; el backend recalcula con la misma fórmula al guardar. */
export function previewLoanSchedule(
  principal: number,
  annualRatePercent: number,
  months: number,
  firstDueDate: string,
  method: 'FRENCH' | 'EQUAL_PRINCIPAL',
): InstallmentPreview[] {
  if (!(principal > 0) || !Number.isInteger(months) || months < 1 || months > 600 || !firstDueDate) return [];
  const rate = Math.max(0, annualRatePercent) / 100 / 12;
  const fixed = rate === 0 ? principal / months : (principal * rate) / (1 - Math.pow(1 + rate, -months));
  const [year, month, day] = firstDueDate.split('-').map(Number);
  let balance = round2(principal);
  const rows: InstallmentPreview[] = [];
  for (let index = 0; index < months; index += 1) {
    const interest = round2(balance * rate);
    let capital = index === months - 1 ? balance : (method === 'EQUAL_PRINCIPAL' || rate === 0 ? round2(principal / months) : round2(fixed - interest));
    capital = Math.min(capital, balance);
    balance = round2(balance - capital);
    const target = new Date(Date.UTC(year, month - 1 + index, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(day, lastDay));
    rows.push({ sequence: index + 1, dueDate: target.toISOString().slice(0, 10), principal: capital, interest });
  }
  return rows;
}
