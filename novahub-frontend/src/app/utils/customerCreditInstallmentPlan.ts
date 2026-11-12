import { getCurrencyDecimalPlaces, roundCurrencyNumber } from './currency';

export type CustomerCreditFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
export type CustomerCreditPlanCalculationMode = 'AMOUNT' | 'DEADLINE';

export type CustomerCreditPlanEstimate = {
  firstInstallmentDate: string;
  finalDueDate: string;
  installmentAmount: number;
  installmentCount: number;
};

const MAX_INSTALLMENTS = 10_000;

function dateAt(firstDate: string, frequency: CustomerCreditFrequency, offset: number) {
  const [year, month, day] = firstDate.split('-').map(Number);
  if (frequency === 'MONTHLY') {
    const targetMonth = month - 1 + offset;
    const targetYear = year + Math.floor(targetMonth / 12);
    const normalizedMonth = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
  }
  const days = frequency === 'DAILY' ? 1 : frequency === 'WEEKLY' ? 7 : 15;
  return new Date(Date.UTC(year, month - 1, day + days * offset)).toISOString().slice(0, 10);
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) === value;
}

export function calculateCustomerCreditPlanEstimate(input: {
  principal: number;
  interest?: number;
  frequency: CustomerCreditFrequency;
  firstInstallmentDate: string;
  calculationMode: CustomerCreditPlanCalculationMode;
  installmentAmount?: number | string;
  finalDueDate?: string;
}): CustomerCreditPlanEstimate | null {
  const principal = Number(input.principal || 0);
  const interest = Number(input.interest || 0);
  const total = roundCurrencyNumber(principal + interest, getCurrencyDecimalPlaces());
  if (!Number.isFinite(total) || total <= 0 || !isDateOnly(input.firstInstallmentDate)) return null;

  let installmentCount = 0;
  let finalDueDate = '';
  let installmentAmount = 0;
  if (input.calculationMode === 'AMOUNT') {
    installmentAmount = Number(input.installmentAmount || 0);
    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) return null;
    installmentAmount = roundCurrencyNumber(installmentAmount, getCurrencyDecimalPlaces());
    if (installmentAmount <= 0) return null;
    installmentCount = Math.ceil(total / installmentAmount);
    if (!Number.isFinite(installmentCount) || installmentCount < 1 || installmentCount > MAX_INSTALLMENTS) return null;
    finalDueDate = dateAt(input.firstInstallmentDate, input.frequency, installmentCount - 1);
  } else {
    if (!isDateOnly(input.finalDueDate) || input.finalDueDate! < input.firstInstallmentDate) return null;
    finalDueDate = input.finalDueDate!;
    installmentCount = 1;
    while (installmentCount <= MAX_INSTALLMENTS
      && dateAt(input.firstInstallmentDate, input.frequency, installmentCount) <= finalDueDate) {
      installmentCount += 1;
    }
    if (installmentCount > MAX_INSTALLMENTS) return null;
    installmentAmount = roundCurrencyNumber(total / installmentCount, getCurrencyDecimalPlaces());
    if (installmentAmount <= 0) return null;
  }

  return {
    firstInstallmentDate: input.firstInstallmentDate,
    finalDueDate,
    installmentAmount,
    installmentCount,
  };
}
