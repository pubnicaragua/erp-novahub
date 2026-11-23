import { calculateCustomerCreditPlanEstimate, type CustomerCreditManualInstallmentDraft } from './customerCreditInstallmentPlan';

type CustomerDebtStatementInput = {
  status?: string | null;
  total: number;
  amountPaid?: number | null;
  balance?: number | null;
  date?: string | null;
  dueDate?: string | null;
  principalAmount?: number | null;
  interestAmount?: number | null;
  planEnabled?: boolean;
  planCalculationMode?: 'AMOUNT' | 'DEADLINE' | 'MANUAL' | null;
  installmentAmount?: number | string | null;
  firstInstallmentDate?: string | null;
  frequency?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | null;
  installments?: Array<Record<string, any>> | null;
  manualInstallments?: CustomerCreditManualInstallmentDraft[] | null;
  excludedWeekdays?: number[] | null;
  excludedDates?: string[] | null;
  calendarExclusions?: { excludedWeekdays?: number[]; holidays?: Array<{ date?: string }> } | null;
};

function asDateOnly(value?: string | null): string | undefined {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

function asProjectedInstallment(row: Record<string, any>) {
  const totalAmount = Number(row.totalAmount || 0);
  return {
    ...row,
    status: 'PENDING',
    projected: true,
    principalPaid: 0,
    interestPaid: 0,
    remainingAmount: totalAmount,
  };
}

/** Provides a visible draft snapshot without presenting projections as persisted installments. */
export function resolveCustomerDebtStatementInstallments(input: CustomerDebtStatementInput): Array<Record<string, any>> {
  const installments = Array.isArray(input.installments) ? input.installments : [];
  if (String(input.status || '').toUpperCase() !== 'DRAFT') return installments;
  if (installments.length) return installments.map(asProjectedInstallment);

  const total = Number(input.total || 0);
  const amountPaid = Number(input.amountPaid || 0);
  const balance = Math.max(0, total - amountPaid);
  if (input.planEnabled) {
    const interest = Number(input.interestAmount || 0);
    const principal = Number(input.principalAmount ?? total - interest);
    const firstInstallmentDate = asDateOnly(input.firstInstallmentDate) || asDateOnly(input.date) || asDateOnly(input.dueDate);
    const mode = input.planCalculationMode || (input.firstInstallmentDate ? 'DEADLINE' : 'AMOUNT');
    const manualInstallments = input.manualInstallments || [];
    const excludedDates = input.excludedDates || (input.calendarExclusions?.holidays || [])
      .map((holiday) => asDateOnly(holiday.date))
      .filter((date): date is string => Boolean(date));
    const estimate = calculateCustomerCreditPlanEstimate({
      principal,
      interest,
      calculationMode: mode,
      frequency: input.frequency || 'WEEKLY',
      firstInstallmentDate,
      installmentAmount: input.installmentAmount || undefined,
      finalDueDate: asDateOnly(input.dueDate),
      manualInstallments,
      excludedWeekdays: input.excludedWeekdays || input.calendarExclusions?.excludedWeekdays || [],
      excludedDates,
    });
    if (estimate?.isValid && estimate.schedule.length) return estimate.schedule.map(asProjectedInstallment);
  }

  return [{
    installmentNumber: null,
    dueDate: asDateOnly(input.dueDate) || asDateOnly(input.date) || '',
    totalAmount: balance || total,
    remainingAmount: balance || total,
    status: 'DRAFT',
    draftSummary: true,
  }];
}
